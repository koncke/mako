// La lectura de una cuenta, en su parte pura (lib/media-buyer/senales.ts) y las variaciones (variaciones-prompt.ts).
// Lo que fija: el CRM se cuenta por COHORTE (el lead que entró en la ventana), las ventanas terminan AYER, el árbol de
// Zernio sin interruptor propio se lee como «apagado» si no entrega, y una variación con voseo o repetida no se ofrece.
// Verificado rompiéndolo (25/10/2026): contando los leads sin mirar cuándo entraron, 1 fallo y 7 pases; sin el filtro de
// voseo, 1 fallo y 7 pases. Restaurado, 8 de 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { senalesDeVentana, ventanas, arbolDesdeZernio, conInterruptorEnVivo, type FilaMetrica, type FilaLeadAd } from '../lib/media-buyer/senales';
import { parsearVariaciones, promptVariaciones } from '../lib/media-buyer/variaciones-prompt';

const met = (fecha: string, ad: string, spend: number, x: Partial<FilaMetrica> = {}): FilaMetrica => ({
  fecha, ad_id: ad, spend, leads_count: 0, agendas_meta: 0, impressions: 100, frequency: 1.5, video_3s_views: 0, ...x,
});
const lead = (ad: string, entro: string, x: Partial<FilaLeadAd> = {}): FilaLeadAd => ({
  meta_ad_id: ad, created_at: `${entro}T15:00:00Z`, fecha_junta_1: null, estado_lead: 'nuevo', total_cobrado_usd: null, ...x,
});

test('las ventanas terminan AYER (el día de hoy no está cerrado)', () => {
  assert.deepEqual(ventanas('2026-10-25'), { corta: ['2026-10-22', '2026-10-24'], larga: ['2026-10-18', '2026-10-24'], crm: ['2026-10-11', '2026-10-24'] });
});

test('el CRM se cuenta por cohorte: el lead que entró ANTES de la ventana no suma, aunque haya comprado', () => {
  const s = senalesDeVentana(
    [met('2026-10-22', 'a1', 10), met('2026-10-23', 'a1', 10)],
    [lead('a1', '2026-10-01', { estado_lead: 'ganado', total_cobrado_usd: 900, fecha_junta_1: '2026-10-03' }), lead('a1', '2026-10-23', { fecha_junta_1: '2026-10-24' })],
    '2026-10-22', '2026-10-24', (m) => m,
  );
  const a1 = s.find((x) => x.adId === 'a1')!;
  assert.equal(a1.gasto, 20);
  assert.equal(a1.leadsCrm, 1);
  assert.equal(a1.agendasCrm, 1);
  assert.equal(a1.cierres, 0, 'la venta es de un lead de otra ventana');
  assert.equal(a1.caja, 0);
  assert.equal(a1.diasCorriendo, 2);
});

test('el gasto se pasa a la unidad de decidir con el conversor de la cuenta', () => {
  const s = senalesDeVentana([met('2026-10-22', 'a1', 173)], [], '2026-10-22', '2026-10-24', (m) => m / 17.3);
  assert.equal(s[0].gasto, 10);
});

test('un anuncio con vistas de 3 segundos es un video', () => {
  const s = senalesDeVentana([met('2026-10-22', 'a1', 5, { video_3s_views: 40 }), met('2026-10-22', 'a2', 5)], [], '2026-10-22', '2026-10-24', (m) => m);
  assert.equal(s.find((x) => x.adId === 'a1')?.esVideo, true);
  assert.equal(s.find((x) => x.adId === 'a2')?.esVideo, false);
});

test('Zernio: sin interruptor propio, lo que no entrega se toma como apagado; el presupuesto va donde dice budgetLevel', () => {
  const { arbol } = arbolDesdeZernio([{
    platformCampaignId: '1', campaignName: 'C', platformCampaignStatus: 'ACTIVE', budgetLevel: 'adset',
    adSets: [
      { platformAdSetId: '11', adSetName: 'S1', status: 'active', adSetBudget: { amount: 50, type: 'daily' }, ads: [{ platformAdId: '111', name: 'A', status: 'active', configuredStatus: 'ACTIVE' }] },
      { platformAdSetId: '12', adSetName: 'S2', status: 'paused', adSetBudget: { amount: 30, type: 'daily' }, ads: [] },
    ],
  }]);
  assert.equal(arbol.find((n) => n.id === '11')?.presupuestoDia, 50);
  assert.equal(arbol.find((n) => n.id === '11')?.configurado, 'ACTIVE');
  assert.equal(arbol.find((n) => n.id === '12')?.configurado, 'PAUSED');
  assert.equal(arbol.find((n) => n.id === '1')?.presupuestoDia, null, 'en ABO la campaña no tiene presupuesto');
});

test('las variaciones: se leen aunque vengan entre ```json, y se descartan las repetidas, las cortas y las que vosean', () => {
  const crudo = '```json\n' + JSON.stringify({ variaciones: [
    { gancho: '¿Cansado de perder clientes?', textoPrincipal: 'Si pierdes clientes cada semana, este sistema te ayuda a recuperarlos sin contratar a nadie.', titulo: 'Recupera clientes' },
    { gancho: 'Mira esto', textoPrincipal: 'Si pierdes clientes cada semana, este sistema te ayuda a recuperarlos sin contratar a nadie.' },
    { gancho: 'Corto', textoPrincipal: 'Muy corto.' },
    { gancho: 'Ojo', textoPrincipal: 'Si vos tenés un negocio y querés vender más, mirá este sistema que te ayuda todos los días.' },
    { gancho: 'Lo que nadie te dice', textoPrincipal: 'El 80% de los negocios pierde ventas por no responder a tiempo. MaKo responde en segundos.' },
  ] }) + '\n```';
  const v = parsearVariaciones(crudo, { textoPrincipal: 'Original del anuncio que gana, distinto a todo lo demás.' }, '123');
  assert.equal(v.length, 2);
  assert.ok(v.every((x) => x.elegida));
  assert.deepEqual(v.map((x) => x.id), ['123-1', '123-2']);
});

test('una respuesta que no es JSON no inventa variaciones', () => {
  assert.deepEqual(parsearVariaciones('No puedo ayudarte con eso.', { textoPrincipal: null }, '1'), []);
});

test('el pedido de variaciones le prohíbe el voseo al modelo y le pasa por qué gana el anuncio', () => {
  const { system, user } = promptVariaciones({ tipo: 'hook', textoPrincipal: 'Texto', titulo: null, transcripcion: 'Hola, soy…', porQueGana: '8 leads a US$ 5', perfilNegocio: '' });
  assert.match(system, /NUNCA voseo/);
  assert.match(system, /primeros 3 segundos/);
  assert.match(user, /8 leads a US\$ 5/);
  assert.match(user, /Hola, soy/);
});

test('el interruptor EN VIVO de Zernio reemplaza a la entrega: un conjunto prendido que no entrega sigue prendido', () => {
  const { arbol } = arbolDesdeZernio([{
    platformCampaignId: 'c1', campaignName: 'C', platformCampaignStatus: 'ACTIVE', budgetLevel: 'adset',
    adSets: [{ platformAdSetId: 's1', adSetName: 'S', status: 'paused', adSetBudget: { type: 'daily', amount: 20 }, ads: [{ platformAdId: 'a1', status: 'paused' }] }],
  } as never]);
  assert.equal(arbol.find((n) => n.id === 's1')?.configurado, 'PAUSED', 'sin lo en vivo, la entrega manda');
  const vivo = conInterruptorEnVivo(arbol, {
    campanas: [{ id: 'c1', configurado: 'PAUSED', presupuestoDia: null }],
    conjuntos: [{ id: 's1', configurado: 'ACTIVE', presupuestoDia: 35 }],
  });
  assert.equal(vivo.find((n) => n.id === 's1')?.configurado, 'ACTIVE');
  assert.equal(vivo.find((n) => n.id === 's1')?.presupuestoDia, 35, 'el presupuesto de hoy');
  assert.equal(vivo.find((n) => n.id === 'c1')?.configurado, 'PAUSED', 'la campaña apagada a mano, aunque entregue');
  assert.equal(vivo.find((n) => n.id === 'a1')?.configurado, arbol.find((n) => n.id === 'a1')?.configurado, 'los anuncios no se tocan');
});

test('lo que sólo trae la lectura en vivo (una campaña sin anuncios) se SUMA al árbol, con su presupuesto: el Media Buyer la puede operar', () => {
  // Medido el 25/10/2026: el árbol de Zernio sale de los anuncios, y una campaña vacía no estaba; `lanzar` no la encontraba.
  const vivo = conInterruptorEnVivo([], {
    campanas: [{ id: 'c9', nombre: 'Vacía', configurado: 'PAUSED', presupuestoDia: 1 }],
    conjuntos: [{ id: 's9', nombre: 'Conjunto suelto', campanaId: 'c9', configurado: 'ACTIVE', presupuestoDia: null }],
  });
  const c = vivo.find((n) => n.id === 'c9');
  assert.equal(c?.nivel, 'campaign');
  assert.equal(c?.presupuestoDia, 1);
  assert.equal(c?.nivelPresupuesto, 'campaign', 'con presupuesto propio es CBO');
  assert.equal(vivo.find((n) => n.id === 's9')?.parentId, 'c9');
  assert.equal(vivo.find((n) => n.id === 's9')?.nivelPresupuesto, 'campaign', 'el conjunto hereda el nivel de su campaña');
});

test('lanzar y deshacer releen EN VIVO el interruptor de un anuncio antes de decidir (el árbol de Zernio tiene hasta una hora de atraso)', () => {
  // Medido el 25/10/2026 en la cuenta de MaKo: recién pausado por el Media Buyer, «prender» se frenó con «Ya estaba prendido en
  // Meta» porque el árbol de Zernio todavía decía prendido. Zernio: «Controllers that act on a switch should pass live=true».
  const raiz = join(import.meta.dirname, '..');
  const ej = readFileSync(join(raiz, 'lib', 'media-buyer', 'ejecutar.ts'), 'utf8');
  const lecturas = ej.match(/const actual = estadoVivo\(nodo\);/g) ?? [];
  assert.equal(lecturas.length, 2, 'lanzar y deshacer leen el estado actual una vez cada uno');
  assert.equal((ej.match(/await conAnuncioEnVivo\(ws, datos, nodo\);\s*const actual = estadoVivo\(nodo\);/g) ?? []).length, 2, 'las dos, con el anuncio releído antes');
  const z = readFileSync(join(raiz, 'lib', 'zernio-ads.ts'), 'utf8');
  assert.match(z, /\/ads\/\$\{encodeURIComponent\(adId\)\}\?live=true/, 'la lectura del anuncio pide live=true');
});

test('lo BORRADO que Zernio deja en el árbol no cuenta como prendido ni como pausado (un anuncio borrado trae configuredStatus ACTIVE)', () => {
  // Medido por el chat «Zernio y CAPI» (25/10/2026): los dos anuncios que la prueba borró salen con status cancelled y configuredStatus ACTIVE.
  const { arbol } = arbolDesdeZernio([{
    platformCampaignId: 'c1', campaignName: 'C', platformCampaignStatus: 'ACTIVE', budgetLevel: 'adset',
    adSets: [{ platformAdSetId: 's1', adSetName: 'S', status: 'active', ads: [
      { platformAdId: 'a1', name: 'vivo', status: 'active', configuredStatus: 'ACTIVE' },
      { platformAdId: 'a2', name: 'borrado', status: 'cancelled', configuredStatus: 'ACTIVE' },
      { platformAdId: 'a3', name: 'pausado', status: 'paused', configuredStatus: 'PAUSED' },
    ] }, { platformAdSetId: 's2', adSetName: 'S2', status: 'cancelled', ads: [] }],
  }, { platformCampaignId: 'c2', campaignName: 'C2', platformCampaignStatus: 'DELETED', adSets: [] }] as never);
  const de = (id: string) => arbol.find((n) => n.id === id)?.configurado;
  assert.equal(de('a1'), 'ACTIVE');
  assert.equal(de('a2'), 'DELETED', 'un anuncio borrado NO está prendido');
  assert.equal(de('a3'), 'PAUSED');
  assert.equal(de('s2'), 'DELETED', 'un conjunto borrado tampoco está «pausado» (Revive lo querría prender)');
  assert.equal(de('c2'), 'DELETED');
  assert.ok(arbol.some((n) => n.id === 'a2'), 'sigue en el árbol: su gasto de antes suma en su conjunto');
  // Y la lectura en vivo de un anuncio no lo revive: ejecutar.ts mira `status` y la entrega antes que el interruptor.
  const ej = readFileSync(join(import.meta.dirname, '..', 'lib', 'media-buyer', 'ejecutar.ts'), 'utf8');
  assert.match(ej, /if \(v && estaBorrado\(v\.estado, v\.entrega\)\) nodo\.configurado = BORRADO;/);
});
