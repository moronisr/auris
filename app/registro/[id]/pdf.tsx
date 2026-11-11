"use client";

/** Abre a janela de impressão do navegador, onde o profissional escolhe "Salvar como PDF". */
export default function BotaoPdf() {
  return <button onClick={() => window.print()}>📄 Baixar PDF</button>;
}
