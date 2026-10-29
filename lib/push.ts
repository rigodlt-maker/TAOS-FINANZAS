import { createECDH, createHmac } from "node:crypto";
import webpush from "web-push";
import type { Repo } from "./datos/repo";
import type { ResumenCorreos } from "./correos";
import { abiertos, pendiente } from "./envios";
import { diasEntre, dinero, fechaCorta } from "./formato";
import type { Prestamo } from "./tipos";

// Lo que aparece en la notificación del celular. "etiqueta" hace que un aviso nuevo reemplace al anterior del mismo tema.
export type Aviso = { titulo: string; cuerpo: string; url?: string; etiqueta?: string };

// Llaves VAPID: identifican a la app ante el servicio de notificaciones del celular (Google, Apple o Mozilla).
// Se derivan de SUPABASE_SECRET_KEY para que no haya que configurar nada más en Vercel.
export function llavesVapid(): { publica: string; privada: string } | null {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return { publica: process.env.VAPID_PUBLIC_KEY, privada: process.env.VAPID_PRIVATE_KEY };
  const base = process.env.SUPABASE_SECRET_KEY;
  return base ? llavesDesde(base) : null;
}

export function llavesDesde(base: string): { publica: string; privada: string } {
  // Casi nunca pasa, pero si los 32 bytes no son una llave P-256 válida se prueba con el siguiente número
  for (let i = 0; ; i++) {
    const privada = createHmac("sha256", base).update(`taos:vapid:${i}`).digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privada);
      return { publica: ecdh.getPublicKey().toString("base64url"), privada: privada.toString("base64url") };
    } catch {
      continue;
    }
  }
}

export const pushDisponible = () => llavesVapid() !== null;

// Manda el aviso a todos los celulares suscritos. Nunca lanza error: si falla, el correo sigue saliendo.
export async function enviarPush(repo: Repo, avisos: Aviso | Aviso[]): Promise<{ enviados: number; fallidos: number }> {
  const lista = (Array.isArray(avisos) ? avisos : [avisos]).slice(0, 6);
  const llaves = llavesVapid();
  const resultado = { enviados: 0, fallidos: 0 };
  if (!llaves || !lista.length) return resultado;
  const suscripciones = await repo.suscripcionesPush().catch((e) => {
    console.error("Push:", e);
    return [];
  });
  const vapidDetails = {
    subject: process.env.ALLOWED_EMAIL ? `mailto:${process.env.ALLOWED_EMAIL}` : "mailto:avisos@example.com",
    publicKey: llaves.publica,
    privateKey: llaves.privada,
  };
  for (const s of suscripciones) {
    for (const aviso of lista) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), {
          vapidDetails,
          TTL: 24 * 3600,
          urgency: "high",
        });
        resultado.enviados++;
      } catch (e) {
        resultado.fallidos++;
        const codigo = (e as { statusCode?: number }).statusCode;
        // 404 o 410: el celular ya no acepta avisos (desinstalaste la app o quitaste el permiso)
        if (codigo === 404 || codigo === 410) {
          await repo.borrarSuscripcionPush(s.endpoint).catch(() => {});
          break;
        }
        console.error("Push:", codigo, (e as Error).message);
      }
    }
  }
  return resultado;
}

// ---------- Textos de los avisos ----------

type AlertaPago = { pago: { nombre: string; monto: number }; dias: number; alcanza: boolean | null; cuenta: { nombre: string } | null };
type AlertaTarjeta = { cuenta: { id: string; nombre: string }; dias: number; vence: string; deuda: number };

const enDias = (dias: number) => (dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`);

export function avisosDePago(alertas: AlertaPago[], tarjetas: AlertaTarjeta[], cobros: Prestamo[], hoy: string): Aviso[] {
  return [
    ...tarjetas.map((t) => ({
      titulo: `💳 Pago de ${t.cuenta.nombre} ${enDias(t.dias)}`,
      cuerpo: `${t.deuda > 0 ? `${dinero(t.deuda)} para no generar intereses. ` : ""}Fecha límite: ${fechaCorta(t.vence)}.`,
      url: "/pagos",
      etiqueta: `tarjeta-${t.cuenta.id}`,
    })),
    ...alertas.map((a) => ({
      titulo: `⏰ ${a.pago.nombre}: ${dinero(a.pago.monto)} ${enDias(a.dias)}`,
      cuerpo: a.cuenta === null ? "Sin cuenta asociada." : a.alcanza ? `El saldo de ${a.cuenta.nombre} alcanza.` : `⚠️ El saldo de ${a.cuenta.nombre} no alcanza.`,
      url: "/pagos",
      etiqueta: `pago-${a.pago.nombre}`,
    })),
    ...abiertos(cobros).map((p) => {
      const dias = diasEntre(hoy, p.fecha_pago!);
      return {
        titulo: `💰 Cobrar a ${p.persona}: ${dinero(pendiente(p))}`,
        cuerpo: dias < 0 ? `Se pasó del ${fechaCorta(p.fecha_pago!)}.` : `Te paga ${enDias(dias)}.`,
        url: "/prestamos",
        etiqueta: `prestamo-${p.id}`,
      };
    }),
  ];
}

export function avisoDeCorreos(r: ResumenCorreos): Aviso | null {
  const porConfirmar = r.nuevos - r.aplicados - r.duplicados;
  if (r.aplicados + porConfirmar <= 0) return null;
  const partes = [
    r.aplicados ? `${r.aplicados} ya ${r.aplicados === 1 ? "quedó registrado" : "quedaron registrados"}` : "",
    porConfirmar ? `${porConfirmar} por confirmar` : "",
  ].filter(Boolean);
  const total = r.aplicados + porConfirmar;
  return {
    titulo: `🏦 ${total} ${total === 1 ? "aviso nuevo" : "avisos nuevos"} de tu banco`,
    cuerpo: `${partes.join(" y ")}.${porConfirmar ? " Toca para revisarlos." : ""}`,
    url: porConfirmar ? "/correos" : "/movimientos",
    etiqueta: "correos",
  };
}
