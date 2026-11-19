"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Formulário seguro de cartão do Mercado Pago (Card Payment Brick), só para gerar o token do cartão.
 * O número do cartão nunca passa pelo Auris.
 */
export type DadosCartao = { token: string; payment_method_id: string; issuer_id?: string; payer: { email: string; identification?: { type: string; number: string } }; aparelho?: string };
type Brick = { unmount: () => void };
type MPGlobal = new (key: string, opts: { locale: string }) => { bricks: () => { create: (tipo: string, id: string, cfg: unknown) => Promise<Brick> } };

/** Script antifraude do Mercado Pago: identifica o aparelho (MP_DEVICE_SESSION_ID) e aumenta a aprovação. */
function carregarSeguranca() {
  if (document.querySelector("script[data-mp-security]")) return;
  const s = Object.assign(document.createElement("script"), { src: "https://www.mercadopago.com/v2/security.js", async: true });
  s.setAttribute("view", "checkout");
  s.dataset.mpSecurity = "1";
  document.head.appendChild(s);
}
export const idDoAparelho = () => (window as unknown as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID || "";

function carregarSdk(): Promise<void> {
  carregarSeguranca();
  const w = window as unknown as { MercadoPago?: MPGlobal };
  if (w.MercadoPago) return Promise.resolve();
  return new Promise((ok, falha) => {
    const ja = document.querySelector<HTMLScriptElement>("script[data-mp-sdk]");
    const s = ja || Object.assign(document.createElement("script"), { src: "https://sdk.mercadopago.com/js/v2", async: true });
    s.dataset.mpSdk = "1";
    s.addEventListener("load", () => ok());
    s.addEventListener("error", () => falha(new Error("sdk")));
    if (!ja) document.head.appendChild(s);
  });
}

export default function CartaoBrick({ id, publicKey, valor, email, rotulo, onCartao }: {
  id: string; publicKey: string; valor: number; email?: string; rotulo: string;
  onCartao: (d: DadosCartao) => Promise<string | null>; // devolve mensagem de erro, ou null se deu certo
}) {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState("");
  const cb = useRef(onCartao);
  cb.current = onCartao;

  useEffect(() => {
    let brick: Brick | null = null;
    let vivo = true;
    carregarSdk().then(async () => {
      const MP = (window as unknown as { MercadoPago?: MPGlobal }).MercadoPago;
      if (!vivo || !MP) return;
      brick = await new MP(publicKey, { locale: "pt-BR" }).bricks().create("cardPayment", id, {
        initialization: { amount: valor, ...(email ? { payer: { email } } : {}) },
        customization: {
          paymentMethods: { minInstallments: 1, maxInstallments: 1, types: { excluded: ["debit_card", "prepaid_card"] } },
          visual: { hideFormTitle: true, texts: { formSubmit: rotulo }, style: { theme: "default", customVariables: { baseColor: "#0f5c55", fontSizeMedium: "15px" } } },
        },
        callbacks: {
          onReady: () => vivo && setPronto(true),
          onError: () => setErro("Não foi possível carregar o formulário do cartão. Recarregue a página."),
          onSubmit: async (d: DadosCartao) => {
            setErro("");
            const msg = await cb.current({ ...d, aparelho: idDoAparelho() });
            if (msg) { setErro(msg); throw new Error("recusado"); }
          },
        },
      });
    }).catch(() => setErro("Não foi possível carregar o formulário do cartão. Verifique a internet."));
    return () => { vivo = false; brick?.unmount(); };
  }, [id, publicKey, valor, email, rotulo]);

  return (
    <div>
      {!pronto && !erro && <p className="muted">Carregando o formulário seguro do cartão.</p>}
      <div id={id} />
      {erro && <div className="erro" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
    </div>
  );
}
