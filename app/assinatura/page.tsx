import { redirect } from "next/navigation";

/** Endereço antigo: a página agora se chama Finanças. */
export default function Assinatura() {
  redirect("/financas");
}
