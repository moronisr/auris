-- v5: pagamento por cartão (crédito e débito) pelo link de pagamento do próprio profissional.
-- Só acrescenta colunas e atualiza as duas funções do paciente.
alter table public.profissionais add column if not exists cartao_link text;
alter table public.teleconsultas add column if not exists cartao_link text;
alter table public.teleconsultas add column if not exists pagamento_metodo text;

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
    'profissional', p.nome, 'especialidade', p.especialidade, 'conselho', p.conselho,
    'inicio', t.inicio, 'duracao_min', t.duracao_min, 'valor', t.valor, 'status', t.status,
    'consentimento_em', t.consentimento_em, 'pagamento_status', t.pagamento_status,
    'preconsulta_ok', t.preconsulta is not null, 'na_espera', t.paciente_na_espera_em is not null,
    'pix', case when coalesce(t.valor, 0) > 0 and p.pix_chave is not null
      then jsonb_build_object('chave', p.pix_chave, 'nome', p.pix_nome, 'cidade', p.pix_cidade) end,
    'cartao_link', case when coalesce(t.valor, 0) > 0 then link end
  );
end $$;

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
      pagamento_metodo = case when p_dados->>'metodo' in ('pix', 'cartao') then p_dados->>'metodo' else 'pix' end
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

revoke all on function public.tele_paciente(text) from public;
revoke all on function public.tele_acao(text, text, jsonb) from public;
grant execute on function public.tele_paciente(text) to anon, authenticated;
grant execute on function public.tele_acao(text, text, jsonb) to anon, authenticated;
