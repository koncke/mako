// =============================================================================
// «Vincular evento» lento: las agendas a la vez y lo que contestan, un minuto (23/10/2026)
// =============================================================================
// Martín, 22/10/2026: abrir el pop-up, vincular y «Conectar Cal» tardaban. Leído en el código: `listarEventosDeAgenda`
// le preguntaba a Calendly, después a Cal.com y después a Google, uno detrás del otro; cada vínculo (`prepararVinculo`)
// volvía a listar la cuenta; y Calendly pedía el usuario del token antes de cada lista. Ahora todo a la vez, la lista de
// cada cuenta se guarda un minuto (lib/agenda-cache.ts) y el usuario de cada token, para siempre.
// Acordado con Cobros (su fase B, varias cuentas por proveedor, va encima): `eventosDelProveedor` sigue siendo LA unidad
// de lectura, la llave de la caché es negocio + proveedor (+ la huella del secreto) y Calendly recibe el token.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · la caché sin vencer (`hasta <= ahora()` → `false`)                                   → 7 / 1
//   · `olvidar` de un proveedor que borra también el otro                                  → 7 / 1
//   · la llave sin el negocio                                                               → 6 / 2
//   · `conCache` que guarda aunque no haya llave                                            → 7 / 1
//   · `conCache` que no hace caso de `fresco`                                               → 7 / 1
//   · las agendas otra vez de a una (`for … await eventosDelProveedor`)                     → 7 / 1
//   · Google después de las agendas                                                          → 7 / 1
//   · lo guardado sin copiar (las R1/R2 que se suman lo ensuciaban)                         → 7 / 1
//   · crear un evento sin olvidar la lista de esa cuenta                                    → 7 / 1
//   · el usuario de Calendly sin guardar                                                     → 7 / 1
// Con varias cuentas (fase B de Cobros, 23/10/2026: la unidad es CADA cuenta), de nuevo en 8 / 0:
//   · la llave con el token de otra cuenta                                                   → 7 / 1
//   · lo guardado sin copiar                                                                  → 7 / 1
//   · Calendly con el token de la principal                                                   → 7 / 1
// Correr: node --import tsx --test tests/agenda-velocidad-23-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPE_AGENDA, TTL_AGENDA_MS, conCache, crearCacheAgenda, huellaDe, llaveAgenda } from '../lib/agenda-cache';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de primer nivel: desde su firma hasta la próxima de primer nivel. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(?:export )?(?:async )?function /);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
};
const SRV = sinComentarios(leer('lib/agenda-evento-etapa-server.ts'));
const CAL = sinComentarios(leer('lib/calendly-agenda.ts'));

test('la caché: vale un minuto, se olvida por negocio o por proveedor, y tiene tope', () => {
  let t = 1_000;
  const c = crearCacheAgenda<string[]>(TTL_AGENDA_MS, () => t);
  const ka = llaveAgenda(3, 'calendly', 'tok-a');
  const kc = llaveAgenda(3, 'calcom', 'key-c');
  const otro = llaveAgenda(4, 'calendly', 'tok-a');
  c.guardar(ka, ['R1']); c.guardar(kc, ['Demo']); c.guardar(otro, ['X']);
  assert.deepEqual(c.leer(ka), ['R1']);
  t += TTL_AGENDA_MS - 1;
  assert.deepEqual(c.leer(ka), ['R1'], 'antes del minuto, vale');
  t += 1;
  assert.equal(c.leer(ka), undefined, 'al minuto, vence');
  c.guardar(ka, ['R1']); c.guardar(kc, ['Demo']); c.guardar(otro, ['X']);
  c.olvidar(3, 'calendly');
  assert.equal(c.leer(ka), undefined);
  assert.ok(c.leer(kc) && c.leer(otro), 'olvidar Calendly del ws 3 no toca Cal.com ni el ws 4');
  c.olvidar(3);
  assert.equal(c.leer(kc), undefined);
  assert.deepEqual(c.leer(otro), ['X'], 'olvidar el ws 3 no toca el 4');
  assert.equal(TTL_AGENDA_MS, 60_000);
  // El tope: la más vieja sale primero.
  const chica = crearCacheAgenda<number>(TTL_AGENDA_MS, () => t);
  for (let i = 0; i <= TOPE_AGENDA; i++) chica.guardar(llaveAgenda(i, 'calcom', 'k'), i);
  assert.equal(chica.leer(llaveAgenda(0, 'calcom', 'k')), undefined);
  assert.equal(chica.leer(llaveAgenda(TOPE_AGENDA, 'calcom', 'k')), TOPE_AGENDA);
});

test('la llave: negocio + proveedor + la HUELLA del secreto (otra cuenta, otra llave; el secreto nunca)', () => {
  const k = llaveAgenda(7, 'calendly', 'eyJ-token-secreto');
  assert.match(k, /^7:calendly:[0-9a-f]{16}$/);
  assert.ok(!k.includes('secreto'), 'el secreto no puede quedar en la llave');
  assert.notEqual(llaveAgenda(7, 'calendly', 'otro-token'), k, 'conectar otra cuenta cambia la llave');
  assert.notEqual(llaveAgenda(8, 'calendly', 'eyJ-token-secreto'), k, 'dos negocios con el mismo token no comparten');
  assert.equal(huellaDe('abc'), huellaDe('abc'));
});

test('conCache: lo guardado ahorra la API; `fresco` y sin negocio vuelven a preguntar; un error no se guarda', async () => {
  const c = crearCacheAgenda<string[]>();
  let llamadas = 0;
  const api = async () => { llamadas++; return ['R1']; };
  await conCache(c, 'k', false, api);
  await conCache(c, 'k', false, api);
  assert.equal(llamadas, 1, 'la segunda sale de la caché');
  await conCache(c, 'k', true, api);
  assert.equal(llamadas, 2, '«Volver a leer» le pregunta a la API');
  await conCache(c, null, false, api);
  await conCache(c, null, false, api);
  assert.equal(llamadas, 4, 'sin negocio, nada se guarda');
  await assert.rejects(conCache(c, 'mal', false, async () => { throw new Error('429'); }));
  assert.equal(c.leer('mal'), undefined);
});

test('listarEventosDeAgenda: la base, cada agenda y Google A LA VEZ, y «Volver a leer» llega hasta la API', () => {
  const f = cuerpo(SRV, 'export async function listarEventosDeAgenda(');
  assert.match(f, /await Promise\.all\(\[\s*Promise\.all\(\[leerVinculos\(\), leerFunnelsActivos\(\), listarFunnels\(\)\]\),\s*Promise\.all\(PROVEEDORES_AGENDA\.map\(\(p\) => eventosDelProveedor\(p, !!opts\.fresco\)\)\),\s*googleCalendarConectado\(\)\.catch\(\(\) => false\),\s*\]\);/);
  assert.doesNotMatch(f, /await eventosDelProveedor|await googleCalendarConectado/, 'una agenda esperando a la otra');
  const a = sinComentarios(leer('app/crm/agenda-evento-actions.ts'));
  assert.match(a, /export async function listarEventosAgendaAction\(opts\?: \{ fresco\?: boolean \}\)/);
  assert.match(a, /await listarEventosDeAgenda\(\{ fresco: opts\?\.fresco === true \}\)/);
});

test('eventosDelProveedor: la unidad de lectura de una cuenta, con su caché, sin ensuciar lo guardado', () => {
  const f = cuerpo(SRV, 'async function eventosDelProveedor(');
  // Con varias cuentas (fase B de Cobros) la unidad es CADA cuenta: su token, su llave y su copia.
  assert.match(f, /const llave = ws == null \? null : llaveAgenda\(ws, proveedor, c\.token\);/);
  assert.match(f, /const evs = await conCache\(cacheCuentas, llave, fresco, async \(\) =>/);
  assert.match(f, /eventos: evs\.map\(\(e\) => \(\{ \.\.\.e, cuenta: c\.cuenta \}\)\)/, 'lo guardado se copia: abajo se le suman las R1/R2');
  assert.match(f, /listarEventTypes\(c\.token\)/, 'Calendly con el token de esa cuenta');
  assert.match(f, /listarEventTypesCalcom\(c\.token\)/);
  // Lo mismo valida un vínculo: sólo eventos de SU cuenta, de la misma lectura (con caché).
  assert.match(cuerpo(SRV, 'export async function prepararVinculo('), /const cuenta = await eventosDelProveedor\(proveedor\);/);
});

test('crear o editar un evento olvida la lista de ESA cuenta, después de escribir', () => {
  for (const firma of ['export async function crearEventoDeAgenda(', 'export async function editarEventoDeAgenda(']) {
    const f = cuerpo(SRV, firma);
    // Calendly y Cal.com; editar en Cal.com olvida también si las preguntas fallan después de guardar lo demás (23/10/2026).
    assert.ok((f.match(/await olvidarCuentas\(proveedor\);/g) ?? []).length >= 2, `${firma}: Calendly y Cal.com`);
    assert.ok(f.indexOf('await olvidarCuentas(proveedor);') > f.indexOf('EventType'), `${firma}: olvida antes de escribir`);
  }
  assert.match(SRV, /const e = await crearEventTypeCalendly\(token, \{ nombre: d\.nombre!, duracionMin: d\.duracionMin! \}\);/);
  assert.match(SRV, /const e = await editarEventTypeCalendly\(token, identificador, \{\s*nombre: d\.nombre, duracionMin: d\.duracionMin,/);
  assert.match(cuerpo(SRV, 'async function olvidarCuentas('), /if \(ws != null\) cacheCuentas\.olvidar\(ws, proveedor\);/);
});

test('Calendly: el token por parámetro, y el usuario de cada token se pide UNA vez', () => {
  assert.match(CAL, /export async function listarEventTypes\(token\?: string\)/);
  assert.match(CAL, /export async function crearEventTypeCalendly\(token: string, i:/);
  assert.match(CAL, /export async function editarEventTypeCalendly\(token: string, uri: string, i:/);
  assert.match(CAL, /const t = token \?\? await credWs\('CALENDLY_API_TOKEN'\);/);
  const u = cuerpo(CAL, 'async function usuarioUri(');
  assert.match(u, /const ya = huella \? usuarios\.get\(huella\) : undefined;\s*if \(ya\) return ya;/);
  assert.match(u, /usuarios\.set\(huella, uri\);/);
  assert.doesNotMatch(u, /usuarios\.set\(token/, 'el token no va de llave: su huella');
});

test('la caché es pura: sin red ni base, sólo la huella de node:crypto', () => {
  const cache = sinComentarios(leer('lib/agenda-cache.ts'));
  assert.deepEqual(cache.match(/^import .*$/gm), ["import { createHash } from 'node:crypto';"]);
  assert.doesNotMatch(cache, /fetch\(|getTenantDb|credWs/);
});
