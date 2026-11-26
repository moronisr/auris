"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { reais } from "@/lib/pix";
import RemarcarConsulta from "@/components/RemarcarConsulta";
import { podeCancelarComDevolucao, politicaCancelamento, prazoTexto } from "@/lib/cancelamento";

type Info = {
  profissional: string; inicio: string; valor: number | null; status: string; pagamento_status: string;
  pagamento_online?: boolean; cancelamento_horas?: number; cancelamento_obs?: string | null; pagina?: string | null;
  devolvido_em?: string | null; devolucao_valor?: number | null; transacao?: string | null; cancelado_por?: string | null;
};

const MOTIVOS = ["Não vou conseguir comparecer", "Marquei o dia ou horário errado", "Vou remarcar para outra data", "Outro motivo"];

/** Ajuda da consulta: política de cancelamento e pedido de cancelamento, fora do caminho principal do paciente. */
export default function AjudaConsulta({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [etapa, setEtapa] = useState<"ver" | "motivo" | "enviando">("ver");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc("tele_paciente", { p_codigo: codigo });
    setInfo((data as Info) ?? null);
  }, [codigo]);
  useEffect(() => { carregar(); }, [carregar]);

  async function cancelar() {
    setEtapa("enviando"); setErro("");
    const r = await fetch("/api/pagamento/cancelar-paciente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, motivo }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setEtapa("motivo"); setErro(d.erro || "Não foi possível cancelar agora."); return; }
    setEtapa("ver"); await carregar();
  }

  const topo = (
    <div className="paciente-topo">
      <span className="paciente-marca">Auris</span>
      <span className="muted">Ajuda da consulta</span>
    </div>
  );
  if (info === undefined) return <div className="paciente">{topo}<p className="muted">Carregando.</p></div>;
  if (info === null) return <div className="paciente">{topo}<h1>Consulta não encontrada</h1></div>;

  const horas = info.cancelamento_horas ?? 24;
  const pagoOnline = info.pagamento_status === "confirmado" && !!info.pagamento_online;
  const dentro = podeCancelarComDevolucao(info.inicio, horas);
  const data = new Date(info.inicio).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="paciente">
      {topo}
      <h1>Ajuda da consulta</h1>
      <p className="muted">Consulta com {info.profissional}, {data}.</p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Política de cancelamento e devolução</h2>
        <ul className="politica-lista">{politicaCancelamento(horas, info.cancelamento_obs, info.pagina ? `na página de ${info.profissional}` : null).map((l, i) => <li key={i}>{l}</li>)}</ul>
        {info.pagina && <a className="btn" href={`/${info.pagina}`} style={{ display: "flex", marginTop: 12 }}>Escolher novo horário</a>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cancelar a consulta</h2>
        {info.status === "cancelada" ? (
          <>
            <p style={{ marginTop: 0 }}>{info.cancelado_por === "paciente" ? "Você cancelou esta consulta." : "Esta consulta foi cancelada pelo consultório."}</p>
            {info.pagamento_status === "devolvido" && (
              <div className="ok" role="status"><b>Valor devolvido</b><div style={{ marginTop: 4 }}>{reais(Number(info.devolucao_valor ?? info.valor ?? 0))}{info.devolvido_em ? `, em ${new Date(info.devolvido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : ""}. No Pix, volta para a conta que pagou em geral em poucos minutos; no cartão, aparece na fatura em até duas faturas.</div></div>
            )}
          </>
        ) : info.status === "encerrada" || info.status === "em_andamento" ? (
          <p className="muted" style={{ marginBottom: 0 }}>Esta consulta já começou e não pode mais ser cancelada por aqui.</p>
        ) : info.pagamento_status === "informado" || (info.pagamento_status === "confirmado" && !pagoOnline) ? (
          <p className="muted" style={{ marginBottom: 0 }}>Para cancelar esta consulta, fale com o consultório.</p>
        ) : pagoOnline && !dentro ? (
          <p className="muted" style={{ marginBottom: 0 }}>O cancelamento com devolução era possível {prazoTexto(horas)}. Para remarcar ou combinar outra solução, fale com o consultório.</p>
        ) : etapa === "ver" ? (
          <>
            <p className="muted">{pagoOnline ? `Se cancelar agora, você recebe ${reais(Number(info.valor))} de volta, na mesma forma de pagamento.` : "Se cancelar, o horário fica livre para outra pessoa."}</p>
            <button type="button" className="btn-sec" onClick={() => setEtapa("motivo")}>Solicitar cancelamento</button>
          </>
        ) : (
          <>
            <label htmlFor="motivo">Qual o motivo do cancelamento?</label>
            <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Escolha uma opção</option>
              {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {erro && <div className="erro" style={{ marginTop: 10 }}>{erro}</div>}
            <div className="acoes-ficha" style={{ marginTop: 12 }}>
              <button type="button" disabled={!motivo || etapa === "enviando"} onClick={cancelar}>{etapa === "enviando" ? "Cancelando" : pagoOnline ? "Confirmar cancelamento e devolução" : "Confirmar cancelamento"}</button>
              <button type="button" className="link" disabled={etapa === "enviando"} onClick={() => { setEtapa("ver"); setErro(""); }}>Voltar</button>
            </div>
          </>
        )}
      </div>
      {info.status === "cancelada" && <RemarcarConsulta profissional={info.profissional} pagina={info.pagina} obs={info.cancelamento_obs} />}

      <p style={{ textAlign: "center" }}><Link href={`/t/${codigo}`}>Voltar para a consulta</Link></p>
    </div>
  );
}
