import { ArrowRight, Undo2 } from "lucide-react";
import { BotonAccion, Formulario } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/campos";
import { deshacerTransferencia, registrarTransferencia } from "@/lib/acciones";
import { dinero, fechaCorta, hoyLocal } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";

export default async function EntreCuentas() {
  const repo = await obtenerRepo();
  const [cuentas, transferencias] = await Promise.all([repo.cuentas(), repo.transferencias(30)]);
  const nombre = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? "Cuenta borrada";
  const opciones = cuentas.map((c) => (
    <option key={c.id} value={c.id}>
      {c.nombre}
    </option>
  ));

  return (
    <div className="grid gap-4">
      <Titulo detalle="Pagar una tarjeta, sacar efectivo o pasar dinero entre tus cuentas. No cuenta como gasto.">Entre cuentas</Titulo>
      <Card>
        <Formulario accion={registrarTransferencia} boton="Mover dinero" limpiar>
          <Label>
            De dónde sale
            <Select name="origen_id" required defaultValue={cuentas.find((c) => c.tipo === "debito")?.id}>
              {opciones}
            </Select>
          </Label>
          <Label>
            A dónde llega
            <Select name="destino_id" required defaultValue={cuentas.find((c) => c.tipo === "credito")?.id}>
              {opciones}
            </Select>
          </Label>
          <Label>
            Cuánto
            <Input name="monto" inputMode="decimal" placeholder="5000" required />
          </Label>
          <Label>
            Fecha
            <Input name="fecha" type="date" defaultValue={hoyLocal()} />
          </Label>
          <Label>
            Nota (opcional)
            <Input name="nota" placeholder="Pago de octubre" />
          </Label>
        </Formulario>
        <CardDescription className="mt-4">
          También puedes escribirlo en <strong className="text-foreground">Agregar › Captura rápida</strong>, por ejemplo: “Pagué 5 mil de Palacio con Revolut”.
        </CardDescription>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        {transferencias.length === 0 ? (
          <CardDescription>Todavía no has movido dinero entre cuentas.</CardDescription>
        ) : (
          <ul className="divide-y">
            {transferencias.map((t) => (
              <li key={t.id} className="grid gap-1 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="truncate">{nombre(t.origen_id)}</span>
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{nombre(t.destino_id)}</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">{dinero(t.monto)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {fechaCorta(t.fecha)}
                    {t.nota && ` · ${t.nota}`}
                  </span>
                  <BotonAccion accion={deshacerTransferencia.bind(null, t.id)} confirmar="¿Deshacer este movimiento? Los saldos regresan como estaban.">
                    <Undo2 className="size-4" /> Deshacer
                  </BotonAccion>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
