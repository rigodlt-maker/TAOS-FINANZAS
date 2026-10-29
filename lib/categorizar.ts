import { normalizar } from "./formato";
import type { Categoria, Regla } from "./tipos";

// Categorías con las que arranca la app (se pueden editar en Ajustes)
export const CATEGORIAS_INICIALES: { nombre: string; presupuesto_mensual: number }[] = [
  { nombre: "Súper y despensa", presupuesto_mensual: 0 },
  { nombre: "Comida fuera", presupuesto_mensual: 0 },
  { nombre: "Transporte", presupuesto_mensual: 0 },
  { nombre: "Servicios", presupuesto_mensual: 0 },
  { nombre: "Casa y remodelación", presupuesto_mensual: 0 },
  { nombre: "Salud", presupuesto_mensual: 0 },
  { nombre: "Suscripciones", presupuesto_mensual: 0 },
  { nombre: "Ropa y personal", presupuesto_mensual: 0 },
  { nombre: "Entretenimiento", presupuesto_mensual: 0 },
  { nombre: "Educación", presupuesto_mensual: 0 },
  { nombre: "Otros", presupuesto_mensual: 0 },
];

// Palabras conocidas de comercios en México, para no empezar desde cero (las reglas propias tienen prioridad)
const PALABRAS_CONOCIDAS: [RegExp, string][] = [
  // Pagos de préstamos (p. ej. "DiDi Préstamos") antes que transporte
  [/prestamo/, "Otros"],
  // Tiendas en línea de todo tipo (antes que "mercado" del súper)
  [/mercado libre|amazon(?! prime)|temu|shein|aliexpress/, "Otros"],
  // Estas dos solo aplican si creas las categorías "Seguros" y "Mascotas" en Ajustes
  [/seguro|zurich|\baxa\b|qualitas|gnp|mapfre|metlife/, "Seguros"],
  [/veterinari|\bvet\b|dogtor|petco|\bmascota/, "Mascotas"],
  [/walmart|soriana|chedraui|\bched\b|bodega aurrera|aurrera|la comer|superama|heb|costco|sams|sam s club|city market|super\b|despensa|mercado|abarrote|\babts\b|oxxo|7 eleven|super 7/, "Súper y despensa"],
  [/rappi|uber eats|didi food|starbucks|restaurant|restaurante|taqueria|tacos|pizza|mcdonald|burger|kfc|cafe|cafeteria|caffenio|sushi|vips|sanborns|tortas|tamal|volovan|\bpan\b|chamorro|comida|sazon/, "Comida fuera"],
  [/pemex|gasolin|bp\b|shell|mobil|oxxo gas|g500|uber\b|didi\b|cabify|caseta|ado\b|estacionamiento|tag\b|iave|pase\b/, "Transporte"],
  [/cfe|telmex|totalplay|izzi|megacable|telcel|at t|movistar|agua|gas natural|naturgy|predial|internet/, "Servicios"],
  [/home depot|homedepot|comex|ferre|tlapaleria|truper|plomer|electric|material|cemento|azulejo|lowes|construc|interceram|piso|colocacion|ivili/, "Casa y remodelación"],
  [/farmacia|guadalajara|benavides|similares|doctor|medic|hospital|laboratorio|dental|clinica|optica|salud|consulta|immunotec/, "Salud"],
  [/netflix|spotify|disney|hbo|max\b|prime video|amazon prime|youtube premium|apple com|icloud|google one|xbox|playstation|chatgpt|claude|anthropic|cloudflare|sketchup|hotmart/, "Suscripciones"],
  [/liverpool|palacio de hierro|coppel|sears|zara|h m\b|shein|suburbia|c a\b|innovasport|peluqueria|barberia/, "Ropa y personal"],
  [/cinepolis|cinemex|ticketmaster|steam|bar\b|cantina|loteria|evento|top heroes/, "Entretenimiento"],
  [/colegiatura|escuela|universidad|tecnologico|curso|leansixsigma|platzi|udemy|coursera|libreria|gandhi|papeleria/, "Educación"],
  [/comision|anualidad|\biva comision/, "Otros"],
];

export type ResultadoCategoria = { category_id: string; origen: "regla" | "conocida" } | null;

// 1. Reglas aprendidas (gana el patrón más largo que aparezca en el texto)
// 2. Palabras conocidas de comercios mexicanos
export function categorizarConReglas(
  texto: string,
  reglas: Regla[],
  categorias: Categoria[],
): ResultadoCategoria {
  const t = normalizar(texto);
  const coincidencias = reglas.filter((r) => r.patron_texto && t.includes(r.patron_texto));
  if (coincidencias.length) {
    const mejor = coincidencias.sort((a, b) => b.patron_texto.length - a.patron_texto.length)[0];
    return { category_id: mejor.category_id, origen: "regla" };
  }
  for (const [patron, nombre] of PALABRAS_CONOCIDAS) {
    if (patron.test(t)) {
      const categoria = categorias.find((c) => c.nombre === nombre);
      if (categoria) return { category_id: categoria.id, origen: "conocida" };
    }
  }
  return null;
}

// Patrón para una regla nueva a partir de un movimiento corregido: el comercio, o las primeras palabras útiles
export function patronParaRegla(comercio: string | null, descripcion: string): string {
  const base = normalizar(comercio || descripcion)
    .split(" ")
    .filter((p) => p.length > 2 && !/^\d+$/.test(p))
    .slice(0, 3)
    .join(" ");
  return base || normalizar(descripcion).slice(0, 30);
}
