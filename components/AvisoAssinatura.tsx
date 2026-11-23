"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dataCurtaBR, useAcesso } from "@/lib/useAcesso";

/** Faixa no topo com a situação da assinatura: teste grátis, pagamento recusado ou acesso só para consulta. */
export default function AvisoAssinatura() {
  const s = useAcesso();
  const rota = usePathname();
  if (!s || !s.cobrancaAtiva) return null;
  const a = s.assinatura;
  const ir = rota.startsWith("/financas") ? null : <Link href="/financas">{s.acesso === "bloqueado" ? "Ativar plano" : s.acesso === "aviso" ? "Atualizar cartão" : "Escolher plano"}</Link>;
  let texto: string | null = null;
  let tipo = "aviso";
  if (s.acesso === "bloqueado") {
    texto = "Sua assinatura está inativa. Você continua podendo consultar e exportar suas fichas e consultas; para registrar e atender de novo, ative um plano.";
    tipo = "erro";
  } else if (s.acesso === "aviso") {
    const limite = a?.falha_desde ? new Date(new Date(a.falha_desde).getTime() + 7 * 864e5) : a?.pago_ate ? new Date(new Date(a.pago_ate).getTime() + 7 * 864e5) : null;
    texto = `O pagamento da sua assinatura não foi aprovado. Atualize o cartão${limite ? ` até ${dataCurtaBR(limite.toISOString())}` : ""} para não interromper o uso.`;
    tipo = "erro";
  } else if (s.acesso === "teste" && !a?.plano) {
    const dias = s.fimTeste ? Math.max(0, Math.ceil((new Date(s.fimTeste).getTime() - Date.now()) / 864e5)) : null;
    texto = dias !== null ? `Teste grátis do plano Max: ${dias === 0 ? "termina hoje" : `faltam ${dias} ${dias === 1 ? "dia" : "dias"}`}. Escolha um plano para continuar usando sem interrupção.` : "Você está no teste grátis do plano Max.";
  } else if (a?.status === "cancelada" && a.pago_ate) {
    texto = `Assinatura cancelada. Seu acesso continua até ${dataCurtaBR(a.pago_ate)}.`;
  }
  if (!texto) return null;
  return (
    <div className={`faixa-assinatura ${tipo} nao-imprimir`} role="status">
      <span>{texto}</span>{ir}
    </div>
  );
}
