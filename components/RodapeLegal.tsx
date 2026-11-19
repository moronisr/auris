/** Rodapé discreto com os links de privacidade, termos e IA (aparece para profissional e paciente). */
export default function RodapeLegal() {
  return (
    <footer className="rodape-legal nao-imprimir">
      <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos de uso</a> · <a href="/ia">Como a IA funciona</a>
    </footer>
  );
}
