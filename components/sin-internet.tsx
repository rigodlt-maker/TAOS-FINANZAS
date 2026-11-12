"use client";

// Manda solos los gastos que se guardaron sin internet en cuanto vuelve la señal, y avisa cuántos esperan.
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { capturaRapida, registrarFrecuente } from "@/lib/acciones";
import {
  descartarApartado,
  enviarCola,
  envioPausado,
  EVENTO_COLA,
  fijarDueno,
  leerApartados,
  porEnviar,
  porRevisar,
  quitarDeCola,
  reanudarEnvio,
  recuperarApartado,
  type Apartado,
  type PorEnviar,
} from "@/lib/cola";

// dueno = id de la sesión actual (lo pasa el servidor): solo se ven y se mandan los borradores de esa sesión (S15-R6)
export function SinInternet({ dueno }: { dueno: string }) {
  if (typeof window !== "undefined") fijarDueno(dueno);
  const [esperando, setEsperando] = useState(0);
  const [enLinea, setEnLinea] = useState(true);
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [revisar, setRevisar] = useState<PorEnviar[]>([]);
  const [pausa, setPausa] = useState(false);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    fijarDueno(dueno);
    let enviando = false;
    const actualizar = () => {
      setEsperando(porEnviar().length);
      setEnLinea(navigator.onLine);
      setApartados(leerApartados());
      setRevisar(porRevisar());
      setPausa(envioPausado());
    };
    const enviar = async () => {
      actualizar();
      if (enviando || !navigator.onLine) return;
      enviando = true;
      // Cada borrador va con su dueño y su id fijo (el servidor revisa el dueño y no guarda dos veces el mismo).
      // Lo no registrado queda «por revisar»; si ni eso se puede guardar, se pausa todo (ver enviarCola en lib/cola.ts).
      await enviarCola((p) => (p.tipo === "frase" ? capturaRapida(p.frase, p.dueno, p.id) : registrarFrecuente(p.datos, p.dueno, p.id)));
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
  }, [dueno, reintento]);

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
  if (!aviso && !apartados.length && !revisar.length && !pausa) return null;
  return (
    <>
      {pausa && (
        <div role="alert" className="mb-4 grid gap-2 rounded-2xl border border-destructive/60 bg-card px-4 py-3 text-sm">
          <p className="text-destructive">
            <strong>Pausé el envío de lo que guardaste sin internet.</strong> El servidor no registró un gasto y este celular no me dejó anotarlo para que lo
            revises (puede estar sin espacio). Nada se borró ni se volverá a mandar solo. Libera espacio y toca «Reintentar».
          </p>
          <button
            type="button"
            className="min-h-12 rounded-xl border px-3"
            onClick={() => {
              if (reanudarEnvio()) setReintento((n) => n + 1);
              else setPausa(true);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {aviso}
      {revisar.length > 0 && <PorRevisar lista={revisar} />}
      {apartados.length > 0 && <Apartados lista={apartados} />}
    </>
  );
}

// Lo que el servidor no registró solo: se pasa a Tao (que te pide confirmar) o se descarta. Tú eliges.
const comoFrase = (p: PorEnviar) => (p.tipo === "frase" ? p.frase : `${p.datos.monto} ${p.datos.comercio}`);
function PorRevisar({ lista }: { lista: PorEnviar[] }) {
  const [fallo, setFallo] = useState<string | null>(null);
  const quitar = (id: string) => setFallo(quitarDeCola(id) ? null : "No se pudo quitar de este celular (puede estar sin espacio). Sigue aquí; intenta de nuevo.");
  return (
    <section className="mb-4 grid gap-3 rounded-2xl border border-primary/60 bg-card px-4 py-3 text-sm" aria-label="Gastos guardados sin internet por revisar">
      <p>
        <strong>{lista.length === 1 ? "1 gasto guardado sin internet no se registró solo." : `${lista.length} gastos guardados sin internet no se registraron solos.`}</strong>{" "}
        Revísalos:
      </p>
      {fallo && (
        <p role="alert" className="rounded-xl border border-destructive/60 px-3 py-2 text-destructive">
          {fallo}
        </p>
      )}
      <ul className="grid gap-2">
        {lista.map((p) => (
          <li key={p.id} className="grid gap-2 rounded-xl border px-3 py-2">
            <span>{describir(p.tipo === "frase" ? { id: p.id, tipo: "frase", frase: p.frase, creado: p.creado } : { id: p.id, tipo: "frecuente", datos: p.datos, creado: p.creado })}</span>
            <span className="text-muted-foreground">{p.revisar}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl bg-primary px-3 font-medium text-primary-foreground"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("taos-preguntar", { detail: comoFrase(p) }));
                  quitar(p.id);
                }}
              >
                Pasárselo a Tao
              </button>
              <button type="button" className="min-h-12 flex-1 rounded-xl border px-3" onClick={() => quitar(p.id)}>
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
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
