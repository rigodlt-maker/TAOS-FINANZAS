// Nube F4 · Comprar y recuperar la suscripción con el cobro de Google Play (Digital Goods API + Payment Request).
// Solo funciona dentro de la app TAOS instalada desde Google Play (TWA). En el navegador, se explica cómo hacerlo.
export const METODO_PLAY = "https://play.google.com/billing";
export const PRODUCTOS = { mensual: "taos_mensual", anual: "taos_anual" } as const;

type Compra = { itemId: string; purchaseToken: string };
type ServicioPlay = { getDetails(ids: string[]): Promise<{ itemId: string; price: { currency: string; value: string } }[]>; listPurchases(): Promise<Compra[]> };

export async function servicioPlay(): Promise<ServicioPlay | null> {
  const w = window as unknown as { getDigitalGoodsService?: (m: string) => Promise<ServicioPlay> };
  if (!w.getDigitalGoodsService || !("PaymentRequest" in window)) return null;
  try {
    return await w.getDigitalGoodsService(METODO_PLAY);
  } catch {
    return null;
  }
}

async function avisarAlServidor(token: string, producto: string): Promise<{ ok: boolean; mensaje?: string }> {
  const r = await fetch("/api/suscripcion/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, producto }) });
  return r.json().catch(() => ({ ok: false, mensaje: "No hubo respuesta del servidor." }));
}

export async function precios(s: ServicioPlay): Promise<Record<string, string>> {
  try {
    const d = await s.getDetails(Object.values(PRODUCTOS));
    return Object.fromEntries(d.map((x) => [x.itemId, new Intl.NumberFormat("es-MX", { style: "currency", currency: x.price.currency }).format(Number(x.price.value))]));
  } catch {
    return {};
  }
}

export async function comprar(producto: string): Promise<{ ok: boolean; mensaje: string }> {
  const s = await servicioPlay();
  if (!s) return { ok: false, mensaje: "Para suscribirte, abre TAOS desde la app instalada de Google Play." };
  const pedido = new PaymentRequest([{ supportedMethods: METODO_PLAY, data: { sku: producto } }], { total: { label: "Total", amount: { currency: "MXN", value: "0" } } });
  let respuesta: PaymentResponse;
  try {
    respuesta = await pedido.show();
  } catch {
    return { ok: false, mensaje: "No se completó la compra. No se hizo ningún cargo." };
  }
  const token = (respuesta.details as { purchaseToken?: string }).purchaseToken ?? "";
  const r = await avisarAlServidor(token, producto);
  await respuesta.complete(r.ok ? "success" : "fail").catch(() => {});
  return r.ok ? { ok: true, mensaje: "¡Listo! Tu suscripción está activa ✓" } : { ok: false, mensaje: r.mensaje ?? "No pudimos confirmar tu compra. Toca «Ya pagué» en un momento." };
}

// «Ya pagué»: si la compra se hizo pero no se alcanzó a confirmar (o cambiaste de celular), se vuelve a ligar
export async function recuperar(): Promise<{ ok: boolean; mensaje: string }> {
  const s = await servicioPlay();
  if (!s) return { ok: false, mensaje: "Abre TAOS desde la app instalada de Google Play para recuperar tu suscripción." };
  const compras = await s.listPurchases().catch(() => []);
  if (!compras.length) return { ok: false, mensaje: "No encontramos una suscripción en esta cuenta de Google Play." };
  for (const c of compras) {
    const r = await avisarAlServidor(c.purchaseToken, c.itemId);
    if (r.ok) return { ok: true, mensaje: "¡Listo! Recuperamos tu suscripción ✓" };
    if (r.mensaje) return { ok: false, mensaje: r.mensaje };
  }
  return { ok: false, mensaje: "No pudimos recuperar tu suscripción. Escríbenos a soporte." };
}
