// =============================================================================
// Ticket #114: recuperar los comentarios de Instagram que el webhook perdió (lib/recuperar-comentarios-reglas.ts, puro)
// =============================================================================
// Con datos del caso real (ws10, 14 al 18/11/2026). Se EJECUTA la regla, con el comparador real de palabras del motor
// (`comentarioDispara`, lib/palabras-clave.ts) como `dispara`.
//
// PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez:
//   · sin el `planeado` (persona × automatización)        → cae «nadie recibe dos veces…».
//   · con `>` en vez de `>=` en los 7 días                  → cae «los 7 días de Meta…».
//   · `dudoso` siempre en false                             → cae «el dudoso…».
//
// Correr: node --import tsx --test tests/recuperar-comentarios-114.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDeRecuperacion, sinExcluidos, esSoloLaPalabra, SIETE_DIAS_MS, type ComentarioLeido, type SecuenciaDeComentario } from '../lib/recuperar-comentarios-reglas';
import { comentarioDispara } from '../lib/palabras-clave';

const SECS: SecuenciaDeComentario[] = [
  { id: 707, nombre: 'IG - LISTA', disparadores: [{ palabras: ['lista', 'lizta', 'list', 'format'] }] },
  { id: 708, nombre: 'IG - MARCA', disparadores: [{ palabras: ['marca', 'marc', 'artist'] }] },
  { id: 709, nombre: 'IG - LANZAMIENTO', disparadores: [{ palabras: ['fiest', 'fiezta', 'lanzamiento', 'lansamiento'] }] },
];
const T0 = Date.parse('2026-11-16T14:43:00Z');
const c = (id: string, autor: string, texto: string, horas: number, extra: Partial<ComentarioLeido> = {}): ComentarioLeido =>
  ({ comentarioId: id, texto, autorId: autor, usuario: autor, propio: false, postId: 'p1', cuentaId: 'acc', atMs: T0 + horas * 3600_000, ...extra });
const opc = (ahoraMs: number, ya: string[] = []) => ({
  ahoraMs,
  dispara: (d: { palabras?: readonly string[] | null }, texto: string) => comentarioDispara(texto, d.palabras ?? null),
  yaLaTiene: (a: string, s: number) => ya.includes(`${a}:${s}`),
});

test('nadie recibe dos veces el mismo recurso; dos palabras distintas, un DM por cada una y cada uno con SU comentario', () => {
  const p = planDeRecuperacion([
    c('1', 'laura', 'Marca', 0), c('2', 'laura', 'Lista', 0.1), c('3', 'laura', 'Lista!!', 5), c('4', 'pedro', 'Lanzamiento', 1),
  ], SECS, opc(T0 + 3600_000 * 6));
  assert.deepEqual(p.items.map((i) => [i.usuario, i.comentarioId, i.secuencias.map((s) => s.id)]), [['laura', '1', [708]], ['laura', '2', [707]], ['pedro', '4', [709]]]);
});

test('quien ya la tiene no la recibe; el comentario propio y el que no tiene palabra, tampoco', () => {
  const p = planDeRecuperacion([
    c('1', 'martin', 'Lanzamiento', 0), c('2', 'fiesta', 'Lista', 0, { propio: true }), c('3', 'ana', 'Es obvio, el creador del género', 0),
  ], SECS, opc(T0, ['martin:709']));
  assert.equal(p.items.length, 0);
  assert.equal(p.yaLaTenian, 1);
});

test('los 7 días de Meta: el vencido no se propone, y el que vence justo ahora ya está vencido', () => {
  const p = planDeRecuperacion([c('1', 'viejo', 'Lista', 0), c('2', 'nuevo', 'Lista', 24)], SECS, opc(T0 + SIETE_DIAS_MS));
  assert.deepEqual(p.items.map((i) => i.usuario), ['nuevo']);
  assert.deepEqual(p.vencidos.map((i) => i.usuario), ['viejo']);
  assert.equal(p.items[0].venceMs, T0 + 24 * 3600_000 + SIETE_DIAS_MS);
});

test('el dudoso: el comentario que dice algo más que la palabra lo decide el cliente', () => {
  const p = planDeRecuperacion([c('1', 'janet', 'Con Marc antony', 0), c('2', 'leti', 'Lanzamiento 🥹', 0)], SECS, opc(T0));
  assert.deepEqual(p.items.map((i) => [i.usuario, i.dudoso]), [['janet', true], ['leti', false]]);
  assert.equal(esSoloLaPalabra('¡Guía!', ['guia']), true);
  assert.deepEqual(sinExcluidos(p.items, '@Janet, otro').map((i) => i.usuario), ['leti']);
});
