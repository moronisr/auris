"use client";
import { RESERVADOS } from "@/lib/agenda";
import BuscaAuris from "./BuscaAuris";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AvisoAssinatura from "@/components/AvisoAssinatura";
import { useEffect, useState } from "react";
import { buscarSituacao } from "@/lib/useAcesso";
import { iniciarAjuda } from "@/components/AjudaGuia";
import { supabaseBrowser } from "@/lib/supabase/client";

const ITENS = [
  { href: "/", rotulo: "Início", icone: <><path d="M4 11 12 4l8 7v9H4z" /><path d="M10 20v-5h4v5" /></> },
  { href: "/presencial", rotulo: "Consulta presencial", icone: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></> },
  { href: "/teleconsultas", rotulo: "Teleconsulta", icone: <><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></> },
  { href: "/dia", rotulo: "PDF do dia", icone: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></> },
  { href: "/financas", rotulo: "Finanças", icone: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M7 15h4" /></> },
  { href: "/perfil", rotulo: "Perfil e agenda online", icone: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
];
const ICONE_PAINEL = <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>;
const ICONE_AJUDA = <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h0" /></>;
const ICONE_SAIR = <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />;

const svg = (icone: React.ReactNode, tam = 19) => (
  <svg aria-hidden="true" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icone}</svg>
);

/** Topo: logo, busca e Menu. O menu abre em vidro, por cima da página, com o fundo desfocado. Some no login, nas páginas do paciente e na impressão. */
export default function Navegacao() {
  const rota = usePathname();
  const router = useRouter();
  const [dono, setDono] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { buscarSituacao().then((x) => setDono(!!x?.admin)).catch(() => {}); }, []);
  useEffect(() => { setMenu(false); }, [rota]);
  useEffect(() => {
    if (!menu) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [menu]);
  const unico = rota.split("/").filter(Boolean);
  if (rota.startsWith("/login") || rota.startsWith("/nova-senha") || rota.startsWith("/t/") || rota.startsWith("/p/") || ["/privacidade", "/termos", "/ia"].includes(rota) || (unico.length === 1 && !RESERVADOS.has(unico[0]))) return null;
  const ativo = (href: string) => (href === "/" ? rota === "/" : rota.startsWith(href) || (href === "/presencial" && rota.startsWith("/novo")));

  return (
    <>
      <header className="topo nao-imprimir">
        <div className="topo-inner">
          <Link href="/" className="marca">
            <span className="marca-icone" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round"><path d="M4 12h2l2-5 4 10 2-5h6" /></svg>
            </span>
            <span>Auris</span>
          </Link>
          <div className="topo-direita">
            <BuscaAuris />
            <button type="button" className="menu-botao" aria-expanded={menu} onClick={() => setMenu(true)}>
              {svg(<path d="M4 7h16M4 12h16M4 17h10" />, 17)}
              Menu
            </button>
          </div>
        </div>
      </header>
      <AvisoAssinatura />
      {menu && (
        <div className="veu nao-imprimir" onClick={() => setMenu(false)}>
          <nav className="menu-painel" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-cabeca">
              <span>Menu</span>
              <button type="button" className="menu-fechar" aria-label="Fechar o menu" onClick={() => setMenu(false)}>
                {svg(<path d="M6 6l12 12M18 6 6 18" />, 16)}
              </button>
            </div>
            {ITENS.map((i) => (
              <Link key={i.href} href={i.href} className={`menu-item${ativo(i.href) ? " ativo" : ""}`} onClick={() => setMenu(false)}>
                <span className="menu-icone">{svg(i.icone)}</span>{i.rotulo}
              </Link>
            ))}
            {dono && (
              <Link href="/admin" className={`menu-item${ativo("/admin") ? " ativo" : ""}`} onClick={() => setMenu(false)}>
                <span className="menu-icone">{svg(ICONE_PAINEL)}</span>Painel do Auris
              </Link>
            )}
            <button type="button" className="menu-item" style={{ background: "none", boxShadow: "none", justifyContent: "flex-start", minHeight: 0, width: "100%", fontWeight: 500 }}
              onClick={() => { setMenu(false); if (rota !== "/") router.push("/"); setTimeout(() => iniciarAjuda("registro"), rota === "/" ? 0 : 400); }}>
              <span className="menu-icone">{svg(ICONE_AJUDA)}</span>Ajuda
            </button>
            <button type="button" className="menu-item menu-sair" style={{ background: "none", boxShadow: "none", justifyContent: "flex-start", minHeight: 0, width: "100%", fontWeight: 500 }}
              onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/login"); router.refresh(); }}>
              <span className="menu-icone" style={{ background: "transparent" }}>{svg(ICONE_SAIR)}</span>Sair
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
