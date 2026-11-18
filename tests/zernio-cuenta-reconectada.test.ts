// =============================================================================
// Ticket #113 (Leandro, ws10): la cuenta de Instagram RECONECTADA en Zernio vuelve a recibir los comentarios
// =============================================================================
// El 14/11/2026 Leandro reconectó Instagram en Zernio y la cuenta nació con OTRO id (fiestamusic: 6af88ded…). El ruteo
// (`webhook_routing`, servicio `zernio_cuenta`) seguía con el viejo (6acc51b9…, del 12/10), que ya no existe en ninguna clave.
// Un `comment.received` trae SÓLO `account.accountId`: el webhook no lo encontraba y contestaba 200 «sin workspace». El
// `account.connected`, que es el que reclama las cuentas, se descartaba por lo mismo: un círculo. Del 14 al 18/11 no entró un
// comentario a las automatizaciones 706 a 712, y la ruta no tuvo un solo cambio en esos días: no fue un deploy.
//
// Ahora, con un evento firmado con el secreto de UN negocio (`?w=<ws>`) y una cuenta sin ruteo, se le pregunta a Zernio con las
// claves de ESE negocio si la cuenta es suya (`reclamarCuentaSinRuteo`, lib/zernio.ts), y si lo es se anota y el evento entra.
// Con el maestro, no: no hay negocio a quien preguntarle. Y una cuenta ya ruteada a OTRO negocio no llega a esta pregunta: la
// sigue frenando `aceptaElWorkspace` (tests/zernio-secreto-por-negocio.test.ts).
//
// lib/zernio.ts y el route importan `server-only`: el cableado se fija sobre el FUENTE, como en ese test.
//
// PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez con un arnés que restaura el archivo (base: 3 pass / 0 fail):
//   · el route sin la pregunta (lo de antes del arreglo)                        → 2 / 1, «el webhook le pregunta…».
//   · la pregunta también con el maestro (`typeof w === 'number'` → `true`)     → 2 / 1, «el webhook le pregunta…».
//   · `reclamarCuentaSinRuteo` anotando sin preguntarle a Zernio                → 2 / 1, «la pregunta la contesta Zernio…».
//   · `reclamarCuentaSinRuteo` con lo cacheado (sin relectura)                  → 2 / 1, «la pregunta la contesta Zernio…».
// Restaurado: 3 / 0.
//
// Correr: node --import tsx --test tests/zernio-cuenta-reconectada.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const funcion = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está «${firma}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `«${firma}» no cierra`);
  return src.slice(i, j + 2);
};

const ROUTE = sinComentarios(leer('../app/api/webhooks/zernio/route.ts'));
const ZERNIO = sinComentarios(leer('../lib/zernio.ts'));

test('el webhook le pregunta a Zernio por la cuenta sin ruteo, sólo con la firma de un negocio y antes del «sin workspace»', () => {
  const i = (s: string) => { const k = ROUTE.indexOf(s); assert.ok(k >= 0, `no está «${s}»`); return k; };
  const pregunta = "if (ws == null && typeof w === 'number' && cuenta && (await reclamarCuentaSinRuteo(w, cuenta))) ws = w;";
  assert.ok(i(pregunta) > i('if (ws == null && cuenta) ws = await wsPorIdentificadorEstricto(RUTEO_CUENTA, cuenta);'), 'primero el ruteo de siempre');
  assert.ok(i(pregunta) < i("return responderFalloDeRuteo('zernio', err,"), 'adentro del try: un fallo de lectura va por responderFalloDeRuteo');
  assert.ok(i(pregunta) < i('if (ws == null) {'), 'después del «sin workspace» ya es tarde: el comentario se pierde');
  assert.ok(i(pregunta) < i('if (!aceptaElWorkspace(w, ws, cuentaPropia)) {'), 'y la guarda de la firma sigue después');
});

test('la pregunta la contesta Zernio con las claves de ESE negocio, releyendo, y sólo entonces se anota', () => {
  const f = funcion(ZERNIO, 'export async function reclamarCuentaSinRuteo(');
  assert.match(f, /for \(const k of await clavesZernio\(ws, \{ fresca: true \}\)\)/, 'todas las claves del negocio, la 2 también');
  assert.match(f, /await idsDeCuentasDe\(k, true\)/, 'con lo cacheado, la cuenta recién conectada no aparece');
  const iPregunta = f.indexOf('if (!ids?.has(accountId)) continue;');
  const iAnota = f.indexOf('await upsertRouting(RUTEO_CUENTA, accountId, ws);');
  assert.ok(iPregunta > 0 && iAnota > iPregunta, 'se anota la cuenta sólo si Zernio la lista en una clave del negocio');
  assert.match(f, /return false;\n\}/, 'si no es de ninguna clave, no se anota nada');
});

test('el route no anota cuentas por su cuenta: la que dice el cuerpo nunca entra al ruteo sin la pregunta', () => {
  assert.doesNotMatch(ROUTE, /\bupsertRouting\(/);
});
