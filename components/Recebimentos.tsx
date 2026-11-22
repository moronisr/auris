"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Financeiro do profissional: o que os pacientes pagaram, o que foi devolvido, o que está em contestação
 * e o que ainda está para receber. Lê só as consultas do próprio profissional (protegidas no banco).
 */
type Linha = {
  id: string; paciente_nome: string; inicio: string; valor: number | null; status: string;
  pagamento_status: string; pagamento_metodo: string | null; pagamento_confirmado_em: string | null;
  devolvido_em: string | null; devolucao_valor: number | null; pagamento_alerta: string | null; pg_provedor: string | null;
};
type Mov = { id: string; data: string; paciente: string; tipo: "Recebido" | "Devolvido" | "Estornado pelo cartão"; metodo: string; valor: number };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
const METODO: Record<string, string> = { pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito" };
const metodoDe = (l: Linha) => (l.pg_provedor ? METODO[l.pagamento_metodo || ""] || "Online" : "Pix direto");
const PERIODOS = [
  { id: "mes", nome: "Este mês" },
  { id: "anterior", nome: "Mês passado" },
  { id: "tri", nome: "Últimos 3 meses" },
  { id: "ano", nome: "Este ano" },
] as const;
type Periodo = (typeof PERIODOS)[number]["id"];

function intervalo(p: Periodo): [Date, Date] {
  const h = new Date();
  if (p === "mes") return [new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 1, 1)];
  if (p === "anterior") return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 1)];
  if (p === "tri") return [new Date(h.getFullYear(), h.getMonth() - 2, 1), new Date(h.getFullYear(), h.getMonth() + 1, 1)];
  return [new Date(h.getFullYear(), 0, 1), new Date(h.getFullYear() + 1, 0, 1)];
}
const dentro = (iso: string | null, [de, ate]: [Date, Date]) => !!iso && new Date(iso) >= de && new Date(iso) < ate;

export default function Recebimentos() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const desde = new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString();
      const { data, error } = await sb.from("teleconsultas")
        .select("id, paciente_nome, inicio, valor, status, pagamento_status, pagamento_metodo, pagamento_confirmado_em, devolvido_em, devolucao_valor, pagamento_alerta, pg_provedor")
        .gt("valor", 0).gte("inicio", desde).order("inicio", { ascending: false }).limit(3000);
      if (error) setErro(true); else setLinhas((data || []) as Linha[]);
    })();
  }, []);

  const r = useMemo(() => {
    if (!linhas) return null;
    const faixa = intervalo(periodo);
    const movs: Mov[] = [];
    let recebido = 0, devolvido = 0, estornado = 0;
    const porMetodo: Record<string, number> = {};
    for (const l of linhas) {
      const v = Number(l.valor || 0);
      const pago = l.pagamento_status === "confirmado" || l.pagamento_status === "devolvido";
      if (pago && dentro(l.pagamento_confirmado_em, faixa)) {
        recebido += v; porMetodo[metodoDe(l)] = (porMetodo[metodoDe(l)] || 0) + v;
        movs.push({ id: l.id, data: l.pagamento_confirmado_em!, paciente: l.paciente_nome, tipo: "Recebido", metodo: metodoDe(l), valor: v });
      }
      if (l.pagamento_status === "devolvido" && dentro(l.devolvido_em, faixa)) {
        const d = Number(l.devolucao_valor ?? v);
        devolvido += d;
        movs.push({ id: l.id, data: l.devolvido_em!, paciente: l.paciente_nome, tipo: "Devolvido", metodo: metodoDe(l), valor: -d });
      }
      if (l.pagamento_alerta === "chargeback" && dentro(l.pagamento_confirmado_em, faixa)) {
        estornado += v;
        movs.push({ id: l.id, data: l.pagamento_confirmado_em!, paciente: l.paciente_nome, tipo: "Estornado pelo cartão", metodo: metodoDe(l), valor: -v });
      }
    }
    movs.sort((a, b) => +new Date(b.data) - +new Date(a.data));
    const agora = Date.now();
    const aReceber = linhas.filter((l) => (l.pagamento_status === "pendente" || l.pagamento_status === "informado") && l.status !== "cancelada" && new Date(l.inicio).getTime() > agora - 864e5)
      .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
    const contestadas = linhas.filter((l) => l.pagamento_alerta === "contestacao" || l.pagamento_alerta === "chargeback");
    const aDevolver = linhas.filter((l) => l.pagamento_alerta === "duplicado" || l.pagamento_alerta === "pago_cancelada" || l.pagamento_alerta === "devolucao_pendente");
    // Últimos 6 meses (líquido por mês), para enxergar a tendência.
    const meses = Array.from({ length: 6 }, (_, i) => {
      const h = new Date(); const de = new Date(h.getFullYear(), h.getMonth() - 5 + i, 1); const ate = new Date(h.getFullYear(), h.getMonth() - 4 + i, 1);
      let v = 0;
      for (const l of linhas) {
        if ((l.pagamento_status === "confirmado" || l.pagamento_status === "devolvido") && dentro(l.pagamento_confirmado_em, [de, ate])) v += Number(l.valor || 0);
        if (l.pagamento_status === "devolvido" && dentro(l.devolvido_em, [de, ate])) v -= Number(l.devolucao_valor ?? l.valor ?? 0);
        if (l.pagamento_alerta === "chargeback" && dentro(l.pagamento_confirmado_em, [de, ate])) v -= Number(l.valor || 0);
      }
      return { nome: de.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), valor: Math.max(0, v) };
    });
    return {
      recebido, devolvido, estornado, liquido: recebido - devolvido - estornado, porMetodo, movs, meses,
      aReceber, aReceberTotal: aReceber.reduce((s, l) => s + Number(l.valor || 0), 0),
      informados: aReceber.filter((l) => l.pagamento_status === "informado"), contestadas, aDevolver,
    };
  }, [linhas, periodo]);

  function exportar() {
    if (!r) return;
    const cab = "Data;Paciente;Tipo;Forma;Valor\n";
    const corpo = r.movs.map((m) => [dia(m.data), `"${m.paciente.replace(/"/g, "'")}"`, m.tipo, m.metodo, m.valor.toFixed(2).replace(".", ",")].join(";")).join("\n");
    const blob = new Blob(["﻿" + cab + corpo], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auris-recebimentos-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (erro) return <p className="erro">Não foi possível carregar os recebimentos. Recarregue a página.</p>;
  if (!r) return <p className="muted">Carregando os recebimentos.</p>;
  const maxMes = Math.max(1, ...r.meses.map((m) => m.valor));

  return (
    <div>
      <div className="abas-doc" role="tablist" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={periodo === p.id} className={periodo === p.id ? "aba-doc ativa" : "aba-doc"} onClick={() => setPeriodo(p.id)}>{p.nome}</button>
        ))}
      </div>

      {r.contestadas.length > 0 && (
        <div className="erro" role="alert" style={{ marginBottom: 12 }}>
          <b>{r.contestadas.length === 1 ? "1 pagamento contestado" : `${r.contestadas.length} pagamentos contestados`}.</b>{" "}
          O paciente pediu ao banco ou ao Mercado Pago o dinheiro de volta. Responda pelo app do Mercado Pago (Atividade, abrir a venda) com o comprovante do atendimento, que o Auris mostra na consulta.
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {r.contestadas.map((l) => <li key={l.id}><a href={`/teleconsultas/${l.id}`}>{l.paciente_nome}, {dia(l.inicio)}, {reais(Number(l.valor || 0))}</a>{l.pagamento_alerta === "chargeback" ? " (valor estornado)" : " (em análise)"}</li>)}
          </ul>
        </div>
      )}
      {r.aDevolver.length > 0 && (
        <div className="aviso" style={{ marginBottom: 12 }}>
          <b>Dinheiro a devolver:</b>{" "}
          {r.aDevolver.map((l, i) => <span key={l.id}>{i ? ", " : ""}<a href={`/teleconsultas/${l.id}`}>{l.paciente_nome} ({reais(Number(l.valor || 0))})</a></span>)}. Abra a consulta para devolver em um clique.
        </div>
      )}

      <div className="fin-resumo">
        <div className="fin-card"><span className="fin-rotulo">Recebido</span><span className="fin-num">{reais(r.recebido)}</span></div>
        <div className="fin-card"><span className="fin-rotulo">Devolvido</span><span className="fin-num">{reais(r.devolvido + r.estornado)}</span></div>
        <div className="fin-card fin-card-destaque"><span className="fin-rotulo">Líquido</span><span className="fin-num">{reais(r.liquido)}</span></div>
        <div className="fin-card"><span className="fin-rotulo">A receber</span><span className="fin-num">{reais(r.aReceberTotal)}</span></div>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Recebido e devolvido pela data do pagamento. A receber: consultas marcadas que ainda aguardam pagamento.
        {r.estornado > 0 ? ` Devolvido inclui ${reais(r.estornado)} estornado por contestação no cartão.` : ""}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Últimos 6 meses</h2>
        <div className="fin-barras" role="img" aria-label={`Valor líquido por mês: ${r.meses.map((m) => `${m.nome} ${reais(m.valor)}`).join(", ")}`}>
          {r.meses.map((m) => (
            <div key={m.nome} className="fin-barra-col">
              <span className="fin-barra-valor">{m.valor ? reais(m.valor).replace(",00", "") : ""}</span>
              <div className="fin-barra" style={{ height: `${Math.round((m.valor / maxMes) * 72)}%` }} />
              <span className="fin-barra-mes">{m.nome}</span>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(r.porMetodo).length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Por forma de pagamento</h2>
          <dl className="comprovante">
            {Object.entries(r.porMetodo).sort((a, b) => b[1] - a[1]).map(([m, v]) => <Fragment key={m}><dt>{m}</dt><dd>{reais(v)}</dd></Fragment>)}
          </dl>
        </div>
      )}

      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Movimentações</h2>{r.movs.length > 0 && <button type="button" className="link" onClick={exportar}>Baixar planilha</button>}</div>
        {r.movs.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>Nenhum pagamento neste período.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tabela-simples">
              <thead><tr><th>Data</th><th>Paciente</th><th>Tipo</th><th>Forma</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {r.movs.map((m, i) => (
                  <tr key={`${m.id}-${i}`}>
                    <td>{dia(m.data)}</td>
                    <td><a href={`/teleconsultas/${m.id}`}>{m.paciente}</a></td>
                    <td>{m.tipo}</td>
                    <td>{m.metodo}</td>
                    <td style={{ textAlign: "right", color: m.valor < 0 ? "var(--erro-tinta)" : undefined }}>{m.valor < 0 ? "- " : ""}{reais(Math.abs(m.valor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>A receber</h2>
        {r.aReceber.length === 0 ? <p className="muted" style={{ marginBottom: 0 }}>Nenhuma consulta aguardando pagamento.</p> : (
          <>
            {r.informados.length > 0 && <div className="aviso" style={{ marginTop: 0 }}>{r.informados.length === 1 ? "1 paciente informou" : `${r.informados.length} pacientes informaram`} que já pagou por Pix direto. Confira no seu banco e confirme na agenda.</div>}
            <table className="tabela-simples">
              <thead><tr><th>Consulta</th><th>Paciente</th><th>Situação</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {r.aReceber.map((l) => (
                  <tr key={l.id}>
                    <td>{dia(l.inicio)}</td>
                    <td><a href={`/teleconsultas/${l.id}`}>{l.paciente_nome}</a></td>
                    <td>{l.pagamento_status === "informado" ? "Paciente informou o pagamento" : "Aguardando pagamento"}</td>
                    <td style={{ textAlign: "right" }}>{reais(Number(l.valor || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <p className="muted">
        Pagamentos online caem direto na sua conta do Mercado Pago. O prazo para o dinheiro ficar disponível para saque depende do plano de recebimento escolhido no app do Mercado Pago.
      </p>
    </div>
  );
}
