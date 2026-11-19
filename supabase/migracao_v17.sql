-- v17: pagamento do mês sem salvar o cartão, remover cartão e histórico de cobranças do Auris.
alter table public.assinaturas add column if not exists renovacao_automatica boolean not null default true;
alter table public.assinaturas add column if not exists ultimo_pagamento_id text;

create table if not exists public.auris_cobrancas (
  id bigserial primary key,
  profissional_id uuid not null references auth.users(id) on delete cascade,
  mp_pagamento_id text unique,
  origem text not null check (origem in ('assinatura','avulso')),
  plano text,
  valor numeric(10,2),
  status text not null,
  data timestamptz not null default now()
);
create index if not exists auris_cobrancas_prof on public.auris_cobrancas (profissional_id, data desc);
alter table public.auris_cobrancas enable row level security;
drop policy if exists cobranca_ler_propria on public.auris_cobrancas;
create policy cobranca_ler_propria on public.auris_cobrancas for select to authenticated using (profissional_id = auth.uid());
alter table public.assinaturas add column if not exists cancelamento_motivo text;
