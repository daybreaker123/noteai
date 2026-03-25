-- Per-note learning milestones for Study Progress UI (Improve / Summarize).
alter table public.notes add column if not exists improved_at timestamptz null;
alter table public.notes add column if not exists summarized_at timestamptz null;

comment on column public.notes.improved_at is 'Set when the user runs AI Improve on this note.';
comment on column public.notes.summarized_at is 'Set when the user runs Summarize on this note.';
