/** Moldura das páginas públicas de informação (privacidade, termos, IA). */
export default function PaginaInfo({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: React.ReactNode }) {
  return (
    <article className="pagina-info">
      <div className="paciente-topo"><a href="/" className="paciente-marca" style={{ textDecoration: "none" }}>Auris</a></div>
      <h1>{titulo}</h1>
      <p className="muted">Atualizado em {atualizado}.</p>
      {children}
      <p className="muted" style={{ marginTop: 32 }}>
        <a href="/privacidade">Política de privacidade</a> · <a href="/termos">Termos de uso</a> · <a href="/ia">Como a IA do Auris funciona</a>
      </p>
    </article>
  );
}
