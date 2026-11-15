"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { gerarPdfReceita, restricoes, type ItemReceita } from "@/lib/receita";

type Props = {
  registroId: string;
  dados: Record<string, string | number | null>;
  ditado: string;
  prof: { nome: string; profissao: string; especialidade: string; conselho: string };
};
const VAZIO: ItemReceita = { medicamento: "", quantidade: "", posologia: "" };

export default function FormReceita({ registroId, dados, ditado, prof }: Props) {
  const salva = (() => { try { return JSON.parse(String(dados.receita_json ?? "")); } catch { return null; } })();
  const [itens, setItens] = useState<ItemReceita[]>(salva?.itens?.length ? salva.itens : [{ ...VAZIO }]);
  const [orientacoes, setOrientacoes] = useState<string>(salva?.orientacoes ?? "");
  const [paciente, setPaciente] = useState(String(dados.paciente_nome ?? ""));
  const [registro, setRegistro] = useState(prof.conselho);
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [declaro, setDeclaro] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    try {
      setEndereco(localStorage.getItem("auris_endereco_consultorio") ?? "");
      setCidade(localStorage.getItem("auris_cidade") ?? "");
    } catch { /* sem armazenamento local: o profissional digita de novo */ }
  }, []);

  const mudar = (i: number, campo: keyof ItemReceita, v: string) => { setPronto(false); setItens(itens.map((it, k) => (k === i ? { ...it, [campo]: v } : it))); };
  const preenchidos = itens.filter((it) => it.medicamento.trim());
  const restritos = restricoes(preenchidos);

  async function gerar() {
    setErro("");
    if (!paciente.trim()) return setErro("Informe o nome do paciente.");
    if (!registro.trim()) return setErro("Informe o seu registro no conselho (ex.: CRM-PA 12345).");
    if (!endereco.trim()) return setErro("Informe o endereço do consultório. Ele é obrigatório na receita.");
    if (!preenchidos.length) return setErro("Adicione pelo menos um medicamento.");
    if (preenchidos.some((it) => !it.posologia.trim())) return setErro("Preencha o modo de usar de cada medicamento.");
    if (restritos.length) return setErro("Esta receita tem medicamento que não pode ser assinado pelo gov.br. Veja o aviso acima.");
    if (!declaro) return setErro("Marque a declaração antes de gerar a receita.");
    setGerando(true);
    try {
      try { localStorage.setItem("auris_endereco_consultorio", endereco); localStorage.setItem("auris_cidade", cidade); } catch { /* opcional */ }
      const bytes = await gerarPdfReceita({ profissional: prof.nome, registro, especialidade: prof.especialidade, enderecoConsultorio: endereco, paciente, cidade, itens: preenchidos, orientacoes });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `receita-${paciente.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const { error } = await supabaseBrowser().from("registros")
        .update({ dados: { ...dados, receita_json: JSON.stringify({ itens: preenchidos, orientacoes, gerada_em: new Date().toISOString() }) } })
        .eq("id", registroId);
      if (error) setErro("O PDF foi gerado, mas não consegui guardar a receita na ficha. Você pode seguir para a assinatura.");
      setPronto(true);
    } catch {
      setErro("Não consegui gerar o PDF. Tente de novo.");
    } finally { setGerando(false); }
  }

  return (
    <>
      <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
        Receita simples, assinada com a sua conta gov.br (nível prata ou ouro). O Auris não sugere medicamentos: você escreve, confere e assina.
      </p>
      {ditado && (
        <div className="card" style={{ marginBottom: 14 }}>
          <label>Dito na consulta (para consulta, não entra na receita)</label>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5 }}>{ditado}</div>
        </div>
      )}
      <div className="card">
        <div className="grid">
          <div><label>Paciente</label><input value={paciente} onChange={(e) => { setPaciente(e.target.value); setPronto(false); }} /></div>
          <div><label>Seu registro no conselho</label><input value={registro} placeholder="CRM-PA 12345" onChange={(e) => { setRegistro(e.target.value); setPronto(false); }} /></div>
          <div><label>Cidade</label><input value={cidade} placeholder="Belém" onChange={(e) => { setCidade(e.target.value); setPronto(false); }} /></div>
        </div>
        <div style={{ height: 10 }} />
        <label>Endereço do consultório</label>
        <input value={endereco} placeholder="Rua, número, bairro, cidade - UF" onChange={(e) => { setEndereco(e.target.value); setPronto(false); }} />
      </div>

      {itens.map((it, i) => (
        <div className="card" key={i} style={{ marginTop: 12 }}>
          <div className="row">
            <b>Medicamento {i + 1}</b>
            {itens.length > 1 && <button type="button" className="link" onClick={() => { setItens(itens.filter((_, k) => k !== i)); setPronto(false); }}>Remover</button>}
          </div>
          <div className="grid" style={{ marginTop: 8 }}>
            <div style={{ gridColumn: "span 2" }}><label>Nome, concentração e forma</label><input value={it.medicamento} placeholder="Ex.: Dipirona 500 mg, comprimido" onChange={(e) => mudar(i, "medicamento", e.target.value)} /></div>
            <div><label>Quantidade</label><input value={it.quantidade} placeholder="Ex.: 1 caixa" onChange={(e) => mudar(i, "quantidade", e.target.value)} /></div>
          </div>
          <div style={{ height: 10 }} />
          <label>Modo de usar</label>
          <textarea rows={2} value={it.posologia} placeholder="Ex.: Tomar 1 comprimido por via oral a cada 6 horas, se dor, por até 3 dias." onChange={(e) => mudar(i, "posologia", e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn-sec" style={{ marginTop: 12 }} onClick={() => setItens([...itens, { ...VAZIO }])}>Adicionar medicamento</button>

      <div className="card" style={{ marginTop: 12 }}>
        <label>Orientações ao paciente (opcional)</label>
        <textarea rows={2} value={orientacoes} onChange={(e) => { setOrientacoes(e.target.value); setPronto(false); }} />
      </div>

      {restritos.length > 0 && (
        <div className="erro" style={{ marginTop: 12 }}>
          <b>Não pode ser assinado pelo gov.br: {restritos.join(", ")}.</b><br />
          Medicamentos de controle especial exigem certificado ICP-Brasil, e antimicrobianos e agonistas de GLP-1 exigem um serviço integrado à Anvisa (SNCR). Emita esta receita na{" "}
          <a href="https://prescricaoeletronica.cfm.org.br" target="_blank" rel="noopener noreferrer">Prescrição Eletrônica do CFM</a>, que é gratuita, ou em papel.
        </div>
      )}

      <label className="check" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14 }}>
        <input type="checkbox" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 20px" }} />
        <span style={{ fontSize: 14 }}>Declaro que conferi a receita e que ela não contém medicamento de controle especial, antimicrobiano ou agonista de GLP-1. A lista de bloqueio do Auris é um apoio e não é completa.</span>
      </label>

      {erro && <div className="erro" style={{ marginTop: 12 }}>{erro}</div>}
      <button type="button" disabled={gerando} style={{ width: "100%", marginTop: 14 }} onClick={gerar}>{gerando ? "Gerando..." : "1. Gerar PDF da receita"}</button>

      {pronto && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ok" style={{ marginBottom: 14 }}>PDF baixado. Sem a assinatura, ele ainda não vale como receita.</div>
          <b>2. Assinar no gov.br</b>
          <p className="muted" style={{ margin: "4px 0 10px" }}>Entre com a sua conta gov.br, escolha o PDF que acabou de baixar, posicione a assinatura e confirme com o código do aplicativo. Depois, baixe o arquivo assinado.</p>
          <a className="btn" href="https://assinador.iti.br" target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center" }}>Abrir o Portal de Assinatura gov.br</a>
          <div style={{ height: 16 }} />
          <b>3. Enviar ao paciente</b>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Envie o PDF assinado por WhatsApp ou e-mail. A farmácia confere a assinatura em{" "}
            <a href="https://validar.iti.gov.br" target="_blank" rel="noopener noreferrer">validar.iti.gov.br</a>.
          </p>
        </div>
      )}
    </>
  );
}
