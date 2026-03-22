-- Studara Supabase schema
-- Run this in your Supabase SQL editor

-- Enable pgvector for semantic search
create extension if not exists vector;

-- Categories (per user)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_categories_user_id on public.categories(user_id);

-- Notes (per user, linked to category; category_id null = uncategorized)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category_id uuid references public.categories(id) on delete set null,
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
  updated_at timestamptz default now(),
  stripe_subscription_id text,
  subscription_current_period_end timestamptz,
  subscription_cancel_at_period_end boolean not null default false
);

-- AI usage (monthly counts for free users: summarizations, improvements, tutor)
create table if not exists public.ai_usage (
  user_id text not null,
  month text not null,
  summarizations int not null default 0,
  improvements int not null default 0,
  tutor_messages int not null default 0,
  tutor_images int not null default 0,
  study_multiple int not null default 0,
  pro_estimated_api_cents int not null default 0,
  primary key (user_id, month)
);

-- AI Tutor conversations + messages (per user)
create table if not exists public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'New chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tutor_conversations_user on public.tutor_conversations(user_id);

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachments jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_tutor_messages_conversation on public.tutor_messages(conversation_id, created_at);

-- Study sets (saved flashcards + quizzes; multiple rows per user)
create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  note_id uuid,
  kind text not null check (kind in ('flashcards', 'quiz')),
  title text not null default 'Study set',
  note_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_study_sets_user_note on public.study_sets(user_id, note_id);
create index if not exists idx_study_sets_user_created on public.study_sets(user_id, created_at desc);

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

drop trigger if exists tutor_conversations_updated_at on public.tutor_conversations;
create trigger tutor_conversations_updated_at
  before update on public.tutor_conversations
  for each row execute function public.set_updated_at();

create or replace function public.touch_tutor_conversation_from_message()
returns trigger as $$
begin
  update public.tutor_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tutor_messages_touch_conversation on public.tutor_messages;
create trigger tutor_messages_touch_conversation
  after insert on public.tutor_messages
  for each row execute function public.touch_tutor_conversation_from_message();

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
