// =============================================================================
// Las plantillas reales de Image (lib/image-editor/plantillas-reales.ts): la estructura y el ejemplo son la MISMA pieza
// =============================================================================
// Martín, 29/10/2026: «Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"». El plan es
// docs/plantillas-reales/image.md. Lo que fija, ejecutando el módulo:
//   1. las 9 que no son carrusel (las 3 de carrusel viven en lib/carruseles/tipos.ts), con ids únicos que no chocan con los
//      slugs de las de Doory, su tamaño y su número de páginas iguales a los del documento, y su insignia con el tamaño;
//   2. la estructura y el ejemplo tienen las MISMAS capas (nombre, tipo, posición y tamaño), página por página: lo único que
//      cambia es lo que dicen. Si no, «Ver ejemplo» muestra una pieza que no es la que se crea;
//   3. la estructura no dice el ejemplo: ningún texto del negocio ficticio queda en lo que se crea;
//   4. ni fotos de stock ni caras: los marcos de foto son `rect` vacíos con `isPlaceholder`, y nada lleva `src`;
//   5. el ejemplo no nombra gente ni negocios reales, va en «tú» y sin regionalismos (tests/_reales.ts);
//   6. cada documento entra en el tope que acepta el server, con ids nuevos en cada llamada (dos diseños no comparten ids).
//
// Correr: node --import tsx --test tests/image-plantillas-reales.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLAS_IMAGEN } from '../lib/image-editor/plantillas-reales';
import { TOPE_DOC_BYTES, resumirDoc, textosDe } from '../lib/image-editor/reglas';
import { catalogoPlantillas } from '../app/image-editor/mako/plantillas';
import { problemasDelEjemplo, sinAcentos } from './_reales';

type Obj = Record<string, unknown>;
let n = 0;
const id = () => `i${++n}`;
const objetos = (doc: { pages: { objects: unknown[] }[] }, i: number) => doc.pages[i].objects as unknown as Obj[];
/** Lo que define la capa (no lo que dice): nombre, tipo, dónde va y cuánto mide. */
const forma = (o: Obj) => [o.name, o.type, o.left, o.top, o.width, o.type === 'textbox' ? o.fontSize : o.height, o.isPlaceholder ?? false];

test('1: las 9 que no son carrusel, con ids únicos, su tamaño y su insignia', () => {
  assert.equal(PLANTILLAS_IMAGEN.length, 9, 'las 12 del plan menos los 3 carruseles (lista, mito y caso)');
  const ids = PLANTILLAS_IMAGEN.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'dos plantillas con el mismo id');
  const slugs = new Set(catalogoPlantillas().map((p) => p.slug));
  for (const p of PLANTILLAS_IMAGEN) {
    assert.ok(!slugs.has(p.id), `${p.id}: choca con una de Doory (crear_diseno_imagen las busca por el mismo campo)`);
    const doc = p.estructura(id);
    assert.deepEqual(resumirDoc(doc), { ancho: p.ancho, alto: p.alto, paginas: p.paginas }, `${p.id}: el tamaño de la tarjeta`);
    assert.ok(p.insignia.startsWith(`${p.ancho} × ${p.alto}`), `${p.id}: la insignia dice el tamaño`);
    assert.ok(p.cuando.length > 0 && p.cuando.length <= 140, `${p.id}: «cuándo usarla» en una línea`);
    assert.ok(p.pide.length > 0, `${p.id}: qué le pregunta MaKo al negocio`);
  }
});

test('2: la estructura y el ejemplo tienen las mismas capas, página por página', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    const e = p.estructura(id);
    const x = p.ejemplo(id);
    assert.equal(e.pages.length, x.pages.length, `${p.id}: páginas distintas`);
    for (let i = 0; i < e.pages.length; i++) {
      assert.equal(e.pages[i].name, x.pages[i].name, `${p.id} p${i + 1}: el nombre de la página`);
      assert.deepEqual(objetos(e, i).map(forma), objetos(x, i).map(forma), `${p.id} p${i + 1}: las capas no son las mismas`);
    }
  }
});

test('3: la estructura no dice el ejemplo', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    // Sin mayúsculas ni tildes: una etiqueta en mayúsculas («CONSULTA RENTABLE») también lo nombra.
    const guia = sinAcentos(JSON.stringify(textosDe(p.estructura(id))));
    assert.ok(!guia.includes(sinAcentos(p.negocio)), `${p.id}: la estructura nombra al negocio del ejemplo («${p.negocio}»)`);
    const delEjemplo = textosDe(p.ejemplo(id)).flatMap((pg) => pg.textos).filter((t) => t.length >= 12);
    const iguales = delEjemplo.filter((t) => guia.includes(sinAcentos(JSON.stringify(t).slice(1, -1))));
    // Una pieza sin textos largos (la miniatura del número: sólo el gancho) no tiene qué comparar.
    assert.ok(delEjemplo.length === 0 || iguales.length < delEjemplo.length / 2, `${p.id}: la estructura repite el ejemplo: ${iguales.slice(0, 3).join(' · ')}`);
  }
});

test('4: ni fotos ni caras: los marcos de foto van vacíos, y nada lleva `src`', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    for (const doc of [p.estructura(id), p.ejemplo(id)]) {
      const json = JSON.stringify(doc);
      assert.doesNotMatch(json, /"src"\s*:/, `${p.id}: trae una imagen`);
      assert.doesNotMatch(json, /https?:\/\//, `${p.id}: trae un link`);
      for (const pg of doc.pages) {
        for (const o of pg.objects as unknown as Obj[]) {
          if (o.isPlaceholder) assert.equal(o.type, 'rect', `${p.id}: un marco de foto es un rect vacío`);
        }
      }
    }
    if (p.pide.includes('foto')) {
      const marcos = p.estructura(id).pages.flatMap((pg) => (pg.objects as unknown as Obj[]).filter((o) => o.isPlaceholder));
      assert.ok(marcos.length > 0, `${p.id}: pide una foto y no tiene dónde ponerla`);
    }
  }
});

test('5: el ejemplo no nombra gente real, va en tú y sin regionalismos', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    const todo = [p.nombre, p.cuando, p.negocio, JSON.stringify(textosDe(p.ejemplo(id))), JSON.stringify(textosDe(p.estructura(id))),
      ...p.ejemplo(id).pages.map((pg) => pg.notes ?? '')].join('\n');
    assert.deepEqual(problemasDelEjemplo(todo), [], p.id);
  }
});

test('6: cada documento entra en el tope del server, con ids nuevos en cada llamada', () => {
  for (const p of PLANTILLAS_IMAGEN) {
    const a = p.estructura(id);
    const b = p.estructura(id);
    assert.ok(JSON.stringify(a).length < TOPE_DOC_BYTES / 10, `${p.id}: el documento pesa demasiado`);
    const idsA = new Set([...a.pages.map((pg) => pg.id), ...a.pages.flatMap((pg) => (pg.objects as unknown as Obj[]).map((o) => o.id))]);
    const idsB = [...b.pages.map((pg) => pg.id), ...b.pages.flatMap((pg) => (pg.objects as unknown as Obj[]).map((o) => o.id))];
    assert.ok(idsB.every((x) => !idsA.has(x)), `${p.id}: dos diseños comparten ids`);
  }
});

// PROBADO ROMPIÉNDOLO (6/11/2026, base 6/0; de a una y restaurando):
//   · el ejemplo de «miniatura-numero» con el bloque del gancho 10 px más arriba          → 5/1 (2: las capas);
//   · la etiqueta de la guía de «invitacion-clase» con el negocio del ejemplo (va en
//     mayúsculas: con la comparación que distinguía caja, esta rotura daba VERDE)            → 5/1 (3);
//   · un `src` de muestra en el marco de foto de «ficha-propiedad»                          → 5/1 (4);
//   · «Escribime» en la acción del ejemplo de «ultimos-lugares»                             → 5/1 (5).
// Restaurado: 6/0.
