-- Allow notes to have null category_id (uncategorized)
-- Run in Supabase SQL editor

-- 1. Drop the existing foreign key (default name from create table)
alter table public.notes drop constraint if exists notes_category_id_fkey;

-- 2. Allow null
alter table public.notes alter column category_id drop not null;

-- 3. Re-add foreign key with ON DELETE SET NULL (auto-uncategorize when category deleted)
alter table public.notes
  add constraint notes_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete set null;
