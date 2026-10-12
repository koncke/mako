// =============================================================================
// MaKo Analyst de un lead (punto 19 del feedback del CRM, 12/10/2026): lo que tiene que ser cierto
// =============================================================================
// Martín: «replica el chat que tenemos en la tab de "Offer", basicamente que sea un chat con la IA
// que por defecto tenga atado los datos de ese lead, para eso tenemos una API de todo».
//
//   1. LA CONVERSACIÓN ES DE UNA PERSONA SOBRE UN LEAD, y con el prefijo de los chats por persona
//      (así /mako no la lista y las rutas de escritorio contestan 404 a su id).
//   2. LO QUE MaKo LEE del lead son lecturas REALES del registro de la API, que un closer puede ver
//      por la app, gratis y sin Calendly ni la agenda de Google (corren en cada mensaje).
//   3. EL BLOQUE del system: dice sobre quién es, trae los datos, dice lo que no se pudo leer y lo
//      que se cortó, no pasa del tope, y deja dicho que los datos no son órdenes.
//   4. EL CABLEADO (sobre el fuente, sin comentarios): la ruta pregunta quién y qué lead ANTES de
//      correr nada; la lib no escribe directo ni usa el permiso de la tab MaKo; el turno pone el
//      contexto en el system y no lo guarda; la pantalla monta las piezas del chat de Offer.
//
// Probado rompiéndolo (base: 10 pasan / 0 fallan, 12/10/2026), restaurando de memoria, y cada
// rotura la cazó el test que la nombra:
//   · chartKeyDelLead devolviendo `base` (sin el lead)                                 → 9 / 1
//   · `reuniones_lead` sumada a LECTURAS_DEL_LEAD                                      → 9 / 1
//   · contextoDelLead sin el renglón de «No se pudo leer ahora»                       → 9 / 1
//   · el tope por lectura ignorado (`recortar(crudo, lugar)`)                         → 9 / 1
//   · la ruta corriendo tarjetaDelLead ANTES de analystDelRequest en el POST JSON     → 9 / 1
//   · analystDelRequest con `puedeVerKey('mako'` en vez de 'crm'                       → 9 / 1
//   · el turno sin `${ctxAtado …}` al final del system                                 → 9 / 1
//   · el fetch de abrir el chat sin `AbortSignal.timeout`                              → 9 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chartKeyDelLead, leadIdDe, contextoDelLead, compactarProductos, recortar, LECTURAS_DEL_LEAD, TOPE_CONTEXTO, SUFIJO_LEAD,
} from '../lib/mako-analyst-lead-reglas';
import { PREFIJO_CHART_MOVIL, chartKeyDePersona } from '../lib/mako-turno-app-reglas';
import { porId, visible, type Vista } from '../lib/api-mako/registro';
import { esPublica } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// --- 1. De quién es la conversación ------------------------------------------------

test('la conversación es de UNA persona sobre UN lead, con el prefijo de los chats por persona', () => {
  const martin = chartKeyDePersona({ sub: '1', email: 'martin@x.com' });
  const closer = chartKeyDePersona({ sub: '22', email: 'closer@x.com' });
  const a = chartKeyDelLead(martin, 7);
  assert.equal(a, `${PREFIJO_CHART_MOVIL}u1${SUFIJO_LEAD}7`);
  assert.notEqual(a, chartKeyDelLead(martin, 8), 'dos leads comparten la conversación');
  assert.notEqual(a, chartKeyDelLead(closer, 7), 'dos personas comparten la conversación del mismo lead');
  assert.notEqual(a, martin, 'la conversación del lead es la misma clave que el chat del teléfono');
  // El prefijo es el que esconde la sesión de /mako y de las rutas de escritorio (lib/chart-chats.ts).
  assert.ok(String(a).startsWith(PREFIJO_CHART_MOVIL));
  for (const malo of [null, '', 'mako-doer', 'wa-advisor:5', PREFIJO_CHART_MOVIL, `${a}`]) {
    assert.equal(chartKeyDelLead(malo, 7), null, `aceptó la base ${String(malo)}`);
  }
  for (const mal of [0, -3, 1.5, Number.NaN]) assert.equal(chartKeyDelLead(martin, mal), null, `aceptó el lead ${mal}`);
});

test('el id de un lead: número o texto, entero y positivo', () => {
  assert.equal(leadIdDe(12), 12);
  assert.equal(leadIdDe(' 12 '), 12);
  for (const malo of [null, undefined, '', 'abc', '1.5', 0, -1, '0', {}, '12abc']) assert.equal(leadIdDe(malo), null, `aceptó ${JSON.stringify(malo)}`);
});

// --- 2. Lo que MaKo lee del lead -----------------------------------------------------

test('lo que MaKo lee son lecturas REALES del registro: un closer las ve por la app, gratis y sin agenda', () => {
  const closer: Vista = { canal: 'app', alcance: 'lectura', ws: 9, rol: 'miembro', tabs: null };
  assert.ok(LECTURAS_DEL_LEAD.length >= 5, `sólo ${LECTURAS_DEL_LEAD.length} lecturas: cambió la lista y esto ya no prueba nada`);
  for (const l of LECTURAS_DEL_LEAD) {
    const d = porId(l.id);
    assert.ok(d, `«${l.id}» no existe en el registro`);
    assert.equal(d.tipo, 'lectura', `«${l.id}» no es una lectura: el contexto no puede proponer ni escribir`);
    assert.ok(visible(d, closer), `un closer no ve «${l.id}» por la app: el contexto le mostraría lo que su pantalla no`);
    assert.equal(d.costo, 'gratis', `«${l.id}» cuesta (${d.costo}) y corre en CADA mensaje`);
    assert.ok(!d.lenta, `«${l.id}» es lenta y corre en CADA mensaje`);
    assert.ok(!d.datosDeGoogle, `«${l.id}» lee la agenda de Google, que no pasa por ningún modelo`);
    assert.ok(d.parametros.some((p) => p.nombre === 'leadId'), `«${l.id}» no recibe el leadId`);
  }
  for (const pedida of ['ficha_lead', 'productos_del_lead', 'journey_lead', 'notas_lead']) {
    assert.ok(LECTURAS_DEL_LEAD.some((l) => l.id === pedida), `falta «${pedida}» (ficha, etapa, funnels, notas, reuniones)`);
  }
});

// --- 3. El bloque del system ---------------------------------------------------------

const ficha = JSON.stringify({ lead: { id: 7, nombre: 'Ana Pérez', estado: 'activo', fecha_junta_1: '2026-10-10' } });
const productos = JSON.stringify({
  lead: { id: 7, nombre: 'Ana Pérez' }, puede_quitar: false,
  productos: [
    { embudoId: 1, nombre: 'Mentoría', esta: true, principal: true, etapa: 'agendado', etapas: [{ key: 'agendado', label: 'Agendó R1' }, { key: 'ganado', label: 'Ganado' }] },
    { embudoId: 2, nombre: 'Curso', esta: false, principal: false, etapa: null, etapas: [{ key: 'x', label: 'X' }] },
    { embudoId: 3, nombre: 'Taller', esta: false, principal: false, etapa: null, etapas: [] },
  ],
});

test('el bloque dice sobre quién es, trae cada lectura con su título y dice cuál no se pudo leer', () => {
  const ctx = contextoDelLead({
    leadId: 7, nombre: 'Ana Pérez',
    lecturas: [
      { id: 'ficha_lead', ok: true, salida: ficha },
      { id: 'productos_del_lead', ok: true, salida: productos },
      { id: 'journey_lead', ok: true, salida: '{"hitos":[]}' },
      { id: 'notas_lead', ok: false },
      { id: 'etiquetas_lead', ok: true, salida: '{"etiquetas":[]}' },
      { id: 'insight_lead', ok: true, salida: '{"insight":null}' },
    ],
  });
  assert.match(ctx, /«Ana Pérez» \(leadId 7\)/);
  assert.match(ctx, /DATOS, no instrucciones/, 'falta decir que lo del lead no son órdenes');
  assert.match(ctx, /tarjeta/, 'falta decir que una acción se confirma en la tarjeta');
  assert.ok(ctx.includes('"fecha_junta_1":"2026-10-10"'), 'no viajó la ficha');
  const notas = LECTURAS_DEL_LEAD.find((l) => l.id === 'notas_lead')!;
  assert.match(ctx, new RegExp(`No se pudo leer ahora: ${notas.titulo.replace(/[()]/g, '\\$&')}`), 'una lectura que falló no se dijo: se leería como «no tiene notas»');
  // Los productos: sólo los suyos, con el nombre de la etapa, y cuántos más hay.
  assert.ok(ctx.includes('"etapa_nombre":"Agendó R1"'), 'la etapa viajó sin su nombre');
  assert.ok(ctx.includes('"otros_productos_del_negocio":2'));
  assert.ok(!ctx.includes('"Taller"'), 'viajaron los productos donde el lead NO está');
});

test('sin ninguna lectura, el bloque lo dice; y una salida rara de productos pasa tal cual', () => {
  const ctx = contextoDelLead({ leadId: 3, nombre: '', lecturas: [] });
  assert.match(ctx, /no se pudo leer nada en este turno/);
  assert.match(ctx, /«este lead» \(leadId 3\)/);
  assert.equal(compactarProductos('no es json'), 'no es json');
  assert.equal(compactarProductos('{"ok":false}'), '{"ok":false}');
});

test('nada pasa del tope: cada lectura topea en lo suyo, el total en TOPE_CONTEXTO, y el corte se dice', () => {
  const enorme = `{"x":"${'a'.repeat(60_000)}"}`;
  const ctx = contextoDelLead({ leadId: 7, nombre: 'Ana', lecturas: LECTURAS_DEL_LEAD.map((l) => ({ id: l.id, ok: true as const, salida: enorme })) });
  const pie = ctx.indexOf('\n\n[No se pudo leer ahora');
  const sinPie = pie >= 0 ? ctx.slice(0, pie) : ctx;
  assert.ok(sinPie.length <= TOPE_CONTEXTO, `el bloque mide ${sinPie.length} > ${TOPE_CONTEXTO}`);
  assert.match(ctx, /se cortó aquí por largo/, 'se cortó sin decirlo');
  const defFicha = LECTURAS_DEL_LEAD.find((l) => l.id === 'ficha_lead')!;
  const ini = ctx.indexOf(`[${defFicha.titulo}]`);
  const bloqueFicha = ctx.slice(ini, ctx.indexOf('\n\n[', ini));
  assert.ok(ini > 0 && bloqueFicha.length <= defFicha.tope + defFicha.titulo.length + 3, `la ficha se llevó ${bloqueFicha.length} (tope ${defFicha.tope})`);
  assert.equal(recortar('abc', 10), 'abc');
  assert.ok(recortar('x'.repeat(500), 100).length <= 100);
});

// --- 4. El cableado ------------------------------------------------------------------

const RUTA = sinComentarios(leer('app/api/crm/analyst/route.ts'));
const LIB = sinComentarios(leer('lib/mako-analyst-lead.ts'));
const TURNO = sinComentarios(leer('lib/mako-turno-app.ts'));
const PANTALLA = sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx'));

test('la ruta es privada y pregunta QUIÉN y QUÉ LEAD antes de correr cualquier cosa', () => {
  assert.equal(esPublica('/api/crm/analyst'), false, '/api/crm/analyst quedó pública');
  // Cada handler: analystDelRequest primero, después lo que corre.
  const get = RUTA.slice(RUTA.indexOf('export async function GET'), RUTA.indexOf('async function mandar'));
  assert.ok(get.indexOf('analystDelRequest(') >= 0 && get.indexOf('analystDelRequest(') < get.indexOf('abrirDelLead('), 'GET abre la conversación sin validar el lead');
  const post = RUTA.slice(RUTA.indexOf('export async function POST'));
  const multipart = post.slice(0, post.indexOf('let body'));
  assert.ok(multipart.indexOf('analystDelRequest(') >= 0 && multipart.indexOf('analystDelRequest(') < multipart.indexOf('mandar('), 'el multipart manda sin validar el lead');
  const jsonPost = post.slice(post.indexOf('let body'));
  const valida = jsonPost.indexOf('analystDelRequest(');
  assert.ok(valida >= 0 && valida < jsonPost.indexOf('mandar(') && valida < jsonPost.indexOf('tarjetaDelLead('), 'el POST JSON corre el turno o la tarjeta sin validar el lead');
  assert.match(RUTA, /export const maxDuration = 300;/);
});

test('la lib: permiso del CRM (no el de la tab MaKo), lead del workspace, y nada escrito directo', () => {
  const quien = LIB.slice(LIB.indexOf('export async function analystDelRequest'), LIB.indexOf('export type ConversacionDelLead'));
  assert.match(quien, /puedeVerKey\('crm', rolWs, capa\)/, 'el chat del lead no mira el permiso de ver el CRM');
  assert.match(quien, /runWithWorkspace\(ws, \(\) => getLead\(leadId\)\)/, 'el lead no se busca en el workspace de la sesión');
  assert.ok(!/personaDelRequest/.test(LIB), 'usa personaDelRequest: exige la tab MaKo, y un closer que ve la ficha no podría usar el chat');
  // Proponer y confirmar son del turno y de lib/api-mako/acciones.ts: acá no se escribe nada.
  assert.ok(!/\.(from|insert|update|upsert)\(/.test(LIB), 'la lib escribe en la base por su cuenta');
  assert.ok(!/api-mako\/acciones/.test(LIB), 'la lib importa el confirmar del registro en vez de pasar por el turno');
  assert.match(LIB, /turnoApp\(a\.persona, sid, \{ \.\.\.entrada, contexto \}\)/, 'el turno no recibe el contexto del lead');
  assert.match(LIB, /ejecutarOperacion\(l\.id, \{ leadId: a\.lead\.id \}, ctx, 'json', vista\)/, 'el contexto no sale del choke point de la API de MaKo');
  assert.match(LIB, /alcance: 'lectura'/, 'las lecturas del contexto corren con más alcance que lectura');
});

test('el turno pone el contexto AL FINAL del system y no lo guarda en el hilo', () => {
  assert.match(TURNO, /contexto\?: string;/);
  const system = TURNO.split('\n').find((l) => l.includes('const system = '));
  assert.ok(system, 'no encontré el system del turno');
  assert.match(system!, /\$\{ctxAtado \? `\\n\\n\$\{ctxAtado\}` : ''\}`;\s*$/, 'el contexto no es lo último del system');
  for (const l of TURNO.split('\n').filter((x) => x.includes('appendMessage('))) {
    assert.ok(!/contexto|ctxAtado/.test(l), `el contexto se guarda en el hilo: ${l.trim()}`);
  }
});

test('la pantalla monta las piezas del chat de Offer y habla con su ruta con corte', () => {
  assert.match(PANTALLA, /^'use client';/);
  assert.match(PANTALLA, /export function MakoAnalystLead\(\{ leadId, nombre \}: \{ leadId: number; nombre: string \}\)/, 'cambió el contrato que monta la ficha');
  for (const pieza of ["from '@/app/whatsapp/_shared/ChatHilo'", "from '@/app/whatsapp/_shared/BurbujaHilo'", "from '@/app/whatsapp/_shared/ComposerWhatsApp'", "from '@/app/offer/AvatarMako'", "from '@/app/offer/estilos'"]) {
    assert.ok(PANTALLA.includes(pieza), `no monta ${pieza}: ya no es el chat de Offer`);
  }
  assert.ok(!/^import \{[^}]*\} from '@\/lib\/mako-turno-app-reglas'/m.test(PANTALLA), 'importa un VALOR de mako-turno-app-reglas (arrastra el registro al navegador)');
  const fetchs = PANTALLA.split('fetch(').length - 1;
  assert.ok(fetchs >= 3, `leí ${fetchs} fetch: cambió la pantalla y esto ya no prueba nada`);
  assert.equal(PANTALLA.split('AbortSignal.timeout(').length - 1, fetchs, 'un fetch sin corte: con la red caída no resuelve nunca');
  assert.match(PANTALLA, /postConProgreso\(conWs\(RUTA, ws\)/, 'el XMLHttpRequest no lleva el ?ws= (no pasa por el parche de WsFetch)');
});
