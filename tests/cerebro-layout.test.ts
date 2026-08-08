// Las tres cosas que, si se rompen, no fallan ni avisan: el mapa simplemente cambia
// y el usuario deja de reconocer el suyo. Por eso están en un test y no en un comentario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCerebro, huellaDe, gradosDe } from '../lib/cerebro-layout';
import { radioNodo, type NodoCerebro, type AristaCerebro } from '../lib/cerebro-modelo';

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
  // El umbral va RELATIVO al encuadre, no en unidades absolutas: la escala del mundo
  // depende de `linkDist`, así que un número fijo deja de significar lo mismo apenas
  // se toca la receta (pasó al subir de 70 a 250 — el mismo desvío proporcional saltó
  // de 51 a 184 unidades sin que nada empeorara).
  const tope = conPrevio.encuadre.lado * 0.15;
  assert.ok(peor <= tope, `se movió ${peor.toFixed(0)} de un encuadre de ${conPrevio.encuadre.lado.toFixed(0)} (tope ${tope.toFixed(0)})`);
  assert.ok(conPrevio.posiciones['doc:b'], 'el nodo nuevo no recibió posición');
});

test('la huella cambia si cambia el grafo, y no si solo cambia el orden', () => {
  const { nodos, aristas } = grafoDePrueba();
  const h = huellaDe(nodos, aristas);
  assert.equal(h, huellaDe([...nodos].reverse(), [...aristas].reverse()));
  assert.notEqual(h, huellaDe([...nodos, nodo('doc:b', 'documentos')], aristas));
});

test('el radio es el de Obsidian: casi uniforme, con piso y techo', () => {
  // La jerarquía la dan la POSICIÓN y el color, no el diámetro: el piso de 8 domina
  // hasta grado 6, así que un mapa entero varía poco de tamaño. Es a propósito.
  assert.equal(radioNodo(1), 8);
  assert.equal(radioNodo(6), 8);
  assert.ok(radioNodo(14) > radioNodo(6));
  assert.ok(radioNodo(14) < 12);
  assert.equal(radioNodo(1000), 30);   // el techo
});

test('todos los nodos entran en el encuadre', () => {
  const { nodos, aristas } = grafoDePrueba();
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  for (const [id, p] of Object.entries(posiciones)) {
    assert.ok(p.x >= encuadre.x && p.x <= encuadre.x + encuadre.lado, `${id} se sale en x`);
    assert.ok(p.y >= encuadre.y && p.y <= encuadre.y + encuadre.lado, `${id} se sale en y`);
  }
});
