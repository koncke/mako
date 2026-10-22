// =============================================================================
// Second Brain: sin «falta» en la barra lateral, y «Girar la pantalla» en la fila del zoom (22/10/2026)
// =============================================================================
// Martín, desde el Centro (pedido 4a15e2c3, con capturas del teléfono): «no quiero ningún item de "falta" en la sidebar...
// simplemente si no lo tiene ese dato, que no lo muestre», y «El botón de "girar la pantalla" podría estar abajo a la
// derecha, alineado». (Lo tercero que pidió, sin la portada «Abrir el grafo», está en tests/second-brain-grafo-movil.test.ts.)
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-sb.mjs en el scratchpad de la sesión). Los números, al
// lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carpetasConDatos } from '../lib/cerebro-areas';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TAX = {
  carpetas: [{ id: 'oferta', nombre: 'Oferta' }, { id: 'mercado', nombre: 'Mercado' }, { id: 'mensaje', nombre: 'Mensaje' }],
  areas: [
    { id: 'oferta', padre: 'oferta', nombre: 'La oferta' }, { id: 'productos', padre: 'oferta', nombre: 'Productos' },
    { id: 'leadmagnet', padre: 'oferta', nombre: 'Lead Magnet' },
    { id: 'avatar', padre: 'mercado', nombre: 'Cliente ideal' }, { id: 'avatares', padre: 'mercado', nombre: 'Avatares' },
    { id: 'razones', padre: 'mensaje', nombre: 'Razones' },
  ],
};

// rotura (las áreas sin datos vuelven): 1 fallo. rotura (una carpeta vacía deja su título): 1 fallo.
test('la barra lateral: sólo las áreas con algún dato, y una carpeta que se queda sin ninguna no aparece', () => {
  // Lo de las capturas de Martín: La oferta 1, Productos 1, y lo demás sin datos.
  const nav = carpetasConDatos(TAX, { oferta: 1, productos: 1 });
  assert.deepEqual(nav.map((x) => x.carpeta.id), ['oferta']);
  assert.deepEqual(nav[0].suyas.map((a) => a.nombre), ['La oferta', 'Productos']);
  assert.deepEqual(carpetasConDatos(TAX, {}), [], 'un negocio sin datos: ninguna carpeta');
  assert.deepEqual(carpetasConDatos(TAX, { razones: 2 }).map((x) => x.carpeta.id), ['mensaje']);
});

// rotura (el grafo vuelve a recorrer todas las carpetas): 1 fallo. rotura (vuelve el «falta»): 1 fallo.
// rotura (vuelve el «· N faltan» del resumen): 1 fallo.
test('el grafo dibuja la barra con `carpetasConDatos`, sin la palabra «falta» y sin el «· N faltan» del resumen', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  const nav = g.slice(g.indexOf('aria-label="Tu negocio"'));
  assert.match(g, /const carpetasDelNav = useMemo\(\(\) => carpetasConDatos\(tax, porArea\), \[tax, porArea\]\);/);
  assert.match(nav, /\{carpetasDelNav\.map\(\(\{ carpeta: c, suyas \}\) => \{/);
  assert.doesNotMatch(nav, /tax\.carpetas\.map/);
  assert.doesNotMatch(nav, /'falta'|faltan/, 'ni un «falta» en la barra lateral');
  assert.doesNotMatch(g, /data-falta/);
});

// rotura (el título de la capa, en su primera carpeta aunque no se vea): 1 fallo.
test('el título de una capa (el mapa del super admin) va en su primera carpeta QUE SE VE', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(g, /tax\.capas\?\.find\(\(k\) => k\.carpetas\.find\(\(id\) => carpetasDelNav\.some\(\(x\) => x\.carpeta\.id === id\)\) === c\.id\)/);
});

// rotura (girar vuelve a flotar arriba del zoom): 1 fallo. rotura (girar antes que el zoom: a la izquierda): 1 fallo.
// rotura (sin igualar el alto): 1 fallo.
test('«Girar la pantalla»: abajo a la DERECHA, en la fila del zoom y con su alto', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  const pie = g.slice(g.indexOf('<div className="cbg-pie">'), g.indexOf('<div className="cbg-pie">') + 2_500);
  assert.ok(pie.indexOf('className="cbg-zoom"') >= 0 && pie.indexOf('className="cbg-girar"') > pie.indexOf('className="cbg-zoom"'), 'el zoom primero (izquierda), girar después (derecha)');
  assert.match(g, /\.cbg \.cbg-pie \{\s*position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 3;\s*display: flex; align-items: stretch;/, 'la misma fila, el mismo alto');
  assert.match(g, /\.cbg \.cbg-girar \{\s*margin-left: auto;/, 'a la derecha');
  assert.doesNotMatch(g, /\.cbg \.cbg-girar \{[^}]*position: absolute/, 'ya no flota');
  assert.match(pie, /aria-label="Girar la pantalla"/, 'el nombre, también cuando el texto no entra');
});
