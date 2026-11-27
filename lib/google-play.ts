// Nube F4 · Preguntarle a Google Play por una suscripción (API de Google Play Developer), sin librerías extra.
// Variables (solo en el servidor de TAOS Nube): PLAY_PAQUETE (p. ej. mx.taos.app) y PLAY_CUENTA_SERVICIO (el JSON de la
// cuenta de servicio con permiso de «Ver datos financieros y administrar pedidos» en Play Console). Nunca llegan al navegador.
import { createSign } from "node:crypto";
import type { CompraGoogle } from "./suscripcion";

type Cuenta = { client_email: string; private_key: string; token_uri?: string };
export type Buscar = typeof fetch;

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const ALCANCE = "https://www.googleapis.com/auth/androidpublisher";

export const playConfigurado = (v: Record<string, string | undefined> = process.env) => !!(v.PLAY_PAQUETE?.trim() && v.PLAY_CUENTA_SERVICIO?.trim());

function cuentaDe(v: Record<string, string | undefined>): Cuenta {
  const c = JSON.parse(v.PLAY_CUENTA_SERVICIO ?? "{}") as Partial<Cuenta>;
  if (!c.client_email || !c.private_key) throw new Error("PLAY_CUENTA_SERVICIO no es el JSON de una cuenta de servicio");
  return c as Cuenta;
}

const b64url = (x: string | Buffer) => Buffer.from(x).toString("base64url");

// Firma (RS256) la constancia que Google pide para dar un permiso de acceso de 1 hora
export function constanciaFirmada(c: Cuenta, ahora = Date.now()): string {
  const iat = Math.floor(ahora / 1000);
  const cabeza = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({ iss: c.client_email, scope: ALCANCE, aud: c.token_uri ?? "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }));
  const firma = createSign("RSA-SHA256").update(`${cabeza}.${cuerpo}`).sign(c.private_key);
  return `${cabeza}.${cuerpo}.${b64url(firma)}`;
}

let guardado: { token: string; vence: number } | null = null;

async function permiso(v: Record<string, string | undefined>, buscar: Buscar, ahora: number): Promise<string> {
  if (guardado && guardado.vence > ahora + 60_000) return guardado.token;
  const c = cuentaDe(v);
  const r = await buscar(c.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: constanciaFirmada(c, ahora) }),
  });
  const d = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.ok || !d.access_token) throw new Error(`Google no dio permiso: ${d.error ?? r.status}`);
  guardado = { token: d.access_token, vence: ahora + (d.expires_in ?? 3600) * 1000 };
  return guardado.token;
}

export const olvidarPermiso = () => {
  guardado = null;
};

// Estado actual de una compra (fuente de verdad: siempre se le pregunta a Google)
export async function consultarSuscripcion(token: string, v: Record<string, string | undefined> = process.env, buscar: Buscar = fetch, ahora = Date.now()): Promise<CompraGoogle | null> {
  const acceso = await permiso(v, buscar, ahora);
  const r = await buscar(`${API}/${encodeURIComponent(v.PLAY_PAQUETE!.trim())}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${acceso}` },
  });
  if (r.status === 404 || r.status === 410) return null; // token inventado o de otra app
  if (!r.ok) throw new Error(`Google Play respondió ${r.status}`);
  return (await r.json()) as CompraGoogle;
}

// Reconocer la compra: si no se hace en 3 días, Google la reembolsa sola
export async function reconocerCompra(producto: string, token: string, v: Record<string, string | undefined> = process.env, buscar: Buscar = fetch, ahora = Date.now()): Promise<void> {
  const acceso = await permiso(v, buscar, ahora);
  const r = await buscar(`${API}/${encodeURIComponent(v.PLAY_PAQUETE!.trim())}/purchases/subscriptions/${encodeURIComponent(producto)}/tokens/${encodeURIComponent(token)}:acknowledge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok && r.status !== 400) throw new Error(`No se pudo reconocer la compra (${r.status})`); // 400 = ya estaba reconocida
}
