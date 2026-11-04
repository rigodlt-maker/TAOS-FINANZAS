"use client";

// Sugerencias (igual en las 4 apps TAOS; estilos propios). Se guarda en el Google Form "Sugerencias TAOS"
// de soluciones.taos@gmail.com: cae en su hoja de respuestas y en Gmail › TAOS/Sugerencias. El usuario no sale de la app.
import { useState } from "react";
import info from "@/taos-version.json";

export const FORMULARIO = "https://docs.google.com/forms/d/e/1FAIpQLScvHOriU6HCNG5xMPJU97AfauqXioHrlI0lOLv1TEYyF2H4Xw/formResponse";
export const CAMPOS = { app: "entry.2060958266", tipo: "entry.611826208", mensaje: "entry.1011482035", calificacion: "entry.1871316131", version: "entry.1350171045", contacto: "entry.295910528" };
const TIPOS = ["💡 Idea", "🐞 Algo falla", "✨ Mejora", "💬 Otro"];

export function datosSugerencia(d: { app: string; tipo: string; mensaje: string; calificacion: number; contacto: string; version: string }) {
  const p = new URLSearchParams();
  p.set(CAMPOS.app, d.app);
  p.set(CAMPOS.tipo, d.tipo);
  p.set(CAMPOS.mensaje, d.mensaje.trim().slice(0, 4000));
  if (d.calificacion) p.set(CAMPOS.calificacion, String(d.calificacion));
  p.set(CAMPOS.version, d.version);
  if (d.contacto.trim()) p.set(CAMPOS.contacto, d.contacto.trim().slice(0, 200));
  return p;
}

const ORO = "#d4af37";
const tarjeta: React.CSSProperties = { background: "#151515", border: "1px solid #ffffff1f", borderRadius: 16, padding: 16, color: "#fff", display: "grid", gap: 14 };
const etiqueta: React.CSSProperties = { fontSize: 14, color: "#ffffffb3", display: "grid", gap: 8 };
const campo: React.CSSProperties = { background: "#0a0a0a", border: "1px solid #ffffff26", borderRadius: 12, color: "#fff", padding: "12px 14px", fontSize: 16, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

export function Sugerencias({ app }: { app: string }) {
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [mensaje, setMensaje] = useState("");
  const [calificacion, setCalificacion] = useState(0);
  const [contacto, setContacto] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | "error">("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (mensaje.trim().length < 5) return;
    setEstado("enviando");
    try {
      // Google Forms no responde a otras páginas (no-cors): si la red funcionó, la sugerencia llegó
      await fetch(FORMULARIO, { method: "POST", mode: "no-cors", body: datosSugerencia({ app, tipo, mensaje, calificacion, contacto, version: info.version }) });
      setEstado("listo");
      setMensaje("");
      setCalificacion(0);
    } catch {
      setEstado("error");
    }
  }

  if (estado === "listo")
    return (
      <div style={{ ...tarjeta, textAlign: "center", padding: 28 }}>
        <div style={{ fontSize: 44 }}>💛</div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>¡Gracias! Ya nos llegó.</p>
        <p style={{ margin: 0, fontSize: 14, color: "#ffffffb3" }}>Leemos todas. Lo que más se pide entra en las próximas versiones y te avisamos en “Novedades”.</p>
        <button type="button" onClick={() => setEstado("")} style={{ minHeight: 48, borderRadius: 12, border: "1px solid #ffffff26", background: "transparent", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
          Mandar otra
        </button>
      </div>
    );

  return (
    <form onSubmit={enviar} style={tarjeta}>
      <div style={etiqueta}>
        ¿Qué nos quieres contar?
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              style={{ minHeight: 48, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", border: `1px solid ${tipo === t ? ORO : "#ffffff26"}`, background: tipo === t ? `${ORO}26` : "transparent", color: tipo === t ? ORO : "#fff" }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <label style={etiqueta}>
        Cuéntanos
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          required
          minLength={5}
          rows={5}
          placeholder={tipo.includes("falla") ? "¿Qué pasó y en qué pantalla? Ej.: al guardar un gasto me sale un error." : "Ej.: me gustaría poder ver mis gastos por semana."}
          style={{ ...campo, resize: "vertical" }}
        />
      </label>
      <div style={etiqueta}>
        ¿Qué tanto te gusta la app?
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} de 5`}
              onClick={() => setCalificacion(n === calificacion ? 0 : n)}
              style={{ width: 48, height: 48, fontSize: 30, lineHeight: 1, background: "transparent", border: 0, cursor: "pointer", color: n <= calificacion ? ORO : "#ffffff40" }}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <label style={etiqueta}>
        Tu correo o WhatsApp (opcional, si quieres que te respondamos)
        <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="opcional" style={campo} />
      </label>
      {estado === "error" && <p style={{ margin: 0, color: "#f87171", fontSize: 14 }}>No se pudo enviar. Revisa tu internet e inténtalo otra vez.</p>}
      <button
        type="submit"
        disabled={estado === "enviando" || mensaje.trim().length < 5}
        style={{ minHeight: 52, borderRadius: 12, border: 0, background: ORO, color: "#0a0a0a", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: estado === "enviando" || mensaje.trim().length < 5 ? 0.5 : 1 }}
      >
        {estado === "enviando" ? "Enviando…" : "Enviar sugerencia"}
      </button>
      <p style={{ margin: 0, fontSize: 12, color: "#ffffff80" }}>Solo nos llega lo que escribes aquí (y la versión de tu app). Nunca tus datos, cuentas ni documentos.</p>
    </form>
  );
}
