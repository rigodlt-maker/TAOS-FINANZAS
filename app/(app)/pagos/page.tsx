import { Titulo } from "@/components/taos/encabezado";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { variantesBoton } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Label, Select } from "@/components/ui/campos";
import { borrarPago, guardarPago } from "@/lib/acciones";
import { diasDelMes, diasEntre, dinero, fechaCorta, hoyLocal, mesDe, nombreMes, sumarMeses } from "@/lib/formato";
import { actualizarVencimiento, eventosDelMes, proximoLimiteTarjeta, saldoDisponible } from "@/lib/pagos";
import { obtenerRepo } from "@/lib/sesion";
import { contextoTarjetas, estadoTarjeta, lineaTarjeta } from "@/lib/tarjetas";
import type { Cuenta, PagoProgramado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function CamposPago({ pago, cuentas, hoy }: { pago?: PagoProgramado; cuentas: Cuenta[]; hoy: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pago && <input type="hidden" name="id" value={pago.id} />}
      <Label>
        Nombre
        <Input name="nombre" defaultValue={pago?.nombre} placeholder="Pago tarjeta, renta, seguro…" required />
      </Label>
      <Label>
        Monto
        <Input name="monto" inputMode="decimal" defaultValue={pago?.monto} required />
      </Label>
      <Label>
        Próximo vencimiento
        <Input name="proximo_vencimiento" type="date" defaultValue={pago?.proximo_vencimiento ?? hoy} required />
      </Label>
      <Label>
        Frecuencia
        <Select name="frecuencia" defaultValue={pago?.frecuencia ?? "mensual"}>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
          <option value="unica">Una sola vez</option>
        </Select>
      </Label>
      <Label className="sm:col-span-2">
        Se paga desde
        <Select name="account_id" defaultValue={pago?.account_id ?? ""}>
          <option value="">Sin cuenta asociada</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Label>
    </div>
  );
}

export default async function Pagos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const hoy = hoyLocal();
  const { mes: mesPedido } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesPedido ?? "") ? mesPedido! : mesDe(hoy);
  const repo = await obtenerRepo();
  const [pagos, cuentas, ctx] = await Promise.all([repo.pagos(), repo.cuentas(), contextoTarjetas(repo, hoy)]);
  const vigentes = pagos.map((p) => ({ ...p, proximo_vencimiento: actualizarVencimiento(p, hoy) }));
  const eventos = eventosDelMes(mes, vigentes, cuentas);

  // Cuadrícula del mes empezando en lunes
  const [anio, numMes] = mes.split("-").map(Number);
  const primerDia = (new Date(Date.UTC(anio, numMes - 1, 1)).getUTCDay() + 6) % 7;
  const celdas = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasDelMes(anio, numMes) }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  const cuenta = (id: string | null) => cuentas.find((c) => c.id === id);

  return (
    <div className="grid gap-4">
      <Titulo>Pagos</Titulo>
      {cuentas.some((c) => c.tipo === "credito") && (
        <Card>
          <CardHeader>
            <CardTitle>Tus tarjetas</CardTitle>
          </CardHeader>
          <ul className="divide-y">
            {cuentas
              .filter((c) => c.tipo === "credito")
              .map((c) => ({ c, limite: proximoLimiteTarjeta(c, hoy), e: estadoTarjeta(c, ctx.movimientos, ctx.transferencias, hoy) }))
              .sort((a, b) => (a.limite ?? "9").localeCompare(b.limite ?? "9"))
              .map(({ c, e }) => (
                <li key={c.id}>
                  <Link href={`/pagar/${c.id}`} className="flex min-h-16 items-center justify-between gap-3 active:bg-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {lineaTarjeta(e)}
                        {e.total >= 0.5 && e.nuevas > 0.5 && ` · total ${dinero(e.total)}`}
                      </span>
                    </span>
                    <span className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Pagar</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader>
          <Link href={`/pagos?mes=${sumarMeses(mes, -1)}`} className={variantesBoton({ variant: "ghost", size: "icon" })} aria-label="Mes anterior">
            <ChevronLeft className="size-5" />
          </Link>
          <CardTitle className="first-letter:uppercase">{nombreMes(mes)}</CardTitle>
          <Link href={`/pagos?mes=${sumarMeses(mes, 1)}`} className={variantesBoton({ variant: "ghost", size: "icon" })} aria-label="Mes siguiente">
            <ChevronRight className="size-5" />
          </Link>
        </CardHeader>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {DIAS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((fecha, i) =>
            fecha ? (
              <div
                key={fecha}
                className={cn("min-h-16 rounded-lg border p-1 text-xs sm:min-h-20", fecha === hoy && "border-foreground")}
              >
                <div className={cn("mb-0.5 text-muted-foreground", fecha === hoy && "font-semibold text-foreground")}>
                  {Number(fecha.slice(8))}
                </div>
                {/* Celular: puntos; computadora: nombre del evento */}
                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {eventos
                    .filter((e) => e.fecha === fecha)
                    .map((e, j) => (
                      <span
                        key={j}
                        className={cn(
                          "size-2 rounded-full",
                          e.tipo === "pago" && "bg-foreground",
                          e.tipo === "limite" && "border border-foreground",
                          e.tipo === "corte" && "bg-muted-foreground/40",
                        )}
                      />
                    ))}
                </div>
                <div className="hidden sm:block">
                  {eventos
                    .filter((e) => e.fecha === fecha)
                    .map((e, j) => (
                      <div
                        key={j}
                        title={`${e.titulo}${e.monto ? ` · ${dinero(e.monto)}` : ""}`}
                        className={cn(
                          "mb-0.5 truncate rounded px-1 py-0.5 leading-tight",
                          e.tipo === "pago" && "bg-foreground text-background",
                          e.tipo === "limite" && "border border-foreground",
                          e.tipo === "corte" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {e.titulo}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div key={`v${i}`} />
            ),
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-foreground" /> Pago programado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded border border-foreground" /> Fecha límite de tarjeta
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3 rounded bg-muted" /> Fecha de corte
          </span>
        </div>
        {eventos.length > 0 && (
          <ul className="mt-4 divide-y border-t text-sm">
            {eventos.map((e, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span>
                  <span className="text-muted-foreground">{fechaCorta(e.fecha)} · </span>
                  {e.titulo}
                </span>
                {e.monto !== undefined && <span className="whitespace-nowrap">{dinero(e.monto)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pagos programados</CardTitle>
          </CardHeader>
          <CardDescription className="mb-3">
            Te llega un correo cuando falten 7 y 2 días, con el monto y si el saldo de la cuenta alcanza.
          </CardDescription>
          <div className="grid gap-2">
            {vigentes
              .sort((a, b) => a.proximo_vencimiento.localeCompare(b.proximo_vencimiento))
              .map((p) => {
                const c = cuenta(p.account_id);
                const dias = diasEntre(hoy, p.proximo_vencimiento);
                const alcanza = c ? saldoDisponible(c) >= p.monto : null;
                return (
                  <Desplegable
                    key={p.id}
                    titulo={
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span>
                          {p.nombre}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {fechaCorta(p.proximo_vencimiento)} · {dias === 0 ? "hoy" : `en ${dias} días`}
                            {c && ` · ${c.nombre}`}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          {dinero(p.monto)}
                          {alcanza === false && <Badge tono="rojo">Saldo insuficiente</Badge>}
                        </span>
                      </span>
                    }
                  >
                    <Formulario accion={guardarPago}>
                      <CamposPago pago={p} cuentas={cuentas} hoy={hoy} />
                    </Formulario>
                    <div className="mt-3 border-t pt-3">
                      <BotonAccion accion={borrarPago.bind(null, p.id)} confirmar={`¿Borrar "${p.nombre}"?`} variant="destructive">
                        <Trash2 className="size-4" /> Borrar
                      </BotonAccion>
                    </div>
                  </Desplegable>
                );
              })}
            <Desplegable titulo="Agregar pago" abierto={pagos.length === 0}>
              <Formulario accion={guardarPago} limpiar boton="Agregar">
                <CamposPago cuentas={cuentas} hoy={hoy} />
              </Formulario>
            </Desplegable>
          </div>
        </Card>
      </div>
    </div>
  );
}
