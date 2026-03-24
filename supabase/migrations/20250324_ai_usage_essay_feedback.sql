-- Monthly count of Essay Feedback API calls (free tier: max 3/month; Pro unlimited).
alter table public.ai_usage add column if not exists essay_feedback int not null default 0;

comment on column public.ai_usage.essay_feedback is 'Monthly Essay Feedback generations; free users capped at 3/month.';
