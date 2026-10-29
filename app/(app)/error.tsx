"use client";

import { useEffect } from "react";

// Si algo truena, en vez de la pantalla blanca se muestra qué pasó (para poder arreglarlo) y cómo seguir
export default function ErrorDePagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid gap-4 py-8">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground">Toca “Reintentar”. Si vuelve a salir, mándale una captura de esta pantalla a Claude.</p>
      <pre className="rounded-2xl border bg-card p-4 text-xs whitespace-pre-wrap break-words text-destructive">
        {error.message || "Error sin mensaje"}
        {error.digest ? `\nCódigo: ${error.digest}` : ""}
        {`\nPágina: ${typeof window !== "undefined" ? window.location.pathname : ""}`}
      </pre>
      <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
        Reintentar
      </button>
      <a href="/" className="flex min-h-12 items-center justify-center rounded-xl border font-medium">
        Volver al inicio
      </a>
    </div>
  );
}
