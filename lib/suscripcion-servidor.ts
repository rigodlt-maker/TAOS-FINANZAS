// Nube F4 · Ligar una compra de Google Play a SU cuenta y mantenerla al día. Solo en el servidor (llave secreta),
// siempre con el user_id explícito. Lo que diga el celular o el aviso nunca se cree: se le pregunta a Google.
import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarSuscripcion, reconocerCompra } from "./google-play";
import { filaDeCompra, huellaToken, productoValido, puedeEscribir, type CompraGoogle, type Suscripcion } from "./suscripcion";

export type Google = {
  consultar: (token: string) => Promise<CompraGoogle | null>;
  reconocer: (producto: string, token: string) => Promise<void>;
};
export const googleReal: Google = { consultar: (t) => consultarSuscripcion(t), reconocer: (p, t) => reconocerCompra(p, t) };

type Resultado = { ok: true; estado: string } | { ok: false; mensaje: string };

async function guardar(admin: SupabaseClient, usuario: string, token: string, compra: CompraGoogle, g: Google): Promise<string> {
  const fila = filaDeCompra(usuario, token, compra);
  const { error } = await admin.from("suscripciones").upsert(fila, { onConflict: "user_id" });
  if (error) throw new Error(`Suscripción: ${error.message}`);
  // Google reembolsa sola una compra que no se reconoce en 3 días
  if (!fila.reconocida && (fila.estado === "activa" || fila.estado === "gracia")) {
    await g.reconocer(fila.producto, token);
    await admin.from("suscripciones").update({ reconocida: true }).eq("user_id", usuario).eq("token_huella", fila.token_huella);
  }
  return fila.estado;
}

// El celular acaba de comprar: manda el token; aquí se comprueba con Google y se liga a la persona con sesión
export async function verificarCompra(admin: SupabaseClient, usuario: string, token: string, producto: string, g: Google = googleReal): Promise<Resultado> {
  if (!token || token.length > 2000 || !productoValido(producto)) return { ok: false, mensaje: "Compra no válida." };
  const compra = await g.consultar(token);
  if (!compra) return { ok: false, mensaje: "Google no reconoce esa compra." };
  if (compra.lineItems?.[0]?.productId && !productoValido(compra.lineItems[0].productId)) return { ok: false, mensaje: "Esa compra no es de TAOS." };
  // Una compra = una cuenta: si ya está ligada a otra persona, no se comparte
  const { data: dueno, error } = await admin.from("suscripciones").select("user_id").eq("token_huella", huellaToken(token)).maybeSingle();
  if (error) throw new Error(`Suscripción: ${error.message}`);
  if (dueno && dueno.user_id !== usuario) return { ok: false, mensaje: "Esta compra ya está ligada a otra cuenta TAOS. Entra con esa cuenta o escríbenos a soporte." };
  return { ok: true, estado: await guardar(admin, usuario, token, compra, g) };
}

// Aviso de Google (renovó, canceló, venció…): se busca de quién es el token y se vuelve a preguntar el estado
export async function actualizarPorAviso(admin: SupabaseClient, token: string, g: Google = googleReal): Promise<"actualizada" | "sin dueño" | "desconocida"> {
  const { data, error } = await admin.from("suscripciones").select("user_id").eq("token_huella", huellaToken(token)).maybeSingle();
  if (error) throw new Error(`Suscripción: ${error.message}`);
  if (!data) return "sin dueño"; // la compra todavía no se liga: lo hará el celular al terminar de pagar
  const compra = await g.consultar(token);
  if (!compra) return "desconocida";
  await guardar(admin, data.user_id as string, token, compra, g);
  return "actualizada";
}

export async function suscripcionDe(admin: SupabaseClient, usuario: string): Promise<Suscripcion | null> {
  const { data, error } = await admin.from("suscripciones").select("estado, vence").eq("user_id", usuario).maybeSingle();
  if (error) return null;
  return (data as Suscripcion | null) ?? null;
}

export const puedeEscribirUsuario = async (admin: SupabaseClient, usuario: string, ahora = Date.now()) => puedeEscribir(await suscripcionDe(admin, usuario), ahora);
