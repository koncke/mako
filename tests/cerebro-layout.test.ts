// Las tres cosas que, si se rompen, no fallan ni avisan: el mapa simplemente cambia
// y el usuario deja de reconocer el suyo. Por eso están en un test y no en un comentario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutCerebro, huellaDe, gradosDe } from '../lib/cerebro-layout';
import { AIRE_MAX_N1, AIRE_POR_LETRA_N1, airePorTitulosN1, NIVEL1, radioNodo, type NodoCerebro, type AristaCerebro } from '../lib/cerebro-modelo';

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

test('el aire por los títulos de las carpetas madre NO depende del modo (6/11/2026)', () => {
  // El encuadre mide los PUNTOS, y la etiqueta de una carpeta madre va centrada en su punto
  // y en versalitas (`.cbg-et-n1`), así que es más ancha: pegada al borde se corta. La regla
  // nació el 4/11 arreglando el mapa de un CURSO y quedó detrás de un `curso ? … : 0` en
  // Grafo.tsx, así que el mapa del NEGOCIO se seguía cortando — con las mismas carpetas
  // (`NIVEL1`) y la misma clase CSS. Lo que se fija acá es que la regla sea UNA, sin modo:
  // es pura y recibe etiquetas, no sabe si viene de un curso o de un negocio.
  const delNegocio = NIVEL1.map((p) => p.nombre);           // NEGOCIO, OFERTA, MERCADO, MENSAJE, FUNNEL
  const aireNegocio = airePorTitulosN1(delNegocio);
  assert.ok(aireNegocio > 0, 'las carpetas del NEGOCIO tienen etiqueta: su aire no puede ser 0');
  // La más larga es «Negocio»/«Mercado»/«Mensaje» (7 letras) → 7 × 3,75 = 26,25.
  assert.equal(aireNegocio, 7 * AIRE_POR_LETRA_N1);
  // Y es chico contra el de un curso: por eso el `curso ?` parecía inofensivo (el encuadre
  // del negocio casi no se mueve) y a la vez por eso el título igual se cortaba.
  assert.ok(airePorTitulosN1(['Hip Hop Recordings de los noventa en vinilo']) > aireNegocio);

  // El tope y el piso, que son los que evitan que un título absurdo se coma el mapa.
  assert.equal(airePorTitulosN1([]), 0, 'sin carpetas no se pide aire');
  assert.equal(airePorTitulosN1(['x'.repeat(500)]), AIRE_MAX_N1, 'un título larguísimo tiene que topear');
  // Manda el MÁS LARGO, no el primero ni el promedio: con uno corto adelante, el largo se
  // cortaría igual.
  assert.equal(airePorTitulosN1(['ab', 'abcdefgh']), airePorTitulosN1(['abcdefgh']));

  // ⚠️ Y EL CALL-SITE, QUE ES DONDE ESTABA EL BUG. Probando la rotura se vio que volver a
  // poner el `curso ? … : 0` en Grafo.tsx deja este test en VERDE 9/9: la regla pura sigue
  // siendo correcta, y el componente la llama mal. O sea que lo de arriba no alcanza.
  // Grafo.tsx mide el DOM (`getBoundingClientRect`) y un test no lo puede montar, así que
  // acá se lee como TEXTO —el mismo recurso, y por el mismo motivo, que usa
  // tests/plan-recurrente-nace.test.ts con los módulos `server-only`—. Lo que se cuida es
  // que la llamada NO lleve un condicional adelante: el bug no era la regla, era el `?`.
  const grafo = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'second-brain', 'Grafo.tsx'), 'utf8');
  const llamada = /const mitadTitulo = (.+);/.exec(grafo);
  assert.ok(llamada, 'no encontré el cálculo del aire en app/second-brain/Grafo.tsx');
  assert.match(llamada[1], /^airePorTitulosN1\(/, `el aire del encuadre vuelve a depender del modo: «${llamada[1].slice(0, 60)}»`);
});
