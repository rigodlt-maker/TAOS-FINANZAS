// Nube F1 · TAOS_MODO: en "propia" los avisos diarios son solo para el dueño (como siempre);
// en "nube" recorren a cada usuario con correo confirmado, cada quien con su propio repositorio.
import assert from "node:assert/strict";
import { test } from "node:test";
import { porCadaUsuario, TOPE_POR_RONDA, usuariosDelCron } from "../lib/cron";
import type { Repo } from "../lib/datos/repo";
import { modoTaos } from "../lib/modo";

const usuarios = [
  { id: "aaaaaaaa-1", email: "a@demo.mx", email_confirmed_at: "2026-11-01" },
  { id: "bbbbbbbb-2", email: "b@demo.mx", email_confirmed_at: "2026-11-02" },
  { id: "cccccccc-3", email: "c@demo.mx", email_confirmed_at: null }, // no confirmó su correo
];
const listar = async () => usuarios;
const dueno = async () => "dueno-0";

test("TAOS_MODO: «propia» por omisión; «nube» solo si se escribe así", () => {
  const antes = process.env.TAOS_MODO;
  delete process.env.TAOS_MODO;
  assert.equal(modoTaos(), "propia");
  process.env.TAOS_MODO = " Nube ";
  assert.equal(modoTaos(), "nube");
  process.env.TAOS_MODO = "otra cosa";
  assert.equal(modoTaos(), "propia");
  if (antes === undefined) delete process.env.TAOS_MODO;
  else process.env.TAOS_MODO = antes;
});

test("propia: solo el dueño, y su correo es el de ALLOWED_EMAIL (null)", async () => {
  assert.deepEqual(await usuariosDelCron({ modo: "propia", listar, dueno }), [{ id: "dueno-0", correo: null }]);
});

test("nube: todos los que confirmaron su correo, con su propio correo, y con tope por ronda", async () => {
  assert.deepEqual(await usuariosDelCron({ modo: "nube", listar, dueno }), [
    { id: "aaaaaaaa-1", correo: "a@demo.mx" },
    { id: "bbbbbbbb-2", correo: "b@demo.mx" },
  ]);
  const muchos = Array.from({ length: TOPE_POR_RONDA + 20 }, (_, i) => ({ id: `u${i}`, email: `u${i}@demo.mx`, email_confirmed_at: "2026-11-01" }));
  assert.equal((await usuariosDelCron({ modo: "nube", listar: async () => muchos })).length, TOPE_POR_RONDA);
});

test("cada usuario recibe SU repositorio y, si a uno le falla, los demás siguen", async () => {
  const pedidos: string[] = [];
  const repoDe = (id: string) => (pedidos.push(id), { usuario: id } as unknown as Repo);
  const r = await porCadaUsuario(
    async (repo, u) => {
      if (u.id === "aaaaaaaa-1") throw new Error("falla de prueba");
      return (repo as unknown as { usuario: string }).usuario;
    },
    { modo: "nube", listar, dueno, repoDe },
  );
  assert.deepEqual(pedidos, ["aaaaaaaa-1", "bbbbbbbb-2"]);
  assert.deepEqual(r, { usuarios: 2, fallas: 1, resultados: ["bbbbbbbb-2"] });
});
