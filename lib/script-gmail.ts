import { createHmac } from "node:crypto";

// Clave del script de Gmail: CORREOS_CLAVE si la pusiste en Vercel; si no, se deriva de la llave secreta de Supabase
// (siempre la misma, y solo la ves tú en la app)
export function claveCorreos(): string | null {
  if (process.env.CORREOS_CLAVE) return process.env.CORREOS_CLAVE;
  const base = process.env.SUPABASE_SECRET_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update("taos-finanzas:correos-gmail").digest("base64url").slice(0, 32);
}

// Remitentes de bancos que se revisan
export const REMITENTES = [
  "nu.com.mx",
  "revolut.com",
  "hsbc.com.mx",
  "bbva.mx",
  "bbva.com",
  "americanexpress.com",
  "aexp.com",
  "palaciodehierro.com",
  "liverpool.com.mx",
  "banamex.com",
  "santander.com.mx",
  "banorte.com",
  "mercadopago.com",
  "plata.com.mx",
  "stori.mx",
];

// Script de Google Apps Script que vive en tu cuenta de Google: cada 10 minutos busca avisos del banco y los manda a la app
export function scriptGmail(urlApp: string, clave: string): string {
  return `// Finanzas TAOS: manda a tu app los avisos de tu banco que llegan a Gmail.
// 1) Pega todo esto en script.google.com  2) Elige la función "instalar" y toca Ejecutar  3) Da permiso.
const URL_APP = "${urlApp}/api/correos";
const CLAVE = "${clave}";
const BANCOS = "from:(${REMITENTES.join(" OR ")})";

function instalar() {
  const prueba = UrlFetchApp.fetch(URL_APP, { headers: { Authorization: "Bearer " + CLAVE }, muteHttpExceptions: true });
  if (prueba.getResponseCode() !== 200) throw new Error("No me pude conectar con tu app: " + prueba.getContentText());
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().setProperty("desde", String(Date.now()));
  ScriptApp.newTrigger("revisarCorreos").timeBased().everyMinutes(10).create();
  Logger.log("¡Listo! Desde ahora reviso los correos de tu banco cada 10 minutos.");
}

function revisarCorreos() {
  const desde = Number(PropertiesService.getScriptProperties().getProperty("desde") || Date.now());
  const correos = [];
  GmailApp.search(BANCOS + " newer_than:2d", 0, 50).forEach((hilo) =>
    hilo.getMessages().forEach((m) => {
      if (m.getDate().getTime() < desde) return;
      correos.push({ id: m.getId(), de: m.getFrom(), asunto: m.getSubject(), fecha: m.getDate().toISOString(), texto: m.getPlainBody().slice(0, 8000) });
    }),
  );
  if (!correos.length) return;
  const r = UrlFetchApp.fetch(URL_APP, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + CLAVE },
    payload: JSON.stringify({ correos }),
    muteHttpExceptions: true,
  });
  Logger.log(r.getResponseCode() + " " + r.getContentText());
}
`;
}
