-- v10: mais de uma instituição de pagamento (Mercado Pago ou PagBank).
alter table public.profissionais add column if not exists pg_provedor text;
alter table public.profissionais_segredos add column if not exists pagbank_token text;
alter table public.profissionais_segredos add column if not exists pagbank_sandbox boolean not null default false;
alter table public.teleconsultas add column if not exists pg_provedor text;
update public.profissionais set pg_provedor = 'mercadopago' where mp_conectado and pg_provedor is null;
