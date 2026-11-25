"use client";

import { useEffect, useState } from "react";
import { CHAVE_AJUDA_VISTA, iniciarAjuda } from "./AjudaGuia";

/** Pergunta, uma única vez, se quem está começando quer a ajuda guiada. */
export function AjudaConvite({ novato }: { novato: boolean }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    try { setMostrar(novato && !localStorage.getItem(CHAVE_AJUDA_VISTA)); } catch {}
  }, [novato]);
  if (!mostrar) return null;
  const recusar = () => {
    try { localStorage.setItem(CHAVE_AJUDA_VISTA, "1"); } catch {}
    setMostrar(false);
  };
  return (
    <div className="card ajuda-convite">
      <b>Quer uma ajuda rápida para começar?</b>
      <p className="muted" style={{ margin: "4px 0 12px" }}>Eu mostro onde tocar, passo a passo. Leva 1 minuto.</p>
      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <button type="button" onClick={() => { iniciarAjuda("registro"); setMostrar(false); }}>Sim, me mostre</button>
        <button type="button" className="btn-sec" onClick={recusar}>Agora não</button>
      </div>
    </div>
  );
}

/** Link discreto para abrir a ajuda quando quiser. */
export function AjudaLink({ roteiro = "registro", texto = "Ajuda para usar o Auris" }: { roteiro?: "registro" | "tele" | "paciente"; texto?: string }) {
  return (
    <button type="button" className="ajuda-link" onClick={() => iniciarAjuda(roteiro)}>{texto}</button>
  );
}
