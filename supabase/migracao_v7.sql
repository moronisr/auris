-- v7: forma de pagamento separada em Pix, crédito e débito
create or replace function public.tele_acao(p_codigo text, p_acao text, p_dados jsonb default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare t public.teleconsultas;
begin
  select * into t from public.teleconsultas where codigo = p_codigo for update;
  if not found or t.status in ('cancelada', 'encerrada') then return false; end if;
  if p_acao = 'consentir' then
    update public.teleconsultas set
      consentimento_em = coalesce(consentimento_em, now()),
      consentimento_texto = coalesce(consentimento_texto, left(p_dados->>'texto', 8000)),
      confirmada_em = coalesce(confirmada_em, now()),
      status = case when status = 'agendada' then 'confirmada' else status end
    where id = t.id;
  elsif p_acao = 'pagamento_informado' then
    if t.consentimento_em is null then return false; end if;
    update public.teleconsultas set pagamento_status = 'informado', pagamento_informado_em = now(),
      pagamento_metodo = case when p_dados->>'metodo' in ('pix', 'credito', 'debito', 'cartao') then p_dados->>'metodo' else 'pix' end
    where id = t.id and pagamento_status = 'pendente';
  elsif p_acao = 'preconsulta' then
    if t.consentimento_em is null then return false; end if;
    update public.teleconsultas set preconsulta = jsonb_build_object(
      'motivo', left(p_dados->>'motivo', 2000), 'medicamentos', left(p_dados->>'medicamentos', 1000),
      'alergias', left(p_dados->>'alergias', 500), 'em', now())
    where id = t.id;
  elsif p_acao = 'espera' then
    if t.consentimento_em is null then return false; end if;
    if coalesce(t.valor, 0) > 0 and t.pagamento_status = 'pendente' then return false; end if;
    update public.teleconsultas set paciente_na_espera_em = now() where id = t.id;
  else
    return false;
  end if;
  return true;
end $$;
revoke all on function public.tele_acao(text, text, jsonb) from public;
grant execute on function public.tele_acao(text, text, jsonb) to anon, authenticated;
