// =============================================================================
// Lo que pesa la portada de Web Generator (13/11/2026)
// =============================================================================
// Medido en producción: /web-generator eran 887 KB de página, y las 52 tarjetas de outliers sólo 29 KB. El resto: la hoja del
// contenido de las landings (CSS_CONTENIDO, ~170 KB) DOS veces (en el HTML y en los datos de React) para dibujar las miniaturas de
// las plantillas, y la primera sección de cada una de las 56 landings del negocio (en una importada, el HTML de la página
// original) para una lista que sólo usa id, título y fecha. Ahora la lista recibe sólo eso (`paraLaLista`) y la hoja la pone la
// fila de plantillas recién cuando dibuja sus miniaturas (después de montar): viaja en el código, que el navegador guarda.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paraLaLista } from '../app/web-generator/portada-reglas';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('de cada landing viaja sólo lo de la lista, no su primera sección', () => {
  const doc = {
    id: 118, titulo: 'Adaptada de clase.highticketclarity.com', tema: 'ws:copia', creado: '2026-11-13T18:45:59Z', actualizado: '2026-11-13T18:45:59Z',
    creadoPor: 'Martin', favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, dominio: null,
    primera: { type: 'tarjeta', content: [{ type: 'html', attrs: { html: '<div id="root">' + 'x'.repeat(60_000) + '</div>' } }] },
  };
  assert.deepEqual(paraLaLista([doc as never]), [{ id: 118, titulo: 'Adaptada de clase.highticketclarity.com', actualizado: '2026-11-13T18:45:59Z', papelera: false }]);
});

test('la portada no mete la hoja del contenido en la página: la pone la fila de plantillas al dibujar sus miniaturas', () => {
  const pag = leer('app/web-generator/page.tsx');
  const portada = pag.slice(pag.indexOf('if (esPanelPelado(sp)) {'), pag.indexOf('const [rLista, rTemas, rAnalizadas]'));
  assert.ok(portada.length > 100, 'encontré la rama de la portada');
  assert.doesNotMatch(portada, /__html: CSS_CONTENIDO/, 'la hoja no va en el HTML ni en los datos de cada visita');
  assert.match(portada, /docs=\{rDocs\.ok \? paraLaLista\(rDocs\.docs\) : \[\]\}/);
  const pl = leer('app/web-generator/PlantillasPortada.tsx');
  assert.match(pl, /\{muestras \? <style href="gm-contenido" precedence="medium">\{CSS_CONTENIDO\}<\/style> : null\}/,
    'con la misma href que el editor (React la pone una vez), y sólo cuando hay miniaturas que la usan');
  assert.match(leer('app/web-generator/PortadaWeb.tsx'), /docs: readonly LandingEnLista\[\]/);
});
