import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { CATEGORIAS_INICIALES } from "@/lib/categorizar";
import { repoSupabase } from "@/lib/datos/supabase";
import { clienteServidor } from "@/lib/supabase/servidor";

// Aquí llega el enlace mágico del correo: se canjea por una sesión
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const db = await clienteServidor();
  const codigo = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const resultado = codigo
    ? await db.auth.exchangeCodeForSession(codigo)
    : tokenHash && tipo
      ? await db.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { data: { user: null }, error: { message: "Enlace incompleto" } };

  if (resultado.error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(resultado.error.message)}`, url));

  // La primera vez que entras se crean las categorías iniciales (sin presupuesto)
  const usuario = resultado.data.user;
  if (usuario) {
    const repo = repoSupabase(db, usuario.id);
    if ((await repo.categorias()).length === 0) {
      await repo.crearCategorias(CATEGORIAS_INICIALES.map((c) => ({ ...c, color_neutro: "#737373" })));
    }
  }
  return NextResponse.redirect(new URL("/", url));
}
