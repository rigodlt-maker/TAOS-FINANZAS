// Tao puede terminar su respuesta con botones: "[[opciones: Mi nombre | Mi póliza de AXA]]".
// La pantalla los muestra como botones; al tocar uno se le pregunta eso a Tao. Igual en las 4 apps TAOS.
const MARCA = /\n*\[\[opciones:\s*([^\]]*)\]\]\s*$/;

export function conOpciones(texto: string, opciones: string[]): string {
  const limpias = [...new Set(opciones.map((o) => o.replace(/[[\]|]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 4);
  return limpias.length ? `${texto}\n\n[[opciones: ${limpias.join(" | ")}]]` : texto;
}

// Separa el texto de los botones. Mientras la respuesta se va escribiendo, oculta una marca a medias.
export function separarOpciones(texto: string): { texto: string; opciones: string[] } {
  const m = texto.match(MARCA);
  if (m) return { texto: texto.replace(MARCA, "").trimEnd(), opciones: m[1].split("|").map((o) => o.trim()).filter(Boolean) };
  return { texto: texto.replace(/\n*\[\[[^\]]*$/, ""), opciones: [] };
}
