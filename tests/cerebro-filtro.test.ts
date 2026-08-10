// =============================================================================
// El filtro del segundo cerebro — la regla que decide qué dato EXISTE
// =============================================================================
// Este predicado gobierna dos cosas a la vez: qué se dibuja en el mapa y qué entra al
// ZIP que el cliente se lleva. Vivía adentro de un componente de 1.700 líneas, o sea
// que ningún test lo podía importar — y ya se rompió una vez de la forma que más
// cuesta ver: el andamiaje (la raíz, las carpetas, los nodos de área) tiene reglas
// DISTINTAS según la dimensión, y esa asimetría no se nota leyendo el código.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasaFiltro, cuentaFiltros, podarAreas, filtroVacio, clonarFiltro, type EstadoFiltro } from '../lib/cerebro-filtro';
import type { NodoCerebro } from '../lib/cerebro-modelo';

const nodo = (p: Partial<NodoCerebro> & Pick<NodoCerebro, 'id' | 'area'>): NodoCerebro => ({
  etiqueta: p.id, detalle: '', fuente: '', autoria: 'mako', ...p,
} as NodoCerebro);

const raiz = nodo({ id: 'raiz', area: 'norte' });
const carpeta = nodo({ id: 'n1:oferta', area: 'oferta' });
const areaNodo = nodo({ id: 'area:oferta', area: 'oferta' });
const dato = nodo({ id: 'x1', area: 'oferta', autoria: 'mako' });
const mio = nodo({ id: 'x2', area: 'oferta', autoria: 'usuario' });
const hueco = nodo({ id: 'x3', area: 'productos', autoria: 'pendiente' });
const otro = nodo({ id: 'x4', area: 'razones', autoria: 'mako' });

const con = (p: Partial<EstadoFiltro>): EstadoFiltro => ({ ...filtroVacio(), ...p });

test('sin filtro pasa todo', () => {
  for (const n of [raiz, carpeta, areaNodo, dato, mio, hueco, otro]) {
    assert.equal(pasaFiltro(n, filtroVacio()), true, n.id);
  }
});

test('la raíz pasa SIEMPRE, con cualquier filtro', () => {
  // Es el centro del mapa: sin ella las áreas cuelgan de la nada. El corolario, que ya
  // costó un bug: ningún conteo de cara al usuario puede salir de la lista cruda,
  // porque el mínimo alcanzable no es cero.
  assert.equal(pasaFiltro(raiz, con({ carpetas: new Set(['mensaje']) })), true);
  assert.equal(pasaFiltro(raiz, con({ areas: new Set(['razones']) })), true);
  assert.equal(pasaFiltro(raiz, con({ autoria: 'usuario' })), true);
});

test('carpeta y sección SÍ apagan el andamiaje; la autoría NO', () => {
  // La asimetría es a propósito y es lo que más se olvida. Filtrar por «Mensaje» y
  // dejar dibujada la carpeta «Oferta» es no haber filtrado. Pero filtrar por «lo
  // escribiste tú» y apagar las carpetas deja las etiquetas flotando sin racimo, y el
  // andamiaje no tiene autoría propia que juzgar.
  assert.equal(pasaFiltro(carpeta, con({ carpetas: new Set(['mensaje']) })), false);
  assert.equal(pasaFiltro(areaNodo, con({ areas: new Set(['razones']) })), false);
  assert.equal(pasaFiltro(carpeta, con({ autoria: 'usuario' })), true);
  assert.equal(pasaFiltro(areaNodo, con({ autoria: 'falta' })), true);
});

test('AND entre dimensiones, OR adentro de cada una', () => {
  const f = con({ carpetas: new Set(['oferta']), autoria: 'mako' });
  assert.equal(pasaFiltro(dato, f), true, 'de la carpeta Y de MaKo');
  assert.equal(pasaFiltro(mio, f), false, 'de la carpeta pero mío');
  assert.equal(pasaFiltro(otro, f), false, 'de MaKo pero de otra carpeta');

  const dos = con({ areas: new Set(['oferta', 'razones']) });
  assert.equal(pasaFiltro(dato, dos), true);
  assert.equal(pasaFiltro(otro, dos), true);
  assert.equal(pasaFiltro(hueco, dos), false);
});

test('«sin completar» es lo pendiente, y nada más', () => {
  const f = con({ autoria: 'falta' });
  assert.equal(pasaFiltro(hueco, f), true);
  assert.equal(pasaFiltro(dato, f), false);
  assert.equal(pasaFiltro(mio, f), false);
});

test('cada valor elegido suma uno al contador', () => {
  assert.equal(cuentaFiltros(filtroVacio()), 0);
  assert.equal(cuentaFiltros(con({ areas: new Set(['oferta', 'razones']) })), 2);
  assert.equal(cuentaFiltros(con({ areas: new Set(['oferta']), autoria: 'mako' })), 2);
});

test('elegir una carpeta poda las secciones de otras ramas', () => {
  // Sin esto queda una combinación que da CERO —son ramas distintas del árbol y el
  // filtro es AND— y el usuario se entera recién cuando la pantalla queda vacía.
  const f = con({ areas: new Set(['oferta', 'razones']) });
  assert.deepEqual([...podarAreas(f, new Set(['oferta']))], ['oferta']);
  // Sin carpetas no hay nada que podar: «todas» no recorta.
  assert.deepEqual([...podarAreas(f, new Set())], ['oferta', 'razones']);
});

test('clonar da Sets propios', () => {
  // El exportador siembra su filtro con el del mapa. Si compartieran el Set, tocar el
  // del modal movería el lienzo de atrás.
  const a = con({ areas: new Set(['oferta']) });
  const b = clonarFiltro(a);
  b.areas.add('razones');
  assert.equal(a.areas.size, 1);
  assert.equal(b.areas.size, 2);
});
