-- First access with a temporary password, without e-mail links.
--
-- An owner (in the panel) or the bootstrap script asks the server, which
-- uses the service role, for a unique random temporary password. The
-- password itself never reaches the database: Supabase Auth hashes it.
--
-- Until the person replaces it with their own:
--   * the account has no staff access at all, even with MFA verified:
--     private.current_staff_role() requires must_change_password = false;
--   * the replacement only counts before temporary_password_expires_at.
--     After that, only a new temporary password issued by an owner unlocks
--     the account.
-- The replacement is detected here, from the change Supabase Auth makes to
-- auth.users.encrypted_password. The browser is never trusted to report it.

alter table public.admin_users
  add column must_change_password boolean not null default false,
  add column temporary_password_expires_at timestamptz,
  -- Set while the server replaces the password with a new temporary one, so
  -- that this change is not taken for the person's own.
  add column temporary_password_pending boolean not null default false,
  add constraint admin_users_temporary_password_expiry
    check (not must_change_password or temporary_password_expires_at is not null);

-- ---------------------------------------------------------------------------
-- Staff access: a temporary password grants nothing.
-- ---------------------------------------------------------------------------

create or replace function private.current_staff_role()
returns public.staff_role
language sql stable security definer set search_path = ''
as $$
  select u.role from public.admin_users u
  where u.user_id = auth.uid()
    and u.active
    -- A temporary password only lets the person choose their own.
    and not u.must_change_password
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    -- The session must still exist: signing out (or revoking sessions)
    -- invalidates access tokens immediately, not only when they expire.
    and exists (
      select 1 from auth.sessions s
      where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = u.user_id
        and (s.not_after is null or s.not_after > now())
    )
$$;

create or replace function public.admin_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'is_member', u.user_id is not null and u.active,
    'role', case when u.active then u.role end,
    'display_name', case when u.active then u.display_name end,
    'must_change_password', coalesce(u.active and u.must_change_password, false),
    'temporary_password_expires_at', case when u.active and u.must_change_password then u.temporary_password_expires_at end,
    'temporary_password_expired', coalesce(u.active and u.must_change_password and u.temporary_password_expires_at <= now(), false),
    'is_staff', private.is_staff())
  from (select 1) one
  left join public.admin_users u on u.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Audit: service-role calls act on behalf of the owner the server verified.
-- ---------------------------------------------------------------------------

-- Requests with a user JWT always log that user; only service-role calls
-- (no auth.uid()) can name an actor, through a transaction-local setting.
create or replace function private.log_event(p_action text, p_resource text, p_resource_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, resource, resource_id, metadata)
  values (coalesce(auth.uid(), nullif(current_setting('velmont.actor', true), '')::uuid),
    p_action, p_resource, p_resource_id, coalesce(p_metadata, '{}'::jsonb))
$$;

-- Temporary-password bookkeeping writes its own events; only role and
-- active changes are "staff.update".
create or replace function private.admin_users_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.log_event('staff.remove', 'admin_user', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
  if tg_op = 'UPDATE' and new.role = old.role and new.active = old.active then
    return new;
  end if;
  perform private.log_event(case when tg_op = 'INSERT' then 'staff.add' else 'staff.update' end, 'admin_user', new.user_id::text,
    jsonb_build_object('role', new.role, 'active', new.active));
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Password changes, as recorded by Supabase Auth.
-- ---------------------------------------------------------------------------

create function private.auth_password_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- The server has just set a new temporary password: consume the marker.
  update public.admin_users set temporary_password_pending = false
  where user_id = new.id and temporary_password_pending;
  if found then
    return new;
  end if;
  -- The person chose their own password in time: the account is unlocked.
  update public.admin_users
  set must_change_password = false, temporary_password_expires_at = null
  where user_id = new.id and must_change_password and temporary_password_expires_at > now();
  if found then
    perform set_config('velmont.actor', new.id::text, true);
    perform private.log_event('auth.password_set', 'admin_user', new.id::text, '{}'::jsonb);
  end if;
  return new;
end $$;

create trigger velmont_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.auth_password_changed();

-- ---------------------------------------------------------------------------
-- Service role only (Vercel Function after verifying an owner, or the
-- bootstrap script). The server brackets these calls: it bans the Auth user,
-- calls staff_issue_temporary_password, removes the MFA factors, then sets the
-- new password and lifts the ban in one Auth update.
-- ---------------------------------------------------------------------------

/** Finds an Auth user by e-mail: null, or its id and whether it is already staff. */
create function public.staff_find_user(p_email text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('user_id', u.id, 'is_member', exists (select 1 from public.admin_users a where a.user_id = u.id))
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1
$$;

/**
 * Locks the account until a new temporary password is replaced: adds the
 * member (when e-mail, name and role are given) or updates the existing one,
 * ends every session of the person and records who issued it. Returns the
 * expiry.
 */
create function public.staff_issue_temporary_password(
  p_actor uuid,
  p_user_id uuid,
  p_hours integer,
  p_email text default null,
  p_display_name text default null,
  p_role public.staff_role default null)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  expires timestamptz;
  new_member boolean := p_email is not null;
begin
  if p_hours is null or p_hours not between 1 and 168 then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;
  expires := now() + make_interval(hours => p_hours);
  perform set_config('velmont.actor', coalesce(p_actor::text, ''), true);
  if new_member then
    insert into public.admin_users (user_id, email, display_name, role, must_change_password, temporary_password_expires_at, temporary_password_pending)
    values (p_user_id, lower(btrim(p_email)), btrim(p_display_name), p_role, true, expires, true);
  else
    update public.admin_users
    set must_change_password = true, temporary_password_expires_at = expires, temporary_password_pending = true
    where user_id = p_user_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  -- Sessions opened before this password stop working at once (the access
  -- checks require the session row, and Supabase Auth refuses them too).
  delete from auth.sessions where user_id = p_user_id;
  perform private.log_event('staff.temporary_password', 'admin_user', p_user_id::text,
    jsonb_build_object('expires_at', expires, 'new_member', new_member));
  return expires;
end $$;

/** Setting the password failed: drop the marker (the account stays locked). */
create function public.staff_temporary_password_failed(p_user_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.admin_users set temporary_password_pending = false where user_id = p_user_id
$$;

revoke all on function private.auth_password_changed() from public, anon, authenticated;
revoke all on function public.staff_find_user(text),
  public.staff_issue_temporary_password(uuid, uuid, integer, text, text, public.staff_role),
  public.staff_temporary_password_failed(uuid)
  from public, anon, authenticated;
grant execute on function public.staff_find_user(text),
  public.staff_issue_temporary_password(uuid, uuid, integer, text, text, public.staff_role),
  public.staff_temporary_password_failed(uuid)
  to service_role;
