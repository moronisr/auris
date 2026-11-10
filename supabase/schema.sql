-- Rode este arquivo no Supabase: SQL Editor > New query > colar > Run.
-- Cada profissional só enxerga os próprios dados (Row Level Security).

create table if not exists public.profissionais (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  profissao text not null default 'Médico(a)',
  especialidade text not null default 'Oftalmologia',
  conselho text,                        -- ex.: CRM-PA 12345
  created_at timestamptz not null default now()
);

create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  paciente_nome text not null,
  paciente_idade int,
  paciente_cpf text,
  paciente_telefone text,

  od_esferico numeric(5,2),
  od_cilindrico numeric(5,2),
  od_eixo int check (od_eixo between 0 and 180),
  oe_esferico numeric(5,2),
  oe_cilindrico numeric(5,2),
  oe_eixo int check (oe_eixo between 0 and 180),
  adicao numeric(4,2),
  dnp text,
  observacoes text,

  retorno_meses int,
  retorno_data date,
  lembrete_enviado boolean not null default false,

  -- métricas do piloto
  transcricao text,
  tempo_processamento_ms int,
  corrigido_pelo_medico boolean not null default false
);

alter table public.profissionais enable row level security;
alter table public.registros enable row level security;

create policy "perfil: ver o próprio" on public.profissionais
  for select using (auth.uid() = id);
create policy "perfil: criar o próprio" on public.profissionais
  for insert with check (auth.uid() = id);
create policy "perfil: editar o próprio" on public.profissionais
  for update using (auth.uid() = id);

create policy "registros: ver os próprios" on public.registros
  for select using (auth.uid() = profissional_id);
create policy "registros: criar os próprios" on public.registros
  for insert with check (auth.uid() = profissional_id);
create policy "registros: editar os próprios" on public.registros
  for update using (auth.uid() = profissional_id);
create policy "registros: apagar os próprios" on public.registros
  for delete using (auth.uid() = profissional_id);

create index if not exists registros_prof_data on public.registros (profissional_id, created_at desc);
create index if not exists registros_retorno on public.registros (retorno_data) where lembrete_enviado = false;

-- Cria o perfil do profissional automaticamente no cadastro.
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profissionais (id, nome, profissao, especialidade, conselho)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'profissao', 'Médico(a)'),
    coalesce(new.raw_user_meta_data->>'especialidade', 'Oftalmologia'),
    new.raw_user_meta_data->>'conselho'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();
