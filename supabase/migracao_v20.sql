-- Planos de assinatura criados no Mercado Pago (checkout na página do Mercado Pago).
alter table public.auris_config add column if not exists mp_planos jsonb not null default '{}'::jsonb;
