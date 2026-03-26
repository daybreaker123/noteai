-- AI Lecture Slides Analyzer (Pro); monthly count for analytics
alter table public.ai_usage add column if not exists slides_analysis int not null default 0;

comment on column public.ai_usage.slides_analysis is 'Monthly count of Analyze Slides API runs (Pro feature).';
