alter table public.ai_usage add column if not exists study_guide int not null default 0;

comment on column public.ai_usage.study_guide is 'Monthly count of AI Study Guide generations (Pro feature; tracked for usage analytics).';
