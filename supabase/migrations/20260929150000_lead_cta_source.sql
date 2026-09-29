-- Which call to action on the site opened the contact form ("Origem no site").
-- Additive and nullable: leads recorded before it keep NULL, nothing is
-- rewritten. A closed list: the API (server/leads.ts, lib/cta-sources.ts)
-- accepts the same values and the database refuses any other text. Staff read
-- it with the table-level select they already have; they cannot change it
-- (their column update grant covers status and notes only).
alter table public.leads
  add column cta_source text
  constraint leads_cta_source_check check (cta_source in (
    'header', 'hero', 'mobile-menu', 'marcas', 'patentes', 'software', 'outros-servicos',
    'processo', 'insights', 'artigo', 'footer', 'contact-phone', 'contact-section'
  ));

comment on column public.leads.cta_source is
  'Call to action on the site that opened the contact form (closed list); NULL for leads recorded before it existed.';
