-- v15: devolução de pagamento, política de cancelamento e cancelamento pelo próprio paciente.
alter table public.teleconsultas drop constraint if exists teleconsultas_pagamento_status_check;
alter table public.teleconsultas add constraint teleconsultas_pagamento_status_check
  check (pagamento_status in ('pendente','informado','confirmado','isento','devolvido'));
alter table public.teleconsultas add column if not exists devolvido_em timestamptz;
alter table public.teleconsultas add column if not exists devolucao_valor numeric(10,2);
alter table public.teleconsultas add column if not exists devolucao_id text;
alter table public.teleconsultas add column if not exists cancelado_por text;
alter table public.profissionais add column if not exists cancelamento_horas int not null default 24;
alter table public.profissionais add column if not exists cancelamento_obs text;
create or replace function public.tele_paciente(p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.teleconsultas; p public.profissionais; link text;
begin
  select * into t from public.teleconsultas where codigo = p_codigo;
  if not found then return null; end if;
  select * into p from public.profissionais where id = t.profissional_id;
  link := coalesce(nullif(t.cartao_link, ''), nullif(p.cartao_link, ''));
  return jsonb_build_object(
    'paciente', split_part(t.paciente_nome, ' ', 1),
    'profissional', p.nome, 'especialidade', p.especialidade, 'conselho', p.conselho, 'profissao', p.profissao,
    'inicio', t.inicio, 'duracao_min', t.duracao_min, 'valor', t.valor, 'status', t.status,
    'consentimento_em', t.consentimento_em, 'pagamento_status', t.pagamento_status,
    'preconsulta_ok', t.preconsulta is not null, 'na_espera', t.paciente_na_espera_em is not null,
    'pagamento_online', coalesce(t.valor, 0) > 0 and p.mp_conectado,
    'reserva_expira_em', case when t.pagamento_status in ('confirmado', 'isento') then null else t.reserva_expira_em end,
    'pix', case when coalesce(t.valor, 0) > 0 and p.pix_chave is not null and not p.mp_conectado
      then jsonb_build_object('chave', p.pix_chave, 'nome', p.pix_nome, 'cidade', p.pix_cidade) end,
    'cartao_link', case when coalesce(t.valor, 0) > 0 and not p.mp_conectado then link end,
    'pagamento_metodo', case when t.pagamento_status = 'confirmado' then t.pagamento_metodo end,
    'pagamento_confirmado_em', case when t.pagamento_status = 'confirmado' then t.pagamento_confirmado_em end,
    'transacao', case when t.pagamento_status in ('confirmado', 'devolvido') then t.mp_pagamento_id end,
    'devolvido_em', t.devolvido_em, 'devolucao_valor', t.devolucao_valor,
    'cancelamento_horas', coalesce(p.cancelamento_horas, 24), 'cancelamento_obs', p.cancelamento_obs,
    'cancelado_por', t.cancelado_por
  );
end $$;
alter table public.teleconsultas add column if not exists cancelamento_motivo text;
