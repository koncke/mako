// =============================================================================
// Las sugerencias de MaKo, plegadas en su tira y con su nombre (22/10/2026, ajuste a C2)
// =============================================================================
// Martín, mirando producción: «no me gusta el diseño de las sugerencias, primero que no se entiende que son sugerencias y
// luego que son muy invasivas, se debería poder ver en un desplegable o algo así, y que se entienda».
//   1. por defecto van PLEGADAS en una tira chica arriba de la caja, «Sugerencias de MaKo · 4 ▾», con un ícono de idea;
//      tocándola se abren de a una, con «Hacerlo» / «Ahora no» y ‹ ›, y abiertas dicen «Sugerencia de MaKo»;
//   2. una sugerencia nueva NO abre nada: sólo suma al número. Una pregunta nueva de un chat sí abre el bloque, como siempre,
//      y las sugerencias quedan en su tira;
//   3. es la pieza del bloque (PreguntasDelChat.tsx), la que monta la estrella de cada tab (MakoEnLaTab): lo mismo en todas.
//
// Correr: node --import tsx --test tests/ops-center-sugerencias-plegadas.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BloqueDePreguntas, llegoUnaPregunta, vistaDelBloque, type PreguntaDeLaTab } from '../app/admin/operaciones/PreguntasDelChat';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const sug = (id: string, texto: string): PreguntaDeLaTab => ({ id, pregunta: texto, opciones: [{ titulo: 'Hacerlo', recomendada: true, onElegir: () => {} }, { titulo: 'Ahora no', onElegir: () => {} }] });
const deApp = (id: string) => ({
  id, local: 'local_22222222-2222-4222-8222-222222222222', pregunta: '¿Subo el tren ahora?', contexto: null,
  opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'Después', detalle: null }], recomendada: 0, varias: false,
  at: '2026-10-22T16:01:00Z', respuesta: null, origen: 'ask',
}) as unknown as PreguntaChat;

test('1. plegadas en su tira con su nombre; tocándola se abren de a una, y abiertas dicen «Sugerencia de MaKo»', () => {
  const s = [{ de: 'tab' as const, id: 's:a' }, { de: 'tab' as const, id: 's:b' }];
  const cerradas = vistaDelBloque(s, false, false);
  assert.deepEqual(cerradas.visibles, [], 'por defecto, ninguna a la vista');
  assert.equal(cerradas.tiraDeSugerencias, true);
  const abiertas = vistaDelBloque(s, false, true);
  assert.deepEqual(abiertas.visibles.map((x) => x.id), ['s:a', 's:b'], 'tocando la tira, de a una');
  assert.equal(abiertas.tiraDeSugerencias, false);
  // Lo que se dibuja: la tira, con su ícono, su nombre y cuántas hay, y nada de lo que sugieren.
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'tab:CRM', deLaTab: [sug('a', 'Avisarte de las cuotas vencidas'), sug('b', 'Reagendar los No Show')] }));
  assert.match(html, /^<button type="button" class="co-preg co-preg--arriba co-preg--plegada co-preg--sugerencias" aria-expanded="false"><span class="co-preg__sug"><svg [^>]*>[\s\S]*?<\/svg>Sugerencias de MaKo · 2<\/span><span class="co-preg__flecha" aria-hidden="true">▾<\/span><\/button>$/);
  assert.doesNotMatch(html, /cuotas vencidas|No Show|class="co-preg__plegar"/, 'plegadas: no hay tarjeta abierta');
  assert.match(renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'tab:CRM', deLaTab: [sug('a', 'x')] })), />Sugerencia de MaKo · 1</);
  // Abiertas, su cabecera: qué son, y la flecha que las vuelve a la tira.
  const b = sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));
  assert.match(b, /\{enSugerencias \? \(<>\n\s*(?:\{\}\n\s*)?<div className="co-preg__cab">\n\s*<span className="co-preg__sug"><Icon name="idea" size=\{15\} \/>Sugerencia de MaKo<\/span>\n\s*<Plegar onPlegar=\{\(\) => setVerSugerencias\(false\)\} que="las sugerencias" \/>/);
  assert.match(b, /aria-label=\{it\.de === 'tab' \? `Sugerencia de MaKo: \$\{titulo\}`/);
  assert.match(leer('app/admin/operaciones/centro.css'), /\.co-preg__sug \{ display: inline-flex;/);
});

test('2. una sugerencia nueva no abre nada; una pregunta nueva de un chat sí, y las sugerencias quedan en su tira', () => {
  const mixto = [{ de: 'app' as const, id: 'a:1' }, { de: 'tab' as const, id: 's:a' }];
  const v = vistaDelBloque(mixto, false, false);
  assert.deepEqual(v.visibles.map((x) => x.id), ['a:1'], 'la pregunta, abierta');
  assert.equal(v.tiraDeSugerencias, true, 'las sugerencias, en su tira');
  const enSug = vistaDelBloque(mixto, false, true);
  assert.deepEqual(enSug.visibles.map((x) => x.id), ['s:a']);
  assert.equal(enSug.tiraDePreguntas, true, 'con las sugerencias abiertas, la pregunta queda en su tira');
  assert.deepEqual(vistaDelBloque(mixto, true, false).visibles, [], 'las preguntas se pliegan como siempre');
  // Lo único que cierra las sugerencias abiertas es una pregunta que no estaba.
  assert.equal(llegoUnaPregunta(new Set(['a:1']), [{ id: 'a:1' }, { id: 'c:2' }]), true);
  assert.equal(llegoUnaPregunta(new Set(['a:1', 'c:2']), [{ id: 'a:1' }]), false, 'que se conteste una no las cierra');
  const b = sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));
  assert.match(b, /if \(llegoUnaPregunta\(yaVistas\.current, preguntas\)\) setVerSugerencias\(false\);/);
  // El plegado se recuerda por las PREGUNTAS: si contara las sugerencias, una nueva cambiaría la firma.
  assert.match(b, /const soloPreguntas = useMemo\(\(\) => items\.filter\(\(x\) => x\.de !== 'tab'\), \[items\]\);\n\s*const \[plegado, setPlegado\] = usePlegado\(chat, soloPreguntas\);/);
  // Y sólo la tira las abre: no hay otro `setVerSugerencias(true)`.
  assert.equal((b.match(/setVerSugerencias\(true\)/g) ?? []).length, 1);
  assert.match(b, /<TiraSugerencias n=\{sugerencias\.length\} onAbrir=\{\(\) => setVerSugerencias\(true\)\} \/>/);
  // Dibujado: la pregunta abierta y la tira de las sugerencias, sin su texto.
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'local_x', deLaApp: [deApp('bbbbbbbb-1111-4222-8333-444444444444')], deLaTab: [sug('a', 'Avisarte de las cuotas vencidas')] }));
  assert.match(html, /¿Subo el tren ahora\?/);
  assert.match(html, />Sugerencia de MaKo · 1</);
  assert.doesNotMatch(html, /cuotas vencidas/);
});

test('3. es la pieza del bloque, la de la estrella de cada tab: lo mismo en todas, y el globito sigue contando', () => {
  const tab = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(tab, /\{preguntas && preguntas\.length > 0 && <BloqueDePreguntas chat=\{`tab:\$\{tab\}`\} deLaTab=\{preguntas\} \/>\}/);
  assert.match(tab, /const espera = aviso \+ trabajos\.length;/, 'lo que espera en la tab, más lo que MaKo terminó en otra');
  assert.match(tab, /<Muneco titulo=\{JEFE_SECOND_BRAIN\} animo="despierto" size=\{40\} espera=\{espera\} \/>/, 'el globito de la estrella plegada');
  assert.match(sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx')), /preguntas=\{preguntas\} aviso=\{n\}/, 'el CRM manda cuántas hay');
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · abiertas por defecto                              → 1/2 (1, 2)
//   · la tira sin su nombre                             → 1/2 (1, 2)
//   · abiertas sin «Sugerencia de MaKo»                 → 2/1 (1)
//   · el plegado vuelve a contar las sugerencias        → 2/1 (2)
//   · una pregunta nueva no las cierra                  → 2/1 (2)
//   · una sugerencia nueva abre el bloque               → 2/1 (2)
