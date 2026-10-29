"use client";

// Último recurso: reemplaza la pantalla blanca de Next.js y muestra el error real
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-MX">
      <body style={{ margin: 0, background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", display: "grid", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Algo salió mal</h1>
          <p style={{ margin: 0, color: "#a3a3a3" }}>Toca “Reintentar”. Si vuelve a salir, mándale una captura de esta pantalla a Claude.</p>
          <pre style={{ margin: 0, padding: 16, borderRadius: 16, border: "1px solid #2a2a2a", background: "#151515", color: "#f87171", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {error.message || "Error sin mensaje"}
            {error.digest ? `\nCódigo: ${error.digest}` : ""}
            {`\nPágina: ${typeof window !== "undefined" ? window.location.pathname : ""}`}
          </pre>
          <button type="button" onClick={reset} style={{ minHeight: 48, border: 0, borderRadius: 12, background: "#d4af37", color: "#0a0a0a", fontSize: 16, fontWeight: 600 }}>
            Reintentar
          </button>
          <a href="/" style={{ minHeight: 48, display: "grid", placeItems: "center", borderRadius: 12, border: "1px solid #2a2a2a", color: "#f5f5f5", textDecoration: "none" }}>
            Volver al inicio
          </a>
        </main>
      </body>
    </html>
  );
}
