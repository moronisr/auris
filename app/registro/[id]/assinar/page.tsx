import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Registro } from "@/components/FichaConteudo";
import { gruposDaFicha, modalidadeDaFicha } from "@/lib/fichaDados";
import { grupoProfissao, linhaIA } from "@/lib/conselhos";
import FormAssinar from "./form";

export const dynamic = "force-dynamic";

export default async function PaginaAssinar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: r } = await sb.from("registros").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();
  const { data: tele } = await sb.from("teleconsultas").select("iniciada_em, encerrada_em, consentimento_em, ia_autorizada").eq("registro_id", id).maybeSingle();
  const reg = r as Registro;
  const { modelo, grupos, quando } = gruposDaFicha(reg);
  return (
    <>
      <a className="btn btn-sec" href={`/registro/${id}`}>Voltar à ficha</a>
      <h1 style={{ marginTop: 16 }}>Assinar a ficha digitalmente</h1>
      <FormAssinar
        registroId={id}
        usuarioId={user!.id}
        assinadaEm={(r.assinada_em as string | null) ?? null}
        tipo={(r.assinatura_tipo as string | null) ?? null}
        pdf={{
          profissional: prof?.nome || "Profissional",
          detalhes: [prof?.profissao, prof?.especialidade, prof?.conselho].filter(Boolean).join(", "),
          modelo: modelo.nome, quando, modalidade: modalidadeDaFicha(reg, tele), grupos,
          linhaIA: linhaIA(grupoProfissao(prof?.profissao)), registroId: id,
        }}
        nomeArquivo={`ficha-${String(reg.paciente_nome ?? "paciente").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${reg.created_at.slice(0, 10)}`}
      />
    </>
  );
}
