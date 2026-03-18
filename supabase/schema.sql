-- NoteAI Supabase schema
-- Run this in your Supabase SQL editor

-- Enable pgvector for semantic search
create extension if not exists vector;

-- Categories (per user)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_categories_user_id on public.categories(user_id);

-- Notes (per user, linked to category)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  tags text[] default '{}',
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_notes_category_id on public.notes(category_id);
create index if not exists idx_notes_embedding on public.notes using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- User plans (free | pro)
create table if not exists public.user_plans (
  user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  updated_at timestamptz default now()
);

-- AI usage (monthly summarization count for free users)
create table if not exists public.ai_usage (
  user_id text not null,
  month text not null,
  summarizations int not null default 0,
  primary key (user_id, month)
);

-- Study sets (flashcards + quizzes cached per note)
create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  note_id uuid not null,
  kind text not null check (kind in ('flashcards', 'quiz')),
  payload jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, note_id, kind)
);

create index if not exists idx_study_sets_user_note on public.study_sets(user_id, note_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Semantic search function (pgvector)
create or replace function public.match_notes(
  p_user_id text,
  p_embedding vector(1536),
  p_match_count int default 10
)
returns table (
  id uuid,
  title text,
  content text,
  category_id uuid,
  similarity float
) as $$
begin
  return query
  select
    n.id,
    n.title,
    n.content,
    n.category_id,
    1 - (n.embedding <=> p_embedding) as similarity
  from public.notes n
  where n.user_id = p_user_id
    and n.embedding is not null
  order by n.embedding <=> p_embedding
  limit p_match_count;
end;
$$ language plpgsql;
