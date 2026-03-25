-- Streak + dashboard stats (service role / server writes only; no RLS — matches notes pattern)
create table if not exists public.user_stats (
  user_id text primary key,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  celebrated_milestones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_stats is 'Per-user study streak and milestone celebration state.';
comment on column public.user_stats.last_activity_date is 'UTC calendar date of last qualifying study activity.';
comment on column public.user_stats.celebrated_milestones is 'JSON array of streak values (7, 30, 100) already celebrated this streak run; cleared when streak breaks.';

-- One row per completed quiz session (for weekly stats)
create table if not exists public.quiz_completions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  study_set_id uuid references public.study_sets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_completions_user_created
  on public.quiz_completions (user_id, created_at desc);
