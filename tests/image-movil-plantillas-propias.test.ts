// =============================================================================
// «Tus plantillas» y «De la comunidad» de Image también en el teléfono (18/11/2026, F17)
// =============================================================================
// docs/pendientes-verificados-17-11.md F17: la hoja «¿Qué vas a crear hoy?» del teléfono (app/m/image-editor/InicioImagenM.tsx)
// sólo tenía las plantillas de MaKo; la computadora suma las del negocio y las de la comunidad (usePlantillasPropias). Ahora el
// teléfono usa el MISMO hook con el MISMO tipo, primero, y se parte en las MISMAS secciones que escritorio (`seccionesDeCrear`).
// Correr: node --import tsx --test tests/image-movil-plantillas-propias.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0):
//   · el teléfono sin las propias (sólo PLANTILLAS_NUEVO_DISENO)            → 1/1 (2)
//   · crear sin preguntarle antes a `propias.usar` (iría a la acción de MaKo) → 1/1 (2)
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seccionesDeCrear } from '../app/_crear/reglas';
import { GRUPO_COMUNIDAD, GRUPO_MIAS, tarjetaDeCreacion } from '../app/creaciones/plantillas-tarjeta';
import { PLANTILLAS_NUEVO_DISENO } from '../app/image-editor/plantillas-crear';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (r: string) => sinComentarios(readFileSync(join(RAIZ, r), 'utf8'));

test('1. las propias van primero, cada una en su sección, y las de MaKo siguen en las secciones de escritorio', () => {
  const c = (id: number, titulo: string, estado = 'privada') => ({ id, titulo, descripcion: '', autor: 'Un negocio de MaKo', estado, estrellas: 3, usos: 0 });
  const propias = [tarjetaDeCreacion(c(7, 'Mi historia de promo'), 'mia'), tarjetaDeCreacion(c(9, 'Carrusel que vende', 'publica'), 'comunidad')];
  const secciones = seccionesDeCrear([...propias, ...PLANTILLAS_NUEVO_DISENO]);
  assert.deepEqual(secciones.slice(0, 2).map((s) => [s.titulo, s.plantillas.map((p) => p.id)]), [
    [GRUPO_MIAS, ['creacion:7']],
    [GRUPO_COMUNIDAD, ['creacion:9']],
  ]);
  // Las de MaKo, en las mismas secciones que «¿Qué vas a crear hoy?» de la computadora (sin las propias, igual que antes).
  assert.deepEqual(secciones.slice(2), seccionesDeCrear(PLANTILLAS_NUEVO_DISENO));
  // Sin propias (la tabla no está, o no es admin), la hoja es la de siempre.
  assert.deepEqual(seccionesDeCrear([...[], ...PLANTILLAS_NUEVO_DISENO]).map((s) => s.titulo), seccionesDeCrear(PLANTILLAS_NUEVO_DISENO).map((s) => s.titulo));
});

test('2. el teléfono usa el mismo hook y el mismo tipo que la computadora, y la propia se crea por su enchufe', () => {
  const telefono = leer('app/m/image-editor/InicioImagenM.tsx');
  const escritorio = leer('app/image-editor/ImageEditorCliente.tsx');
  const tipo = /usePlantillasPropias\('([a-z_]+)'\)/;
  assert.equal(telefono.match(tipo)?.[1], escritorio.match(tipo)?.[1], 'el mismo tipo de creación');
  assert.match(telefono, /seccionesDeCrear\(\[\.\.\.propias\.plantillas, \.\.\.PLANTILLAS_NUEVO_DISENO\]\)/);
  const crear = telefono.slice(telefono.indexOf('const crear = async'), telefono.indexOf('const borrar = async'));
  assert.ok(crear.length > 100, 'no encontré `crear`');
  assert.ok(crear.indexOf('await propias.usar(p)') >= 0 && crear.indexOf('await propias.usar(p)') < crear.indexOf('await crearDisenoNuevoAction(p.id)'),
    'primero se pregunta si es una propia (la crea su enchufe); si no, la acción de MaKo');
  assert.match(telefono, /\{sec\.titulo \?\? 'Plantillas'\}/, 'el título de cada sección, como escritorio');
});
