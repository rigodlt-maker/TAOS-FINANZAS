// Junta todas las migraciones en supabase/instalar.sql y en lib/sql.ts (lo que muestra la pantalla Configurar)
const fs = require("fs");
const dir = "supabase/migrations";
const sql = fs.readdirSync(dir).sort().map((f) => `-- ===== ${f} =====\n${fs.readFileSync(`${dir}/${f}`, "utf8").trim()}\n`).join("\n");
const cabeza = "-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.\n\n";
fs.writeFileSync("supabase/instalar.sql", cabeza + sql);
fs.writeFileSync("lib/sql.ts", "// Generado con: node scripts/instalar.cjs (no editar a mano)\nexport const SQL_INSTALAR = " + JSON.stringify(cabeza + sql) + ";\n");
