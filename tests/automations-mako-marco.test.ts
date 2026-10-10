// El marco de «MaKo en WhatsApp» (el lienzo de un Mensaje de MaKo adentro de /automations) con lo de la sexta
// tanda, como una automatización. La verificación de los restos (10/10/2026) lo encontró con lo de antes:
//   · «Activar» al lado del título. Martín, General 8: «Activar pasa a estar al lado de "Publicar"».
//   · «Eliminar» como un texto rojo. General 9: el tacho rojo de la casa, «en TODOS lados».
//   · el panel de cada tarjeta en 460 px fijos: `muelles` no llegaba desde la lista, así que el
//     `editorDeTarjeta(muelles, …)` de FlujoAviso (y su test) era un camino que nunca corría.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 3 / 0:
//   M1. «Activar» de vuelta en el chrome (al lado del título)        → 2 / 1
//   M2. «Eliminar» como texto de nuevo                               → 2 / 1
//   M3. la lista no le pasa `muelles` al mensaje                     → 2 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const codigo = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const MODAL = codigo('app/agencia/TemplateDetalleModal.tsx');
/** El chrome (lo que flota arriba) y el pie (abajo a la derecha) del lienzo del aviso. */
const chrome = MODAL.slice(MODAL.indexOf('chrome={('), MODAL.indexOf('pie={'));
const pie = MODAL.slice(MODAL.indexOf('pie={'), MODAL.indexOf('\n        />', MODAL.indexOf('pie={')));

test('«Activar» va al lado de «Publicar», no al lado del título', () => {
  assert.ok(chrome.length > 200 && pie.length > 200, 'no encontré el chrome o el pie');
  assert.doesNotMatch(chrome, /onClick=\{toggle\}|>Activar</, '«Activar» volvió al lado del título');
  assert.match(pie, /onClick=\{toggle\}/);
  assert.ok(pie.indexOf('onClick={toggle}') < pie.indexOf('void publicar()'), '«Activar» no va antes de «Publicar»');
  // Y el pie existe aunque el texto no se pueda editar: el interruptor no depende de eso.
  assert.match(MODAL, /pie=\{id \? \(/);
});

test('«Eliminar» es el tacho rojo de la casa', () => {
  assert.match(chrome, /<BotonBorrar onClick=\{\(\) => void eliminar\(\)\}/);
  assert.doesNotMatch(MODAL, />Eliminar</, 'volvió el «Eliminar» de texto');
});

test('el panel de cada tarjeta recibe `muelles` desde la lista, de punta a punta', () => {
  assert.match(codigo('app/automations/SimuladorWhatsApp.tsx'), /<MensajeMakoLienzo key=\{aviso\.id\} plantilla=\{aviso\} insetIzq=\{m\.insets\.izq\} muelles=\{m\}/);
  assert.match(codigo('app/automations/MensajeMakoLienzo.tsx'), /<TemplateDetalleModal[\s\S]*?muelles=\{muelles\}/);
  assert.match(MODAL, /<FlujoAviso[\s\S]*?muelles=\{muelles\}/);
});
