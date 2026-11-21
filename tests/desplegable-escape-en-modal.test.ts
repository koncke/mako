// =============================================================================
// desplegable-escape-en-modal — Escape con un desplegable abierto adentro de un modal cierra SÓLO el desplegable
// =============================================================================
// Visto el 21/11/2026 verificando «Asignar fuentes» en producción (ws 4): en el editor de reglas, con el desplegable de una
// respuesta abierto, Escape cerró el MODAL ENTERO y la regla a medio armar se perdió.
//
// La causa: el Escape del desplegable (`app/components/Dropdown.tsx`) y el del modal de la casa (`app/_ui/Modal.tsx`) vivían
// los dos en `document`, EN CAPTURA. Dos escuchas en el mismo nodo y la misma fase corren en el orden en que se registraron:
// el modal se registra al montarse, el desplegable recién al abrirse, así que el modal cerraba primero y el
// `stopImmediatePropagation` del desplegable llegaba tarde. La captura de `window` corre antes que la de `document`.
//
// Y la otra mitad: con cambios sin guardar, cerrar el modal (✕, Escape, clic afuera) pregunta antes, igual que «Volver».
//
// Roto el 21/11/2026 y restaurado:
//   · el Escape del desplegable otra vez en `document`              → 1 fallo («1: …»)
//   · `onCerrar={onCerrar ?? NADA}` en el modal de fuentes            → 1 fallo («3: …»)
//   · `cerrar` llamando a `onCerrar` sin pasar por `salirSinGuardar`  → 1 fallo («3: …»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const DROPDOWN = leer('app/components/Dropdown.tsx');
const MODAL = leer('app/_ui/Modal.tsx');
const FUENTES = leer('app/crm/FuentesModal.tsx');

test('1: el desplegable abierto se queda con el Escape desde la captura de window', () => {
  assert.match(DROPDOWN, /const onEsc = \(e: KeyboardEvent\) => \{\s*if \(e\.key !== 'Escape'\) return;\s*e\.stopImmediatePropagation\(\);/);
  assert.match(DROPDOWN, /window\.addEventListener\('keydown', onEsc, true\);/,
    'en la captura de document corre DESPUÉS del modal, que se registró antes: el modal se cierra entero');
  assert.match(DROPDOWN, /window\.removeEventListener\('keydown', onEsc, true\);/);
  assert.doesNotMatch(DROPDOWN, /document\.(add|remove)EventListener\('keydown', onEsc/);
});

test('2: el modal de la casa escucha el Escape en la captura de document (lo que el desplegable tiene que adelantar)', () => {
  // Si esto cambia (el modal pasa a `window`), el desplegable vuelve a llegar tarde: revisar el orden de los dos.
  assert.match(MODAL, /document\.addEventListener\('keydown', onKey, true\);/);
});

test('3: cerrar el modal de fuentes con cambios sin guardar pregunta, por cualquier camino', () => {
  const modal = FUENTES.slice(FUENTES.indexOf('<Modal titulo="Asignar fuentes"'));
  assert.match(modal, /^<Modal titulo="Asignar fuentes"[\s\S]{0,300}?onCerrar=\{cerrar\} ancho=\{820\}/, 'la ✕, Escape y el clic afuera pasan por `cerrar`');
  assert.match(FUENTES, /const cerrar = \(\) => salirSinGuardar\(\(\) => \{ setEditando\(null\); onCerrar\?\.\(\); \}\);/);
  assert.match(FUENTES, /const volver = \(\) => salirSinGuardar\(/);
  const salir = FUENTES.slice(FUENTES.indexOf('const salirSinGuardar'), FUENTES.indexOf('const volver'));
  assert.match(salir, /if \(!sucio\) \{ despues\(\); return; \}/);
  assert.match(salir, /setPide\(\{ titulo: '¿Salir sin guardar las reglas\?'/);
});
