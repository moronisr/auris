"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Página aberta pelo link de confirmação do e-mail. Confirma no navegador da pessoa e já entra no Auris.
 * Se o link já tiver sido usado (por ela mesma, em outro aparelho, ou pelo código), explica e leva ao login,
 * em vez de mostrar um erro sem saída.
 */
export default function ConfirmarLink() {
  const [estado, setEstado] = useState<"confirmando" | "ok" | "usado" | "erro">("confirmando");
  const [senha, setSenha] = useState(false);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const token_hash = q.get("token_hash");
      const type = (q.get("type") || "email") as EmailOtpType;
      const sb = supabaseBrowser();
      const recuperacao = type === "recovery";
      setSenha(recuperacao);
      if (!token_hash) return setEstado("erro");
      if (recuperacao) {
        const { error } = await sb.auth.verifyOtp({ token_hash, type: "recovery" });
        if (!error) { window.location.href = "/nova-senha"; return; }
        return setEstado("usado");
      }
      let { error } = await sb.auth.verifyOtp({ token_hash, type });
      if (error && type !== "email") ({ error } = await sb.auth.verifyOtp({ token_hash, type: "email" }));
      if (!error) {
        setEstado("ok");
        setTimeout(() => { window.location.href = "/?bemvindo=1"; }, 1200);
        return;
      }
      // Link já usado: se a sessão já existe neste navegador, entra; senão, orienta a entrar.
      const { data } = await sb.auth.getSession();
      if (data.session) { window.location.href = "/"; return; }
      setEstado(/expired|invalid|used/i.test(error.message) ? "usado" : "erro");
    })();
  }, []);

  return (
    <div className="card" style={{ marginTop: 40, textAlign: "center" }}>
      {estado === "confirmando" && <p style={{ margin: 0 }}>{senha ? "Abrindo a troca de senha." : "Confirmando o seu e-mail."}</p>}
      {senha && estado === "usado" && (
        <>
          <h1 style={{ marginTop: 0 }}>Este link de nova senha não vale mais</h1>
          <p>Ele já foi usado ou passou do prazo. Peça um novo na tela de entrada, em "Esqueci minha senha", e use sempre o e-mail mais recente.</p>
          <a className="btn" href="/login" style={{ display: "inline-block", marginTop: 6 }}>Pedir novo link</a>
        </>
      )}
      {estado === "ok" && (
        <>
          <h1 style={{ marginTop: 0 }}>E-mail confirmado</h1>
          <p className="muted">Entrando no Auris.</p>
        </>
      )}
      {!senha && estado === "usado" && (
        <>
          <h1 style={{ marginTop: 0 }}>Este link já foi usado</h1>
          <p>Se você já confirmou o e-mail (pelo código ou em outro aparelho), está tudo certo: é só entrar com o seu e-mail e senha.</p>
          <p className="muted">Se ainda não confirmou, entre com o e-mail e a senha que o Auris envia um novo código.</p>
          <a className="btn" href="/login" style={{ display: "inline-block", marginTop: 6 }}>Entrar no Auris</a>
        </>
      )}
      {estado === "erro" && (
        <>
          <h1 style={{ marginTop: 0 }}>Não foi possível confirmar agora</h1>
          <p>Entre com o seu e-mail e senha. Se o e-mail ainda não estiver confirmado, o Auris mostra a opção de receber um novo código.</p>
          <a className="btn" href="/login" style={{ display: "inline-block", marginTop: 6 }}>Entrar no Auris</a>
        </>
      )}
    </div>
  );
}
