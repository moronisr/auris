"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { gerarPdfFicha, pareceAssinado, type DadosFichaPdf } from "@/lib/fichaPdf";

type Props = { registroId: string; usuarioId: string; assinadaEm: string | null; tipo: string | null; pdf: DadosFichaPdf; nomeArquivo: string };

export default function FormAssinar({ registroId, usuarioId, assinadaEm, tipo, pdf, nomeArquivo }: Props) {
  const [baixou, setBaixou] = useState(false);
  const [via, setVia] = useState<"govbr" | "icp">("icp");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(assinadaEm);
  const [feitoTipo, setFeitoTipo] = useState<string | null>(tipo);

  async function baixar() {
    setErro("");
    try {
      const bytes = await gerarPdfFicha(pdf);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${nomeArquivo}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setBaixou(true);
    } catch { setErro("Não consegui gerar o PDF. Tente de novo."); }
  }

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (!pareceAssinado(bytes)) return setErro("Este arquivo não tem assinatura digital. Envie o PDF que você baixou depois de assinar (normalmente o nome termina com \"assinado\").");
    setEnviando(true);
    const sb = supabaseBrowser();
    const caminho = `${usuarioId}/${registroId}.pdf`;
    const { error } = await sb.storage.from("fichas").upload(caminho, arquivo, { contentType: "application/pdf", upsert: true });
    if (error) { setEnviando(false); return setErro("Não consegui guardar o arquivo. Verifique a internet e tente de novo."); }
    const agora = new Date().toISOString();
    const { error: e2 } = await sb.from("registros").update({ assinada_em: agora, assinatura_tipo: via, assinatura_arquivo: caminho }).eq("id", registroId);
    setEnviando(false);
    if (e2) return setErro("O arquivo foi guardado, mas não consegui marcar a ficha como assinada. Tente de novo.");
    setFeito(agora); setFeitoTipo(via);
  }

  async function abrirAssinada() {
    const { data } = await supabaseBrowser().storage.from("fichas").createSignedUrl(`${usuarioId}/${registroId}.pdf`, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else setErro("Não consegui abrir a ficha assinada agora.");
  }

  return (
    <>
      {feito && (
        <div className="ok" style={{ marginBottom: 14 }}>
          Ficha assinada e guardada no Auris em {new Date(feito).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}
          {feitoTipo === "icp" ? " (certificado ICP-Brasil)." : " (gov.br)."}
          <div style={{ marginTop: 8 }}><button type="button" className="link" onClick={abrirAssinada}>Abrir a ficha assinada</button></div>
        </div>
      )}
      <p className="muted" style={{ marginTop: -6 }}>Assinada digitalmente, a ficha tem validade sem precisar imprimir. São três passos: baixar, assinar e guardar aqui.</p>

      <div className="card">
        <b>1. Baixar a ficha em PDF</b>
        <p className="muted" style={{ margin: "4px 0 10px" }}>O PDF sai com os campos da ficha, a modalidade do atendimento e o registro do uso de IA.</p>
        <button type="button" style={{ width: "100%" }} onClick={baixar}>{baixou ? "Baixar de novo" : "Baixar a ficha em PDF"}</button>
      </div>

      <div className="card">
        <b>2. Assinar</b>
        <div className="opcoes" role="group" aria-label="Forma de assinatura" style={{ margin: "10px 0" }}>
          <button type="button" aria-pressed={via === "icp"} className={via === "icp" ? "opcao ativa" : "opcao"} onClick={() => setVia("icp")}>Certificado ICP-Brasil</button>
          <button type="button" aria-pressed={via === "govbr"} className={via === "govbr" ? "opcao ativa" : "opcao"} onClick={() => setVia("govbr")}>Conta gov.br</button>
        </div>
        {via === "icp" ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Recomendado para prontuário sem papel: é a assinatura qualificada exigida pelo Conselho Federal de Medicina (Resolução CFM nº 1.821/2007, nível NGS2). Serve o certificado em nuvem (por exemplo, o do seu conselho, BirdID, VIDaaS ou SafeID) ou o certificado A1/A3 no computador.</p>
            <ol className="muted passos-lista">
              <li>Abra o aplicativo ou o site do seu certificado digital.</li>
              <li>Escolha a opção de assinar documento PDF e selecione a ficha que você baixou.</li>
              <li>Confirme a assinatura e baixe o PDF assinado.</li>
            </ol>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Gratuita, com a sua conta gov.br nível prata ou ouro. É uma assinatura eletrônica avançada: tem validade jurídica, mas para dispensar o prontuário em papel o Conselho Federal de Medicina pede o certificado ICP-Brasil.</p>
            <a className="btn btn-sec" href="https://assinador.iti.br" target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }}>Abrir o Portal de Assinatura gov.br</a>
            <p className="muted" style={{ marginBottom: 0 }}>Entre com a conta gov.br, escolha o PDF da ficha, posicione a assinatura, confirme com o código do aplicativo e baixe o arquivo assinado.</p>
          </>
        )}
      </div>

      <div className="card">
        <b>3. Guardar a ficha assinada no Auris</b>
        <p className="muted" style={{ margin: "4px 0 10px" }}>Envie o PDF assinado. Ele fica guardado junto da ficha, só para você.</p>
        <label className="btn" style={{ display: "block", textAlign: "center", cursor: "pointer", margin: 0, color: "#fff" }}>
          {enviando ? "Guardando" : feito ? "Enviar outra versão assinada" : "Escolher o PDF assinado"}
          <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={enviando} onChange={(e) => enviar(e.target.files?.[0])} />
        </label>
        <p className="muted" style={{ marginBottom: 0 }}>Para conferir uma assinatura, use o validador oficial: <a href="https://validar.iti.gov.br" target="_blank" rel="noopener noreferrer">validar.iti.gov.br</a>.</p>
      </div>
      {erro && <div className="erro" role="alert">{erro}</div>}
    </>
  );
}
