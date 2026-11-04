import { Trash2 } from "lucide-react";
import { Copiar } from "@/components/copiar";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/campos";
import { borrarCreditoAccion, guardarCredito, pagarCredito } from "@/lib/acciones";
import {
  NOMBRES_FRECUENCIA,
  NOMBRES_FRECUENCIA_LARGO,
  NOMBRES_TIPO_CREDITO,
  SQL_CREDITOS,
  cuantoFalta,
  dividirPago,
  mesYAnio,
  proyectar,
  resumenCreditos,
} from "@/lib/creditos";
import { dinero, dineroCorto, fechaCorta, hoyLocal } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import type { Credito, Cuenta } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Campos del crédito (para agregar y para editar)
function Campos({ c, cuentas, hoy }: { c?: Credito; cuentas: Cuenta[]; hoy: string }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Label>
        Nombre
        <Input name="nombre" placeholder="Crédito del carro" defaultValue={c?.nombre} required />
      </Label>
      <Label>
        Tipo
        <Select name="tipo" defaultValue={c?.tipo ?? "auto"}>
          {Object.entries(NOMBRES_TIPO_CREDITO).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </Select>
      </Label>
      <Label>
        ¿Cuánto debes todavía?
        <Input name="saldo" inputMode="decimal" placeholder="150000" defaultValue={c?.saldo} required />
        <span className="text-xs text-muted-foreground">Lo dice tu estado de cuenta o la app del banco (“saldo” o “capital pendiente”).</span>
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Pago
          <Input name="pago" inputMode="decimal" placeholder="5890" defaultValue={c?.pago} required />
        </Label>
        <Label>
          ¿Cada cuándo?
          <Select name="frecuencia" defaultValue={c?.frecuencia ?? "mensual"}>
            {Object.entries(NOMBRES_FRECUENCIA_LARGO).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </Select>
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Interés anual (%)
          <Input name="tasa_anual" inputMode="decimal" placeholder="13.9" defaultValue={c?.tasa_anual || ""} />
        </Label>
        <Label>
          Próximo pago
          <Input name="proximo_pago" type="date" defaultValue={c?.proximo_pago ?? hoy} required />
        </Label>
      </div>
      <span className="-mt-1 text-xs text-muted-foreground">La tasa viene en tu contrato como “tasa de interés anual ordinaria”. Si no la sabes, déjala vacía.</span>
      <Label>
        ¿De qué cuenta lo pagas?
        <Select name="cuenta_id" defaultValue={c?.cuenta_id ?? ""}>
          <option value="">Elegir después</option>
          {cuentas
            .filter((k) => k.tipo !== "credito")
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.nombre}
              </option>
            ))}
        </Select>
      </Label>
      <Label>
        Nota (opcional)
        <Input name="nota" placeholder="Banco, número de contrato…" defaultValue={c?.nota ?? ""} />
      </Label>
    </>
  );
}

// Mis créditos: lo que TÚ debes (carro, personal, hipoteca…)
export default async function Creditos() {
  const repo = await obtenerRepo();
  const hoy = hoyLocal();
  const cuentas = await repo.cuentas();
  let creditos: Credito[];
  try {
    creditos = await repo.creditos();
  } catch {
    return (
      <div className="grid gap-4">
        <Titulo>Mis créditos</Titulo>
        <Card className="grid gap-3">
          <CardTitle>Falta un paso (solo una vez)</CardTitle>
          <CardDescription>
            Copia este código, ábrelo en <strong>Supabase › SQL Editor</strong>, pégalo y toca <strong>Run</strong>. Después vuelve a abrir esta pantalla.
          </CardDescription>
          <Copiar texto={SQL_CREDITOS} etiqueta="Copiar SQL" />
        </Card>
      </div>
    );
  }
  const { lista, total, alMes } = resumenCreditos(creditos, hoy);
  const pagados = creditos.filter((c) => !lista.includes(c)).slice(0, 10);

  return (
    <div className="grid gap-4">
      <Titulo detalle="Tus créditos del carro, personales, de nómina o de casa. Te digo cuándo terminas, cuánto pagas de intereses y te aviso antes de cada pago.">
        Mis créditos
      </Titulo>
      <Card className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Debes en créditos</p>
          <p className="text-2xl font-semibold text-destructive">{dineroCorto(total)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Pagas al mes</p>
          <p className="text-2xl font-semibold">{dineroCorto(alMes)}</p>
        </div>
      </Card>

      {lista.map((c) => {
        const p = proyectar(c);
        const atrasado = c.proximo_pago < hoy;
        const reparto = dividirPago(c, c.pago);
        return (
          <Card key={c.id} className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{c.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {NOMBRES_TIPO_CREDITO[c.tipo]} · {dinero(c.pago)} {NOMBRES_FRECUENCIA[c.frecuencia]}
                  {c.tasa_anual > 0 && ` · ${c.tasa_anual}% anual`}
                </p>
                <p className={`text-sm ${atrasado ? "text-destructive" : "text-muted-foreground"}`}>
                  {atrasado ? "⚠️ Se pasó el pago del " : "Próximo pago: "}
                  {fechaCorta(c.proximo_pago)}
                </p>
              </div>
              <span className="text-lg font-semibold whitespace-nowrap">{dinero(c.saldo)}</span>
            </div>
            {"nuncaTermina" in p ? (
              <p className="rounded-xl border border-destructive/60 p-3 text-sm">
                ⚠️ Con {dinero(c.pago)} solo cubres los intereses ({dinero(p.interesPorPago)}): así la deuda no baja. Revisa el pago o la tasa con tu banco.
              </p>
            ) : (
              <p className="rounded-xl bg-muted/40 p-3 text-sm">
                Terminas en <strong className="text-primary">{mesYAnio(p.termina)}</strong> ({cuantoFalta(p.pagos, c.frecuencia)})
                {p.intereses > 1 && (
                  <>
                    {" "}
                    · te faltan <strong>{dinero(p.intereses)}</strong> de intereses
                  </>
                )}
                {reparto.interes > 0 && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    De tu próximo pago, {dinero(reparto.interes)} son intereses y {dinero(reparto.capital)} bajan tu deuda.
                  </span>
                )}
              </p>
            )}
            {c.nota && <p className="text-sm">{c.nota}</p>}
            <Desplegable titulo={<span className="text-sm font-medium text-primary">✓ Ya pagué</span>}>
              <Formulario accion={pagarCredito.bind(null, c.id)} boton="Registrar pago">
                <Label>
                  ¿Cuánto pagaste?
                  <Input name="monto" inputMode="decimal" defaultValue={c.pago} required />
                </Label>
                <Label>
                  ¿De qué cuenta salió?
                  <Select name="cuenta_id" defaultValue={c.cuenta_id ?? ""}>
                    <option value="">No restar de ninguna cuenta</option>
                    {cuentas.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nombre}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label>
                  Fecha
                  <Input name="fecha" type="date" defaultValue={hoy} />
                </Label>
              </Formulario>
            </Desplegable>
            <Desplegable titulo={<span className="text-sm">Editar</span>}>
              <Formulario accion={guardarCredito}>
                <Campos c={c} cuentas={cuentas} hoy={hoy} />
              </Formulario>
            </Desplegable>
            <BotonAccion accion={borrarCreditoAccion.bind(null, c.id)} confirmar="¿Borrar este crédito? Los pagos que ya registraste se quedan en Movimientos.">
              <Trash2 className="size-4" /> Borrar
            </BotonAccion>
          </Card>
        );
      })}

      <Card>
        <Desplegable abierto={lista.length === 0} titulo={<CardTitle>+ Agregar un crédito</CardTitle>}>
          <Formulario accion={guardarCredito} boton="Agregar crédito" limpiar>
            <Campos cuentas={cuentas} hoy={hoy} />
          </Formulario>
        </Desplegable>
      </Card>

      <CardDescription className="text-center">
        ¿Tarjetas de crédito? Esas van en <a href="/ajustes#cuentas" className="text-primary">Ajustes › Cuentas</a> (tipo Crédito). ¿Te deben a ti? Eso va en{" "}
        <a href="/prestamos" className="text-primary">Me deben</a>.
      </CardDescription>

      {pagados.length > 0 && (
        <Card>
          <CardTitle className="mb-2">Ya terminaste de pagar 🎉</CardTitle>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {pagados.map((c) => (
              <li key={c.id}>
                {c.nombre}
                {c.liquidado_el && ` · ${fechaCorta(c.liquidado_el)}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
