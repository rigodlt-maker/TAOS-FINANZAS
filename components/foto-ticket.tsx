"use client";

// Foto del ticket → gasto. El texto se lee en tu celular (tesseract.js, gratis y sin IA: la foto no se sube a ningún lado).
// La app propone total, fecha, comercio, tarjeta (por sus últimos 4 dígitos) y categoría; tú revisas y guardas.
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { guardarMovimiento, proponerTicket, type Resultado, type TicketPropuesto } from "@/lib/acciones";
import type { Categoria, Cuenta } from "@/lib/tipos";
import { Mensaje } from "./formulario";
import { Button } from "./ui/button";
import { Input, Label, Select } from "./ui/campos";

// Achica y pasa a gris la foto: el OCR es más rápido y lee mejor
async function prepararFoto(archivo: File): Promise<HTMLCanvasElement> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.3)";
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

export function FotoTicket({ cuentas, categorias, hoy }: { cuentas: Cuenta[]; categorias: Categoria[]; hoy: string }) {
  const [estado, setEstado] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<TicketPropuesto | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  async function leer(archivo: File) {
    setPropuesta(null);
    setResultado(null);
    try {
      setEstado("Preparando la lectura (la primera vez tarda unos segundos)…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("spa");
      setEstado("Leyendo tu ticket…");
      const { data } = await worker.recognize(await prepararFoto(archivo));
      await worker.terminate();
      setEstado(null);
      setPropuesta(await proponerTicket(data.text));
    } catch {
      setEstado(null);
      setResultado({ ok: false, mensaje: "No pude leer la foto. Intenta con más luz, el ticket derecho y sin arrugas." });
    }
  }

  const tarjeta = propuesta?.account_id ? cuentas.find((c) => c.id === propuesta.account_id) : null;

  return (
    <div className="grid gap-3">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) leer(archivo);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" onClick={() => entrada.current?.click()} disabled={!!estado}>
        {estado ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        {estado ? "Leyendo…" : "Tomar foto del ticket"}
      </Button>
      {estado && <p className="text-sm text-muted-foreground">{estado}</p>}

      {propuesta && (
        <form
          key={JSON.stringify(propuesta)}
          className="grid gap-3 rounded-xl border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            iniciar(async () => {
              const r = await guardarMovimiento(datos);
              setResultado(r);
              if (r.ok) setPropuesta(null);
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            {tarjeta
              ? `Pagaste con ${tarjeta.nombre}${propuesta.terminacion ? ` (termina en ${propuesta.terminacion})` : ""}.`
              : propuesta.tarjetaDesconocida
                ? `La tarjeta termina en ${propuesta.terminacion}, pero ninguna de tus cuentas tiene esa terminación. Elige la cuenta y, para la próxima, agrégale sus últimos 4 dígitos en Ajustes.`
                : "Revisa los datos y elige con qué pagaste."}
          </p>
          <input type="hidden" name="tipo" value="gasto" />
          <div className="grid grid-cols-2 gap-3">
            <Label>
              Total
              <Input name="monto" inputMode="decimal" defaultValue={propuesta.total ?? ""} required />
            </Label>
            <Label>
              Fecha
              <Input name="fecha" type="date" defaultValue={propuesta.fecha ?? hoy} required />
            </Label>
          </div>
          <Label>
            Comercio
            <Input name="descripcion" defaultValue={propuesta.comercio ?? ""} placeholder="Ej. Oxxo" required />
          </Label>
          <Label>
            Cuenta
            <Select name="account_id" defaultValue={propuesta.account_id ?? ""} required>
              <option value="" disabled>
                ¿Con qué pagaste?
              </option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.terminacion ? ` · ${c.terminacion}` : ""}
                </option>
              ))}
            </Select>
          </Label>
          <Label>
            Categoría
            <Select name="category_id" defaultValue={propuesta.category_id ?? ""}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Label>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar gasto"}
          </Button>
        </form>
      )}
      {resultado && <Mensaje resultado={resultado} />}
    </div>
  );
}
