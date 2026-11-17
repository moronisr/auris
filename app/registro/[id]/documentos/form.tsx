"use client";
import { useEffect, useState } from "react";
import { DOCUMENTOS, gerarPdfDocumento, textoInicial, type TipoDocumento } from "@/lib/documentos";

type Props = {
  dados: Record<string, string | number | null>;
  prof: { nome: string; especialidade: string; conselho: string };
};

export default function FormDocumentos({ dados, prof }: Props) {
  const [tipo, setTipo] = useState<TipoDocumento>("resumo");
  const [textos, setTextos] = useState<Record<TipoDocumento, string>>(() => ({
    resumo: textoInicial("resumo", dados),
    atestado: textoInicial("atestado", dados),
    exames: textoInicial("exames", dados),
    encaminhamento: textoInicial("encaminhamento", dados),
  }));
  const [dias, setDias] = useState("");
  const [destino, setDestino] = useState("");
  const [paciente, setPaciente] = useState(String(dados.paciente_nome ?? ""));
  const [registro, setRegistro] = useState(prof.conselho);
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [revisei, setRevisei] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    try {
      setEndereco(localStorage.getItem("auris_endereco_consultorio") ?? "");
      setCidade(localStorage.getItem("auris_cidade") ?? "");
    } catch { /* sem armazenamento local: o profissional digita de novo */ }
  }, []);

  const doc = DOCUMENTOS.find((x) => x.id === tipo)!;
  const mudarTexto = (v: string) => { setPronto(""); setRevisei(false); setTextos({ ...textos, [tipo]: v }); };
  const trocar = (t: TipoDocumento) => { setTipo(t); setErro(""); setPronto(""); setRevisei(false); };
  const refazer = (novoDias = dias, novoDestino = destino) =>
    setTextos((atual) => ({ ...atual, [tipo]: textoInicial(tipo, { ...dados, paciente_nome: paciente }, { dias: novoDias, destino: novoDestino }) }));

  async function gerar() {
    setErro(""); setPronto("");
    if (!paciente.trim()) return setErro("Informe o nome do paciente.");
    if (!registro.trim()) return setErro("Informe o seu registro no conselho (ex.: CRM-PA 12345).");
    if (!textos[tipo].trim()) return setErro("O documento está vazio. Escreva o texto antes de gerar.");
    if (!revisei) return setErro("Marque que você revisou o documento antes de gerar.");
    setGerando(true);
    try {
      try { localStorage.setItem("auris_endereco_consultorio", endereco); localStorage.setItem("auris_cidade", cidade); } catch { /* opcional */ }
      const bytes = await gerarPdfDocumento({
        titulo: doc.titulo, profissional: prof.nome, registro, especialidade: prof.especialidade,
        enderecoConsultorio: endereco, paciente, cidade, corpo: textos[tipo],
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}-${paciente.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setPronto(doc.nome);
    } catch {
      setErro("Não consegui gerar o PDF. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <div className="abas-doc" role="tablist" aria-label="Tipo de documento">
        {DOCUMENTOS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tipo === x.id} className={tipo === x.id ? "aba-doc ativa" : "aba-doc"} onClick={() => trocar(x.id)}>
            {x.nome}
          </button>
        ))}
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{doc.descricao}</p>
        <div className="grid" style={{ marginBottom: 14 }}>
          <div>
            <label htmlFor="doc-paciente">Paciente</label>
            <input id="doc-paciente" value={paciente} onChange={(e) => { setPaciente(e.target.value); setPronto(""); }} />
          </div>
          <div>
            <label htmlFor="doc-registro">Seu registro no conselho</label>
            <input id="doc-registro" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CRM-PA 12345" />
          </div>
          <div>
            <label htmlFor="doc-cidade">Cidade</label>
            <input id="doc-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Belém" />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="doc-endereco">Endereço do consultório (aparece no cabeçalho)</label>
          <input id="doc-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>

        {tipo === "atestado" && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="doc-dias">Dias de afastamento (deixe vazio para atestado de comparecimento)</label>
            <input id="doc-dias" inputMode="numeric" value={dias} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setDias(v); setPronto(""); setRevisei(false); refazer(v, destino); }} style={{ maxWidth: 160 }} />
          </div>
        )}
        {tipo === "encaminhamento" && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="doc-destino">Encaminhar para (especialidade ou serviço)</label>
            <input id="doc-destino" value={destino} onChange={(e) => { setDestino(e.target.value); setPronto(""); setRevisei(false); refazer(dias, e.target.value); }} placeholder="Neurologia" />
          </div>
        )}

        <label htmlFor="doc-texto">Texto do documento</label>
        <textarea id="doc-texto" rows={12} value={textos[tipo]} onChange={(e) => mudarTexto(e.target.value)} />
        {!textos[tipo].trim() && (
          <p className="muted">A ficha não tem informações para este documento. Escreva o texto acima.</p>
        )}

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
          <input type="checkbox" checked={revisei} onChange={(e) => setRevisei(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 20px" }} />
          <span>Revisei o documento e ele está correto.</span>
        </label>

        {erro && <div className="erro" role="alert" style={{ marginTop: 12 }}>{erro}</div>}
        {pronto && (
          <div className="ok" role="status" style={{ marginTop: 12 }}>
            {pronto}: PDF baixado. Se precisar de assinatura eletrônica, envie o arquivo em{" "}
            <a href="https://assinador.iti.br" target="_blank" rel="noreferrer">assinador.iti.br</a> com a sua conta gov.br.
          </div>
        )}
        <button type="button" onClick={gerar} disabled={gerando} style={{ marginTop: 12 }}>
          {gerando ? "Gerando" : `Gerar PDF: ${doc.nome}`}
        </button>
      </div>
    </>
  );
}
