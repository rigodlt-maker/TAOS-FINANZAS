// Avisos de banco leídos del correo: se registran solos, en pareja y sin duplicar
import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmarCorreo, deshacerCorreo, leerCorreo, procesarCorreos, type CorreoEntrante } from "../lib/correos";
import { repoMemoria } from "../lib/datos/memoria";
import type { Cuenta } from "../lib/tipos";

// Mismo formato que los correos reales de Nu y Revolut (con un nombre inventado)
const correos = {
  revolutEnvio: {
    id: "g1", de: "Revolut <no-reply@revolut.com>", fecha: "2026-10-27T17:22:18Z",
    asunto: "Enviaste $15,522.07 a Juan Carlos Pérez López 💸",
    texto: "Tu transferencia fue exitosa Hola Juan Carlos, Enviaste $15,522.07 a Juan Carlos Pérez López. Puedes encontrar los datos a continuación: Para Juan Carlos Pérez López Enviado $15,522.07 Referencia Enviada desde Revolut El martes, 27 octubre, 11:22",
  },
  nuRecibe: {
    id: "g2", de: "Nu México <nu@nu.com.mx>", fecha: "2026-10-27T17:22:19Z",
    asunto: "¡Recibiste una transferencia!",
    texto: "Esta cantidad ya está disponible en tu cuenta | Transferencia recibida | Hola, Juan Carlos: | JUAN CARLOS Pérez López hizo una transferencia a tu Cuenta Nu por:* Monto: $15,522.07 * Fecha: 27 OCT 2026 * Hora: 11:22 Esta cantidad ya está disponible en tu cuenta.",
  },
  nuAHsbc: {
    id: "g3", de: "nu@nu.com.mx", fecha: "2026-10-27T17:23:43Z",
    asunto: "Tu transferencia fue exitosa",
    texto: "Te confirmamos que tu transferencia fue realizada | Hola, Juan Carlos | Nos da gusto confirmarte que tu transferencia para Juan Carlos Pérez López se envió correctamente. | Detalles de la transferencia: | Monto: $1,595.07 Fecha: 27/OCT/2026 Hora: 11:23 Concepto: Transferencia Número de referencia: 271026 Folio: QWMR Nombre: Juan Carlos Pérez López Entidad: HSBC CLABE: ••••1234 Estatus: Completada",
  },
  nuPagoTarjeta: {
    id: "g4", de: "nu@nu.com.mx", fecha: "2026-10-27T15:40:02Z",
    asunto: "¡Recibimos tu pago!",
    texto: "Ya lo puedes ver en tu app; | ¡Gracias por tu pago! | Hola, Juan Carlos: | Recibimos el pago que hiciste a tu tarjeta de crédito Nu por: | $928.71 | Esta cantidad ya está disponible en tu línea de crédito.",
  },
  nuAOtro: {
    id: "g5", de: "nu@nu.com.mx", fecha: "2026-10-26T20:00:00Z",
    asunto: "Tu transferencia fue exitosa",
    texto: "Hola, Juan Carlos | tu transferencia para María Gómez se envió correctamente. Monto: $500.00 Fecha: 26/OCT/2026 Nombre: María Gómez Entidad: BBVA MEXICO CLABE: ••••9876 Estatus: Completada",
  },
  hsbcRecordatorio: {
    id: "g6", de: "HSBC_ClientesMX@hsbc.com.mx", fecha: "2026-10-23T18:47:41Z",
    asunto: "No olvides realizar tu pago.",
    texto: "Hola JUAN CARLOS Se aproxima la fecha límite de pago de tu Tarjeta de Crédito terminación 4128. Pago mínimo $1,200.00",
  },
  revolutPromo: {
    id: "g7", de: "no-reply@revolut.com", fecha: "2026-10-26T10:00:00Z",
    asunto: "Quedan 2 días para ganar $400",
    texto: "Invita a tus amigos y gana $400 por cada uno.",
  },
} satisfies Record<string, CorreoEntrante>;

async function nuevoRepo() {
  (globalThis as { __almacenDemo?: unknown }).__almacenDemo = undefined;
  const repo = repoMemoria();
  for (const c of await repo.cuentas()) await repo.borrarCuenta(c.id);
  const crear = (nombre: string, tipo: Cuenta["tipo"], saldo: number) =>
    repo.crearCuenta({ nombre, tipo, saldo_actual: saldo, dia_corte: null, dia_limite_pago: null, es_ejemplo: false });
  await crear("Revolut", "ahorro", 25170.31);
  await crear("NU CAJITAS", "ahorro", 0);
  await crear("Nu crédito", "credito", -928.71);
  await crear("HSBC Viva", "credito", -4310.5);
  await crear("EFECTIVO", "efectivo", 3000);
  const cuenta = async (nombre: string) => (await repo.cuentas()).find((c) => c.nombre === nombre)!;
  return { repo, cuenta };
}

test("lee cada tipo de aviso", async () => {
  const { repo } = await nuevoRepo();
  const cuentas = await repo.cuentas();
  const id = (n: string) => cuentas.find((c) => c.nombre === n)!.id;
  assert.deepEqual(leerCorreo(correos.revolutEnvio, cuentas), { banco: "Revolut", clase: "salida", monto: 15522.07, contraparte: "Juan Carlos Pérez López", entidad: null, propio: true, cuenta_id: id("Revolut") });
  assert.equal(leerCorreo(correos.nuRecibe, cuentas)?.clase, "entrada");
  assert.equal(leerCorreo(correos.nuRecibe, cuentas)?.propio, true);
  assert.equal(leerCorreo(correos.nuRecibe, cuentas)?.cuenta_id, id("NU CAJITAS"));
  const hsbc = leerCorreo(correos.nuAHsbc, cuentas)!;
  assert.deepEqual([hsbc.clase, hsbc.monto, hsbc.entidad, hsbc.propio], ["salida", 1595.07, "HSBC", true]);
  const pago = leerCorreo(correos.nuPagoTarjeta, cuentas)!;
  assert.deepEqual([pago.clase, pago.monto, pago.cuenta_id], ["pago_tarjeta", 928.71, id("Nu crédito")]);
  const otro = leerCorreo(correos.nuAOtro, cuentas)!;
  assert.deepEqual([otro.clase, otro.propio, otro.contraparte], ["salida", false, "María Gómez"]);
  assert.equal(leerCorreo(correos.hsbcRecordatorio, cuentas), null);
  assert.equal(leerCorreo(correos.revolutPromo, cuentas), null);
  assert.equal(leerCorreo({ ...correos.revolutPromo, de: "amigo@gmail.com" }, cuentas), null);
});

test("nada que mueva tus cuentas se registra solo: la app sugiere y tú confirmas; al confirmar una mitad se cierra la otra", async () => {
  const { repo, cuenta } = await nuevoRepo();
  const r = await procesarCorreos(repo, [correos.nuRecibe, correos.revolutEnvio, correos.nuAHsbc, correos.hsbcRecordatorio, correos.revolutPromo]);
  assert.deepEqual(r, { recibidos: 5, nuevos: 3, aplicados: 0, pendientes: 3, duplicados: 0 });
  assert.equal((await cuenta("Revolut")).saldo_actual, 25170.31);
  const pendientes = await repo.correos({ estado: "pendiente" });
  const envio = pendientes.find((x) => x.gmail_id === "g1")!;
  // Sugiere: sale de Revolut y llega a la cuenta de Nu (por la otra mitad)
  const { sugerencias } = await import("../lib/correos");
  const s = sugerencias(envio, pendientes, await repo.cuentas());
  assert.deepEqual([s.cuenta, s.otra], [(await cuenta("Revolut")).id, (await cuenta("NU CAJITAS")).id]);
  await confirmarCorreo(repo, envio.id, { cuenta_id: s.cuenta!, otra_id: s.otra });
  assert.equal((await cuenta("Revolut")).saldo_actual, 9648.24);
  assert.equal((await cuenta("NU CAJITAS")).saldo_actual, 15522.07);
  assert.equal((await repo.correos({ estado: "pendiente" })).length, 1); // la mitad de Nu se cerró sola
  // La de HSBC: sugiere HSBC Viva por la "Entidad"
  const hsbc = (await repo.correos({ estado: "pendiente" }))[0];
  assert.equal(sugerencias(hsbc, [], await repo.cuentas()).otra, (await cuenta("HSBC Viva")).id);
  // Mandar los mismos correos otra vez no hace nada
  assert.equal((await procesarCorreos(repo, [correos.nuRecibe, correos.revolutEnvio])).nuevos, 0);
});

test("pago de tarjeta: confirmas de qué cuenta salió; deshacer lo regresa a pendientes", async () => {
  const { repo, cuenta } = await nuevoRepo();
  await procesarCorreos(repo, [correos.nuPagoTarjeta]);
  const [pendiente] = await repo.correos({ estado: "pendiente" });
  assert.match(pendiente.resultado!, /¿De qué cuenta salió/);
  await confirmarCorreo(repo, pendiente.id, { cuenta_id: pendiente.cuenta_id!, otra_id: (await cuenta("NU CAJITAS")).id });
  assert.equal((await cuenta("Nu crédito")).saldo_actual, 0);
  assert.equal((await cuenta("NU CAJITAS")).saldo_actual, -928.71);
  await deshacerCorreo(repo, pendiente.id);
  assert.equal((await cuenta("Nu crédito")).saldo_actual, -928.71);
  assert.equal((await cuenta("NU CAJITAS")).saldo_actual, 0);
  assert.equal((await repo.correo(pendiente.id))!.estado, "pendiente");
});

test("si ya lo registraste en el chat, no lo duplica (y si no era el mismo, vuelve a pendientes)", async () => {
  const { repo, cuenta } = await nuevoRepo();
  const nu = await cuenta("NU CAJITAS");
  const tarjeta = await cuenta("Nu crédito");
  await repo.crearTransferencia({ fecha: "2026-10-27", origen_id: nu.id, destino_id: tarjeta.id, monto: 928.71, nota: "chat" });
  const r = await procesarCorreos(repo, [correos.nuPagoTarjeta]);
  assert.equal(r.duplicados, 1);
  assert.equal((await repo.transferencias()).length, 1);
  const [c] = await repo.correos();
  await deshacerCorreo(repo, c.id);
  assert.equal((await repo.correo(c.id))!.estado, "pendiente");
  assert.equal((await repo.transferencias()).length, 1);
});

test("a otra persona: eliges la cuenta (no la adivina); puede ser gasto o préstamo", async () => {
  const { repo, cuenta } = await nuevoRepo();
  await repo.crearCuenta({ nombre: "Cajita Ahorro", tipo: "ahorro", saldo_actual: 15200.50, dia_corte: null, dia_limite_pago: null, es_ejemplo: false });
  await procesarCorreos(repo, [correos.nuAOtro]);
  const [c] = await repo.correos({ estado: "pendiente" });
  assert.match(c.resultado!, /¿De qué cuenta salió\? ¿Es un préstamo\?/);
  assert.equal((await cuenta("NU CAJITAS")).saldo_actual, 0);
  // Como gasto, desde Ahorro Plus
  await confirmarCorreo(repo, c.id, { cuenta_id: (await cuenta("Cajita Ahorro")).id });
  assert.equal((await cuenta("Cajita Ahorro")).saldo_actual, 14700.50);
  const [m] = (await repo.movimientos({ soloPorRevisar: true })).filter((x) => x.hash_unico === "correo:g5");
  assert.equal(m.comercio, "María Gómez");
  // Deshacer y registrarlo como préstamo
  await deshacerCorreo(repo, c.id);
  assert.equal((await cuenta("Cajita Ahorro")).saldo_actual, 15200.50);
  await confirmarCorreo(repo, c.id, { cuenta_id: (await cuenta("Cajita Ahorro")).id, prestamo: true, fecha_pago: "2026-11-15" });
  const [p] = await repo.prestamos();
  assert.deepEqual([p.persona, p.monto, p.fecha_pago], ["María Gómez", 500, "2026-11-15"]);
  assert.equal((await cuenta("Cajita Ahorro")).saldo_actual, 14700.50);
});

test("si ya lo registraste como préstamo en el chat, el correo no lo duplica", async () => {
  const { repo, cuenta } = await nuevoRepo();
  await repo.crearPrestamo({ persona: "María", monto: 500, abonado: 0, cuenta_id: (await cuenta("NU CAJITAS")).id, fecha: "2026-10-26", fecha_pago: null, nota: null, liquidado_el: null });
  const r = await procesarCorreos(repo, [correos.nuAOtro]);
  assert.equal(r.duplicados, 1);
});

test("bonificación por puntos Membership Rewards: baja la deuda de la Amex (no la Aeroméxico) sin tocar lo del corte", async () => {
  const { repo, cuenta } = await nuevoRepo();
  await repo.crearCuenta({ nombre: "Amex", tipo: "credito", saldo_actual: -21416, dia_corte: 16, dia_limite_pago: 5, es_ejemplo: false });
  await repo.crearCuenta({ nombre: "Amex Aeroméxico", tipo: "credito", saldo_actual: -3500, dia_corte: 20, dia_limite_pago: 9, es_ejemplo: false });
  const amex = {
    id: "g8", de: "AmericanExpress@welcome.americanexpress.com", fecha: "2026-10-27T19:00:16Z", asunto: "Tu bonificación por tus Puntos.",
    texto: "Confirmación del uso de Puntos Membership Rewards | Hola, JUAN C PEREZ L Terminación de la Tarjeta: 72001 | Recibiste una bonificación por tus Puntos Membership Rewards | Los detalles de tu canje de Puntos: | Puntos Utilizados: | 2,240 | Monto de la bonificación: | MX$224.00 | Recuerda que aún necesitas realizar tu Pago1",
  };
  const r = await procesarCorreos(repo, [amex]);
  assert.equal(r.aplicados, 1);
  assert.equal((await cuenta("Amex")).saldo_actual, -21192);
  assert.equal((await cuenta("Amex Aeroméxico")).saldo_actual, -3500);
  const [c] = await repo.correos();
  assert.match(c.resultado!, /No cuenta como pago de tu corte/);
});
