-- Studara Supabase schema
-- Run this in your Supabase SQL editor

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
  improved_at timestamptz,
  summarized_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_notes_category_id on public.notes(category_id);

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
  essay_feedback int not null default 0,
  study_guide int not null default 0,
  citations int not null default 0,
  pro_estimated_api_cents int not null default 0,
  voice_transcription int not null default 0,
  slides_analysis int not null default 0,
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
  kind text not null check (kind in ('flashcards', 'quiz', 'concept_map')),
  title text not null default 'Study set',
  note_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_study_sets_user_note on public.study_sets(user_id, note_id);
create index if not exists idx_study_sets_user_created on public.study_sets(user_id, created_at desc);

-- Public share links (notes + study sets)
create table if not exists public.shared_content (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  content_type text not null check (content_type in ('note', 'study_set')),
  content_id uuid not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_type, content_id)
);

create index if not exists idx_shared_content_user_id on public.shared_content (user_id);
create index if not exists idx_shared_content_content on public.shared_content (content_type, content_id);

-- SM-2 progress per card (saved flashcard sets only)
create table if not exists public.flashcard_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  card_index integer not null check (card_index >= 0),
  ease_factor double precision not null default 2.5,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  next_review_at timestamptz not null,
  last_rating text not null check (last_rating in ('hard', 'good', 'easy')),
  updated_at timestamptz not null default now(),
  unique (user_id, study_set_id, card_index)
);

create index if not exists idx_flashcard_progress_user_next
  on public.flashcard_progress (user_id, next_review_at);

create index if not exists idx_flashcard_progress_study_set
  on public.flashcard_progress (study_set_id);

-- Study streak + weekly quiz completions (server-side writes)
create table if not exists public.user_stats (
  user_id text primary key,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  celebrated_milestones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_completions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  study_set_id uuid references public.study_sets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_completions_user_created
  on public.quiz_completions (user_id, created_at desc);

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
