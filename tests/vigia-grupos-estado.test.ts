// =============================================================================
// El vigía de los grupos como CRON de Vercel: la marca, el título y lo que recuerda
// =============================================================================
// Lo que cuida: que el vigía no pierda incidentes cuando algo falla, que no duplique
// tickets, y que la ruta siga siendo sólo-lectura. El cuerpo (qué cuenta como incidente)
// lo prueba tests/vigia-mako-grupos.test.ts y acá no se repite.
//
// Probado rompiéndolo, UNA rotura a la vez y leída contra una base en VERDE
// (0 fallos · 21 pases). Los números son los MEDIDOS, no los que parecían:
//   · `leerEstado` devolviendo `vacio` siempre (ignorando lo guardado) → 3 fallos
//   · `leerEstado` tirando con un JSON roto en vez de tratarlo como primera vuelta → 1
//   · `tituloDeTicket` con `i.tipos.join(' · ')` (el slug) en vez del rótulo → 2
//   · `tituloDeTicket` metiendo el `ws${i.ws}` en el título → 1
//   · `vistosTrasLaVuelta` recordando TODOS los nuevos y no sólo los asentados → 1
//   · el `slice(-TOPE_VISTOS)` sacado → 1
//   · en la ruta: `checkCronAuth` movido debajo del primer `await` → 1
//   · en la ruta: `wsSuperAdmin()` cambiado por `getWorkspaceActual()` → 1
//   · en la ruta: un `setSetting` metido ARRIBA del `crearTicket` → 2
//   · en la ruta: el filtro de `error-app` sacado → 1
//   · en la ruta: el default del modo puesto en `'on'` → 1
// El arnés restaura DE MEMORIA, nunca con `git checkout -- <ruta>`: con varias sesiones
// sobre este clon, eso borra trabajo ajeno sin avisar (AGENTS.md).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TOPE_VISTOS, VENTANA_INICIAL_MS, leerEstado, tituloDeTicket, vistosTrasLaVuelta,
} from '../lib/vigia-grupos-estado';
import type { Incidente, TipoIncidente } from '../lib/vigia-mako-grupos';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// Se normaliza: en el clon de Windows los archivos llegan en CRLF (AGENTS.md).
const leer = (r: string) => readFileSync(join(REPO, r), 'utf8').replace(/\r\n/g, '\n');
/** Para un `doesNotMatch`: la convención de la casa es CITAR en el comentario lo que se sacó. */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const RUTA = 'app/api/cron/vigia-grupos/route.ts';
const AHORA = Date.parse('2026-10-24T03:00:00.000Z');

const inc = (over: Partial<Incidente> = {}): Incidente => ({
  clave: 'c1', tipos: ['no-puede'] as TipoIncidente[], ws: 13, grupo: '123@g.us',
  at: '2026-10-24T02:55:00.000Z', texto: 'no puedo ver tu agenda', marcas: ['no puedo'],
  antes: null, antesAt: null, ...over,
});
const nombreWs = (ws: number) => (ws === 13 ? 'Código Inmobiliario' : 'sin nombre');

// ── 1. La marca: tres respuestas distintas, y sólo dos comparten camino ──────────────

test('sin setting es la primera vuelta: la ventana inicial y nada visto', () => {
  const e = leerEstado(null, AHORA);
  assert.equal(e.marca, new Date(AHORA - VENTANA_INICIAL_MS).toISOString());
  assert.deepEqual(e.vistos, []);
});

test('un JSON roto NO tira: es la primera vuelta, igual que si faltara', () => {
  const e = leerEstado('{esto no es json', AHORA);
  assert.equal(e.marca, new Date(AHORA - VENTANA_INICIAL_MS).toISOString());
  assert.deepEqual(e.vistos, []);
});

test('lo guardado se respeta tal cual', () => {
  const e = leerEstado(JSON.stringify({ marca: '2026-10-21T23:40:00.000Z', vistos: ['a', 'b'] }), AHORA);
  assert.equal(e.marca, '2026-10-21T23:40:00.000Z');
  assert.deepEqual(e.vistos, ['a', 'b']);
});

test('una marca que no es fecha cae a la ventana inicial, pero los vistos se conservan', () => {
  const e = leerEstado(JSON.stringify({ marca: 'cualquier cosa', vistos: ['a'] }), AHORA);
  assert.equal(e.marca, new Date(AHORA - VENTANA_INICIAL_MS).toISOString());
  assert.deepEqual(e.vistos, ['a']);
});

test('los vistos que no son texto se descartan sin tirar', () => {
  const e = leerEstado(JSON.stringify({ marca: '2026-10-23T00:00:00.000Z', vistos: ['a', 3, null, 'b'] }), AHORA);
  assert.deepEqual(e.vistos, ['a', 'b']);
});

// ── 2. El título: lo lee una persona ────────────────────────────────────────────────

test('el título dice el NOMBRE del negocio y el rótulo, nunca el slug ni el ws', () => {
  const t = tituloDeTicket(inc(), nombreWs);
  assert.match(t, /Código Inmobiliario/);
  assert.match(t, /MaKo dijo que no puede/);
  assert.doesNotMatch(t, /no-puede/, 'el slug interno no va en un título');
  assert.doesNotMatch(t, /ws13|ws 13/, 'un identificador interno es un glosario que quien lo abre no tiene');
});

test('dos tipos se dicen los dos, con su rótulo', () => {
  const t = tituloDeTicket(inc({ tipos: ['no-puede', 'queja'] as TipoIncidente[] }), nombreWs);
  assert.match(t, /MaKo dijo que no puede/);
  assert.match(t, /el cliente se queja/);
});

test('sin workspace no inventa un negocio', () => {
  const t = tituloDeTicket(inc({ ws: 0 }), nombreWs);
  assert.doesNotMatch(t, /—/);
  assert.doesNotMatch(t, /sin nombre/);
});

test('el título topea en 140', () => {
  const largo = (ws: number) => (ws === 13 ? 'N'.repeat(400) : '?');
  assert.ok(tituloDeTicket(inc({ tipos: ['no-puede', 'queja', 'voz', 'promesa'] as TipoIncidente[] }), largo).length <= 140);
});

// ── 3. Lo que recuerda: sólo lo asentado, o se pierde un incidente ──────────────────

test('se recuerda lo que abrió ticket', () => {
  const v = vistosTrasLaVuelta([], [inc({ clave: 'a' }), inc({ clave: 'b' })], ['a', 'b']);
  assert.deepEqual(v, ['a', 'b']);
});

test('lo que NO abrió ticket no se recuerda: la próxima vuelta lo reintenta', () => {
  const v = vistosTrasLaVuelta([], [inc({ clave: 'a' }), inc({ clave: 'b' })], ['a']);
  assert.deepEqual(v, ['a'], 'b falló su ticket, así que no entra a vistos');
});

test('los de error-app se recuerdan sin ticket propio: ya lo tienen', () => {
  const v = vistosTrasLaVuelta([], [inc({ clave: 'err:7', tipos: ['error-app'] as TipoIncidente[] })], []);
  assert.deepEqual(v, ['err:7']);
});

test('lo previo se conserva y el tope corta por el final', () => {
  const previos = Array.from({ length: TOPE_VISTOS }, (_, n) => `v${n}`);
  const v = vistosTrasLaVuelta(previos, [inc({ clave: 'nuevo' })], ['nuevo']);
  assert.equal(v.length, TOPE_VISTOS);
  assert.equal(v.at(-1), 'nuevo');
  assert.equal(v.includes('v0'), false, 'el tope saca lo más viejo, no lo nuevo');
});

// ── 4. La ruta: sólo lee, y el orden de lo que escribe importa ───────────────────────

test('checkCronAuth es la PRIMERA sentencia del handler', () => {
  const src = leer(RUTA);
  const cuerpo = src.slice(src.indexOf('export async function GET'));
  const primera = cuerpo.split('\n').slice(1).find((l) => l.trim() && !l.trim().startsWith('//'));
  assert.match(String(primera), /checkCronAuth\(request\)/);
});

test('la marca vive en el workspace de la PLATAFORMA, no en el del contexto', () => {
  const src = sinComentarios(leer(RUTA));
  assert.match(src, /runWithWorkspace\(await wsSuperAdmin\(\)/);
  assert.doesNotMatch(src, /getWorkspaceActual/, 'sin cookies cae al ws1, que es un CLIENTE');
});

test('el vigía NO escribe ni manda nada', () => {
  const src = sinComentarios(leer(RUTA));
  for (const prohibido of [/sendText/, /enviarWhatsapp/, /enviarMensaje/, /sendEmail/, /crearPendiente/, /agregarParticipante/]) {
    assert.doesNotMatch(src, prohibido, 'el vigía es sólo-lectura: esa regla la lleva escrita desde el 17/10');
  }
});

test('los incidentes de error-app no llevan ticket acá: ya lo tienen', () => {
  const src = sinComentarios(leer(RUTA));
  assert.match(src, /paraTicket\s*=\s*nuevos\.filter\(\(i\) => !i\.tipos\.includes\('error-app'\)\)/);
});

test('la marca se escribe DESPUES de crear los tickets', () => {
  const src = sinComentarios(leer(RUTA));
  assert.ok(src.indexOf('crearTicket(') < src.indexOf('setSetting('), 'con la marca primero, lo que no alcanzó a abrir ticket se pierde');
});

test('no poder leer corta con 503 y sin mover la marca', () => {
  const src = leer(RUTA);
  const noPude = src.slice(src.indexOf("motivo: 'no-pude-leer'"));
  assert.match(noPude.slice(0, 260), /marcaAvanzo: false/);
  assert.match(noPude.slice(0, 260), /status: 503/);
  assert.equal(sinComentarios(src).includes('setSetting'), true);
  // Y el único setSetting vive después del punto 3, no en el camino de error.
  assert.equal(sinComentarios(src).split('setSetting(').length - 1, 1, 'un solo lugar escribe la marca');
});

test('el default del interruptor es apagado', () => {
  const src = sinComentarios(leer(RUTA));
  assert.match(src, /return v === 'on' \|\| v === 'seco' \? v : 'off'/);
});

test('el cron está declarado en vercel.json cada 15 minutos', () => {
  const j = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  const c = j.crons.find((x) => x.path === '/api/cron/vigia-grupos');
  assert.ok(c, 'una ruta de cron sin su entrada en vercel.json no corre nunca');
  assert.equal(c!.schedule, '*/15 * * * *');
});
