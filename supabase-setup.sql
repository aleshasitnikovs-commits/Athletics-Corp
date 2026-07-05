-- Athletics Corp — LITE-анализ: таблица заявок + политики доступа.
-- Выполнить целиком в Supabase Dashboard → SQL Editor → New query → Run.

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  photo_urls text[] not null default '{}',
  status text not null default 'new'
);

alter table public.submissions enable row level security;

-- Аноним (посетитель сайта) может только создать заявку.
create policy "anon can insert submissions"
  on public.submissions
  for insert
  to anon
  with check (true);

-- Явно НЕТ политик на select/update/delete для anon —
-- значит читать/менять/удалять чужие заявки с фронтенда нельзя.
-- Смотреть заявки сможете только вы сами, залогинившись в Supabase Dashboard.

-- Storage: политики для bucket "photos" (сам bucket создаётся в интерфейсе, см. инструкцию ниже).
create policy "anon can upload to photos bucket"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'photos');

-- Явно НЕТ select-политики для anon на storage.objects —
-- значит просматривать/скачивать чужие фото с фронтенда нельзя,
-- даже зная прямую ссылку на файл.
