import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { correoPermitido, SUPABASE_LLAVE_PUBLICA, SUPABASE_URL, supabaseConfigurado } from "./lib/supabase/config";

// /api/correos se protege con su propia clave (la usa el script de Gmail, que no tiene sesión)
const PUBLICAS = ["/login", "/auth", "/acceso-denegado", "/api/cron", "/api/correos"];

// Renueva la sesión de Supabase en cada visita y deja pasar solo al correo permitido
export async function proxy(req: NextRequest) {
  if (!supabaseConfigurado()) return NextResponse.next();

  let respuesta = NextResponse.next({ request: req });
  const db = createServerClient(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        respuesta = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  // getClaims verifica la sesión localmente (sin ir al servidor de Supabase), y la renueva si hace falta
  const { data } = await db.auth.getClaims();
  const ruta = req.nextUrl.pathname;
  if (PUBLICAS.some((p) => ruta.startsWith(p))) return respuesta;

  if (!data?.claims) return NextResponse.redirect(new URL("/login", req.url));
  if (!correoPermitido(data.claims.email as string | undefined)) return NextResponse.redirect(new URL("/acceso-denegado", req.url));
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|icono-|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
