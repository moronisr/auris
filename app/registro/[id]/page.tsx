import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FichaConteudo, { valorCampo, type Registro } from "@/components/FichaConteudo";
import { MODELOS, camposDoModelo, type Ficha } from "@/lib/modelos";
import { textoProntuario } from "@/lib/documentos";
import BotaoPdf from "./pdf";
import BotaoCopiar from "./copiar";

export const dynamic = "force-dynamic";

const Seta = () => (
  <span className="atalho-seta" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  </span>
);

export default async function PaginaRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: r } = await sb.from("registros").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();
  const podeReceitar = /Médic|Dentista/.test(prof?.profissao ?? "");
  const { data: tele } = await sb.from("teleconsultas").select("iniciada_em, encerrada_em, consentimento_em").eq("registro_id", id).maybeSingle();
  const hm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
  const modalidade = tele
    ? `Teleconsulta por vídeo${tele.iniciada_em ? `, das ${hm(tele.iniciada_em)}` : ""}${tele.encerrada_em ? ` às ${hm(tele.encerrada_em)}` : ""}. Termo de consentimento aceito pelo paciente${tele.consentimento_em ? ` em ${new Date(tele.consentimento_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : ""}.`
    : undefined;

  // Texto da ficha para colar em outro prontuário (mesmos campos e ordem da ficha).
  const reg = r as Registro;
  const dados: Ficha = reg.dados && Object.keys(reg.dados).length ? reg.dados : (reg as unknown as Ficha);
  const modelo = MODELOS[reg.modelo] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id).filter((c) => valorCampo(c.chave, dados[c.chave]) !== "");
  const grupos = [...new Set(campos.map((c) => c.grupo))].map((g) => ({
    grupo: g,
    linhas: campos.filter((c) => c.grupo === g).map((c) => ({ rotulo: c.rotulo, valor: valorCampo(c.chave, dados[c.chave]) })),
  }));
  const quando = new Date(reg.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const textoCopia = textoProntuario(grupos, `${modelo.nome}, ${quando}`);

  return (
    <>
      <div className="row nao-imprimir" style={{ flexWrap: "wrap", gap: 8 }}>
        <a className="btn btn-sec" href="/">Voltar ao início</a>
        <div className="acoes-ficha">
          <BotaoCopiar texto={textoCopia} />
          <BotaoPdf />
        </div>
      </div>
      {podeReceitar && (
        <a className="card atalho-receita nao-imprimir" href={`/registro/${id}/receita`}>
          <span>
            <b>Emitir receita com assinatura gov.br</b>
            <span className="muted" style={{ display: "block" }}>Gere a receita deste paciente em PDF e assine com a sua conta gov.br.</span>
          </span>
          <Seta />
        </a>
      )}
      <a className="card atalho-receita atalho-doc nao-imprimir" href={`/registro/${id}/documentos`}>
        <span>
          <b>Documentos da consulta</b>
          <span className="muted" style={{ display: "block" }}>Atestado, pedido de exames, encaminhamento e resumo. Gere o PDF ou envie ao paciente por link.</span>
        </span>
        <Seta />
      </a>
      <article className="card ficha">
        <FichaConteudo r={reg} prof={prof} modalidade={modalidade} />
      </article>
    </>
  );
}
