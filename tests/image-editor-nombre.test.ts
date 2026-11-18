// =============================================================================
// «Cambiar nombre» de un diseño y «Guardar búsqueda» de los ejemplos, sin `window.prompt` (18/11/2026, F50)
// =============================================================================
// docs/pendientes-verificados-17-11.md F50: los dos usaban el cuadro del navegador. Ahora abren el campo de la casa
// (app/image-editor/NombreModal.tsx) y qué nombre sirve lo decide `nombreValido` (app/image-editor/nombre-reglas.ts).
// Correr: node --import tsx --test tests/image-editor-nombre.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0):
//   · `nombreValido` sin comparar contra el de antes            → 1/1 (1)
//   · un `window.prompt` de vuelta en ExplorarCarruseles.tsx      → 1/1 (2)
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPE_NOMBRE_BUSQUEDA, TOPE_NOMBRE_DISENO, nombreValido } from '../app/image-editor/nombre-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (r: string) => sinComentarios(readFileSync(join(RAIZ, r), 'utf8'));

test('1. qué nombre se guarda: limpio, distinto del de antes y dentro del tope de la base', () => {
  assert.equal(nombreValido('Promo', '  Promo de  verano ', TOPE_NOMBRE_DISENO), 'Promo de verano', 'los espacios de más se juntan, como en el server');
  assert.equal(nombreValido('Promo', '   ', TOPE_NOMBRE_DISENO), null, 'vacío no se guarda');
  assert.equal(nombreValido('Promo', ' Promo ', TOPE_NOMBRE_DISENO), null, 'igual al de antes no es un cambio');
  assert.equal(nombreValido('', 'Carruseles de coaches', TOPE_NOMBRE_BUSQUEDA), 'Carruseles de coaches', 'una búsqueda nueva guarda el nombre sugerido');
  assert.equal(nombreValido('', 'x'.repeat(100), TOPE_NOMBRE_BUSQUEDA)?.length, TOPE_NOMBRE_BUSQUEDA, 'se corta en el tope, como el server');
  assert.equal(TOPE_NOMBRE_DISENO, 200, 'el check de image_disenos.titulo (mig 0278)');
  assert.equal(TOPE_NOMBRE_BUSQUEDA, 60, 'el corte de guardarBusqueda (lib/carruseles/explorar-servidor.ts)');
});

test('2. ningún nombre se pide con el cuadro del navegador: los dos abren el campo de la casa', () => {
  for (const f of ['app/image-editor/ImageEditorCliente.tsx', 'app/image-editor/carruseles/ExplorarCarruseles.tsx']) {
    const src = leer(f);
    assert.doesNotMatch(src, /window\.prompt\(/, `${f}: el cuadro del navegador`);
    assert.match(src, /<NombreModal /, `${f}: el campo de la casa`);
  }
  const cliente = leer('app/image-editor/ImageEditorCliente.tsx');
  assert.match(cliente, /\{ rotulo: 'Cambiar nombre', hacer: \(\) => setRenombrando\(d\) \}/);
  assert.match(cliente, /anterior=\{renombrando\.titulo\}/, 'dejar el mismo nombre no es un cambio');
  const modal = leer('app/image-editor/NombreModal.tsx');
  assert.match(modal, /data-autofocus/, 'el foco entra al campo (adentro de un Modal `autoFocus` no llega)');
  assert.match(modal, /nombreValido\(anterior, nombre, tope\)/);
});
