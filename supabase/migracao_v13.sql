-- v13: cartão sem conta no Mercado Pago (chave pública da conta conectada) e alertas financeiros.
alter table public.profissionais_segredos add column if not exists mp_public_key text;
alter table public.teleconsultas add column if not exists pagamento_alerta text;
