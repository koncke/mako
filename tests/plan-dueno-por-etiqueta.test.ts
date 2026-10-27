// =============================================================================
// Plan: el dueño que sale SÓLO de la etiqueta del hablante viaja marcado y se confirma (27/10/2026)
// =============================================================================
// Fathom cruza quién habla (docs/hallazgos-closing.md → «Fathom puede cruzar quién habla»). El Plan creyó la etiqueta:
// «Comprar el certificado SSL» salió a nombre de Leandro, y era de Martín. Lo que fija este test:
//   1. La regla (lib/tarea-dueno.ts): dueño = quien la etiqueta dice que lo dijo, con dos voces o más → dudoso.
//   2. La marca viaja por TODOS los caminos: la extracción, el reparto del cron, lo que encontró el juez, la lectura en
//      segundo plano, la ruta del modal, el borrador (`limpiarTarea`) y los dos modales al guardar.
//   3. La pantalla lo pregunta, y en la tab de una persona no se manda nada hasta confirmarlo.
// Probado rompiéndolo (27/10/2026): ver el pie.
// Correr: node --import tsx --test tests/plan-dueno-por-etiqueta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { duenoPorLaEtiqueta, hablantesDelTexto } from '../lib/tarea-dueno';
import { repartoDeTarea } from '../lib/reunion-reparto';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const LLAMADA = [
  '[00:01:10] Martin Koncke: Hay que comprar el certificado SSL para el dominio.',
  '[00:01:18] Leandro: Dale.',
  '[00:02:40] Leandro: Yo me encargo de comprar el certificado SSL hoy.',
  '[00:03:05] Martín Koncke: Perfecto.',
].join('\n');

test('cuántas voces tiene una transcripción', () => {
  assert.equal(hablantesDelTexto(LLAMADA), 2, '«Martin» y «Martín» son la misma voz');
  assert.equal(hablantesDelTexto('[00:00:01] Martin: una nota de voz.\n[00:00:09] Martin: sigue.'), 1);
  assert.equal(hablantesDelTexto('Un texto pegado sin renglones de hablante: «Leandro: compra el SSL».'), 0);
  assert.equal(hablantesDelTexto('[123s · 2:03] Ana: hola\n[130s · 2:10] Leila: hola'), 2, 'también el formato con segundos');
});

test('el dueño que sale SÓLO de la etiqueta es dudoso; el que se nombra, no', () => {
  // Leandro «dijo» que se encarga (la etiqueta) y el modelo lo hizo dueño: la única prueba es la etiqueta.
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro', dichoPor: 'Leandro' }, 2), true);
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro Gómez', dichoPor: 'leandro' }, 2), true, 'un nombre que arranca igual es la misma persona');
  // Martín le pidió a Leandro: el dueño sale de lo que se dijo, no de quién habló.
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro', dichoPor: 'Martin Koncke' }, 2), false);
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro', dichoPor: 'Leandro' }, 1), false, 'una sola voz: no hay nada que cruzar');
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro', dichoPor: '' }, 2), false, 'sin «dichoPor» no se afirma nada');
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Otra persona', dichoPor: 'Otra persona' }, 2), false);
  assert.equal(duenoPorLaEtiqueta({ dueño: 'Leandro', dichoPor: 'Leonardo' }, 2), false, 'otro nombre que empieza parecido no es el mismo');
});

test('la marca viaja por todos los caminos hasta el borrador', () => {
  // El reparto (cron y webhook) la copia.
  assert.equal(repartoDeTarea({ dueño: 'Leandro', esDeOtro: true, atribucionDudosa: true }, new Set()).duenoDudoso, true);
  assert.equal(repartoDeTarea({ dueño: 'Leandro', esDeOtro: true }, new Set()).duenoDudoso, undefined);
  // La extracción: con las voces de la reunión ENTERA, y contra el dueño y el «dichoPor» limpios.
  const F = sinComentarios(leer('../lib/plan-fathom.ts'));
  assert.match(F, /const hablantes = hablantesDelTexto\(texto\);/);
  assert.match(F, /atribucionDudosa: d\.atribucionDudosa \|\| duenoPorLaEtiqueta\(\{ dueño: limpio\.dueno, dichoPor: limpio\.dichoPor \}, hablantes\) \|\| undefined,/);
  assert.match(F, /coerceCandidatas\(obj, proyectos, yo, participantes, dicho, control, hablantes\)/);
  // Lo que encontró el juez: su dueño es quien dijo la cita.
  assert.match(sinComentarios(leer('../lib/reunion-auto.ts')), /esDeOtro: mio \? undefined : true,\s*duenoDudoso: true,/);
  assert.match(sinComentarios(leer('../lib/leer-reunion-en-segundo-plano.ts')), /duenoDudoso: t\.atribucionDudosa \|\| undefined,/);
  // El borrador la guarda (y nada más que `true`).
  assert.match(sinComentarios(leer('../lib/plan-propuesta.ts')), /duenoDudoso: o\.duenoDudoso === true \? true : undefined,/);
  // La ruta del modal la lee, y los dos modales la guardan.
  assert.match(sinComentarios(leer('../app/api/plan-fathom/route.ts')), /esDeOtro: !!t\.esDeOtro, dueñoDudoso: t\.duenoDudoso,/);
  assert.match(sinComentarios(leer('../app/plan/board/ReunionExtractModal.tsx')), /esDeOtro: f\.esDeOtro, duenoDudoso: f\.dueñoDudoso,/);
  const R = sinComentarios(leer('../app/plan/board/TareasRecibidasModal.tsx'));
  assert.match(R, /esDeOtro: f\.esDeOtro, duenoDudoso: f\.dueñoDudoso \|\| undefined,/);
  assert.match(R, /esDeOtro: t\.esDeOtro, dueñoDudoso: t\.duenoDudoso,/);
});

test('la pantalla lo pregunta, y a una persona no se le manda nada hasta confirmarlo', () => {
  const T = sinComentarios(leer('../app/plan/board/ReunionTareas.tsx'));
  assert.match(T, /\{f\.dueñoDudoso && <AvisoDuenoDudoso pregunta="¿Es tuya\? La grabación puede cruzar quién habla" confirmar="es mía" onConfirmar=\{\(\) => onFila\(\{ dueñoDudoso: false \}\)\} \/>\}/);
  assert.match(T, /\{f\.dueñoDudoso && <AvisoDuenoDudoso pregunta=\{`¿Es de \$\{nombre\.split\(' '\)\[0\]\}\?/);
  assert.match(T, /onConfirmar=\{\(\) => onFila\(idx, \{ dueñoDudoso: false \}\)\}/);
  assert.match(T, /const sinConfirmar = filas\.filter\(\(f\) => f\.dueñoDudoso\)\.length;\s*const puedeMandar = !!reunion\.recordingId && !sinConfirmar;/);
  assert.match(T, /disabled=\{cargando \|\| !!linkPlan \|\| sinConfirmar > 0\}/, 'tampoco se carga en su plan');
  // Cambiar el dueño también lo resuelve: las tres reasignaciones apagan la marca.
  assert.equal((T.match(/dueñoDudoso: false \}\)/g) ?? []).length >= 5, true, 'confirmar (2) y reasignar (3) apagan la marca');
});

// Probado rompiéndolo (27/10/2026), cada rotura sola y restaurada después — 4/0 de nuevo al final. Todas dieron 1 fallo:
//   · con una sola voz también · INVERTIDA (dudoso cuando NO es quien habló) · «Martín» y «Martin» como dos voces · el
//     reparto pierde la marca · la extracción sin la regla · lo del juez sin marca · el borrador la tira · el modal no la
//     guarda · se manda sin confirmar · reasignar no apaga la marca
