// =============================================================================
// Una plantilla entra AL INSTANTE y MaKo la ajusta a los datos por detrás (#857)
// =============================================================================
// Martín, 16/10/2026 (Revisión de MaKo, 1:08:13): «salta un mensajito de revisando y un timer de cuánto lleva revisando
// y hasta dos minutos dice. Eso no debería ser así porque confunde al usuario». Desde el 17/10 la hoja aparece con la
// plantilla tal cual (cada gráfico con su cargando) y la ajustada llega después y la reemplaza si nadie la tocó.
// Lo que se puede romper sin que se vea: que la ajustada pise lo que la persona cambió en esos segundos, que cerrar el
// modal corte el ajuste (el modal se cierra apenas se crea la hoja), y que vuelva la espera.
//
// Correr: node --import tsx --test tests/dashboard-plantilla-al-instante.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `sigueComoSeCreo` comparando también las posiciones → 3 / 1; la
// plantilla otra vez esperando la ruta antes de crear (`await rellenarPlantilla` antes de `crear`) → 3 / 1; el ajuste
// con la señal del modal (`signal: ctrl.current?.signal`) → 3 / 1; el editor reemplazando sin mirar si la tocaron → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sigueComoSeCreo } from '../lib/graficos-plantilla-relleno';
import { sanearHoja, type Hoja } from '../lib/graficos-catalogo';
import { instanciarPlantilla, plantillaHojaDe } from '../lib/graficos-plantillas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const entre = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); const j = src.indexOf(hasta, i + 1); assert.ok(i >= 0 && j > i, `no encontré ${desde}`); return src.slice(i, j); };

const creada = (): Hoja => sanearHoja(instanciarPlantilla(plantillaHojaDe('ads-analyst')!), 0)!;

test('«sigue como se creó»: moverla no cuenta; cambiarle algo, sí', () => {
  const h = creada();
  assert.ok(h.componentes.length > 3, 'la plantilla no trajo piezas: este test no mira nada');
  assert.equal(sigueComoSeCreo(h, structuredClone(h)), true);
  // La grilla compacta al montar (sin que nadie toque nada): las posiciones cambian solas.
  const movida = { ...h, componentes: h.componentes.map((c, i) => ({ ...c, y: c.y + i, x: 0 })) };
  assert.equal(sigueComoSeCreo(h, movida), true, 'una hoja sólo movida se trató como tocada: el ajuste no llegaría nunca');
  const retitulada = { ...h, nombre: `${h.nombre} mía` };
  assert.equal(sigueComoSeCreo(h, retitulada), false);
  assert.equal(sigueComoSeCreo(h, { ...h, componentes: h.componentes.slice(1) }), false, 'borrar una pieza es tocarla');
  assert.equal(sigueComoSeCreo(h, { ...h, id: 'otra' }), false);
});

test('la plantilla se crea ANTES de pedir el ajuste, sin la espera del «Revisando»', () => {
  const src = sinComentarios(leer('app/dashboard/NuevaHoja.tsx'));
  const armar = entre(src, 'const armarPlantilla = (p: PlantillaHoja) => {', 'const rellenarPlantilla');
  assert.match(armar, /const h = instanciarPlantilla\(p\);\s*crear\(h\);\s*void rellenarPlantilla\(p, h\);/);
  assert.doesNotMatch(armar, /setDesde\(|await /, 'la plantilla volvió a esperar a la ruta (el reloj de «Revisando»)');
});

test('cerrar el modal no corta el ajuste: va con su propio tope, no con la señal del modal', () => {
  const src = sinComentarios(leer('app/dashboard/NuevaHoja.tsx'));
  const rellenar = entre(src, 'const rellenarPlantilla = async', 'const quitarArchivo');
  assert.match(rellenar, /signal: AbortSignal\.timeout\(TOPE_CLIENTE_MS\)/);
  assert.doesNotMatch(rellenar, /ctrl\./, 'el ajuste usa el controlador del modal: cerrarlo (apenas se crea la hoja) lo corta');
  assert.match(rellenar, /props\.current\.onRellenar\?\.\(creada\.id, h,/);
});

test('el editor reemplaza sólo la hoja que nadie tocó, y las dos puertas de «Nueva hoja» le pasan el ajuste', () => {
  const src = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  const rellenar = entre(src, 'const rellenarHoja = useCallback(', '}, [vaciar, show]);');
  const mira = rellenar.indexOf('if (!sigueComoSeCreo(creada, actual)) return;');
  const pone = rellenar.indexOf('setTablero(');
  assert.ok(mira > 0 && pone > mira, 'el editor reemplaza la hoja sin mirar si la persona la cambió');
  assert.match(src, /creadas\.current\.set\(nueva\.id, nueva\);/);
  assert.match(src, /<CrearHoja onCrear=\{crearHoja\} onRellenar=\{rellenarHoja\}/);
  assert.match(src, /<NuevaHoja onCerrar=\{cerrarNuevaHoja\} onCrear=\{crearHoja\} onRellenar=\{rellenarHoja\}/);
});
