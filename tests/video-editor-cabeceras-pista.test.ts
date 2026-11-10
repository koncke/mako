// =============================================================================
// Las cabeceras de pista quedan al lado de SU pista al abrir un proyecto (10/11/2026)
// =============================================================================
// Medido en producción el 10/11/2026 (ws9, «1110», tres pistas: subtítulos, efectos y la principal, con la ventana de 674 px
// de alto): al abrir el proyecto, `useInitialScrollBottom` baja las pistas al fondo (scrollTop 51) y las cabeceras, que en
// ese momento medían menos, se quedaban en 7: la cabecera «Subtítulos» al lado de los efectos y la de los efectos al lado
// del video, hasta que alguien movía la rueda. Pasaba en CADA apertura. Fija que la línea de tiempo vuelva a alinearlas
// cada vez que cambia lo que miden (app/video-editor/_opencut/timeline/components/index.tsx).
//
// PROBADO ROMPIÉNDOLO (10/11/2026): sin el `ResizeObserver` → rojo; observando sólo las pistas → rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('app/video-editor/_opencut/timeline/components/index.tsx', 'utf8').replace(/\r\n/g, '\n');

test('la línea de tiempo realinea las cabeceras cuando cambia lo que miden las pistas o las cabeceras', () => {
  assert.match(src, /const observador = new ResizeObserver\(\(\) => syncFollowers\(\)\);/, 'sin realinear al cambiar de tamaño');
  assert.match(src, /for \(const el of \[pistas, etiquetas, pistas\.firstElementChild, etiquetas\.firstElementChild\]\) \{\s*if \(el\) observador\.observe\(el\);/,
    'tienen que mirarse las dos cajas y lo que tienen adentro (las cabeceras son las que crecen tarde)');
  assert.match(src, /return \(\) => observador\.disconnect\(\);\s*\}, \[hayPistas, syncFollowers\]\);/);
  // La sincronización es la de siempre: las cabeceras toman el scroll de las pistas.
  assert.match(src, /trackLabelsScrollRef\.current\.scrollTop = tracks\.scrollTop;/);
});
