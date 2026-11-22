"use client";
import { useEffect, useState } from "react";
import { buscarSituacao } from "@/lib/useAcesso";

/** Atalho para o Painel do Auris, visível só para o dono (útil no celular, onde o menu de cima não aparece). */
export default function LinkPainel() {
  const [dono, setDono] = useState(false);
  useEffect(() => { buscarSituacao().then((x) => setDono(!!x?.admin)).catch(() => {}); }, []);
  if (!dono) return null;
  return <a className="card card-link" href="/admin"><b>Painel do Auris</b><span className="muted">Somente você: faturamento, assinantes, uso e cortesias</span></a>;
}
