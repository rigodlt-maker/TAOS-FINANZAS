import { CheckCircle2, CircleSlash, Copy, Mail, Undo2 } from "lucide-react";
import Link from "next/link";
import { BotonAccion, Formulario } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/campos";
import { confirmarAvisoCorreo, deshacerAvisoCorreo, ignorarAvisoCorreo } from "@/lib/acciones";
import { diaDe, sugerencias } from "@/lib/correos";
import { dinero, fechaCorta } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import type { CorreoBanco } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ICONO = { aplicado: CheckCircle2, duplicado: Copy, ignorado: CircleSlash, pendiente: Mail };

// Lo que tu banco te avisa por correo: lo que se registró solo y lo que falta confirmar
export default async function Correos() {
  const repo = await obtenerRepo();
  let correos: CorreoBanco[];
  try {
    correos = await repo.correos({ limite: 60 });
  } catch {
    return (
      <div className="grid gap-4">
        <Titulo>Avisos del banco</Titulo>
        <Card>
          <CardTitle>Falta un paso</CardTitle>
          <CardDescription className="mt-2">Corre en Supabase el SQL de “avisos del banco” (0003_correos.sql) y vuelve a abrir esta pantalla.</CardDescription>
        </Card>
      </div>
    );
  }
  const cuentas = await repo.cuentas();
  const pendientes = correos.filter((c) => c.estado === "pendiente");
  const historial = correos.filter((c) => c.estado !== "pendiente");

  return (
    <div className="grid gap-4">
      <Titulo detalle="Lo que tu banco te manda a Gmail se registra solo. Aquí confirmas lo que no se pudo saber.">Avisos del banco</Titulo>

      {correos.length === 0 && (
        <Card className="grid gap-3">
          <CardTitle>Conecta tu Gmail</CardTitle>
          <CardDescription>Cada vez que Nu, Revolut u otro banco te mande un correo de una compra, transferencia o pago, la app lo registra sola.</CardDescription>
          <Link href="/correos/conectar" className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
            Conectar Gmail
          </Link>
        </Card>
      )}

      {pendientes.map((c) => {
        const { cuenta, otra } = sugerencias(c, pendientes, cuentas);
        const conDinero = cuentas.filter((x) => x.tipo !== "credito");
        const opciones = (lista: typeof cuentas, valor: string | null, nombre: string, etiqueta: string) => (
          <Label>
            {etiqueta}
            <Select name={nombre} required defaultValue={valor && lista.some((x) => x.id === valor) ? valor : ""}>
              <option value="" disabled>
                Elige una cuenta
              </option>
              {lista.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                  {x.id === valor ? " (sugerida)" : ""}
                </option>
              ))}
            </Select>
          </Label>
        );
        return (
          <Card key={c.id} className="grid gap-3 border-primary/60">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{c.resultado}</p>
              <span className="text-lg font-semibold whitespace-nowrap">{dinero(c.monto)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.banco} · {fechaCorta(diaDe(c.recibido))} · “{c.asunto}”
            </p>
            <Formulario accion={confirmarAvisoCorreo.bind(null, c.id)} boton="Registrar">
              {c.clase === "pago_tarjeta" ? (
                <>
                  <input type="hidden" name="cuenta_id" value={c.cuenta_id ?? ""} />
                  {opciones(conDinero, otra, "otra_id", "¿De qué cuenta salió?")}
                </>
              ) : c.clase === "salida" ? (
                <>
                  {opciones(conDinero, cuenta, "cuenta_id", "¿De qué cuenta salió?")}
                  {c.propio && opciones(cuentas, otra, "otra_id", "¿A qué cuenta llegó?")}
                </>
              ) : c.clase === "entrada" ? (
                <>
                  {opciones(c.propio ? conDinero : cuentas, cuenta, "cuenta_id", "¿A qué cuenta llegó?")}
                  {c.propio && opciones(conDinero, otra, "otra_id", "¿De qué cuenta salió?")}
                </>
              ) : (
                opciones(cuentas, cuenta, "cuenta_id", "¿Con qué cuenta pagaste?")
              )}
              {c.clase === "salida" && !c.propio && (
                <details className="rounded-xl border px-3 py-2">
                  <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">¿Es un préstamo? (te lo van a regresar)</summary>
                  <div className="grid gap-3 pt-2">
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" name="prestamo" className="size-5" /> Sí, es préstamo (no es gasto)
                    </label>
                    <Label>
                      ¿Cuándo te paga? (opcional)
                      <Input type="date" name="fecha_pago" />
                    </Label>
                    <Label>
                      Nota (opcional)
                      <Input name="nota" placeholder="Me paga en 2 partes…" />
                    </Label>
                  </div>
                </details>
              )}
            </Formulario>
            <div>
              <BotonAccion accion={ignorarAvisoCorreo.bind(null, c.id)} variant="ghost">
                Ignorar este aviso
              </BotonAccion>
            </div>
          </Card>
        );
      })}

      {historial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lo que ya se registró</CardTitle>
          </CardHeader>
          <ul className="divide-y">
            {historial.map((c) => {
              const Icono = ICONO[c.estado];
              return (
                <li key={c.id} className="grid gap-1 py-3">
                  <div className="flex items-start gap-2">
                    <Icono className={`mt-0.5 size-4 shrink-0 ${c.estado === "aplicado" ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="min-w-0 flex-1 text-sm">{c.resultado}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-6 text-xs text-muted-foreground">
                    <span className="truncate">
                      {c.banco} · {fechaCorta(diaDe(c.recibido))}
                    </span>
                    {c.estado === "aplicado" && (
                      <BotonAccion accion={deshacerAvisoCorreo.bind(null, c.id)} confirmar="¿Deshacer? Los saldos regresan como estaban y el aviso vuelve a pendientes para que elijas la cuenta correcta.">
                        <Undo2 className="size-4" /> Deshacer
                      </BotonAccion>
                    )}
                    {c.estado === "duplicado" && (
                      <BotonAccion accion={deshacerAvisoCorreo.bind(null, c.id)}>
                        <Undo2 className="size-4" /> No era el mismo
                      </BotonAccion>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Link href="/correos/conectar" className="text-center text-sm text-primary underline underline-offset-4">
        Cómo conectar Gmail
      </Link>
    </div>
  );
}
