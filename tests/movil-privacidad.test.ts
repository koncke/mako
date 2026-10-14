// =============================================================================
// MaKo Mobile: lo de UNA persona no le llega a otra (revisión adversarial del 11/10/2026)
// =============================================================================
// Dos promesas de MaKo Mobile que el código hacía y que se caían por una puerta de al lado:
//
//   A. LOS CHATS DEL TELÉFONO SON POR PERSONA (`chart_key = mako-movil:<persona>`,
//      lib/mako-turno-app.ts). La ruta del teléfono lo respetaba (`sesionDe`), pero las dos
//      rutas de ESCRITORIO que leen y escriben sesiones —/api/chart-insights y /api/mako-doer—
//      lo hacen POR ID y por workspace: un closer leía con `?sessionId=N` (ids correlativos)
//      o `?chartKey=mako-movil:u<id>` lo que el dueño habló con MaKo en su celular, y con
//      `send`/`rename`/`delete` se lo escribía o se lo borraba.
//
//   B. UNA SUSCRIPCIÓN DE PUSH ES DE LA PERSONA LOGUEADA. `asegurarRegistro` (re-atar la
//      suscripción de ESTE teléfono a quien está ahora) estaba escrita y sin call site, y el
//      cierre de sesión no soltaba nada: un teléfono que pasaba a otra cuenta —o quedaba sin
//      sesión— seguía recibiendo los avisos de la persona anterior, de SU negocio, y /m/cuenta
//      le decía «activo» a la nueva (mira sólo el navegador).
//
//   C. EL PUSH DEL DUEÑO ABRE SU PROPIA CUENTA. El link de un push lleva el `?ws=` del
//      destino, y para un admin global `?ws=<el suyo>` es «estoy mirando esa cuenta»: el push
//      de Martín (ws9) abría /m/plan con `tableroActual() = cliente` —0 tareas en
//      `experimento_tareas` contra 423 en `plan_tareas`, medido— y el cartel de «viendo una
//      cuenta». El workspace de plataforma va sin `?ws=` (`wsDelLink`, lib/push-payload.ts).
//
// Guards sobre el FUENTE donde hace falta un servidor o un teléfono, cada uno sobre el BLOQUE
// que importa y sin comentarios; `wsDelLink` es puro y se ejecuta.
//
// Probado rompiéndolo (base: 9 pasan / 0 fallan, 11/10/2026), restaurando de memoria:
//   · /api/mako-doer GET sin el corte de `esSesionDelTelefono`          → 8 / 1
//   · /api/chart-insights POST sin el corte de `esChatDelTelefono`     → 8 / 1
//   · ShellM sin `asegurarRegistro()`                                    → 8 / 1
//   · CerrarSesion con `soltarDeEstaCuenta` DESPUÉS del logout          → 8 / 1
//   · el literal de lib/chart-chats.ts cambiado a 'mako-mobil:'          → 8 / 1
//   · `wsDelLink` devolviendo siempre el destino                         → 8 / 1
//   · enviarPush armando el payload con `ws` pelado                       → 8 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PREFIJO_CHART_MOVIL } from '../lib/mako-turno-app-reglas';
import { armarPayloadPush, wsDelLink } from '../lib/push-payload';
import { APP_BASE_URL } from '../lib/app-url';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Las líneas primero (un `//` puede abrir un `/*` que se cierra páginas abajo). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque entre dos anclas, con su cierre REAL. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré el arranque del bloque: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre del bloque: ${hasta}`);
  return src.slice(i, j);
}

const pos = (src: string, aguja: string, que: string) => {
  const i = src.indexOf(aguja);
  assert.ok(i >= 0, `no está ${que} (${aguja})`);
  return i;
};

const RUTAS_ESCRITORIO = ['app/api/mako-doer/route.ts', 'app/api/chart-insights/route.ts'] as const;

test('A1. el prefijo de lib/chart-chats.ts es EL MISMO que PREFIJO_CHART_MOVIL', () => {
  const src = sinComentarios(leer('lib/chart-chats.ts'));
  const m = src.match(/const PREFIJO_CHAT_MOVIL = '([^']+)';/);
  assert.ok(m, 'lib/chart-chats.ts perdió su PREFIJO_CHAT_MOVIL');
  assert.equal(m[1], PREFIJO_CHART_MOVIL, 'los dos prefijos se separaron: el corte de escritorio deja pasar los chats del teléfono');
  const f = bloque(src, 'export function esChatDelTelefono(', 'export async function esSesionDelTelefono(');
  assert.match(f, /startsWith\(PREFIJO_CHAT_MOVIL\)/);
});

for (const ruta of RUTAS_ESCRITORIO) {
  test(`A2. ${ruta} GET: ni ?sessionId ni ?chartKey abren un chat del teléfono`, () => {
    const g = bloque(sinComentarios(leer(ruta)), 'export async function GET(', 'export async function POST(');
    const corteId = pos(g, 'esSesionDelTelefono(Number(sessionId))', 'el corte por id');
    assert.ok(corteId < pos(g, 'getSessionMessages(Number(sessionId))', 'la lectura de mensajes'), 'el corte por id va DESPUÉS de leer los mensajes');
    const corteKey = pos(g, 'esChatDelTelefono(chartKey)', 'el corte por clave');
    assert.ok(corteKey < pos(g, 'listSessions(chartKey, arch)', 'la lista por clave'), 'el corte por clave va DESPUÉS de listar');
  });

  test(`A3. ${ruta} POST: ninguna acción por id toca un chat del teléfono`, () => {
    const src = sinComentarios(leer(ruta));
    const p = src.slice(pos(src, 'export async function POST(', 'el POST'));
    const corte = pos(p, 'esSesionDelTelefono(Number(body.sessionId))', 'el corte por id');
    // El corte va ANTES de la primera acción: así cubre send/rename/pin/archive/delete y las que vengan.
    assert.ok(corte < pos(p, "action === 'open'", 'la primera acción'), 'el corte quedó después de alguna acción');
    if (ruta === 'app/api/chart-insights/route.ts') {
      // Ésta además recibe la CLAVE en el body (open/new): crear o abrir con la clave de otro.
      assert.ok(pos(p, 'esChatDelTelefono(chartKey)', 'el corte por clave') < pos(p, "action === 'open'", 'la primera acción'));
    }
  });
}

test('B1. el shell de /m re-ata la suscripción de ESTE teléfono a quien está logueado', () => {
  const src = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  assert.match(src, /import \{ asegurarRegistro \} from '@\/lib\/push-cliente';/);
  const f = bloque(src, "navigator.serviceWorker.register('/sw.js'", '}, []);');
  assert.match(f, /asegurarRegistro\(\)/, 'nadie llama a asegurarRegistro: la fila sigue siendo de la persona anterior');
});

test('B2. cerrar sesión suelta la fila de ESTE teléfono ANTES del logout, sin desuscribir el navegador', () => {
  const c = sinComentarios(leer('app/m/_ui/CerrarSesion.tsx'));
  assert.ok(pos(c, 'await soltarDeEstaCuenta()', 'el soltar') < pos(c, "'/api/auth/logout'", 'el logout'), 'el DELETE necesita la sesión: va antes del logout');
  const f = bloque(sinComentarios(leer('lib/push-cliente.ts')), 'export async function soltarDeEstaCuenta(', 'export async function probar(');
  assert.match(f, /method: 'DELETE'/);
  assert.match(f, /AbortSignal\.timeout\(/, 'cerrar sesión no puede esperar a la red sin techo');
  assert.doesNotMatch(f, /\.unsubscribe\(/, 'soltar NO desuscribe: el próximo que entre recupera la suscripción sin volver a pedir permiso');
});

test('C1. el link de un push va sin `?ws=` SÓLO para el workspace de plataforma', () => {
  assert.equal(wsDelLink(9, 9), null, 'el push del dueño abriría su propia cuenta como «vista de un cliente»');
  assert.equal(wsDelLink(13, 9), 13, 'el push de un cliente perdió su `?ws=`');
  assert.equal(wsDelLink(13, null), 13, 'sin saber cuál es la plataforma, el destino se respeta');
  assert.equal(wsDelLink(null, 9), null);
  // De punta a punta: con el ws ya pasado por `wsDelLink`, la URL del dueño sale pelada.
  assert.equal(armarPayloadPush({ tipo: 'plan-proyecto-vence', titulo: 'x', cuerpo: 'x', ruta: '/plan/agencia' }, wsDelLink(9, 9)).url, `${APP_BASE_URL}/plan`);
  assert.equal(armarPayloadPush({ tipo: 'x', titulo: 'x', cuerpo: 'x', ruta: '/plan' }, wsDelLink(13, 9)).url, `${APP_BASE_URL}/plan?ws=13`);
});

test('C2. los DOS envíos de lib/push.ts arman el link con `wsDelLink`', () => {
  const src = sinComentarios(leer('lib/push.ts'));
  const llamadas = [...src.matchAll(/armarPayloadPush\(([\s\S]*?)\);/g)].map((m) => m[1]);
  assert.equal(llamadas.length, 2, `esperaba 2 armados del payload (enviarPush y enviarPushAUsuario), hay ${llamadas.length}`);
  for (const l of llamadas) assert.match(l, /wsDelLink\(ws, await wsSuperAdmin\(\)/, 'un envío arma el link con el `ws` pelado');
});
