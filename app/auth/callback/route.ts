import { NextResponse, type NextRequest } from "next/server";
import { CATEGORIAS_INICIALES } from "@/lib/categorizar";
import { repoSupabase } from "@/lib/datos/supabase";
import { destinoConfirmar, mensajeDeEnlace, tipoDeEnlace, tokenValido } from "@/lib/enlace-correo";
import { clienteServidor } from "@/lib/supabase/servidor";

const aLaEntrada = (url: URL, mensaje: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(mensaje)}`, url));

// Aquí llegan los enlaces de los correos de la cuenta.
// - token_hash (los correos de TAOS Nube): se manda a /auth/confirmar, que pide un toque antes de canjearlo.
// - code (enlaces viejos con PKCE): se canjea; si falla pero ya hay sesión abierta, se entra sin mostrar el error.
// - sin nada, con sesión abierta (viene de /auth/confirmar): se termina de preparar la cuenta y se entra.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash !== null) {
    const tipo = tipoDeEnlace(url.searchParams.get("type"));
    if (!tokenValido(tokenHash) || !tipo) return aLaEntrada(url, mensajeDeEnlace(null));
    return NextResponse.redirect(new URL(destinoConfirmar(tokenHash, tipo), url));
  }

  const db = await clienteServidor();
  const codigo = url.searchParams.get("code");
  const canje = codigo ? await db.auth.exchangeCodeForSession(codigo) : null;
  const { data } = await db.auth.getClaims();
  const usuario = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!usuario) {
    const falla = canje?.error ?? { code: url.searchParams.get("error_code") ?? "", message: url.searchParams.get("error_description") ?? "" };
    return aLaEntrada(url, mensajeDeEnlace(falla));
  }

  // La primera vez que entras se crean las categorías iniciales (sin presupuesto)
  const repo = repoSupabase(db, usuario);
  if ((await repo.categorias()).length === 0) {
    await repo.crearCategorias(CATEGORIAS_INICIALES.map((c) => ({ ...c, color_neutro: "#737373" })));
  }
  return NextResponse.redirect(new URL("/", url));
}
