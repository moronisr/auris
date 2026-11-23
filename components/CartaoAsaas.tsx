"use client";

import { useState } from "react";

/**
 * Formulário de cartão do plano do Auris (cobrança pelo Asaas).
 * Os dados vão direto, por conexão criptografada, para o servidor do Auris, que os repassa ao Asaas sem gravar.
 */
export type CartaoForm = {
  nome: string; numero: string; mes: string; ano: string; cvv: string;
  titular: { nome: string; email: string; cpf: string; cep: string; numeroEndereco: string; celular: string };
  cpfProfissional?: string;
};

const dig = (s: string) => s.replace(/\D/g, "");
const fmtNumero = (s: string) => dig(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtValidade = (s: string) => { const d = dig(s).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
const fmtCpf = (s: string) => dig(s).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
const fmtCep = (s: string) => dig(s).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const fmtCel = (s: string) => { const d = dig(s).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a)); };

export default function CartaoAsaas({ email, rotulo, permitirOutroTitular, onCartao }: {
  email?: string;
  rotulo: string;
  permitirOutroTitular?: boolean;
  onCartao: (c: CartaoForm) => Promise<string | null>;
}) {
  const [numero, setNumero] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [celular, setCelular] = useState("");
  const [outro, setOutro] = useState(false);
  const [emailTitular, setEmailTitular] = useState("");
  const [cpfProf, setCpfProf] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  function conferir(): string | null {
    const n = dig(numero);
    if (n.length < 13) return "Confira o número do cartão.";
    const [mm, aa] = validade.split("/");
    if (!(Number(mm) >= 1 && Number(mm) <= 12) || (aa || "").length !== 2) return "Confira a validade do cartão (mês/ano).";
    if (!/^\d{3,4}$/.test(cvv)) return "Confira o código de segurança.";
    if (nome.trim().length < 3) return "Informe o nome como está no cartão.";
    if (dig(cpf).length !== 11) return "Confira o CPF do titular do cartão.";
    if (outro && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTitular.trim())) return "Informe o e-mail do titular do cartão.";
    if (outro && dig(cpfProf).length !== 11) return "Confira o seu CPF.";
    if (dig(cep).length !== 8) return "Confira o CEP do titular.";
    if (!numeroEndereco.trim()) return "Informe o número do endereço do titular.";
    if (dig(celular).length < 10) return "Confira o celular do titular, com DDD.";
    return null;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const problema = conferir();
    if (problema) { setErro(problema); return; }
    setErro(""); setEnviando(true);
    const [mm, aa] = validade.split("/");
    const msg = await onCartao({
      nome: nome.trim(), numero: dig(numero), mes: mm, ano: `20${aa}`, cvv,
      titular: { nome: nome.trim(), email: (outro ? emailTitular : email || "").trim(), cpf: dig(cpf), cep: dig(cep), numeroEndereco: numeroEndereco.trim(), celular: dig(celular) },
      ...(outro ? { cpfProfissional: dig(cpfProf) } : {}),
    }).catch(() => "Não foi possível enviar agora. Verifique a internet e tente de novo.");
    setEnviando(false);
    if (msg) setErro(msg);
    else { setCvv(""); setNumero(""); }
  }

  const duas = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as const;
  return (
    <form onSubmit={enviar} autoComplete="on" noValidate>
      {permitirOutroTitular && (
        <label className="aceite">
          <input type="checkbox" checked={outro} onChange={(e) => setOutro(e.target.checked)} />
          <span><b>O cartão está no nome de outra pessoa</b> (cônjuge, familiar ou sócio)</span>
        </label>
      )}
      <label htmlFor="cc-numero">Número do cartão</label>
      <input id="cc-numero" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={numero} onChange={(e) => setNumero(fmtNumero(e.target.value))} />
      <div style={duas}>
        <div>
          <label htmlFor="cc-validade">Validade</label>
          <input id="cc-validade" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={validade} onChange={(e) => setValidade(fmtValidade(e.target.value))} />
        </div>
        <div>
          <label htmlFor="cc-cvv">Código de segurança</label>
          <input id="cc-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" value={cvv} onChange={(e) => setCvv(dig(e.target.value).slice(0, 4))} />
        </div>
      </div>
      <label htmlFor="cc-nome">Nome do titular, como está no cartão</label>
      <input id="cc-nome" autoComplete="cc-name" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} />
      <label htmlFor="cc-cpf">CPF do titular</label>
      <input id="cc-cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(fmtCpf(e.target.value))} />
      {outro && (
        <>
          <label htmlFor="cc-email">E-mail do titular</label>
          <input id="cc-email" type="email" inputMode="email" autoComplete="off" value={emailTitular} onChange={(e) => setEmailTitular(e.target.value)} />
          <label htmlFor="cc-cpf-prof">Seu CPF (profissional)</label>
          <input id="cc-cpf-prof" inputMode="numeric" placeholder="000.000.000-00" value={cpfProf} onChange={(e) => setCpfProf(fmtCpf(e.target.value))} />
        </>
      )}
      <div style={duas}>
        <div>
          <label htmlFor="cc-cep">CEP do titular</label>
          <input id="cc-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => setCep(fmtCep(e.target.value))} />
        </div>
        <div>
          <label htmlFor="cc-num-end">Número do endereço</label>
          <input id="cc-num-end" autoComplete="off" value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value.slice(0, 20))} />
        </div>
      </div>
      <label htmlFor="cc-cel">Celular do titular, com DDD</label>
      <input id="cc-cel" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(91) 90000-0000" value={celular} onChange={(e) => setCelular(fmtCel(e.target.value))} />
      <p className="muted" style={{ marginTop: 6 }}>CEP, número e celular são pedidos pelo banco para confirmar que o cartão é do titular.</p>
      <button type="submit" disabled={enviando} style={{ marginTop: 10, width: "100%" }}>{enviando ? "Processando" : rotulo}</button>
      {erro && <div className="erro" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
    </form>
  );
}
