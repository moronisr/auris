"use client";

import Link from "next/link";
import { dataCurtaBR, useAcesso } from "@/lib/useAcesso";

/** Cartão discreto no Início com a situação financeira do profissional no Auris. */
export default function ResumoFinancas() {
  const s = useAcesso();
  if (!s || (!s.configurada && !s.cobrancaAtiva)) return null;
  const a = s.assinatura;
  const plano = s.planos.find((p) => p.id === a?.plano);
  const texto = s.acesso === "bloqueado" ? "Assinatura inativa. Ative um plano para voltar a registrar e atender."
    : s.acesso === "aviso" ? "Pagamento não aprovado. Atualize o cartão para não interromper o uso."
    : s.acesso === "teste" && !a?.plano ? `Teste grátis até ${dataCurtaBR(s.fimTeste)}.`
    : a?.plano ? `Plano ${plano?.nome || a.plano}${a.recorrente && a.proxima_cobranca ? `, próxima cobrança em ${dataCurtaBR(a.proxima_cobranca)}` : a.pago_ate ? `, ativo até ${dataCurtaBR(a.pago_ate)}` : ""}.`
    : "Fase de testes: uso liberado.";
  const alerta = s.acesso === "bloqueado" || s.acesso === "aviso";
  return (
    <Link href="/financas" className={`card card-link resumo-financas${alerta ? " alerta" : ""}`}>
      <b>Finanças</b>
      <span className="muted">{texto}</span>
    </Link>
  );
}
