import { NextResponse } from "next/server";

/** Rota antiga: encaminha para /auth/confirm mantendo os parâmetros. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/auth/confirm${url.search}`, url.origin));
}
