import { separarObs } from "@/lib/cancelamento";

/**
 * Depois do cancelamento: convida o paciente a remarcar, com o link da página do profissional
 * (quando a agenda online está aberta) e o WhatsApp do consultório (quando informado).
 */
export default function RemarcarConsulta({ profissional, pagina, obs }: { profissional: string; pagina?: string | null; obs?: string | null }) {
  const { whats } = separarObs(obs);
  const wa = whats ? `https://wa.me/55${whats}?text=${encodeURIComponent(`Olá! Cancelei minha teleconsulta com ${profissional} e gostaria de remarcar.`)}` : null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <b style={{ fontSize: 17 }}>Quer remarcar?</b>
      <p className="muted" style={{ margin: "4px 0 12px" }}>
        {pagina ? `Escolha um novo horário com ${profissional}.` : wa ? `Fale com o consultório de ${profissional} pelo WhatsApp.` : `Fale com o consultório de ${profissional} para marcar um novo horário.`}
      </p>
      <div className="acoes-ficha">
        {pagina && <a className="btn" href={`/${pagina}`}>Escolher novo horário</a>}
        {wa && <a className={pagina ? "btn btn-sec" : "btn"} href={wa} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>}
      </div>
    </div>
  );
}
