-- Voice to Notes / lecture transcription (Pro); monthly count for analytics
alter table public.ai_usage add column if not exists voice_transcription int not null default 0;

comment on column public.ai_usage.voice_transcription is 'Monthly count of voice transcription API calls (Pro feature; Whisper + note creation).';
