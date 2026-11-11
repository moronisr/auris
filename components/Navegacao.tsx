"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Início", icone: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { href: "/novo", rotulo: "Gravar", icone: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /></> },
  { href: "/dia", rotulo: "PDF do dia", icone: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></> },
  { href: "/perfil", rotulo: "Perfil", icone: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
];

/** Topo fixo + barra inferior (celular). Some na tela de login e na impressão. */
export default function Navegacao() {
  const rota = usePathname();
  if (rota.startsWith("/login") || rota.startsWith("/nova-senha")) return null;
  const ativo = (href: string) => (href === "/" ? rota === "/" : rota.startsWith(href));
  const svg = (icone: React.ReactNode) => (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icone}</svg>
  );
  return (
    <>
      <header className="topo nao-imprimir">
        <div className="topo-inner">
          <Link href="/" className="marca">
            <span className="marca-icone" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /></svg>
            </span>
            Ditado Clínico
          </Link>
          <nav className="topo-links" aria-label="Navegação principal">
            {ITENS.map((i) => (
              <Link key={i.href} href={i.href} className={ativo(i.href) ? "ativo" : ""}>{i.rotulo}</Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="barra-inferior nao-imprimir" aria-label="Navegação">
        {ITENS.map((i) => (
          <Link key={i.href} href={i.href} className={ativo(i.href) ? "ativo" : ""}>
            {svg(i.icone)}
            <span>{i.rotulo}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
