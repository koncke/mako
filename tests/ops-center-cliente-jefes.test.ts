// =============================================================================
// La barra del Ops Center del cliente sin títulos de sección: cada grupo con su chat JEFE y sus chats debajo (22/10/2026, D1)
// =============================================================================
// Martín, con captura de /second-brain?chat=40 (ws1): «Que NO hayan "secciones" en la sidebar de chats, que estén los chats JEFES
// que actúan como las secciones y los chats trabajadores que son los de abajo». La barra tenía títulos (AUTOMATIONS, OFFER,
// DASHBOARD, PREGÚNTALE A MAKO) con los chats debajo: `GruposPorJefe` dibujaba el nombre del grupo cuando no tenía chat propio.
//   1. el grupo sin chat propio lleva una fila JEFE (`jefeDelGrupo`): su nombre, su criatura, la hora del más reciente, y abre
//      el más reciente de los suyos; no es «el abierto» (el abierto es el chat, no el jefe);
//   2. en la computadora y en el teléfono, con la pieza del super admin (sangría y línea), y sin títulos de sección.
//
// Correr: node --import tsx --test tests/ops-center-cliente-jefes.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jefeDelGrupo, listaDelCliente } from '../lib/chat-mako-reglas';
import { porJefe } from '../lib/centro-chats';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GruposPorJefe } from '../app/admin/operaciones/GruposPorJefe';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el grupo sin chat propio lleva su fila JEFE: su nombre, la hora del más reciente, y abre el más reciente de los suyos', () => {
  const lista = listaDelCliente({
    sesiones: [], antes: [], busca: '',
    offer: [
      { id: 13, titulo: 'Sprint 3 días', updatedAt: '2026-10-22T10:00:00Z' },
      { id: 12, titulo: 'Vieja', updatedAt: '2026-10-20T10:00:00Z' },
    ],
  });
  const grupos = porJefe(lista.slice(1));
  const offer = grupos.find((g) => g.jefe === 'Offer');
  assert.ok(offer && offer.chat == null && offer.subs.length === 2, 'Offer es un grupo sin chat propio');
  const jefe = jefeDelGrupo(offer!);
  assert.ok(jefe);
  assert.equal(jefe!.titulo, 'Offer');
  assert.equal(jefe!.criatura, 'Offer');
  assert.equal(jefe!.jefeDeGrupo, true, 'no es «el abierto»');
  assert.deepEqual(jefe!.elegido, offer!.subs[0].elegido, 'abre el más reciente');
  assert.equal(jefe!.actividad, Math.max(...offer!.subs.map((f) => f.actividad ?? 0)), 'con la hora del más reciente');
  assert.equal(jefeDelGrupo({ clave: 'jefe:x', jefe: 'X', subs: [] }), null, 'sin chats, sin jefe');
});

test('2. en la computadora y en el teléfono, con la pieza del super admin y sin títulos de sección', () => {
  // La pieza del super admin, DIBUJADA (10/11/2026: vive en GruposPorJefe.tsx; antes se miraba su línea en PiezasCentro): un grupo
  // sin chat propio dibuja la fila jefe que le pasan, y sin ella, el nombre del grupo.
  const subs = [{ titulo: 'Offer › Sprint 3 días' }, { titulo: 'Offer › Mi oferta' }];
  const fila = (c: { titulo: string }, sub: boolean) => createElement('p', { key: c.titulo, 'data-sub': String(sub) }, c.titulo);
  const conJefe = renderToStaticMarkup(createElement(GruposPorJefe<{ titulo: string }>, { chats: subs, fila, jefe: () => ({ titulo: 'Offer' }) }));
  assert.match(conJefe, /<p data-sub="false">Offer<\/p>/, 'la fila jefe, como un chat más');
  assert.doesNotMatch(conJefe, /co-jefe__nombre/, 'sin título de sección');
  assert.match(conJefe, /<p data-sub="true">Offer › Sprint 3 días<\/p>/, 'los suyos, corridos debajo');
  const sinJefe = renderToStaticMarkup(createElement(GruposPorJefe<{ titulo: string }>, { chats: subs, fila }));
  assert.match(sinJefe, /<p class="co-jefe__nombre">Offer<\/p>/, 'sin la fila jefe, el nombre');
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /<GruposPorJefe chats=\{corte\} fila=\{fila\} jefe=\{\(g\) => \{ const j = jefeDelGrupo\(g\);/, 'la computadora');
  assert.match(sb, /const actual = !verMapa && !enOtroChat && !f\.jefeDeGrupo && esFilaDe\(f, elegido\);/);
  const m = sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx'));
  assert.match(m, /const j = g\.chat \?\? \(\(\) => \{ const v = jefeDelGrupo\(g\);/, 'el teléfono');
  assert.match(m, /return j \? \[fila\(j\), \.\.\.g\.subs\.map\(\(f\) => fila\(f, true\)\)\] :/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 2/0):
//   · el jefe abre el más viejo                  → 1/1 (1)
//   · el jefe es «el abierto»                    → 1/1 (2)
//   · la computadora vuelve al título            → 1/1 (2)
//   · el teléfono, sin jefe                      → 1/1 (2)
// Y el 10/11/2026, con la pieza dibujada (base 2/0):
//   · GruposPorJefe sin usar `jefe` (cabeza = g.chat) → 1/1 (2)
//   · los de adentro sin correrse                     → 1/1 (2)
