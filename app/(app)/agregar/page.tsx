import { Titulo } from "@/components/taos/encabezado";
import Link from "next/link";
import { CamposMovimiento } from "@/components/campos-movimiento";
import { CapturaRapida } from "@/components/captura-rapida";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { ImportadorArchivo, ImportadorPdf } from "@/components/importador";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Select } from "@/components/ui/campos";
import { deshacerImportacion, guardarMovimiento, moverImportacion } from "@/lib/acciones";
import { hoyLocal } from "@/lib/formato";
import { iaDisponible } from "@/lib/ia";
import { obtenerRepo } from "@/lib/sesion";

export default async function Agregar() {
  const repo = await obtenerRepo();
  const [cuentas, categorias, importaciones] = await Promise.all([repo.cuentas(), repo.categorias(), repo.importaciones()]);

  if (!cuentas.length) {
    return (
      <Card>
        <CardTitle>Primero agrega una cuenta</CardTitle>
        <CardDescription className="mt-2">
          Ve a{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>{" "}
          y agrega tu cuenta de débito, tarjeta de crédito o efectivo.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Titulo>Agregar</Titulo>
      <Card>
        <CardHeader>
          <CardTitle>Captura rápida</CardTitle>
        </CardHeader>
        <CardDescription className="mb-3">
          Escribe el gasto como lo dirías: monto, en qué y con qué pagaste. Ejemplos: "350 súper con débito", "ayer 1,200
          gasolina tdc", "cobré 9000 de la quincena".
        </CardDescription>
        <CapturaRapida />
      </Card>

      <Desplegable titulo="Agregar un movimiento a mano">
        <Formulario accion={guardarMovimiento} limpiar boton="Agregar">
          <CamposMovimiento cuentas={cuentas} categorias={categorias} hoy={hoyLocal()} />
        </Formulario>
      </Desplegable>

      <Desplegable titulo="Importar estado de cuenta">
        <div className="grid gap-4">
          <ImportadorArchivo cuentas={cuentas} />
          <div className="border-t pt-4">
            <ImportadorPdf cuentas={cuentas} iaActiva={iaDisponible()} />
          </div>
        </div>
      </Desplegable>


      {importaciones.length > 0 && (
        <Desplegable titulo="Importaciones recientes">
          <p className="mb-3 text-sm text-muted-foreground">
            ¿Importaste un archivo en la cuenta equivocada? Ábrelo para cambiarle la cuenta o deshacerlo.
          </p>
          <div className="grid gap-2">
            {importaciones.map((i) => (
              <Desplegable
                key={i.id}
                titulo={
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="truncate">{i.nombre_archivo}</span>
                    <span className="flex shrink-0 items-center gap-2 font-normal text-muted-foreground">
                      {i.movimientos_detectados} movs.
                      <Badge tono={i.estado === "error" ? "rojo" : "neutro"}>{i.estado}</Badge>
                    </span>
                  </span>
                }
              >
                <Formulario accion={moverImportacion} boton="Mover a esta cuenta" >
                  <input type="hidden" name="id" value={i.id} />
                  <Select name="account_id" aria-label="Cuenta correcta" defaultValue="">
                    <option value="" disabled>
                      Cuenta correcta…
                    </option>
                    {cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </Formulario>
                <div className="mt-3 border-t pt-3">
                  <BotonAccion
                    accion={deshacerImportacion.bind(null, i.id)}
                    confirmar={`¿Borrar todos los movimientos de "${i.nombre_archivo}"?`}
                    variant="destructive"
                  >
                    Deshacer importación
                  </BotonAccion>
                </div>
              </Desplegable>
            ))}
          </div>
        </Desplegable>
      )}
    </div>
  );
}
