// =============================================================================
// «anuncio-de-origen» fuera de las plantillas, y una ficha guardada que lo nombra sigue cargando (18/11/2026)
// =============================================================================
// docs/feedback-diseno-pendiente.md (CRM, fila del 05/10, re-medida el 18/11/2026): «queda "anuncio-de-origen" en las
// plantillas de llamada (lib/ficha/plantillas.ts:54, :107, :118, :151) sin componente en registro-tracking.tsx, así que no
// se dibuja». No hay una pieza que dibuje lo que dice el video del anuncio (sale de `ad_transcripts`, que la ficha no lee):
// el bloque sale de las cinco plantillas que lo ponían y vuelve con su componente. Se queda en el CATÁLOGO, para que una
// ficha que alguien ya guardó con él no pierda nada al cargar: el bloque se saltea, lo demás de la tab se dibuja igual.
//
// Lo puro se EJECUTA: las listas de las plantillas, `fichaEfectiva` y `sanearFicha` (lib/ficha/config.ts) y
// `bloquesDeLaGrilla` / `ofrecerEnAgregar` (app/crm/lead-view/ficha/armar.ts) con las reglas de verdad (`reglasDe`).
//
// Correr: node --import tsx --test tests/ficha-anuncio-de-origen.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026, base 2/0), cada rotura restaurada antes de la siguiente:
//   · devolverle «anuncio-de-origen» a TRACKING_LLAMADA (lib/ficha/plantillas.ts)        → 1 / 1 («ninguna plantilla»)
//   · sacar «anuncio-de-origen» del catálogo (la ficha guardada lo pierde al sanear)    → 1 / 1 («una ficha guardada»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLA_RESPALDO, PLANTILLAS_FICHA, listaDePlantilla } from '../lib/ficha/plantillas';
import { bloqueDef, TABS_FICHA } from '../lib/ficha/catalogo';
import { RESPALDO_VACIO, fichaEfectiva, sanearFicha } from '../lib/ficha/config';
import { bloquesDeLaGrilla, ofrecerEnAgregar } from '../app/crm/lead-view/ficha/armar';
import { reglasDe } from '../app/crm/lead-view/ficha/reglas';

const ID = 'anuncio-de-origen';

test('ninguna plantilla pone «anuncio-de-origen» mientras no tenga componente', () => {
  assert.equal(reglasDe(ID), undefined, 'si ya tiene componente, este test quedó viejo: el bloque vuelve a las plantillas');
  const conEl = [PLANTILLA_RESPALDO, ...PLANTILLAS_FICHA].flatMap((p) => TABS_FICHA
    .filter((t) => listaDePlantilla(p, t).includes(ID)).map((t) => `${p.id} · ${t}`));
  assert.deepEqual(conEl, [], 'una plantilla pone un bloque que la ficha saltea callada');
  // Las de tracking que lo tenían conservan su orden, sin él.
  assert.deepEqual([...listaDePlantilla(PLANTILLAS_FICHA.find((p) => p.id === 'dos-reuniones')!, 'tracking')], ['visitas', 'actividad-en-pagina', 'grabacion-de-visita']);
  assert.deepEqual([...listaDePlantilla(PLANTILLAS_FICHA.find((p) => p.id === 'carrito')!, 'tracking')], ['video-visto', 'actividad-en-pagina', 'grabacion-de-visita', 'visitas']);
});

test('una ficha guardada con «anuncio-de-origen» sigue cargando: se saltea y lo demás se dibuja', () => {
  assert.ok(bloqueDef(ID), 'sigue en el catálogo: sin él, sanear la ficha guardada lo tiraría');
  // Como la guardó un admin antes del 18/11 (la lista de la plantilla de llamada, tocada a mano).
  const cruda = { tabs: { tracking: [{ id: 'visitas', ancho: 4, diseno: 'numeros' }, { id: ID, ancho: 12, diseno: 'lineas' }, { id: 'actividad-en-pagina', ancho: 12, diseno: 'tiempo' }] } };
  const guardada = sanearFicha(cruda);
  assert.deepEqual((guardada.tabs?.tracking ?? []).map((b) => b.id), ['visitas', ID, 'actividad-en-pagina'], 'sanear no la rompe ni la reescribe');
  const efectiva = fichaEfectiva('dos-reuniones', guardada, RESPALDO_VACIO);
  const lista = efectiva.tabs.tracking;
  assert.deepEqual(lista.map((b) => b.id), ['visitas', ID, 'actividad-en-pagina'], 'lo guardado manda sobre la plantilla');
  // Lo que se dibuja: el anuncio se saltea (sin componente) y los otros dos quedan, con su ancho repartido.
  const dibujados = bloquesDeLaGrilla(lista, { reglasDe, vacio: () => false, editando: false, verPrivado: true });
  assert.deepEqual(dibujados.map((b) => b.def.id), ['visitas', 'actividad-en-pagina']);
  // Y personalizando, «Agregar bloque» no lo ofrece: no se puede volver a poner algo que no se dibuja.
  const ofrecidos = ofrecerEnAgregar('tracking', [], { registrado: (id) => !!reglasDe(id), verPrivado: true }).map((d) => d.id);
  assert.equal(ofrecidos.includes(ID), false);
  assert.ok(ofrecidos.includes('visitas'), 'el menú de Tracking sigue ofreciendo los que sí se dibujan');
});
