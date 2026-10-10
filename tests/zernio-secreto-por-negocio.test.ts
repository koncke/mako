// =============================================================================
// El webhook de Zernio: un secreto por negocio con cuenta propia, y la firma lo ata a ese negocio
// =============================================================================
// Hallazgo #4 de la revisión adversarial de la sexta tanda (10/10/2026). `asegurarWebhook` le daba el
// secreto ÚNICO del webhook (`ZERNIO_WEBHOOK_SECRET`, el que verifica los eventos de TODOS los
// negocios) a la cuenta de Zernio del cliente, y lo que está en esa cuenta lo lee quien tenga su key:
// `GET /v1/webhooks/settings` devuelve el `secret` en claro (medido en producción el 10/10/2026 sobre
// la cuenta de la plataforma: el campo viene, y es el maestro). Con él, un cliente firmaba un
// `message.received` con el profile de otro negocio y le creaba leads en su CRM, o un
// `account.connected` con la cuenta de otro y se quedaba con su ruteo (gana el primero que reclama).
//
// Ahora: la cuenta propia recibe `secretoDeWorkspace(maestro, ws)` y una URL con `?w=<ws>`; el webhook
// verifica con el secreto que nombra el `?w=` y exige que el evento ruteado sea de ESE negocio antes
// de reclamarlo; el maestro sólo vale para negocios sin cuenta propia; y un `account.connected` ya no
// reclama la cuenta que dice el cuerpo, sino las que lista la cuenta de Zernio de ese negocio.
// (Sin esto último, el `ws === w` que proponía la revisión no alcanzaba: el dueño de una cuenta propia
// firma en SU `?w=` un cuerpo con el `accountId` de otro.)
//
// Lo puro (lib/zernio-firma.ts) se EJECUTA, de punta a punta; lib/zernio.ts y el route importan
// `server-only`, así que su cableado se fija sobre el FUENTE, por función o por tramo.
//
// PROBADO ROMPIÉNDOLO (10/10/2026), una rotura por vez contra una base en verde (7 pass / 0 fail), con un
// arnés que restaura DE MEMORIA:
//   · `webhookDeLaCuenta` dándole el maestro a la cuenta propia              → 6 / 1, «de punta a punta…».
//   · el route verificando siempre con el maestro                            → 6 / 1, «el webhook…».
//   · un `?w=` roto cayendo al maestro (`secretoParaVerificar`)               → 6 / 1, «el `?w=` del webhook…».
//   · `aceptaElWorkspace` aceptando cualquier ws con el secreto de un negocio → 5 / 2, «de quién puede ser…» y «de punta a punta…».
//   · `aceptaElWorkspace` aceptando el maestro para una cuenta propia        → 6 / 1, «de quién puede ser…».
//   · el route sin la guarda `aceptaElWorkspace`                              → 6 / 1, «el webhook…».
//   · `account.connected` reclamando de nuevo la cuenta del cuerpo            → 6 / 1, «el webhook…».
//   · `usaCuentaPropia` con `credWs` (la lectura que traga el error)          → 6 / 1, «usaCuentaPropia…».
//   · el route sin preguntar si el negocio tiene cuenta propia               → 6 / 1, «el webhook…».
//   · `asegurarWebhook` registrando como si fuera la cuenta de la plataforma  → 6 / 1, «asegurarWebhook…».
//   · `wsDelWebhook` aceptando cualquier número (`/^\d+$/`)                   → 6 / 1, «el `?w=` del webhook…».
//   · el secreto derivado sin el workspace adentro                           → 6 / 1, «el secreto de un negocio…».
// Restaurado: 7 / 0.
//
// Correr: node --import tsx --test tests/zernio-secreto-por-negocio.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  verificarFirmaZernio, firmarZernio, secretoDeWorkspace, webhookDeLaCuenta, wsDelWebhook, secretoParaVerificar, aceptaElWorkspace,
} from '../lib/zernio-firma';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de primer nivel: desde su firma hasta el `}` en la columna 0. */
const funcion = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está «${firma}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `«${firma}» no cierra`);
  return src.slice(i, j + 2);
};

// ── El secreto del webhook por negocio (hallazgo #4) ────────────────────────

test('el secreto de un negocio: derivado, distinto por negocio y del maestro, y no firma por otro', () => {
  const m = 'maestro-de-prueba';
  const s11 = secretoDeWorkspace(m, 11);
  const s13 = secretoDeWorkspace(m, 13);
  assert.match(s11, /^[0-9a-f]{64}$/);
  assert.equal(s11, secretoDeWorkspace(m, 11), 'es determinista: no hay nada que guardar');
  assert.notEqual(s11, s13);
  assert.notEqual(s11, m);
  assert.notEqual(s11, secretoDeWorkspace('otro-maestro', 11));
  const raw = '{"id":"evt_1","event":"message.received"}';
  assert.equal(verificarFirmaZernio(raw, firmarZernio(raw, s13), secretoParaVerificar(m, 13)), true);
  assert.equal(verificarFirmaZernio(raw, firmarZernio(raw, s11), secretoParaVerificar(m, 13)), false, 'el secreto de ws11 firmaba por ws13');
  assert.equal(verificarFirmaZernio(raw, firmarZernio(raw, s11), secretoParaVerificar(m, null)), false, 'el secreto de un negocio no vale como el maestro');
});

test('el `?w=` del webhook: un workspace, nada, o roto — y roto no cae al maestro', () => {
  assert.equal(wsDelWebhook(null), null);
  assert.equal(wsDelWebhook('11'), 11);
  assert.equal(wsDelWebhook('1234567890'), 1234567890);
  for (const roto of ['', '0', '-1', '011', '1e3', '11abc', ' 11', '11.0', '12345678901']) {
    assert.equal(wsDelWebhook(roto), 'invalido', `«${roto}»`);
  }
  const m = 'maestro';
  assert.equal(secretoParaVerificar(m, null), m);
  assert.equal(secretoParaVerificar(m, 13), secretoDeWorkspace(m, 13));
  assert.equal(secretoParaVerificar(m, 'invalido'), null, 'un ?w= roto verificaba con el maestro');
  assert.equal(secretoParaVerificar(null, 13), null, 'fail-closed: sin maestro no hay secreto');
  assert.equal(secretoParaVerificar(null, null), null);
});

test('de quién puede ser un evento según cómo vino firmado', () => {
  assert.equal(aceptaElWorkspace(13, 13, true), true);
  assert.equal(aceptaElWorkspace(13, 11, true), false, 'con su secreto, ws13 metía eventos en el CRM de ws11');
  assert.equal(aceptaElWorkspace(13, 11, false), false);
  assert.equal(aceptaElWorkspace(null, 20, false), true, 'el maestro es de la cuenta de la plataforma: sus negocios');
  assert.equal(aceptaElWorkspace(null, 13, true), false, 'el maestro no vale para un negocio con cuenta propia');
  // Un BIGINT que llegara como texto no puede trabar en silencio a toda cuenta propia.
  assert.equal(aceptaElWorkspace(13, '13' as unknown as number, true), true);
});

test('de punta a punta: lo que se registra en una cuenta propia sólo firma eventos de ese negocio', () => {
  const m = 'maestro-de-prueba';
  const propia = webhookDeLaCuenta(m, 13, true);
  assert.notEqual(propia.secret, m, 'el maestro iba a la cuenta del cliente, que lo puede leer');
  const w = wsDelWebhook(new URL(`https://app.test${propia.ruta}`).searchParams.get('w'));
  assert.equal(w, 13);
  const raw = '{"id":"evt_2","event":"comment.received"}';
  const firma = firmarZernio(raw, propia.secret);
  assert.equal(verificarFirmaZernio(raw, firma, secretoParaVerificar(m, w)), true, 'el webhook tiene que poder verificar lo que registró');
  assert.equal(aceptaElWorkspace(w as number, 13, true), true);
  assert.equal(aceptaElWorkspace(w as number, 11, false), false);
  // Y sin el ?w= (quitándolo de la URL a mano) la misma firma no pasa.
  assert.equal(verificarFirmaZernio(raw, firma, secretoParaVerificar(m, null)), false);
  // La cuenta de la plataforma: el maestro y la URL pelada, como siempre.
  assert.deepEqual(webhookDeLaCuenta(m, 20, false), { ruta: '/api/webhooks/zernio', secret: m });
});

test('asegurarWebhook registra lo que dice webhookDeLaCuenta, y a Zernio nunca le manda el maestro suelto', () => {
  const f = funcion(sinComentarios(leer('../lib/zernio.ts')), 'export async function asegurarWebhook(');
  assert.match(f, /const \{ ruta, secret \} = webhookDeLaCuenta\(maestro, ws, c\.byok\);/);
  assert.match(f, /const url = linkApp\(ruta, null\);/);
  const envios = f.match(/JSON\.stringify\(\{[^}]*\}\)/g) ?? [];
  assert.equal(envios.length, 2, 'el PUT y el POST');
  for (const e of envios) {
    assert.match(e, /\bsecret\b/);
    assert.doesNotMatch(e, /maestro/, 'el maestro viajaba a la cuenta del negocio');
  }
  assert.match(f, /find\(\(w\) => \(w\.url \?\? ''\)\.trim\(\) === url\)/, 'sólo la URL exacta: la pelada puede ser el webhook compartido');
});

test('usaCuentaPropia: la misma pregunta que cfg, con la lectura estricta', () => {
  const f = funcion(sinComentarios(leer('../lib/zernio.ts')), 'export async function usaCuentaPropia(');
  assert.match(f, /if \(ws === OWNER_WS\) return false;/, 'para cfg el dueño nunca es BYOK');
  assert.match(f, /credWsEstricta\('ZERNIO_API_KEY', ws\)/);
  assert.doesNotMatch(f, /\bcredWs\(/, 'con la base caída, «no pude leer» se leería «no tiene key propia» y el maestro valdría');
});

test('el webhook: el secreto sale del ?w=, y la firma tiene que ser de ESE negocio antes de reclamar el evento', () => {
  const src = sinComentarios(leer('../app/api/webhooks/zernio/route.ts'));
  const i = (s: string) => { const k = src.indexOf(s); assert.ok(k >= 0, `no está «${s}»`); return k; };
  assert.ok(i("wsDelWebhook(req.nextUrl.searchParams.get('w'))") < i('secretoParaVerificar(maestro, w)'));
  assert.ok(i('secretoParaVerificar(maestro, w)') < i('verificarFirmaZernio(raw'));
  assert.match(src, /if \(w === 'invalido' \|\| !verificarFirmaZernio\(raw, firma, secret\)\)/);
  assert.doesNotMatch(src, /verificarFirmaZernio\([^)]*maestro/, 'verificar con el maestro sin mirar el ?w= es el agujero');
  // La cuenta propia se pregunta con el maestro, adentro del try del ruteo (un fallo va por responderFalloDeRuteo).
  const ruteo = src.slice(i('let cuentaPropia = false;'), i("return responderFalloDeRuteo('zernio', err,"));
  assert.match(ruteo, /if \(ws != null && w == null\) cuentaPropia = await usaCuentaPropia\(ws\);/);
  const iAcepta = i('if (!aceptaElWorkspace(w, ws, cuentaPropia)) {');
  assert.ok(iAcepta > i('if (ws == null) {'), 'primero de quién es');
  assert.ok(iAcepta < i(".from('zernio_eventos')"), 'un evento ajeno no puede consumir el id del evento');
  assert.ok(iAcepta < i('webhook_ok: true'), 'un evento ajeno no marca el webhook de nadie como andando');
  assert.ok(iAcepta < i('procesarEventoSocial('));
  // account.connected: se reclaman las cuentas que lista ESA cuenta, nunca la del cuerpo.
  assert.doesNotMatch(src, /\bupsertRouting\(/, 'el webhook volvió a reclamar la cuenta que dice el cuerpo');
  const conectada = src.slice(i("if (evento === 'account.connected') {"), i('const ev = eventoSocialDe(body);'));
  assert.match(conectada, /after\(\(\) => reclamarCuentasConectadas\(wsFinal\)\);/);
  const reclamar = funcion(src, 'async function reclamarCuentasConectadas(');
  assert.match(reclamar, /try \{\s*const n = \(await cuentasConectadas\(ws\)\)\.length;/, 'las cuentas salen de la API con la key de ESE negocio');
});
