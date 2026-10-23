// =============================================================================
// Rendimiento: la sesión se lee UNA vez por pedido, y Automations lee en olas, no en serie (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Al abrir Automations tarda mucho en abrirse... Debería ser más rápido todo». Medido en producción:
// /api/auth/me 4,5 s con la función caliente (en CADA carga de pantalla) y /api/chat-agent/secuencias p50 3,0 s, p90 15 s.
// La causa transversal: en una ruta /api el `cache()` de React no memoiza, y cada `getTenantDb()` volvía a leer la sesión.
// scripts/consultas-por-pedido.mts lo mide: /api/auth/me pasó de 41 idas a la base (sesión leída 19 veces) a 5, y
// /api/chat-agent/secuencias de 150 (61) a 30, con la MISMA respuesta byte a byte.
//
// Este test fija:
//   · `enElPedido` (lib/sesion-por-pedido.ts): una lectura por pedido y token; otro token u otro pedido leen de nuevo; una
//     lectura que tira no queda guardada;
//   · que `getUsuarioActual` pasa por ella con el token de la cookie como clave;
//   · que el GET de secuencias y `productosConEtapas` no vuelven a esperar en serie.
// ROTURAS (23/10/2026, una por vez y restaurada; base 5 / 0): getUsuarioActual sin enElPedido → 4 / 1; enElPedido que no
// borra lo que tira → 4 / 1; enElPedido que no memoiza → 4 / 1; la zona otra vez en serie en el GET → 4 / 1; una lectura por
// embudo adentro del recorrido → 4 / 1.
// Correr: node --import tsx --test tests/rendimiento-pedido.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enElPedido } from '../lib/sesion-por-pedido';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('enElPedido: una lectura por pedido y token; otro token u otro pedido leen de nuevo', async () => {
  let lecturas = 0;
  const leerSesion = async () => { lecturas++; return { sub: '7', n: lecturas }; };
  const pedidoA = {};
  // Veinte llamadas del mismo pedido (lo que hacía /api/auth/me): UNA lectura, y todas ven la misma sesión.
  const veinte = await Promise.all(Array.from({ length: 20 }, () => enElPedido(pedidoA, 'tok1', leerSesion)));
  assert.equal(lecturas, 1);
  assert.ok(veinte.every((s) => s === veinte[0]));
  // El pedido cambió la cookie (un login): se vuelve a leer.
  await enElPedido(pedidoA, 'tok2', leerSesion);
  assert.equal(lecturas, 2);
  // Otro pedido no hereda nada del anterior.
  await enElPedido({}, 'tok1', leerSesion);
  assert.equal(lecturas, 3);
});

test('enElPedido: una lectura que tira no queda guardada (la siguiente vuelve a leer)', async () => {
  const pedido = {};
  let vez = 0;
  const leerSesion = async () => { vez++; if (vez === 1) throw new Error('base caída'); return { sub: '7' }; };
  await assert.rejects(enElPedido(pedido, 't', leerSesion), /base caída/);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(await enElPedido(pedido, 't', leerSesion), { sub: '7' });
  assert.equal(vez, 2);
});

test('getUsuarioActual pasa por enElPedido con el token de la cookie (sin eso, una ruta /api relee la sesión ~20 veces)', () => {
  const auth = sinComentarios(leer('lib/auth.ts'));
  assert.match(auth, /export const getUsuarioActual = cache\(async \(\): Promise<Sesion \| null> => \{\n\s*const store = await cookies\(\);\n\s*const token = store\.get\(SESSION_COOKIE\)\?\.value;\n\s*return enElPedido\(store, token \?\? '', \(\) => leerSesion\(token\)\);\n\}\);/);
  // La lectura de verdad sigue siendo la de siempre (el 2FA, la sesión dev): sólo cambió que se hace una vez.
  assert.match(auth, /async function leerSesion\(token: string \| undefined\): Promise<Sesion \| null> \{\n\s*const firmada = verificarToken\(token\);/);
});

test('el GET de secuencias no espera nada en serie después de su ola', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  const get = ruta.slice(ruta.indexOf('export async function GET('), ruta.indexOf('async function sugerir('));
  const despues = get.slice(get.indexOf('const [{ secuencias, serie }'), get.indexOf('return Response.json({\n      ok: true, secuencias'));
  const ola = despues.slice(0, despues.indexOf(']);'));
  const resto = despues.slice(despues.indexOf(']);'));
  assert.doesNotMatch(resto, /await /, 'volvió una espera en serie después de la ola');
  for (const f of ['getSettingData()', 'productosConEtapas()', 'tzActual()', 'handoffsPendientes()', 'envioWhatsappHabilitadoEstricto()', 'getInstanciaRow()']) {
    assert.ok(ola.includes(f), `${f} salió de la ola`);
  }
  // El motivo de la caída depende de la instancia: va encadenado a ella, no después de la ola.
  assert.match(ola, /getInstanciaRow\(\)\.catch\(\(\) => undefined\)\.then\(async \(instancia\) => \(\{/);
});

test('productosConEtapas lee en dos olas: nada se espera adentro del recorrido de los embudos', () => {
  const src = sinComentarios(leer('lib/setting-secuencias.ts'));
  const f = src.slice(src.indexOf('export async function productosConEtapas('));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  const recorrido = cuerpo.slice(cuerpo.indexOf('for (const [i, f] of funnels.entries())'));
  assert.doesNotMatch(recorrido, /await /, 'volvió una lectura por embudo (o de los servicios) en serie');
  assert.equal((cuerpo.match(/await /g) ?? []).length, 3, 'son tres esperas: los embudos, la ola, y las entregas');
  // getSettingData: una sola ola (el segundo Promise.all no usaba nada del primero).
  const gsd = src.slice(src.indexOf('export async function getSettingData('));
  assert.equal((gsd.slice(0, gsd.indexOf('\n}\n')).match(/await Promise\.all/g) ?? []).length, 1);
});
