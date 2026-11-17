import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FormReceita from "./form";

export const dynamic = "force-dynamic";

export default async function PaginaReceita({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: r } = await sb.from("registros").select("id, dados").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();
  const dados = (r.dados ?? {}) as Record<string, string | number | null>;
  const ditado = [dados.prescricoes, dados.conduta].filter(Boolean).map(String).join("\n");
  return (
    <>
      <div className="row">
        <a className="btn btn-sec" href={`/registro/${id}`}>Voltar à ficha</a>
      </div>
      <h1>Receita</h1>
      <FormReceita
        registroId={id}
        dados={dados}
        ditado={ditado}
        prof={{ nome: prof?.nome ?? "", profissao: prof?.profissao ?? "", especialidade: prof?.especialidade ?? "", conselho: prof?.conselho ?? "" }}
      />
    </>
  );
}
