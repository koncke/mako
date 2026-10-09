// =============================================================================
// La lectura que decide DE QUIÉN es un evento entrante va ESTRICTA, en TODOS los webhooks
// =============================================================================
// El 06/10/2026 se arregló en Calendly (tests/calendly-error.test.ts): con `wsPorIdentificador`,
// que no lee el `error` de supabase-js, la base caída daba null y un webhook lo leía como «este
// evento no es de ningún negocio» → 200 y perdido. Quedaron cuatro con la misma lectura: Cal.com,
// Chatwoot, Fathom y Meta. Este test los fija y barre la carpeta entera, para que el webhook
// siguiente no nazca con la lectura que traga el error. (El de Chatwoot se borró el 09/10/2026,
// con toda la integración: tests/sin-chatwoot.test.ts.)
//
// Qué contesta cada uno depende de qué hace el proveedor con un 5xx (medido el 07/10/2026, ver
// lib/webhook-fallo-ruteo.ts): Fathom (Svix) reintenta y deshabilita a los 5 días, Meta reintenta
// ~36 h, Cal.com no reintenta nunca.
//
// Probado rompiéndolo (07/10/2026), una rotura por vez y restaurando desde memoria: la huella con
// la vieja primero o aceptando cualquier servicio; Cal.com con el ruteo, la key o la J2
// tolerantes, sin tope de largo o con la key fuera del clasificador; Fathom con el ruteo o el
// secreto tolerantes; Chatwoot tolerante o sin anotar; Meta sin pedir el reintento, sin el 503
// del lote o con el token tolerante; la anotación fuera del super admin; y 503 para todo. Las
// DIECISÉIS dieron 8 pasan / 1 falla. Restaurado: 9 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { esErrorTransitorio } from '../lib/calendly-error';
import { huellaRuteoPrevia, sumarFalloRuteo, conReintentoTransitorio, TOPE_FALLOS_RUTEO, type FalloRuteo } from '../lib/webhook-ruteo-huella';
import { execFileSync } from 'node:child_process';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const ruta = (nombre: string) => sinComentarios(leer(`../app/api/webhooks/${nombre}/route.ts`));

// ── La huella ────────────────────────────────────────────────────────────────

const fallo = (i: number, extra: Partial<FalloRuteo> = {}): FalloRuteo => ({
  cuando: `2026-10-07T21:${String(i).padStart(2, '0')}:00.000Z`, servicio: 'calcom',
  identificador: `evento-${i}`, transitorio: true, mensaje: `fallo ${i}`, ...extra,
});

test('la huella guarda las más recientes, la nueva primero, y topea', () => {
  let h: FalloRuteo[] = [];
  for (let i = 0; i < TOPE_FALLOS_RUTEO + 5; i++) h = sumarFalloRuteo(h, fallo(i));
  assert.equal(h.length, TOPE_FALLOS_RUTEO);
  assert.equal(h[0].mensaje, `fallo ${TOPE_FALLOS_RUTEO + 4}`, 'la más nueva no quedó primera');
  assert.equal(h.at(-1)?.mensaje, 'fallo 5', 'se tiraron las nuevas en vez de las viejas');
});

test('lo guardado se sanea: basura no tira ni se arrastra', () => {
  assert.deepEqual(huellaRuteoPrevia(null), []);
  assert.deepEqual(huellaRuteoPrevia('no es json'), []);
  assert.deepEqual(huellaRuteoPrevia('{"no":"es lista"}'), []);
  const mezcla = JSON.stringify([fallo(1), { cuando: 'x' }, fallo(2, { servicio: 'otro' as FalloRuteo['servicio'] }), 7]);
  assert.deepEqual(huellaRuteoPrevia(mezcla).map((f) => f.mensaje), ['fallo 1']);
});

// ── El clasificador, sobre el error que TIRA la lectura estricta ─────────────

test('la base caída se reintenta; una consulta rota no', () => {
  // La forma de `wsPorIdentificadorEstricto`: su mensaje envuelve el de supabase-js y trae
  // `code`/`details`/`hint` del original (lib/webhook-routing.ts).
  const caida = Object.assign(new Error('webhook_routing (calcom): TypeError: fetch failed'), { code: '', details: 'TypeError: fetch failed', hint: '' });
  const rota = Object.assign(new Error('webhook_routing (calcom): column webhook_routing.identificador does not exist'), { code: '42703', details: null, hint: null });
  assert.equal(esErrorTransitorio(caida), true, 'la base caída tiene que contestarse 503');
  assert.equal(esErrorTransitorio(rota), false, 'una columna que no existe no se arregla reintentando');
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('NINGÚN webhook rutea con la lectura que traga el error', () => {
  const dir = new URL('../app/api/webhooks/', import.meta.url);
  const malos = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/route.ts`, dir)))
    .map((d) => d.name)
    .filter((n) => /\bwsPorIdentificador\(/.test(ruta(n)));
  assert.deepEqual(malos, [], `estos webhooks leen el ruteo con wsPorIdentificador: con la base caída, «no pude leer» se contesta como «no es de nadie»`);
});

test('Cal.com: ruteo, firma y R1/R2 estrictos, y el fallo pasa por el clasificador', () => {
  const src = ruta('calcom');
  assert.ok(!/\bcredWs\(/.test(src), 'una credencial de Cal.com volvió a leerse con la lectura que traga el error');
  assert.match(src, /credWsEstricta\('CALCOM_WEBHOOK_SECRET', ws\)/);
  assert.match(src, /credWsEstricta\('CALCOM_EVENT_TYPE_J2', ws\)/, 'sin J2 una R2 se clasifica como R1 y CREA un lead');
  assert.equal((src.match(/responderFalloDeRuteo\('calcom'/g) ?? []).length, 2, 'el ruteo y la key tienen que fallar por el clasificador');
  assert.match(src, /c\.length <= 300/, 'sin tope de largo, un identificador gigante sin firmar anota un fallo por pedido');
});

test('Fathom: ruteo y secreto estrictos, y el fallo pasa por el clasificador', () => {
  const src = ruta('fathom');
  assert.ok(!/\bcredWs\(/.test(src), 'el secreto de Fathom volvió a leerse con la lectura que traga el error');
  assert.match(src, /credWsEstricta\('FATHOM_WEBHOOK_SECRET', ws\)/);
  assert.equal((src.match(/responderFalloDeRuteo\('fathom'/g) ?? []).length, 2);
});

test('Meta: un ruteo que no se pudo leer de forma transitoria hace reintentar el LOTE', () => {
  const src = ruta('meta-leads');
  assert.match(src, /anotarFalloDeRuteo\('meta', err, pageId\)/);
  assert.match(src, /if \(transitorio\) reintentar = true;/, 'el fallo transitorio del ruteo ya no pide el reintento');
  const i503 = src.indexOf('if (reintentar) {');
  const iOk = src.lastIndexOf('return Response.json({ ok: true, processed');
  assert.ok(i503 > 0 && i503 < iOk, 'el 503 del lote tiene que decidirse antes del 200 final');
  assert.match(src.slice(i503, iOk), /status: 503/);
  assert.match(src, /credWsEstricta\('META_PAGE_ACCESS_TOKEN', ws\)/, 'con la base caída el lead se anota «token no configurado»');
});

test('el fallo de ruteo contesta 503 SÓLO si reintentar lo arregla, y anota en el super admin', () => {
  const src = sinComentarios(leer('../lib/webhook-fallo-ruteo.ts'));
  assert.match(src, /runWithWorkspace\(await wsSuperAdmin\(\)/, 'fuera del super admin, setSetting cae al ws1 —un cliente—');
  assert.match(src, /getSettingEstricto\(KEY_FALLOS_RUTEO\)/, 'con la lectura tolerante, un error de lectura PISA la huella');
  const resp = src.slice(src.indexOf('export async function responderFalloDeRuteo('));
  assert.match(resp, /if \(transitorio\) \{[\s\S]*?status: 503[\s\S]*?\}\s*\n[\s\S]*?status: 200/, 'un fallo que no se arregla reintentando no puede ir 5xx');
});

// ── Fuera de los webhooks: /api/track y los tokens (07/10/2026) ───────────────
// El mismo null, en las otras puertas que deciden de quién es algo que entra SIN sesión: el
// formulario de una landing (un lead), los beacons de medición, el bearer de la skill de Claude
// y el chequeo de salud del webhook de Chatwoot (este último se fue con la integración, el 09/10/2026).
//
// Probado rompiéndolo (07/10/2026), una por vez y restaurando desde memoria: optin sin reintento
// (14 / 1), optin y vsl tolerantes (13 / 2 cada uno: el barrido y su guard), replay contestando
// 200, el token con getSetting, una ruta del agente que se traga el 503, /api/v1 contestando
// 401, Chatwoot tolerante, el reintento que reintenta lo roto, el reintento sin tope y un permiso
// viejo en la lista de tolerantes (14 / 1 cada uno). Restaurado: 15 / 0.

/** Las únicas lecturas TOLERANTES del ruteo que quedan, cada una con su porqué. */
const TOLERANTES_A_PROPOSITO: Record<string, string> = {
  'lib/webhook-routing.ts': 'es la definición',
  'lib/landing-token.ts': 'espejarSiHaceFalta: «no pude leer» termina en un upsert idempotente; la estricta rompería /integraciones por un pestañeo',
};

test('NADIE en app/ ni lib/ decide de quién es algo con la lectura que traga el error', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { encoding: 'utf8' })
    .split(/\r?\n/).filter((f) => /\.tsx?$/.test(f));
  const malos = archivos
    .filter((f) => !(f in TOLERANTES_A_PROPOSITO))
    .filter((f) => /\bwsPorIdentificador\(/.test(sinComentarios(leer(`../${f}`))));
  assert.deepEqual(malos, [], 'leen el ruteo con wsPorIdentificador; si de verdad tiene que ser tolerante, va a TOLERANTES_A_PROPOSITO con su porqué');
  // Y la lista no guarda permisos viejos: si ya no la usa, el permiso sobra.
  for (const f of Object.keys(TOLERANTES_A_PROPOSITO)) {
    assert.match(sinComentarios(leer(`../${f}`)), /\bwsPorIdentificador\(/, `${f} ya no lee tolerante: sacalo de la lista`);
  }
});

test('el reintento en el server: sólo lo transitorio, con tope, y lo roto se tira en el acto', async () => {
  const caida = Object.assign(new Error('webhook_routing (landing): TypeError: fetch failed'), { details: 'TypeError: fetch failed' });
  const rota = Object.assign(new Error('webhook_routing (landing): column x does not exist'), { code: '42703' });
  let n = 0;
  assert.equal(await conReintentoTransitorio(async () => { n++; if (n < 3) throw caida; return 7; }, [0, 0]), 7);
  assert.equal(n, 3, 'un corte de segundos se cubre reintentando');
  n = 0;
  await assert.rejects(conReintentoTransitorio(async () => { n++; throw caida; }, [0, 0]));
  assert.equal(n, 3, 'el reintento no tiene tope');
  n = 0;
  await assert.rejects(conReintentoTransitorio(async () => { n++; throw rota; }, [0, 0]));
  assert.equal(n, 1, 'una consulta rota se reintentó: sólo demora el error');
});

test('optin: reintenta, y si igual no puede, anota y va 503', () => {
  const src = sinComentarios(leer('../app/api/track/optin/route.ts'));
  assert.match(src, /ws = await conReintentoTransitorio\(\(\) => wsPorIdentificadorEstricto\(LANDING_SERVICIO, token\)\);/,
    'el snippet manda el opt-in UNA vez: sin el reintento acá, un pestañeo de la base es un lead perdido');
  assert.match(src, /anotarFalloDeRuteo\('landing', err, token\)/);
  assert.match(src, /status: 503, headers: CORS/);
});

test('los beacons de medición: estrictos y 503, sin reintento', () => {
  for (const r of ['vsl', 'replay']) {
    const src = sinComentarios(leer(`../app/api/track/${r}/route.ts`));
    assert.match(src, /ws = await wsPorIdentificadorEstricto\(LANDING_SERVICIO, token\);/, `${r} volvió a la lectura tolerante`);
    assert.match(src, /\{ ok: false, error: 'ruteo' \}, \{ status: 503, headers: CORS_HEADERS \}/, `${r} contesta «sin workspace» sobre una lectura que falló`);
    assert.ok(!/conReintentoTransitorio/.test(src), `${r}: reintentar cada beacon en un corte le suma carga a la base caída`);
  }
});

test('el token del agente: «no pude verificar» es 503, nunca 401', () => {
  // Desde el 09/10/2026 la lógica vive en lib/agente-token-nucleo.ts (con test propio:
  // tests/agente-token-hash.test.ts) y lib/agente-token.ts arma la base de verdad. Lo que se
  // fija acá es esa base: las dos lecturas que autentican, estrictas, y con el reintento.
  // Probado rompiéndolo (09/10/2026): el setting con getSetting, 1 fallo / 14 pases; sin
  // conReintentoTransitorio, 1 fallo / 14 pases.
  const tok = sinComentarios(leer('../lib/agente-token.ts'));
  assert.match(tok, /wsPorIndice: \(identificador\) => wsPorIdentificadorEstricto\(AGENTE_SERVICIO, identificador\)/);
  assert.match(tok, /leerSetting: \(ws\) => runWithWorkspace\(ws, \(\) => getSettingEstricto\(AGENTE_TOKEN_KEY\)\)/, 'con getSetting, la base caída da «revocado» sobre un token vigente');
  assert.match(tok, /conReintentoTransitorio\(\(\) => wsDeTokenCon\(almacen, t\)\)/, 'sin el reintento, un pestañeo de la base es un 503 sobre un token bueno');
  assert.match(tok, /status: 503/);
  for (const r of ['consultar', 'contexto', 'hook', 'lead', 'metricas', 'plan', 'skill', 'telemetria']) {
    const src = sinComentarios(leer(`../app/api/agente/${r}/route.ts`));
    assert.ok(!/wsPorAgenteToken\(/.test(src), `/api/agente/${r} volvió a llamar al resolvedor que tira sin contestar`);
    assert.match(src, /if \(ws instanceof Response\) return ws;/, `/api/agente/${r} no devuelve el 503 y se lo traga como 401`);
  }
  const http = sinComentarios(leer('../lib/api-mako/http.ts'));
  assert.match(http, /catch \(e\) \{[\s\S]{0,300}status: 503/, '/api/v1 contesta 401 «token inválido» cuando la base no dejó verificarlo');
});
