// =============================================================================
// Las charlas con MaKo de las tabs, en el grafo del Second Brain (23/10/2026, chat «Chats de las tabs»)
// =============================================================================
// Martín, 17/10/2026: «todo siempre guardarse en chats en el Ops Center e ir guardándose en el grafo del Second Brain». El Ops
// Center ya las listaba; el grafo sólo sumaba las de Offer y las de la estrella. Esto fija:
//   · la tab y la entidad salen de la clave, con la MISMA regla que agrupa el Ops Center (origenDeClave);
//   · un nodo por chat JEFE (la tab), nunca uno por charla (Automations tiene cientos: el volumen no es un nodo);
//   · se cuelga de la entidad que esté en el mapa (el funnel de un CRM, el cliente o los leads de una ficha), si no de la raíz;
//   · los chats de la estrella siguen como estaban (sus nodos, su agregado y su tope no los comen los de las tabs);
//   · y el grafo lee las MISMAS fuentes que la lista del Ops Center.
// Probado rompiéndolo (ver al pie de cada test el resultado).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { agregarLoVivo, LECTURAS_VACIAS, TOPES_VIVOS, type ChatMakoVivo, type LecturasVivas } from '../lib/cerebro-vivo';
import { chatsDeTabParaElGrafo } from '../lib/cerebro-chats-tabs';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const n = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: '', autoria: 'mako', ...extra,
});
function base(): { nodos: NodoCerebro[]; aristas: AristaCerebro[] } {
  return {
    nodos: [n('raiz', 'norte', { etiqueta: 'Coaching de ventas' }), n('prod:7', 'productos', { etiqueta: 'Mentoría Premium' }), n('etapa:lead', 'funnel', { etiqueta: 'Lead' })],
    aristas: [],
  };
}
const LECTURAS: LecturasVivas = {
  ...LECTURAS_VACIAS,
  funnels: [{ id: 10, nombre: 'VSL', canal: 'llamadas', esDefault: true }, { id: 11, nombre: 'Renovación', canal: null, esDefault: false }],
  leads: { total: 120, nuevos7d: 9, sinAsignar: 4, porEtapa: [], origenes: [] },
  clientes: { total: 1, recientes: [{ leadId: 77, nombre: 'Ana López', empresa: null, fechaCierre: '2026-10-20', sinCobro: false }] },
};
function armar(chatsMako: ChatMakoVivo[]) {
  const g = base();
  agregarLoVivo(g, { ...LECTURAS, chatsMako }, { raiz: 'raiz', primeraEtapa: 'etapa:lead', etapasEnMapa: new Set(['etapa:lead']) });
  return { ...g, porId: new Map(g.nodos.map((x) => [x.id, x])) };
}
const de = (aristas: AristaCerebro[], id: string) => aristas.filter((a) => a.de === id).map((a) => a.a).sort();

test('la tab y la entidad salen de la clave, con la regla del Ops Center', () => {
  const r = chatsDeTabParaElGrafo({
    antes: [
      { id: 1, titulo: 'Bajar el CAC', clave: 'dashboard:gmvjxtei82ve3', updatedAt: '2026-10-22T10:00:00Z' },
      { id: 2, titulo: 'La portada', clave: 'landing:31', updatedAt: '2026-10-22T11:00:00Z' },
      { id: 3, titulo: 'De antes', clave: 'mako-general', updatedAt: '2026-10-14T10:00:00Z' },
      { id: 4, titulo: 'Sin origen', clave: 'algo-raro:1', updatedAt: '2026-10-14T10:00:00Z' },
      { id: 5, titulo: 'De un closer', clave: 'persona:ana@x.com:dashboard:abc', updatedAt: '2026-10-21T10:00:00Z' },
      // Los del CRM y la ficha llegan de chatsDeLasTabs, con la clave relativa y el origen ya dicho.
      { id: 6, titulo: 'Quién no contestó', clave: 'crm:10', updatedAt: '2026-10-22T12:00:00Z', origen: 'CRM' },
      { id: 7, titulo: 'Cómo la cierro', clave: 'lead:77', updatedAt: '2026-10-22T13:00:00Z', origen: 'Ficha · Ana López' },
      { id: 6, titulo: 'Repetida', clave: 'crm:10', updatedAt: '2026-10-22T12:00:00Z', origen: 'CRM' },
    ],
    automations: [{ id: 213, titulo: 'Sprint · apertura', updatedAt: '2026-10-22T09:00:00Z' }],
    editores: [{ tipo: 'imagen', clave: 'u1|d9', titulo: 'Anuncio octubre', updatedAt: '2026-10-21T09:00:00Z' }],
  });
  const t = Object.fromEntries(r.map((c) => [String(c.id), { tab: c.tab, entidad: c.entidad }]));
  assert.deepEqual(t['antes:1'], { tab: 'Dashboard', entidad: null });
  assert.deepEqual(t['antes:2'], { tab: 'Web Generator', entidad: null });
  assert.ok(!t['antes:3'], '«Pregúntale a MaKo» (el /mako de antes) no es una tab');
  assert.ok(!t['antes:4'], 'lo que no tiene origen conocido no entra');
  assert.deepEqual(t['antes:5'], { tab: 'Dashboard', entidad: null }, 'la de un closer, con su persona adelante');
  assert.deepEqual(t['antes:6'], { tab: 'CRM', entidad: { tipo: 'funnel', id: 10 } });
  assert.deepEqual(t['antes:7'], { tab: 'Ficha', entidad: { tipo: 'lead', id: 77 } }, 'el nombre del lead es de la charla, no del grupo');
  assert.equal(r.filter((c) => c.id === 'antes:6').length, 1, 'una sesión no entra dos veces');
  assert.deepEqual(t['automations:213'], { tab: 'Automations', entidad: null });
  assert.deepEqual(t['imagen:u1|d9'], { tab: 'Image Editor', entidad: null });
  // Rompiéndolo: sin el `startsWith('Ficha')`, la tab salía «Ficha · Ana López» → 1 fallo.
});

test('un nodo por chat JEFE (la tab), nunca uno por charla, colgado de su entidad', () => {
  const automations = Array.from({ length: 30 }, (_, i): ChatMakoVivo => ({ id: `automations:${i}`, titulo: `Flujo ${i}`, updatedAt: `2026-10-${String(10 + (i % 12)).padStart(2, '0')}T10:00:00Z`, tab: 'Automations', entidad: null }));
  const { nodos, aristas, porId } = armar([
    ...automations,
    { id: 'antes:6', titulo: 'Quién no contestó', updatedAt: '2026-10-22T12:00:00Z', tab: 'CRM', entidad: { tipo: 'funnel', id: 10 } },
    { id: 'antes:8', titulo: 'El de renovación', updatedAt: '2026-10-21T12:00:00Z', tab: 'CRM', entidad: { tipo: 'funnel', id: 11 } },
    { id: 'antes:7', titulo: 'Cómo la cierro', updatedAt: '2026-10-22T13:00:00Z', tab: 'Ficha', entidad: { tipo: 'lead', id: 77 } },
    { id: 'antes:9', titulo: 'Este no compró', updatedAt: '2026-10-20T13:00:00Z', tab: 'Ficha', entidad: { tipo: 'lead', id: 5 } },
    { id: 'antes:2', titulo: 'La portada', updatedAt: '2026-10-22T11:00:00Z', tab: 'Web Generator', entidad: null },
    { id: 'x:1', titulo: 'Algo', updatedAt: '2026-10-22T11:00:00Z', tab: 'Pricing', entidad: null },
  ]);
  const autos = porId.get('tabchat:automations')!;
  assert.ok(autos, 'Automations tiene su nodo');
  assert.equal(nodos.filter((x) => x.id.startsWith('tabchat:')).length, 5, 'uno por tab');
  assert.ok(!nodos.some((x) => /^(chat|tabchat):automations:/.test(x.id)), 'nunca un nodo por charla');
  assert.deepEqual(autos.datos, [{ k: 'Charlas', v: '30' }]);
  assert.equal(autos.etiqueta, 'MaKo en Automations');
  assert.equal(autos.area, 'funnel');
  assert.deepEqual(de(aristas, 'tabchat:automations'), ['raiz'], 'sin entidad en el mapa, de la raíz');
  assert.deepEqual(de(aristas, 'tabchat:crm'), ['funnel:10', 'funnel:11'], 'el CRM, de sus funnels');
  assert.deepEqual(de(aristas, 'tabchat:ficha'), ['cliente:77', 'leads'], 'la ficha: el cliente si compró, si no los leads');
  assert.equal(porId.get('tabchat:web-generator')!.area, 'oferta', 'donde viven las landings');
  assert.equal(porId.get('tabchat:pricing')!.area, 'panorama', 'una tab sin área propia, en el Resumen');
  assert.equal(porId.get('tabchat:crm')!.href, '/second-brain');
  assert.match(porId.get('tabchat:ficha')!.detalle, /^Cómo la cierro · Este no compró$/, 'lo más reciente primero');
  const ids = new Set(nodos.map((x) => x.id));
  for (const a of aristas) assert.ok(ids.has(a.de) && ids.has(a.a), `arista con una punta que no existe: ${a.de} → ${a.a}`);
  // Rompiéndolo: un nodo por charla (el id con el de la charla) → 2 fallos (éste y el del tope); sin el respaldo a la raíz → 1.
});

test('con tope: las tabs más recientes y unas pocas entidades por tab', () => {
  const tabs = Array.from({ length: TOPES_VIVOS.tabsConChat + 3 }, (_, i): ChatMakoVivo => ({ id: `t:${i}`, titulo: `T${i}`, updatedAt: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`, tab: `Tab ${i}`, entidad: null }));
  const { nodos, porId } = armar(tabs);
  assert.equal(nodos.filter((x) => x.id.startsWith('tabchat:')).length, TOPES_VIVOS.tabsConChat);
  assert.ok(porId.has(`tabchat:tab-${TOPES_VIVOS.tabsConChat + 2}`) && !porId.has('tabchat:tab-0'), 'se quedan las más recientes');
  // Un CRM con charlas sobre muchos funnels: no más de `entidadesPorTab` aristas.
  const funnels = Array.from({ length: 9 }, (_, i) => ({ id: 20 + i, nombre: `F${i}`, canal: null, esDefault: false }));
  const g = base();
  agregarLoVivo(g, { ...LECTURAS, funnels: [...LECTURAS.funnels, ...funnels], chatsMako: funnels.map((f): ChatMakoVivo => ({ id: `c:${f.id}`, titulo: f.nombre, updatedAt: '2026-10-22T10:00:00Z', tab: 'CRM', entidad: { tipo: 'funnel', id: f.id } })) }, { raiz: 'raiz', primeraEtapa: null, etapasEnMapa: new Set() });
  assert.equal(g.aristas.filter((a) => a.de === 'tabchat:crm').length, TOPES_VIVOS.entidadesPorTab);
});

test('los chats de la estrella siguen como estaban: los de las tabs no les comen el lugar ni el agregado', () => {
  const muchasDeTab = Array.from({ length: TOPES_VIVOS.chatsMako + 4 }, (_, i): ChatMakoVivo => ({ id: `automations:${i}`, titulo: 'Mentoría Premium', updatedAt: '2026-10-22T10:00:00Z', tab: 'Automations', entidad: null }));
  const { porId, aristas } = armar([
    ...muchasDeTab,
    { id: 300, titulo: 'Cómo vendo la Mentoría Premium', updatedAt: '2026-10-17T03:00:00Z' },
    { id: 301, titulo: 'Ideas para el fin de semana', updatedAt: '2026-10-16T03:00:00Z' },
  ]);
  assert.ok(aristas.some((a) => a.de === 'chat:300' && a.a === 'prod:7'), 'el de la estrella se cuelga de lo que nombra, como antes');
  assert.match(porId.get('chats')!.detalle, /^Ideas para el fin de semana$/, 'el agregado es sólo de la estrella');
  assert.ok(!aristas.some((a) => a.de.startsWith('chat:automations')), 'una charla de una tab no se cuelga por su título');
  // Rompiéndolo: sin el `.filter((c) => !c.tab)` de los chats de la estrella, el tope se lo comen las de Automations → 1 fallo.
});

test('el grafo lee las MISMAS fuentes que la lista del Ops Center', () => {
  const grafo = sinComentarios(leer('lib/cerebro-chats.ts'));
  const lista = sinComentarios(leer('app/api/mako/chat/route.ts'));
  for (const f of ['chatsDeAntes', 'chatsDeLasTabs', 'chatsDeAutomations', 'chatsDeLosEditores']) {
    assert.match(grafo, new RegExp(`\\b${f}\\(`), `el grafo no lee ${f}`);
    assert.match(lista, new RegExp(`\\b${f}\\(`), `la lista del Ops Center ya no lee ${f}: el grafo mostraría otra cosa`);
  }
  assert.match(grafo, /chatsDeTabParaElGrafo\(/);
  // Y el ZIP y la API siguen sin chats (no tienen persona): construirCerebro() a secas.
  assert.match(sinComentarios(leer('app/api/second-brain/exportar/route.ts')), /construirCerebro\(\)/);
});
