"use client";
import { RESERVADOS } from "@/lib/agenda";
import BuscaAuris from "./BuscaAuris";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AvisoAssinatura from "@/components/AvisoAssinatura";
import { useEffect, useState } from "react";
import { buscarSituacao } from "@/lib/useAcesso";

const ITENS = [
  { href: "/", rotulo: "Início", icone: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { href: "/novo", rotulo: "Gravar", icone: <><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /><path d="M12 18v3" /></> },
  { href: "/teleconsultas", rotulo: "Teleconsulta", icone: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></> },
  { href: "/dia", rotulo: "PDF do dia", icone: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></> },
  { href: "/financas", rotulo: "Finanças", icone: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></> },
  { href: "/perfil", rotulo: "Perfil", icone: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
];

/** Topo fixo + barra inferior (celular). Some na tela de login e na impressão. */
export default function Navegacao() {
  const rota = usePathname();
  const [dono, setDono] = useState(false);
  useEffect(() => { buscarSituacao().then((x) => setDono(!!x?.admin)).catch(() => {}); }, []);
  const unico = rota.split("/").filter(Boolean);
  if (rota.startsWith("/login") || rota.startsWith("/nova-senha") || rota.startsWith("/t/") || rota.startsWith("/p/") || ["/privacidade", "/termos", "/ia"].includes(rota) || (unico.length === 1 && !RESERVADOS.has(unico[0]))) return null;
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
            <span>Auris</span>
            <span className="marca-desc">Registro clínico</span>
          </Link>
          <div className="topo-direita">
          <nav className="topo-links" aria-label="Navegação principal">
            {ITENS.map((i) => (
              <Link key={i.href} href={i.href} className={ativo(i.href) ? "ativo" : ""}>{i.rotulo}</Link>
            ))}
            {dono && <Link href="/admin" className={ativo("/admin") ? "ativo" : ""}>Painel</Link>}
          </nav>
          <BuscaAuris />
          </div>
        </div>
      </header>
      <AvisoAssinatura />
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
