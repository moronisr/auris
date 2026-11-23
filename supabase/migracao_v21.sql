-- v21: cobrança do plano do Auris passa do Mercado Pago para o Asaas.
-- Nenhuma assinatura existia no Mercado Pago (conferido em 23/11/2026), então as colunas são só renomeadas.
alter table public.assinaturas rename column mp_assinatura_id to gateway_assinatura_id;
alter table public.assinaturas add column if not exists asaas_cliente_id text;
alter table public.auris_cobrancas rename column mp_pagamento_id to gateway_pagamento_id;
alter table public.auris_config drop column if exists mp_planos;
