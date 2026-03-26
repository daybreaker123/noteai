-- Public share links for notes and study sets (read-only views)
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

comment on table public.shared_content is 'Share tokens for public or link-only access to notes and study sets.';
comment on column public.shared_content.is_public is 'When false, only the owner can see content at the share URL when logged in.';
