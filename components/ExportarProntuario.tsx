"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MODELOS, camposDoModelo, type Ficha } from "@/lib/modelos";
import { valorCampo } from "@/components/FichaConteudo";

type Linha = Record<string, unknown> & { id: string; created_at: string; modelo: string; dados: Ficha | null };

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const baixar = (conteudo: string, nome: string, tipo: string) => {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/** Exporta todas as fichas do profissional: planilha (abre no Excel) e arquivo completo (JSON). */
export default function ExportarProntuario() {
  const [estado, setEstado] = useState<"" | "carregando" | "ok" | "erro">("");
  const [total, setTotal] = useState(0);

  async function buscarTudo(): Promise<Linha[]> {
    const sb = supabaseBrowser();
    const todas: Linha[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from("registros").select("*").order("created_at", { ascending: true }).range(de, de + 999);
      if (error) throw error;
      todas.push(...((data ?? []) as Linha[]));
      if (!data || data.length < 1000) break;
    }
    return todas;
  }

  async function exportar(formato: "planilha" | "completo") {
    setEstado("carregando");
    try {
      const linhas = await buscarTudo();
      setTotal(linhas.length);
      const dia = new Date().toISOString().slice(0, 10);
      if (formato === "completo") {
        const corpo = linhas.map(({ transcricao, ...resto }) => ({ ...resto, transcricao }));
        baixar(JSON.stringify({ exportado_em: new Date().toISOString(), sistema: "Auris", total: linhas.length, registros: corpo }, null, 2), `prontuario-auris-completo-${dia}.json`, "application/json");
      } else {
        const cab = ["Data", "Paciente", "CPF", "Idade", "Telefone", "E-mail", "Modelo", "Retorno", "Assinada digitalmente em", "Ficha"];
        const corpo = linhas.map((r) => {
          const d: Ficha = r.dados && Object.keys(r.dados).length ? r.dados : (r as unknown as Ficha);
          const modelo = MODELOS[r.modelo] ?? MODELOS.geral;
          const ficha = camposDoModelo(modelo.id)
            .filter((c) => !c.chave.startsWith("paciente_") && valorCampo(c.chave, d[c.chave]) !== "")
            .map((c) => `${c.rotulo}: ${valorCampo(c.chave, d[c.chave])}`).join("\n");
          return [
            new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), r.paciente_nome, valorCampo("paciente_cpf", r.paciente_cpf),
            r.paciente_idade, r.paciente_telefone, r.paciente_email, modelo.nome, r.retorno_data,
            r.assinada_em ? new Date(String(r.assinada_em)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "", ficha,
          ].map(csv).join(";");
        });
        baixar("﻿" + [cab.map(csv).join(";"), ...corpo].join("\r\n"), `prontuario-auris-${dia}.csv`, "text/csv;charset=utf-8");
      }
      setEstado("ok");
    } catch { setEstado("erro"); }
  }

  return (
    <div className="card" id="exportar">
      <h2 style={{ marginTop: 0 }}>Exportar meu prontuário</h2>
      <p className="muted" style={{ marginTop: -4 }}>Baixe todas as suas fichas quando quiser. Os registros são seus: você pode guardá-los, levar para outro sistema ou manter uma cópia de segurança. O prontuário deve ser guardado por pelo menos 20 anos (Lei nº 13.787/2018).</p>
      <div className="acoes-ficha">
        <button type="button" disabled={estado === "carregando"} onClick={() => exportar("planilha")}>Baixar planilha (Excel)</button>
        <button type="button" className="btn-sec" disabled={estado === "carregando"} onClick={() => exportar("completo")}>Baixar arquivo completo</button>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        {estado === "carregando" ? "Preparando o arquivo." : estado === "ok" ? `Pronto: ${total} ficha${total === 1 ? "" : "s"} exportada${total === 1 ? "" : "s"}.` : estado === "erro" ? "Não consegui exportar agora. Verifique a internet e tente de novo." : "A planilha abre no Excel. O arquivo completo traz tudo, inclusive a transcrição, em formato padrão (JSON). As fichas assinadas ficam disponíveis em cada ficha."}
      </p>
      <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
        <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a> · <a href="/ia">Como a IA do Auris funciona</a>
      </p>
    </div>
  );
}
