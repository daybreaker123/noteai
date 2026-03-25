-- Public bucket for inline note images (uploads go through API with service role).
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do update set public = excluded.public;

-- Allow anyone to read images (URLs are unguessable; uploads are server-only).
drop policy if exists "Public read note images" on storage.objects;
create policy "Public read note images"
  on storage.objects for select
  using (bucket_id = 'note-images');
