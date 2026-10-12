// =============================================================================
// Los CONECTORES del Dashboard (tanda v5, punto 11): la flecha que une dos tarjetas y las sigue —
// lib/graficos-conectores.ts (la geometría, pura) y su cableado en app/dashboard/EditorInforme.tsx.
// =============================================================================
// Martín (12/10/2026): una línea o flecha de antes era un dibujo en una celda que no sabía de ninguna tarjeta.
// Lo que este archivo fija:
//   · la flecha sale del lado de A que MIRA a B y entra por el de B que mira a A; con aire en los dos ejes, manda
//     el eje con más aire (una tarjeta abajo y apenas corrida se une por abajo, no por el costado);
//   · la punta no la tapa la línea (el trazo termina en la base de la punta) y va donde dice `punta`;
//   · borrar una tarjeta borra sus conectores en el MISMO cambio (un Deshacer los devuelve juntos), y no se une
//     una tarjeta consigo misma ni dos veces el mismo par.
// Correr: npx tsx --test tests/graficos-conectores.test.ts
//
// ── Roturas (12/10/2026, scratchpad p5/romper.mjs: una por vez, restaurada de MEMORIA y verificada por hash,
//    nunca con git). Base: 7 pasan / 0 fallan; al final, 7 / 0. Cada rotura tumbó SU test (pasan / fallan):
//   · `ladosEnfrentados` que decide por los centros siempre (sin mirar el aire) -> 6 / 1  «los lados…»
//   · el lado de llegada sin dar vuelta (B a la izquierda, entra por su izq)    -> 6 / 1  «los lados…»
//   · el trazo hasta el borde (sin acortar por la punta)                         -> 6 / 1  «la punta…»
//   · la punta del inicio con 'fin'                                              -> 6 / 1  «la punta…»
//   · el codo sin el quiebre a mitad de camino                                   -> 6 / 1  «los tres trazos…»
//   · `sinConectoresDe` que sólo mira `desde`                                    -> 6 / 1  «borrar una tarjeta…»
//   · `puedeConectar` que acepta el par dado vuelta                              -> 6 / 1  «no se une…»
//   · `borrar` (EditorInforme) sin los conectores en el mismo cambio            -> 6 / 1  «borrar una tarjeta…»
//   · un setState por cuadro en el rAF de la capa (Conectores.tsx)               -> 6 / 1  «la capa sigue…»
//   · el gesto avisado por píxel (`onDrag` en vez de `onDragStop`)               -> 6 / 1  «la capa sigue…»
//   ⚠️ «el saneo de la hoja descarta el conector…» NO se rompió desde acá: lo prueba `sanearHoja`, que vive en
//   lib/graficos-catalogo.ts (paquete del catálogo). Queda como afirmación hasta que ese paquete lo rompa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearHoja, type Conector } from '../lib/graficos-catalogo';
import { PUNTA, conectorNuevo, geometriaConector, ladosEnfrentados, puedeConectar, puntoDeLado, sinConectoresDe, type Caja } from '../lib/graficos-conectores';

const caja = (left: number, top: number, width = 100, height = 60): Caja => ({ left, top, width, height });
const A = caja(0, 0);

test('los lados enfrentados: el eje con más aire manda, y la llegada es el lado que mira a la salida', () => {
  assert.deepEqual(ladosEnfrentados(A, caja(300, 0)), ['der', 'izq'], 'B a la derecha');
  assert.deepEqual(ladosEnfrentados(A, caja(-300, 0)), ['izq', 'der'], 'B a la izquierda');
  assert.deepEqual(ladosEnfrentados(A, caja(0, 200)), ['aba', 'arr'], 'B abajo');
  assert.deepEqual(ladosEnfrentados(A, caja(0, -200)), ['arr', 'aba'], 'B arriba');
  // Abajo y apenas corrida a la derecha (se pisan en X): por abajo.
  assert.deepEqual(ladosEnfrentados(A, caja(40, 90)), ['aba', 'arr']);
  // En diagonal con más aire de costado que de alto: por el costado.
  assert.deepEqual(ladosEnfrentados(A, caja(400, 80)), ['der', 'izq']);
  // En diagonal con más aire de alto que de costado: por abajo, aunque el centro esté más lejos en X.
  assert.deepEqual(ladosEnfrentados(caja(0, 0, 400, 60), caja(420, 300, 400, 60)), ['aba', 'arr']);
});

test('la punta: al final, en las dos o en ninguna; su vértice toca la tarjeta y el trazo termina en su base', () => {
  const B = caja(300, 0);
  const llega = puntoDeLado(B, 'izq');
  const fin = geometriaConector(A, B, 'recta', 'fin');
  assert.equal(fin.puntas.length, 1);
  assert.equal(fin.puntas[0].split(' ')[0], `${llega.x},${llega.y}`, 'el vértice de la punta va en el borde de la tarjeta');
  assert.equal(fin.d, `M 100 30 L ${300 - PUNTA} 30`, 'el trazo termina en la base de la punta, no en el borde');
  const ambas = geometriaConector(A, B, 'recta', 'ambas');
  assert.equal(ambas.puntas.length, 2);
  assert.equal(ambas.d, `M ${100 + PUNTA} 30 L ${300 - PUNTA} 30`);
  const ninguna = geometriaConector(A, B, 'recta', 'ninguna');
  assert.deepEqual(ninguna.puntas, []);
  assert.equal(ninguna.d, 'M 100 30 L 300 30');
  assert.deepEqual([fin.desde.lado, fin.hasta.lado], ['der', 'izq']);
});

test('los tres trazos: la recta, el codo con su quiebre a mitad de camino y la curva que sale derecho', () => {
  const B = caja(300, 200);
  assert.match(geometriaConector(A, B, 'recta', 'ninguna').d, /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  // B está abajo-derecha con más aire de costado (200 > 140): sale por la derecha, quiebra en la mitad de X.
  const codo = geometriaConector(A, B, 'codo', 'ninguna');
  assert.equal(codo.d, 'M 100 30 H 200 V 230 H 300');
  assert.deepEqual(codo.medio, { x: 200, y: 130 });
  const curva = geometriaConector(A, B, 'curva', 'ninguna');
  assert.match(curva.d, /^M 100 30 C 200 30, 200 230, 300 230$/, 'los tiradores salen por la normal de cada lado');
  // El medio de la curva está entre las dos tarjetas (ahí va el botón de borrar).
  assert.ok(curva.medio.x > 100 && curva.medio.x < 300 && curva.medio.y > 30 && curva.medio.y < 230, JSON.stringify(curva.medio));
});

test('borrar una tarjeta borra sus conectores en el MISMO cambio (un Deshacer los devuelve juntos)', () => {
  const ks: Conector[] = [conectorNuevo('k1', 'a', 'b'), conectorNuevo('k2', 'b', 'c'), conectorNuevo('k3', 'c', 'a'), conectorNuevo('k4', 'c', 'd')];
  assert.deepEqual(sinConectoresDe(ks, new Set(['a'])).map((k) => k.id), ['k2', 'k4'], 'se van los que SALEN y los que LLEGAN');
  assert.deepEqual(sinConectoresDe(undefined, new Set(['a'])), []);
  // En la pantalla: `borrar` saca la tarjeta y sus conectores en UNA llamada a `mutarComponentes` (un solo paso del deshacer).
  const ed = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const b = ed.slice(ed.indexOf('const borrar = useCallback((c: Componente) => {'), ed.indexOf('}, [mutarComponentes, show, deshacer]);'));
  assert.ok(b.length > 0 && b.length < 500, `el recorte mide ${b.length}`);
  assert.match(b, /mutarComponentes\(\(cs\) => cs\.filter\(\(x\) => x\.id !== c\.id\), \(ks\) => sinConectoresDe\(ks, new Set\(\[c\.id\]\)\)\);/);
  assert.equal((b.match(/mutar(Componentes|Hoja)?\(/g) ?? []).length, 1, 'dos cambios son dos pasos del deshacer: la tarjeta volvería sin sus flechas');
  // Y `mutarComponentes` escribe los dos en el MISMO `mutarHoja`.
  const m = ed.slice(ed.indexOf('const mutarComponentes = useCallback('), ed.indexOf('}, [mutarHoja, duenoId]);'));
  assert.match(m, /const conectores = fnCon\(h\.conectores \?\? \[\]\);\s*return \{ \.\.\.h, componentes, conectores:/);
});

test('no se une una tarjeta consigo misma, ni dos veces el mismo par (en ningún sentido), ni pasando el tope', () => {
  const ks = [conectorNuevo('k1', 'a', 'b')];
  assert.equal(puedeConectar(ks, 'a', 'a', 40), false);
  assert.equal(puedeConectar(ks, 'a', 'b', 40), false);
  assert.equal(puedeConectar(ks, 'b', 'a', 40), false, 'dos flechas entre las mismas tarjetas se dibujan una encima de la otra');
  assert.equal(puedeConectar(ks, 'a', 'c', 40), true);
  assert.equal(puedeConectar(ks, 'a', 'c', 1), false, 'el tope');
  assert.equal(puedeConectar(undefined, 'a', 'c', 40), true);
  assert.equal(puedeConectar(ks, '', 'c', 40), false);
});

test('el saneo de la hoja descarta el conector que apunta a una tarjeta que no está (o a sí misma)', () => {
  const h = sanearHoja({
    id: 'h1', nombre: 'P',
    componentes: [{ id: 'a', clase: 'elemento', tipo: 'texto', texto: 'A' }, { id: 'b', clase: 'elemento', tipo: 'texto', texto: 'B', y: 3 }],
    conectores: [conectorNuevo('k1', 'a', 'b'), conectorNuevo('k2', 'a', 'z'), conectorNuevo('k3', 'b', 'b')],
  }, 0)!;
  assert.deepEqual(h.conectores?.map((k) => k.id), ['k1']);
});

test('la capa sigue a las tarjetas: posiciones del layout en reposo, el DOM en un rAF durante el gesto (sin setState por píxel)', () => {
  const capa = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'Conectores.tsx'), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(capa, /calcGridItemPosition\(params, c\.x, c\.y, c\.w, c\.h\)/, 'en reposo, la misma cuenta que react-grid-layout');
  const gesto = capa.slice(capa.indexOf('if (!enGesto) return;'), capa.indexOf('}, [enGesto, conectores, contenedor]);'));
  assert.ok(gesto.length > 0 && gesto.length < 1600, `el recorte mide ${gesto.length}`);
  assert.match(gesto, /requestAnimationFrame\(paso\)/);
  assert.match(gesto, /getBoundingClientRect\(\)/);
  assert.match(gesto, /setAttribute\('d', geo\.d\)/);
  assert.doesNotMatch(gesto, /\bset(?!Attribute)[A-Z]\w*\(/, 'un setState por cuadro redibujaría la hoja sesenta veces por segundo');
  // Y la pantalla prende el gesto al EMPEZAR y lo apaga al TERMINAR (no en cada píxel).
  const ed = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ed, /onDragStart=\{alEmpezarGesto\}\s*onResizeStart=\{alEmpezarGesto\}\s*onDragStop=\{alTerminarGesto\}\s*onResizeStop=\{alTerminarGesto\}/);
  assert.doesNotMatch(ed, /onDrag=\{|onResize=\{/, 'un aviso por píxel');
});
