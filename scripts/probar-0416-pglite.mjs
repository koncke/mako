// =============================================================================
// probar-0416-pglite — la caja de MaKo Tokens (mig 0416) contra un Postgres DE VERDAD, sin tocar la base de nadie
// =============================================================================
// Las tres funciones de la 0416 deciden en SQL lo que protege la plata: si una generación arranca, de qué balde sale cada
// token y qué pasa cuando el cupo del mes se reinicia. Un test que lee el .sql con regex no prueba nada de eso. Esto
// levanta un Postgres en memoria (PGlite) con las formas del real, le aplica la 0412 y la 0416 enteras, y ejercita los
// casos. Molde: scripts/probar-0397-pglite.mjs.
//
// PGlite NO es dependencia del repo. Una vez, en una carpeta vacía:
//   npm i @electric-sql/pglite@0.2.17
// y después, desde la raíz del repo:
//   PGLITE=<esa carpeta> node scripts/probar-0416-pglite.mjs
// Sale con 1 si algún caso falla.
//
// ⚠️ LO QUE NO PRUEBA: dos gastos A LA VEZ. PGlite es una sola conexión, así que la carrera no se puede ejercitar acá —
// y la carrera es justamente el motivo de que el chequeo y el descuento sean la misma sentencia. Eso se prueba con
// scripts/probar-concurrencia-saldo.mjs, que abre 30 conexiones contra la base de verdad y pide 200 veces a la vez.
// Correrlo DESPUÉS de aplicar la migración.
// =============================================================================

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE) { console.error('Falta PGLITE=<carpeta donde instalaste @electric-sql/pglite> (ver la cabecera).'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(createRequire(join(process.env.PGLITE, 'x.js')).resolve('@electric-sql/pglite')).href);

const leer = (f) => fs.readFileSync(f, 'utf8');
const M0412 = leer('supabase/migrations/0412_mako_tokens.sql');
const M0416 = leer('supabase/migrations/0416_mako_tokens_caja.sql');

const ESQUEMA = `
create role anon; create role authenticated; create role service_role;
create table workspaces (id bigserial primary key, nombre text, capa text);
insert into workspaces (id, nombre, capa) values (9, 'MaKo', 'agencia'), (13, 'Codigo Inmobiliario', 'agencia'), (1, 'Un cliente', 'completo');
`;

const CUPO_PRO = 11750;     // CUPO_MENSUAL.pro — el plan de US$47
const CUPO_GROWTH = 24250;  // CUPO_MENSUAL.growth — el plan de US$97

const fallos = [];
let db;

async function caso(nombre, fn) {
  // Cada caso arranca con la caja vacía: un caso que depende del anterior no prueba lo que dice probar.
  await db.exec('delete from mako_tokens_movimientos; delete from mako_tokens_saldo;');
  try { await fn(); console.log('  ok   %s', nombre); }
  catch (e) { fallos.push(nombre); console.log('  FALLA %s\n        %s', nombre, e instanceof Error ? e.message : String(e)); }
}

const gastar = async (ws, cuesta, cupo, mes, feature = 'prueba') => {
  const r = await db.query(
    'select * from mako_tokens_gastar($1::bigint, $2::bigint, $3::bigint, $4::text, $5::text, $6::numeric, $7::text)',
    [ws, cuesta, cupo, mes, feature, null, null],
  );
  return r.rows[0];
};
const ajustar = async (ws, dCupo, dComprado, motivo = 'devolucion') => {
  const r = await db.query(
    'select * from mako_tokens_ajustar($1::bigint, $2::bigint, $3::bigint, $4::text, $5::text, $6::numeric, $7::text)',
    [ws, dCupo, dComprado, motivo, 'prueba', null, null],
  );
  return r.rows[0];
};
const acreditar = async (ws, cupo, mes) => {
  const r = await db.query('select * from mako_tokens_acreditar_cupo($1::bigint, $2::bigint, $3::text)', [ws, cupo, mes]);
  return r.rows[0];
};
const fila = async (ws) => (await db.query('select saldo, comprado, cupo_mes from mako_tokens_saldo where workspace_id = $1', [ws])).rows[0] ?? null;
const movs = async (ws) => (await db.query('select delta, motivo, referencia from mako_tokens_movimientos where workspace_id = $1 order by id', [ws])).rows;
const n = (v) => Number(v);

try {
  db = new PGlite();
  await db.exec(ESQUEMA);
  await db.exec(M0412);
  await db.exec(M0416);
  console.log('\n0412 + 0416 aplicadas sobre un Postgres en memoria.\n');

  // ── El cupo del mes ───────────────────────────────────────────────────────
  await caso('el cupo del mes se acredita solo en el primer gasto, y la fila nace con el plan', async () => {
    const r = await gastar(13, 100, CUPO_GROWTH, 'cupo:2026-11');
    assert.equal(r.ok, true, 'tenía que alcanzar: el cupo entero menos 100');
    assert.equal(n(r.saldo), CUPO_GROWTH - 100);
    const f = await fila(13);
    assert.equal(n(f.saldo), CUPO_GROWTH - 100);
    assert.equal(f.cupo_mes, 'cupo:2026-11');
  });

  await caso('el cupo del MISMO mes no se acredita dos veces, ni con cien intentos', async () => {
    for (let i = 0; i < 100; i++) await acreditar(13, CUPO_GROWTH, 'cupo:2026-11');
    assert.equal(n((await fila(13)).saldo), CUPO_GROWTH, 'cien acreditaciones del mismo mes dejaron más de un cupo');
    const cupos = (await movs(13)).filter((m) => m.motivo === 'cupo');
    assert.equal(cupos.length, 1, `quedaron ${cupos.length} movimientos de cupo para el mismo mes`);
  });

  await caso('⚠️ EL CUPO NO SE ACUMULA: el mes nuevo REEMPLAZA lo que quedaba del anterior', async () => {
    await acreditar(13, CUPO_GROWTH, 'cupo:2026-11');
    await gastar(13, 250, CUPO_GROWTH, 'cupo:2026-11');            // gastó poco: le quedan 24.000
    assert.equal(n((await fila(13)).saldo), CUPO_GROWTH - 250);
    await acreditar(13, CUPO_GROWTH, 'cupo:2026-12');              // llega diciembre
    assert.equal(n((await fila(13)).saldo), CUPO_GROWTH, 'el cupo de diciembre se SUMÓ al resto de noviembre');
  });

  await caso('⚠️ Y EL REINICIO DEL MES NO LE BORRA LO QUE COMPRÓ', async () => {
    await acreditar(13, CUPO_GROWTH, 'cupo:2026-11');
    await ajustar(13, 0, 5000, 'compra');                          // compró un paquete el 28 de noviembre
    assert.equal(n((await fila(13)).comprado), 5000);
    await acreditar(13, CUPO_GROWTH, 'cupo:2026-12');              // llega diciembre
    const f = await fila(13);
    assert.equal(n(f.saldo), CUPO_GROWTH, 'el cupo de diciembre no entró');
    assert.equal(n(f.comprado), 5000, 'el reinicio del mes le borró el paquete que pagó');
  });

  await caso('una capa sin cupo (el Acelerador) no recibe nada, y sin saldo no arranca', async () => {
    const r = await gastar(13, 10, null, 'cupo:2026-11');
    assert.equal(r.ok, false, 'sin cupo y sin compra, una generación no puede arrancar');
    assert.equal(await fila(13), null, 'no tenía que crearse ninguna fila');
  });

  // ── Gastar: el chequeo y el descuento ─────────────────────────────────────
  await caso('no alcanza → NO SE TOCA NADA, y dice cuánto falta', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    const r = await gastar(13, 150, 100, 'cupo:2026-11');
    assert.equal(r.ok, false);
    assert.equal(n(r.saldo), 100, 'rechazó pero descontó igual');
    assert.equal(n((await fila(13)).saldo), 100);
    const gastos = (await movs(13)).filter((m) => m.motivo === 'gasto');
    assert.equal(gastos.length, 0, 'anotó un gasto que no ocurrió');
  });

  await caso('alcanza EXACTO: se descuenta y queda en cero', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    const r = await gastar(13, 100, 100, 'cupo:2026-11');
    assert.equal(r.ok, true);
    assert.equal(n(r.saldo), 0);
    assert.equal(n(r.tomado_cupo), 100);
    assert.equal(n(r.tomado_comprado), 0);
  });

  await caso('el gasto sale PRIMERO del cupo (que se vence) y después de lo comprado', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    await ajustar(13, 0, 400, 'compra');
    const r = await gastar(13, 250, 100, 'cupo:2026-11');
    assert.equal(r.ok, true);
    assert.equal(n(r.saldo), 0, 'tenía que vaciar el cupo primero');
    assert.equal(n(r.comprado), 250, '400 comprados menos los 150 que al cupo le faltaron');
    assert.equal(n(r.tomado_cupo), 100);
    assert.equal(n(r.tomado_comprado), 150);
  });

  await caso('⚠️ LAS DOS ASIGNACIONES VEN EL SALDO VIEJO: no se cobra dos veces', async () => {
    // Si `comprado` viera el cupo ya en cero, le restaría los 250 enteros y el cliente pagaría 350 por un gasto de 250.
    await acreditar(13, 100, 'cupo:2026-11');
    await ajustar(13, 0, 400, 'compra');
    await gastar(13, 250, 100, 'cupo:2026-11');
    const f = await fila(13);
    assert.equal(n(f.saldo) + n(f.comprado), 500 - 250, `quedaron ${n(f.saldo) + n(f.comprado)} y tenían que quedar 250`);
  });

  await caso('el saldo NUNCA queda negativo, ni pidiendo más que todo lo que hay', async () => {
    await acreditar(13, 50, 'cupo:2026-11');
    await gastar(13, 1_000_000, 50, 'cupo:2026-11');
    const f = await fila(13);
    assert.ok(n(f.saldo) >= 0 && n(f.comprado) >= 0, `saldo=${f.saldo} comprado=${f.comprado}`);
    assert.equal(n(f.saldo), 50, 'un pedido imposible igual descontó');
  });

  await caso('cuesta 0 → pasa sin tocar la caja (una feature que rutea a un free tier)', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    const r = await gastar(13, 0, 100, 'cupo:2026-11');
    assert.equal(r.ok, true, 'lo que no cuesta nada tiene que poder correr');
    assert.equal(n((await fila(13)).saldo), 100);
  });

  await caso('cada gasto deja SU movimiento, con la feature y el signo', async () => {
    await acreditar(13, 1000, 'cupo:2026-11');
    await gastar(13, 7, 1000, 'cupo:2026-11', 'closing');
    await gastar(13, 9, 1000, 'cupo:2026-11', 'experimentos');
    const g = (await movs(13)).filter((m) => m.motivo === 'gasto');
    assert.equal(g.length, 2);
    assert.deepEqual(g.map((m) => n(m.delta)), [-7, -9], 'un gasto se anota en negativo');
  });

  // ── Liquidar ──────────────────────────────────────────────────────────────
  await caso('liquidar devuelve PRIMERO a lo comprado: la fila queda como estaba', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    await ajustar(13, 0, 400, 'compra');
    const r = await gastar(13, 250, 100, 'cupo:2026-11');          // tomó 100 del cupo y 150 de lo comprado
    // Costó de verdad 60: se devuelven 190, y tienen que volver a los baldes de donde salieron.
    const dev = 190;
    const aComprado = Math.min(dev, n(r.tomado_comprado));         // 150
    await ajustar(13, dev - aComprado, aComprado);
    const f = await fila(13);
    assert.equal(n(f.comprado), 400, `lo comprado quedó en ${f.comprado} y tenía que volver a 400`);
    assert.equal(n(f.saldo), 40, `del cupo salieron 100 y volvieron 40: tenían que quedar 40, quedaron ${f.saldo}`);
  });

  await caso('liquidar un cobro de MÁS se recorta en cero y anota lo que realmente se movió', async () => {
    await acreditar(13, 10, 'cupo:2026-11');
    await gastar(13, 10, 10, 'cupo:2026-11');                      // queda en cero
    const r = await ajustar(13, -40, 0, 'gasto');                  // costó 40 más de lo reservado, y no hay con qué
    assert.equal(n(r.saldo), 0, 'el saldo no puede quedar negativo');
    assert.equal(n(r.aplicado), 0, 'anotó un delta que no se pudo aplicar');
    const ultimo = (await movs(13)).at(-1);
    assert.equal(ultimo.motivo, 'gasto', 'el último movimiento tenía que ser el gasto del descuento, no el ajuste vacío');
  });

  await caso('una devolución sobre un negocio SIN FILA no inventa saldo', async () => {
    const r = await ajustar(13, 500, 0);
    assert.equal(n(r.saldo), 0);
    assert.equal(await fila(13), null, 'le creó una fila con saldo de la nada');
  });

  await caso('un motivo que no existe se rechaza (el check de la 0412 no alcanza: hay que no escribirlo)', async () => {
    await acreditar(13, 100, 'cupo:2026-11');
    await assert.rejects(() => ajustar(13, 10, 0, 'regalo'), /motivo invalido/i);
  });

  // ── La propiedad que protege la caja ──────────────────────────────────────
  await caso('⚠️ LA PROPIEDAD: con el cupo agotado, NINGUNA generación más arranca', async () => {
    await acreditar(13, CUPO_PRO, 'cupo:2026-11');
    let corrieron = 0;
    let gastado = 0;
    // 3.000 generaciones de 5 MT contra un cupo de 11.750: tienen que correr 2.350 y pararse.
    for (let i = 0; i < 3000; i++) {
      const r = await gastar(13, 5, CUPO_PRO, 'cupo:2026-11');
      if (r.ok) { corrieron++; gastado += 5; }
    }
    assert.equal(corrieron, Math.floor(CUPO_PRO / 5), `corrieron ${corrieron} y el cupo daba para ${Math.floor(CUPO_PRO / 5)}`);
    assert.equal(gastado, CUPO_PRO, 'se gastó distinto de lo que había');
    assert.equal(n((await fila(13)).saldo), 0);
  });

  await caso('y el que compró un paquete sigue generando después de agotar el cupo', async () => {
    await acreditar(13, 20, 'cupo:2026-11');
    await ajustar(13, 0, 15, 'compra');
    let corrieron = 0;
    for (let i = 0; i < 20; i++) if ((await gastar(13, 5, 20, 'cupo:2026-11')).ok) corrieron++;
    assert.equal(corrieron, 7, `(20 + 15) / 5 = 7, y corrieron ${corrieron}`);
  });

  console.log('');
  if (fallos.length) { console.log('❌ %d caso(s) en rojo: %s', fallos.length, fallos.join(' · ')); process.exit(1); }
  console.log('✅ La caja de la 0416 hace lo que dice, contra un Postgres de verdad.');
} finally {
  await db?.close?.();
}
