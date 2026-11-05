// =============================================================================
// MaKo toma la iniciativa en el Dashboard: la hoja en blanco (5/11/2026, T10 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo del template que se eligió, o de la situación de la persona».
// Lo que se fija:
//   1. la apertura (lib/aperturas/dashboard.ts): con el informe en blanco pregunta un HECHO, «¿Qué número miras primero cada
//      lunes?», a quien puede guardar; cada respuesta apunta a una plantilla que la galería OFRECE hoy; con hojas, calla;
//   2. el montaje: cada respuesta crea la plantilla con `instanciarPlantilla` y la MISMA `crearHoja` de la galería (sin IA), la
//      apertura va a la estrella, sólo en el Dashboard (no en la hoja Focus de General) y calla con la guía hablando.
//
// Correr: node --import tsx --test tests/iniciativa-dashboard.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCIONES_DASHBOARD, ID_PRIMERO, PLANTILLA_DE, aperturaDashboard } from '../lib/aperturas/dashboard';
import { PREGUNTA_DE_ACCION, problemasDeApertura } from '../lib/aperturas/reglas';
import { PLANTILLAS_OFRECIDAS } from '../lib/graficos-plantillas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: en blanco pregunta un hecho, cada respuesta es una plantilla ofrecida; con hojas o sin poder guardar, calla', () => {
  const a = aperturaDashboard({ enBlanco: true, puedeGuardar: true }, {})!;
  assert.equal(a.id, ID_PRIMERO);
  assert.equal(a.texto, '¿Qué número miras primero cada lunes?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.equal(a.corto, undefined, 'sin corto: el centro ya dibuja «¿Qué vas a crear hoy?»');
  const ofrecidas = new Set(PLANTILLAS_OFRECIDAS.map((p) => p.id));
  for (const acc of ACCIONES_DASHBOARD) assert.ok(ofrecidas.has(PLANTILLA_DE[acc]), `${acc}: «${PLANTILLA_DE[acc]}» es una plantilla que la galería ofrece`);
  assert.deepEqual(a.botones.filter((b) => b.tipo === 'hacer').map((b) => (b.tipo === 'hacer' ? b.accion : '')), [...ACCIONES_DASHBOARD]);
  assert.equal(aperturaDashboard({ enBlanco: false, puedeGuardar: true }, {}), null, 'con hojas');
  assert.equal(aperturaDashboard({ enBlanco: true, puedeGuardar: false }, {}), null, 'quien sólo mira no crea hojas');
});

test('2. el montaje: la misma hoja que la galería, sin IA, en la estrella del Dashboard y no en General', () => {
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(ed, /if \(p\) crearHoja\(instanciarPlantilla\(p\)\);/, 'instanciarPlantilla + la crearHoja de la galería (sin la ruta que ajusta con IA)');
  assert.match(ed, /hechos: conEstrella && !esGeneral \? \{ enBlanco, puedeGuardar: guardable \} : null,/);
  assert.match(ed, /libre: !guiaChat\.pregunta && !guiaChat\.senalando && !guiaChat\.esperando,/);
  assert.match(ed, /<MakoEnLaTab tab=\{esGeneral \? 'General' : 'Dashboard'\} apertura=\{aperturaTab\} entidad=/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · «Las llamadas» apunta a una plantilla que no se ofrece        → 1/1 (1)
//   · la apertura también en la hoja Focus de General               → 1/1 (2)
