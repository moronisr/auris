/** Agenda semanal do profissional e cálculo dos horários livres (horário de Brasília, sem horário de verão). */

export type Intervalo = { dia: number; inicio: string; fim: string }; // dia: 0 = domingo ... 6 = sábado
export type Excecao = { data: string; tipo: "bloqueio" | "extra"; inicio?: string; fim?: string };
export type Ocupado = { inicio: string; duracao_min: number };

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const OFFSET = "-03:00";
const MS_MIN = 60_000;

/** Palavras que não podem ser link de profissional, porque são páginas do próprio Auris. */
export const RESERVADOS = new Set(["api", "auth", "login", "sair", "novo", "dia", "p", "t", "perfil", "registro", "teleconsultas", "nova-senha", "agendar", "admin", "planos", "precos", "ajuda", "termos", "privacidade", "ia", "assinar", "_next", "favicon.ico", "manifest.webmanifest", "robots.txt", "sitemap.xml"]);

export function criarSlug(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function slugValido(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 60 && !RESERVADOS.has(s);
}

const hhmm = (s: string) => /^\d{2}:\d{2}$/.test(s);
const paraMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const doMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Data (AAAA-MM-DD) e dia da semana em Brasília para um instante. */
export function diaLocal(d: Date): { data: string; semana: number } {
  const l = new Date(d.getTime() - 3 * 60 * MS_MIN);
  return { data: l.toISOString().slice(0, 10), semana: l.getUTCDay() };
}

export function limparAgenda(v: unknown): Intervalo[] {
  if (!Array.isArray(v)) return [];
  return v.filter((i): i is Intervalo => !!i && typeof i === "object" && Number.isInteger((i as Intervalo).dia)
    && (i as Intervalo).dia >= 0 && (i as Intervalo).dia <= 6 && hhmm((i as Intervalo).inicio) && hhmm((i as Intervalo).fim)
    && paraMin((i as Intervalo).fim) > paraMin((i as Intervalo).inicio)).slice(0, 30);
}

export function limparExcecoes(v: unknown): Excecao[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is Excecao => !!e && typeof e === "object" && /^\d{4}-\d{2}-\d{2}$/.test((e as Excecao).data)
    && ((e as Excecao).tipo === "bloqueio" || ((e as Excecao).tipo === "extra" && hhmm((e as Excecao).inicio ?? "") && hhmm((e as Excecao).fim ?? "")
      && paraMin((e as Excecao).fim!) > paraMin((e as Excecao).inicio!)))).slice(0, 100);
}

/**
 * Horários livres nos próximos `dias` dias.
 * Considera a agenda semanal, os dias bloqueados, os horários extras, as consultas já marcadas
 * e a antecedência mínima. Retorna instantes ISO (UTC).
 */
export function horariosLivres(opts: {
  agenda: Intervalo[]; excecoes: Excecao[]; duracao: number; ocupados: Ocupado[];
  agora?: Date; dias?: number; antecedenciaHoras?: number;
}): string[] {
  const { agenda, excecoes, duracao, ocupados, agora = new Date(), dias = 14, antecedenciaHoras = 2 } = opts;
  if (duracao < 10 || duracao > 240) return [];
  const limite = agora.getTime() + antecedenciaHoras * 60 * MS_MIN;
  const ocup = ocupados.map((o) => [new Date(o.inicio).getTime(), new Date(o.inicio).getTime() + o.duracao_min * MS_MIN]);
  const livres: string[] = [];
  for (let k = 0; k <= dias; k++) {
    const { data, semana } = diaLocal(new Date(agora.getTime() + k * 24 * 60 * MS_MIN));
    const doDia = excecoes.filter((e) => e.data === data);
    if (doDia.some((e) => e.tipo === "bloqueio")) continue;
    const faixas = [
      ...agenda.filter((i) => i.dia === semana).map((i) => [paraMin(i.inicio), paraMin(i.fim)]),
      ...doDia.filter((e) => e.tipo === "extra").map((e) => [paraMin(e.inicio!), paraMin(e.fim!)]),
    ];
    const vistos = new Set<string>();
    for (const [ini, fim] of faixas) {
      for (let m = ini; m + duracao <= fim; m += duracao) {
        const iso = new Date(`${data}T${doMin(m)}:00${OFFSET}`).toISOString();
        if (vistos.has(iso)) continue;
        vistos.add(iso);
        const a = new Date(iso).getTime(), b = a + duracao * MS_MIN;
        if (a < limite) continue;
        if (ocup.some(([x, y]) => a < y && x < b)) continue;
        livres.push(iso);
      }
    }
  }
  return livres.sort();
}

/** Uma consulta ocupa o horário se não foi cancelada e está paga, gratuita ou com reserva ainda válida. */
export function ocupaHorario(t: { status: string; pagamento_status: string; reserva_expira_em: string | null }, agora = new Date()): boolean {
  if (t.status === "cancelada") return false;
  if (t.pagamento_status === "confirmado" || t.pagamento_status === "isento" || t.pagamento_status === "informado") return true;
  return !t.reserva_expira_em || new Date(t.reserva_expira_em) > agora;
}
