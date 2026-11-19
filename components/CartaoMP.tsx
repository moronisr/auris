"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Formulário de cartão seguro do Mercado Pago (Card Payment Brick).
 * Os dados do cartão são digitados em campos do próprio Mercado Pago e viram um token;
 * o Auris nunca vê o número do cartão. O paciente não precisa ter conta no Mercado Pago.
 */
type Props = {
  codigo: string; publicKey: string; valor: number; metodo: "credito" | "debito";
  onAprovado: () => void; onErro: (msg: string) => void;
};

type Brick = { unmount: () => void };
type MPGlobal = new (key: string, opts: { locale: string }) => { bricks: () => { create: (tipo: string, id: string, cfg: unknown) => Promise<Brick> } };
declare global { interface Window { MercadoPago?: MPGlobal } }

function carregarSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((ok, falha) => {
    const ja = document.querySelector<HTMLScriptElement>('script[data-mp-sdk]');
    const s = ja || Object.assign(document.createElement("script"), { src: "https://sdk.mercadopago.com/js/v2", async: true });
    s.dataset.mpSdk = "1";
    s.addEventListener("load", () => ok());
    s.addEventListener("error", () => falha(new Error("sdk")));
    if (!ja) document.head.appendChild(s);
  });
}

export default function CartaoMP({ codigo, publicKey, valor, metodo, onAprovado, onErro }: Props) {
  const id = `cartao-mp-${metodo}`;
  const [pronto, setPronto] = useState(false);
  const chave = useRef(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
  const cb = useRef({ onAprovado, onErro });
  cb.current = { onAprovado, onErro };

  useEffect(() => {
    let brick: Brick | null = null;
    let vivo = true;
    carregarSdk().then(async () => {
      if (!vivo || !window.MercadoPago) return;
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
      brick = await mp.bricks().create("cardPayment", id, {
        initialization: { amount: valor },
        customization: {
          paymentMethods: {
            minInstallments: 1, maxInstallments: 1,
            types: { excluded: metodo === "credito" ? ["debit_card", "prepaid_card"] : ["credit_card"] },
          },
          visual: { hideFormTitle: true, style: { theme: "default", customVariables: { baseColor: "#0f5c55", fontSizeMedium: "15px" } } },
        },
        callbacks: {
          onReady: () => vivo && setPronto(true),
          onError: () => cb.current.onErro("Não foi possível carregar o formulário do cartão. Recarregue a página ou pague com Pix."),
          onSubmit: async (dados: { token: string; payment_method_id: string; issuer_id?: string; payer: { email: string; identification?: { type: string; number: string } } }) => {
            const r = await fetch("/api/pagamento/cartao", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codigo, metodo, chave: chave.current, cartao: { token: dados.token, payment_method_id: dados.payment_method_id, issuer_id: dados.issuer_id, payer: dados.payer } }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.status === "approved") { cb.current.onAprovado(); return; }
            // Nova tentativa usa outra chave: o cartão recusado não é cobrado, e uma nova tentativa é um novo pedido.
            chave.current = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            cb.current.onErro(d.erro || "O pagamento não foi aprovado. Confira os dados ou pague com Pix.");
            throw new Error("recusado");
          },
        },
      });
    }).catch(() => cb.current.onErro("Não foi possível carregar o formulário do cartão. Verifique a internet ou pague com Pix."));
    return () => { vivo = false; brick?.unmount(); };
  }, [codigo, publicKey, valor, metodo, id]);

  return (
    <div>
      {!pronto && <p className="muted">Carregando o formulário seguro do cartão.</p>}
      <div id={id} />
    </div>
  );
}
