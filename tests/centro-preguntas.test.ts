// =============================================================================
// La pregunta de cada chat, arriba de su caja (16/10/2026): lo que, roto, no da error
// =============================================================================
// Martín: «prefiero ahí donde está "Una tarjeta espera tu respuesta en la Ticketera" que salga lo mismo que hoy sale
// en claude, las opciones», y en producción: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo
// claude». Lo que se fija acá:
//   · de qué chat es una tarjeta (con destino, por nombre único, y nunca en dos chats);
//   · que el globito del muñeco y la pregunta de arriba de la caja cuentan LO MISMO;
//   · las opciones como los renglones de AskUserQuestion de Claude Code (título, descripción, «(Recomendada)»);
//   · que contestar pasa por la acción de la Ticketera y la respuesta queda en la conversación como de Martín;
//   · que publicar acepta la descripción de una opción, con su tope.
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 7 pases:
//   · `sesionDeDecision` buscando por nombre aunque haya destino → 1 fallo («de qué chat»);
//   · `preguntasDelChat` sin sacar las contestadas → 2 fallos («de qué chat» y «lo mismo que el globito»);
//   · sin el orden por urgencia → 1 fallo («de qué chat»);
//   · `opcionesDePregunta` sin partir en la raya → 1 fallo («los renglones»);
//   · la pregunta sin «(Recomendada)» → 1 fallo («el dibujo»);
//   · el hilo sin la línea de la respuesta → 1 fallo («la respuesta en la conversación»);
//   · \`sanearPublicada\` sin el tope del detalle → 1 fallo («publicar»).
//   · `preguntaAbierta` por posición → 1 fallo («se sigue por su id»).
//   Restaurado de memoria: 7 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { opcionesDePregunta, preguntaAbierta, preguntasDelChat, respuestasDelChat, sesionDeDecision, temaDePregunta } from '../lib/centro-preguntas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esperaDe, esperasPorChat, historialDelChat, vistaPrevia, type ChatCentro } from '../lib/centro-chats';
import { RESUELTA, TOPES, filaADecision, sanearPublicada, type Decision } from '../app/admin/runway/decisiones';
import type { ChatCartero } from '../lib/operaciones-reglas';
import { Pregunta } from '../app/admin/operaciones/Pregunta';
import { Hilo } from '../app/admin/operaciones/Hilo';

const L = (n: number) => `local_${n}1111111-2222-4333-8444-555555555555`;
let n = 0;
function dec(p: Partial<Decision> = {}): Decision {
  n += 1;
  return {
    id: n, ref: `d-${n}`, chat: 'CRM', pregunta: `¿Pregunta ${n}?`,
    opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
    destraba: null, contexto: null, recomendada: null, urgencia: 'criterio', href: null, orden: 100,
    respuesta: null, respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-14T16:00:00Z',
    ...p,
  };
}
const chatCartero = (local: string, titulo: string): ChatCartero => ({ local, titulo, cuenta: 'claude3', vivo: true, estado: 'idle', actividad: null });
const carteros = [{ cuenta: 'claude3', chats: [chatCartero(L(1), 'CRM'), chatCartero(L(2), 'Pagos'), chatCartero(L(3), 'Offer'), chatCartero(L(4), 'Offer')] }];
const chat = (miembros: string[], titulo = 'CRM'): ChatCentro => ({
  clave: `nombre:${titulo.toLowerCase()}`, sesion: miembros[0] ?? null, porNombre: false, titulo, cuenta: 'claude3', estado: 'abierto',
  vistoAt: null, viejo: false, actividad: null, pedidos: [], pidioAca: [], trabajos: [], miembros, sesiones: [],
});

test('de qué chat es una tarjeta: su destino manda; sin destino, el nombre si un solo chat se llama así', () => {
  const chats = carteros[0].chats;
  assert.equal(sesionDeDecision({ chat: 'Pagos', destino: L(1) }, chats), L(1), 'con destino, aunque el nombre diga otro');
  assert.equal(sesionDeDecision({ chat: 'pagos', destino: null }, chats), L(2), 'por nombre, sin mayúsculas');
  assert.equal(sesionDeDecision({ chat: 'Offer', destino: null }, chats), null, 'dos chats se llaman Offer: no se adivina');
  assert.equal(sesionDeDecision({ chat: 'Plan', destino: null }, chats), null);
  const frena = dec({ destino: L(1), urgencia: 'bloquea', orden: 200 });
  const criterio = dec({ destino: L(1), urgencia: 'criterio', orden: 1 });
  const contestada = dec({ destino: L(1), respuesta: 'A', respondidaAt: '2026-10-16T03:00:00Z' });
  const deOtro = dec({ destino: L(2) });
  const porNombre = dec({ chat: 'CRM', destino: null, urgencia: 'cuesta' });
  const crm = chat([L(1)]);
  assert.deepEqual(preguntasDelChat(crm, [criterio, contestada, deOtro, frena, porNombre], carteros).map((d) => d.id),
    [frena.id, porNombre.id, criterio.id], 'las suyas sin contestar, lo que frena primero');
  assert.deepEqual(respuestasDelChat(crm, [criterio, contestada, deOtro], carteros).map((d) => d.id), [contestada.id]);
});

test('el globito del muñeco y la pregunta de arriba de la caja cuentan LO MISMO', () => {
  const ds = [dec({ destino: L(1) }), dec({ destino: L(1), respuesta: 'B', respondidaAt: '2026-10-16T03:00:00Z' }), dec({ chat: 'Pagos', destino: null }), dec({ chat: 'Offer', destino: null })];
  const esperas = esperasPorChat(ds, carteros);
  for (const c of [chat([L(1)]), chat([L(2)], 'Pagos'), chat([L(3), L(4)], 'Offer')]) {
    assert.equal(esperaDe(c, esperas), preguntasDelChat(c, ds, carteros).length, c.titulo);
  }
});

test('los renglones de Claude Code: título, descripción abajo, la recomendada marcada, y el «Para saber» sin opciones', () => {
  const d = dec({
    opciones: [{ clave: 'A', texto: 'Sí', detalle: 'Se publica hoy' }, { clave: 'B', texto: 'No — espera a Mauricio' }, { clave: 'C', texto: 'Después' }],
    recomendada: 'A',
  });
  assert.deepEqual(opcionesDePregunta(d), [
    { clave: 'A', titulo: 'Sí', detalle: 'Se publica hoy', recomendada: true },
    { clave: 'B', titulo: 'No', detalle: 'espera a Mauricio', recomendada: false },
    { clave: 'C', titulo: 'Después', detalle: null, recomendada: false },
  ]);
  assert.deepEqual(opcionesDePregunta(dec({ opciones: [], urgencia: 'aviso' })), [{ clave: RESUELTA, titulo: 'Entendido', detalle: null, recomendada: true }]);
  assert.equal(temaDePregunta(dec({ urgencia: 'bloquea' })), 'Frena el chat');
});

test('el dibujo copia AskUserQuestion: la pestaña, «1 de 2», las opciones numeradas y el renglón libre', () => {
  const a = dec({ opciones: [{ clave: 'A', texto: 'Sí', detalle: 'Se publica hoy' }, { clave: 'B', texto: 'No' }], recomendada: 'A', urgencia: 'bloquea' });
  const b = dec();
  const html = renderToStaticMarkup(createElement(Pregunta, { preguntas: [a, b], responder: async () => ({ error: null, ok: true }) }));
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>Frena el chat</);
  assert.match(html, />1 de 2</);
  assert.match(html, new RegExp(`co-preg__texto">${a.pregunta.replace(/[?¿]/g, '.')}<`));
  assert.match(html, /co-preg__num" aria-hidden="true">1<[\s\S]*?Sí<span class="co-preg__rec"> \(Recomendada\)<\/span>[\s\S]*?co-preg__detalle">Se publica hoy</);
  assert.match(html, /co-preg__num" aria-hidden="true">2<[\s\S]*?>No</);
  assert.match(html, /co-preg__num" aria-hidden="true">3<[\s\S]*?placeholder="Escribe otra cosa"/, 'el último renglón es el libre');
  assert.match(html, /Elige con 1 a 3/);
  // Una sola: sin «1 de 1».
  assert.doesNotMatch(renderToStaticMarkup(createElement(Pregunta, { preguntas: [b], responder: async () => ({ error: null, ok: true }) })), /de 1</);
});

test('la pregunta abierta se sigue por su id: una tarjeta que llega ADELANTE no le roba la respuesta', () => {
  // La revisión adversarial lo encontró (16/10/2026): con la posición, si el refresco metía una «frena» adelante de la que
  // Martín estaba contestando, lo que escribía se guardaba en la otra. Probado rompiéndolo: eligiendo por posición
  // (`preguntas[0]` cuando hay elegida), el segundo assert da P0.
  const p1 = dec({ urgencia: 'criterio' });
  const p0 = dec({ urgencia: 'bloquea' });
  assert.equal(preguntaAbierta([p1], p1.id).d?.id, p1.id);
  const despues = preguntaAbierta([p0, p1], p1.id);
  assert.equal(despues.d?.id, p1.id, 'sigue abierta la que se estaba contestando');
  assert.equal(despues.pos, 1, 'y el «2 de 2» lo dice');
  assert.equal(preguntaAbierta([p0], p1.id).d?.id, p0.id, 'si la elegida se contestó, la primera');
  assert.equal(preguntaAbierta([p0, p1], null).d?.id, p0.id, 'sin elegir, la que frena');
  const src = readFileSync(join(import.meta.dirname, '..', 'app/admin/operaciones/Pregunta.tsx'), 'utf8');
  assert.match(src, /const \{ d, pos \} = preguntaAbierta\(preguntas, elegida\);/, 'la pantalla usa esta misma regla');
  assert.match(src, /try \{ r = await responder\(/, 'y un rechazo de la acción no deja la pregunta en «…»');
});

test('la respuesta en la conversación: la burbuja de Martín, con la pregunta citada arriba', () => {
  const d = dec({ destino: L(1), pregunta: '¿Se publica?', respuesta: 'A', respondidaAt: '2026-10-16T03:00:00Z' });
  const crm = chat([L(1)]);
  const lineas = historialDelChat(crm, new Map(), [], respuestasDelChat(crm, [d], carteros));
  assert.equal(lineas.length, 1);
  assert.equal(lineas[0].tipo, 'respuesta');
  assert.deepEqual(vistaPrevia(lineas), { texto: 'A · Sí', propio: true, tick: null, instante: Date.parse('2026-10-16T03:00:00Z') });
  const html = renderToStaticMarkup(createElement(Hilo, { lineas, pushes: [], ahora: Date.parse('2026-10-16T04:00:00Z'), vacio: '', quien: { titulo: 'CRM', animo: 'despierto' } }));
  assert.match(html, /class="co-yo"><p class="co-burbuja"><span class="co-burbuja__cita">¿Se publica\?<\/span>A · Sí/);
});

test('publicar: una opción puede traer su descripción, con su tope, y se lee de vuelta', () => {
  const base = { ref: 'una', chat: 'CRM', pregunta: '¿Va?', opciones: [{ clave: 'A', texto: 'Sí', detalle: 'Se publica hoy' }, { clave: 'B', texto: 'No' }] };
  const ok = sanearPublicada(base);
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.d.opciones, [{ clave: 'A', texto: 'Sí', detalle: 'Se publica hoy' }, { clave: 'B', texto: 'No' }], 'sin detalle, no se inventa la clave');
  const largo = sanearPublicada({ ...base, opciones: [{ clave: 'A', texto: 'Sí', detalle: 'x'.repeat(TOPES.detalle + 1) }] });
  assert.equal(largo.ok, false);
  assert.match(!largo.ok ? largo.motivo : '', /el detalle de la opción A va hasta 140/);
  const fila = filaADecision({ id: 1, ref: 'una', chat: 'CRM', pregunta: '¿Va?', opciones: base.opciones, creada_at: '2026-10-16' });
  assert.deepEqual(fila.opciones, base.opciones);
});
