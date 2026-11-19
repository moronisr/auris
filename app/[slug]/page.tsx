"use client";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reais } from "@/lib/pix";
import { mascaraTelefone } from "@/lib/telefone";

type Pagina = {
  nome: string; especialidade: string | null; conselho: string | null; apresentacao: string | null;
  valor: number | null; duracao: number; aceitando: boolean; horarios: string[];
};

const TZ = "America/Sao_Paulo";
const diaDe = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const chaveDia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Página pública do profissional: o paciente escolhe o horário, informa os dados e segue para o pagamento. */
export default function PaginaProfissional({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [p, setP] = useState<Pagina | null | undefined>(undefined);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "" });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const r = await fetch(`/api/pagina/${encodeURIComponent(slug)}`, { cache: "no-store" });
    setP(r.ok ? await r.json() : null);
  }
  useEffect(() => { carregar(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const porDia = useMemo(() => {
    const m = new Map<string, string[]>();
    (p?.horarios || []).forEach((h) => { const k = chaveDia(h); m.set(k, [...(m.get(k) || []), h]); });
    return [...m.entries()];
  }, [p]);

  async function agendar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!escolhido) return setErro("Escolha um horário.");
    setErro(""); setEnviando(true);
    const r = await fetch("/api/agendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, inicio: escolhido, ...form }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setEnviando(false);
      setErro(d.erro || "Não foi possível agendar.");
      if (r.status === 409) { setEscolhido(null); carregar(); }
      return;
    }
    router.push(`/t/${d.codigo}`);
  }

  if (p === undefined) return <div className="paciente"><p className="muted">Carregando.</p></div>;
  if (p === null) return (
    <div className="paciente">
      <div className="paciente-topo"><span className="paciente-marca">Auris</span></div>
      <h1>Página não encontrada</h1>
      <p className="muted">Confira o link com o consultório.</p>
    </div>
  );

  return (
    <div className="paciente">
      <div className="paciente-topo"><span className="paciente-marca">Auris</span><span className="muted">Teleconsulta</span></div>
      <h1 style={{ marginBottom: 4 }}>{p.nome}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{[p.especialidade, p.conselho].filter(Boolean).join(", ")}</p>
      {p.apresentacao && <p>{p.apresentacao}</p>}

      <div className="card">
        <div className="row">
          <div><b>Teleconsulta por vídeo</b><div className="muted">{p.duracao} minutos, pelo celular ou computador</div></div>
          {p.valor && <b style={{ fontSize: 18 }}>{reais(p.valor)}</b>}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>O pagamento é feito na hora do agendamento, por Pix, cartão de crédito ou cartão de débito, e confirma a sua consulta.</p>
      </div>

      {!p.aceitando ? (
        <div className="card"><p style={{ margin: 0 }}>No momento, {p.nome.split(" ")[0] === "Dra." || p.nome.split(" ")[0] === "Dr." ? p.nome : "este profissional"} não está com agenda online aberta. Entre em contato com o consultório.</p></div>
      ) : p.horarios.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>Todos os horários dos próximos 14 dias estão ocupados. Volte em breve: novos horários são abertos toda semana.</p></div>
      ) : (
        <form className="card" onSubmit={agendar}>
          <h2 style={{ marginTop: 0 }}>1. Escolha o horário</h2>
          <p className="muted" style={{ marginTop: -4 }}>Horários de Brasília.</p>
          {porDia.map(([dia, hs]) => (
            <div className="horarios-dia" key={dia}>
              <h3>{diaDe(hs[0])}</h3>
              <div className="grade-horarios" role="group" aria-label={diaDe(hs[0])}>
                {hs.map((h) => (
                  <button key={h} type="button" aria-pressed={escolhido === h} className={escolhido === h ? "opcao ativa" : "opcao"} onClick={() => { setEscolhido(h); setErro(""); }}>{horaDe(h)}</button>
                ))}
              </div>
            </div>
          ))}

          <h2>2. Seus dados</h2>
          <label htmlFor="pg-nome">Nome completo</label>
          <input id="pg-nome" autoComplete="name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <label htmlFor="pg-tel" style={{ marginTop: 10 }}>WhatsApp com DDD</label>
          <input id="pg-tel" inputMode="tel" autoComplete="tel" placeholder="(91) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })} required />
          <label htmlFor="pg-email" style={{ marginTop: 10 }}>E-mail (opcional, para o recibo)</label>
          <input id="pg-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {escolhido && <p className="ok" style={{ marginTop: 14 }}>Horário escolhido: <b>{diaDe(escolhido)}, às {horaDe(escolhido)}</b>.</p>}
          {erro && <div className="erro" style={{ marginTop: 12 }}>{erro}</div>}
          <button type="submit" disabled={enviando || !escolhido} style={{ width: "100%", marginTop: 14 }}>{enviando ? "Reservando o horário" : "Continuar para o pagamento"}</button>
          <p className="muted" style={{ marginBottom: 0 }}>O horário fica reservado por 30 minutos para você concluir o pagamento.</p>
        </form>
      )}
    </div>
  );
}
