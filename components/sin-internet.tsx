"use client";

// Manda solos los gastos que se guardaron sin internet en cuanto vuelve la señal, y avisa cuántos esperan.
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { capturaRapida, registrarFrecuente } from "@/lib/acciones";
import { descartarApartado, EVENTO_COLA, fijarDueno, leerApartados, leerCola, quitarDeCola, recuperarApartado, type Apartado } from "@/lib/cola";

// dueno = id de la sesión actual (lo pasa el servidor): solo se ven y se mandan los borradores de esa sesión (S15-R6)
export function SinInternet({ dueno }: { dueno: string }) {
  if (typeof window !== "undefined") fijarDueno(dueno);
  const [esperando, setEsperando] = useState(0);
  const [enLinea, setEnLinea] = useState(true);
  const [apartados, setApartados] = useState<Apartado[]>([]);

  useEffect(() => {
    fijarDueno(dueno);
    let enviando = false;
    const actualizar = () => {
      setEsperando(leerCola().length);
      setEnLinea(navigator.onLine);
      setApartados(leerApartados());
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

  const aviso =
    enLinea && !esperando ? null : (
    <p className="mb-4 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground" role="status">
      <WifiOff className="size-4 shrink-0" />
      {enLinea
        ? `Enviando ${esperando === 1 ? "1 gasto guardado" : `${esperando} gastos guardados`} sin internet…`
        : esperando
          ? `Sin internet: ${esperando === 1 ? "1 gasto espera" : `${esperando} gastos esperan`} y se registran solos al volver la señal.`
          : "Sin internet: puedes anotar gastos en Agregar y se registran solos al volver la señal."}
    </p>
    );
  if (!aviso && !apartados.length) return null;
  return (
    <>
      {aviso}
      {apartados.length > 0 && <Apartados lista={apartados} />}
    </>
  );
}

// S15-R6 · Gastos anotados sin internet ANTES de que la cola tuviera dueño. No se mandan solos: tú eliges cada uno.
const describir = (p: Apartado) =>
  p.tipo === "frase" ? `«${p.frase}»` : `$${Number(p.datos.monto).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en ${p.datos.comercio}`;
function Apartados({ lista }: { lista: Apartado[] }) {
  const [fallo, setFallo] = useState<string | null>(null);
  const intentar = (hecho: boolean, que: string) =>
    setFallo(hecho ? null : `No se pudo ${que} en este celular (puede estar sin espacio). El gasto sigue aquí, apartado; intenta de nuevo.`);
  return (
    <section className="mb-4 grid gap-3 rounded-2xl border border-primary/60 bg-card px-4 py-3 text-sm" aria-label="Gastos guardados sin internet">
      <p>
        <strong>{lista.length === 1 ? "Hay 1 gasto" : `Hay ${lista.length} gastos`} que se anotaron sin internet en este celular antes de la actualización.</strong> No se
        registraron. Si son tuyos, regístralos; si no, descártalos.
      </p>
      {fallo && (
        <p role="alert" className="rounded-xl border border-destructive/60 px-3 py-2 text-destructive">
          {fallo}
        </p>
      )}
      <ul className="grid gap-2">
        {lista.map((p) => (
          <li key={p.id} className="grid gap-2 rounded-xl border px-3 py-2">
            <span>{describir(p)}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-12 flex-1 rounded-xl bg-primary px-3 font-medium text-primary-foreground" onClick={() => intentar(recuperarApartado(p.id), "guardarlo para registrar")}>
                Son míos: registrar
              </button>
              <button type="button" className="min-h-12 flex-1 rounded-xl border px-3" onClick={() => intentar(descartarApartado(p.id), "descartarlo")}>
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
