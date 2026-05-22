alter table public.orders
  add column if not exists final_image_path text,
  add column if not exists final_image_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'photobooth-prints',
  'photobooth-prints',
  true,
  10485760,
  array['image/png', 'image/jpeg']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
