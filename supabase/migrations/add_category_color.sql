-- Add color column to categories (for existing tables)
-- Run in Supabase SQL editor if categories table already exists without color

alter table public.categories add column if not exists color text;
