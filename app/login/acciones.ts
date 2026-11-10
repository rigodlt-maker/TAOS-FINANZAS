"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { correoPermitido } from "@/lib/supabase/config";
import { buscarDueno, puedeCrearContrasena } from "@/lib/instalacion";
import { codigoCoincide, revisarLicencia } from "@/lib/licencia";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Resultado } from "@/lib/acciones";

// Entrar con correo y contraseña (solo el correo permitido)
export async function entrarConContrasena(formulario: FormData) {
  const correo = String(formulario.get("correo") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");
  if (!correoPermitido(correo)) redirect(`/acceso-denegado?correo=${encodeURIComponent(correo)}`);
  if (!(await revisarLicencia()).ok) redirect("/login");
  const db = await clienteServidor();
  const { error } = await db.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) {
    const mensaje = /invalid login/i.test(error.message)
      ? "Correo o contraseña incorrectos. Es la misma contraseña que creaste al instalar tu primera app TAOS."
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

// Primera vez: crea la contraseña del dueño directamente en Supabase (con la llave secreta), sin mandar correos.
// Solo funciona mientras el dueño no exista o nunca haya entrado; después, esta puerta queda cerrada.
export async function crearContrasena(formulario: FormData) {
  const correo = String(formulario.get("correo") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");
  const confirmar = String(formulario.get("confirmar") ?? "");
  const volver = (mensaje: string) => redirect(`/login?error=${encodeURIComponent(mensaje)}`);
  if (!correoPermitido(correo)) volver("Ese correo no es el que pusiste en ALLOWED_EMAIL en Vercel. Escribe exactamente ese.");
  if (contrasena.length < 8) volver("Usa al menos 8 caracteres en tu contraseña.");
  if (contrasena !== confirmar) volver("Las dos contraseñas no coinciden. Escríbelas otra vez.");
  const licencia = await revisarLicencia();
  if (!licencia.ok) volver(licencia.problema);
  if (!codigoCoincide(String(formulario.get("codigo") ?? ""))) {
    await new Promise((r) => setTimeout(r, 2000)); // pausa para que no se pueda adivinar a la fuerza
    volver("Ese no es tu código de compra. Escribe el mismo que pegaste en CODIGO_COMPRA en Vercel (empieza con HP).");
  }

  const dueno = await buscarDueno();
  if (!puedeCrearContrasena(dueno)) volver("Ya tienes contraseña: entra con ella (es la misma de tus otras apps TAOS).");
  const admin = clienteAdmin();
  const { error } = dueno
    ? await admin.auth.admin.updateUserById(dueno.id, { password: contrasena, email_confirm: true })
    : await admin.auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true });
  if (error) volver(/weak|pwned|common/i.test(error.message) ? "Esa contraseña es muy fácil de adivinar. Usa otra más larga." : error.message);

  const db = await clienteServidor();
  const entrada = await db.auth.signInWithPassword({ email: dueno?.email ?? correo, password: contrasena });
  if (entrada.error) volver(entrada.error.message);
  redirect("/");
}
