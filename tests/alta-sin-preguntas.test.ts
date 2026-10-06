// =============================================================================
// Cargar tareas no pregunta NADA — en ninguna de las puertas
// =============================================================================
// El 05/10/2026, al cargar las tareas de una reunión de Fathom, el modal se convirtió en
// un wizard: «¿Para cuándo tiene que estar resuelto…?» con un calendario y cuatro atajos.
// Martín: «habíamos dicho de sacar absolutamente toda la fricción al agregar tareas y me
// salta esto luego de intentar agregar tareas del fathom».
//
// No era UNA pantalla: era un patrón con tres caras y cuatro productores, y la regla de la
// casa es sacarlo de todos en la misma pasada (AGENTS.md, «Sacar un patrón es ENUMERAR
// dónde está»). Cada guard de acá cuida una puerta:
//
//  · el modal de las reuniones (Fathom): «Agregar N al plan» carga derecho;
//  · el wizard de /plan/revisar (WhatsApp, Claude, proyecto vacío): sólo cierres y confirmar;
//  · el borrador nace sin preguntas aunque un productor viejo las mande (`notas: []`);
//  · la ruta ya no las genera, y la API de MaKo ya no las ofrece ni las acepta.
//
// ⚠️ Los guards leen el código SIN COMENTARIOS: la convención es explicar en el
// comentario lo que se sacó, y un `doesNotMatch` sobre el archivo entero se acusaría a sí
// mismo por esa prosa.
//
// PROBADOS ROMPIÉNDOLOS (05/10/2026), cada rotura con el bug real y cada una cazada por
// exactamente el guard que le toca (resultado de la suite en cada caso: 7 pass / 1 fail):
//   1. el botón del modal volviendo a llamar `irAPreguntas()` en vez de `aplicar()`.
//   2. `import { WizardShell }` devuelto al modal.
//   3. el paso `{ kind: 'q' … }` devuelto al Step de /plan/revisar.
//   4. `notas: preguntas` en el insert de `crearPropuesta`.
//   5. la acción `'preguntar'` devuelta a la ruta.
//   6. el parámetro `preguntas` devuelto a `proponer_tareas_plan` en el registro.
//   7. el campo `preguntas:` devuelto al esquema de la tool de WhatsApp.
//   8. `preguntasDeContexto` llamada de nuevo desde el cron de reuniones.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFS } from '../lib/api-mako/areas/plan.def';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, '')   // y los bloques después
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const MODAL = sinComentarios(leer('app/plan/board/TareasRecibidasModal.tsx'));
const REVISAR = sinComentarios(leer('app/plan/revisar/[id]/RevisarPropuesta.tsx'));
const PROPUESTA = sinComentarios(leer('lib/plan-propuesta.ts'));
const RUTA = sinComentarios(leer('app/api/plan-propuesta/route.ts'));
const DOER = sinComentarios(leer('lib/mako-doer-acciones.ts'));
const CRON = sinComentarios(leer('lib/reunion-auto.ts'));

test('el modal de reuniones carga DERECHO: el botón de agregar llama a aplicar()', () => {
  // El bloque es el botón que dice «Agregar N al plan», desde su apertura hasta su cierre.
  const fin = MODAL.indexOf('al plan →`');
  assert.ok(fin > 0, 'no encontré el rótulo «Agregar N al plan»');
  const ini = MODAL.lastIndexOf('<button', fin);
  const boton = MODAL.slice(ini, fin);
  assert.ok(boton.length < 1500, `el recorte del botón mide ${boton.length}: está mirando otra cosa`);
  assert.match(boton, /onClick=\{\(\) => void aplicar\(\)\}/, 'el botón de agregar tiene que cargar, no abrir un paso previo');
});

test('el modal de reuniones no tiene con qué dibujar un paso de preguntas', () => {
  assert.doesNotMatch(MODAL, /import \{[^}]*\bWizardShell\b/, 'WizardShell volvió al modal');
  assert.doesNotMatch(MODAL, /\bPreguntaCampo\b/, 'PreguntaCampo volvió al modal');
  assert.doesNotMatch(MODAL, /action: 'preguntar'/, 'el modal volvió a pedir preguntas');
});

test('/plan/revisar sólo tiene cierres y confirmar', () => {
  // Hasta el FIN DE LÍNEA: el tipo tiene `;` adentro de sus llaves.
  const m = REVISAR.match(/type Step = (.+);$/m);
  assert.ok(m, 'no encontré el tipo Step');
  const kinds = [...m[1].matchAll(/kind: '([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(kinds, ['cerrar', 'confirm']);
  assert.doesNotMatch(REVISAR, /\bPreguntaCampo\b/, 'PreguntaCampo volvió al wizard');
  assert.doesNotMatch(REVISAR, /action: '(profundizar|tareas-extra|acta)'/, 'el wizard volvió a pedir preguntas');
});

test('el borrador nace SIN preguntas, las mande quien las mande', () => {
  const ini = PROPUESTA.indexOf('export async function crearPropuesta(');
  const fin = PROPUESTA.indexOf('\nfunction rowToPropuesta(', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré crearPropuesta');
  const cuerpo = PROPUESTA.slice(ini, fin);
  assert.ok(cuerpo.length < 6000, `el recorte de crearPropuesta mide ${cuerpo.length}: está mirando otra cosa`);
  assert.match(cuerpo, /\bnotas: \[\]/, 'el insert tiene que escribir `notas: []`');
  assert.doesNotMatch(cuerpo, /draft\.preguntas/, 'crearPropuesta volvió a leer las preguntas del draft');
});

test('la ruta del borrador ya no genera preguntas', () => {
  assert.doesNotMatch(RUTA, /action === '(preguntar|profundizar|tareas-extra|acta)'/);
});

test('la API de MaKo ni ofrece ni acepta preguntas al proponer tareas', () => {
  const ops = DEFS.map((d) => d.id);
  assert.ok(!ops.includes('sugerir_preguntas_tareas'), 'volvió la op que generaba preguntas');
  const proponer = DEFS.find((d) => d.id === 'proponer_tareas_plan');
  assert.ok(proponer, 'no encontré proponer_tareas_plan');
  const params = (proponer.parametros ?? []).map((p) => p.nombre);
  assert.ok(!params.includes('preguntas'), 'proponer_tareas_plan volvió a aceptar `preguntas`');
});

test('la tool de WhatsApp no le pide preguntas al modelo', () => {
  const ini = DOER.indexOf("name: 'proponer_tareas_plan'");
  const fin = DOER.indexOf('\n  {\n    name: ', ini + 1);
  assert.ok(ini > 0 && fin > ini, 'no encontré la tool proponer_tareas_plan');
  const tool = DOER.slice(ini, fin);
  assert.ok(tool.length < 12000, `el recorte de la tool mide ${tool.length}: está mirando otra cosa`);
  assert.doesNotMatch(tool, /\n\s+preguntas: \{/, 'el esquema de la tool volvió a tener `preguntas`');
});

test('el cron de reuniones no arma preguntas al leer una reunión', () => {
  assert.doesNotMatch(CRON, /preguntasDeContexto\(/);
});
