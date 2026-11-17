-- v6: armazenamento privado e temporário do áudio da teleconsulta.
-- Cada profissional só enxerga a própria pasta. O áudio é apagado logo após a transcrição.
insert into storage.buckets (id, name, public, file_size_limit)
values ('audios', 'audios', false, 104857600)
on conflict (id) do nothing;

drop policy if exists "audios: enviar na própria pasta" on storage.objects;
drop policy if exists "audios: ler a própria pasta" on storage.objects;
drop policy if exists "audios: apagar da própria pasta" on storage.objects;
create policy "audios: enviar na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audios: ler a própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audios: apagar da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'audios' and (storage.foldername(name))[1] = auth.uid()::text);

select id, public, file_size_limit from storage.buckets where id = 'audios';
