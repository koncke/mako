// =============================================================================
// Create: Copywriting, Video, Image y Web Generator, en ese orden; sin AI Avatar ni Lead Magnet (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «en Create debería estar la parte de copywriting primero. Luego video, image y web generator… [AI Avatar] no
// debería estar, eso ya lo hablamos muchas veces. Y lead magnet tampoco». AI Avatar se usa desde Video («Tu personaje con IA») y
// queda con `fueraDeLaBarra` (su key es contrato); Lead Magnet está archivado (lib/lead-magnets/archivado.ts).
// Se mira lo que se DIBUJA, para cada persona: la barra de escritorio, el «More» del teléfono y lo que ofrece MaKo.
//
// Probado rompiéndolo (11/11/2026), una rotura por vez y restaurada (qué caso cae):
//   · AI Avatar sin `fueraDeLaBarra` en nav.ts                         → 1
//   · la fila de AI Avatar del teléfono de vuelta en Create             → 2
//   · AI Avatar de vuelta como función propia en lib/funciones-mako.ts → 3
//   · Video antes que Copywriting en nav.ts                            → 1 y 2 (el «More» sigue a la barra)
// Correr: node --import tsx --test tests/create-orden.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAMILIAS } from '../app/_components/nav';
import { resolverTab, type VistaNav } from '../lib/nav-visibilidad';
import { masCompleto } from '../lib/movil-rutas';
import { funcionesMako, funcionDeKey } from '../lib/funciones-mako';

const ORDEN = ['Copywriting', 'Video', 'Image', 'Web Generator'];

/** Las personas: el admin de un cliente (Esencial y Pro), un closer, y el super admin en su barra. */
const PERSONAS: Array<[string, VistaNav]> = [
  ['cliente Esencial', { adminShell: false, rolWs: 'admin', capa: 'completo' }],
  ['cliente Pro', { adminShell: false, rolWs: 'admin', capa: 'agencia' }],
  ['closer', { adminShell: false, rolWs: 'closer', capa: 'completo' }],
  ['super admin', { adminShell: true, rolWs: 'admin', capa: 'superadmin' }],
];

const createDe = (v: VistaNav): string[] => {
  const create = FAMILIAS.find((f) => f.key === 'create');
  assert.ok(create, 'la familia Create existe');
  return create.bloques.flat().map((t) => resolverTab(t, v)).filter(Boolean).map((t) => t!.label);
};

test('1. la barra de escritorio: Copywriting, Video, Image, Web Generator, para cada persona, y nada de AI Avatar ni Lead Magnet', () => {
  for (const [quien, v] of PERSONAS) {
    const filas = createDe(v);
    assert.ok(!filas.includes('AI Avatar'), `${quien}: AI Avatar en la barra`);
    assert.ok(!filas.some((l) => /lead magnet/i.test(l)), `${quien}: Lead Magnet en la barra`);
    // El orden de Martín, entre las que esta persona ve (un plan puede no ver alguna; el orden no cambia).
    const vistas = ORDEN.filter((l) => filas.includes(l));
    assert.deepEqual(filas, vistas, `${quien}: el orden es ${ORDEN.join(', ')}`);
  }
  assert.deepEqual(createDe(PERSONAS[3][1]), ORDEN, 'el super admin las ve las cuatro');
});

test('2. el «More» del teléfono: el mismo orden, sin AI Avatar ni Lead Magnet', () => {
  for (const capa of ['completo', 'agencia'] as const) {
    const create = masCompleto('admin', capa, false).find((g) => g.id === 'create');
    assert.ok(create, `${capa}: More tiene Create`);
    const filas = create.filas.map((f) => f.label);
    assert.ok(!filas.includes('AI Avatar'), `${capa}: AI Avatar en More`);
    assert.ok(!filas.some((l) => /lead magnet/i.test(l)), `${capa}: Lead Magnet en More`);
    assert.deepEqual(filas, ORDEN.filter((l) => filas.includes(l)), `${capa}: el orden es ${ORDEN.join(', ')}`);
  }
});

test('3. MaKo no ofrece AI Avatar como una tab: es parte de Video, y su estudio sigue', () => {
  const nombres = funcionesMako().map((f) => f.nombre);
  assert.ok(!nombres.includes('AI Avatar'), 'MaKo ofrece «AI Avatar» como función propia');
  assert.ok(!nombres.some((n) => /lead magnet/i.test(n)), 'MaKo ofrece Lead Magnet');
  assert.equal(funcionDeKey('ai-avatar')?.nombre, 'Video');
  assert.match(funcionDeKey('ai-avatar')!.hace.join(' '), /Tu personaje con IA/, 'lo que hacía AI Avatar, dicho dentro de Video');
  // La ruta del estudio NO redirige a Video: la tarjeta «Tu personaje con IA» de Video la abre (y daría la vuelta).
  const plantillas = readFileSync(new URL('../app/video-editor/plantillas-crear.ts', import.meta.url), 'utf8');
  assert.match(plantillas, /PERSONAJE_CON_IA = \{ escritorio: '\/ai-avatar', movil: '\/m\/ai-avatar' \}/);
  assert.doesNotMatch(readFileSync(new URL('../app/ai-avatar/page.tsx', import.meta.url), 'utf8'), /redirect\([^)]*video-editor/);
});
