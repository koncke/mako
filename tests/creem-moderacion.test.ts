// =============================================================================
// La moderación antes de generar imagen o video: sin proveedor desde el 5/11/2026, y lista para otro
// =============================================================================
// Nació el 5/11/2026 porque Creem exigía moderar cada prompt de imagen o video (docs/relevo/nube-creem-revision.md). Creem
// rechazó la tienda de MaKo ese mismo día, de forma definitiva (docs/creem-retiros.md), y la moderación quedó SIN PROVEEDOR
// (`PROVEEDOR_DE_MODERACION = null`, lib/creem-moderacion-reglas.ts). Acá se fija, EJECUTANDO:
//   1. HOY: sin proveedor no se lee ninguna clave, no se llama a nadie, se genera, y no queda ni una fila de uso ni un
//      ticket; y el proveedor de hoy no es Creem;
//   2. el MOTOR (`moderarConDeps`), con cualquier proveedor: qué frena (deny, flag) y qué no (allow, y el proveedor caído:
//      lo pedido); que no se paga dos veces el mismo prompt; que una respuesta que no se entiende NO es un «allow»; que la
//      medición no lleva el prompt (es de un cliente); que sin clave se genera en silencio. Con el adaptador de Creem (el
//      molde, `CREEM`) y con uno de mentira de otra forma, para ver que enchufar otro no toca el motor;
//   3. la cola REAL (`encolar`, lib/flow-cola.ts) y el `moderarPrompt` real en tests/_creem-moderacion-hijo.ts.
//
// PROBADO ROMPIÉNDOLO (5/11/2026, con el rechazo de Creem), con el archivo en verde (10 / 0), una rotura por vez y
// restaurada (pasan / fallan):
//   · `PROVEEDOR_DE_MODERACION = CREEM`                                                       → 8 / 2
//   · `moderarConDeps` sin la salida de `sin_proveedor` (lee la clave sin proveedor)          → 9 / 1
//   · `moderarPrompt` vuelve a registrar el error cuando falta la clave                       → 9 / 1
//   · `moderarPrompt` anota uso aunque falte la clave                                         → 9 / 1
//   · `flag` deja pasar (`r.decision !== 'deny'` en vez de `=== 'allow'`)                    → 9 / 1
//   · una respuesta sin `decision` tomada como allow (el `leer` de CREEM devuelve allow)      → 9 / 1
//   · el recuerdo sin el ws en la clave                                                       → 9 / 1
//   · la clave del NEGOCIO en vez de la de la plataforma (`credDelCliente(credencial, 13)`)   → 9 / 1
// Correr: node --import tsx --test tests/creem-moderacion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  CREEM, CREEM_MODERACION, CREEM_MODERACION_PRUEBA, PROVEEDOR_DE_MODERACION, SI_NO_CONTESTA, TEXTO_RECHAZO, externalId,
  leerRespuesta, moderarConDeps, motivoDeMedicion, urlDeModeracion, type DepsModeracion, type ProveedorModeracion,
} from '../lib/creem-moderacion-reglas';

const RAIZ = join(__dirname, '..');

type Pedido = { url: string; clave: string; cuerpo: Record<string, unknown> };

function deps(o: { clave?: string | null; status?: number; body?: unknown; tira?: Error; claveTira?: boolean; proveedor?: ProveedorModeracion | null } = {}) {
  const pedidos: Pedido[] = [];
  const credenciales: string[] = [];
  let reloj = 1_000_000;
  const d: DepsModeracion = {
    proveedor: o.proveedor === undefined ? CREEM : o.proveedor,
    clave: async (credencial) => {
      credenciales.push(credencial);
      if (o.claveTira) throw new Error('base caída');
      return o.clave === undefined ? 'creem_clave_real' : o.clave;
    },
    fetch: (async (url: string, init: RequestInit) => {
      const h = new Headers(init.headers);
      pedidos.push({ url: String(url), clave: h.get('x-api-key') ?? h.get('authorization') ?? '', cuerpo: JSON.parse(String(init.body)) });
      if (o.tira) throw o.tira;
      return new Response(JSON.stringify(o.body ?? {}), { status: o.status ?? 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch,
    ahora: () => (reloj += 7),
    recuerdo: new Map(),
    huella: (s) => `h:${s}`,
  };
  return { d, pedidos, credenciales };
}

const respuesta = (decision: string, units = 1) => ({ id: `mod_${decision}`, object: 'moderation', prompt: 'p', decision, usage: { units } });
const CTX = { ws: 13, origen: 'generar_clip', azar: 'abc-123' };

test('HOY no hay proveedor: no se lee la clave, no se llama a nadie y se genera; y el proveedor no es Creem', async () => {
  assert.equal(PROVEEDOR_DE_MODERACION, null, 'desde el 5/11/2026 no modera nadie: si se enchufa otro, este test se actualiza con él');
  assert.notEqual((PROVEEDOR_DE_MODERACION as ProveedorModeracion | null)?.nombre, 'creem', 'Creem cerró la cuenta de MaKo y no la reabre (§20.6)');
  const { d, pedidos, credenciales } = deps({ proveedor: null, claveTira: true, body: respuesta('deny') });
  const v = await moderarConDeps('algo que un moderador negaría', CTX, d);
  assert.deepEqual(v, { paso: true, por: 'sin_proveedor' });
  assert.equal(credenciales.length, 0, 'sin proveedor no se lee ninguna clave (ni la que quedó guardada)');
  assert.equal(pedidos.length, 0, 'sin proveedor no sale ningún pedido');
  assert.equal(d.recuerdo.size, 0);
  assert.doesNotMatch(motivoDeMedicion(v, CTX), /algo que un moderador/);
});

test('allow (con el molde de Creem): manda el prompt entero, con la clave en x-api-key y un external_id sin datos de la persona', async () => {
  const { d, pedidos, credenciales } = deps({ body: respuesta('allow', 2) });
  const prompt = '  Una toma de una persona hablando a cámara en una oficina luminosa, plano medio.  ';
  const v = await moderarConDeps(prompt, CTX, d);
  assert.equal(v.paso, true);
  assert.ok(v.por === 'proveedor' && v.proveedor === 'creem' && v.decision === 'allow' && v.unidades === 2);
  assert.deepEqual(credenciales, ['CREEM_API_KEY'], 'la credencial la dice el proveedor');
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, CREEM_MODERACION);
  assert.equal(pedidos[0].clave, 'creem_clave_real');
  assert.equal(pedidos[0].cuerpo.prompt, prompt.trim(), 'el prompt FINAL, entero: moderar un recorte es moderar otra cosa');
  assert.equal(pedidos[0].cuerpo.external_id, 'mako_ws13:generar_clip:abc-123');
  assert.doesNotMatch(String(pedidos[0].cuerpo.external_id), /@/);
});

test('otro proveedor se enchufa sin tocar el motor: su URL, su credencial, su forma de pedir y de contestar', async () => {
  const OTRO: ProveedorModeracion = {
    nombre: 'otro',
    credencial: 'OTRO_MODERACION_KEY',
    pedido: ({ texto, clave }) => ({
      url: 'https://moderacion.otro.test/v2/check',
      init: { method: 'POST', headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' }, body: JSON.stringify({ input: texto }) },
    }),
    leer: (j) => {
      const o = j as { resultado?: string; ref?: string } | null;
      if (!o || (o.resultado !== 'ok' && o.resultado !== 'bloqueado')) return null;
      return { id: o.ref ?? '', decision: o.resultado === 'ok' ? 'allow' : 'deny', unidades: 1 };
    },
  };
  const bien = deps({ proveedor: OTRO, clave: 'k-otro', body: { resultado: 'ok', ref: 'r1' } });
  const v1 = await moderarConDeps('un pedido', CTX, bien.d);
  assert.ok(v1.paso && v1.por === 'proveedor' && v1.proveedor === 'otro');
  assert.deepEqual(bien.credenciales, ['OTRO_MODERACION_KEY']);
  assert.equal(bien.pedidos[0].url, 'https://moderacion.otro.test/v2/check');
  assert.equal(bien.pedidos[0].clave, 'Bearer k-otro');
  assert.deepEqual(bien.pedidos[0].cuerpo, { input: 'un pedido' });
  const mal = deps({ proveedor: OTRO, clave: 'k-otro', body: { resultado: 'bloqueado' } });
  const v2 = await moderarConDeps('un pedido', CTX, mal.d);
  assert.ok(!v2.paso && 'texto' in v2 && v2.texto === TEXTO_RECHAZO);
  // El recuerdo es POR proveedor: lo que decidió uno no lo contesta otro.
  const r = deps({ proveedor: OTRO, clave: 'k', body: { resultado: 'ok' } });
  await moderarConDeps('mismo', CTX, r.d);
  await moderarConDeps('mismo', CTX, { ...r.d, proveedor: CREEM, fetch: (async () => new Response(JSON.stringify(respuesta('allow')))) as unknown as typeof fetch });
  assert.equal([...r.d.recuerdo.keys()].filter((k) => k.endsWith(':h:mismo')).length, 2);
});

test('deny y flag FRENAN, con el texto que dice qué pasó y qué hacer (sin nombrar a nadie); una clave de prueba de Creem va a su host de prueba', async () => {
  for (const decision of ['deny', 'flag']) {
    const { d, pedidos } = deps({ clave: 'creem_test_abc', body: respuesta(decision) });
    const v = await moderarConDeps('algo que el moderador no deja', CTX, d);
    assert.equal(v.paso, false, decision);
    assert.ok(!v.paso && 'texto' in v && v.texto === TEXTO_RECHAZO, decision);
    assert.equal(pedidos[0].url, CREEM_MODERACION_PRUEBA, 'creem_test_ va a test-api.creem.io');
  }
  assert.match(TEXTO_RECHAZO, /hola-mako\.com\/aup/, 'el rechazo nombra la política de uso');
  assert.match(TEXTO_RECHAZO, /No se gastó nada/);
  assert.doesNotMatch(TEXTO_RECHAZO, /creem/i, 'lo que ve la persona no nombra a un proveedor');
  assert.equal(urlDeModeracion('creem_abc'), CREEM_MODERACION);
});

test('el mismo prompt del mismo negocio no se vuelve a pagar; el de OTRO negocio sí se pregunta', async () => {
  const { d, pedidos } = deps({ body: respuesta('allow') });
  await moderarConDeps('el mismo pedido', CTX, d);
  const v2 = await moderarConDeps('el mismo pedido', CTX, d);
  assert.equal(pedidos.length, 1, 'el reintento no llama de nuevo');
  assert.ok(v2.por === 'proveedor' && v2.recordado === true);
  await moderarConDeps('el mismo pedido', { ...CTX, ws: 14 }, d);
  assert.equal(pedidos.length, 2, 'el recuerdo es por negocio: una caché del server es de todos los inquilinos');
  // Un deny también se recuerda: insistir con lo mismo no paga otra llamada.
  const r = deps({ body: respuesta('deny') });
  await moderarConDeps('lo negado', CTX, r.d);
  const otra = await moderarConDeps('lo negado', CTX, r.d);
  assert.equal(r.pedidos.length, 1);
  assert.equal(otra.paso, false);
});

test(`si el proveedor no contesta (5xx, tiempo, la red), lo pedido: ${SI_NO_CONTESTA === 'generar' ? 'se genera igual' : 'se frena'}, con el motivo`, async () => {
  const casos = [
    deps({ status: 500, body: { message: 'caído', prompt: 'SECRETO-DEL-CLIENTE' } }),
    deps({ status: 429, body: {} }),
    deps({ tira: Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }),
    deps({ tira: new TypeError('fetch failed') }),
  ];
  for (const { d } of casos) {
    const v = await moderarConDeps('un pedido normal', CTX, d);
    assert.equal(v.por, 'no_contesto');
    assert.equal(v.paso, SI_NO_CONTESTA === 'generar');
    const m = motivoDeMedicion(v, CTX);
    assert.doesNotMatch(m, /SECRETO-DEL-CLIENTE|un pedido normal/, 'ni el prompt ni el cuerpo del error van a la medición');
  }
  // Y lo del proveedor caído NO se recuerda: el próximo intento vuelve a preguntar.
  const { d, pedidos } = deps({ status: 503 });
  await moderarConDeps('x', CTX, d);
  await moderarConDeps('x', CTX, d);
  assert.equal(pedidos.length, 2);
});

test('una respuesta que no se entiende NO es un «allow»: es el proveedor que no contestó bien, y no se recuerda', async () => {
  for (const body of [{}, { decision: 'maybe' }, { decision: 'ALLOW' }, null, ['allow']]) {
    const { d, pedidos } = deps({ body });
    const v = await moderarConDeps('y', CTX, d);
    assert.equal(v.por, 'no_contesto', JSON.stringify(body));
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

test('ejecutando la cola y el moderador REALES (tests/_creem-moderacion-hijo.ts): hoy se genera sin llamar a nadie; con un moderador, la clave de la plataforma y la medición', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_creem-moderacion-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida);
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  // ── HOY (sin proveedor): todo se encola, aunque haya una clave de Creem vieja guardada, y no llama ni deja nada. ──
  assert.equal(r.hoy.imagen, 'number', 'una imagen se encola (el hijo manda el tipo del id)');
  assert.equal(r.hoy.clip, 'number', 'un video se encola');
  assert.equal(r.hoy.trabajos, 2);
  assert.equal(r.hoy.llamadas, 0, 'sin proveedor no sale ningún pedido a Creem');
  assert.equal(r.hoy.usos, 0, 'ni una fila de uso');
  assert.equal(r.hoy.errores, 0, 'ni un error de la app');
  assert.equal(r.hoy.tickets, 0, 'ni un ticket');
  // lo que no genera no pasa por la moderación; lo que genera sin prompt no se encola.
  assert.equal(r.creditos.llamadas, 0);
  assert.equal(r.sinPrompt.r, null);
  assert.equal(r.sinPrompt.nuevos, 0);
  // ── Con un moderador enchufado y SIN su clave: se genera en silencio (sin llamada, sin uso, sin error, sin ticket). ──
  assert.equal(r.sinClave.v.paso, true);
  assert.equal(r.sinClave.v.por, 'sin_clave');
  assert.deepEqual([r.sinClave.llamadas, r.sinClave.usos, r.sinClave.errores, r.sinClave.tickets], [0, 0, 0, 0], 'una clave que falta no frena ni abre un ticket');
  // ── Con un moderador y su clave: frena lo que niega, deja lo que permite, recuerda, y mide a nombre de la plataforma. ──
  assert.equal(r.conClave.deny.paso, false);
  assert.equal(r.conClave.allow.paso, true);
  assert.equal(r.conClave.recordado.llamadas, 0);
  assert.equal(r.conClave.caido.paso, SI_NO_CONTESTA === 'generar');
  assert.deepEqual(r.claves, ['plataforma'], 'quien vende MaKo es MaKo: modera con su clave, no con la del negocio');
  assert.equal(r.usos.length, 3, 'una fila por llamada (deny, allow, caído)');
  for (const u of r.usos) {
    assert.equal(u.ws, 9, 'el gasto es de MaKo, no del negocio que generó');
    assert.equal(u.provider, 'creem');
    assert.equal(u.feature, 'moderacion-prompts');
    assert.match(u.motivo, /^ws 13 · generar_imagen · creem · /);
    assert.doesNotMatch(u.motivo, /auto rojo|casa en la playa|lo que se niega/, 'el prompt es de un cliente: no va a la medición');
  }
  // ── Una clave RECHAZADA sí es nuestra: queda como error de la app. ──
  assert.equal(r.rechazada.v.por, 'clave_rechazada');
  assert.equal(r.rechazada.v.paso, true);
  assert.ok(r.rechazada.errores >= 1, 'una clave rechazada se registra para arreglarla');
});
