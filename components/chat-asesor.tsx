"use client";

import { ArrowUp, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { PREGUNTAS_EJEMPLO } from "@/lib/asesor";
import type { PropuestaAjuste } from "@/lib/ajuste-chat";
import type { PropuestaCobro, PropuestaDeposito, PropuestaEnvio } from "@/lib/envios";
import type { PropuestaGasto } from "@/lib/gasto-chat";
import type { PropuestaMovimiento } from "@/lib/transferencias";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";

type Tarjetas = { propuesta?: PropuestaMovimiento; gasto?: PropuestaGasto; ajuste?: PropuestaAjuste; envio?: PropuestaEnvio; cobro?: PropuestaCobro; deposito?: PropuestaDeposito };
type Mensaje = { pregunta: string; respuesta: string | null } & Tarjetas;
type Respuesta = { respuesta?: string } & Tarjetas;

const MAS_EJEMPLOS = ["Pagué $30 de tamales con efectivo", "Pagué la tarjeta Palacio de Hierro con Revolut"];

// Chat con Tao, tu asesor TAOS: preguntas en lenguaje normal, respuestas con tus datos
export function ChatAsesor({ enHoja = false }: { enHoja?: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pendiente, iniciar] = useTransition();
  const final = useRef<HTMLDivElement>(null);

  // Llaves: en Chrome nuevo scrollIntoView devuelve una promesa y React la trataría como función de limpieza
  useEffect(() => {
    final.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes]);

  function enviar(pregunta: string) {
    pregunta = pregunta.trim();
    if (!pregunta || pendiente) return;
    setTexto("");
    setMensajes((m) => [...m, { pregunta, respuesta: null }]);
    iniciar(async () => {
      let respuesta: string;
      let tarjetas: Tarjetas = {};
      try {
        const r = await fetch("/api/asesor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta }) });
        if (r.redirected || r.status === 401) respuesta = "Tu sesión se cerró. Recarga la app y vuelve a entrar.";
        else {
          const datos = (await r.json().catch(() => null)) as Respuesta | null;
          respuesta = datos?.respuesta ?? `Algo falló (error ${r.status}). Intenta de nuevo.`;
          tarjetas = { propuesta: datos?.propuesta, gasto: datos?.gasto, ajuste: datos?.ajuste, envio: datos?.envio, cobro: datos?.cobro, deposito: datos?.deposito };
        }
      } catch {
        respuesta = "No me pude conectar. Revisa tu internet e intenta de nuevo.";
      }
      setMensajes((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, respuesta, ...tarjetas } : x)));
    });
  }

  return (
    <div className="grid gap-4">
      {mensajes.length === 0 && (
        <div className="grid gap-2">
          {[...PREGUNTAS_EJEMPLO.slice(0, 4), ...MAS_EJEMPLOS].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => enviar(e)}
              className="min-h-12 rounded-2xl border bg-card px-4 py-3 text-left text-sm active:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {mensajes.map((m, i) => (
        <div key={i} className="grid gap-2">
          <p className="max-w-[85%] justify-self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.pregunta}</p>
          <div className="max-w-[95%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-[15px]">
            {m.respuesta === null ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Markdown texto={m.respuesta} />}
            {m.propuesta && <ConfirmarMovimiento propuesta={m.propuesta} />}
            {m.gasto && <ConfirmarGasto gasto={m.gasto} />}
            {m.ajuste && <ConfirmarAjuste ajuste={m.ajuste} />}
            {m.envio && <ConfirmarEnvio envio={m.envio} />}
            {m.cobro && <ConfirmarCobro cobro={m.cobro} />}
            {m.deposito && <ConfirmarDeposito deposito={m.deposito} />}
          </div>
        </div>
      ))}
      <div ref={final} className={enHoja ? "scroll-mb-20" : "scroll-mb-44"} />
      {/* Caja de pregunta abajo, al alcance del pulgar: fija encima de la barra, o al pie de la hoja de Tao */}
      <form
        className={cn(
          "z-20 border-t bg-background/95 py-3 backdrop-blur",
          enHoja ? "sticky bottom-0 -mx-4" : "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))]",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={300}
            placeholder="Pregúntale a Tao…"
            aria-label="Tu pregunta"
            className="h-12 w-full min-w-0 rounded-full border bg-card px-5 text-base focus-visible:outline-2 focus-visible:outline-primary"
          />
          <Button type="submit" size="icon" className="size-12 shrink-0 rounded-full" disabled={pendiente || !texto.trim()} aria-label="Preguntar">
            {pendiente ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

type Estado = { paso: "pregunta" | "enviando" | "hecho" | "cancelado"; mensaje?: string; id?: string };

// Tarjeta de confirmación dentro del chat: nada se registra hasta que tocas "Registrar"
function ConfirmarMovimiento({ propuesta }: { propuesta: PropuestaMovimiento }) {
  const [monto, setMonto] = useState(propuesta.monto ? String(propuesta.monto) : "");
  const [estado, setEstado] = useState<Estado>({ paso: "pregunta" });
  const router = useRouter();

  async function llamar(metodo: "POST" | "DELETE", cuerpo: object) {
    try {
      const r = await fetch("/api/asesor/mover", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      return ((await r.json().catch(() => null)) as { ok: boolean; mensaje: string; id?: string } | null) ?? { ok: false, mensaje: `Algo falló (error ${r.status}).` };
    } catch {
      return { ok: false, mensaje: "No me pude conectar. Revisa tu internet e intenta de nuevo." };
    }
  }

  async function registrar() {
    setEstado({ paso: "enviando" });
    const r = await llamar("POST", { ...propuesta, monto: monto.replace(/[$,\s]/g, "") });
    setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje, id: r.id } : { paso: "pregunta", mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  async function deshacer() {
    setEstado((e) => ({ ...e, paso: "enviando" }));
    const r = await llamar("DELETE", { id: estado.id });
    setEstado(r.ok ? { paso: "cancelado", mensaje: r.mensaje } : { ...estado, mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">{estado.mensaje ?? "Listo, no registré nada."}</p>;

  if (estado.paso === "hecho" || (estado.paso === "enviando" && estado.id))
    return (
      <div className="mt-3 grid gap-2 border-t pt-3">
        <p className="flex gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          {estado.mensaje}
        </p>
        <Button variant="outline" size="sm" onClick={deshacer} disabled={estado.paso === "enviando"}>
          Deshacer
        </Button>
      </div>
    );

  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        registrar();
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Monto</span>
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          placeholder="$0.00"
          aria-label="Monto del movimiento"
          className="h-12 rounded-xl border bg-background px-4 text-base focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => setEstado({ paso: "cancelado" })} disabled={estado.paso === "enviando"}>
          Cancelar
        </Button>
        <Button type="submit" disabled={estado.paso === "enviando" || !(Number(monto.replace(/[$,\s]/g, "")) > 0)}>
          {estado.paso === "enviando" ? <Loader2 className="size-5 animate-spin" /> : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

// Tarjeta para confirmar un gasto o ingreso escrito en el chat: monto, cuenta y categoría se pueden cambiar
function ConfirmarGasto({ gasto }: { gasto: PropuestaGasto }) {
  const [monto, setMonto] = useState(String(gasto.monto));
  const [cuenta, setCuenta] = useState(gasto.account_id ?? "");
  const [categoria, setCategoria] = useState(gasto.category_id ?? "");
  const [estado, setEstado] = useState<Estado>({ paso: "pregunta" });
  const router = useRouter();
  const campo = "h-12 w-full rounded-xl border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-primary";

  async function llamar(metodo: "POST" | "DELETE", cuerpo: object) {
    try {
      const r = await fetch("/api/asesor/gasto", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      return ((await r.json().catch(() => null)) as { ok: boolean; mensaje: string; id?: string } | null) ?? { ok: false, mensaje: `Algo falló (error ${r.status}).` };
    } catch {
      return { ok: false, mensaje: "No me pude conectar. Revisa tu internet e intenta de nuevo." };
    }
  }

  async function registrar() {
    setEstado({ paso: "enviando" });
    const r = await llamar("POST", { tipo: gasto.tipo, monto: monto.replace(/[$,\s]/g, ""), comercio: gasto.comercio, fecha: gasto.fecha, account_id: cuenta, category_id: categoria || null });
    setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje, id: r.id } : { paso: "pregunta", mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  async function deshacer() {
    setEstado((e) => ({ ...e, paso: "enviando" }));
    const r = await llamar("DELETE", { id: estado.id });
    setEstado(r.ok ? { paso: "cancelado", mensaje: r.mensaje } : { ...estado, mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">{estado.mensaje ?? "Listo, no registré nada."}</p>;

  if (estado.paso === "hecho" || (estado.paso === "enviando" && estado.id))
    return (
      <div className="mt-3 grid gap-2 border-t pt-3">
        <p className="flex gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          {estado.mensaje}
        </p>
        <Button variant="outline" size="sm" onClick={deshacer} disabled={estado.paso === "enviando"}>
          Deshacer
        </Button>
      </div>
    );

  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        registrar();
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Monto</span>
        <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" aria-label="Monto" className={campo} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">{gasto.tipo === "ingreso" ? "Entró a" : "Pagaste con"}</span>
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Cuenta" className={campo}>
          <option value="" disabled>
            Elige la cuenta
          </option>
          {gasto.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {gasto.tipo === "gasto" && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={campo}>
            <option value="">Sin categoría (por revisar)</option>
            {gasto.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => setEstado({ paso: "cancelado" })} disabled={estado.paso === "enviando"}>
          Cancelar
        </Button>
        <Button type="submit" disabled={estado.paso === "enviando" || !cuenta || !(Number(monto.replace(/[$,\s]/g, "")) > 0)}>
          {estado.paso === "enviando" ? <Loader2 className="size-5 animate-spin" /> : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

// Tarjeta para confirmar un ajuste de saldo; "Deshacer" regresa el saldo anterior
function ConfirmarAjuste({ ajuste }: { ajuste: PropuestaAjuste }) {
  const [monto, setMonto] = useState(String(Math.abs(ajuste.nuevo)));
  const [estado, setEstado] = useState<Estado & { anterior?: number }>({ paso: "pregunta" });
  const router = useRouter();

  async function enviar(nuevo: number) {
    try {
      const r = await fetch("/api/asesor/ajuste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cuenta_id: ajuste.cuenta_id, nuevo }) });
      return ((await r.json().catch(() => null)) as { ok: boolean; mensaje: string; anterior?: number } | null) ?? { ok: false, mensaje: `Algo falló (error ${r.status}).` };
    } catch {
      return { ok: false, mensaje: "No me pude conectar. Revisa tu internet e intenta de nuevo." };
    }
  }

  async function registrar() {
    const valor = Number(monto.replace(/[$,\s]/g, ""));
    setEstado({ paso: "enviando" });
    const r = await enviar(ajuste.credito ? -Math.abs(valor) : valor);
    setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje, id: "ajuste", anterior: r.anterior } : { paso: "pregunta", mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  async function deshacer() {
    setEstado((e) => ({ ...e, paso: "enviando" }));
    const r = await enviar(estado.anterior ?? ajuste.actual);
    setEstado(r.ok ? { paso: "cancelado", mensaje: "Deshecho: el saldo regresó a como estaba." } : { ...estado, mensaje: r.mensaje });
    if (r.ok) router.refresh();
  }

  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">{estado.mensaje ?? "Listo, no cambié nada."}</p>;

  if (estado.paso === "hecho" || (estado.paso === "enviando" && estado.id))
    return (
      <div className="mt-3 grid gap-2 border-t pt-3">
        <p className="flex gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          {estado.mensaje}
        </p>
        <Button variant="outline" size="sm" onClick={deshacer} disabled={estado.paso === "enviando"}>
          Deshacer
        </Button>
      </div>
    );

  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        registrar();
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">{ajuste.credito ? `Lo que debes en ${ajuste.nombre}` : `Nuevo saldo de ${ajuste.nombre}`}</span>
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          aria-label="Nuevo saldo"
          className="h-12 rounded-xl border bg-background px-4 text-base focus-visible:outline-2 focus-visible:outline-primary"
        />
      </label>
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => setEstado({ paso: "cancelado" })} disabled={estado.paso === "enviando"}>
          Cancelar
        </Button>
        <Button type="submit" disabled={estado.paso === "enviando" || monto.trim() === "" || !Number.isFinite(Number(monto.replace(/[$,\s]/g, "")))}>
          {estado.paso === "enviando" ? <Loader2 className="size-5 animate-spin" /> : "Cambiar saldo"}
        </Button>
      </div>
    </form>
  );
}

const CAMPO = "h-12 w-full rounded-xl border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-primary";
const numeroDe = (t: string) => Number(t.replace(/[$,\s]/g, ""));

type RespuestaApi = { ok: boolean; mensaje: string; id?: string; calendario?: string | null };

async function api(url: string, metodo: "POST" | "DELETE", cuerpo: object): Promise<RespuestaApi> {
  try {
    const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    return ((await r.json().catch(() => null)) as RespuestaApi | null) ?? { ok: false, mensaje: `Algo falló (error ${r.status}).` };
  } catch {
    return { ok: false, mensaje: "No me pude conectar. Revisa tu internet e intenta de nuevo." };
  }
}

// Resultado con "Deshacer" (y, en préstamos, el enlace para el recordatorio en Google Calendar)
function Hecho({ mensaje, calendario, deshacer, ocupado }: { mensaje: string; calendario?: string | null; deshacer?: () => void; ocupado?: boolean }) {
  return (
    <div className="mt-3 grid gap-2 border-t pt-3">
      <p className="flex gap-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
        {mensaje}
      </p>
      {calendario && (
        <a href={calendario} target="_blank" className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Agregar recordatorio a Google Calendar
        </a>
      )}
      {deshacer && (
        <Button variant="outline" size="sm" onClick={deshacer} disabled={ocupado}>
          Deshacer
        </Button>
      )}
    </div>
  );
}

function Botones({ ocupado, listo, texto = "Registrar", cancelar }: { ocupado: boolean; listo: boolean; texto?: string; cancelar: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" onClick={cancelar} disabled={ocupado}>
        Cancelar
      </Button>
      <Button type="submit" disabled={ocupado || !listo}>
        {ocupado ? <Loader2 className="size-5 animate-spin" /> : texto}
      </Button>
    </div>
  );
}

// "Mandé $5000 a María": gasto o préstamo (con fecha en que te pagan y nota)
function ConfirmarEnvio({ envio }: { envio: PropuestaEnvio }) {
  const [persona, setPersona] = useState(envio.persona);
  const [monto, setMonto] = useState(String(envio.monto));
  const [cuenta, setCuenta] = useState(envio.cuenta_id ?? "");
  const [prestamo, setPrestamo] = useState(envio.prestamo);
  const [fechaPago, setFechaPago] = useState(envio.fecha_pago ?? "");
  const [nota, setNota] = useState(envio.nota ?? "");
  const [estado, setEstado] = useState<Estado & { calendario?: string | null }>({ paso: "pregunta" });
  const router = useRouter();

  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">{estado.mensaje ?? "Listo, no registré nada."}</p>;
  if (estado.id)
    return (
      <Hecho
        mensaje={estado.mensaje ?? ""}
        calendario={estado.calendario}
        ocupado={estado.paso === "enviando"}
        deshacer={async () => {
          setEstado((e) => ({ ...e, paso: "enviando" }));
          const r = await api("/api/asesor/envio", "DELETE", { id: estado.id });
          setEstado(r.ok ? { paso: "cancelado", mensaje: r.mensaje } : { ...estado, mensaje: r.mensaje });
          if (r.ok) router.refresh();
        }}
      />
    );

  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado({ paso: "enviando" });
        const r = await api("/api/asesor/envio", "POST", { persona, monto: numeroDe(monto), cuenta_id: cuenta, fecha: envio.fecha, prestamo, fecha_pago: fechaPago || null, nota });
        setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje, id: r.id, calendario: r.calendario } : { paso: "pregunta", mensaje: r.mensaje });
        if (r.ok) router.refresh();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">A quién</span>
          <input value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="A quién" className={CAMPO} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Monto</span>
          <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" aria-label="Monto" className={CAMPO} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">¿De qué cuenta salió?</span>
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Cuenta" className={CAMPO}>
          <option value="" disabled>
            Elige la cuenta
          </option>
          {envio.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm">
        <input type="checkbox" checked={prestamo} onChange={(e) => setPrestamo(e.target.checked)} className="size-5 accent-[var(--primary)]" />
        Es préstamo: me lo van a regresar
      </label>
      {prestamo && (
        <>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">¿Cuándo te paga? (opcional)</span>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} aria-label="Fecha de pago" className={CAMPO} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Nota (opcional)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Para la renta, me paga en 2 partes…" aria-label="Nota" className={CAMPO} />
          </label>
        </>
      )}
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <Botones ocupado={estado.paso === "enviando"} listo={!!cuenta && numeroDe(monto) > 0 && !!persona.trim()} cancelar={() => setEstado({ paso: "cancelado" })} />
    </form>
  );
}

// "María me pagó": abono o pago completo de un préstamo
function ConfirmarCobro({ cobro }: { cobro: PropuestaCobro }) {
  const [monto, setMonto] = useState(String(cobro.monto));
  const [cuenta, setCuenta] = useState(cobro.cuenta_id ?? "");
  const [estado, setEstado] = useState<Estado>({ paso: "pregunta" });
  const router = useRouter();
  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">Listo, no registré nada.</p>;
  if (estado.paso === "hecho") return <Hecho mensaje={estado.mensaje ?? ""} />;
  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado({ paso: "enviando" });
        const r = await api("/api/asesor/cobro", "POST", { prestamo_id: cobro.prestamo_id, monto: numeroDe(monto), cuenta_id: cuenta });
        setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje } : { paso: "pregunta", mensaje: r.mensaje });
        if (r.ok) router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Cuánto te pagó</span>
        <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" aria-label="Monto" className={CAMPO} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">¿A qué cuenta te llegó?</span>
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Cuenta" className={CAMPO}>
          <option value="" disabled>
            Elige la cuenta
          </option>
          {cobro.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <Botones ocupado={estado.paso === "enviando"} listo={!!cuenta && numeroDe(monto) > 0} cancelar={() => setEstado({ paso: "cancelado" })} />
    </form>
  );
}

// "Agrega 7300 a cajita turbo": de otra cuenta tuya (movimiento entre cuentas) o dinero nuevo (ingreso)
function ConfirmarDeposito({ deposito }: { deposito: PropuestaDeposito }) {
  const [monto, setMonto] = useState(String(deposito.monto));
  const [origen, setOrigen] = useState("");
  const [estado, setEstado] = useState<Estado & { ruta?: string }>({ paso: "pregunta" });
  const router = useRouter();
  if (estado.paso === "cancelado") return <p className="mt-3 text-sm text-muted-foreground">{estado.mensaje ?? "Listo, no registré nada."}</p>;
  if (estado.id)
    return (
      <Hecho
        mensaje={estado.mensaje ?? ""}
        ocupado={estado.paso === "enviando"}
        deshacer={async () => {
          setEstado((e) => ({ ...e, paso: "enviando" }));
          const r = await api(estado.ruta!, "DELETE", { id: estado.id });
          setEstado(r.ok ? { paso: "cancelado", mensaje: r.mensaje } : { ...estado, mensaje: r.mensaje });
          if (r.ok) router.refresh();
        }}
      />
    );
  return (
    <form
      className="mt-3 grid gap-2 border-t pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado({ paso: "enviando" });
        const ingreso = origen === "ingreso";
        const ruta = ingreso ? "/api/asesor/gasto" : "/api/asesor/mover";
        const r = await api(
          ruta,
          "POST",
          ingreso
            ? { tipo: "ingreso", monto: numeroDe(monto), comercio: "Depósito", fecha: deposito.fecha, account_id: deposito.destino_id, category_id: null }
            : { origen_id: origen, destino_id: deposito.destino_id, monto: numeroDe(monto), fecha: deposito.fecha },
        );
        setEstado(r.ok ? { paso: "hecho", mensaje: r.mensaje, id: r.id, ruta } : { paso: "pregunta", mensaje: r.mensaje });
        if (r.ok) router.refresh();
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Monto</span>
        <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" aria-label="Monto" className={CAMPO} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">¿De dónde salió?</span>
        <select value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="De dónde salió" className={CAMPO}>
          <option value="" disabled>
            Elige
          </option>
          <option value="ingreso">Dinero nuevo (ingreso)</option>
          {deposito.cuentas
            .filter((c) => !c.credito)
            .map((c) => (
              <option key={c.id} value={c.id}>
                De {c.nombre}
              </option>
            ))}
        </select>
      </label>
      {estado.mensaje && <p className="text-sm text-destructive">{estado.mensaje}</p>}
      <Botones ocupado={estado.paso === "enviando"} listo={!!origen && numeroDe(monto) > 0} cancelar={() => setEstado({ paso: "cancelado" })} />
    </form>
  );
}
