"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Assinatura do plano por Pix Automático (Asaas).
 * O médico informa o CPF, recebe o QR Code do primeiro mês, paga no app do banco e autoriza os débitos mensais.
 * A tela consulta a situação a cada 5 segundos até a autorização ficar ativa.
 */
const dig = (s: string) => s.replace(/\D/g, "");
const fmtCpf = (s: string) => dig(s).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PixAutomatico({ plano, onAtivo }: { plano: { id: string; nome: string; valor: number }; onAtivo: () => void }) {
  const [cpf, setCpf] = useState("");
  const [qr, setQr] = useState<{ codigo: string; imagem: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const fim = useRef(onAtivo);
  fim.current = onAtivo;

  useEffect(() => {
    if (!qr) return;
    const inicio = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - inicio > 60 * 60 * 1000) { clearInterval(t); return; }
      const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pix_situacao" }) }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (d.situacao === "ativo") { clearInterval(t); fim.current(); }
      if (d.situacao === "nenhum") { clearInterval(t); setQr(null); setErro("A autorização não foi concluída no banco. Nenhum débito futuro foi autorizado. Gere um novo QR Code para tentar de novo."); }
    }, 5000);
    return () => clearInterval(t);
  }, [qr]);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    if (dig(cpf).length !== 11) { setErro("Confira o seu CPF."); return; }
    setErro(""); setEnviando(true);
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pix_iniciar", plano: plano.id, cpf: dig(cpf) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r?.ok || !d.codigo) { setErro(d.erro || "Não foi possível gerar o QR Code. Tente de novo."); return; }
    setQr({ codigo: d.codigo, imagem: d.imagem });
  }

  if (qr) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ marginTop: 0 }}><b>Pague {reais(plano.valor)} e autorize o Pix Automático no app do seu banco.</b></p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.imagem} alt="QR Code do Pix Automático" width={240} height={240} style={{ display: "block", margin: "0 auto" }} />
        <button type="button" className="btn-sec" style={{ marginTop: 10 }} onClick={async () => { await navigator.clipboard.writeText(qr.codigo).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }}>
          {copiado ? "Código copiado" : "Copiar código Pix"}
        </button>
        <ol className="muted" style={{ textAlign: "left", marginTop: 12 }}>
          <li>Abra o app do banco e escolha pagar com Pix (QR Code ou copia e cola).</li>
          <li>Confira o valor de {reais(plano.valor)} e confirme o pagamento.</li>
          <li>Quando o banco perguntar, <b>autorize o Pix Automático</b>. É isso que renova o plano todo mês, sem você precisar pagar de novo.</li>
        </ol>
        <p className="muted">Aguardando a confirmação do banco. Esta tela atualiza sozinha. O QR Code vale por 1 hora.</p>
      </div>
    );
  }

  return (
    <form onSubmit={gerar} noValidate>
      <p className="muted" style={{ marginTop: 0 }}>
        Você paga {reais(plano.valor)} agora pelo Pix e autoriza, no app do seu banco, o débito automático de {reais(plano.valor)} todo mês. Sem cartão. Você pode cancelar quando quiser, no Auris ou no app do banco.
      </p>
      <label htmlFor="pix-cpf">Seu CPF</label>
      <input id="pix-cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(fmtCpf(e.target.value))} />
      <button type="submit" disabled={enviando} style={{ marginTop: 10, width: "100%" }}>{enviando ? "Gerando QR Code" : `Gerar QR Code do Pix Automático (${reais(plano.valor)})`}</button>
      {erro && <div className="erro" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
    </form>
  );
}
