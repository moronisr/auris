-- v9: conexão do Mercado Pago pelo botão "Conectar com Mercado Pago" (OAuth).
alter table public.profissionais_segredos add column if not exists mp_refresh_token text;
alter table public.profissionais_segredos add column if not exists mp_expira_em timestamptz;
alter table public.profissionais_segredos add column if not exists mp_user_id text;
