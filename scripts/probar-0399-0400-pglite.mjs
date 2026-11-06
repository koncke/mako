// =============================================================================
// probar-0399-0400-pglite — las migraciones de la tarjeta «Pagos» de Automations contra un Postgres de verdad (5/11/2026)
// =============================================================================
// Corre la 0400 (comprobantes leídos) y la 0399 (recibos de cada negocio) sobre PGlite con un esquema mínimo y prueba lo que
// sólo la base puede garantizar:
//   · 0400: una lectura por mensaje, y un N.º de operación por negocio (la segunda fila con el mismo número rebota 23505; la
//     de OTRO negocio entra);
//   · 0399: la numeración es POR NEGOCIO y empieza en 1, la misma clave devuelve el mismo número (`ya_estaba`), y la función
//     no la puede llamar la clave anon.
// Uso (PGlite no es dependencia del repo):
//   npm i --prefix <carpeta> @electric-sql/pglite
//   PGLITE=<esa carpeta> node scripts/probar-0399-0400-pglite.mjs
// Sale con 1 si algún caso falla. Probado rompiéndolo: ver el final del archivo.
// =============================================================================

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE) { console.error('Falta PGLITE=<carpeta donde instalaste @electric-sql/pglite> (ver la cabecera).'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(createRequire(join(process.env.PGLITE, 'x.js')).resolve('@electric-sql/pglite')).href);

const m0400 = fs.readFileSync(process.argv[2] ?? 'supabase/migrations/0400_comprobantes_leidos.sql', 'utf8');
const m0399 = fs.readFileSync(process.argv[3] ?? 'supabase/migrations/0399_recibos_negocio.sql', 'utf8');

const ESQUEMA = `
create role anon; create role authenticated; create role service_role;
create table workspaces (id bigserial primary key, nombre text);
create table leads (id bigint primary key, workspace_id bigint not null references workspaces(id));
create table pagos (id bigint primary key, workspace_id bigint, lead_id bigint references leads(id));
insert into workspaces (id, nombre) values (3, 'Prueba'), (13, 'Otro');
insert into leads (id, workspace_id) values (100, 3), (200, 13);
insert into pagos (id, workspace_id, lead_id) values (1, 3, 100), (2, 3, 100), (3, 13, 200);
`;

const fallos = [];
async function caso(nombre, fn) {
  try { await fn(); console.log(`✓ ${nombre}`); } catch (e) { fallos.push(nombre); console.log(`✗ ${nombre}\n   ${e instanceof Error ? e.message : String(e)}`); }
}

const db = new PGlite();
await db.exec(ESQUEMA);
await db.exec(m0400);
await db.exec(m0399);

const lectura = (ws, lead, msg, op) => db.query(
  `insert into comprobantes_leidos (workspace_id, lead_id, wa_mensaje_id, media_path, media_mime, estado, resultado, lectura, operacion, operacion_unica)
   values ($1, $2, $3, 'x/y.jpg', 'image/jpeg', 'leido', 'cubre', '{}'::jsonb, $4, $4)`, [ws, lead, msg, op]);
const codigo = async (fn) => { try { await fn(); return null; } catch (e) { return e?.code ?? String(e); } };

await caso('0400: una lectura por mensaje', async () => {
  await lectura(3, 100, 'msg-1', null);
  assert.equal(await codigo(() => lectura(3, 100, 'msg-1', null)), '23505');
});
await caso('0400: un N.º de operación cuenta una vez por negocio', async () => {
  await lectura(3, 100, 'msg-2', '461213098188603392');
  assert.equal(await codigo(() => lectura(3, 100, 'msg-3', '461213098188603392')), '23505', 'el mismo N.º en el mismo negocio rebota');
  assert.equal(await codigo(() => lectura(13, 200, 'msg-4', '461213098188603392')), null, 'en otro negocio, entra');
});
await caso('0400: la fila repetida entra sin `operacion_unica`', async () => {
  await db.query(`insert into comprobantes_leidos (workspace_id, lead_id, wa_mensaje_id, media_path, media_mime, estado, resultado, lectura, operacion, operacion_unica, repetido)
    values (3, 100, 'msg-5', 'x/y.jpg', 'image/jpeg', 'leido', 'repetido', '{}'::jsonb, '461213098188603392', null, true)`);
});

const emitir = async (ws, clave, o = {}) => (await db.query('select * from emitir_recibo_negocio($1::jsonb)', [JSON.stringify({
  workspace_id: ws, clave, lead_id: ws === 3 ? 100 : 200, pago_id: null, plantilla: 'clasico', a_nombre: 'Ana', foto: {}, canal: 'whatsapp', ...o,
})])).rows[0];

await caso('0399: la numeración es por negocio y empieza en 1', async () => {
  assert.equal((await emitir(3, 'pago:1')).numero, 1);
  assert.equal((await emitir(3, 'pago:2')).numero, 2);
  assert.equal((await emitir(13, 'pago:3')).numero, 1, 'otro negocio arranca en su 0001');
});
await caso('0399: la misma clave devuelve el mismo número, sin gastar otro', async () => {
  const r = await emitir(3, 'pago:1');
  assert.equal(r.numero, 1);
  assert.equal(r.ya_estaba, true);
  assert.equal((await emitir(3, 'pago:9')).numero, 3, 'el siguiente sigue correlativo');
});
await caso('0399: sin negocio o sin clave, tira', async () => {
  assert.ok(String(await codigo(() => emitir(3, '   '))).length > 0);
});
await caso('0399: la plantilla y el canal se validan', async () => {
  assert.equal(await codigo(() => emitir(3, 'pago:10', { plantilla: 'factura' })), '23514');
  assert.equal(await codigo(() => emitir(3, 'pago:11', { canal: 'sms' })), '23514');
});
await caso('0399: la clave anon no la puede llamar', async () => {
  const r = (await db.query(`select has_function_privilege('anon', 'emitir_recibo_negocio(jsonb)', 'execute') as puede`)).rows[0];
  assert.equal(r.puede, false);
});

if (fallos.length) { console.log(`\n${fallos.length} caso(s) en rojo: ${fallos.join(' · ')}`); process.exit(1); }
console.log('\nTodo en verde.');

// PROBADO ROMPIÉNDOLO (5/11/2026, base: 8 en verde): sin `comprobantes_leidos_operacion_uk` → rojo «cuenta una vez»; sin el
// `if found then return` de la clave → rojo «la misma clave»; la numeración global (sin `where n.workspace_id = v_ws`) → rojo
// «por negocio»; sin el `revoke … from public` → rojo «la clave anon».
