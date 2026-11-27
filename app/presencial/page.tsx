import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta presencial, Auris" };

const SETA = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6EABF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

/** Consulta presencial: começar a consulta ou procurar o registro de um paciente. */
export default async function Presencial({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const busca = String((await searchParams)?.q || "").trim().slice(0, 80);
  let achados: { id: string; paciente_nome: string | null; created_at: string }[] = [];
  if (busca) {
    // Só nas fichas do próprio profissional (a regra de acesso do banco garante isso); sem diferenciar acento.
    const sb = await supabaseServer();
    const sem = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const termos = sem(busca).split(/\s+/).filter(Boolean);
    const { data } = await sb.from("registros").select("id, paciente_nome, created_at").order("created_at", { ascending: false }).limit(3000);
    achados = (data ?? []).filter((r) => { const n = sem(r.paciente_nome || ""); return termos.every((t) => n.includes(t)); }).slice(0, 50);
  }

  return (
    <div className="inicio-auris">
      <Link href="/" className="btn btn-sec" style={{ minHeight: 40, padding: "0 16px", fontSize: 14, fontWeight: 500 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        Início
      </Link>
      <div className="saudacao" style={{ marginTop: 22 }}>Consulta presencial</div>
      <h1 className="titulo-grande">Pronto para começar?</h1>

      <div className="escolhas">
        <Link href="/novo?modo=consulta" className="escolha" data-ajuda="presencial-opcao">
          <span className="escolha-icone"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></span>
          <b>Começar a consulta</b>
          <span>Grave e a ficha fica pronta.</span>
          <span className="escolha-seguir">Começar {SETA}</span>
        </Link>

        <div className="escolha" style={{ cursor: "default" }}>
          <span className="escolha-icone"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
          <b>Registros de pacientes</b>
          <form method="get" action="/presencial#resultado" role="search" style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input name="q" defaultValue={busca} placeholder="Nome do paciente" aria-label="Nome do paciente" style={{ flex: 1, minWidth: 0 }} />
            <button type="submit">Buscar</button>
          </form>
        </div>
      </div>

      {busca && (
        <div id="resultado" style={{ scrollMarginTop: 20 }}>
          {achados.length === 0 ? (
            <p className="muted">Nenhum paciente com &quot;{busca}&quot;. Tente só o primeiro nome.</p>
          ) : achados.map((r) => (
            <Link key={r.id} href={`/registro/${r.id}`} className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              <div className="row">
                <b>{r.paciente_nome || "Paciente"}</b>
                <span className="muted">{new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
