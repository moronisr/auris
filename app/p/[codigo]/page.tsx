"use client";
import { use, useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { gerarPdfDocumento, type ConteudoEntrega } from "@/lib/documentos";
import { mascaraData } from "@/lib/teleconsulta";

const MENSAGENS: Record<string, string> = {
  nao_encontrado: "Link não encontrado. Confira se ele está completo ou peça um novo ao consultório.",
  expirado: "Este link expirou. Peça um novo ao consultório.",
  bloqueado: "Este link foi bloqueado depois de várias tentativas com a data errada. Peça um novo ao consultório.",
  nascimento: "A data de nascimento não confere. Tente de novo.",
};

export default function PaginaPaciente({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const [estado, setEstado] = useState<"carregando" | "pede" | "ok" | "erro">("carregando");
  const [mensagem, setMensagem] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [conteudo, setConteudo] = useState<ConteudoEntrega | null>(null);
  const [expira, setExpira] = useState("");
  const [aberto, setAberto] = useState<number | null>(0);

  const consultar = useCallback(async (data: string | null) => {
    const { data: r, error } = await supabaseBrowser().rpc("entrega_paciente", { p_codigo: codigo, p_nascimento: data });
    if (error || !r) { setEstado("erro"); setMensagem("Não foi possível abrir agora. Verifique a internet e tente de novo."); return; }
    const res = r as { erro?: string; conteudo?: ConteudoEntrega; expira_em?: string };
    if (res.erro === "pede_nascimento") { setEstado("pede"); return; }
    if (res.erro === "nascimento") { setEstado("pede"); setMensagem(MENSAGENS.nascimento); return; }
    if (res.erro) { setEstado("erro"); setMensagem(MENSAGENS[res.erro] ?? MENSAGENS.nao_encontrado); return; }
    setConteudo(res.conteudo!);
    setExpira(res.expira_em ? new Date(res.expira_em).toLocaleDateString("pt-BR") : "");
    setEstado("ok");
    setMensagem("");
  }, [codigo]);

  useEffect(() => { consultar(null); }, [consultar]);

  async function baixar(i: number) {
    if (!conteudo) return;
    const d = conteudo.documentos[i];
    const bytes = await gerarPdfDocumento({
      titulo: d.titulo, profissional: conteudo.profissional.nome, registro: conteudo.profissional.registro,
      especialidade: conteudo.profissional.especialidade, enderecoConsultorio: conteudo.profissional.endereco,
      paciente: conteudo.paciente, cidade: conteudo.cidade, corpo: d.texto,
    });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${d.tipo}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const topo = <div className="paciente-topo"><span className="paciente-marca">Auris</span><span className="muted">Sua consulta</span></div>;

  if (estado === "carregando") return <div className="paciente">{topo}<p className="muted">Carregando.</p></div>;
  if (estado === "erro") return <div className="paciente">{topo}<h1>Não foi possível abrir</h1><p className="muted">{mensagem}</p></div>;
  if (estado === "pede") return (
    <div className="paciente">
      {topo}
      <h1>Confirme quem é você</h1>
      <p className="muted">Para proteger os seus dados, informe a sua data de nascimento.</p>
      <form className="card" onSubmit={(e) => { e.preventDefault(); consultar(nascimento); }}>
        <label htmlFor="nasc">Data de nascimento</label>
        <input id="nasc" inputMode="numeric" placeholder="DD/MM/AAAA" value={nascimento} onChange={(e) => setNascimento(mascaraData(e.target.value))} autoComplete="bday" />
        {mensagem && <div className="erro" style={{ marginTop: 10 }} role="alert">{mensagem}</div>}
        <button type="submit" disabled={nascimento.length !== 10} style={{ width: "100%", marginTop: 12 }}>Abrir</button>
      </form>
    </div>
  );

  const c = conteudo!;
  return (
    <div className="paciente">
      {topo}
      <p className="muted" style={{ marginBottom: 2 }}>{c.data}</p>
      <h1>Sua consulta, {c.paciente.split(" ")[0]}</h1>
      <p className="muted" style={{ marginTop: -10 }}>Revisado e enviado por {c.profissional.nome}{c.profissional.especialidade ? `, ${c.profissional.especialidade}` : ""}.</p>
      {c.documentos.map((d, i) => (
        <div className="card" key={i}>
          <button type="button" className="doc-titulo" aria-expanded={aberto === i} onClick={() => setAberto(aberto === i ? null : i)}>
            <span>{d.nome}</span>
            <span className="muted">{aberto === i ? "Fechar" : "Abrir"}</span>
          </button>
          {aberto === i && (
            <>
              <div className="doc-texto">{d.texto}</div>
              <button type="button" className="btn-sec" style={{ width: "100%", marginTop: 12 }} onClick={() => baixar(i)}>Baixar em PDF</button>
            </>
          )}
        </div>
      ))}
      <p className="muted" style={{ textAlign: "center" }}>Esta página é só sua{expira ? ` e fica disponível até ${expira}` : ""}. Em caso de dúvida, fale com o consultório.</p>
    </div>
  );
}
