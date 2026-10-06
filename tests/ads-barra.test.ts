// =============================================================================
// La barra de Ads Manager: qué se fue, qué quedó y dónde
// =============================================================================
// Pedido de Martín (05/10/2026), ocho puntos sobre la misma pantalla. Lo que se fija acá
// es lo que NO puede volver —los dos textos que sacó y los «Limpiar selección»— y que las
// acciones estén donde las pidió: crear arriba a la derecha, el resto en el ⋯, y UN filtro
// a la altura de las tabs. Son asserts sobre el fuente: la pantalla no se puede montar en
// node:test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r/g, '');
// Los comentarios de este repo CITAN lo que se sacó, así que un `doesNotMatch` sobre el
// archivo entero se acusa a sí mismo (AGENTS.md).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BROWSER = 'app/ads-manager/CampanasBrowser.tsx';
const VISTA = 'app/ads-manager/AdsManagerView.tsx';

test('los dos textos que Martín sacó no vuelven', () => {
  assert.doesNotMatch(sinComentarios(leer(VISTA)), /Estado \+ rendimiento/);
  assert.doesNotMatch(sinComentarios(leer(BROWSER)), /Estado en vivo de Meta \+ rendimiento del rango/);
  //   ROTO A PROPÓSITO (2026-10-05): devolviendo el kicker de la cabecera, pass 4 / fail 1.
});

test('crear está arriba y el resto vive en el ⋯, sin el desplegable negro de MaKo', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<MenuAcciones/, 'el menú de los tres puntos');
  for (const accion of ['Subir creativos a una campaña', 'Agregar conjunto a una campaña', 'Analizar con Meta', 'Ordenar nombres', 'Actualizar estado']) {
    assert.match(src, new RegExp(accion), `«${accion}» tiene que estar en el menú`);
  }
  assert.doesNotMatch(src, /MakoMenu|MakoWord/, 'el desplegable de MaKo se eliminó');
});

test('un solo filtro, y ningún «Limpiar selección»', () => {
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<FiltrosMenu/);
  // El checkbox de la cabecera selecciona todo y lo suelta: un botón aparte era el segundo.
  assert.doesNotMatch(src, /Limpiar selección|>Limpiar</);
  assert.match(src, /onChange=\{toggleAll\}/, 'el checkbox de seleccionar todo sigue ahí');
  //   ROTO A PROPÓSITO (2026-10-05): devolviendo un botón «Limpiar selección» a la barra,
  //   pass 4 / fail 1. Como COMENTARIO no falla, y está bien: el guard los saca.
});

test('la barra de lote es un interruptor y no dos botones, y ofrece presupuesto y producto', () => {
  const barra = sinComentarios(leer('app/ads-manager/BarraAcciones.tsx'));
  assert.match(barra, /role="switch"/, 'activar/pausar es UN control');
  assert.match(barra, /Cambiar presupuesto diario/);
  assert.match(barra, /Asignar a un producto del CRM/);
  const src = sinComentarios(leer(BROWSER));
  assert.match(src, /<BarraLoteAds/);
  assert.match(src, /bulkPresupuesto/);
  assert.match(src, /bulkProducto/);
});

test('un conjunto sin producto propio dice el de SU campaña, no «sin asignar»', () => {
  // El ruteo ya es así (funnelIdDeCampana: el conjunto gana sólo si tiene uno propio); lo
  // que faltaba era decirlo, porque «Sin asignar» sobre un conjunto que SÍ entra a un
  // producto lleva a asignarlo de nuevo uno por uno.
  assert.match(sinComentarios(leer('app/ads-manager/ProductoCelda.tsx')), /por su campaña/);
  assert.match(sinComentarios(leer(BROWSER)), /heredadoDe=/);
  //   ROTO A PROPÓSITO (2026-10-05): sacando el `heredadoDe` de la celda, pass 4 / fail 1.
});
