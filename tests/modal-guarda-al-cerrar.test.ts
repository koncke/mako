import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Cerrar un `<Modal>` con un clic en el fondo guarda lo que se estaba escribiendo (13/10/2026).
 *
 * Martín: «si edito un nombre, y no le doy "enter" no se guarda el cambio... Siempre debería
 * guardarse automáticamente, si cambio algo, lo que sea, dentro de un lead, el nombre de las etapas
 * o lo que sea, si doy click afuera de ese editable, ya debería guardarse».
 *
 * Medido en producción (ws4, lead 1946): el nombre del lead SÍ guarda al hacer clic afuera, dentro o
 * fuera de la ficha (la ficha cierra en `click`, cuando el foco ya se movió). Lo que se perdía es lo
 * que vive adentro de un `<Modal>`, que cierra en el `mousedown` del fondo: se desmonta ANTES de que
 * el navegador mueva el foco, y un campo que se va del DOM con el foco adentro no dispara su `blur`.
 * Así se perdía el nombre de una etapa en «Editar las etapas» y el de una etiqueta. El arreglo va en
 * el modal de la casa, por donde pasan todos: un campo nuevo lo hereda.
 *
 * Verificado rompiéndolo (base 1/0): sin el `activo.blur()`, 1 fallo; con el `blur` DESPUÉS de
 * `onCerrar()`, 1 fallo.
 */

const SRC = readFileSync(new URL('../app/_ui/Modal.tsx', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '');

test('el fondo del modal saca el foco del campo ANTES de cerrar', () => {
  const ini = SRC.indexOf('onMouseDown={(e) => {');
  assert.ok(ini > 0, 'no encontré el cierre por el fondo');
  const cuerpo = SRC.slice(ini, SRC.indexOf('}}', ini));
  const blur = cuerpo.indexOf('activo.blur()');
  const cierra = cuerpo.indexOf('onCerrar()');
  assert.ok(blur > 0, 'cerrar desmonta el campo sin su blur: lo escrito se pierde');
  assert.ok(cierra > blur, 'el blur tiene que correr antes de cerrar');
  assert.match(cuerpo, /cajaRef\.current\?\.contains\(activo\)/, 'sólo el foco de ESTE modal');
});
