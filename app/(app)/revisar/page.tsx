import { Titulo } from "@/components/taos/encabezado";
import { BotonAccion } from "@/components/formulario";
import { SelectorCategoria } from "@/components/revisar-fila";
import { recategorizarPendientes } from "@/lib/acciones";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dinero, fechaCorta } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";

export default async function Revisar() {
  const repo = await obtenerRepo();
  const [pendientes, categorias] = await Promise.all([repo.movimientos({ soloPorRevisar: true }), repo.categorias()]);
  return (
    <div className="grid gap-4">
      <Titulo>Por revisar</Titulo>
      <Card>
        <CardHeader>
          <CardTitle>Por revisar</CardTitle>
          <span className="text-sm text-muted-foreground">{pendientes.length} pendientes</span>
        </CardHeader>
        <CardDescription>
          Elige la categoría correcta con un clic. La app aprende: crea una regla y la próxima vez lo categoriza sola.
        </CardDescription>
        {pendientes.length > 0 && (
          <div className="mt-3">
            <BotonAccion accion={recategorizarPendientes} variant="outline" size="default">
              Intentar categorizar automáticamente
            </BotonAccion>
            <p className="mt-1 text-xs text-muted-foreground">Útil después de crear categorías nuevas, como Seguros o Mascotas.</p>
          </div>
        )}
      </Card>
      {pendientes.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">Todo está categorizado. 🎉</p>
        </Card>
      )}
      {pendientes.map((m) => (
        <Card key={m.id} className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{m.comercio || m.descripcion_original}</p>
              <p className="truncate text-xs text-muted-foreground">
                {fechaCorta(m.fecha)} · {m.descripcion_original}
              </p>
            </div>
            <p className="font-semibold whitespace-nowrap">{dinero(m.monto)}</p>
          </div>
          <SelectorCategoria movimientoId={m.id} sugerida={m.category_id} categorias={categorias} />
        </Card>
      ))}
    </div>
  );
}
