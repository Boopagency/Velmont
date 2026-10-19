-- Lisandra Ferreira dos Santos is no longer part of Velmont. Articles credited
-- to her move to the institutional author, and her author key is retired.
-- Her panel access is removed separately, in Equipe (update_staff_member).

update public.articles set author_key = 'velmont' where author_key = 'lisandra';
update public.published_articles set author_key = 'velmont' where author_key = 'lisandra';

alter table public.articles drop constraint articles_author_key_check;
alter table public.articles add constraint articles_author_key_check check (author_key in ('velmont', 'danielle'));
