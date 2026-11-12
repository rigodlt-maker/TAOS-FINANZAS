import assert from "node:assert/strict";
import test from "node:test";
import { swDePrueba } from "./ayuda/sw";

test("S15-P: después de cerrar sesión, un aviso nuevo no se guarda en la bandeja ni muestra su contenido", async () => {
  const sw = swDePrueba();
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Pago de tarjeta", cuerpo: "Nu: pagar $4,300.00 mañana" });
  assert.equal(sw.bandeja().length, 1);
  // Cierra sesión: se borra la bandeja y se cierran las notificaciones a la vista
  await sw.mensaje("taos-sin-sesion");
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  assert.ok(sw.mostradas.every((n) => n.cerrada));
  // Llega otro aviso sin sesión: genérico y la bandeja NO se vuelve a crear
  await sw.push({ titulo: "Compra con tu tarjeta", cuerpo: "OXXO $80.00 con Nu" });
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  const ultima = sw.mostradas.at(-1)!;
  assert.equal(ultima.titulo, "Administrador Tao");
  assert.doesNotMatch(ultima.opciones.body ?? "", /OXXO|80|Nu/);
  // Vuelve a entrar: los avisos se guardan otra vez
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Cobro", cuerpo: "Juan te debe $500.00" });
  assert.equal(sw.bandeja().length, 1);
});

test("S15-P: si el celular no sabe si hay sesión (instalación vieja, sin anotar), se comporta como antes", async () => {
  const sw = swDePrueba();
  await sw.push({ titulo: "Pago", cuerpo: "x" });
  assert.equal(sw.bandeja().length, 1);
});

// S15-P · carreras (reverificación de Codex): un push que empezó ANTES de cerrar sesión se queda a medias, se cierra la
// sesión por completo y luego el push sigue. Al final: sesión «fuera», sin bandeja y nada privado a la vista.
for (const [donde, paso] of [
  ["después de revisar la sesión y antes de abrir la bandeja", "open:bandeja-avisos"],
  ["con la bandeja abierta, antes de escribirla", "put:/__avisos"],
  ["mientras se muestra la notificación", "show"],
] as const) {
  test(`S15-P carrera: cierre de sesión ${donde}`, async () => {
    const sw = swDePrueba();
    await sw.mensaje("taos-con-sesion");
    const pausa = sw.pausarEn(paso);
    const push = sw.push({ titulo: "PRIVADO", cuerpo: "SALDO 1234" });
    await pausa.llegada;
    await sw.mensaje("taos-sin-sesion"); // el cierre de sesión termina completo mientras el push está detenido
    pausa.soltar();
    await push;
    assert.equal(sw.estado(), "fuera");
    assert.equal(sw.almacen.has("bandeja-avisos"), false, "se recreó la bandeja");
    for (const n of sw.aVista()) {
      assert.doesNotMatch(n.titulo, /PRIVADO/);
      assert.doesNotMatch(n.opciones.body ?? "", /SALDO|1234/);
    }
  });
}

test("S15-P carrera: con la sesión abierta todo el tiempo, dos avisos al mismo tiempo se guardan y se muestran", async () => {
  const sw = swDePrueba();
  await sw.mensaje("taos-con-sesion");
  await Promise.all([sw.push({ titulo: "Uno", cuerpo: "a" }), sw.push({ titulo: "Dos", cuerpo: "b" })]);
  assert.ok(sw.bandeja().length >= 1);
  assert.deepEqual(sw.aVista().map((n) => n.titulo).sort(), ["Dos", "Uno"]);
});
