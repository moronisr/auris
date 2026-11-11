import { MODELOS, camposDoModelo, type Ficha } from "@/lib/modelos";
import { formatarCpf } from "@/lib/validacao";

export type Registro = { id: string; created_at: string; modelo: string; dados: Ficha | null; retorno_data: string | null } & Record<string, unknown>;
export type Profissional = { nome?: string | null; profissao?: string | null; especialidade?: string | null; conselho?: string | null } | null;

export function valorCampo(chave: string, v: unknown): string {
  if (v == null || v === "") return "";
  if (chave === "paciente_cpf") return formatarCpf(String(v));
  if (typeof v === "number" && /(esferico|cilindrico|adicao)$/.test(chave)) return (v > 0 ? "+" : "") + v.toFixed(2).replace(".", ",");
  return String(v);
}

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Corpo de uma ficha (usado no PDF individual e no PDF do dia). */
export default function FichaConteudo({ r, prof, assinatura = true }: { r: Registro; prof: Profissional; assinatura?: boolean }) {
  const dados: Ficha = r.dados && Object.keys(r.dados).length ? r.dados : (r as unknown as Ficha);
  const modelo = MODELOS[r.modelo] ?? MODELOS.geral;
  const campos = camposDoModelo(modelo.id).filter((c) => valorCampo(c.chave, dados[c.chave]) !== "");
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  return (
    <>
      <header className="ficha-topo">
        <div>
          <b style={{ fontSize: 18 }}>{prof?.nome || "Profissional"}</b>
          <div className="muted">{[prof?.profissao, prof?.especialidade, prof?.conselho].filter(Boolean).join(" · ")}</div>
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
              <span className="ficha-val">{valorCampo(c.chave, dados[c.chave])}</span>
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
      {assinatura && (
        <footer className="ficha-rodape">
          Registro elaborado com apoio de inteligência artificial e revisado e aprovado pelo profissional responsável.
          <div className="assinatura">_______________________________<br />{prof?.nome}{prof?.conselho ? ` — ${prof.conselho}` : ""}</div>
        </footer>
      )}
    </>
  );
}
