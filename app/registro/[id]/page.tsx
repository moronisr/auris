import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { MODELOS, camposDoModelo, type Ficha } from "@/lib/modelos";
import { formatarCpf } from "@/lib/validacao";
import BotaoPdf from "./pdf";

export const dynamic = "force-dynamic";

function valor(chave: string, v: unknown): string {
  if (v == null || v === "") return "";
  if (chave === "paciente_cpf") return formatarCpf(String(v));
  if (typeof v === "number" && /(esferico|cilindrico|adicao)$/.test(chave))
    return (v > 0 ? "+" : "") + v.toFixed(2).replace(".", ",");
  return String(v);
}

export default async function Registro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: r } = await sb.from("registros").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const { data: prof } = await sb.from("profissionais").select("nome, profissao, especialidade, conselho").eq("id", user!.id).maybeSingle();

  // Registros da v1 (oftalmologia) guardavam os campos em colunas; a v2 guarda em "dados".
  const dados: Ficha = Object.keys(r.dados ?? {}).length ? r.dados : r;
  const modelo = MODELOS[r.modelo] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id).filter((c) => valor(c.chave, dados[c.chave]) !== "");
  const grupos = [...new Set(campos.map((c) => c.grupo))];

  return (
    <>
      <div className="row nao-imprimir">
        <a className="btn btn-sec" href="/">← Início</a>
        <BotaoPdf />
      </div>

      <article className="card ficha">
        <header className="ficha-topo">
          <div>
            <b style={{ fontSize: 18 }}>{prof?.nome || "Profissional"}</b>
            <div className="muted">
              {[prof?.profissao, prof?.especialidade, prof?.conselho].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="muted" style={{ textAlign: "right" }}>
            {modelo.nome}<br />
            {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
          </div>
        </header>

        {grupos.map((g) => (
          <section key={g} className="ficha-sec">
            <h2>{g}</h2>
            {campos.filter((c) => c.grupo === g).map((c) => (
              <div key={c.chave} className="ficha-linha">
                <span className="ficha-rot">{c.rotulo}</span>
                <span className="ficha-val">{valor(c.chave, dados[c.chave])}</span>
              </div>
            ))}
          </section>
        ))}

        {r.retorno_data && (
          <section className="ficha-sec">
            <h2>Data prevista de retorno</h2>
            <div>{new Date(r.retorno_data + "T12:00").toLocaleDateString("pt-BR")}</div>
          </section>
        )}

        <footer className="ficha-rodape">
          Registro elaborado com apoio de inteligência artificial e revisado e aprovado pelo profissional responsável.
          <div className="assinatura">_______________________________<br />{prof?.nome}{prof?.conselho ? ` — ${prof.conselho}` : ""}</div>
        </footer>
      </article>
    </>
  );
}
