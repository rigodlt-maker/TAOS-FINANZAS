// Sello de la versión original de TAOS.
// - `npm run sellar` (solo el autor): guarda en taos-sello.json la huella del código original.
// - Al publicar (`npm run build`) se compara la huella actual con el sello. Si el código cambió,
//   la app muestra un aviso de "versión modificada" (NEXT_PUBLIC_TAOS_MODIFICADA=1 en .env.production.local).
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const CARPETAS = ["app", "components", "lib", "public", "scripts", "supabase"];
const ARCHIVOS = ["proxy.ts", "next.config.ts", "package.json", "vercel.json", "postcss.config.mjs", "tsconfig.json"];
const SELLO = path.join(RAIZ, "taos-sello.json");

function archivos() {
  const lista = [];
  const recorrer = (rel) => {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) {
      for (const n of fs.readdirSync(abs).sort()) if (n !== "node_modules" && !n.startsWith(".")) recorrer(path.posix.join(rel, n));
    } else lista.push(rel);
  };
  for (const c of [...CARPETAS, ...ARCHIVOS]) recorrer(c);
  return lista.sort();
}

// Huella de todo el código: no cambia por saltos de línea de Windows ni por el orden de lectura
function huella() {
  const h = crypto.createHash("sha256");
  for (const rel of archivos()) {
    let datos = fs.readFileSync(path.join(RAIZ, rel));
    if (!rel.match(/\.(png|jpg|jpeg|webp|ico|gif)$/i)) datos = Buffer.from(datos.toString("utf8").replace(/\r\n/g, "\n"));
    h.update(rel + "\0").update(datos).update("\0");
  }
  return h.digest("hex");
}

function revisar() {
  let sello = null;
  try {
    sello = JSON.parse(fs.readFileSync(SELLO, "utf8"));
  } catch {}
  const modificada = !sello || sello.huella !== huella();
  fs.writeFileSync(path.join(RAIZ, ".env.production.local"), `NEXT_PUBLIC_TAOS_MODIFICADA=${modificada ? 1 : 0}\n`);
  console.log(modificada ? "⚠️  TAOS: el código no coincide con la versión original; la app mostrará el aviso de versión modificada." : "✓ TAOS: versión original.");
  return modificada;
}

if (require.main === module) {
  if (process.argv[2] === "sellar") {
    const actual = JSON.parse(fs.existsSync(SELLO) ? fs.readFileSync(SELLO, "utf8") : "{}");
    fs.writeFileSync(SELLO, JSON.stringify({ ...actual, huella: huella(), fecha: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
    console.log("Sello actualizado");
  } else revisar();
}

module.exports = { huella, archivos, revisar };
