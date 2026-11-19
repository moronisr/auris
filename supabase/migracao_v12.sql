-- v12: ficha assinada digitalmente (gov.br ou ICP-Brasil), guardada só para o próprio profissional.
alter table public.registros add column if not exists assinada_em timestamptz;
alter table public.registros add column if not exists assinatura_tipo text;
alter table public.registros add column if not exists assinatura_arquivo text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fichas', 'fichas', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "fichas: enviar na própria pasta" on storage.objects;
drop policy if exists "fichas: ler a própria pasta" on storage.objects;
drop policy if exists "fichas: substituir na própria pasta" on storage.objects;
create policy "fichas: enviar na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fichas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fichas: ler a própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'fichas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fichas: substituir na própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'fichas' and (storage.foldername(name))[1] = auth.uid()::text);
