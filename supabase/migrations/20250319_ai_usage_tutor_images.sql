-- Free-tier AI Tutor image uploads per calendar month (Pro: unlimited, not incremented)
alter table public.ai_usage add column if not exists tutor_images int not null default 0;

comment on column public.ai_usage.tutor_images is 'Monthly count of tutor chat messages that included an image (free tier cap: 5).';
