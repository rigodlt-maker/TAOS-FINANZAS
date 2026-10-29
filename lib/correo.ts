import { Resend } from "resend";

const DE = process.env.RESEND_FROM || "Asesor Financiero <onboarding@resend.dev>";

export async function enviarCorreo(asunto: string, html: string) {
  const llave = process.env.RESEND_API_KEY;
  const para = process.env.ALLOWED_EMAIL;
  if (!llave) throw new Error("Falta RESEND_API_KEY");
  if (!para) throw new Error("Falta ALLOWED_EMAIL");
  const { error } = await new Resend(llave).emails.send({ from: DE, to: para, subject: asunto, html });
  if (error) throw new Error(`Resend: ${error.message}`);
}

// Plantilla HTML sencilla en blanco y negro
export function plantilla(titulo: string, bloques: string[], urlApp?: string) {
  const enlace = urlApp
    ? `<p style="text-align:center;margin:20px 0 0"><a href="${urlApp}" style="color:#18181b;font-weight:600">Abrir Asesor Financiero →</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto">
<h1 style="font-size:20px;margin:0 0 16px">${titulo}</h1>
${bloques.map((b) => `<div style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:16px;margin:0 0 12px;font-size:14px;line-height:1.5">${b}</div>`).join("")}
${enlace}
</div></body></html>`;
}

export function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function urlDeLaApp() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
}
