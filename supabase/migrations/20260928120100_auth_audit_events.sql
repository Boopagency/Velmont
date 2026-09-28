-- Security events recorded from Supabase Auth's own tables: authenticator
-- enrolled or removed, and sessions ended (sign-out, "sign out everywhere",
-- a new temporary password, the end of the first access).
--
-- Kept apart from the remediation migration: it only adds audit triggers on
-- auth.mfa_factors and auth.sessions. They never raise, so a failure to
-- record can never block Supabase Auth.

create function private.auth_mfa_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  person uuid := coalesce(new.user_id, old.user_id);
begin
  if not exists (select 1 from public.admin_users where user_id = person) then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status::text = 'verified' and old.status::text <> 'verified' then
    perform set_config('velmont.actor', person::text, true);
    perform private.log_event('auth.mfa_enrolled', 'admin_user', person::text, '{}'::jsonb);
  elsif tg_op = 'DELETE' and old.status::text = 'verified' then
    -- By the person themselves, or by the server while issuing a temporary
    -- password (then no actor: the issue itself names the owner).
    if not exists (select 1 from public.admin_users where user_id = person and temporary_password_pending) then
      perform set_config('velmont.actor', person::text, true);
    end if;
    perform private.log_event('auth.mfa_removed', 'admin_user', person::text, '{}'::jsonb);
  end if;
  return null;
exception when others then
  return null;
end $$;

create trigger velmont_mfa_changed
  after update of status or delete on auth.mfa_factors
  for each row execute function private.auth_mfa_changed();

create function private.auth_sessions_revoked()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- One event per person and statement. The actor is whoever ended the
  -- sessions: a signed-in user, the server acting for an owner, or the person.
  insert into public.audit_log (actor_id, action, resource, resource_id, metadata)
  select coalesce(auth.uid(), nullif(current_setting('velmont.actor', true), '')::uuid, gone.user_id),
    'auth.sessions_revoked', 'admin_user', gone.user_id::text, jsonb_build_object('count', count(*))
  from gone_sessions gone
  where exists (select 1 from public.admin_users a where a.user_id = gone.user_id)
  group by gone.user_id;
  return null;
exception when others then
  return null;
end $$;

create trigger velmont_sessions_revoked
  after delete on auth.sessions
  referencing old table as gone_sessions
  for each statement execute function private.auth_sessions_revoked();

revoke all on function private.auth_mfa_changed(), private.auth_sessions_revoked() from public, anon, authenticated;
