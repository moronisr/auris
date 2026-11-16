import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FichaConteudo, { type Registro } from "@/components/FichaConteudo";
import BotaoPdf from "./pdf";

export const dynamic = "force-dynamic";

export default async function PaginaRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: r } = await sb.from("registros").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();
  const podeReceitar = /Médic|Dentista/.test(prof?.profissao ?? "");
  return (
    <>
      <div className="row nao-imprimir">
        <a className="btn btn-sec" href="/">← Início</a>
        <BotaoPdf />
      </div>
      {podeReceitar && (
        <a className="card atalho-receita nao-imprimir" href={`/registro/${id}/receita`}>
          <span>
            <b>Emitir receita com assinatura gov.br</b>
            <span className="muted" style={{ display: "block" }}>Gere a receita deste paciente em PDF e assine com a sua conta gov.br.</span>
          </span>
          <span className="atalho-seta" aria-hidden="true">→</span>
        </a>
      )}
      <article className="card ficha">
        <FichaConteudo r={r as Registro} prof={prof} />
      </article>
    </>
  );
}
