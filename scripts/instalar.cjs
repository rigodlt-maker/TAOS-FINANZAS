// Junta todas las migraciones en supabase/instalar.sql y en lib/sql.ts (lo que muestra la pantalla Configurar).
// lib/sql.ts también trae cada migración por separado: tras una actualización, la app pide solo las que faltan.
const fs = require("fs");
const dir = "supabase/migrations";
const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const partes = Object.fromEntries(archivos.map((f) => [f, `-- ===== ${f} =====\n${fs.readFileSync(`${dir}/${f}`, "utf8").trim()}\n`]));
const sql = archivos.map((f) => partes[f]).join("\n");
const cabeza = "-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.\n\n";
fs.writeFileSync("supabase/instalar.sql", cabeza + sql);
fs.writeFileSync(
  "lib/sql.ts",
  "// Generado con: node scripts/instalar.cjs (no editar a mano)\nexport const SQL_INSTALAR = " +
    JSON.stringify(cabeza + sql) +
    ";\n\n// Cada migración por separado (para pedir solo las que faltan después de una actualización)\nexport const MIGRACIONES: Record<string, string> = " +
    JSON.stringify(partes, null, 1) +
    ";\n",
);
