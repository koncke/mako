// =============================================================================
// El retargeting de los funnels sin VSL: las reglas y los pedidos a Meta (13/11/2026)
// =============================================================================
// Lo que decide el CÓDIGO sin gastar IA, lo que se acepta de la IA, la diferencia de un público y la forma EXACTA de cada pedido
// a Meta, por Zernio y por el token. El motor entero, en tests/retargeting-motor.test.ts.
//
// Correr: node --import tsx --test tests/retargeting-reglas.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  difDelPublico, emailParaMeta, leerVeredictos, loteParaLaIA, personaDe, segmentoPorCodigo, telefonoParaMeta,
  type ChatRT, type LeadRT,
} from '../lib/retargeting-reglas';
import { crearPorToken, crearPorZernio, idsDeZernio, personasPorToken, personasPorZernio } from '../lib/retargeting-meta-pedidos';

const AHORA = new Date('2026-11-16T11:00:00Z');
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
const lead = (x: Partial<LeadRT> = {}): LeadRT => ({ id: 1, nombre: 'Ana', telefono: '5491122334455', email: null, cerro: null, etapa: 'lead', cobrado: null, agenda: null, enVsl: false, ...x });
let n = 0;
const chat = (...ms: Array<[quien: 'N' | 'L', dias: number, texto?: string]>): ChatRT => ({ leadId: 1, mensajes: ms.map(([q, d, t]) => ({ id: ++n, deNegocio: q === 'N', at: hace(d), texto: t ?? 'hola' })) });

test('el código decide sin la IA: compró, la etapa, la agenda, la charla viva y el que no contestó', () => {
  const quieta = chat(['L', 9], ['N', 9], ['L', 8], ['N', 8]);
  assert.equal(segmentoPorCodigo(lead({ cerro: true }), null, AHORA), 'compro', 'quien compró entra aunque no tenga charla');
  assert.equal(segmentoPorCodigo(lead({ cobrado: 300 }), quieta, AHORA), 'compro');
  assert.equal(segmentoPorCodigo(lead({ etapa: 'ganado' }), quieta, AHORA), 'compro');
  assert.equal(segmentoPorCodigo(lead({ enVsl: true }), quieta, AHORA), null, 'un funnel con VSL no entra: lo suyo es el píxel');
  assert.equal(segmentoPorCodigo(lead(), null, AHORA), null, 'sin charla no hay qué revisar');
  assert.equal(segmentoPorCodigo(lead({ etapa: 'descal' }), quieta, AHORA), 'no_califica', 'lo que dijo una persona con la etapa manda');
  assert.equal(segmentoPorCodigo(lead({ etapa: 'perdido' }), quieta, AHORA), 'no_compro');
  assert.equal(segmentoPorCodigo(lead({ agenda: hace(-2) }), quieta, AHORA), 'agendo');
  assert.equal(segmentoPorCodigo(lead({ agenda: hace(10) }), quieta, AHORA), 'dudoso', 'una reunión que ya pasó no frena');
  assert.equal(segmentoPorCodigo(lead(), chat(['L', 9], ['N', 1]), AHORA), 'sigue', 'con mensajes de los últimos 3 días, sigue viva');
  assert.equal(segmentoPorCodigo(lead(), chat(['L', 9], ['L', 8]), AHORA), 'sigue', 'si el negocio nunca contestó no se le cobra al lead');
  assert.equal(segmentoPorCodigo(lead(), chat(['L', 9, 'Hola, quiero info'], ['N', 9], ['N', 6]), AHORA), 'no_respondio', 'el mensaje del anuncio solo no es contestar');
  assert.equal(segmentoPorCodigo(lead(), quieta, AHORA), 'dudoso', 'contestó y quedó quieta: la lee la IA');
});

test('lo que contesta la IA: sólo los ids pedidos y un veredicto válido; lo demás queda sin revisar', () => {
  const r = leerVeredictos('```json\n{"r":[{"id":3,"v":"no_compro","por":"le pasaron el precio y no volvió"},{"id":4,"v":"inventado"},{"id":99,"v":"no_siguio"},{"id":3,"v":"sigue"}]}\n```', [3, 4]);
  assert.deepEqual([...r], [[3, { v: 'no_compro', por: 'le pasaron el precio y no volvió' }]]);
  assert.equal(leerVeredictos('no sé', [1]).size, 0, 'un texto que no es JSON no rompe');
  // El lote: cada charla con su id, los últimos mensajes y cortos.
  const largo = 'x'.repeat(500);
  const lote = loteParaLaIA([{ leadId: 7, mensajes: [{ id: 1, deNegocio: false, at: hace(5), texto: largo }, { id: 2, deNegocio: true, at: hace(5), texto: '' }] }]);
  assert.match(lote, /^### id 7\nL: x{220}…\nN: \(un archivo\)$/);
});

test('el teléfono y el email como los compara Meta, y una persona sin ninguno no entra', () => {
  assert.equal(telefonoParaMeta('+54 9 11 2233-4455'), '5491122334455', 'sin «+»: con él el hash no coincide con nadie');
  assert.equal(telefonoParaMeta('011 2233'), null);
  assert.equal(emailParaMeta('  Ana@Fiesta.COM '), 'ana@fiesta.com');
  assert.equal(personaDe({ telefono: null, email: 'mal' }), null);
  assert.deepEqual(personaDe({ telefono: '5491122334455', email: 'a@b.co' }), { phone: '5491122334455', email: 'a@b.co' });
});

test('la diferencia de un público: sale lo que ya no va, entra lo nuevo, y un teléfono que cambió sale y entra', () => {
  const antes = { 1: { phone: '111111111' }, 2: { phone: '222222222' }, 3: { phone: '333333333' } };
  const deseado = new Map([[2, { phone: '222222222' }], [3, { phone: '399999999' }], [4, { phone: '444444444' }]]);
  const d = difDelPublico(antes, deseado);
  assert.deepEqual(d.sacar, [{ phone: '111111111' }, { phone: '333333333' }]);
  assert.deepEqual(d.agregar, [{ phone: '399999999' }, { phone: '444444444' }]);
  assert.deepEqual(Object.keys(d.quedan), ['2', '3', '4']);
});

test('los pedidos por Zernio: lista de clientes, y las personas por el id de ZERNIO (sólo la ruta: lo manda el canal)', () => {
  const crear = crearPorZernio({ accountId: 'acc_9', adAccountId: 'act_564003520636790' }, 'noAvanzaron');
  assert.equal(crear.ruta, '/ads/audiences');
  assert.equal(crear.init.method, 'POST');
  assert.deepEqual(JSON.parse(crear.init.body), {
    accountId: 'acc_9', adAccountId: 'act_564003520636790', name: 'MaKo · No avanzaron',
    description: 'Leads que no respondieron, no siguieron o no compraron. Lo actualiza MaKo cada lunes.', type: 'customer_list', customerFileSource: 'USER_PROVIDED_ONLY',
  });
  const quitar = personasPorZernio('z_77', [{ phone: '5491122334455' }], true);
  assert.equal(quitar.ruta, '/ads/audiences/z_77/users');
  assert.equal(quitar.init.method, 'DELETE');
  assert.deepEqual(JSON.parse(quitar.init.body), { users: [{ phone: '5491122334455' }] }, 'Zernio hace el hash: va en claro');
  assert.deepEqual(idsDeZernio({ audience: { _id: 'z_77', platformAudienceId: '120200000001' } }), { zernioId: 'z_77', metaId: '120200000001' });
  assert.deepEqual(idsDeZernio({ audience: { id: 'z_78' } }), { zernioId: 'z_78', metaId: null });
});

test('los pedidos por el token: CUSTOM con el origen de la lista, y las personas en SHA-256', () => {
  process.env.META_API_VERSION = 'v25.0';
  const c = { token: 'EAAtoken', adAccountId: 'act_1' };
  const crear = crearPorToken(c, 'compraron');
  assert.equal(crear.url, 'https://graph.facebook.com/v25.0/act_1/customaudiences');
  const f = new URLSearchParams(crear.init.body);
  assert.equal(f.get('subtype'), 'CUSTOM');
  assert.equal(f.get('customer_file_source'), 'USER_PROVIDED_ONLY');
  assert.equal(f.get('name'), 'MaKo · Compraron');
  assert.equal(f.get('access_token'), 'EAAtoken');
  const sumar = personasPorToken(c, '6000', [{ phone: '5491122334455', email: 'ana@fiesta.com' }, { email: 'b@c.co' }], false);
  assert.equal(sumar.url, 'https://graph.facebook.com/v25.0/6000/users');
  assert.equal(sumar.init.method, 'POST');
  const sha = (x: string) => createHash('sha256').update(x).digest('hex');
  assert.deepEqual(JSON.parse(new URLSearchParams(sumar.init.body).get('payload')!), {
    schema: ['PHONE', 'EMAIL'], data: [[sha('5491122334455'), sha('ana@fiesta.com')], ['', sha('b@c.co')]],
  });
  assert.ok(!sumar.init.body.includes('5491122334455'), 'por el token, el teléfono nunca viaja en claro');
  assert.equal(personasPorToken(c, '6000', [{ email: 'b@c.co' }], true).init.method, 'DELETE');
});
