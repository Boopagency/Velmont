-- Velmont admin CMS: articles, publication snapshots, media, leads and audit.
--
-- Security model
-- * Every table has RLS enabled. anon only reads `published_articles`.
-- * Staff = active row in `admin_users` AND a JWT with aal2 (MFA verified).
--   Roles never come from user-editable metadata.
-- * Writes that change workflow state go through SECURITY DEFINER functions
--   that re-check authorization; column grants block mass assignment.
-- * Leads, rate limits and storage writes are only reachable by the
--   service role used inside Vercel Functions.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.staff_role as enum ('owner', 'editor');
create type public.article_status as enum ('draft', 'review', 'published', 'archived');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'archived');

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  display_name text not null check (char_length(display_name) between 1 and 120),
  role public.staff_role not null default 'editor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.current_staff_role()
returns public.staff_role
language sql stable security definer set search_path = ''
as $$
  select u.role from public.admin_users u
  where u.user_id = auth.uid()
    and u.active
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.current_staff_role() is not null $$;

create function private.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_staff_role() = 'owner', false) $$;

create function private.require_staff()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.is_staff() is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function private.require_owner()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.is_owner() is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log (append only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 60),
  resource text not null check (char_length(resource) between 1 and 60),
  resource_id text check (char_length(resource_id) <= 120),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) < 4000)
);
create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);

create function private.log_event(p_action text, p_resource text, p_resource_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, resource, resource_id, metadata)
  values (auth.uid(), p_action, p_resource, p_resource_id, coalesce(p_metadata, '{}'::jsonb))
$$;

create function private.audit_log_is_append_only()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end $$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.audit_log_is_append_only();

-- ---------------------------------------------------------------------------
-- Validation helpers used by CHECK constraints
-- ---------------------------------------------------------------------------

create function private.is_text(v jsonb, max_len integer, min_len integer default 1)
returns boolean
language sql immutable set search_path = ''
as $$
  select v is not null and jsonb_typeof(v) = 'string'
    and char_length(v #>> '{}') between min_len and max_len
$$;

create function private.is_optional_text(v jsonb, max_len integer)
returns boolean
language sql immutable set search_path = ''
as $$ select v is null or jsonb_typeof(v) = 'null' or private.is_text(v, max_len, 0) $$;

create function private.is_media_path(v text)
returns boolean
language sql immutable set search_path = ''
as $$ select v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$' $$;

-- Content is a versioned list of typed blocks. Anything outside this
-- allow-list is rejected, and the public renderer applies the same rules.
create function private.is_array(v jsonb, min_len integer, max_len integer)
returns boolean
language plpgsql immutable set search_path = ''
as $$
begin
  if v is null or jsonb_typeof(v) <> 'array' then
    return false;
  end if;
  return jsonb_array_length(v) between min_len and max_len;
end $$;

create function private.is_dimension(v jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
begin
  if v is null or jsonb_typeof(v) <> 'number' then
    return false;
  end if;
  return (v #>> '{}')::numeric between 1 and 10000;
end $$;

-- Content is a versioned list of typed blocks. Anything outside this
-- allow-list is rejected, and the public renderer applies the same rules.
-- Each check is a separate IF so SQL NULL logic can never accept a block.
create function private.valid_article_content(c jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  b jsonb;
  item jsonb;
  row_value jsonb;
  kind text;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return false; end if;
  if (c -> 'version') is distinct from '1'::jsonb then return false; end if;
  if not private.is_array(c -> 'blocks', 0, 400) then return false; end if;
  if pg_column_size(c) > 400000 then return false; end if;
  for b in select value from jsonb_array_elements(c -> 'blocks') loop
    if jsonb_typeof(b) <> 'object' then return false; end if;
    if not private.is_optional_text(b -> 'id', 40) then return false; end if;
    kind := coalesce(b ->> 'type', '');
    if kind = 'paragraph' then
      if not private.is_text(b -> 'text', 5000) then return false; end if;
    elsif kind = 'heading' then
      if not private.is_text(b -> 'text', 200) then return false; end if;
      if coalesce(b -> 'level', 'null'::jsonb) not in ('2'::jsonb, '3'::jsonb) then return false; end if;
    elsif kind = 'list' then
      if coalesce(b ->> 'style', '') not in ('bullet', 'ordered') then return false; end if;
      if not private.is_array(b -> 'items', 1, 50) then return false; end if;
      for item in select value from jsonb_array_elements(b -> 'items') loop
        if not private.is_text(item, 1000) then return false; end if;
      end loop;
    elsif kind = 'quote' then
      if not private.is_text(b -> 'text', 2000) then return false; end if;
      if not private.is_optional_text(b -> 'cite', 200) then return false; end if;
    elsif kind = 'callout' then
      if not private.is_text(b -> 'text', 2000) then return false; end if;
      if not private.is_optional_text(b -> 'title', 120) then return false; end if;
    elsif kind = 'faq' then
      if not private.is_text(b -> 'question', 300) then return false; end if;
      if not private.is_text(b -> 'answer', 3000) then return false; end if;
    elsif kind = 'table' then
      if not private.is_array(b -> 'header', 1, 6) then return false; end if;
      if not private.is_array(b -> 'rows', 1, 30) then return false; end if;
      if not private.is_optional_text(b -> 'caption', 200) then return false; end if;
      for item in select value from jsonb_array_elements(b -> 'header') loop
        if not private.is_text(item, 200, 0) then return false; end if;
      end loop;
      for row_value in select value from jsonb_array_elements(b -> 'rows') loop
        if not private.is_array(row_value, jsonb_array_length(b -> 'header'), jsonb_array_length(b -> 'header')) then
          return false;
        end if;
        for item in select value from jsonb_array_elements(row_value) loop
          if not private.is_text(item, 500, 0) then return false; end if;
        end loop;
      end loop;
    elsif kind = 'image' then
      if not private.is_text(b -> 'mediaId', 36, 36) then return false; end if;
      if not private.is_text(b -> 'path', 60) then return false; end if;
      if not coalesce(private.is_media_path(b ->> 'path'), false) then return false; end if;
      if not private.is_text(b -> 'alt', 300, 0) then return false; end if;
      if not private.is_optional_text(b -> 'caption', 300) then return false; end if;
      if not private.is_dimension(b -> 'width') then return false; end if;
      if not private.is_dimension(b -> 'height') then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
end $$;

create function private.valid_sources(s jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  item jsonb;
begin
  if not private.is_array(s, 0, 20) then return false; end if;
  for item in select value from jsonb_array_elements(s) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if not private.is_text(item -> 'title', 200) then return false; end if;
    if not private.is_text(item -> 'url', 500) then return false; end if;
    if (item ->> 'url') !~ '^https?://[^\s<>"]+$' then return false; end if;
  end loop;
  return true;
end $$;

create function private.valid_tags(t text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select t is not null and coalesce(array_length(t, 1), 0) <= 12
    and not exists (select 1 from unnest(t) x where x is null or char_length(x) not between 1 and 40)
$$;

-- ---------------------------------------------------------------------------
-- Media (files live in the public `media` storage bucket)
-- ---------------------------------------------------------------------------

create table public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique check (private.is_media_path(path)),
  mime_type text not null check (mime_type in ('image/webp', 'image/jpeg', 'image/png', 'image/avif')),
  bytes integer not null check (bytes between 1 and 5242880),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  alt text not null default '' check (char_length(alt) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Articles (working copies) and publication snapshots
-- ---------------------------------------------------------------------------

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 200),
  slug text not null unique check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  content jsonb not null default '{"version":1,"blocks":[]}'::jsonb check (private.valid_article_content(content)),
  featured_image_id uuid references public.media (id) on delete restrict,
  author_key text not null default 'velmont' check (author_key in ('velmont', 'danielle', 'lisandra')),
  category text not null default 'MARCAS' check (category in ('MARCAS', 'PATENTES', 'SOFTWARE', 'PROPRIEDADE INTELECTUAL')),
  tags text[] not null default '{}' check (private.valid_tags(tags)),
  sources jsonb not null default '[]'::jsonb check (private.valid_sources(sources)),
  seo_title text check (char_length(seo_title) <= 120),
  seo_description text check (char_length(seo_description) <= 320),
  canonical_url text check (canonical_url ~ '^https://[^\s<>"]+$' and char_length(canonical_url) <= 500),
  og_title text check (char_length(og_title) <= 120),
  og_description text check (char_length(og_description) <= 320),
  og_image_id uuid references public.media (id) on delete restrict,
  robots_index boolean not null default true,
  reading_minutes smallint check (reading_minutes between 1 and 120),
  status public.article_status not null default 'draft',
  legacy_import boolean not null default false,
  first_published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);
create index articles_status_idx on public.articles (status, updated_at desc);

create table public.published_articles (
  article_id uuid primary key references public.articles (id) on delete cascade,
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content jsonb not null check (private.valid_article_content(content)),
  category text not null,
  tags text[] not null default '{}',
  author_key text not null,
  sources jsonb not null default '[]'::jsonb,
  featured_image jsonb,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image jsonb,
  robots_index boolean not null default true,
  reading_minutes smallint,
  published_at timestamptz,
  modified_at timestamptz,
  created_at timestamptz not null,
  source_version integer not null
);

create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  kind text not null check (kind in ('edit', 'publish')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index article_revisions_article_idx on public.article_revisions (article_id, created_at desc);

create table public.slug_redirects (
  from_slug text primary key check (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leads, rate limits and site builds
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  company text check (char_length(company) <= 150),
  interest text not null check (interest in ('Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação')),
  source text not null default 'site-contact-form' check (char_length(source) <= 60),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  landing_page text check (char_length(landing_page) <= 500),
  referrer text check (char_length(referrer) <= 500),
  utm_source text check (char_length(utm_source) <= 150),
  utm_medium text check (char_length(utm_medium) <= 150),
  utm_campaign text check (char_length(utm_campaign) <= 150),
  utm_content text check (char_length(utm_content) <= 150),
  utm_term text check (char_length(utm_term) <= 150),
  status public.lead_status not null default 'new',
  notes text not null default '' check (char_length(notes) <= 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status, created_at desc);

create table public.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

create table public.site_builds (
  id bigint generated always as identity primary key,
  requested_at timestamptz not null default now(),
  requested_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) <= 120),
  ok boolean not null,
  detail text check (char_length(detail) <= 300)
);

-- ---------------------------------------------------------------------------
-- Triggers: integrity, revisions and audit
-- ---------------------------------------------------------------------------

create function private.articles_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  trusted boolean := auth.uid() is null or current_setting('velmont.workflow', true) = 'on';
begin
  if exists (select 1 from public.published_articles p where p.slug = new.slug and p.article_id <> new.id) then
    raise exception 'slug_in_use' using errcode = '23505';
  end if;
  if tg_op = 'INSERT' then
    new.version := 1;
    if auth.uid() is not null then
      new.created_at := now();
      new.updated_at := now();
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
      new.status := 'draft';
      new.legacy_import := false;
      new.first_published_at := null;
      new.reading_minutes := null;
    end if;
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  if not trusted then
    new.status := old.status;
    new.legacy_import := old.legacy_import;
    new.first_published_at := old.first_published_at;
    new.reading_minutes := old.reading_minutes;
  end if;

  if (new.title, new.slug, new.excerpt, new.content, new.featured_image_id, new.author_key, new.category,
      new.tags, new.sources, new.seo_title, new.seo_description, new.canonical_url, new.og_title,
      new.og_description, new.og_image_id, new.robots_index, new.reading_minutes)
     is distinct from
     (old.title, old.slug, old.excerpt, old.content, old.featured_image_id, old.author_key, old.category,
      old.tags, old.sources, old.seo_title, old.seo_description, old.canonical_url, old.og_title,
      old.og_description, old.og_image_id, old.robots_index, old.reading_minutes) then
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
    insert into public.article_revisions (article_id, kind, snapshot, created_by)
    values (old.id, 'edit', to_jsonb(old), auth.uid());
  else
    new.version := old.version;
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
  end if;
  return new;
end $$;

create trigger articles_before_write
  before insert or update on public.articles
  for each row execute function private.articles_before_write();

create function private.articles_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event('article.create', 'article', new.id::text, jsonb_build_object('slug', new.slug));
  elsif tg_op = 'DELETE' then
    perform private.log_event('article.delete', 'article', old.id::text, jsonb_build_object('slug', old.slug, 'title', old.title));
    return old;
  elsif new.version <> old.version then
    perform private.log_event('article.update', 'article', new.id::text, jsonb_build_object('version', new.version));
  end if;
  return new;
end $$;

create trigger articles_audit
  after insert or update or delete on public.articles
  for each row execute function private.articles_audit();

create function private.leads_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and
     (new.id, new.created_at, new.name, new.company, new.interest, new.source, new.channel, new.landing_page,
      new.referrer, new.utm_source, new.utm_medium, new.utm_campaign, new.utm_content, new.utm_term)
     is distinct from
     (old.id, old.created_at, old.name, old.company, old.interest, old.source, old.channel, old.landing_page,
      old.referrer, old.utm_source, old.utm_medium, old.utm_campaign, old.utm_content, old.utm_term) then
    raise exception 'lead submission data is read-only' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end $$;

create trigger leads_before_update
  before update on public.leads
  for each row execute function private.leads_before_update();

-- Lead audit entries never copy personal data, only what changed.
create function private.leads_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.log_event('lead.delete', 'lead', old.id::text, '{}'::jsonb);
    return old;
  end if;
  perform private.log_event('lead.update', 'lead', new.id::text, jsonb_build_object(
    'from_status', old.status, 'to_status', new.status, 'notes_changed', new.notes is distinct from old.notes));
  return new;
end $$;

create trigger leads_audit
  after update or delete on public.leads
  for each row execute function private.leads_audit();

create function private.media_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if auth.uid() is not null then new.created_by := auth.uid(); end if;
    return new;
  end if;
  new.id := old.id;
  new.path := old.path;
  new.mime_type := old.mime_type;
  new.bytes := old.bytes;
  new.width := old.width;
  new.height := old.height;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  return new;
end $$;

create trigger media_before_write
  before insert or update on public.media
  for each row execute function private.media_before_write();

create function private.media_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event('media.upload', 'media', new.id::text, jsonb_build_object('path', new.path));
  elsif tg_op = 'DELETE' then
    perform private.log_event('media.delete', 'media', old.id::text, jsonb_build_object('path', old.path));
    return old;
  end if;
  return new;
end $$;

create trigger media_audit
  after insert or delete on public.media
  for each row execute function private.media_audit();

create function private.admin_users_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.active)
     and not exists (select 1 from public.admin_users u where u.role = 'owner' and u.active and u.user_id <> old.user_id) then
    raise exception 'at least one active owner is required' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

create trigger admin_users_guard
  before update or delete on public.admin_users
  for each row execute function private.admin_users_guard();

create function private.admin_users_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.log_event('staff.remove', 'admin_user', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
  perform private.log_event(case when tg_op = 'INSERT' then 'staff.add' else 'staff.update' end, 'admin_user', new.user_id::text,
    jsonb_build_object('role', new.role, 'active', new.active));
  return new;
end $$;

create trigger admin_users_audit
  after insert or update or delete on public.admin_users
  for each row execute function private.admin_users_audit();

-- ---------------------------------------------------------------------------
-- RPCs (all re-check authorization inside the database)
-- ---------------------------------------------------------------------------

create function public.admin_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'is_member', u.user_id is not null and u.active,
    'role', case when u.active then u.role end,
    'display_name', case when u.active then u.display_name end,
    'is_staff', private.is_staff())
  from (select 1) one
  left join public.admin_users u on u.user_id = auth.uid()
$$;

create function public.record_admin_login()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_staff();
  perform private.log_event('auth.login', 'session', null, jsonb_build_object('aal', auth.jwt() ->> 'aal'));
end $$;

create function private.media_json(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('path', m.path, 'width', m.width, 'height', m.height, 'alt', m.alt)
  from public.media m where m.id = p_id
$$;

create function public.publish_article(p_id uuid, p_expected_version integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  a public.articles;
  previous public.published_articles;
  stamp timestamptz := now();
begin
  perform private.require_staff();
  select * into a from public.articles where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;
  if a.status = 'archived' then
    raise exception 'archived' using errcode = '22023';
  end if;
  if char_length(btrim(a.title)) < 3 or char_length(btrim(a.excerpt)) < 10
     or jsonb_array_length(a.content -> 'blocks') = 0 then
    raise exception 'incomplete' using errcode = '22023';
  end if;
  select * into previous from public.published_articles where article_id = p_id;

  insert into public.published_articles as p (
    article_id, slug, title, excerpt, content, category, tags, author_key, sources, featured_image,
    seo_title, seo_description, canonical_url, og_title, og_description, og_image, robots_index,
    reading_minutes, published_at, modified_at, created_at, source_version)
  values (
    a.id, a.slug, btrim(a.title), btrim(a.excerpt), a.content, a.category, a.tags, a.author_key, a.sources,
    private.media_json(a.featured_image_id), nullif(btrim(a.seo_title), ''), nullif(btrim(a.seo_description), ''),
    a.canonical_url, nullif(btrim(a.og_title), ''), nullif(btrim(a.og_description), ''), private.media_json(a.og_image_id),
    a.robots_index, a.reading_minutes,
    coalesce(a.first_published_at, case when a.legacy_import then null else stamp end),
    case when previous.article_id is not null or a.first_published_at is not null or a.legacy_import then stamp end,
    a.created_at, a.version)
  on conflict (article_id) do update set
    slug = excluded.slug, title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
    category = excluded.category, tags = excluded.tags, author_key = excluded.author_key, sources = excluded.sources,
    featured_image = excluded.featured_image, seo_title = excluded.seo_title, seo_description = excluded.seo_description,
    canonical_url = excluded.canonical_url, og_title = excluded.og_title, og_description = excluded.og_description,
    og_image = excluded.og_image, robots_index = excluded.robots_index, reading_minutes = excluded.reading_minutes,
    published_at = excluded.published_at, modified_at = excluded.modified_at, source_version = excluded.source_version;

  -- A published URL never silently disappears: the old slug becomes a 301.
  if previous.slug is not null and previous.slug <> a.slug then
    insert into public.slug_redirects (from_slug, article_id) values (previous.slug, a.id)
    on conflict (from_slug) do update set article_id = excluded.article_id, created_at = now();
  end if;
  delete from public.slug_redirects where from_slug = a.slug;

  perform set_config('velmont.workflow', 'on', true);
  update public.articles set status = 'published',
    first_published_at = coalesce(first_published_at, case when legacy_import then null else stamp end)
  where id = p_id;
  perform set_config('velmont.workflow', '', true);

  insert into public.article_revisions (article_id, kind, snapshot, created_by)
  values (a.id, 'publish', to_jsonb(a), auth.uid());
  perform private.log_event('article.publish', 'article', a.id::text,
    jsonb_build_object('slug', a.slug, 'version', a.version, 'previous_slug', previous.slug));
  return a.slug;
end $$;

create function private.set_article_status(p_id uuid, p_status public.article_status, p_action text, p_allowed public.article_status[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_status public.article_status;
begin
  perform private.require_staff();
  select status into current_status from public.articles where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (current_status = any (p_allowed)) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  delete from public.published_articles where article_id = p_id;
  perform set_config('velmont.workflow', 'on', true);
  update public.articles set status = p_status where id = p_id;
  perform set_config('velmont.workflow', '', true);
  perform private.log_event(p_action, 'article', p_id::text, jsonb_build_object('from', current_status, 'to', p_status));
end $$;

create function public.submit_article_for_review(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select private.set_article_status(p_id, 'review', 'article.submit_review', array['draft']::public.article_status[]) $$;

create function public.return_article_to_draft(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select private.set_article_status(p_id, 'draft', 'article.return_draft', array['review', 'archived']::public.article_status[]) $$;

create function public.unpublish_article(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select private.set_article_status(p_id, 'draft', 'article.unpublish', array['published']::public.article_status[]) $$;

create function public.archive_article(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select private.set_article_status(p_id, 'archived', 'article.archive', array['draft', 'review', 'published']::public.article_status[]) $$;

create function public.add_staff_member(p_email text, p_display_name text, p_role public.staff_role)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
begin
  perform private.require_owner();
  select id into target from auth.users where lower(email) = lower(btrim(p_email));
  if target is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.admin_users (user_id, email, display_name, role)
  values (target, lower(btrim(p_email)), btrim(p_display_name), p_role);
  return target;
end $$;

create function public.update_staff_member(p_user_id uuid, p_role public.staff_role, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_owner();
  update public.admin_users set role = p_role, active = p_active where user_id = p_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

-- Public: follow a renamed article. Requires the exact slug; nothing enumerable.
create function public.resolve_slug_redirect(p_slug text)
returns text
language sql stable security definer set search_path = ''
as $$
  select p.slug from public.slug_redirects r
  join public.published_articles p on p.article_id = r.article_id
  where p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(p_slug) <= 120
    and r.from_slug = p_slug and p.slug <> p_slug
$$;

-- Service role only: fixed-window counter keyed by a hashed client id.
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  current_hits integer;
begin
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into current_hits;
  return current_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant the minimum
-- ---------------------------------------------------------------------------

revoke all on public.admin_users, public.audit_log, public.media, public.articles, public.published_articles,
  public.article_revisions, public.slug_redirects, public.leads, public.rate_limits, public.site_builds
  from public, anon, authenticated;

grant select on public.published_articles to anon, authenticated;
grant select on public.admin_users, public.article_revisions, public.slug_redirects, public.site_builds to authenticated;
grant select on public.audit_log to authenticated;
grant select, delete on public.articles to authenticated;
grant insert (title, slug, excerpt, content, featured_image_id, author_key, category, tags, sources, seo_title,
  seo_description, canonical_url, og_title, og_description, og_image_id, robots_index) on public.articles to authenticated;
grant update (title, slug, excerpt, content, featured_image_id, author_key, category, tags, sources, seo_title,
  seo_description, canonical_url, og_title, og_description, og_image_id, robots_index) on public.articles to authenticated;
grant select, delete on public.media to authenticated;
grant insert (path, mime_type, bytes, width, height, alt) on public.media to authenticated;
grant update (alt) on public.media to authenticated;
grant select, delete on public.leads to authenticated;
grant update (status, notes) on public.leads to authenticated;

grant all on public.admin_users, public.audit_log, public.media, public.articles, public.published_articles,
  public.article_revisions, public.slug_redirects, public.leads, public.rate_limits, public.site_builds to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(), private.is_owner(), private.current_staff_role(),
  private.is_text(jsonb, integer, integer), private.is_optional_text(jsonb, integer), private.is_media_path(text),
  private.is_array(jsonb, integer, integer), private.is_dimension(jsonb),
  private.valid_article_content(jsonb), private.valid_sources(jsonb), private.valid_tags(text[]) to authenticated;

revoke all on function public.admin_context(), public.record_admin_login(), public.publish_article(uuid, integer),
  public.submit_article_for_review(uuid), public.return_article_to_draft(uuid), public.unpublish_article(uuid),
  public.archive_article(uuid), public.add_staff_member(text, text, public.staff_role),
  public.update_staff_member(uuid, public.staff_role, boolean), public.resolve_slug_redirect(text),
  public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_context(), public.record_admin_login(), public.publish_article(uuid, integer),
  public.submit_article_for_review(uuid), public.return_article_to_draft(uuid), public.unpublish_article(uuid),
  public.archive_article(uuid), public.add_staff_member(text, text, public.staff_role),
  public.update_staff_member(uuid, public.staff_role, boolean) to authenticated;
grant execute on function public.resolve_slug_redirect(text) to anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer), public.resolve_slug_redirect(text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security: explicit per command
-- ---------------------------------------------------------------------------

alter table public.admin_users enable row level security;
alter table public.audit_log enable row level security;
alter table public.media enable row level security;
alter table public.articles enable row level security;
alter table public.published_articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.slug_redirects enable row level security;
alter table public.leads enable row level security;
alter table public.rate_limits enable row level security;
alter table public.site_builds enable row level security;

create policy "staff read team" on public.admin_users for select to authenticated using (private.is_staff());

create policy "owner reads audit" on public.audit_log for select to authenticated using (private.is_owner());

create policy "staff read media" on public.media for select to authenticated using (private.is_staff());
create policy "staff register media" on public.media for insert to authenticated with check (private.is_staff());
create policy "staff edit media alt" on public.media for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff delete media" on public.media for delete to authenticated using (private.is_staff());

create policy "staff read articles" on public.articles for select to authenticated using (private.is_staff());
create policy "staff create articles" on public.articles for insert to authenticated with check (private.is_staff());
create policy "staff edit articles" on public.articles for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "owner deletes articles" on public.articles for delete to authenticated using (private.is_owner());

create policy "anyone reads published" on public.published_articles for select to anon, authenticated using (true);

create policy "staff read revisions" on public.article_revisions for select to authenticated using (private.is_staff());
create policy "staff read redirects" on public.slug_redirects for select to authenticated using (private.is_staff());
create policy "staff read builds" on public.site_builds for select to authenticated using (private.is_staff());

create policy "staff read leads" on public.leads for select to authenticated using (private.is_staff());
create policy "staff update leads" on public.leads for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "owner deletes leads" on public.leads for delete to authenticated using (private.is_owner());

-- rate_limits: RLS on, no policies. Only the service role (bypassrls) reaches it.

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket, writes only through the validated API
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Restrictive: even if a permissive policy is added later, browsers cannot
-- list, write or delete objects in the media bucket. Public URLs still work.
create policy "media bucket is server-managed" on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'media') with check (bucket_id <> 'media');
