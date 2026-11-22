"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

/** Painel do dono do Auris: números do negócio, profissionais, cortesias e a chave da cobrança. Sem dado clínico. */
type Prof = {
  id: string; nome: string; email: string; profissao: string; especialidade: string; cadastro: string; ultimoAcesso: string | null;
  emailConfirmado: boolean; plano: string | null; valor: number | null; status: string | null; recorrente: boolean; pagoAte: string | null;
  planoTeste?: boolean; cortesiaAte: string | null; cortesiaMotivo: string | null; acesso: string; fichas30: number; teleconsultas30: number; alertasPagamento: number; admin: boolean;
};
type Dados = {
  cobrancaAtiva: boolean; cobrancaDesde: string | null;
  resumo: Record<string, number>;
  meses: { nome: string; valor: number }[];
  profissionais: Prof[];
  motivosCancelamento: { motivo: string; n: number }[];
  planos: { id: string; nome: string; valor: number }[];
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" }) : "-");
const SITUACAO: Record<string, [string, string]> = {
  liberado: ["Liberado", "selo-ok"], teste: ["Em teste", "selo"], ativa: ["Ativa", "selo-ok"], aviso: ["Pagamento pendente", "selo-alerta"], bloqueado: ["Bloqueado", "selo-alerta"],
};
const PRAZOS = [7, 30, 60, 90, 180, 365];

export default function PainelAuris() {
  const [d, setD] = useState<Dados | null | undefined>(undefined);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [dias, setDias] = useState(30);
  const [motivo, setMotivo] = useState("Piloto");
  const [confirmarCobranca, setConfirmarCobranca] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = async () => {
    const r = await fetch("/api/admin", { cache: "no-store" });
    setD(r.ok ? await r.json() : null);
  };
  useEffect(() => { carregar(); }, []);

  async function agir(corpo: Record<string, unknown>) {
    setEnviando(true); setMsg(null);
    const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    setEnviando(false);
    setMsg(r.ok ? { tipo: "ok", texto: j.mensagem || "Pronto." } : { tipo: "erro", texto: j.erro || "Não foi possível concluir." });
    if (r.ok) { setAberto(null); setConfirmarCobranca(false); await carregar(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.profissionais.filter((p) => {
      if (q && !`${p.nome} ${p.email} ${p.especialidade}`.toLowerCase().includes(q)) return false;
      if (filtro === "pagantes") return p.recorrente && (p.acesso === "ativa" || p.acesso === "aviso") && !p.cortesiaAte;
      if (filtro === "pendentes") return p.acesso === "aviso" || p.acesso === "bloqueado";
      if (filtro === "cortesia") return !!p.cortesiaAte;
      if (filtro === "sem-uso") return !p.admin && p.fichas30 === 0 && p.teleconsultas30 === 0;
      return true;
    });
  }, [d, busca, filtro]);

  if (d === undefined) return <p className="muted">Carregando o painel.</p>;
  if (d === null) return <p className="erro">Não foi possível carregar o painel. Recarregue a página.</p>;
  const r = d.resumo;
  const maxMes = Math.max(1, ...d.meses.map((m) => m.valor));

  return (
    <div>
      <div className="row"><h1>Painel do Auris</h1><span className="selo selo-ok">Somente você</span></div>
      <p className="muted" style={{ marginTop: -10 }}>Números do negócio. Nenhum dado clínico ou de paciente aparece aqui. Sua conta de dono não entra nas contas.</p>
      {msg && <div className={msg.tipo} role="status" style={{ marginBottom: 12 }}>{msg.texto}</div>}

      <div className="fin-resumo">
        <div className="fin-card fin-card-destaque"><span className="fin-rotulo">Faturamento mensal (MRR)</span><span className="fin-num">{reais(r.mrr)}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Recebido este mês</span><span className="fin-num">{reais(r.recebidoMes)}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Assinantes pagantes</span><span className="fin-num">{r.pagantes}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Profissionais cadastrados</span><span className="fin-num">{r.profissionais}</span></div>
      </div>
      <div className="fin-resumo" style={{ marginTop: 10 }}>
        <div className="fin-card"><span className="fin-rotulo">Em teste grátis</span><span className="fin-num">{r.teste}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Com cortesia</span><span className="fin-num">{r.cortesia}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Pagamento pendente</span><span className="fin-num">{r.aviso}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Bloqueados ou cancelados</span><span className="fin-num">{r.bloqueados + r.cancelados}</span></div>
      </div>

      {(r.falhasCobranca > 0 || r.contestacoes > 0 || r.alertasPagamento > 0 || r.semUso30 > 0) && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Precisa de atenção</h2>
          <ul className="politica-lista" style={{ margin: 0 }}>
            {r.falhasCobranca > 0 && <li><b>{r.falhasCobranca}</b> cobrança(s) do Auris recusada(s) este mês. O profissional já vê o aviso para trocar o cartão.</li>}
            {r.contestacoes > 0 && <li><b>{r.contestacoes}</b> contestação(ões) de cartão em cobranças do Auris. Responda pelo app do Mercado Pago.</li>}
            {r.alertasPagamento > 0 && <li><b>{r.alertasPagamento}</b> consulta(s) de profissionais com pagamento a resolver (devolução ou contestação). Eles veem o alerta na agenda deles.</li>}
            {r.semUso30 > 0 && <li><b>{r.semUso30}</b> profissional(is) sem nenhum uso nos últimos 30 dias: risco de cancelar. <button type="button" className="link" onClick={() => setFiltro("sem-uso")}>Ver quem</button></li>}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Recebido do Auris nos últimos 6 meses</h2>
        <div className="fin-barras" role="img" aria-label={d.meses.map((m) => `${m.nome} ${reais(m.valor)}`).join(", ")}>
          {d.meses.map((m) => (
            <div key={m.nome} className="fin-barra-col">
              <span className="fin-barra-valor">{m.valor ? reais(m.valor).replace(",00", "") : ""}</span>
              <div className="fin-barra" style={{ height: `${Math.round((m.valor / maxMes) * 72)}%` }} />
              <span className="fin-barra-mes">{m.nome}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Uso nos últimos 30 dias</h2>
        <dl className="comprovante">
          <dt>Fichas registradas</dt><dd>{r.fichas30}</dd>
          <dt>Teleconsultas</dt><dd>{r.teleconsultas30}</dd>
          <dt>Novos cadastros</dt><dd>{r.novos30}</dd>
        </dl>
      </div>

      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Profissionais</h2><span className="muted">{lista.length} de {d.profissionais.length}</span></div>
        <input placeholder="Buscar por nome, e-mail ou especialidade" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginTop: 10 }} />
        <div className="abas-doc" role="tablist" aria-label="Filtro" style={{ marginTop: 10 }}>
          {[["todos", "Todos"], ["pagantes", "Pagantes"], ["pendentes", "Pendentes"], ["cortesia", "Cortesia"], ["sem-uso", "Sem uso"]].map(([id, nome]) => (
            <button key={id} type="button" role="tab" aria-selected={filtro === id} className={filtro === id ? "aba-doc ativa" : "aba-doc"} onClick={() => setFiltro(id)}>{nome}</button>
          ))}
        </div>
        {lista.length === 0 && <p className="muted">Ninguém neste filtro.</p>}
        <div className="lista-admin">
          {lista.map((p) => {
            const [rot, cls] = p.cortesiaAte ? ["Cortesia", "selo-ok"] : SITUACAO[p.acesso] || [p.acesso, "selo"];
            const plano = d.planos.find((x) => x.id === p.plano);
            return (
              <div key={p.id} className="item-admin">
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{p.nome}</b>{p.admin && <span className="muted"> (você)</span>}
                    <div className="muted">{p.email}{!p.emailConfirmado && " (e-mail não confirmado)"}</div>
                    <div className="muted">{p.profissao}{p.especialidade ? `, ${p.especialidade}` : ""}</div>
                  </div>
                  <span className={`selo ${cls}`}>{rot}</span>
                </div>
                <div className="dados-admin">
                  <span>Plano: <b>{plano ? `${plano.nome} (${reais(plano.valor)})` : p.plano || "nenhum"}</b>{p.plano && !p.recorrente ? " sem cartão salvo" : ""}</span>
                  <span>Cadastro: {dia(p.cadastro)}</span>
                  <span>Último acesso: {dia(p.ultimoAcesso)}</span>
                  <span>Uso em 30 dias: {p.fichas30} ficha(s), {p.teleconsultas30} teleconsulta(s)</span>
                  {p.pagoAte && <span>Pago até: {dia(p.pagoAte)}</span>}
                  {p.planoTeste && <span>Plano de teste de R$ 5: <b>liberado</b></span>}
                  {p.cortesiaAte && <span>Cortesia até: <b>{dia(p.cortesiaAte)}</b>{p.cortesiaMotivo ? ` (${p.cortesiaMotivo})` : ""}</span>}
                  {p.alertasPagamento > 0 && <span className="erro-texto">{p.alertasPagamento} pagamento(s) de paciente a resolver</span>}
                </div>
                {!p.admin && (
                  <div className="acoes-pequenas">
                    {aberto !== p.id && <button type="button" className="link" onClick={() => { setAberto(p.id); setMsg(null); }}>{p.cortesiaAte ? "Estender cortesia" : "Liberar acesso de cortesia"}</button>}
                    {p.cortesiaAte && aberto !== p.id && <button type="button" className="link link-discreto" disabled={enviando} onClick={() => agir({ acao: "remover_cortesia", uid: p.id })}>Encerrar cortesia</button>}
                    {aberto !== p.id && <button type="button" className="link link-discreto" disabled={enviando} onClick={() => agir({ acao: "plano_teste", uid: p.id, ativa: !p.planoTeste })}>{p.planoTeste ? "Retirar plano de teste (R$ 5)" : "Liberar plano de teste (R$ 5)"}</button>}
                  </div>
                )}
                {aberto === p.id && (
                  <div className="aviso" style={{ marginTop: 10, marginBottom: 0 }}>
                    <b>Cortesia para {p.nome}</b>
                    <div className="muted" style={{ marginTop: 2 }}>Durante a cortesia, o profissional usa o Auris completo sem pagar. Quando ela termina, volta a valer a situação normal (plano, teste ou bloqueio).</div>
                    <label htmlFor={`dias-${p.id}`} style={{ marginTop: 8 }}>Prazo</label>
                    <select id={`dias-${p.id}`} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                      {PRAZOS.map((n) => <option key={n} value={n}>{n === 365 ? "1 ano" : `${n} dias`}</option>)}
                    </select>
                    <label htmlFor={`motivo-${p.id}`} style={{ marginTop: 8 }}>Motivo (só você vê)</label>
                    <input id={`motivo-${p.id}`} value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
                    <div className="acoes-ficha" style={{ marginTop: 10 }}>
                      <button type="button" disabled={enviando} onClick={() => agir({ acao: "cortesia", uid: p.id, dias, motivo })}>{enviando ? "Liberando" : `Liberar por ${dias === 365 ? "1 ano" : `${dias} dias`}`}</button>
                      <button type="button" className="link" disabled={enviando} onClick={() => setAberto(null)}>Voltar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {d.motivosCancelamento.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Por que cancelaram</h2>
          <dl className="comprovante">{d.motivosCancelamento.map((m) => <Fragment key={m.motivo}><dt>{m.motivo}</dt><dd>{m.n}</dd></Fragment>)}</dl>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cobrança dos planos</h2>
        <p style={{ marginTop: 0 }}>
          {d.cobrancaAtiva
            ? <>Ligada{d.cobrancaDesde ? ` desde ${dia(d.cobrancaDesde)}` : ""}. Quem não tem plano nem cortesia passa pelos 10 dias de teste e depois precisa assinar.</>
            : <>Desligada: todos usam o Auris liberado, sem cobrança. Ligue no dia do lançamento.</>}
        </p>
        {!confirmarCobranca ? (
          <button type="button" className={d.cobrancaAtiva ? "btn-sec" : ""} onClick={() => setConfirmarCobranca(true)}>{d.cobrancaAtiva ? "Desligar a cobrança" : "Ligar a cobrança"}</button>
        ) : (
          <div className="aviso" style={{ marginBottom: 0 }}>
            <b>{d.cobrancaAtiva ? "Desligar a cobrança de todos?" : "Ligar a cobrança para todos os profissionais?"}</b>
            <div style={{ marginTop: 4 }}>{d.cobrancaAtiva
              ? "Todos voltam a usar o Auris liberado. As assinaturas no cartão continuam sendo cobradas pelo Mercado Pago; cancele-as se for o caso."
              : "A partir de agora, quem não tem plano nem cortesia entra em 10 dias de teste e depois precisa assinar para registrar e atender. Fichas antigas continuam acessíveis."}</div>
            <div className="acoes-ficha" style={{ marginTop: 10 }}>
              <button type="button" disabled={enviando} onClick={() => agir({ acao: "cobranca", ativa: !d.cobrancaAtiva })}>{enviando ? "Salvando" : d.cobrancaAtiva ? "Sim, desligar" : "Sim, ligar a cobrança"}</button>
              <button type="button" className="link" disabled={enviando} onClick={() => setConfirmarCobranca(false)}>Voltar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
