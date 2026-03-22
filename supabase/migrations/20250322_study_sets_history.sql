-- Multiple saved study sets per user (history). Link to one or many notes via note_ids.
alter table public.study_sets drop constraint if exists study_sets_user_id_note_id_kind_key;

alter table public.study_sets add column if not exists title text not null default 'Study set';
alter table public.study_sets add column if not exists note_ids jsonb not null default '[]'::jsonb;

-- Backfill note_ids from legacy note_id (uuid stored as json string array)
update public.study_sets
set note_ids = jsonb_build_array(note_id::text)
where note_ids = '[]'::jsonb or note_ids is null;

alter table public.study_sets alter column note_id drop not null;

create index if not exists idx_study_sets_user_created on public.study_sets (user_id, created_at desc);

comment on column public.study_sets.title is 'Display title for the study set list.';
comment on column public.study_sets.note_ids is 'JSON array of note id strings this set was generated from.';
