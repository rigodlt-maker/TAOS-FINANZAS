// TAOS funciona sin IA de pago: todo se hace con reglas (Tao, categorías, ticket, reportes).
// Estas funciones se quedan para que el resto del código no cambie, pero nunca llaman a un servicio externo.

const SIN_IA = "Esta función no está disponible: TAOS funciona sin IA de pago.";

export function iaDisponible(): boolean {
  return false;
}

export async function extraerMovimientosDePdf(_pdfBase64: string): Promise<{ fecha: string; descripcion: string; monto: number; tipo: "gasto" | "ingreso" }[]> {
  throw new Error(SIN_IA);
}

export async function categorizarLote(
  _movimientos: { id: string; texto: string; monto: number }[],
  _categorias: string[],
): Promise<{ id: string; categoria: string; confianza: number }[]> {
  return [];
}

export async function interpretarCapturaIA(
  _frase: string,
  _cuentas: string[],
  _hoy: string,
): Promise<{ entendido: boolean; monto: number; tipo: "gasto" | "ingreso"; comercio: string; fecha: string; cuenta: string | null }> {
  throw new Error(SIN_IA);
}

export async function proponerAhorro(_contexto: object): Promise<string> {
  throw new Error(SIN_IA);
}

export async function accionDeLaSemana(_contexto: object): Promise<string> {
  throw new Error(SIN_IA);
}
