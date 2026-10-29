// Rendimiento diario de tus cuentas de ahorro (Cajita Turbo 13%, Cajita 6.5%, Revolut 7%…):
// cada día se suma saldo × tasa / 365 (interés compuesto). Si la cuenta tiene tope, la tasa solo aplica hasta ahí.
import type { Repo } from "./datos/repo";
import { diasEntre, mesDe, nombreMes, redondear } from "./formato";
import type { Cuenta } from "./tipos";

export const ganaRendimiento = (c: Cuenta) => c.tipo !== "credito" && (c.tasa_anual ?? 0) > 0;

// Interés de un día con el saldo de hoy
export function interesDelDia(c: Cuenta, saldo = c.saldo_actual): number {
  if (!ganaRendimiento(c) || saldo <= 0) return 0;
  const tope = c.tope_tasa && c.tope_tasa > 0 ? c.tope_tasa : Infinity;
  const conTasa = Math.min(saldo, tope);
  const excedente = Math.max(0, saldo - tope);
  return (conTasa * c.tasa_anual! + excedente * (c.tasa_excedente ?? 0)) / 100 / 365;
}

// Cuánto vas a ganar (aprox.) en N días si no mueves el dinero
export function proyectar(c: Cuenta, dias: number): number {
  let saldo = c.saldo_actual;
  for (let i = 0; i < dias; i++) saldo += interesDelDia(c, saldo);
  return redondear(saldo - c.saldo_actual);
}

// Suma el rendimiento de los días que faltan (lo corre el cron cada mañana). Devuelve lo que se sumó por cuenta.
export async function aplicarRendimientos(repo: Repo, hoy: string): Promise<{ cuenta: string; interes: number }[]> {
  const resultado: { cuenta: string; interes: number }[] = [];
  for (const c of (await repo.cuentas()).filter(ganaRendimiento)) {
    // La primera vez solo se marca el día: el saldo que escribiste ya trae lo ganado hasta hoy
    if (!c.rendimiento_desde) {
      await repo.editarCuenta(c.id, { rendimiento_desde: hoy });
      continue;
    }
    const dias = Math.min(400, diasEntre(c.rendimiento_desde, hoy));
    if (dias <= 0) continue;
    let saldo = c.saldo_actual;
    for (let i = 0; i < dias; i++) saldo += interesDelDia(c, saldo);
    const interes = redondear(saldo - c.saldo_actual);
    await repo.editarCuenta(c.id, { saldo_actual: redondear(saldo), rendimiento_desde: hoy });
    if (interes > 0) {
      // Un solo ingreso por cuenta y por mes ("Rendimiento Cajita Turbo · octubre"), que va creciendo
      const mes = mesDe(hoy);
      const hash = `rend:${c.id}:${mes}`;
      const anterior = await repo.borrarMovimientoPorHash(hash);
      const total = redondear((anterior?.monto ?? 0) + interes);
      await repo.insertarMovimientos([
        {
          account_id: c.id,
          fecha: hoy,
          descripcion_original: `Rendimiento ${c.nombre} (${c.tasa_anual}% anual) · ${nombreMes(mes)}`,
          comercio: `Rendimiento ${c.nombre}`,
          monto: total,
          tipo: "ingreso",
          category_id: null,
          requiere_revision: false,
          es_recurrente: false,
          hash_unico: hash,
          import_id: null,
        },
      ]);
      resultado.push({ cuenta: c.nombre, interes });
    }
  }
  return resultado;
}
