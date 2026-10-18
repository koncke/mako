// =============================================================================
// Un pago con moneda, concepto y método por la API de MaKo (17/10/2026)
// =============================================================================
// El síntoma (Mauricio, 17/10/2026): «un pago en pesos por WhatsApp entra como dólares». La causa no era una sola:
//   1. `marcar_pago_cobrado` y `registrar_pago_suelto` sólo tenían `montoUsd`: la pantalla guardaba la moneda, el
//      monto original, el concepto y el método (lib/pagos.ts ya los recibía) y la API no tenía dónde decirlos, así que
//      los pesos se anotaban como si fueran dólares sin que nadie lo viera hasta el Dashboard;
//   2. y «Juan me pagó 500 mil pesos» ni siquiera llegaba con esas herramientas: salía `capturar`, dudosa, con DOS
//      tools (tests/api-mako-pago-intencion.test.ts).
// Lo que se fija acá: la regla (pura, `cobroManualDeEntrada`), la forma de las dos operaciones y —sobre todo— lo que
// QUEDA ESCRITO cuando se corren los runners de verdad contra una base de mentira con dos negocios
// (tests/_api-pagos-hijo.ts).
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un arnés que reemplaza en el fuente, corre y restaura byte a byte.
// Con el código como está: 9 pases, 0 fallos. Rota (pases / fallos):
//   · `montoOriginal` sin moneda deja de rechazarse (pagos-campo.ts)                          → 7 / 2
//   · registrar_pago_suelto sin pasarle la moneda a registrarPagoSuelto                       → 8 / 1
//   · marcar_pago_cobrado sólo va por cobrarCuota con montoUsd (como antes del 17/10)         → 8 / 1
//   · el resumen de registrar_pago_suelto sin el aviso de «queda en dólares»                  → 8 / 1
//   · registrar_pago_suelto sin los cuatro parámetros nuevos                                  → 8 / 1
//   · desmarcar una cuota acepta moneda, método o concepto (se ignoraban en silencio)          → 8 / 1  (antes del caso soloMetodo: 9 / 0, sobrevivía)
//   · avisoMonedaPorOmision que nunca avisa                                                    → 7 / 2
//   · sin los dólares de la cuota como default al saldarla en otra moneda                      → 7 / 2
// Correr: MAKO_TESTS_SIN_ESPERA=1 node --test --import tsx tests/api-mako-pagos-moneda.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { avisoMonedaPorOmision, cobroManualDeEntrada, textoDelCobro, METODOS_PAGO } from '../lib/pagos-campo';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');

// ── 1 · La regla, pura ───────────────────────────────────────────────────────────────────────

test('sin moneda es dólares, y un monto en otra moneda SIN su moneda se rechaza (los pesos no entran como dólares)', () => {
  // Lo de siempre: sin moneda, sin nada de etiquetas.
  assert.deepEqual(cobroManualDeEntrada({ montoUsd: 500 }), { ok: true, montoUsd: 500, moneda: null, montoOriginal: null, concepto: null, metodo: null });
  // Cobrar una cuota tal cual: nada de monto.
  assert.deepEqual(cobroManualDeEntrada({}), { ok: true, montoUsd: null, moneda: null, montoOriginal: null, concepto: null, metodo: null });
  // ⚠️ El caso de Mauricio: 500 mil pesos puestos en `montoOriginal` sin decir cuáles. Antes entraban como 500 mil dólares.
  const sinMoneda = cobroManualDeEntrada({ montoUsd: 500, montoOriginal: 500000 });
  assert.equal(sinMoneda.ok, false);
  assert.deepEqual(sinMoneda.ok ? [] : sinMoneda.faltan, ['moneda']);
  // Con moneda, los dólares los DECLARA la persona (nunca una tasa inventada): sin ellos pide.
  const sinDolares = cobroManualDeEntrada({ moneda: 'ARS', montoOriginal: 450000 });
  assert.equal(sinDolares.ok, false);
  assert.deepEqual(sinDolares.ok ? [] : sinDolares.faltan, ['montoUsd']);
  // …salvo que se salde una cuota: sus dólares son los de la cuota.
  assert.deepEqual(cobroManualDeEntrada({ moneda: 'ars', montoOriginal: 450000 }, { montoUsdPorDefecto: 500 }), { ok: true, montoUsd: 500, moneda: 'ARS', montoOriginal: 450000, concepto: null, metodo: null });
  // La moneda tiene que existir; un método desconocido es «otro»; el concepto se recorta.
  assert.equal(cobroManualDeEntrada({ moneda: 'PESOS', montoOriginal: 5, montoUsd: 1 }).ok, false);
  const e = cobroManualDeEntrada({ montoUsd: 10, concepto: `  ${'x'.repeat(300)}  `, metodo: 'bitcoin' });
  assert.ok(e.ok && e.metodo === 'otro' && e.concepto?.length === 200);
});

test('el aviso de «queda en dólares» sale sólo si el negocio cobra en otra moneda y nadie la dijo', () => {
  assert.match(avisoMonedaPorOmision('ARS', false), /Queda en dólares \(USD\).*moneda del negocio es ARS/);
  assert.equal(avisoMonedaPorOmision('ARS', true), '', 'si dijo la moneda, no hay nada que avisar');
  assert.equal(avisoMonedaPorOmision('USD', false), '');
  assert.equal(avisoMonedaPorOmision(null, false), '', 'sin moneda configurada es USD');
  assert.equal(textoDelCobro(500, { moneda: 'MXN', montoOriginal: 8600, metodo: 'transferencia', concepto: 'Adelanto' }), '$ 8.600 MXN (USD 500) · Transferencia · Adelanto');
  assert.equal(textoDelCobro(500, {}), 'USD 500');
});

// ── 2 · La forma de las dos operaciones ───────────────────────────────────────────────────────

test('las dos operaciones tienen dónde decir la moneda, lo cobrado, el concepto y el método', () => {
  for (const id of ['marcar_pago_cobrado', 'registrar_pago_suelto']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), id);
    const p = (n: string) => d.parametros.find((x) => x.nombre === n);
    for (const n of ['moneda', 'montoOriginal', 'concepto', 'metodo']) assert.ok(p(n), `${id}: falta «${n}»`);
    assert.equal(p('moneda')?.max, 3, `${id}: la moneda es un código de 3 letras`);
    assert.deepEqual(p('metodo')?.enum, [...METODOS_PAGO], `${id}: el método sale del catálogo de la ficha, no de una copia`);
    assert.ok(!p('moneda')?.obligatorio && !p('montoOriginal')?.obligatorio, `${id}: son opcionales (lo de siempre sigue andando)`);
    assert.match(d.descripcion, /moneda/i, `${id}: la descripción tiene que decirle al modelo que los pesos no van en montoUsd`);
    assert.match(d.descripcion, /montoUsd/);
  }
  // El monto en dólares de «sin plan» sigue siendo obligatorio: lo que se declara para los reportes.
  assert.equal(porId('registrar_pago_suelto')!.parametros.find((x) => x.nombre === 'montoUsd')?.obligatorio, true);
});

// ── 3 · Los runners DE VERDAD, contra una base de mentira con dos negocios ────────────────────

type Hijo = {
  sueltoEnPesos: { prep: { payload: Record<string, unknown>; resumen: string }; ejec: { ok: boolean; resumen: string }; fila: Record<string, unknown> | null; lead: number | null; historial: string[] };
  sueltoSinMonedaEnNegocioArs: { resumen: string; fila: Record<string, unknown> | null };
  sueltoEnUsd: { resumen: string };
  rechazos: { sinMoneda: { error: string; faltan?: string[] }; sinOriginal: { error: string }; inexistente: { error: string }; pagos: number };
  cuotaEnPesos: { prep: { payload: Record<string, unknown>; resumen: string }; ejec: { ok: boolean; resumen: string }; filas: Array<Record<string, unknown>>; historial: string[] };
  cuotaComoSiempre: { ejec: { ok: boolean }; filas: Array<Record<string, unknown>> };
  cuotaDeMenosEnPesos: { prep: { resumen: string }; filas: Array<Record<string, unknown>> };
  ajenos: { conMoneda: { error: string }; soloMetodo: { error: string }; leadAjeno: { error: string }; cuotaAjena: { error: string }; sueltoAjeno: { error: string }; pagosDeB: Array<Record<string, unknown>> };
  ia: string[];
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_api-pagos-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 170_000,
});
const H = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo;

test('⚠️ un pago en pesos queda escrito en pesos: moneda, lo cobrado, concepto, método, los dólares y el historial', () => {
  const r = H.sueltoEnPesos;
  assert.equal(r.ejec.ok, true, r.ejec.resumen);
  assert.ok(r.fila, 'no se insertó el pago');
  assert.equal(r.fila.moneda, 'MXN', 'la moneda se guarda normalizada');
  assert.equal(r.fila.monto_original, 8600);
  assert.equal(r.fila.monto_usd, 500, 'los dólares son los que declaró la persona, no 8600');
  assert.equal(r.fila.concepto, 'Adelanto de octubre');
  assert.equal(r.fila.metodo, 'transferencia');
  assert.equal(r.fila.pagado, true);
  assert.equal(r.lead, 500, 'lo cobrado del lead suma DÓLARES, no pesos');
  // La persona ve la moneda en lo que confirma, y queda en el historial.
  assert.match(r.prep.resumen, /MXN/);
  assert.match(r.prep.resumen, /Transferencia/);
  assert.match(r.historial.join('|'), /MXN/);
});

test('sin moneda en un negocio que cobra en ARS, el resumen avisa que queda en dólares (y en uno en USD no hay ruido)', () => {
  assert.match(H.sueltoSinMonedaEnNegocioArs.resumen, /Queda en dólares \(USD\).*ARS/);
  assert.equal(H.sueltoSinMonedaEnNegocioArs.fila?.moneda ?? null, null, 'no se inventa la moneda del negocio');
  assert.doesNotMatch(H.sueltoEnUsd.resumen, /moneda del negocio/);
});

test('lo mal pedido se rechaza en preparar() y no escribe nada', () => {
  assert.deepEqual(H.rechazos.sinMoneda.faltan, ['moneda']);
  assert.match(H.rechazos.sinMoneda.error, /moneda/);
  assert.match(H.rechazos.sinOriginal.error, /cuánto se cobró en ARS/);
  assert.match(H.rechazos.inexistente.error, /no existe/);
  assert.equal(H.rechazos.pagos, 1, 'se escribió algo a pesar del rechazo (había una sola cuota)');
});

test('cobrar una cuota en pesos la deja cobrada con su moneda; los dólares son los de la cuota; sin datos, todo como siempre', () => {
  const c = H.cuotaEnPesos;
  assert.equal(c.ejec.ok, true, c.ejec.resumen);
  const cuota = c.filas.find((f) => f.id === 7);
  assert.ok(cuota);
  assert.equal(cuota.pagado, true);
  assert.equal(cuota.moneda, 'ARS');
  assert.equal(cuota.monto_original, 450000);
  assert.equal(cuota.monto_usd, 500, 'la cuota se salda por SUS dólares');
  assert.equal(cuota.metodo, 'efectivo');
  assert.equal(c.filas.length, 1, 'cobrar completa no deja ninguna cuota nueva');
  assert.match(c.historial.join('|'), /ARS/);
  // Sin moneda, concepto ni método: el camino de siempre, sin moneda inventada.
  const s = H.cuotaComoSiempre;
  assert.equal(s.ejec.ok, true);
  assert.equal(s.filas[0].pagado, true);
  assert.equal(s.filas[0].moneda ?? null, null);
  assert.equal(s.filas[0].monto_original ?? null, null);
});

test('cobrada por menos Y en otra moneda: la diferencia queda pendiente EN DÓLARES', () => {
  const f = H.cuotaDeMenosEnPesos.filas;
  assert.equal(f.length, 2);
  const nueva = f.find((x) => x.id !== 7);
  assert.equal(nueva?.monto_usd, 200);
  assert.equal(nueva?.pagado, false);
  assert.equal(f.find((x) => x.id === 7)?.monto_usd, 300);
  assert.equal(f.find((x) => x.id === 7)?.monto_original, 5400);
});

test('⚠️ lo de OTRO negocio no existe, y desmarcar no lleva moneda', () => {
  const a = H.ajenos;
  assert.match(a.conMoneda.error, /sólo al marcar/);
  // Un método o un concepto SIN moneda al desmarcar se ignoraban en silencio: lo ataja la guarda de «sólo al cobrar», no la del monto.
  assert.match(a.soloMetodo.error, /van sólo al marcar la cuota como cobrada/);
  assert.match(a.leadAjeno.error, /No existe el lead #202/);
  assert.match(a.cuotaAjena.error, /no es de Ana/);
  assert.match(a.sueltoAjeno.error, /No existe el lead #202/);
  assert.equal(a.pagosDeB.length, 1, 'el negocio B quedó como estaba');
  assert.equal(a.pagosDeB[0].pagado, false);
  assert.deepEqual(H.ia, [], 'salió algo a la red');
});
