-- Soft monthly API spend estimate for Pro users (cents). Used for $10 soft-limit messaging + Haiku fallback.
alter table public.ai_usage add column if not exists pro_estimated_api_cents int not null default 0;

comment on column public.ai_usage.pro_estimated_api_cents is 'Pro: estimated Anthropic spend this month in cents (soft cap ~$10).';
