"use server";
import { redirect } from "next/navigation";
import { mensajeDeEnlace, tipoDeEnlace, tokenValido } from "@/lib/enlace-correo";
import { clienteServidor } from "@/lib/supabase/servidor";

// Nube F5 · Se canjea el enlace del correo solo cuando la persona toca el botón (no al abrirlo)
export async function confirmarEnlace(formulario: FormData) {
  const token = String(formulario.get("token_hash") ?? "");
  const tipo = tipoDeEnlace(String(formulario.get("type") ?? ""));
  if (!tokenValido(token) || !tipo) redirect(`/login?error=${encodeURIComponent(mensajeDeEnlace(null))}`);
  const db = await clienteServidor();
  const { error } = await db.auth.verifyOtp({ token_hash: token, type: tipo });
  if (error) {
    // Si ya tenía la sesión abierta (por ejemplo, tocó el enlace dos veces), entra sin mostrar el error
    const { data } = await db.auth.getClaims();
    if (!data?.claims) redirect(`/login?error=${encodeURIComponent(mensajeDeEnlace(error))}`);
  }
  redirect("/auth/callback");
}
