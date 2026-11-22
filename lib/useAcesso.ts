"use client";

import { useEffect, useState } from "react";

export type SituacaoAssinatura = {
  acesso: "liberado" | "teste" | "ativa" | "aviso" | "bloqueado";
  cobrancaAtiva: boolean; configurada: boolean; fimTeste: string | null; email?: string;
  assinatura: null | { plano: string | null; status: string; cartao_final: string | null; cartao_bandeira: string | null; valor: number | null; pago_ate: string | null; ultimo_pagamento_em: string | null; falha_desde: string | null; falha_motivo?: string | null; cortesia_ate?: string | null; proxima_cobranca: string | null; cancelada_em: string | null; recorrente?: boolean; renovacao_automatica?: boolean };
  cobrancas?: { data: string; valor: number | null; status: string; origem: string; plano: string | null }[];
  planos: { id: string; nome: string; valor: number; resumo: string; recursos: string[]; destaque?: boolean; oculto?: boolean }[];
  publicKey: string | null;
  admin?: boolean;
};

let cache: Promise<SituacaoAssinatura | null> | null = null;

export function buscarSituacao(forcar = false): Promise<SituacaoAssinatura | null> {
  if (!cache || forcar) cache = fetch("/api/assinatura", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cache;
}

/** Situação da assinatura do profissional logado (uma consulta por carregamento de página). */
export function useAcesso() {
  const [s, setS] = useState<SituacaoAssinatura | null | undefined>(undefined);
  useEffect(() => { buscarSituacao().then(setS); }, []);
  return s;
}

export const dataCurtaBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
