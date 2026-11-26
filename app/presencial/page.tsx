import Link from "next/link";

export const metadata = { title: "Consulta presencial, Auris" };

const SETA = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D6EABF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

/** Consulta presencial: escolher como registrar e seguir para a gravação. */
export default function Presencial() {
  return (
    <div className="inicio-auris">
      <Link href="/" className="btn btn-sec" style={{ minHeight: 40, padding: "0 16px", fontSize: 14, fontWeight: 500 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        Início
      </Link>
      <div className="saudacao" style={{ marginTop: 22 }}>Consulta presencial</div>
      <h1 className="titulo-grande">Como quer registrar?</h1>
      <div className="escolhas" data-ajuda="presencial-opcao">
        <Link href="/novo?modo=consulta" className="escolha escolha-linha">
          <span className="escolha-icone"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></span>
          <span className="escolha-texto"><b>Gravar a consulta</b><span>A conversa com o paciente vira a ficha.</span></span>
          {SETA}
        </Link>
        <Link href="/novo?modo=ditado" className="escolha escolha-linha">
          <span className="escolha-icone"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></svg></span>
          <span className="escolha-texto"><b>Ditar depois</b><span>Você fala sozinho, ao final do atendimento.</span></span>
          {SETA}
        </Link>
      </div>
      <Link href="/#ultimos-pacientes" className="escolha escolha-linha" style={{ padding: 18 }}>
        <span className="escolha-icone" style={{ width: 44, height: 44 }}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
        <span className="escolha-texto"><b style={{ fontSize: 16 }}>Pacientes atendidos</b><span>Buscar pelo nome e abrir a ficha.</span></span>
        {SETA}
      </Link>
    </div>
  );
}
