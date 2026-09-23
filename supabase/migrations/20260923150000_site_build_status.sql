-- Site builds get a lifecycle: `pending` once Vercel accepted the deploy hook,
-- then `success` or `failed` when the production build finishes (reported by
-- scripts/build.mjs with the service role). Additive: `ok` is kept so older
-- code keeps working during a rollback.

alter table public.site_builds
  add column status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  add column finished_at timestamptz,
  add column deployment text check (char_length(deployment) <= 120);

update public.site_builds set status = 'failed', finished_at = requested_at where not ok;

create index site_builds_pending_idx on public.site_builds (requested_at) where status = 'pending';

/**
 * Service role (production build): resolves every request made before this
 * build started, since the build publishes the content they asked for.
 */
create function public.finish_site_builds(p_started_at timestamptz, p_success boolean, p_detail text default null)
returns integer
language sql security definer set search_path = ''
as $$
  with done as (
    update public.site_builds
    set status = case when p_success then 'success' else 'failed' end,
        finished_at = now(),
        detail = coalesce(left(p_detail, 300), detail)
    where status = 'pending' and requested_at <= p_started_at
    returning 1
  )
  select count(*)::integer from done
$$;

revoke all on function public.finish_site_builds(timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_site_builds(timestamptz, boolean, text) to service_role;
