// El marco del lienzo de un aviso (`TemplateDetalleModal`, el de /mensajes) con lo de la sexta tanda, como una
// automatización. La verificación de los restos (10/10/2026) lo encontró con lo de antes:
//   · «Activar» al lado del título. Martín, General 8: «Activar pasa a estar al lado de "Publicar"».
//   · «Eliminar» como un texto rojo. General 9: el tacho rojo de la casa, «en TODOS lados».
//   · el panel de cada tarjeta en 460 px fijos: `muelles` no llegaba desde la lista, así que el
//     `editorDeTarjeta(muelles, …)` de FlujoAviso (y su test) era un camino que nunca corría.
// ⚠️ Desde el 11/10/2026 este lienzo ya no se monta en /automations: «MaKo en WhatsApp» son automatizaciones con
// el lienzo de siempre (docs/diseno-mako-en-whatsapp-unificado.md). Sigue siendo el de /mensajes, y lo de
// abajo vale ahí; se fue lo que fijaba su montaje en la lista (`MensajeMakoLienzo`, borrado).
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

test('un REPORTE dibuja los canales por los que sale de verdad (las preferencias), no los de su plantilla', () => {
  // Revisión del ws9 (10/10/2026): el reporte semanal dibujaba WhatsApp (el default) y no Email, que es por
  // donde sale. La pregunta la contesta `canalesDeMensaje`, la misma de la bandeja de correo.
  // Rotura (10/10/2026): con `canales={plantilla.canales}` de vuelta → 3 / 1.
  assert.match(MODAL, /const canales = canalesDeMensaje\(id \?\? '', plantilla, prefs\);/);
  assert.match(MODAL, /<FlujoAviso[\s\S]*?canales=\{canales\}/);
  assert.doesNotMatch(MODAL, /canales=\{plantilla\.canales\}/, 'volvieron los canales de la plantilla');
});

test('el panel de cada tarjeta recibe `muelles` de quien monta el detalle', () => {
  assert.match(MODAL, /<FlujoAviso[\s\S]*?muelles=\{muelles\}/);
});
