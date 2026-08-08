// Las tres cosas que, si se rompen, no fallan ni avisan: el mapa simplemente cambia
// y el usuario deja de reconocer el suyo. Por eso están en un test y no en un comentario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCerebro, huellaDe, radioNodo, gradosDe } from '../lib/cerebro-layout';
import type { NodoCerebro, AristaCerebro } from '../lib/cerebro-modelo';

const nodo = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: '', autoria: 'mako', ...extra,
});

function grafoDePrueba() {
  const nodos: NodoCerebro[] = [
    nodo('raiz', 'norte'),
    nodo('fase', 'norte', { destacado: true }),
    nodo('cuello', 'norte', { alerta: true }),
    nodo('doc:a', 'documentos'),
    nodo('campo:oferta_nombre', 'oferta', { autoria: 'usuario' }),
    nodo('campo:avatar_quien', 'cliente', { autoria: 'usuario' }),
    nodo('av:1', 'avatares'),
    nodo('av:2', 'avatares'),
    nodo('raz:1', 'razones'),
    nodo('raz:2', 'razones'),
    nodo('fmt:carrusel', 'razones'),
    nodo('falta:productos', 'productos', { autoria: 'pendiente' }),
  ];
  const aristas: AristaCerebro[] = [
    { de: 'raiz', a: 'fase', motivo: '' },
    { de: 'fase', a: 'cuello', motivo: '' },
    { de: 'raiz', a: 'doc:a', motivo: '' },
    { de: 'doc:a', a: 'campo:oferta_nombre', motivo: '' },
    { de: 'doc:a', a: 'campo:avatar_quien', motivo: '' },
    { de: 'campo:avatar_quien', a: 'av:1', motivo: '' },
    { de: 'campo:avatar_quien', a: 'av:2', motivo: '' },
    { de: 'av:1', a: 'raz:1', motivo: '' },
    { de: 'av:2', a: 'raz:2', motivo: '' },
    // Las LATERALES: las dos razones comparten formato. Es lo que saca al grafo de
    // la forma de árbol, y sin esto el layout no se parece a nada.
    { de: 'raz:1', a: 'fmt:carrusel', motivo: '' },
    { de: 'raz:2', a: 'fmt:carrusel', motivo: '' },
    { de: 'raiz', a: 'falta:productos', motivo: '' },
  ];
  return { nodos, aristas };
}

test('el mismo grafo da SIEMPRE el mismo dibujo', () => {
  const { nodos, aristas } = grafoDePrueba();
  const a = layoutCerebro(nodos, aristas);
  const b = layoutCerebro(nodos, aristas);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('Math.random no interviene: pisarlo no cambia nada', () => {
  const { nodos, aristas } = grafoDePrueba();
  const original = Math.random;
  const a = layoutCerebro(nodos, aristas);
  try {
    Math.random = () => 0.987654321;
    const b = layoutCerebro(nodos, aristas);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  } finally {
    Math.random = original;
  }
});

test('el orden del array NO cambia el dibujo (se siembra por id, no por índice)', () => {
  const { nodos, aristas } = grafoDePrueba();
  const a = layoutCerebro(nodos, aristas);
  const b = layoutCerebro([...nodos].reverse(), [...aristas].reverse());
  for (const id of Object.keys(a.posiciones)) {
    assert.deepEqual(b.posiciones[id], a.posiciones[id], `se movió ${id}`);
  }
});

test('d3 NO muta los arrays que le pasamos (forceLink reemplaza source/target por referencias)', () => {
  const { nodos, aristas } = grafoDePrueba();
  const antesNodos = JSON.stringify(nodos);
  const antesAristas = JSON.stringify(aristas);
  layoutCerebro(nodos, aristas);
  assert.equal(JSON.stringify(nodos), antesNodos, 'los nodos quedaron mutados');
  assert.equal(JSON.stringify(aristas), antesAristas, 'las aristas quedaron mutadas');
});

test('agregar un nodo no rearma el mapa: los viejos se mueven poco', () => {
  const { nodos, aristas } = grafoDePrueba();
  const base = layoutCerebro(nodos, aristas);
  const nodos2 = [...nodos, nodo('doc:b', 'documentos')];
  const aristas2 = [...aristas, { de: 'raiz', a: 'doc:b', motivo: '' }];
  const conPrevio = layoutCerebro(nodos2, aristas2, base.posiciones);
  let peor = 0;
  for (const id of Object.keys(base.posiciones)) {
    const p = base.posiciones[id];
    const q = conPrevio.posiciones[id];
    peor = Math.max(peor, Math.hypot(q.x - p.x, q.y - p.y));
  }
  assert.ok(peor <= 60, `el nodo que más se movió recorrió ${peor.toFixed(1)} px`);
  assert.ok(conPrevio.posiciones['doc:b'], 'el nodo nuevo no recibió posición');
});

test('la huella cambia si cambia el grafo, y no si solo cambia el orden', () => {
  const { nodos, aristas } = grafoDePrueba();
  const h = huellaDe(nodos, aristas);
  assert.equal(h, huellaDe([...nodos].reverse(), [...aristas].reverse()));
  assert.notEqual(h, huellaDe([...nodos, nodo('doc:b', 'documentos')], aristas));
});

test('el radio crece con el grado y topea', () => {
  const { nodos, aristas } = grafoDePrueba();
  const g = gradosDe(nodos, aristas);
  const raiz = nodos.find((n) => n.id === 'raiz')!;
  const hoja = nodos.find((n) => n.id === 'raz:1')!;
  const pendiente = nodos.find((n) => n.id === 'falta:productos')!;
  assert.ok(radioNodo(raiz, g['raiz']) > radioNodo(hoja, g['raz:1']));
  assert.ok(radioNodo(hoja, g['raz:1']) > radioNodo(pendiente, g['falta:productos']));
  // El techo del bonus: grado 100 no puede dar un nodo gigante.
  assert.equal(radioNodo(hoja, 100), 4.5 + 3);
});

test('todos los nodos entran en el encuadre', () => {
  const { nodos, aristas } = grafoDePrueba();
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  for (const [id, p] of Object.entries(posiciones)) {
    assert.ok(p.x >= encuadre.x && p.x <= encuadre.x + encuadre.lado, `${id} se sale en x`);
    assert.ok(p.y >= encuadre.y && p.y <= encuadre.y + encuadre.lado, `${id} se sale en y`);
  }
});
