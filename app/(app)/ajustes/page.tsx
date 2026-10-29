import { Titulo } from "@/components/taos/encabezado";
import { AvisosPush } from "@/components/avisos-push";
import { FormularioContrasena } from "@/components/contrasena";
import { Trash2 } from "lucide-react";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Label, Select } from "@/components/ui/campos";
import {
  borrarCategoria,
  borrarCuenta,
  borrarDatosDeEjemplo,
  borrarRegla,
  cargarDatosDeEjemplo,
  guardarCategoria,
  guardarCuenta,
  probarReporteSemanal,
} from "@/lib/acciones";
import { dinero } from "@/lib/formato";
import { iaDisponible } from "@/lib/ia";
import { obtenerRepo } from "@/lib/sesion";
import { NOMBRES_TIPO_CUENTA, type Cuenta } from "@/lib/tipos";

function CamposCuenta({ cuenta }: { cuenta?: Cuenta }) {
  return (
    <>
      {cuenta && <input type="hidden" name="id" value={cuenta.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Nombre
          <Input name="nombre" defaultValue={cuenta?.nombre} placeholder="BBVA Débito" required />
        </Label>
        <Label>
          Tipo
          <Select name="tipo" defaultValue={cuenta?.tipo ?? "debito"}>
            {Object.entries(NOMBRES_TIPO_CUENTA).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Saldo actual
          <Input name="saldo_actual" inputMode="decimal" defaultValue={cuenta?.saldo_actual ?? 0} />
          <span className="text-xs font-normal text-muted-foreground">En tarjetas de crédito, lo que debes en negativo.</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label>
            Día de corte
            <Input name="dia_corte" type="number" min={1} max={31} defaultValue={cuenta?.dia_corte ?? ""} placeholder="Solo crédito" />
          </Label>
          <Label>
            Día límite de pago
            <Input name="dia_limite_pago" type="number" min={1} max={31} defaultValue={cuenta?.dia_limite_pago ?? ""} placeholder="Solo crédito" />
          </Label>
          <p className="col-span-2 text-xs text-muted-foreground">
            Copia ambos días de tu último estado de cuenta. Te avisamos por correo 7 y 2 días antes de la fecha límite.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Label>
            Rendimiento anual %
            <Input name="tasa_anual" inputMode="decimal" defaultValue={cuenta?.tasa_anual ?? ""} placeholder="13" />
          </Label>
          <Label>
            Hasta (tope)
            <Input name="tope_tasa" inputMode="decimal" defaultValue={cuenta?.tope_tasa ?? ""} placeholder="25000" />
          </Label>
          <Label>
            % arriba del tope
            <Input name="tasa_excedente" inputMode="decimal" defaultValue={cuenta?.tasa_excedente ?? ""} placeholder="6.5" />
          </Label>
          <p className="col-span-3 text-xs text-muted-foreground">
            Solo cuentas de ahorro (p. ej. Cajita Turbo: 13% hasta 25,000). El rendimiento se suma solo cada día, con interés compuesto. Deja vacío si no da rendimiento.
          </p>
        </div>
      </div>
    </>
  );
}

export default async function Ajustes() {
  const repo = await obtenerRepo();
  const [cuentas, categorias, reglas] = await Promise.all([repo.cuentas(), repo.categorias(), repo.reglas()]);
  const nombreCategoria = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? "—";
  const totalPresupuesto = categorias.reduce((t, c) => t + c.presupuesto_mensual, 0);

  return (
    <div className="grid gap-4">
      <Titulo>Ajustes</Titulo>
      <Card>
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
        </CardHeader>
        <CardDescription className="mb-3">Crea una contraseña para entrar sin esperar el enlace por correo, también desde la app instalada en tu celular.</CardDescription>
        <FormularioContrasena />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones en el celular</CardTitle>
        </CardHeader>
        <CardDescription className="mb-3">
          Avisos de pagos de tarjeta, pagos programados, cobros de préstamos y correos del banco que se registraron. Actívalas en cada celular o
          computadora donde las quieras.
        </CardDescription>
        <AvisosPush />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
        </CardHeader>
        <div className="grid gap-2">
          {cuentas.map((c) => (
            <Desplegable
              key={c.id}
              titulo={
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span>
                    {c.nombre} <Badge>{NOMBRES_TIPO_CUENTA[c.tipo]}</Badge>
                  </span>
                  <span className="tabular-nums">{dinero(c.saldo_actual)}</span>
                </span>
              }
            >
              <Formulario accion={guardarCuenta}>
                <CamposCuenta cuenta={c} />
              </Formulario>
              <div className="mt-3 border-t pt-3">
                <BotonAccion
                  accion={borrarCuenta.bind(null, c.id)}
                  confirmar={`¿Borrar "${c.nombre}" y todos sus movimientos?`}
                  variant="destructive"
                >
                  <Trash2 className="size-4" /> Borrar cuenta
                </BotonAccion>
              </div>
            </Desplegable>
          ))}
          <Desplegable titulo="Agregar cuenta" abierto={cuentas.length === 0}>
            <Formulario accion={guardarCuenta} limpiar boton="Agregar">
              <CamposCuenta />
            </Formulario>
          </Desplegable>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías y presupuesto mensual</CardTitle>
          <span className="text-sm text-muted-foreground">Total {dinero(totalPresupuesto)}</span>
        </CardHeader>
        <div className="grid gap-2">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-end gap-2">
              <Formulario accion={guardarCategoria} boton="✓" className="flex-1 grid-cols-[1fr_8rem_auto] items-end">
                <input type="hidden" name="id" value={c.id} />
                <Input name="nombre" defaultValue={c.nombre} aria-label="Nombre" />
                <Input name="presupuesto_mensual" inputMode="decimal" defaultValue={c.presupuesto_mensual} aria-label="Presupuesto" />
              </Formulario>
              <BotonAccion accion={borrarCategoria.bind(null, c.id)} confirmar={`¿Borrar la categoría "${c.nombre}"?`} size="icon">
                <Trash2 className="size-4" />
              </BotonAccion>
            </div>
          ))}
          <Formulario accion={guardarCategoria} boton="Agregar" limpiar className="mt-2 grid-cols-[1fr_8rem_auto] items-end">
            <Input name="nombre" placeholder="Nueva categoría" aria-label="Nombre" />
            <Input name="presupuesto_mensual" inputMode="decimal" placeholder="0" aria-label="Presupuesto" />
          </Formulario>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas aprendidas</CardTitle>
        </CardHeader>
        <CardDescription className="mb-3">
          Se crean solas cuando corriges una categoría en "Por revisar". Si un texto aparece en la descripción, el movimiento va a
          esa categoría.
        </CardDescription>
        {reglas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay reglas.</p>
        ) : (
          <ul className="divide-y text-sm">
            {reglas.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  "{r.patron_texto}" → <strong>{nombreCategoria(r.category_id)}</strong>
                </span>
                <BotonAccion accion={borrarRegla.bind(null, r.id)} size="icon">
                  <Trash2 className="size-4" />
                </BotonAccion>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado de la app</CardTitle>
        </CardHeader>
        <ul className="mb-4 grid gap-2 text-sm">
          <li className="flex justify-between">
            Base de datos <Badge tono="fuerte">{repo.modo === "demo" ? "Demostración" : "Supabase"}</Badge>
          </li>
          <li className="flex justify-between">
            IA (Anthropic) <Badge tono={iaDisponible() ? "fuerte" : "neutro"}>{iaDisponible() ? "Activa" : "Apagada"}</Badge>
          </li>
          <li className="flex justify-between">
            Correos (Resend) <Badge tono={process.env.RESEND_API_KEY ? "fuerte" : "neutro"}>{process.env.RESEND_API_KEY ? "Activos" : "Sin configurar"}</Badge>
          </li>
        </ul>
        <div className="mb-4">
          <BotonAccion accion={probarReporteSemanal} variant="outline" size="default">
            Enviarme el reporte semanal ahora
          </BotonAccion>
        </div>
        <CardDescription className="mb-3">
          Los datos de ejemplo sirven para probar el dashboard. Se guardan marcados y se borran sin tocar tus datos reales.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          <BotonAccion accion={cargarDatosDeEjemplo} variant="outline" size="default">
            Cargar datos de ejemplo
          </BotonAccion>
          <BotonAccion accion={borrarDatosDeEjemplo} confirmar="¿Borrar todos los datos de ejemplo?" variant="destructive" size="default">
            Borrar datos de ejemplo
          </BotonAccion>
        </div>
      </Card>
    </div>
  );
}
