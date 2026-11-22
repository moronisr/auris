-- v19: liberar o plano interno de R$ 5 para uma conta específica (teste de cobrança com médico real).
alter table public.profissionais add column if not exists plano_teste boolean not null default false;
