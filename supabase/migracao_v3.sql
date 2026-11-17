-- v3: teleconsulta, Pix do profissional e página do paciente.
-- Só acrescenta tabelas, colunas e funções. Não altera nem apaga dados existentes.
create extension if not exists pgcrypto with schema extensions;

-- Dados de recebimento do profissional: o pagamento vai direto para a conta dele.
alter table public.profissionais add column if not exists pix_tipo text;
alter table public.profissionais add column if not exists pix_chave text;
alter table public.profissionais add column if not exists pix_nome text;
alter table public.profissionais add column if not exists pix_cidade text;

create table if not exists public.teleconsultas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  paciente_nome text not null,
  paciente_telefone text,
  inicio timestamptz not null,
  duracao_min int not null default 30,
  valor numeric(10,2),
  codigo text not null unique,
  status text not null default 'agendada' check (status in ('agendada','confirmada','em_andamento','encerrada','cancelada')),
  confirmada_em timestamptz,
  consentimento_em timestamptz,
  consentimento_texto text,
  pagamento_status text not null default 'pendente' check (pagamento_status in ('pendente','informado','confirmado','isento')),
  pagamento_informado_em timestamptz,
  pagamento_confirmado_em timestamptz,
  preconsulta jsonb,
  paciente_na_espera_em timestamptz,
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  registro_id uuid references public.registros(id) on delete set null
);
alter table public.teleconsultas enable row level security;
drop policy if exists "tele: ver as próprias" on public.teleconsultas;
drop policy if exists "tele: criar as próprias" on public.teleconsultas;
drop policy if exists "tele: editar as próprias" on public.teleconsultas;
drop policy if exists "tele: apagar as próprias" on public.teleconsultas;
create policy "tele: ver as próprias" on public.teleconsultas for select using (auth.uid() = profissional_id);
create policy "tele: criar as próprias" on public.teleconsultas for insert with check (auth.uid() = profissional_id);
create policy "tele: editar as próprias" on public.teleconsultas for update using (auth.uid() = profissional_id);
create policy "tele: apagar as próprias" on public.teleconsultas for delete using (auth.uid() = profissional_id);
create index if not exists tele_prof_inicio on public.teleconsultas (profissional_id, inicio);

-- Página do paciente depois da consulta. O código do link fica guardado só como hash.
create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  registro_id uuid references public.registros(id) on delete cascade,
  created_at timestamptz not null default now(),
  codigo_hash text not null unique,
  nascimento date,
  conteudo jsonb not null,
  expira_em timestamptz not null default now() + interval '30 days',
  acessado_em timestamptz,
  tentativas int not null default 0,
  revogado boolean not null default false
);
alter table public.entregas enable row level security;
drop policy if exists "entregas: ver as próprias" on public.entregas;
drop policy if exists "entregas: criar as próprias" on public.entregas;
drop policy if exists "entregas: editar as próprias" on public.entregas;
create policy "entregas: ver as próprias" on public.entregas for select using (auth.uid() = profissional_id);
create policy "entregas: criar as próprias" on public.entregas for insert with check (auth.uid() = profissional_id);
create policy "entregas: editar as próprias" on public.entregas for update using (auth.uid() = profissional_id);

-- Funções que o paciente usa sem login. Cada uma só responde com o código certo.
create or replace function public.tele_paciente(p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.teleconsultas; p public.profissionais;
begin
  select * into t from public.teleconsultas where codigo = p_codigo;
  if not found then return null; end if;
  select * into p from public.profissionais where id = t.profissional_id;
  return jsonb_build_object(
    'paciente', split_part(t.paciente_nome, ' ', 1),
    'profissional', p.nome, 'especialidade', p.especialidade, 'conselho', p.conselho,
    'inicio', t.inicio, 'duracao_min', t.duracao_min, 'valor', t.valor, 'status', t.status,
    'consentimento_em', t.consentimento_em, 'pagamento_status', t.pagamento_status,
    'preconsulta_ok', t.preconsulta is not null, 'na_espera', t.paciente_na_espera_em is not null,
    'pix', case when coalesce(t.valor, 0) > 0 and p.pix_chave is not null
      then jsonb_build_object('chave', p.pix_chave, 'nome', p.pix_nome, 'cidade', p.pix_cidade) end
  );
end $$;

create or replace function public.tele_acao(p_codigo text, p_acao text, p_dados jsonb default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare t public.teleconsultas;
begin
  select * into t from public.teleconsultas where codigo = p_codigo for update;
  if not found or t.status in ('cancelada', 'encerrada') then return false; end if;
  if p_acao = 'consentir' then
    update public.teleconsultas set
      consentimento_em = coalesce(consentimento_em, now()),
      consentimento_texto = coalesce(consentimento_texto, left(p_dados->>'texto', 8000)),
      confirmada_em = coalesce(confirmada_em, now()),
      status = case when status = 'agendada' then 'confirmada' else status end
    where id = t.id;
  elsif p_acao = 'pagamento_informado' then
    if t.consentimento_em is null then return false; end if;
    update public.teleconsultas set pagamento_status = 'informado', pagamento_informado_em = now()
    where id = t.id and pagamento_status = 'pendente';
  elsif p_acao = 'preconsulta' then
    if t.consentimento_em is null then return false; end if;
    update public.teleconsultas set preconsulta = jsonb_build_object(
      'motivo', left(p_dados->>'motivo', 2000), 'medicamentos', left(p_dados->>'medicamentos', 1000),
      'alergias', left(p_dados->>'alergias', 500), 'em', now())
    where id = t.id;
  elsif p_acao = 'espera' then
    if t.consentimento_em is null then return false; end if;
    if coalesce(t.valor, 0) > 0 and t.pagamento_status = 'pendente' then return false; end if;
    update public.teleconsultas set paciente_na_espera_em = now() where id = t.id;
  else
    return false;
  end if;
  return true;
end $$;

create or replace function public.entrega_paciente(p_codigo text, p_nascimento text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare e public.entregas;
begin
  select * into e from public.entregas where codigo_hash = encode(extensions.digest(p_codigo, 'sha256'), 'hex');
  if not found or e.revogado then return jsonb_build_object('erro', 'nao_encontrado'); end if;
  if e.expira_em < now() then return jsonb_build_object('erro', 'expirado'); end if;
  if e.tentativas >= 10 then return jsonb_build_object('erro', 'bloqueado'); end if;
  if e.nascimento is not null then
    if p_nascimento is null then return jsonb_build_object('erro', 'pede_nascimento'); end if;
    if p_nascimento <> to_char(e.nascimento, 'DD/MM/YYYY') then
      update public.entregas set tentativas = tentativas + 1 where id = e.id;
      return jsonb_build_object('erro', 'nascimento');
    end if;
  end if;
  update public.entregas set acessado_em = coalesce(acessado_em, now()) where id = e.id;
  return jsonb_build_object('conteudo', e.conteudo, 'expira_em', e.expira_em);
end $$;

revoke all on function public.tele_paciente(text) from public;
revoke all on function public.tele_acao(text, text, jsonb) from public;
revoke all on function public.entrega_paciente(text, text) from public;
grant execute on function public.tele_paciente(text) to anon, authenticated;
grant execute on function public.tele_acao(text, text, jsonb) to anon, authenticated;
grant execute on function public.entrega_paciente(text, text) to anon, authenticated;
