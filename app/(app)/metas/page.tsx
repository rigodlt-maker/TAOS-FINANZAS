import { Titulo } from "@/components/taos/encabezado";
import { Trash2 } from "lucide-react";
import { DeDondeSaco } from "@/components/de-donde-saco";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Label, Progreso } from "@/components/ui/campos";
import { aportarAMeta, borrarMeta, guardarMeta } from "@/lib/acciones";
import { dinero, dineroCorto, fechaCorta, hoyLocal, sumarDias } from "@/lib/formato";
import { analizarMeta } from "@/lib/metas";
import { obtenerRepo } from "@/lib/sesion";
import type { Meta } from "@/lib/tipos";

function CamposMeta({ meta }: { meta?: Meta }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {meta && <input type="hidden" name="id" value={meta.id} />}
      <Label className="sm:col-span-2">
        Nombre
        <Input name="nombre" defaultValue={meta?.nombre} placeholder="Fondo de emergencia" required />
      </Label>
      <Label>
        Monto objetivo
        <Input name="monto_objetivo" inputMode="decimal" defaultValue={meta?.monto_objetivo} required />
      </Label>
      <Label>
        Ya tengo ahorrado
        <Input name="monto_actual" inputMode="decimal" defaultValue={meta?.monto_actual ?? 0} />
      </Label>
      <Label>
        Fecha objetivo
        <Input name="fecha_objetivo" type="date" defaultValue={meta?.fecha_objetivo ?? sumarDias(hoyLocal(), 365)} required />
      </Label>
    </div>
  );
}

export default async function Metas() {
  const hoy = hoyLocal();
  const repo = await obtenerRepo();
  const [metas, aportaciones] = await Promise.all([repo.metas(), repo.aportaciones()]);
  const analisis = metas.map((m) => analizarMeta(m, aportaciones, hoy));

  return (
    <div className="grid gap-4">
      <Titulo>Metas</Titulo>
      <div className="grid gap-4">
        {analisis.map((a) => (
          <Card key={a.meta.id} className="grid gap-4">
            <CardHeader className="mb-0">
              <CardTitle>{a.meta.nombre}</CardTitle>
              {a.falta === 0 ? (
                <Badge tono="fuerte">¡Lograda!</Badge>
              ) : a.llegaATiempo ? (
                <Badge>A tiempo</Badge>
              ) : (
                <Badge tono="fuerte">
                  {a.mesesDeRetraso === null ? "Sin aportes recientes" : `${a.mesesDeRetraso} mes(es) de retraso`}
                </Badge>
              )}
            </CardHeader>
            <div className="grid gap-1.5">
              <div className="flex items-end justify-between">
                <span className="text-2xl font-semibold">{dinero(a.meta.monto_actual)}</span>
                <span className="text-sm text-muted-foreground">de {dinero(a.meta.monto_objetivo)}</span>
              </div>
              <Progreso valor={a.porcentaje} />
              <span className="text-xs text-muted-foreground">
                {Math.round(a.porcentaje)}% · faltan {dinero(a.falta)} para el {fechaCorta(a.meta.fecha_objetivo)}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Por mes</dt>
                <dd className="font-semibold">{dineroCorto(a.porMes)}</dd>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Por quincena</dt>
                <dd className="font-semibold">{dineroCorto(a.porQuincena)}</dd>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-xs text-muted-foreground">Tu ritmo al mes</dt>
                <dd className="font-semibold">{dineroCorto(a.ritmoMensual)}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              {a.falta === 0
                ? "Ya juntaste todo. 🎉"
                : a.llegaATiempo
                  ? `A tu ritmo actual llegas a tiempo.`
                  : a.mesesDeRetraso === null
                    ? `No has aportado en los últimos 3 meses. Para llegar a tiempo necesitas ${dinero(a.porMes)} al mes.`
                    : `A tu ritmo actual llegarías ${a.mesesDeRetraso} mes(es) tarde. Te faltan ${dinero(a.diferenciaMensual)} al mes.`}
            </p>
            {a.falta > 0 && !a.llegaATiempo && <DeDondeSaco metaId={a.meta.id} />}
            <Formulario accion={aportarAMeta} boton="Aportar" limpiar className="grid-cols-[1fr_auto] items-end">
              <input type="hidden" name="id" value={a.meta.id} />
              <Label>
                Registrar aportación (usa negativo para un retiro)
                <Input name="monto" inputMode="decimal" placeholder="1500" />
              </Label>
            </Formulario>
            <Desplegable titulo="Editar meta">
              <Formulario accion={guardarMeta}>
                <CamposMeta meta={a.meta} />
              </Formulario>
              <div className="mt-3 border-t pt-3">
                <BotonAccion accion={borrarMeta.bind(null, a.meta.id)} confirmar={`¿Borrar la meta "${a.meta.nombre}"?`} variant="destructive">
                  <Trash2 className="size-4" /> Borrar meta
                </BotonAccion>
              </div>
            </Desplegable>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nueva meta</CardTitle>
        </CardHeader>
        <Formulario accion={guardarMeta} limpiar boton="Crear meta">
          <CamposMeta />
        </Formulario>
      </Card>
    </div>
  );
}
