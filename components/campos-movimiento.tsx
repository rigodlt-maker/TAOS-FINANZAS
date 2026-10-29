import { Input, Label, Select } from "./ui/campos";
import type { Categoria, Cuenta, Movimiento } from "@/lib/tipos";

export function CamposMovimiento({
  cuentas,
  categorias,
  movimiento,
  hoy,
}: {
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimiento?: Movimiento;
  hoy: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {movimiento && <input type="hidden" name="id" value={movimiento.id} />}
      <Label>
        Descripción
        <Input name="descripcion" defaultValue={movimiento?.descripcion_original} required />
      </Label>
      <Label>
        Comercio
        <Input name="comercio" defaultValue={movimiento?.comercio ?? ""} placeholder="Se llena solo si lo dejas vacío" />
      </Label>
      <Label>
        Monto
        <Input name="monto" inputMode="decimal" defaultValue={movimiento?.monto} required />
      </Label>
      <Label>
        Fecha
        <Input name="fecha" type="date" defaultValue={movimiento?.fecha ?? hoy} required />
      </Label>
      <Label>
        Tipo
        <Select name="tipo" defaultValue={movimiento?.tipo ?? "gasto"}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </Select>
      </Label>
      <Label>
        Cuenta
        <Select name="account_id" defaultValue={movimiento?.account_id}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="sm:col-span-2">
        Categoría
        <Select name="category_id" defaultValue={movimiento?.category_id ?? ""}>
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Label>
    </div>
  );
}
