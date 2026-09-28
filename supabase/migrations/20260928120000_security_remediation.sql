-- Security remediation after the white-box audit (2026-09-26).
--
-- Additive: new objects, replaced function bodies and revoked privileges.
-- Nothing is dropped and no existing row is deleted or rewritten.
--
-- 1. First access ends only through explicit server steps: the server checks
--    the temporary password, the database confirms a live aal2 session and a
--    verified authenticator (public.staff_begin_first_access), the server sets
--    the person's own password, and the database unlocks the account only if
--    that password changed after its own check
--    (public.staff_complete_first_access). A change of
--    auth.users.encrypted_password (recovery link, magic link, OTP session,
--    updateUser) is recorded but never unlocks the account.
-- 2. Media rows are deleted only through public.delete_media(), which refuses
--    images that a draft or a publication still uses.
-- 3. Publishing is checked (public.can_publish_article) before any image is
--    copied to the public bucket; copies made by a refused attempt are rolled
--    back at once (public.media_rollback_public).
-- 4. The legacy public.add_staff_member() is no longer callable: team access
--    goes through the temporary-password flow only.
-- 5. Audit: rebuild requests and failures, and refused security attempts.
-- 6. Conflicts are reported with SQLSTATE PT409 (HTTP 409). 40001 means
--    "serialization failure" to PostgREST, which retries the call without
--    end: a stale publish_article() call hung instead of answering.

-- ---------------------------------------------------------------------------
-- 1. First access
-- ---------------------------------------------------------------------------

-- The temporary password never reaches the database: only a salted scrypt
-- digest computed by the server, outside every schema the API exposes.
-- verified_* and password_set_at record the two database checkpoints of the
-- first access (see staff_begin_first_access and staff_complete_first_access).
create table private.staff_first_access (
  user_id uuid primary key references public.admin_users (user_id) on delete cascade,
  issue_id uuid not null,
  password_digest text not null check (char_length(password_digest) between 32 and 300),
  issued_at timestamptz not null default now(),
  verified_session uuid,
  verified_at timestamptz,
  password_set_at timestamptz
);
alter table private.staff_first_access enable row level security;
revoke all on private.staff_first_access from public, anon, authenticated, service_role;

-- A password change recorded by Supabase Auth unlocks nothing any more.
create or replace function private.auth_password_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  first_access boolean;
begin
  -- The server has just set a new temporary password (already audited).
  update public.admin_users set temporary_password_pending = false
  where user_id = new.id and temporary_password_pending;
  if found then
    return new;
  end if;
  -- The database verified this first access moments ago: the password the
  -- server sets now is the one staff_complete_first_access waits for.
  update private.staff_first_access set password_set_at = now()
  where user_id = new.id and verified_at > now() - interval '5 minutes';
  first_access := found;
  if exists (select 1 from public.admin_users where user_id = new.id) then
    perform set_config('velmont.actor', new.id::text, true);
    perform private.log_event('auth.password_changed', 'admin_user', new.id::text,
      jsonb_build_object('locked', (select u.must_change_password from public.admin_users u where u.user_id = new.id), 'first_access', first_access));
  end if;
  return new;
exception when others then
  -- Recording must never break Supabase Auth.
  return new;
end $$;

/**
 * Service role: locks the account until the first access is completed,
 * stores the digest of the new temporary password, ends every session and
 * records who issued it. New member when e-mail, name and role are given;
 * otherwise an existing, active member.
 */
create function public.staff_issue_temporary_access(
  p_actor uuid,
  p_user_id uuid,
  p_hours integer,
  p_digest text,
  p_email text default null,
  p_display_name text default null,
  p_role public.staff_role default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  expires timestamptz;
  new_member boolean := p_email is not null;
  target public.admin_users;
  issue uuid := gen_random_uuid();
begin
  if p_hours is null or p_hours not between 1 and 168 then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;
  if p_digest is null or char_length(p_digest) not between 32 and 300 then
    raise exception 'invalid_digest' using errcode = '22023';
  end if;
  expires := now() + make_interval(hours => p_hours);
  perform set_config('velmont.actor', coalesce(p_actor::text, ''), true);
  if new_member then
    insert into public.admin_users (user_id, email, display_name, role, must_change_password, temporary_password_expires_at, temporary_password_pending)
    values (p_user_id, lower(btrim(p_email)), btrim(p_display_name), p_role, true, expires, true)
    returning * into target;
  else
    select * into target from public.admin_users where user_id = p_user_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    -- A deactivated person is reactivated first, on purpose, by an owner.
    if not target.active then
      raise exception 'inactive' using errcode = '55000';
    end if;
    update public.admin_users
    set must_change_password = true, temporary_password_expires_at = expires, temporary_password_pending = true
    where user_id = p_user_id;
  end if;
  insert into private.staff_first_access (user_id, issue_id, password_digest, issued_at)
  values (p_user_id, issue, p_digest, now())
  on conflict (user_id) do update
    set issue_id = excluded.issue_id, password_digest = excluded.password_digest, issued_at = excluded.issued_at,
        verified_session = null, verified_at = null, password_set_at = null;
  -- Sessions opened before this password stop working at once.
  delete from auth.sessions where user_id = p_user_id;
  perform private.log_event('staff.temporary_password', 'admin_user', p_user_id::text,
    jsonb_build_object('expires_at', expires, 'new_member', new_member, 'role', target.role));
  return jsonb_build_object('expires_at', expires, 'issue_id', issue);
end $$;

/** Setting the password failed midway: the account stays locked and this temporary password never works. */
create or replace function public.staff_temporary_password_failed(p_user_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.admin_users
  set temporary_password_pending = false,
      temporary_password_expires_at = least(coalesce(temporary_password_expires_at, now()), now())
  where user_id = p_user_id and must_change_password;
  delete from private.staff_first_access where user_id = p_user_id;
$$;

/** What the first-access step needs to know about the caller's own JWT and session. */
create function public.first_access_state()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'session_id', s.id,
    'aal2', coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and coalesce(s.aal::text, '') = 'aal2',
    'member', coalesce(u.active, false),
    'pending', coalesce(u.active and u.must_change_password and u.temporary_password_expires_at > now(), false),
    'expired', coalesce(u.active and u.must_change_password and u.temporary_password_expires_at <= now(), false),
    'mfa_verified', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified'))
  from (select 1) one
  left join public.admin_users u on u.user_id = auth.uid()
  left join auth.sessions s on s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and s.user_id = auth.uid() and (s.not_after is null or s.not_after > now())
$$;

/** Service role: the digest of the pending temporary password, if it is still valid. */
create function public.staff_first_access_secret(p_user_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('issue_id', f.issue_id, 'digest', f.password_digest)
  from private.staff_first_access f
  join public.admin_users u on u.user_id = f.user_id
  where f.user_id = p_user_id and u.active and u.must_change_password and u.temporary_password_expires_at > now()
$$;

/** The pending first access of this issue, row locked; raises the reason otherwise. */
create function private.lock_first_access(p_user_id uuid, p_issue_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.admin_users;
begin
  select * into target from public.admin_users where user_id = p_user_id for update;
  if not found or not target.active or not target.must_change_password then
    raise exception 'not_pending' using errcode = 'P0002';
  end if;
  if target.temporary_password_expires_at is null or target.temporary_password_expires_at <= now() then
    raise exception 'expired' using errcode = '22023';
  end if;
  -- A newer temporary password was issued meanwhile: this attempt is void.
  if not exists (select 1 from private.staff_first_access f where f.user_id = p_user_id and f.issue_id = p_issue_id) then
    raise exception 'stale' using errcode = 'PT409';
  end if;
end $$;

/**
 * Service role, once the server has matched the temporary password: the
 * database itself confirms a verified authenticator and a live aal2 session
 * of this person for this issue, right before the server sets the person's
 * own password (Supabase Auth then ends every session, this one included).
 */
create function public.staff_begin_first_access(p_user_id uuid, p_issue_id uuid, p_session_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.lock_first_access(p_user_id, p_issue_id);
  if not exists (select 1 from auth.mfa_factors f where f.user_id = p_user_id and f.status::text = 'verified') then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.sessions s
    where s.id = p_session_id and s.user_id = p_user_id and coalesce(s.aal::text, '') = 'aal2'
      and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  update private.staff_first_access
  set verified_session = p_session_id, verified_at = now(), password_set_at = null
  where user_id = p_user_id;
end $$;

/**
 * Service role, after the server set the person's own password: unlocks the
 * account only if the database verified this issue moments ago, the password
 * changed after that check (so the temporary password never stays) and an
 * authenticator is still verified. Every session ends: the person signs in
 * again with the new password and the authenticator.
 */
create function public.staff_complete_first_access(p_user_id uuid, p_issue_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  f private.staff_first_access;
begin
  perform private.lock_first_access(p_user_id, p_issue_id);
  select * into f from private.staff_first_access where user_id = p_user_id;
  if f.verified_at is null or f.verified_at <= now() - interval '5 minutes' then
    raise exception 'not_verified' using errcode = '42501';
  end if;
  if f.password_set_at is null or f.password_set_at < f.verified_at then
    raise exception 'password_not_set' using errcode = '55000';
  end if;
  if not exists (select 1 from auth.mfa_factors m where m.user_id = p_user_id and m.status::text = 'verified') then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  perform set_config('velmont.actor', p_user_id::text, true);
  update public.admin_users
  set must_change_password = false, temporary_password_expires_at = null, temporary_password_pending = false
  where user_id = p_user_id;
  delete from private.staff_first_access where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform private.log_event('auth.password_set', 'admin_user', p_user_id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Media deletion
-- ---------------------------------------------------------------------------

/** Staff: deletes an image nobody uses; returns its path so the server removes the files. */
create function public.delete_media(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  m public.media;
begin
  perform private.require_staff();
  perform pg_advisory_xact_lock(hashtext('velmont.public_media'));
  select * into m from public.media where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.articles a where p_id = any (private.article_media_ids(a)))
     or m.path in (select p from private.published_media_paths() p where p is not null) then
    raise exception 'media_in_use' using errcode = '23503';
  end if;
  delete from public.media where id = p_id;
  return jsonb_build_object('path', m.path);
end $$;

revoke delete on public.media from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publication: validate before any copy; roll back refused attempts
-- ---------------------------------------------------------------------------

/** Staff: the checks publish_article() makes, run before any image becomes public. */
create function public.can_publish_article(p_id uuid, p_expected_version integer)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  a public.articles;
  ids uuid[];
begin
  perform private.require_staff();
  select * into a from public.articles where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;
  if a.status = 'archived' then
    raise exception 'archived' using errcode = '22023';
  end if;
  if char_length(btrim(a.title)) < 3 or char_length(btrim(a.excerpt)) < 10
     or jsonb_array_length(a.content -> 'blocks') = 0 then
    raise exception 'incomplete' using errcode = '22023';
  end if;
  ids := private.article_media_ids(a);
  if (select count(*) from public.media m where m.id = any (ids)) <> cardinality(ids) then
    raise exception 'media_missing' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(a.content -> 'blocks') b
    left join public.media m on m.id::text = b ->> 'mediaId'
    where b ->> 'type' = 'image' and m.path is distinct from b ->> 'path'
  ) then
    raise exception 'media_mismatch' using errcode = '22023';
  end if;
end $$;

/**
 * Service role: a publish attempt was refused after its images were copied.
 * Marks those images private again unless a publication uses them, and
 * returns the paths whose public copies must be removed now.
 */
create function public.media_rollback_public(p_ids uuid[])
returns setof text
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('velmont.public_media'));
  return query
    update public.media m set public_since = null
    where m.id = any (p_ids)
      and m.path not in (select p from private.published_media_paths() p where p is not null)
    returning m.path;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Legacy onboarding
-- ---------------------------------------------------------------------------

-- Team access goes through the temporary-password flow only.
revoke execute on function public.add_staff_member(text, text, public.staff_role) from public, anon, authenticated;
-- Superseded by staff_issue_temporary_access (it stored no digest).
revoke execute on function public.staff_issue_temporary_password(uuid, uuid, integer, text, text, public.staff_role) from service_role;

-- ---------------------------------------------------------------------------
-- 5. Audit
-- ---------------------------------------------------------------------------

create function private.site_builds_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('velmont.actor', coalesce(new.requested_by::text, ''), true);
    perform private.log_event(case when new.status = 'failed' then 'site.rebuild_failed' else 'site.rebuild_requested' end,
      'site_build', new.id::text, jsonb_build_object('reason', left(new.reason, 120), 'detail', left(new.detail, 120)));
  elsif new.status = 'failed' and old.status is distinct from 'failed' then
    perform private.log_event('site.build_failed', 'site_build', new.id::text, jsonb_build_object('detail', left(new.detail, 120)));
  end if;
  return null;
end $$;

create trigger site_builds_audit
  after insert or update of status on public.site_builds
  for each row execute function private.site_builds_audit();

/** Service role: records a refused security-relevant attempt (never secrets). */
create function public.staff_log_event(p_actor uuid, p_action text, p_resource_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_action not in ('auth.first_access_denied', 'staff.access_denied') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  perform set_config('velmont.actor', coalesce(p_actor::text, ''), true);
  perform private.log_event(p_action, 'admin_user', p_resource_id, coalesce(p_metadata, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 6. publish_article(): version conflict as PT409
-- ---------------------------------------------------------------------------

-- Same function, only the SQLSTATE of the version check changes. Stops if
-- the deployed definition is not the expected one.
do $$
declare
  current_def text := pg_get_functiondef('public.publish_article(uuid, integer)'::regprocedure);
  fixed_def text := replace(current_def, 'errcode = ''40001''', 'errcode = ''PT409''');
begin
  if position('errcode = ''PT409''' in current_def) > 0 then
    return;
  end if;
  if fixed_def = current_def or (length(current_def) - length(replace(current_def, '''40001''', ''))) <> length('''40001''') then
    raise exception 'publish_article: expected exactly one version_conflict errcode 40001';
  end if;
  execute fixed_def;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.site_builds_audit(), private.lock_first_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.staff_issue_temporary_access(uuid, uuid, integer, text, text, text, public.staff_role),
  public.staff_first_access_secret(uuid), public.staff_begin_first_access(uuid, uuid, uuid), public.staff_complete_first_access(uuid, uuid),
  public.media_rollback_public(uuid[]), public.staff_log_event(uuid, text, text, jsonb),
  public.first_access_state(), public.delete_media(uuid), public.can_publish_article(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.staff_issue_temporary_access(uuid, uuid, integer, text, text, text, public.staff_role),
  public.staff_first_access_secret(uuid), public.staff_begin_first_access(uuid, uuid, uuid), public.staff_complete_first_access(uuid, uuid),
  public.media_rollback_public(uuid[]), public.staff_log_event(uuid, text, text, jsonb)
  to service_role;
grant execute on function public.first_access_state(), public.delete_media(uuid), public.can_publish_article(uuid, integer)
  to authenticated;
