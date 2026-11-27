"use client";

import { useState } from "react";
import type { Teleconsulta } from "@/lib/teleconsulta";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cancelar consulta. Se estiver paga, o dinheiro fica guardado e o paciente escolhe: remarcar sem pagar de novo ou receber de volta.
 * Também resolve os alertas de pagamento em duplicidade e de devolução pedida pelo paciente.
 */
export default function CancelarDevolver({ t, onFeito }: { t: Teleconsulta; onFeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [remarcando, setRemarcando] = useState(false);
  const [quando, setQuando] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const online = (t.pg_provedor === "mercadopago" || t.pg_provedor === "pagbank") && !!t.mp_pagamento_id;
  const pago = t.pagamento_status === "confirmado";
  const valor = Number(t.valor || 0);

  async function agir(acao: string, extra?: Record<string, string>) {
    setEnviando(true); setMsg(null);
    const r = await fetch("/api/pagamento/devolver", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teleId: t.id, acao, ...extra }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: d.erro || "Não foi possível concluir. Tente de novo." });
    setMsg({ tipo: "ok", texto: d.mensagem || "Pronto." });
    setAberto(false); setRemarcando(false);
    setTimeout(onFeito, 1800);
  }
  const aviso = msg && <div className={msg.tipo} style={{ marginTop: 8, width: "100%" }}>{msg.texto}</div>;

  if (t.pagamento_alerta === "contestacao" || t.pagamento_alerta === "chargeback") return null;
  if (t.pagamento_alerta === "duplicado" && online) return (
    <div style={{ marginTop: 10 }}>
      <button type="button" disabled={enviando} onClick={() => agir("devolver_extra")}>{enviando ? "Devolvendo" : "Devolver o pagamento em duplicidade"}</button>
      {aviso}
    </div>
  );
  // O paciente pediu a devolução (ou a devolução automática falhou).
  if (t.pagamento_alerta === "devolucao_pendente" && pago) return (
    <div className="aviso" style={{ marginTop: 10, width: "100%" }}>
      <b>O paciente pediu a devolução de {reais(valor)}</b>
      {online ? (
        <div className="acoes-ficha" style={{ marginTop: 10 }}>
          <button type="button" disabled={enviando} onClick={() => agir("devolver")}>{enviando ? "Devolvendo" : `Devolver ${reais(valor)}`}</button>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 4 }}>Ele pagou direto na sua chave Pix. Devolva pelo seu banco e depois toque em &quot;Já devolvi&quot;.</div>
          <div className="acoes-ficha" style={{ marginTop: 10 }}>
            <button type="button" disabled={enviando} onClick={() => agir("ja_devolvi")}>{enviando ? "Salvando" : "Já devolvi"}</button>
          </div>
        </>
      )}
      {aviso}
    </div>
  );
  if (t.pagamento_alerta === "pago_cancelada" && online) return (
    <div style={{ marginTop: 10 }}>
      <button type="button" disabled={enviando} onClick={() => agir(t.status === "cancelada" ? "devolver" : "cancelar_devolver")}>{enviando ? "Devolvendo" : `Devolver ${reais(valor)} ao paciente`}</button>
      {aviso}
    </div>
  );

  // Cancelada pelo consultório e ainda paga: aguardando o paciente. O médico pode remarcar sem nova cobrança.
  if (t.status === "cancelada" && t.cancelado_por === "profissional" && pago) return (
    <div style={{ marginTop: 10, width: "100%" }}>
      {!remarcando ? (
        <div className="acoes-ficha">
          <button type="button" onClick={() => { setRemarcando(true); setMsg(null); }}>Remarcar</button>
        </div>
      ) : (
        <div className="aviso">
          <label htmlFor={`rm-${t.id}`} style={{ marginTop: 0 }}>Nova data e hora (sem nova cobrança)</label>
          <input id={`rm-${t.id}`} type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          <div className="acoes-ficha" style={{ marginTop: 10 }}>
            <button type="button" disabled={!quando || enviando} onClick={() => agir("remarcar", { inicio: new Date(quando).toISOString() })}>{enviando ? "Remarcando" : "Confirmar"}</button>
            <button type="button" className="link" disabled={enviando} onClick={() => setRemarcando(false)}>Voltar</button>
          </div>
        </div>
      )}
      {aviso}
    </div>
  );
  if (t.status === "cancelada" || t.status === "encerrada") return aviso || null;

  return (
    <>
      {!aberto && <button type="button" className="link" onClick={() => { setAberto(true); setMsg(null); }}>Cancelar</button>}
      {aberto && (
        <div className="aviso" style={{ marginTop: 10, width: "100%" }}>
          <b>Cancelar a consulta de {t.paciente_nome}?</b>
          <div style={{ marginTop: 4 }}>{pago
            ? `O pagamento de ${reais(valor)} fica guardado. O paciente escolhe: remarcar sem pagar de novo ou receber o valor de volta.`
            : "Não há pagamento confirmado. O horário volta a ficar livre."}</div>
          <div className="acoes-ficha" style={{ marginTop: 10 }}>
            <button type="button" disabled={enviando} onClick={() => agir("cancelar")}>{enviando ? "Cancelando" : "Cancelar consulta"}</button>
            <button type="button" className="link" disabled={enviando} onClick={() => setAberto(false)}>Voltar</button>
          </div>
        </div>
      )}
      {aviso}
    </>
  );
}
