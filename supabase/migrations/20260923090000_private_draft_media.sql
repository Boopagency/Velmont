-- Draft media is private. Uploads go to the private `media-private` bucket,
-- readable only by staff (signed URLs with expiry). When an article is
-- published, the server copies exactly the images it references to the
-- public `media` bucket; images no longer referenced by any published
-- article are removed from it. Nothing relies on unguessable file names.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-private', 'media-private', false, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------

drop policy if exists "media bucket is server-managed" on storage.objects;

-- Public bucket: browsers can only fetch objects by public URL. No listing,
-- no writes; only the service role (publish flow) manages it.
create policy "public media is server-managed" on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'media') with check (bucket_id <> 'media');

-- Private bucket: never written by browsers (uploads go through the API).
create policy "private media: no client inserts" on storage.objects as restrictive
  for insert to anon, authenticated with check (bucket_id <> 'media-private');
create policy "private media: no client updates" on storage.objects as restrictive
  for update to anon, authenticated using (bucket_id <> 'media-private') with check (bucket_id <> 'media-private');
create policy "private media: no client deletes" on storage.objects as restrictive
  for delete to anon, authenticated using (bucket_id <> 'media-private');

-- Private bucket reads: nobody but active, MFA-verified staff. Restrictive,
-- so a permissive policy added later can never widen it.
create policy "private media: anon never reads" on storage.objects as restrictive
  for select to anon using (bucket_id <> 'media-private');
create policy "private media: staff-only reads" on storage.objects as restrictive
  for select to authenticated using (bucket_id <> 'media-private' or (select private.is_staff()));
-- The permissive grant that lets staff create signed URLs.
create policy "private media: staff read" on storage.objects
  for select to authenticated using (bucket_id = 'media-private' and (select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Which media is currently copied to the public bucket
-- ---------------------------------------------------------------------------

alter table public.media add column public_since timestamptz;

create or replace function private.media_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.public_since := null;
    end if;
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
  -- Only the service role (publish flow) changes public visibility.
  if auth.uid() is not null then
    new.public_since := old.public_since;
  end if;
  return new;
end $$;

/** Media ids an article's working copy references (cover, social image, image blocks). */
create function private.article_media_ids(a public.articles)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct id), '{}') from (
    select a.featured_image_id as id
    union all select a.og_image_id
    union all
    select case when b ->> 'mediaId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (b ->> 'mediaId')::uuid end
    from jsonb_array_elements(a.content -> 'blocks') b
    where b ->> 'type' = 'image'
  ) refs where id is not null
$$;

/** Paths referenced by the public snapshots. */
create function private.published_media_paths()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select featured_image ->> 'path' from public.published_articles where featured_image is not null
  union
  select og_image ->> 'path' from public.published_articles where og_image is not null
  union
  select b ->> 'path' from public.published_articles p, jsonb_array_elements(p.content -> 'blocks') b
  where b ->> 'type' = 'image'
$$;

/** Service role: the API copied these objects to the public bucket. */
create function public.media_mark_public(p_ids uuid[])
returns void
language sql security definer set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('velmont.public_media'));
  update public.media set public_since = now() where id = any (p_ids);
$$;

/**
 * Service role: returns the paths to delete from the public bucket (media no
 * longer referenced by any published article) and marks them private again.
 * The grace period protects an image copied moments ago for a publish that
 * is still in flight; the advisory lock serializes with publish_article.
 */
create function public.media_unpublish_unreferenced(p_grace_seconds integer)
returns setof text
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('velmont.public_media'));
  return query
    update public.media m set public_since = null
    where m.public_since is not null
      and m.public_since < now() - make_interval(secs => greatest(p_grace_seconds, 0))
      and m.path not in (select p from private.published_media_paths() p where p is not null)
    returning m.path;
end $$;

-- ---------------------------------------------------------------------------
-- publish_article: refuses images that are not (yet) public
-- ---------------------------------------------------------------------------

create or replace function public.publish_article(p_id uuid, p_expected_version integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  a public.articles;
  previous public.published_articles;
  stamp timestamptz := now();
  ids uuid[];
  public_count integer;
begin
  perform private.require_staff();
  perform pg_advisory_xact_lock(hashtext('velmont.public_media'));
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

  -- Every referenced image must be a known media row already copied to the
  -- public bucket by the publish API, and image blocks must point at it.
  ids := private.article_media_ids(a);
  select count(*) into public_count from public.media m where m.id = any (ids) and m.public_since is not null;
  if public_count <> cardinality(ids) then
    raise exception 'media_not_public' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(a.content -> 'blocks') b
    left join public.media m on m.id::text = b ->> 'mediaId'
    where b ->> 'type' = 'image' and m.path is distinct from b ->> 'path'
  ) then
    raise exception 'media_mismatch' using errcode = '22023';
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
    jsonb_build_object('slug', a.slug, 'version', a.version, 'previous_slug', previous.slug, 'media', cardinality(ids)));
  return a.slug;
end $$;

revoke all on function private.article_media_ids(public.articles), private.published_media_paths() from public, anon, authenticated;
revoke all on function public.media_mark_public(uuid[]), public.media_unpublish_unreferenced(integer) from public, anon, authenticated;
grant execute on function public.media_mark_public(uuid[]), public.media_unpublish_unreferenced(integer) to service_role;
grant execute on function private.article_media_ids(public.articles) to service_role;
grant usage on schema private to service_role;
