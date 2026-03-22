-- Free tier: 1 Study Multiple (multi-note flashcards/quiz) generation per calendar month
alter table public.ai_usage add column if not exists study_multiple int not null default 0;

comment on column public.ai_usage.study_multiple is 'Monthly count of Study Multiple API calls (free tier: max 1; Pro unlimited).';
