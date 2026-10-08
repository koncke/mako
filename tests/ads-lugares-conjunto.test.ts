// =============================================================================
// Ver y cambiar dónde se muestra un conjunto que ya corre (tarea #715): el CABLEADO
// =============================================================================
// Lo que hace la función (leer el crudo, la ida y vuelta, la sólo lectura) lo prueba
// tests/meta-geo.test.ts EJECUTÁNDOLA. Esto fija lo que ningún test de la función ve:
// que las pantallas la usen, que la puerta nueva tenga call site, y que el refresco no
// remonte el detalle. Hasta acá ningún test leía estos tres archivos.
//
// Se lee el fuente con los \r\n normalizados y SIN comentarios: la convención de la
// casa es citar en el comentario lo que se sacó, y un guard de «esto no está» se
// acusaría a sí mismo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const MODAL = sinComentarios(leer('app/ads-manager/EditarPublicoModal.tsx'));
const DETALLE = sinComentarios(leer('app/ads-manager/EntityDetalle.tsx'));
const BROWSER = sinComentarios(leer('app/ads-manager/CampanasBrowser.tsx'));

test('el editor de público guarda los lugares SÓLO por aplicarLugares', () => {
  // El targeting que se manda nace de aplicarLugares sobre el crudo: sin cambios devuelve
  // el geo intacto, y con algo que no entendió tira en vez de borrar.
  assert.match(MODAL, /const t: Record<string, unknown> = \{ \.\.\.aplicarLugares\(base, lectura, lugares\) \};/);
  // Y nadie más escribe el geo a mano: un `t.geo_locations = …` saltearía la firma.
  assert.doesNotMatch(MODAL, /\b(t|targeting)\.(excluded_)?geo_locations\s*=/);
  assert.doesNotMatch(MODAL, /\bdelete t\.(excluded_)?geo_locations/);
  //   ROTO A PROPÓSITO (07/10/2026): `{ ...base }` en vez de aplicarLugares → 1 fallo de 4
  //   (éste); sumar `t.geo_locations = geoSpecDe(lugares).geo_locations;` → 1 fallo (éste).
});

test('con algo que el parser no entiende, el editor NO monta el selector', () => {
  // Sólo lectura: se dibuja la lista, y el selector (que escribe lugares) queda del otro lado.
  const rama = MODAL.match(/\{soloLectura \? \(([\s\S]*?)\) : \(([\s\S]*?)\)\}/);
  assert.ok(rama, 'la rama soloLectura ? (…) : (…) existe');
  assert.match(rama![1], /<LugaresLectura lectura=\{lectura\}/);
  assert.doesNotMatch(rama![1], /<LugarPicker/);
  assert.match(rama![2], /<LugarPicker compacto lugares=\{lugares\} setLugares=\{setLugares\}/);
  // Y el cambio de lugares no cuenta como cambio si es de sólo lectura.
  assert.match(MODAL, /const geoCambio = !!lectura && !soloLectura && lugaresCambiaron\(lectura, lugares\);/);
  //   ROTO A PROPÓSITO: montar <LugarPicker> en las dos ramas → 1 fallo de 4 (éste).
});

test('«Dónde se muestra» tiene su propia lectura, y se relee por versión, sin remontar', () => {
  // El efecto propio, con versionGeo en sus dependencias.
  assert.match(DETALLE, /fetch\(`\/api\/ads-manager\/adset-targeting\?adset_id=\$\{encodeURIComponent\(id\)\}`/);
  assert.match(DETALLE, /\}, \[id, level, versionGeo\]\);/);
  // Las métricas NO dependen de versionGeo: guardar lugares no vuelve a pedirle insights a Meta.
  assert.match(DETALLE, /\}, \[id, desde, hasta\]\);/);
  //   ROTO A PROPÓSITO: `[id, level]` (sin versionGeo) → 1 fallo de 4 (éste): guardar
  //   lugares dejaba el detalle mostrando los viejos.
});

test('la puerta nueva tiene call site, y los dos caminos refrescan lo mismo', () => {
  const det = BROWSER.match(/<EntityDetalle [\s\S]*?\/>/);
  assert.ok(det, 'CampanasBrowser monta EntityDetalle');
  assert.match(det![0], /onCambiarLugar=\{entSel\.level === 'adset' \? \(\) => setEditPublicoAdset\(/);
  assert.match(det![0], /versionGeo=\{versionGeo\}/);
  // Sin `key`: un key con contador remontaría el detalle y perdería la métrica elegida.
  assert.doesNotMatch(det![0], /\bkey=/);
  // El onSaved del editor (el ÚNICO montaje, al que llegan la fila y el detalle) sube la versión.
  const ed = BROWSER.match(/<EditarPublicoModal [\s\S]*?\/>\}/);
  assert.ok(ed, 'CampanasBrowser monta EditarPublicoModal');
  assert.match(ed![0], /onSaved=\{\(\) => \{[^}]*setVersionGeo\(\(v\) => v \+ 1\)/);
  assert.equal((BROWSER.match(/<EditarPublicoModal /g) ?? []).length, 1);
  //   ROTO A PROPÓSITO: sin `onCambiarLugar=` en el montaje → 1 fallo de 4 (éste: la prop
  //   quedaba con cero call sites y el botón no se dibujaba nunca); sin `setVersionGeo` en
  //   el onSaved → 1 fallo (éste); con `key={versionGeo}` en el detalle → 1 fallo (éste).
});
