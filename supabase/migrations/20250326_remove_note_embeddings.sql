-- Remove semantic search (pgvector) artifacts from existing databases.
drop function if exists public.match_notes(text, vector, integer);
drop index if exists public.idx_notes_embedding;
alter table public.notes drop column if exists embedding;
