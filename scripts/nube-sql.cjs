// Nube F5 · Junta el SQL de instalación de las 4 apps en uno solo para el servidor de TAOS Nube (un proyecto de Supabase
// para todas). Se corre desde taos-finanzas con las otras 3 plantillas a un lado (../taos-fit, ../taos-cerebro, ../taos-panel),
// todas en la rama nube-1. Se corre una sola vez en el proyecto nuevo (la primera migración de Finanzas no se repite).
const fs = require("fs");
const partes = [
  ["Administrador Tao (Finanzas)", "supabase/instalar.sql"],
  ["Tao Fit", "../taos-fit/supabase/instalar.sql"],
  ["Segundo Cerebro", "../taos-cerebro/supabase/instalar.sql"],
  ["Optimizador de Vida", "../taos-panel/supabase/instalar.sql"],
];
const cabeza = `-- TAOS Nube · instalación completa del servidor (las 4 apps en un solo proyecto de Supabase).
-- Córrelo UNA sola vez, en el proyecto nuevo de Supabase (SQL Editor › Run). Las actualizaciones después se piden aparte.
-- Generado con: node scripts/nube-sql.cjs (no editar a mano)
`;
const cuerpo = partes.map(([nombre, ruta]) => `\n-- ################ ${nombre} ################\n${fs.readFileSync(ruta, "utf8").trim()}\n`).join("");
fs.writeFileSync("supabase/nube/instalar-nube.sql", cabeza + cuerpo);
console.log("supabase/nube/instalar-nube.sql:", (cabeza + cuerpo).split("\n").length, "líneas");
