-- AI Tutor: monthly usage + conversations + messages
alter table public.ai_usage add column if not exists tutor_messages int not null default 0;

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
  created_at timestamptz default now()
);

create index if not exists idx_tutor_messages_conversation on public.tutor_messages(conversation_id, created_at);

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

drop trigger if exists tutor_conversations_updated_at on public.tutor_conversations;
create trigger tutor_conversations_updated_at
  before update on public.tutor_conversations
  for each row execute function public.set_updated_at();
