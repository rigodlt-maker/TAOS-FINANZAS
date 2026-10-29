import { CalendarPlus, Trash2 } from "lucide-react";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/campos";
import { borrarPrestamoAccion, cobrarPrestamo } from "@/lib/acciones";
import { abiertos, enlaceCalendario, pendiente } from "@/lib/envios";
import { dinero, fechaCorta, hoyLocal } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import type { Prestamo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Dinero que prestaste: quién te debe, cuánto y cuándo te paga
export default async function Prestamos() {
  const repo = await obtenerRepo();
  const hoy = hoyLocal();
  let prestamos: Prestamo[];
  try {
    prestamos = await repo.prestamos();
  } catch {
    return (
      <div className="grid gap-4">
        <Titulo>Préstamos</Titulo>
        <Card>
          <CardTitle>Falta un paso</CardTitle>
          <CardDescription className="mt-2">Corre en Supabase el SQL de “préstamos” (0006_prestamos.sql) y vuelve a abrir esta pantalla.</CardDescription>
        </Card>
      </div>
    );
  }
  const cuentas = await repo.cuentas();
  const abiertas = abiertos(prestamos).sort((a, b) => (a.fecha_pago ?? "9").localeCompare(b.fecha_pago ?? "9"));
  const pagados = prestamos.filter((p) => !abiertas.includes(p)).slice(0, 15);
  const total = abiertas.reduce((t, p) => t + pendiente(p), 0);

  return (
    <div className="grid gap-4">
      <Titulo detalle="Dile a Tao “Le presté 5 mil a Juan, me paga el 15 de noviembre” y aparece aquí. No cuenta como gasto: es dinero a tu favor.">Préstamos</Titulo>
      <Card>
        <p className="text-sm text-muted-foreground">Te deben</p>
        <p className="text-3xl font-semibold text-primary">{dinero(total)}</p>
      </Card>
      {abiertas.length === 0 && <CardDescription className="text-center">Nadie te debe dinero ahorita.</CardDescription>}
      {abiertas.map((p) => {
        const calendario = enlaceCalendario(p);
        return (
          <Card key={p.id} className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{p.persona}</p>
                <p className="text-sm text-muted-foreground">
                  Le prestaste {dinero(p.monto)} el {fechaCorta(p.fecha)}
                  {p.abonado > 0 && ` · ya te pagó ${dinero(p.abonado)}`}
                </p>
                {p.fecha_pago && (
                  <p className={`text-sm ${p.fecha_pago < hoy ? "text-destructive" : "text-muted-foreground"}`}>
                    {p.fecha_pago < hoy ? "Se pasó del " : "Te paga el "}
                    {fechaCorta(p.fecha_pago)}
                  </p>
                )}
                {p.nota && <p className="text-sm">{p.nota}</p>}
              </div>
              <span className="text-lg font-semibold whitespace-nowrap">{dinero(pendiente(p))}</span>
            </div>
            <Desplegable titulo={<span className="text-sm">Registrar que te pagó</span>}>
              <Formulario accion={cobrarPrestamo.bind(null, p.id)} boton="Registrar pago">
                <Label>
                  Cuánto te pagó
                  <Input name="monto" inputMode="decimal" defaultValue={pendiente(p)} required />
                </Label>
                <Label>
                  ¿A qué cuenta te llegó?
                  <Select name="cuenta_id" defaultValue={p.cuenta_id ?? ""} required>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </Label>
              </Formulario>
            </Desplegable>
            <div className="flex flex-wrap items-center gap-2">
              {calendario && (
                <a href={calendario} target="_blank" className="flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm text-primary">
                  <CalendarPlus className="size-4" /> Recordatorio
                </a>
              )}
              <BotonAccion accion={borrarPrestamoAccion.bind(null, p.id)} confirmar="¿Borrar este préstamo? Se regresa el dinero a la cuenta de donde salió (si fue un error).">
                <Trash2 className="size-4" /> Borrar
              </BotonAccion>
            </div>
          </Card>
        );
      })}
      {pagados.length > 0 && (
        <Card>
          <CardTitle className="mb-2">Ya te pagaron</CardTitle>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {pagados.map((p) => (
              <li key={p.id}>
                {p.persona} · {dinero(p.monto)}
                {p.liquidado_el && ` · ${fechaCorta(p.liquidado_el)}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
