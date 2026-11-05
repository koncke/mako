// =============================================================================
// La moderación de Creem antes de generar imagen o video (5/11/2026)
// =============================================================================
// Creem exige a quien genera imagen o video desde un prompt que cada prompt pase por su Moderation API antes de llegar al
// modelo (docs/relevo/nube-creem-revision.md). Acá se fija, EJECUTANDO:
//   1. la regla pura (lib/creem-moderacion-reglas.ts) con un fetch de mentira: qué se manda, a dónde, con qué clave; qué
//      frena (deny, flag) y qué no (allow, y Creem caído: lo pedido); que no se paga dos veces el mismo prompt; que una
//      respuesta que no se entiende NO es un «allow»; que la medición no lleva el prompt (es de un cliente);
//   2. la cola REAL (`encolar`, lib/flow-cola.ts) en tests/_creem-moderacion-hijo.ts: lo frenado no se encola, lo que
//      pasa sí, y cada llamada queda en anthropic_usage a nombre de la plataforma, con la clave de la plataforma.
//
// PROBADO ROMPIÉNDOLO (5/11/2026), con el archivo en verde (8 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · `flag` deja pasar (`r.decision !== 'deny'` en vez de `=== 'allow'`)                    → 6 / 2
//   · `encolar` sin la moderación (`if (false && generaDesdePrompt(tipo))`)                  → 7 / 1
//   · una respuesta sin `decision` tomada como allow                                          → 7 / 1
//   · el recuerdo sin el ws en la clave                                                       → 7 / 1
//   · la clave del NEGOCIO en vez de la de la plataforma (`credDelCliente('CREEM_API_KEY')`)  → 7 / 1
//   · el cuerpo del error de Creem copiado al motivo                                          → 6 / 2
// Correr: node --import tsx --test tests/creem-moderacion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  CREEM_MODERACION, CREEM_MODERACION_PRUEBA, SI_CREEM_NO_CONTESTA, TEXTO_RECHAZO, externalId, leerRespuesta, moderarConDeps,
  motivoDeMedicion, urlDeModeracion, type DepsModeracion,
} from '../lib/creem-moderacion-reglas';

const RAIZ = join(__dirname, '..');

type Pedido = { url: string; clave: string; cuerpo: Record<string, unknown> };

function deps(o: { clave?: string | null; status?: number; body?: unknown; tira?: Error; claveTira?: boolean } = {}) {
  const pedidos: Pedido[] = [];
  let reloj = 1_000_000;
  const d: DepsModeracion = {
    clave: async () => { if (o.claveTira) throw new Error('base caída'); return o.clave === undefined ? 'creem_clave_real' : o.clave; },
    fetch: (async (url: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      pedidos.push({ url: String(url), clave: h.get('x-api-key') ?? '', cuerpo: JSON.parse(String(init.body)) });
      if (o.tira) throw o.tira;
      return new Response(JSON.stringify(o.body ?? {}), { status: o.status ?? 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch,
    ahora: () => (reloj += 7),
    recuerdo: new Map(),
    huella: (s) => `h:${s}`,
  };
  return { d, pedidos };
}

const respuesta = (decision: string, units = 1) => ({ id: `mod_${decision}`, object: 'moderation', prompt: 'p', decision, usage: { units } });
const CTX = { ws: 13, origen: 'generar_clip', azar: 'abc-123' };

test('allow: manda el prompt entero a Creem, con la clave en x-api-key y un external_id sin datos de la persona; y deja generar', async () => {
  const { d, pedidos } = deps({ body: respuesta('allow', 2) });
  const prompt = '  Una toma de una persona hablando a cámara en una oficina luminosa, plano medio.  ';
  const v = await moderarConDeps(prompt, CTX, d);
  assert.equal(v.paso, true);
  assert.equal(v.por, 'creem');
  assert.ok(v.por === 'creem' && v.decision === 'allow' && v.unidades === 2);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, CREEM_MODERACION);
  assert.equal(pedidos[0].clave, 'creem_clave_real');
  assert.equal(pedidos[0].cuerpo.prompt, prompt.trim(), 'el prompt FINAL, entero: moderar un recorte es moderar otra cosa');
  assert.equal(pedidos[0].cuerpo.external_id, 'mako_ws13:generar_clip:abc-123');
  assert.doesNotMatch(String(pedidos[0].cuerpo.external_id), /@/);
});

test('deny y flag FRENAN, con el texto que dice qué pasó y qué hacer; una clave de prueba va al host de prueba', async () => {
  for (const decision of ['deny', 'flag']) {
    const { d, pedidos } = deps({ clave: 'creem_test_abc', body: respuesta(decision) });
    const v = await moderarConDeps('algo que Creem no deja', CTX, d);
    assert.equal(v.paso, false, decision);
    assert.ok(!v.paso && 'texto' in v && v.texto === TEXTO_RECHAZO, decision);
    assert.equal(pedidos[0].url, CREEM_MODERACION_PRUEBA, 'creem_test_ va a test-api.creem.io');
  }
  assert.match(TEXTO_RECHAZO, /hola-mako\.com\/aup/, 'el rechazo nombra la política de uso');
  assert.match(TEXTO_RECHAZO, /No se gastó nada/);
  assert.equal(urlDeModeracion('creem_abc'), CREEM_MODERACION);
});

test('el mismo prompt del mismo negocio no se vuelve a pagar; el de OTRO negocio sí se pregunta', async () => {
  const { d, pedidos } = deps({ body: respuesta('allow') });
  await moderarConDeps('el mismo pedido', CTX, d);
  const v2 = await moderarConDeps('el mismo pedido', CTX, d);
  assert.equal(pedidos.length, 1, 'el reintento no llama de nuevo');
  assert.ok(v2.por === 'creem' && v2.recordado === true);
  await moderarConDeps('el mismo pedido', { ...CTX, ws: 14 }, d);
  assert.equal(pedidos.length, 2, 'el recuerdo es por negocio: una caché del server es de todos los inquilinos');
  // Un deny también se recuerda: insistir con lo mismo no paga otra llamada.
  const r = deps({ body: respuesta('deny') });
  await moderarConDeps('lo negado', CTX, r.d);
  const otra = await moderarConDeps('lo negado', CTX, r.d);
  assert.equal(r.pedidos.length, 1);
  assert.equal(otra.paso, false);
});

test(`si Creem no contesta (5xx, tiempo, la red), lo pedido: ${SI_CREEM_NO_CONTESTA === 'generar' ? 'se genera igual' : 'se frena'}, con el motivo`, async () => {
  const casos = [
    deps({ status: 500, body: { message: 'caído', prompt: 'SECRETO-DEL-CLIENTE' } }),
    deps({ status: 429, body: {} }),
    deps({ tira: Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }),
    deps({ tira: new TypeError('fetch failed') }),
  ];
  for (const { d } of casos) {
    const v = await moderarConDeps('un pedido normal', CTX, d);
    assert.equal(v.por, 'creem_no_contesto');
    assert.equal(v.paso, SI_CREEM_NO_CONTESTA === 'generar');
    const m = motivoDeMedicion(v, CTX);
    assert.doesNotMatch(m, /SECRETO-DEL-CLIENTE|un pedido normal/, 'ni el prompt ni el cuerpo del error van a la medición');
  }
  // Y lo de Creem caído NO se recuerda: el próximo intento vuelve a preguntar.
  const { d, pedidos } = deps({ status: 503 });
  await moderarConDeps('x', CTX, d);
  await moderarConDeps('x', CTX, d);
  assert.equal(pedidos.length, 2);
});

test('una respuesta que no se entiende NO es un «allow»: es Creem que no contestó bien, y no se recuerda', async () => {
  for (const body of [{}, { decision: 'maybe' }, { decision: 'ALLOW' }, null, ['allow']]) {
    const { d, pedidos } = deps({ body });
    const v = await moderarConDeps('y', CTX, d);
    assert.equal(v.por, 'creem_no_contesto', JSON.stringify(body));
    await moderarConDeps('y', CTX, d);
    assert.equal(pedidos.length, 2, 'no se guardó como decisión');
  }
  assert.equal(leerRespuesta({ decision: 'allow', usage: { units: 3 }, id: 'm' })?.unidades, 3);
  assert.equal(leerRespuesta({ decision: 'deny' })?.unidades, 0, 'sin usage, 0 unidades (no se inventa)');
});

test('lo que es NUESTRO (sin clave, clave rechazada, base caída) no frena a quien genera, y no llama de más', async () => {
  const sin = deps({ clave: null });
  const v1 = await moderarConDeps('z', CTX, sin.d);
  assert.ok(v1.paso && v1.por === 'sin_clave');
  assert.equal(sin.pedidos.length, 0, 'sin clave no hay llamada');
  const caida = deps({ claveTira: true });
  const v2 = await moderarConDeps('z', CTX, caida.d);
  assert.ok(v2.paso && v2.por === 'sin_clave');
  for (const status of [401, 403]) {
    const r = deps({ status, body: { message: 'bad key' } });
    const v = await moderarConDeps('z', CTX, r.d);
    assert.ok(v.paso && v.por === 'clave_rechazada', String(status));
  }
  const vacio = deps({ body: respuesta('allow') });
  assert.equal((await moderarConDeps('   ', CTX, vacio.d)).por, 'vacio');
  assert.equal(vacio.pedidos.length, 0, 'un prompt vacío no se paga');
});

test('el external_id: el negocio y el origen, saneados; nunca un email', () => {
  assert.equal(externalId(9, 'generar_imagen', 'a-b'), 'mako_ws9:generar_imagen:a-b');
  assert.equal(externalId(null, 'x@y.com', 'z@w'), 'mako_ws0:xycom:zw');
});

test('ejecutando la cola REAL (tests/_creem-moderacion-hijo.ts): lo frenado no se encola, y cada llamada queda medida', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_creem-moderacion-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida);
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  // deny y flag: el rechazo vuelve y NO hay trabajo encolado.
  assert.equal(r.deny.r?.rechazado, true);
  assert.equal(r.deny.trabajos, 0, 'lo que Creem niega no llega a la cola');
  assert.equal(r.flag.r?.rechazado, true);
  assert.equal(r.flag.trabajos, 0);
  // allow: se encola, en el negocio que generó.
  assert.equal(typeof r.allow.r, 'number');
  assert.equal(r.allow.trabajos, 1);
  assert.equal(r.allow.workspace, 13);
  // el mismo prompt otra vez: sin llamar.
  assert.equal(r.recordado.llamadas, 0);
  assert.equal(r.recordado.trabajos, 2);
  // Creem caído: se genera igual (lo pedido).
  if (SI_CREEM_NO_CONTESTA === 'generar') {
    assert.equal(r.caido.r, 'number');
    assert.equal(r.caido.trabajos, 3);
  }
  // lo que no genera no pasa por Creem; lo que genera sin prompt no se encola.
  assert.equal(r.creditos.llamadas, 0);
  assert.equal(r.sinPrompt.r, null);
  assert.equal(r.sinPrompt.nuevos, 0);
  // la clave: SIEMPRE la de la plataforma, al host real.
  assert.deepEqual(r.claves, ['plataforma'], 'quien vende MaKo en Creem es MaKo: modera con su clave, no con la del negocio');
  assert.deepEqual(r.hosts, ['api.creem.io/v1/moderation/prompt']);
  // la medición: una fila por llamada (deny, flag, allow, caído), a nombre de la plataforma, sin el prompt.
  assert.equal(r.usos.length, 4);
  for (const u of r.usos) {
    assert.equal(u.ws, 9, 'el gasto es de MaKo, no del negocio que generó');
    assert.equal(u.provider, 'creem');
    assert.equal(u.feature, 'creem-moderacion');
    assert.match(u.motivo, /^ws 13 · generar_(clip|imagen) · /);
    assert.doesNotMatch(u.motivo, /auto rojo|casa en la playa|Creem niega|Creem marca/, 'el prompt es de un cliente: no va a la medición');
  }
});
