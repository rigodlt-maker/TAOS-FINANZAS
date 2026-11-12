"use client";

// Manda solos los gastos que se guardaron sin internet en cuanto vuelve la señal, y avisa cuántos esperan.
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { capturaRapida, registrarFrecuente } from "@/lib/acciones";
import { EVENTO_COLA, fijarDueno, leerCola, quitarDeCola } from "@/lib/cola";

// dueno = id de la sesión actual (lo pasa el servidor): solo se ven y se mandan los borradores de esa sesión (S15-R6)
export function SinInternet({ dueno }: { dueno: string }) {
  if (typeof window !== "undefined") fijarDueno(dueno);
  const [esperando, setEsperando] = useState(0);
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    fijarDueno(dueno);
    let enviando = false;
    const actualizar = () => {
      setEsperando(leerCola().length);
      setEnLinea(navigator.onLine);
    };
    const enviar = async () => {
      actualizar();
      if (enviando || !navigator.onLine) return;
      enviando = true;
      for (const p of leerCola()) {
        try {
          // El servidor también revisa que el borrador sea de la sesión que lo manda
          const r = p.tipo === "frase" ? await capturaRapida(p.frase, p.dueno) : await registrarFrecuente(p.datos, p.dueno);
          // Si el servidor lo rechaza (p. ej. borraste esa cuenta) tampoco se reintenta para siempre
          if (r.ok || !navigator.onLine) quitarDeCola(p.id);
          if (!r.ok) console.error("No se pudo registrar lo guardado sin internet:", r.mensaje);
        } catch {
          break; // sigue sin señal: se intenta en la próxima
        }
      }
      enviando = false;
      actualizar();
    };
    enviar();
    window.addEventListener("online", enviar);
    window.addEventListener("offline", actualizar);
    window.addEventListener(EVENTO_COLA, actualizar);
    return () => {
      window.removeEventListener("online", enviar);
      window.removeEventListener("offline", actualizar);
      window.removeEventListener(EVENTO_COLA, actualizar);
    };
  }, [dueno]);

  if (enLinea && !esperando) return null;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground" role="status">
      <WifiOff className="size-4 shrink-0" />
      {enLinea
        ? `Enviando ${esperando === 1 ? "1 gasto guardado" : `${esperando} gastos guardados`} sin internet…`
        : esperando
          ? `Sin internet: ${esperando === 1 ? "1 gasto espera" : `${esperando} gastos esperan`} y se registran solos al volver la señal.`
          : "Sin internet: puedes anotar gastos en Agregar y se registran solos al volver la señal."}
    </p>
  );
}
