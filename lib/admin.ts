import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave de serviço: só no servidor, para páginas públicas e confirmação de pagamento. */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false } });
}
