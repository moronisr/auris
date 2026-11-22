-- v18: acesso de cortesia (liberado pelo dono do Auris, por prazo definido) e acesso do painel do dono.
alter table public.assinaturas add column if not exists cortesia_ate timestamptz;
alter table public.assinaturas add column if not exists cortesia_motivo text;

-- Situação de acesso: cortesia vigente vale como assinatura ativa.
create or replace function public.auris_acesso(uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare cfg public.auris_config; a public.assinaturas; criado timestamptz; fim_teste timestamptz;
begin
  select * into cfg from public.auris_config where id = 1;
  if cfg is null or not cfg.cobranca_ativa then return 'liberado'; end if;
  select * into a from public.assinaturas where profissional_id = uid;
  if a.cortesia_ate is not null and a.cortesia_ate > now() then return 'ativa'; end if;
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
