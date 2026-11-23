import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { RESERVADOS } from "@/lib/agenda";

/** Endereços antigos do Auris: as páginas passam a abrir no domínio oficial (as rotas /api continuam respondendo, para avisos de pagamento antigos). */
const ENDERECOS_ANTIGOS = new Set(["aurisclinica.vercel.app", "sistema-medico-kappa.vercel.app"]);
const DOMINIO_OFICIAL = "https://www.aurismed.com.br";

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (ENDERECOS_ANTIGOS.has(host) && !req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, DOMINIO_OFICIAL), 308);
  }
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const segmentos = req.nextUrl.pathname.split("/").filter(Boolean);
  // Página pública do profissional: aurisclinica.vercel.app/<link-do-profissional>
  const paginaProfissional = segmentos.length === 1 && !RESERVADOS.has(segmentos[0].toLowerCase());
  const informativa = ["/privacidade", "/termos", "/ia"].includes(req.nextUrl.pathname);
  const publica = paginaProfissional || informativa || req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/auth") || req.nextUrl.pathname.startsWith("/nova-senha") || req.nextUrl.pathname.startsWith("/t/") || req.nextUrl.pathname.startsWith("/p/");
  if (!user && !publica && !req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
