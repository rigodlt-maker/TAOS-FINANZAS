"use client";

// Lista de "Mis suscripciones": ¿lo usaste este mes? (Sí / No, se guarda en este celular), cuánto ahorrarías,
// cómo cancelarla y "avísame antes del cobro".
import { BellPlus, ExternalLink } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { avisarSuscripcion } from "@/lib/acciones";
import { dinero, dineroCorto, fechaCorta } from "@/lib/formato";
import { sinUsar, type Suscripcion, type Usos } from "@/lib/suscripciones";

const CLAVE = "taos-suscripciones-uso";

export function SuscripcionesLista({ lista, cuentas, avisando, mes }: { lista: Suscripcion[]; cuentas: Record<string, string>; avisando: string[]; mes: string }) {
  const [usos, setUsos] = useState<Usos>({});
  const [mensajes, setMensajes] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();
  useEffect(() => {
    try {
      setUsos(JSON.parse(localStorage.getItem(CLAVE) ?? "{}"));
    } catch {}
  }, []);

  function marcar(clave: string, r: "si" | "no") {
    const nuevo = { ...usos, [clave]: { ...(usos[clave] ?? {}), [mes]: r } };
    setUsos(nuevo);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nuevo));
    } catch {}
  }

  const total = lista.reduce((t, s) => t + s.alMes, 0);
  const sobran = lista.filter((s) => sinUsar(usos, s.clave, mes));
  const ahorro = sobran.reduce((t, s) => t + s.alAnio, 0);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Pagas en suscripciones</p>
        <p className="text-3xl font-semibold tracking-tight">
          {dinero(total)} <span className="text-base font-normal text-muted-foreground">al mes</span>
        </p>
        <p className="text-sm text-muted-foreground">= {dineroCorto(total * 12)} al año</p>
        {ahorro > 0 && (
          <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm">
            🫣 Si cancelas lo que no usas ({sobran.map((s) => s.nombre).join(", ")}) ahorras <strong className="text-primary">{dineroCorto(ahorro)} al año</strong>.
          </p>
        )}
      </section>

      {lista.map((s) => {
        const estado = sinUsar(usos, s.clave, mes);
        const respuesta = usos[s.clave]?.[mes];
        const avisa = avisando.includes(`¿Cancelar ${s.nombre}?`);
        return (
          <section key={s.clave} className={`grid gap-3 rounded-2xl border bg-card p-4 ${estado ? "border-primary/60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {cuentas[s.account_id] ?? ""} · próximo cobro {fechaCorta(s.proximo)}
                </p>
              </div>
              <p className="text-right font-semibold whitespace-nowrap">
                {dinero(s.monto)}
                <span className="block text-xs font-normal text-muted-foreground">{s.frecuencia === "mensual" ? "al mes" : "al año"}</span>
              </p>
            </div>
            {estado && (
              <p className="text-sm">
                {estado === "nunca" ? "🫣 Probablemente no la usas" : "Este mes no la usaste"}: cancelarla te ahorra <strong className="text-primary">{dineroCorto(s.alAnio)} al año</strong>.
              </p>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">¿La usaste este mes?</span>
              {(["si", "no"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => marcar(s.clave, r)}
                  aria-pressed={respuesta === r}
                  className={`min-h-11 min-w-14 rounded-full border px-4 font-semibold ${respuesta === r ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {r === "si" ? "Sí" : "No"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={s.cancelar.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm">
                <ExternalLink className="size-4" /> {s.cancelar.oficial ? "Cancelar en su página" : "¿Cómo la cancelo?"}
              </a>
              {avisa ? (
                <span className="flex min-h-11 items-center px-1 text-sm text-muted-foreground">🔔 Te aviso antes del cobro</span>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await avisarSuscripcion({ nombre: s.nombre, monto: s.monto, frecuencia: s.frecuencia, proximo: s.proximo, account_id: s.account_id }).catch(() => ({ ok: false, mensaje: "Revisa tu conexión." }));
                      setMensajes((m) => ({ ...m, [s.clave]: r.mensaje }));
                    })
                  }
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm text-primary"
                >
                  <BellPlus className="size-4" /> Avísame antes del cobro
                </button>
              )}
            </div>
            {mensajes[s.clave] && <p className="text-sm text-muted-foreground">{mensajes[s.clave]}</p>}
          </section>
        );
      })}
    </div>
  );
}
