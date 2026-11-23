-- v22: Pix Automático (Asaas) como segunda forma de pagamento do plano.
alter table public.assinaturas add column if not exists forma_pagamento text not null default 'cartao';
alter table public.assinaturas add column if not exists pix_autorizacao_id text;
alter table public.assinaturas add column if not exists pix_plano text;
