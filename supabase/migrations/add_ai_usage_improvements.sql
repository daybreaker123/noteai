-- Add improvements column to ai_usage for tracking Improve feature usage
-- Run in Supabase SQL editor

alter table public.ai_usage add column if not exists improvements int not null default 0;
