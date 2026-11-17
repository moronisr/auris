"use client";
import { useState } from "react";

/** Copia a ficha em texto simples, pronta para colar no prontuário do hospital ou da clínica. */
export default function BotaoCopiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"" | "ok" | "erro">("");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
    setTimeout(() => setEstado(""), 4000);
  }
  return (
    <button type="button" className="btn-sec" onClick={copiar} aria-live="polite">
      {estado === "ok" ? "Copiado. Cole no prontuário" : estado === "erro" ? "Não foi possível copiar" : "Copiar para outro prontuário"}
    </button>
  );
}
