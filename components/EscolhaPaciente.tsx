"use client";
import { useEffect, useMemo, useState } from "react";
import { separarObs } from "@/lib/cancelamento";

const TZ = "America/Sao_Paulo";
const diaDe = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O consultório cancelou uma consulta paga: o paciente escolhe remarcar sem pagar de novo ou receber o valor de volta. */
export default function EscolhaPaciente({ codigo, profissional, valor, obs, aoConcluir }: { codigo: string; profissional: string; valor: number; obs?: string | null; aoConcluir: () => void }) {
  const [dados, setDados] = useState<{ agendaAberta: boolean; horarios: string[]; devolucaoPedida?: boolean } | null>(null);
  const [modo, setModo] = useState<"" | "remarcar" | "devolver">("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const { whats } = separarObs(obs);
  const wa = whats ? `https://wa.me/55${whats}?text=${encodeURIComponent(`Olá! Minha teleconsulta com ${profissional} foi cancelada pelo consultório e gostaria de remarcar.`)}` : null;

  useEffect(() => {
    fetch(`/api/teleconsulta/escolha?codigo=${encodeURIComponent(codigo)}`, { cache: "no-store" }).then((r) => r.json()).then(setDados).catch(() => setDados({ agendaAberta: false, horarios: [] }));
  }, [codigo]);

  const porDia = useMemo(() => {
    const m = new Map<string, string[]>();
    (dados?.horarios || []).forEach((h) => { const k = new Date(h).toLocaleDateString("en-CA", { timeZone: TZ }); m.set(k, [...(m.get(k) || []), h]); });
    return [...m.entries()].slice(0, 10);
  }, [dados]);

  async function enviar(acao: "remarcar" | "devolver") {
    setErro(""); setEnviando(true);
    const r = await fetch("/api/teleconsulta/escolha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, acao, inicio: escolhido }) });
    const d = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setErro(d.erro || "Não foi possível concluir. Tente de novo.");
    if (d.manual) { setFeito(`Pedido enviado. Você pagou direto ao consultório, então ele vai devolver ${reais(Number(d.valor || valor))} pelo Pix.`); return; }
    setFeito(acao === "remarcar" ? `Pronto! Sua consulta foi remarcada para ${diaDe(d.inicio)}, às ${horaDe(d.inicio)}, sem pagar de novo.` : `Pronto! Devolvemos ${reais(Number(d.valor || valor))}. No Pix, volta em poucos minutos; no cartão, aparece na fatura em até duas faturas.`);
    setTimeout(aoConcluir, 2500);
  }

  if (dados?.devolucaoPedida) return <div className="aviso" role="status" style={{ marginTop: 14 }}>Você pediu a devolução de {reais(valor)}. O consultório vai devolver pelo Pix.</div>;
  if (feito) return <div className="ok" role="status" style={{ marginTop: 14 }}>{feito}</div>;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <b style={{ fontSize: 17 }}>Seu pagamento está guardado</b>
      <p className="muted" style={{ margin: "4px 0 14px" }}>O consultório precisou cancelar. Escolha o que prefere:</p>
      {erro && <div className="erro" role="alert" style={{ marginBottom: 12 }}>{erro}</div>}

      {modo === "" && (
        <div style={{ display: "grid", gap: 10 }}>
          <button type="button" onClick={() => setModo("remarcar")}>Remarcar sem pagar de novo</button>
          <button type="button" className="btn-sec" onClick={() => setModo("devolver")}>Quero a devolução de {reais(valor)}</button>
        </div>
      )}

      {modo === "remarcar" && (
        !dados ? <p className="muted">Carregando os horários.</p>
        : dados.agendaAberta && dados.horarios.length ? (
          <>
            {porDia.map(([dia, hs]) => (
              <div key={dia} style={{ marginBottom: 10 }}>
                <span className="rotulo" style={{ textTransform: "capitalize" }}>{diaDe(hs[0])}</span>
                <div className="opcoes" style={{ flexWrap: "wrap" }}>
                  {hs.map((h) => <button key={h} type="button" aria-pressed={escolhido === h} className={escolhido === h ? "opcao ativa" : "opcao"} style={{ flex: "0 0 auto" }} onClick={() => setEscolhido(h)}>{horaDe(h)}</button>)}
                </div>
              </div>
            ))}
            <button type="button" disabled={!escolhido || enviando} style={{ width: "100%", marginTop: 6 }} onClick={() => enviar("remarcar")}>{enviando ? "Remarcando" : escolhido ? `Confirmar ${diaDe(escolhido).split(",")[0]}, ${horaDe(escolhido)}` : "Escolha um horário"}</button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>Combine o novo horário com o consultório. Você não paga de novo: o consultório remarca esta mesma consulta.</p>
            {wa ? <a className="btn" href={wa} target="_blank" rel="noreferrer" style={{ display: "flex" }}>Combinar pelo WhatsApp</a> : <p className="muted">Entre em contato com o consultório de {profissional}.</p>}
          </>
        )
      )}

      {modo === "devolver" && (
        <>
          <p style={{ marginTop: 0 }}>Você recebe {reais(valor)} de volta, na mesma forma em que pagou.</p>
          <button type="button" disabled={enviando} style={{ width: "100%" }} onClick={() => enviar("devolver")}>{enviando ? "Devolvendo" : "Confirmar a devolução"}</button>
        </>
      )}

      {modo !== "" && !enviando && <button type="button" className="link" style={{ display: "block", margin: "8px auto 0" }} onClick={() => { setModo(""); setErro(""); setEscolhido(null); }}>Voltar</button>}
    </div>
  );
}
