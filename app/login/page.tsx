"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PROFISSOES, ESPECIALIDADES_MEDICAS } from "@/lib/modelos";
import ConfirmarEmail, { linkConfirmacao } from "@/components/ConfirmarEmail";

function traduzir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado. Use “Confirmar meu e-mail”, abaixo.";
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Se é sua primeira vez no Auris, crie sua conta na aba “Criar conta”, acima.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Clique em “Já tenho conta” e entre.";
  if (m.includes("rate limit")) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password")) return "Senha inválida: use no mínimo 8 caracteres.";
  return msg;
}

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [profissao, setProfissao] = useState(PROFISSOES[0]);
  const [especialidade, setEspecialidade] = useState("Clínica médica");
  const [conselho, setConselho] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  // Confirmação do e-mail: depois do cadastro, ou ao tentar entrar sem ter confirmado.
  const [confirmar, setConfirmar] = useState<null | { email: string; senha?: string; recemEnviado: boolean }>(null);
  const entrarNoSistema = () => { router.push("/"); router.refresh(); };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("confirmado") === "1")
      setMsg({ tipo: "ok", texto: "E-mail confirmado! Agora entre com seu e-mail e senha." });
    if (q.get("link") === "outro-aparelho-senha")
      setMsg({ tipo: "erro", texto: "Abra o link de nova senha no mesmo aparelho em que você o pediu, ou peça um novo link aqui." });
    if (q.get("link") === "expirado")
      setMsg({ tipo: "erro", texto: "Este link expirou ou já foi usado. Se você já confirmou o e-mail, é só entrar. Senão, digite o e-mail e use “Confirmar meu e-mail” para receber um novo código." });
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    const sb = supabaseBrowser();
    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error && /not confirmed/i.test(error.message)) { setConfirmar({ email: email.trim(), senha, recemEnviado: false }); return; }
        if (error) throw error;
        entrarNoSistema();
      } else {
        const esp = profissao === "Médico(a)" ? especialidade : especialidade || profissao;
        const emailLimpo = email.trim().toLowerCase();
        const { data, error } = await sb.auth.signUp({
          email: emailLimpo,
          password: senha,
          options: {
            data: { nome, profissao, especialidade: esp, conselho },
            emailRedirectTo: linkConfirmacao(),
          },
        });
        if (error) throw error;
        // E-mail que já tem conta confirmada: o Supabase não avisa com erro, devolve o usuário sem identidades.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setMsg({ tipo: "erro", texto: "Este e-mail já tem conta no Auris. Entre com a sua senha ou use “Esqueci minha senha”." });
          setModo("entrar");
          return;
        }
        if (data.session) entrarNoSistema();
        else setConfirmar({ email: emailLimpo, senha, recemEnviado: true });
      }
    } catch (err) {
      setMsg({ tipo: "erro", texto: traduzir(err instanceof Error ? err.message : "Erro ao entrar.") });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="login-marca">
        <span className="marca-icone" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M19 11a7 7 0 0 1-14 0" /></svg>
        </span>
      </div>
      <h1>Auris</h1>
      <p className="login-desc">Registro clínico por voz</p>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>Registre o atendimento falando. A IA organiza, você revisa, aprova e gera o PDF.</p>
      {confirmar ? (
        <ConfirmarEmail email={confirmar.email} senha={confirmar.senha} recemEnviado={confirmar.recemEnviado}
          onConfirmado={entrarNoSistema}
          onTrocarEmail={() => { setConfirmar(null); setModo("cadastrar"); setMsg({ tipo: "ok", texto: "Corrija o e-mail e crie a conta de novo." }); }} />
      ) : <>
      <div className="abas-login" role="tablist">
        <button type="button" role="tab" aria-selected={modo === "entrar"} className={modo === "entrar" ? "ativa" : ""} onClick={() => { setModo("entrar"); setMsg(null); }}>Entrar</button>
        <button type="button" role="tab" aria-selected={modo === "cadastrar"} className={modo === "cadastrar" ? "ativa" : ""} onClick={() => { setModo("cadastrar"); setMsg(null); }}>Criar conta</button>
      </div>
      <form className="card" onSubmit={enviar}>
        {modo === "cadastrar" && (
          <>
            <label>Nome completo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            <div className="grid" style={{ marginTop: 10 }}>
              <div>
                <label>Profissão</label>
                <select value={profissao} onChange={(e) => { setProfissao(e.target.value); setEspecialidade(e.target.value === "Médico(a)" ? "Clínica médica" : ""); }}>
                  {PROFISSOES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label>Especialidade</label>
                {profissao === "Médico(a)" ? (
                  <select value={especialidade} onChange={(e) => setEspecialidade(e.target.value)}>
                    {ESPECIALIDADES_MEDICAS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <input placeholder="Opcional" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
                )}
              </div>
              <div>
                <label>Registro no conselho (ex.: CRM-PA 12345)</label>
                <input value={conselho} onChange={(e) => setConselho(e.target.value)} />
              </div>
            </div>
            <div style={{ height: 10 }} />
          </>
        )}
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div style={{ height: 10 }} />
        <label>Senha (mínimo 8 caracteres)</label>
        <input type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <div style={{ height: 14 }} />
        {msg && <div className={msg.tipo} style={{ marginBottom: 10 }}>{msg.texto}</div>}
        {msg?.tipo === "erro" && modo === "entrar" && msg.texto.includes("primeira vez") && (
          <button type="button" className="btn-sec" style={{ width: "100%", marginBottom: 10 }} onClick={() => { setModo("cadastrar"); setMsg(null); }}>Criar minha conta</button>
        )}
        <button type="submit" disabled={carregando} style={{ width: "100%" }}>
          {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      {modo === "entrar" && <div className="links-login">
      {modo === "entrar" && (
        <button
          className="link"
          onClick={async () => {
            if (!email.trim()) return setMsg({ tipo: "erro", texto: "Digite seu e-mail acima e clique de novo em “Confirmar meu e-mail”." });
            const { error } = await supabaseBrowser().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: linkConfirmacao() } });
            if (error && !/rate|seconds|security/i.test(error.message)) return setMsg({ tipo: "erro", texto: /already|confirmed/i.test(error.message) ? "Este e-mail já está confirmado. É só entrar com a sua senha." : traduzir(error.message) });
            setConfirmar({ email: email.trim(), senha: senha || undefined, recemEnviado: !error });
          }}
        >
          Confirmar meu e-mail
        </button>
      )}
      {modo === "entrar" && (
        <button
          className="link"
          onClick={async () => {
            if (!email) return setMsg({ tipo: "erro", texto: "Digite seu e-mail acima e clique de novo em “Esqueci minha senha”." });
            const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/confirm?type=recovery` });
            setMsg(error ? { tipo: "erro", texto: traduzir(error.message) } : { tipo: "ok", texto: "Enviamos um link para criar uma nova senha. Veja sua caixa de entrada e o spam." });
          }}
        >
          Esqueci minha senha
        </button>
      )}
      </div>}
      <button className="link" style={{ display: "block", margin: "14px auto 0" }} onClick={() => { setModo(modo === "entrar" ? "cadastrar" : "entrar"); setMsg(null); }}>
        {modo === "entrar" ? "Primeira vez aqui? Criar conta" : "Já tenho conta. Entrar"}
      </button>
      {modo === "cadastrar" && <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>Ao criar a conta, você concorda com os <a href="/termos" target="_blank" rel="noreferrer">Termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer">Política de privacidade</a>.</p>}
      </>}
    </>
  );
}
