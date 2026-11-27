// Nube F4 · La suscripción de Google Play es la licencia de TAOS Nube (una sola para las 4 apps).
// Reglas puras (sin red): cómo se traduce cada estado de Google y qué puede hacer la persona.
// - Activa, en periodo de gracia o cancelada pero todavía pagada: usa todo.
// - Retenida, pausada, vencida o pendiente: SOLO LECTURA. Nada se borra y siempre puede descargar sus datos.
import { createHash } from "node:crypto";

export type EstadoSuscripcion = "activa" | "gracia" | "retenida" | "pausada" | "cancelada" | "vencida" | "pendiente";
export type Suscripcion = { estado: EstadoSuscripcion; vence: string | null };

// Planes aprobados por Rigo (D4): $59 MXN al mes o $499 MXN al año, con 7 días gratis (la prueba la da Google Play)
export const PRODUCTOS = { mensual: "taos_mensual", anual: "taos_anual" } as const;
export const productoValido = (p: string) => (Object.values(PRODUCTOS) as string[]).includes(p);

// subscriptionState de Google Play (purchases.subscriptionsv2) → nuestro estado
const ESTADOS: Record<string, EstadoSuscripcion> = {
  SUBSCRIPTION_STATE_ACTIVE: "activa",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "gracia",
  SUBSCRIPTION_STATE_ON_HOLD: "retenida",
  SUBSCRIPTION_STATE_PAUSED: "pausada",
  SUBSCRIPTION_STATE_CANCELED: "cancelada",
  SUBSCRIPTION_STATE_EXPIRED: "vencida",
  SUBSCRIPTION_STATE_PENDING: "pendiente",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "vencida",
};
export const estadoDeGoogle = (estado: string | undefined): EstadoSuscripcion => ESTADOS[estado ?? ""] ?? "pendiente";

// ¿Puede crear y cambiar cosas? «Cancelada» sigue valiendo hasta que se acaba lo que ya pagó.
export function puedeEscribir(s: Suscripcion | null, ahora = Date.now()): boolean {
  if (!s) return false;
  if (s.estado === "activa" || s.estado === "gracia") return true;
  if (s.estado === "cancelada") return !!s.vence && Date.parse(s.vence) > ahora;
  return false;
}

export function mensajeDeEstado(s: Suscripcion | null, ahora = Date.now()): string | null {
  if (puedeEscribir(s, ahora)) return s?.estado === "gracia" ? "Hubo un problema con tu pago. Revisa tu método de pago en Google Play para no perder el acceso." : null;
  if (!s) return "Empieza tus 7 días gratis para usar TAOS. Mientras tanto puedes ver la app, pero no guardar cambios.";
  if (s.estado === "pendiente") return "Tu pago está pendiente. En cuanto Google lo confirme, podrás guardar cambios.";
  if (s.estado === "pausada") return "Tu suscripción está en pausa. Puedes ver y descargar tus datos; para guardar cambios, reanúdala en Google Play.";
  if (s.estado === "retenida") return "Google no pudo cobrar tu suscripción. Actualiza tu método de pago en Google Play; tus datos siguen aquí.";
  return "Tu suscripción terminó. Tus datos siguen aquí: puedes verlos y descargarlos. Suscríbete otra vez para guardar cambios.";
}

// El token de compra se busca por su huella (así el índice único no guarda el token en claro dos veces)
export const huellaToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Lo que llega de Google Play (subscriptionsv2) → la fila de nuestra tabla
export type CompraGoogle = {
  subscriptionState?: string;
  acknowledgementState?: string;
  lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean }; offerDetails?: { offerId?: string; offerTags?: string[] } }[];
  testPurchase?: object;
};

export function filaDeCompra(usuario: string, token: string, c: CompraGoogle) {
  const linea = c.lineItems?.[0] ?? {};
  const oferta = `${linea.offerDetails?.offerId ?? ""} ${(linea.offerDetails?.offerTags ?? []).join(" ")}`;
  return {
    user_id: usuario,
    estado: estadoDeGoogle(c.subscriptionState),
    producto: linea.productId ?? "desconocido",
    token_huella: huellaToken(token),
    token_compra: token,
    vence: linea.expiryTime ?? null,
    renovacion_automatica: linea.autoRenewingPlan?.autoRenewEnabled ?? false,
    prueba_gratis: /prueba|trial|gratis/i.test(oferta),
    reconocida: c.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    actualizada: new Date().toISOString(),
  };
}

// Aviso en tiempo real de Google (RTDN, por Pub/Sub). Solo se usa para saber QUÉ token revisar: el estado siempre se
// vuelve a pedir a Google (nunca se confía en lo que dice el aviso).
export function leerAviso(cuerpo: unknown, paquete: string): { token: string; producto: string } | { prueba: true } | null {
  const datos = (cuerpo as { message?: { data?: string } } | null)?.message?.data;
  if (typeof datos !== "string") return null;
  try {
    const a = JSON.parse(Buffer.from(datos, "base64").toString("utf8")) as {
      packageName?: string;
      testNotification?: object;
      subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string };
    };
    if (a.packageName !== paquete) return null;
    if (a.testNotification) return { prueba: true };
    const n = a.subscriptionNotification;
    if (!n?.purchaseToken || typeof n.purchaseToken !== "string" || n.purchaseToken.length > 2000) return null;
    return { token: n.purchaseToken, producto: String(n.subscriptionId ?? "") };
  } catch {
    return null;
  }
}
