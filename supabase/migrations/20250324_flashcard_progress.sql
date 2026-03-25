-- Per-card SM-2 progress for saved flashcard study sets (all users).

create table if not exists public.flashcard_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  card_index integer not null check (card_index >= 0),
  ease_factor double precision not null default 2.5,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  next_review_at timestamptz not null,
  last_rating text not null check (last_rating in ('hard', 'good', 'easy')),
  updated_at timestamptz not null default now(),
  unique (user_id, study_set_id, card_index)
);

create index if not exists idx_flashcard_progress_user_next
  on public.flashcard_progress (user_id, next_review_at);

create index if not exists idx_flashcard_progress_study_set
  on public.flashcard_progress (study_set_id);

comment on table public.flashcard_progress is 'SM-2 scheduling state per card in a saved flashcard set.';
comment on column public.flashcard_progress.card_index is '0-based index into study_sets.payload.cards.';
