"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { correoPermitido } from "@/lib/supabase/config";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Resultado } from "@/lib/acciones";

// Entrar con correo y contraseña (solo el correo permitido)
export async function entrarConContrasena(formulario: FormData) {
  const correo = String(formulario.get("correo") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");
  if (!correoPermitido(correo)) redirect(`/acceso-denegado?correo=${encodeURIComponent(correo)}`);
  const db = await clienteServidor();
  const { error } = await db.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) {
    const mensaje = /invalid login/i.test(error.message)
      ? "Correo o contraseña incorrectos. Si todavía no creas tu contraseña, entra con el enlace por correo y créala en Ajustes."
      : error.message;
    redirect(`/login?error=${encodeURIComponent(mensaje)}`);
  }
  redirect("/");
}

export async function enviarEnlace(formulario: FormData) {
  const correo = String(formulario.get("correo") ?? "").trim();
  // Solo se envía el enlace al correo permitido; a cualquier otro se le niega el acceso
  if (!correoPermitido(correo)) redirect(`/acceso-denegado?correo=${encodeURIComponent(correo)}`);
  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const db = await clienteServidor();
  const { error } = await db.auth.signInWithOtp({
    email: correo,
    options: { emailRedirectTo: `${origen}/auth/callback` },
  });
  if (error) {
    const mensaje = /rate limit/i.test(error.message)
      ? "Ya se enviaron varios enlaces seguidos. Espera una hora o usa el último correo que te llegó."
      : error.message;
    redirect(`/login?error=${encodeURIComponent(mensaje)}`);
  }
  redirect("/login?enviado=1");
}

// Crear o cambiar la contraseña de la sesión actual
export async function cambiarContrasena(formulario: FormData): Promise<Resultado> {
  const contrasena = String(formulario.get("contrasena") ?? "");
  const confirmar = String(formulario.get("confirmar") ?? "");
  if (contrasena.length < 8) return { ok: false, mensaje: "Usa al menos 8 caracteres." };
  if (contrasena !== confirmar) return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  const db = await clienteServidor();
  const { error } = await db.auth.updateUser({ password: contrasena });
  if (error) return { ok: false, mensaje: /same/i.test(error.message) ? "Es la misma contraseña que ya tenías." : error.message };
  return { ok: true, mensaje: "Contraseña guardada ✓ La próxima vez entra con tu correo y esta contraseña." };
}
