// =============================================================================
// #880: las plantillas de la ficha arrancan con LO ESENCIAL; lo demás se agrega (17/10/2026)
// =============================================================================
// Martín, en la revisión del 16/10 (33:31): «revisar todos los templates, porque eso dentro un lead creo que es un
// template que está muy grande, entonces los templates tienen que ser como más simples». Las del Resumen traían de 12
// a 18 bloques; la regla que las inflaba exigía la lista ENTERA de su tipo cuando su motivo eran sólo los avisos.
// Lo que se fija, EJECUTANDO las plantillas de entrada de los nueve tipos:
//   1. ningún Resumen de entrada trae los bloques que ya tienen su tab o se agregan: el video visto (Tracking) y los
//      cambios de MaKo (las automatizaciones VUELVEN el 23/10/2026: ver abajo);
//   2. la charla de WhatsApp (ancho completo y con su raya aunque no haya charla) sólo entra donde ES la pregunta;
//   3. un techo: 15 bloques, y 8 que se dibujan aunque no haya datos;
//   4. «Antes de la llamada» (la de los funnels con reunión, casi todos) sin lo cobrado ni el origen.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · la charla de WhatsApp de vuelta en «Antes de la llamada»                   → 2 / 2
//   · el video visto de vuelta en «Lo que contestó»                              → 3 / 1
//   · lo cobrado de vuelta en «Antes de la llamada»                              → 3 / 1
// ⚠️ 23/10/2026: «Automatizaciones» vuelve a las de entrada. Martín: «crear un bloque dentro del detail de cada lead que
//    esté relacionado a las automatizaciones... para tener más claridad de lo que pasa». No agranda la ficha: se calla si
//    el lead no está ni estuvo en ninguna, así que no cuenta para el techo (que mide lo que se ve). Lo que sí se fija:
//    va en todas las sugeridas, arriba (después de los duplicados), y no en la épica ni en «Para llamarlo».
//    Probado rompiéndolo: sacarlo de «La charla» → 4 / 1; contarlo en el techo → 4 / 1.
// Correr: node --import tsx --test tests/ficha-plantillas-simples.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plantillaTabDeEntrada } from '../lib/ficha/plantillas-tab';
import { IDS_PLANTILLA } from '../lib/ficha/plantillas';
import { BLOQUES } from '../lib/ficha/catalogo';

const entradas = IDS_PLANTILLA.map((tipo) => ({ tipo, p: plantillaTabDeEntrada('resumen', tipo) }));
const ids = (p: { bloques: ReadonlyArray<{ id: string }> }) => p.bloques.map((b) => b.id);

test('ningún Resumen de entrada trae lo que ya tiene su tab o se agrega', () => {
  for (const { tipo, p } of entradas) {
    for (const pesado of ['video-visto', 'cambios-de-mako']) {
      assert.ok(!ids(p).includes(pesado), `«${tipo}» (${p.id}) volvió a traer «${pesado}»`);
    }
  }
});

test('la charla de WhatsApp sólo entra donde ES la pregunta', () => {
  for (const { tipo, p } of entradas) {
    if (tipo === 'te-escriben') { assert.ok(ids(p).includes('charla-whatsapp')); continue; }
    assert.ok(!ids(p).includes('charla-whatsapp'), `«${tipo}» (${p.id}) volvió a traer la charla de WhatsApp`);
  }
});

test('«Automatizaciones» en todas las de entrada, arriba: dice lo que pasa y se calla si no hay nada (23/10/2026)', () => {
  for (const { tipo, p } of entradas) {
    const i = ids(p).indexOf('automatizaciones-en-curso');
    assert.ok(i >= 0, `«${tipo}» (${p.id}) sin «Automatizaciones»`);
    assert.ok(i <= 3, `«${tipo}» (${p.id}): «Automatizaciones» quedó abajo (lugar ${i + 1})`);
  }
  assert.equal(BLOQUES.find((d) => d.id === 'automatizaciones-en-curso')!.sinDatos, 'se-calla', 'si no se calla, agranda la ficha de todos');
});

test('un techo: 15 bloques, y 8 que se dibujan sin datos', () => {
  for (const { tipo, p } of entradas) {
    // «Automatizaciones» no cuenta: se calla sin automatizaciones (arriba).
    const visibles = p.bloques.filter((b) => b.id !== 'automatizaciones-en-curso');
    assert.ok(visibles.length <= 15, `«${tipo}» (${p.id}) trae ${visibles.length} bloques`);
    const conRaya = p.bloques.filter((b) => BLOQUES.find((d) => d.id === b.id)!.sinDatos === 'raya');
    assert.ok(conRaya.length <= 8, `«${tipo}» (${p.id}) dibuja ${conRaya.length} bloques sin datos`);
  }
});

test('«Antes de la llamada», la de los funnels con reunión: sin lo cobrado ni el origen', () => {
  const llamada = plantillaTabDeEntrada('resumen', 'dos-reuniones');
  assert.equal(llamada.id, 'resumen-llamada');
  assert.equal(plantillaTabDeEntrada('resumen', 'una-llamada').id, 'resumen-llamada');
  for (const fuera of ['cobrado', 'origen']) assert.ok(!ids(llamada).includes(fuera), `«Antes de la llamada» volvió a traer «${fuera}»`);
  for (const dentro of ['calificacion', 'proxima-reunion', 'setter-y-closer', 'contacto', 'lo-que-contesto', 'notas']) {
    assert.ok(ids(llamada).includes(dentro), `«Antes de la llamada» perdió «${dentro}», que es lo esencial`);
  }
});
