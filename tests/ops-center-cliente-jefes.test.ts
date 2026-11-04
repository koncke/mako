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
  const pieza = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(pieza, /const cabeza = g\.chat \?\? jefe\?\.\(g\) \?\? null;\n\s*return \(\n\s*<div key=\{g\.clave\} className="co-jefe">\n\s*\{cabeza \? fila\(cabeza, false\) :/);
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
