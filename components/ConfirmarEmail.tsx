"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Tela de confirmação do e-mail, depois do cadastro (ou ao tentar entrar sem ter confirmado).
 * Três caminhos que levam ao mesmo lugar, para ninguém ficar preso:
 *  1. Digitar o código de 6 dígitos do e-mail (funciona em qualquer aparelho).
 *  2. Clicar no link do e-mail (em qualquer aparelho).
 *  3. Se confirmou pelo link em outro aparelho: "Já confirmei" entra direto, sem digitar nada de novo.
 * A tela também tenta entrar sozinha quando a pessoa volta para ela (depois de abrir o e-mail).
 */
const ESPERA = 60;

export function linkConfirmacao(): string {
  return `${window.location.origin}/auth/confirm`;
}

export default function ConfirmarEmail({ email, senha, onTrocarEmail, onConfirmado, recemEnviado = true }: {
  email: string; senha?: string; onTrocarEmail: () => void; onConfirmado: () => void; recemEnviado?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(recemEnviado ? ESPERA : 0);
  const entrando = useRef(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  /** Se o e-mail já foi confirmado (por exemplo, pelo link no celular), entra com a senha digitada no cadastro. */
  const tentarEntrar = useCallback(async (manual: boolean): Promise<boolean> => {
    if (entrando.current) return false;
    const sb = supabaseBrowser();
    const { data: s } = await sb.auth.getSession();
    if (s.session) { onConfirmado(); return true; }
    if (!senha) {
      if (manual) setMsg({ tipo: "erro", texto: "Volte e entre com o seu e-mail e senha." });
      return false;
    }
    entrando.current = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    entrando.current = false;
    if (!error) { onConfirmado(); return true; }
    if (manual) setMsg({ tipo: "erro", texto: /not confirmed/i.test(error.message)
      ? "O e-mail ainda não aparece como confirmado. Clique no link do e-mail ou digite o código acima."
      : "Não foi possível entrar agora. Tente de novo em instantes." });
    return false;
  }, [email, senha, onConfirmado]);

  // Quando a pessoa volta para esta aba (depois de confirmar no e-mail), tenta entrar sozinha.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") tentarEntrar(false); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => { document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); };
  }, [tentarEntrar]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) return setMsg({ tipo: "erro", texto: "Digite os 6 números do código." });
    setEnviando(true); setMsg(null);
    const sb = supabaseBrowser();
    let { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) ({ error } = await sb.auth.verifyOtp({ email, token, type: "signup" }));
    setEnviando(false);
    if (!error) {
      setMsg({ tipo: "ok", texto: "E-mail confirmado. Entrando no Auris." });
      return setTimeout(onConfirmado, 700);
    }
    // O código pode já ter sido usado pelo link: se a conta estiver confirmada, entra.
    if (await tentarEntrar(false)) return;
    setMsg({ tipo: "erro", texto: /expired|invalid/i.test(error.message)
      ? "Código incorreto ou vencido. Confira os números ou peça um novo código abaixo."
      : "Não foi possível confirmar agora. Tente de novo em instantes." });
  }

  async function reenviar() {
    setEnviando(true); setMsg(null);
    const { error } = await supabaseBrowser().auth.resend({ type: "signup", email, options: { emailRedirectTo: linkConfirmacao() } });
    setEnviando(false);
    setEspera(ESPERA);
    if (!error) return setMsg({ tipo: "ok", texto: "Enviamos um novo e-mail com outro código. O código anterior deixa de valer." });
    if (/already|confirmed/i.test(error.message)) { await tentarEntrar(true); return; }
    setMsg({ tipo: "erro", texto: /rate|seconds|security/i.test(error.message)
      ? "Aguarde um pouco antes de pedir outro e-mail."
      : "Não foi possível reenviar agora. Tente de novo em instantes." });
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Confirme o seu e-mail</h2>
      <p style={{ marginTop: 0 }}>Enviamos um e-mail para <b>{email}</b> com um código de 6 números e um link.</p>
      <form onSubmit={confirmar}>
        <label htmlFor="codigo-email">Código de confirmação</label>
        <input id="codigo-email" className="campo-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="000000"
          value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} autoFocus />
        <button type="submit" disabled={enviando || codigo.length < 6} style={{ width: "100%", marginTop: 10 }}>{enviando ? "Confirmando" : "Confirmar e entrar"}</button>
      </form>
      {msg && <div className={msg.tipo} role="status" style={{ marginTop: 10 }}>{msg.texto}</div>}
      <p className="muted" style={{ marginBottom: 6 }}>Também pode clicar no botão do e-mail, até pelo celular. Se fizer isso, volte aqui: esta tela entra sozinha.</p>
      {senha && <button type="button" className="btn-sec" style={{ width: "100%" }} onClick={() => tentarEntrar(true)}>Já confirmei pelo link</button>}
      <div className="links-login" style={{ marginTop: 8 }}>
        <button type="button" className="link" disabled={enviando || espera > 0} onClick={reenviar}>{espera > 0 ? `Reenviar e-mail em ${espera}s` : "Reenviar e-mail"}</button>
        <button type="button" className="link" onClick={onTrocarEmail}>Corrigir o e-mail</button>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>Não chegou? Veja as pastas Spam e Promoções. O remetente é Auris.</p>
    </div>
  );
}
