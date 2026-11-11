import { supabaseServer } from "@/lib/supabase/server";
import FichaConteudo, { hora, type Registro } from "@/components/FichaConteudo";
import { MODELOS } from "@/lib/modelos";
import BotaoPdf from "../registro/[id]/pdf";
import SeletorData from "./seletor";

export const dynamic = "force-dynamic";

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
function hojeBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export default async function PdfDoDia({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { data: param } = await searchParams;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(param ?? "") ? param! : hojeBR();
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();
  // Dia completo no horário de Brasília (UTC-3).
  const { data: lista } = await sb
    .from("registros")
    .select("*")
    .gte("created_at", `${data}T00:00:00-03:00`)
    .lte("created_at", `${data}T23:59:59.999-03:00`)
    .order("created_at", { ascending: true });
  const registros = (lista ?? []) as Registro[];
  const dataExtenso = new Date(`${data}T12:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const geradoEm = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <div className="row nao-imprimir" style={{ flexWrap: "wrap", gap: 8 }}>
        <a className="btn btn-sec" href="/">← Início</a>
        <SeletorData data={data} />
        <BotaoPdf />
      </div>
      <p className="muted nao-imprimir">Documento de arquivo do profissional. Para entregar a um paciente, use o PDF individual da ficha dele.</p>

      <article className="card ficha">
        <header className="ficha-topo">
          <div>
            <b style={{ fontSize: 20 }}>Atendimentos do dia</b>
            <div style={{ textTransform: "capitalize" }}>{dataExtenso}</div>
          </div>
          <div className="muted" style={{ textAlign: "right" }}>
            {prof?.nome}<br />{[prof?.especialidade, prof?.conselho].filter(Boolean).join(" · ")}
          </div>
        </header>
        <section className="ficha-sec">
          <h2>Sumário — {registros.length} atendimento{registros.length === 1 ? "" : "s"}</h2>
          {registros.length === 0 && <p className="muted">Nenhum atendimento registrado nesta data.</p>}
          {registros.map((r, i) => (
            <div key={r.id} className="ficha-linha">
              <span className="ficha-rot">{i + 1}. {hora(r.created_at)}</span>
              <span className="ficha-val">{String(r.paciente_nome ?? "Paciente")} — {MODELOS[r.modelo]?.nome ?? r.modelo}</span>
            </div>
          ))}
        </section>
        <div className="ficha-rodape">Gerado em {geradoEm} · Documento confidencial — contém dados de saúde de vários pacientes.</div>
      </article>

      {registros.map((r, i) => (
        <article key={r.id} className="card ficha quebra-pagina">
          <div className="muted" style={{ marginBottom: 6 }}>Atendimento {i + 1} de {registros.length}</div>
          <FichaConteudo r={r} prof={prof} assinatura={i === registros.length - 1} />
        </article>
      ))}
    </>
  );
}
