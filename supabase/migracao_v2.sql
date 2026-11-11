-- v2: sistema multiprofissional. Rode no SQL Editor do Supabase.
alter table public.registros add column if not exists modelo text not null default 'oftalmologia';
alter table public.registros add column if not exists dados jsonb not null default '{}'::jsonb;
alter table public.registros add column if not exists paciente_email text;

-- Preferências de escrita de cada profissional (personalização).
alter table public.profissionais add column if not exists preferencias text;

-- Novos cadastros: valores padrão neutros.
alter table public.profissionais alter column especialidade set default 'Clínica geral';
