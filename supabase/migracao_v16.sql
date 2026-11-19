-- v16: assinatura do Auris pelo profissional (cartão recorrente pelo Mercado Pago), teste grátis e bloqueio por falta de pagamento.
create table if not exists public.auris_config (
  id int primary key default 1 check (id = 1),
  cobranca_ativa boolean not null default false,
  cobranca_desde timestamptz
);
insert into public.auris_config (id) values (1) on conflict (id) do nothing;
alter table public.auris_config enable row level security;

-- Só o servidor grava. O profissional apenas lê a própria linha.
create table if not exists public.assinaturas (
  profissional_id uuid primary key references auth.users(id) on delete cascade,
  plano text,
  status text not null default 'teste' check (status in ('teste','ativa','falha','cancelada')),
  teste_ate timestamptz,
  mp_assinatura_id text unique,
  cartao_final text,
  cartao_bandeira text,
  valor numeric(10,2),
  pago_ate timestamptz,
  ultimo_pagamento_em timestamptz,
  falha_desde timestamptz,
  falha_motivo text,
  proxima_cobranca timestamptz,
  cancelada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
drop policy if exists assinatura_ler_propria on public.assinaturas;
create policy assinatura_ler_propria on public.assinaturas for select to authenticated using (profissional_id = auth.uid());

-- Situação de acesso: liberado (cobrança desligada), teste, ativa, aviso (pagamento falhou, até 7 dias) ou bloqueado.
create or replace function public.auris_acesso(uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare cfg public.auris_config; a public.assinaturas; criado timestamptz; fim_teste timestamptz;
begin
  select * into cfg from public.auris_config where id = 1;
  if cfg is null or not cfg.cobranca_ativa then return 'liberado'; end if;
  select * into a from public.assinaturas where profissional_id = uid;
  if a.status = 'ativa' then
    if a.pago_ate is null or a.pago_ate > now() then return 'ativa'; end if;
    if a.pago_ate > now() - interval '7 days' then return 'aviso'; end if;
    return 'bloqueado';
  end if;
  if a.status = 'falha' then
    if a.falha_desde > now() - interval '7 days' then return 'aviso'; end if;
    return 'bloqueado';
  end if;
  if a.status = 'cancelada' and a.pago_ate > now() then return 'ativa'; end if;
  select created_at into criado from auth.users where id = uid;
  fim_teste := coalesce(a.teste_ate, greatest(coalesce(criado, now()), coalesce(cfg.cobranca_desde, now())) + interval '10 days');
  if a.status is distinct from 'cancelada' and fim_teste > now() then return 'teste'; end if;
  return 'bloqueado';
end $$;

-- Fim do teste grátis de um profissional (para mostrar na tela).
create or replace function public.auris_fim_teste(uid uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(a.teste_ate, greatest(coalesce(u.created_at, now()), coalesce(c.cobranca_desde, now())) + interval '10 days')
  from auth.users u cross join public.auris_config c left join public.assinaturas a on a.profissional_id = u.id
  where u.id = uid and c.id = 1;
$$;

-- Sem assinatura em dia: nada de fichas novas nem teleconsultas novas. Leitura e exportação continuam.
drop policy if exists assinatura_registros_novos on public.registros;
create policy assinatura_registros_novos on public.registros as restrictive for insert to authenticated
  with check (public.auris_acesso(auth.uid()) <> 'bloqueado');
drop policy if exists assinatura_teleconsultas_novas on public.teleconsultas;
create policy assinatura_teleconsultas_novas on public.teleconsultas as restrictive for insert to authenticated
  with check (public.auris_acesso(auth.uid()) <> 'bloqueado');
