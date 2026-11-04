// =============================================================================
// Los gurús que esperan su caricatura: su ficha lista, y entran a la galería cuando llega su cara (4/11/2026)
// =============================================================================
// Martín: «faltan un montón de gurús que nos habían quedado por la mitad». Los diez que faltan no tienen caricatura en el repo
// (docs/hallazgos-ops-center.md), y sin cara un gurú no entra a la galería. Su ficha sí se escribe: vive en lib/asesores/en-espera.ts.
// Este test corre `problemasDeLaFicha` sobre cada una, con la guarda del voseo de la casa y el disco de verdad: el día que alguien sube
// el PNG, el test lo dice («pásalo a ASESORES»).
//
// PROBADO ROMPIÉNDOLO (4/11/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   1. `problemasDeLaFicha` sin la regla del voseo                                → 2 / 1: «una ficha mala no pasa»
//   2. `problemasDeLaFicha` sin la regla de «no hables como si fueras él»        → 2 / 1: «una ficha mala no pasa»
//   3. la ficha de Juan Carrizo con «vos sabés» adentro                          → 2 / 1: «cada ficha en espera»
// (4/11/2026, el mismo día) Llegaron las diez caras y entraron a la galería: `EN_ESPERA` quedó vacía, y el primer test no recorre nada. Para que
// las diez fichas no pierdan la guarda de voseo, de «no hables como si fueras él» y de «NO SE TRASLADA», el último test corre la misma
// `problemasDeLaFicha` sobre las que ya están en `FICHAS`. Probado rompiéndolo: la ficha de Juan Carrizo con «vos sabés» adentro → cae «las diez
// que ya entraron».
// Correr: node --import tsx --test tests/gurus-en-espera.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EN_ESPERA, problemasDeLaFicha, type GuruEnEspera } from '../lib/asesores/en-espera';
import { ASESORES, asesorPorId } from '../lib/asesores/catalogo';
import { FICHAS } from '../lib/asesores/fichas';
import { CURSO_DE_REFERENTE } from '../lib/asesores/cursos';
import { marcasDeVoseo } from '../lib/voseo';

const RAIZ = join(__dirname, '..');
const hayPng = (id: string) => existsSync(join(RAIZ, 'public', 'asesores', `${id}.png`));

test('cada ficha en espera cumple, tiene su curso y todavía no tiene cara', () => {
  const ids = new Set(ASESORES.map((a) => a.id as string));
  for (const g of EN_ESPERA) {
    assert.ok(!ids.has(g.id), `${g.id} ya está en la galería: sobra acá`);
    assert.ok(CURSO_DE_REFERENTE[g.id], `${g.id}: su curso no está en lib/asesores/cursos.ts (sin él no tiene Second Brain)`);
    assert.deepEqual(problemasDeLaFicha(g, { marcasDeVoseo, hayPng: hayPng(g.id) }), [], g.id);
  }
  assert.equal(new Set(EN_ESPERA.map((g) => g.id)).size, EN_ESPERA.length, 'un gurú dos veces');
});

test('una ficha mala no pasa: voseo, sin el aviso de no ser él, sin su curso, sin clases', () => {
  const mala: GuruEnEspera = { id: 'x', nombre: 'X', completo: 'X Y', especialidad: 'Algo', curso: 'Un curso', ficha: `Soy X. Vos sabés que tenés que vender. ${'relleno '.repeat(400)}` };
  const p = problemasDeLaFicha(mala, { marcasDeVoseo, hayPng: false });
  assert.ok(p.some((x) => x.includes('voseo')), p.join(' | '));
  assert.ok(p.some((x) => x.includes('no hables como si fueras')));
  assert.ok(p.some((x) => x.includes('no nombra su curso')));
  assert.ok(p.some((x) => x.includes('(clase:')));
  assert.ok(p.some((x) => x.includes('NO SE TRASLADA')));
});

test('con su PNG subido, el test pide pasarlo a la galería', () => {
  const g = EN_ESPERA[0] ?? { id: 'x', nombre: 'X', completo: 'X Y', especialidad: 'Algo', curso: 'Un curso', ficha: '' };
  assert.ok(problemasDeLaFicha(g, { marcasDeVoseo, hayPng: true }).some((x) => x.includes('pásalo a ASESORES')));
});

const LAS_DIEZ = ['juan-carrizo', 'vilma-nunez', 'samuel-albaa', 'alvaro-luque', 'sergio-begueria', 'romuald-fons', 'mateo-maffia', 'francisco-doglio', 'andy-landa', 'gonzalo-sere'];

test('las diez que ya entraron a la galería siguen cumpliendo lo que se les pidió esperando', () => {
  for (const id of LAS_DIEZ) {
    const a = asesorPorId(id);
    assert.ok(a, `${id} no está en ASESORES`);
    assert.ok(hayPng(id), `${id}: sin su PNG`);
    assert.ok(existsSync(join(RAIZ, 'public', 'asesores', 'grandes', `${id}.png`)), `${id}: sin su cara grande (la tarjeta de Spy)`);
    const g: GuruEnEspera = { id: a.id, nombre: a.nombre, completo: a.completo, especialidad: a.especialidad, curso: a.curso, ficha: FICHAS[a.id] };
    assert.deepEqual(problemasDeLaFicha(g, { marcasDeVoseo, hayPng: false }), [], id);
  }
});
