// =============================================================================
// /vsl-generator lleva a las plantillas de VSL del Copywriter, y lo que encuentra ahí cumple el contrato (18/11/2026, F93)
// =============================================================================
// El pendiente F93 pedía un motor propio (lib/vsl-writer.ts, /api/vsl-generator y una tabla de borradores). No se escribió:
// desde el 28-29/10/2026 un VSL se escribe en el Copywriter, con las estructuras de lib/vsl-estructuras.ts, y un segundo
// motor sería una segunda implementación de lo mismo (app/vsl-generator/destino.ts, docs/hallazgos-copywriter.md).
//
// Lo que fija, EJECUTANDO las funciones de verdad:
//   1. quien puede usar el Copywriter va a `/copywriter?nuevo=vsl`, y quien no, se queda en el «Coming soon»;
//   2. ese `nuevo` es un tipo de página que la página del Copywriter reconoce (si no, abre la galería sin ordenar: el link
//      andaría y llevaría a cualquier cosa);
//   3. con ese tipo, la galería tiene al menos una plantilla de VSL a la vista, y cada una sale de lib/vsl-estructuras.ts;
//   4. y cada plantilla de VSL nace con una sección por etiqueta, EXACTA y en orden: es el contrato doble con el parser y con
//      el VSL Analyst (lib/vsl-estructuras.ts, cabecera). Las cinco, también las tres que no salen en la galería (la API
//      las crea por id);
//   5. MaKo reconoce «VSL Generator» y «guion de VSL» como el Copywriter (el nombre que se lee en el menú).
//
// Probado rompiéndolo (base 5/0):
//   · `DESTINO_VSL` con `?nuevo=vsll`                                   → 4/1 (cae el 2);
//   · `destinoDelVslGenerator` devolviendo el destino sin mirar el permiso → 4/1 (cae el 1);
//   · `tituloDeSeccion` escribiendo `seccion: nombreDeSeccion(etiqueta)` → 4/1 (cae el 4);
//   · sin los alias nuevos en lib/funciones-mako.ts                     → 4/1 (cae el 5).
//
// Correr: node --import tsx --test tests/vsl-generator-destino.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESTINO_VSL, TIPO_DEL_VSL, destinoDelVslGenerator } from '../app/vsl-generator/destino';
import { esTipoGuion } from '../lib/copywriter/tipos';
import { plantillaPorId, plantillasDe, plantillasVisibles } from '../lib/copywriter/plantillas';
import { catalogosLite, conVsl } from '../lib/copywriter/catalogos';
import { bloquesDelDoc } from '../lib/copywriter/doc';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { ESTRUCTURAS_VSL_DEFAULT } from '../lib/vsl-estructuras';
import { funcionDeKey } from '../lib/funciones-mako';
import { menciones } from '../lib/cerebro-funciones';

// El catálogo con que corre el Copywriter cuando el super admin no tocó la biblioteca (el mismo de tests/copywriter-plantillas).
const catalogos = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT));
const etiquetasDe = (doc: Parameters<typeof bloquesDelDoc>[0]) =>
  bloquesDelDoc(doc).filter((b) => b.tipo === 'seccion').map((b) => b.seccion);

test('1. quien puede usar el Copywriter va a sus plantillas de VSL; quien no, se queda en el «Coming soon»', () => {
  assert.equal(destinoDelVslGenerator(true), DESTINO_VSL);
  assert.equal(destinoDelVslGenerator(false), null, 'sin el Copywriter no hay a dónde llevarlo');
  assert.ok(DESTINO_VSL.startsWith('/copywriter?'), `el destino es el Copywriter, no ${DESTINO_VSL}`);
});

test('2. el `nuevo` del destino es un tipo que la página del Copywriter reconoce, y es el de VSL', () => {
  // app/copywriter/page.tsx: `const tipoInicial = esTipoGuion(nuevo) ? nuevo : null;` — con otro valor el link abre la
  // galería sin las de VSL primero, sin un error.
  const nuevo = new URL(DESTINO_VSL, 'https://app.local').searchParams.get('nuevo');
  assert.equal(nuevo, TIPO_DEL_VSL);
  assert.ok(esTipoGuion(nuevo), `«${nuevo}» no es un tipo de página del Copywriter`);
});

test('3. con ese tipo, la galería trae plantillas de VSL a la vista, y todas salen de lib/vsl-estructuras.ts', () => {
  const ids = new Set(ESTRUCTURAS_VSL_DEFAULT.map((e) => e.id));
  const deVsl = plantillasVisibles(plantillasDe(catalogos)).filter((p) => p.tipo === TIPO_DEL_VSL);
  assert.ok(deVsl.length >= 1, 'el destino abriría «Nueva» sin ninguna plantilla de VSL');
  for (const p of deVsl) {
    assert.ok(ids.has(p.id), `«${p.id}» es de tipo VSL y no es una estructura de lib/vsl-estructuras.ts`);
    assert.equal(p.grupo, 'VSL', `«${p.id}» no está en el grupo VSL de la galería`);
  }
});

test('4. cada estructura de VSL nace en el Copywriter con una sección por etiqueta, exacta y en orden (el contrato del Analyst)', () => {
  const activas = ESTRUCTURAS_VSL_DEFAULT.filter((e) => e.activo);
  assert.ok(activas.length >= 4, `hay ${activas.length} estructuras activas: el denominador no puede ser cero`);
  for (const e of activas) {
    const p = plantillaPorId(catalogos, e.id);
    assert.ok(p, `«${e.id}» no tiene plantilla: la API no la podría crear por id`);
    assert.equal(p.tipo, TIPO_DEL_VSL, `«${e.id}» no es una página de VSL`);
    assert.deepEqual(etiquetasDe(p.esqueleto()), e.etiquetas, `«${e.id}»: las secciones de la página no son sus etiquetas`);
  }
});

test('5. MaKo reconoce «VSL Generator» y «guion de VSL» como el Copywriter', () => {
  const copy = funcionDeKey('copywriter');
  assert.ok(copy, 'no hay función «copywriter» en lib/funciones-mako.ts');
  assert.ok(menciones(copy, '¿tienes un VSL Generator?') > 0, '«VSL Generator» no nombra al Copywriter');
  assert.ok(menciones(copy, 'escríbeme el guion de VSL de mi oferta') > 0, '«guion de VSL» no nombra al Copywriter');
});
