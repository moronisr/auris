"use client";

import { useState } from "react";
import type { Teleconsulta } from "@/lib/teleconsulta";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Cancelar consulta e devolver o dinheiro ao paciente em um clique, com confirmação na própria tela.
 * Também resolve os alertas de pagamento em duplicidade e de consulta cancelada que foi paga.
 */
export default function CancelarDevolver({ t, onFeito }: { t: Teleconsulta; onFeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const online = t.pg_provedor === "mercadopago" && !!t.mp_pagamento_id;
  const pago = t.pagamento_status === "confirmado";
  const valor = Number(t.valor || 0);

  async function agir(acao: string) {
    setEnviando(true); setMsg(null);
    const r = await fetch("/api/pagamento/devolver", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teleId: t.id, acao }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: d.erro || "Não foi possível concluir. Tente de novo." });
    setMsg({ tipo: "ok", texto: d.mensagem || "Pronto." });
    setAberto(false);
    setTimeout(onFeito, 1800);
  }

  // Alertas de dinheiro a devolver
  if (t.pagamento_alerta === "duplicado" && online) return (
    <div style={{ marginTop: 10 }}>
      <button type="button" disabled={enviando} onClick={() => agir("devolver_extra")}>{enviando ? "Devolvendo" : "Devolver o pagamento em duplicidade"}</button>
      {msg && <div className={msg.tipo} style={{ marginTop: 8 }}>{msg.texto}</div>}
    </div>
  );
  if ((t.pagamento_alerta === "pago_cancelada" || t.pagamento_alerta === "devolucao_pendente") && online) return (
    <div style={{ marginTop: 10 }}>
      <button type="button" disabled={enviando} onClick={() => agir(t.status === "cancelada" ? "devolver" : "cancelar_devolver")}>{enviando ? "Devolvendo" : `Cancelar e devolver ${reais(valor)} ao paciente`}</button>
      {msg && <div className={msg.tipo} style={{ marginTop: 8 }}>{msg.texto}</div>}
    </div>
  );
  if (t.status === "cancelada" || t.status === "encerrada") return msg ? <div className={msg.tipo} style={{ marginTop: 8 }}>{msg.texto}</div> : null;

  return (
    <>
      {!aberto && <button type="button" className="link" onClick={() => { setAberto(true); setMsg(null); }}>Cancelar</button>}
      {aberto && (
        <div className="aviso" style={{ marginTop: 10, width: "100%" }}>
          {pago && online ? (
            <>
              <b>Cancelar a consulta de {t.paciente_nome}?</b>
              <div style={{ marginTop: 4 }}>O paciente pagou {reais(valor)} pelo Auris. Ao devolver, o Pix volta para a conta dele em poucos minutos; no cartão, o estorno aparece na fatura.</div>
              <div className="acoes-ficha" style={{ marginTop: 10 }}>
                <button type="button" disabled={enviando} onClick={() => agir("cancelar_devolver")}>{enviando ? "Devolvendo" : `Cancelar e devolver ${reais(valor)}`}</button>
                <button type="button" className="btn-sec" disabled={enviando} onClick={() => agir("cancelar")}>Cancelar sem devolver</button>
                <button type="button" className="link" disabled={enviando} onClick={() => setAberto(false)}>Voltar</button>
              </div>
            </>
          ) : pago ? (
            <>
              <b>Cancelar a consulta de {t.paciente_nome}?</b>
              <div style={{ marginTop: 4 }}>Este pagamento foi feito fora do Auris (Pix na sua chave ou link da maquininha). Se for devolver, faça pelo seu banco ou pela maquininha.</div>
              <div className="acoes-ficha" style={{ marginTop: 10 }}>
                <button type="button" disabled={enviando} onClick={() => agir("cancelar")}>Cancelar consulta</button>
                <button type="button" className="link" disabled={enviando} onClick={() => setAberto(false)}>Voltar</button>
              </div>
            </>
          ) : (
            <>
              <b>Cancelar a consulta de {t.paciente_nome}?</b>
              <div style={{ marginTop: 4 }}>Não há pagamento confirmado. O horário volta a ficar livre.</div>
              <div className="acoes-ficha" style={{ marginTop: 10 }}>
                <button type="button" disabled={enviando} onClick={() => agir("cancelar")}>Cancelar consulta</button>
                <button type="button" className="link" disabled={enviando} onClick={() => setAberto(false)}>Voltar</button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <div className={msg.tipo} style={{ marginTop: 8, width: "100%" }}>{msg.texto}</div>}
    </>
  );
}
