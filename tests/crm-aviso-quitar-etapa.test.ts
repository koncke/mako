// =============================================================================
// Quitar una etapa con leads: las dos puertas dicen LO MISMO, y es lo que pasa (17/10/2026)
// =============================================================================
// El tablero decía «pasan a la primera etapa del funnel» y el pop-up de etapas «quedan fuera del funnel hasta que los
// muevas»; ninguna era cierta (docs/relevo/crm.md §0-α). El lead no se toca: se dibuja en la etapa que le dan sus datos
// (`mapToCrmLead`, app/crm/crm-map.ts) o en la primera, y la tarjeta dice dónde estaba.
//
// Verificado rompiéndolo (el archivo da 2 / 0): el tablero con su texto de antes → 1 / 1 (el del cableado); el texto
// sin «no se borra» → 1 / 1 (el de la frase).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoAlQuitarEtapa } from '../app/crm/aviso-quitar-etapa';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

test('la frase: no se borran, van a la etapa de sus datos o a la primera, y la tarjeta lo recuerda', () => {
  const tres = avisoAlQuitarEtapa(3);
  assert.match(tres, /^Sus 3 leads no se borran: pasan a la etapa que les dan sus datos/);
  assert.match(tres, /a la primera, y la tarjeta dice dónde estaban\./);
  assert.match(tres, /La nutrición que salía de esta etapa también se va\.$/);
  assert.match(avisoAlQuitarEtapa(1), /^Su lead no se borra: pasa a la etapa que le dan sus datos/);
  assert.match(avisoAlQuitarEtapa(null), /^No se pudo contar cuántos leads tiene\. Los que estén ahí no se borran/);
  assert.doesNotMatch(avisoAlQuitarEtapa(2, { nutricion: true }), /nutrición que salía/, 'una nutrición no tiene nutrición que salga de ella');
  for (const t of [tres, avisoAlQuitarEtapa(null)]) {
    assert.doesNotMatch(t, /fuera del funnel|primera etapa del funnel\./, 'volvió una de las dos frases que no eran ciertas');
  }
});

test('el cableado: el tablero y el pop-up usan la misma frase', () => {
  assert.match(leer('app/crm/CrmBoard.tsx'), /message=\{avisoAlQuitarEtapa\(borrarEtapa\.n\)\}/);
  const modal = leer('app/crm/EtapasModal.tsx');
  assert.match(modal, /cuerpo: avisoAlQuitarEtapa\(n \?\? null\),/);
  assert.match(modal, /cuerpo: avisoAlQuitarEtapa\(n \?\? null, \{ nutricion: true \}\),/);
});
