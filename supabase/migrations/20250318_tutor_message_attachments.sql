-- Optional image attachments for AI Tutor user messages (base64 in JSONB for history + vision context)
alter table public.tutor_messages add column if not exists attachments jsonb;
