alter table public.ai_usage add column if not exists citations int not null default 0;

comment on column public.ai_usage.citations is 'Monthly count of AI citation generations; free users capped at 5/month.';
