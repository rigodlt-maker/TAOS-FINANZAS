"use server";
// Nube F3 · Crear tu cuenta en TAOS Nube (solo en modo nube)
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { esNube } from "@/lib/modo";
import { mensajeDeRegistro, pasaTurnstile, validarRegistro } from "@/lib/registro";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function crearCuenta(f: FormData) {
  const volver = (mensaje: string, ok = false) => redirect(`/crear-cuenta?${ok ? "listo" : "error"}=${encodeURIComponent(mensaje)}`);
  if (!esNube()) redirect("/login");
  const datos = {
    correo: String(f.get("correo") ?? "").trim().toLowerCase(),
    contrasena: String(f.get("contrasena") ?? ""),
    confirmar: String(f.get("confirmar") ?? ""),
    acepta: f.get("acepta") === "on",
  };
  const problema = validarRegistro(datos);
  if (problema) volver(problema);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  if (!(await pasaTurnstile(String(f.get("cf-turnstile-response") ?? "") || null, ip))) volver("No pudimos comprobar que no eres un robot. Recarga la página e intenta de nuevo.");
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const { error } = await (await clienteServidor()).auth.signUp({
    email: datos.correo,
    password: datos.contrasena,
    options: { emailRedirectTo: `${origen}/auth/callback` },
  });
  const r = mensajeDeRegistro(error);
  volver(r.mensaje, r.ok);
}
