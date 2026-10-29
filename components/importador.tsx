"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { guardarImportacion, leerEstadoDeCuenta, revisarDuplicados, type FilaPrevia, type Resultado } from "@/lib/acciones";
import { dinero } from "@/lib/formato";
import { convertirFilas, detectarColumnas, separarEncabezados, type Mapeo, type Tabla } from "@/lib/importar";
import type { Cuenta } from "@/lib/tipos";
import { Mensaje } from "./formulario";
import { Button } from "./ui/button";
import { Badge, Input, Label, Select } from "./ui/campos";

const CAMPOS: { campo: keyof Mapeo; nombre: string }[] = [
  { campo: "fecha", nombre: "Fecha" },
  { campo: "descripcion", nombre: "Descripción" },
  { campo: "monto", nombre: "Monto (con signo)" },
  { campo: "cargo", nombre: "Cargo" },
  { campo: "abono", nombre: "Abono" },
];

async function leerTabla(archivo: File): Promise<unknown[][]> {
  if (/\.(xlsx|xls)$/i.test(archivo.name)) {
    // Primera hoja del libro, como filas y columnas
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(archivo, 1)) as unknown as unknown[][];
  }
  const textoArchivo = await archivo.text();
  return Papa.parse<unknown[]>(textoArchivo, { skipEmptyLines: true }).data;
}

// Importar CSV o Excel: detecta las columnas, muestra una vista previa y guarda al confirmar
export function ImportadorArchivo({ cuentas }: { cuentas: Cuenta[] }) {
  const [archivo, setArchivo] = useState<string>("");
  const [tabla, setTabla] = useState<Tabla | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [gastosNegativos, setGastosNegativos] = useState(true);
  const [previa, setPrevia] = useState<FilaPrevia[] | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  const convertidas = useMemo(() => (tabla && mapeo ? convertirFilas(tabla, mapeo, gastosNegativos) : []), [tabla, mapeo, gastosNegativos]);
  const errores = convertidas.filter((f) => !f.ok).length;

  return (
    <div className="grid gap-4">
      <Label>
        Archivo CSV o Excel de tu banco
        <Input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="h-auto py-2"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setResultado(null);
            setPrevia(null);
            if (!f) return;
            try {
              const t = separarEncabezados(await leerTabla(f));
              setArchivo(f.name);
              setTabla(t);
              setMapeo(detectarColumnas(t));
            } catch {
              setResultado({ ok: false, mensaje: "No se pudo leer el archivo." });
            }
          }}
        />
      </Label>

      {tabla && mapeo && !previa && (
        <div className="grid gap-3 rounded-lg border p-3">
          <p className="text-sm font-medium">1. Confirma qué columna es cada dato</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CAMPOS.map(({ campo, nombre }) => (
              <Label key={campo} className="text-xs">
                {nombre}
                <Select
                  value={mapeo[campo] ?? ""}
                  onChange={(e) => setMapeo({ ...mapeo, [campo]: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  <option value="">—</option>
                  {tabla.encabezados.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </Label>
            ))}
          </div>
          {mapeo.monto !== null && mapeo.cargo === null && mapeo.abono === null && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={gastosNegativos} onChange={(e) => setGastosNegativos(e.target.checked)} />
              Los gastos vienen en negativo
            </label>
          )}
          <p className="text-sm text-muted-foreground">
            {convertidas.length - errores} movimientos reconocidos{errores ? `, ${errores} filas ignoradas (sin fecha o monto)` : ""}.
          </p>
          <Button
            type="button"
            disabled={pendiente || convertidas.length === errores}
            onClick={() =>
              iniciar(async () => {
                const validos = convertidas.flatMap((f) => (f.ok ? [f.movimiento] : []));
                setPrevia(await revisarDuplicados(validos));
              })
            }
          >
            Ver vista previa
          </Button>
        </div>
      )}

      {previa && (
        <VistaPrevia
          filas={previa}
          cuentas={cuentas}
          pendiente={pendiente}
          alCancelar={() => setPrevia(null)}
          alGuardar={(cuenta) =>
            iniciar(async () => {
              const r = await guardarImportacion({
                account_id: cuenta,
                nombre_archivo: archivo,
                movimientos: previa.filter((p) => !p.duplicado),
              });
              setResultado(r);
              if (r.ok) {
                setPrevia(null);
                setTabla(null);
              }
            })
          }
        />
      )}
      {resultado && <Mensaje resultado={resultado} />}
    </div>
  );
}

// Estado de cuenta en PDF: se lee con IA y se muestra la misma vista previa
export function ImportadorPdf({ cuentas, iaActiva }: { cuentas: Cuenta[]; iaActiva: boolean }) {
  const [previa, setPrevia] = useState<FilaPrevia[] | null>(null);
  const [datos, setDatos] = useState<{ nombre: string; ruta: string | null }>({ nombre: "", ruta: null });
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!iaActiva) {
    return (
      <p className="text-sm text-muted-foreground">
        Leer PDF necesita la IA activada (ANTHROPIC_API_KEY). Mientras tanto, descarga tu estado de cuenta en CSV o Excel desde
        la banca en línea y súbelo arriba.
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      <form
        className="grid gap-2"
        action={(f) =>
          iniciar(async () => {
            setResultado(null);
            const archivo = f.get("archivo");
            const r = await leerEstadoDeCuenta(f);
            if (!r.ok) return setResultado(r);
            setDatos({ nombre: archivo instanceof File ? archivo.name : "estado.pdf", ruta: r.ruta });
            setPrevia(r.movimientos);
          })
        }
      >
        <Label>
          Estado de cuenta en PDF
          <Input type="file" name="archivo" accept="application/pdf" className="h-auto py-2" required />
        </Label>
        <Button type="submit" variant="outline" disabled={pendiente}>
          {pendiente && !previa ? "Leyendo el PDF… (puede tardar un minuto)" : "Leer movimientos"}
        </Button>
      </form>
      {previa && (
        <VistaPrevia
          filas={previa}
          cuentas={cuentas}
          pendiente={pendiente}
          alCancelar={() => setPrevia(null)}
          alGuardar={(cuenta) =>
            iniciar(async () => {
              const r = await guardarImportacion({
                account_id: cuenta,
                nombre_archivo: datos.nombre,
                ruta_storage: datos.ruta,
                movimientos: previa.filter((p) => !p.duplicado),
              });
              setResultado(r);
              if (r.ok) setPrevia(null);
            })
          }
        />
      )}
      {resultado && <Mensaje resultado={resultado} />}
    </div>
  );
}

function VistaPrevia({
  filas,
  cuentas,
  pendiente,
  alGuardar,
  alCancelar,
}: {
  filas: FilaPrevia[];
  cuentas: Cuenta[];
  pendiente: boolean;
  alGuardar: (cuenta: string) => void;
  alCancelar: () => void;
}) {
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const nuevas = filas.filter((f) => !f.duplicado);
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">
        2. Vista previa: {nuevas.length} nuevos, {filas.length - nuevas.length} duplicados (no se guardarán)
      </p>
      <div className="max-h-80 overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">Fecha</th>
              <th className="px-2 py-1.5">Descripción</th>
              <th className="px-2 py-1.5 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((f, i) => (
              <tr key={i} className={f.duplicado ? "text-muted-foreground line-through" : ""}>
                <td className="px-2 py-1.5 whitespace-nowrap">{f.fecha}</td>
                <td className="px-2 py-1.5">
                  {f.descripcion_original} {f.duplicado && <Badge>duplicado</Badge>}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {f.tipo === "ingreso" ? "+" : "−"}
                  {dinero(f.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Label className="min-w-48 flex-1">
          Cuenta
          <Select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Label>
        <Button type="button" disabled={pendiente || !nuevas.length || !cuenta} onClick={() => alGuardar(cuenta)}>
          {pendiente ? "Guardando…" : `Guardar ${nuevas.length} movimientos`}
        </Button>
        <Button type="button" variant="ghost" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
