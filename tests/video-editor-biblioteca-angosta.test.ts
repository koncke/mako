// =============================================================================
// La biblioteca angosta no se corre de lado (10/11/2026)
// =============================================================================
// Medido en producción el 10/11/2026 (1440 px, con el chat de MaKo a la izquierda): el panel de Multimedia mide 203 px y su
// barra (Importar + «Todos», ordenar y vista) 247. Desbordaba 32 px y, al tocar el «+» de una miniatura, la caja con
// `overflow: hidden` se corría para mostrar el botón: se leía «a-clip4.mp4» y «) Importar» hasta recargar. Fija:
//   · la barra baja lo de la derecha a otro renglón cuando no entra (`flex-wrap`);
//   · la caja de la sección recorta con `overflow-clip`, que no se puede correr (con `hidden`, el foco la corre).
//
// PROBADO ROMPIÉNDOLO (10/11/2026): sin `flex-wrap` → rojo; con `overflow-hidden` de vuelta → rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

test('la barra de Multimedia baja de renglón y la sección no se puede correr de lado', () => {
  const vista = leer('app/video-editor/_opencut/components/editor/panels/assets/views/assets.tsx');
  assert.match(vista, /<div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pt-3 pb-2">/);
  const panel = leer('app/video-editor/_opencut/components/editor/panels/assets/index.tsx');
  assert.match(panel, /<div className="min-w-0 flex-1 overflow-clip" role="tabpanel">/);
  assert.doesNotMatch(panel, /overflow-hidden" role="tabpanel"/);
});
