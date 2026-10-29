import Link from "next/link";
import { Fragment } from "react";

// Markdown mínimo para las respuestas: **negritas**, [enlaces](/ruta), listas "- " y citas "> "
function enLinea(texto: string, base: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return partes.map((p, i) => {
    const clave = `${base}-${i}`;
    const negrita = p.match(/^\*\*([^*]+)\*\*$/);
    if (negrita) return <strong key={clave}>{negrita[1]}</strong>;
    const enlace = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (enlace) {
      const [, texto, ruta] = enlace;
      // Solo enlaces internos de la app
      return ruta.startsWith("/") ? (
        <Link key={clave} href={ruta} className="underline underline-offset-2">
          {texto}
        </Link>
      ) : (
        <Fragment key={clave}>{texto}</Fragment>
      );
    }
    return <Fragment key={clave}>{p}</Fragment>;
  });
}

export function Markdown({ texto }: { texto: string }) {
  // Bloques separados por línea en blanco o por cambio entre lista y texto ("Otros pagos:\n- a\n- b")
  const bloques: string[] = [];
  for (const parrafo of texto.split(/\n{2,}/)) {
    let actual: string[] = [];
    for (const linea of parrafo.split("\n")) {
      if (actual.length && actual[actual.length - 1].startsWith("- ") !== linea.startsWith("- ")) {
        bloques.push(actual.join("\n"));
        actual = [];
      }
      actual.push(linea);
    }
    bloques.push(actual.join("\n"));
  }
  return (
    <div className="grid gap-2 leading-relaxed">
      {bloques.map((b, i) => {
        const lineas = b.split("\n");
        if (lineas.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="grid list-disc gap-1 pl-5">
              {lineas.map((l, j) => (
                <li key={j}>{enLinea(l.slice(2), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (lineas.every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={i} className="border-l-2 pl-3 text-muted-foreground">
              {enLinea(lineas.map((l) => l.replace(/^>\s?/, "")).join(" "), `${i}`)}
            </blockquote>
          );
        }
        return (
          <p key={i}>
            {lineas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {enLinea(l, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
