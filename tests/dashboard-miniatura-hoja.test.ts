// =============================================================================
// La vista previa de una plantilla de hoja es LA HOJA, en chico (14/10/2026)
// =============================================================================
// Martín: «Y los templates, la preview debería ser como los de landing generator, porque justamente se deberían ver como
// una pagina... Lo mismo te pido que le digas a dashboard». Y sobre la primera versión, que dibujaba un BOCETO de cada
// tipo: «los templates tienen que ser fieles a lo que se va a ver, no inventes esas imagenes, que se vea tal cual... Y
// elimina los subtitulos de cada template, solo el título». ./app/dashboard/MiniaturaHoja.tsx dibuja cada componente con
// los MISMOS componentes del editor; lo único de ejemplo es el número (lib/graficos-muestra.ts).
//
// Lo que fija:
//   · el resultado de ejemplo de CADA gráfico de cada plantilla (Dashboard y General) tiene la forma del suyo: una
//     columna por métrica con su formato, filas para su dimensión (las del tiempo, en orden y terminando hoy), totales
//     que son números, la comparación si la pide y la tendencia si es un cuadro de resultados; y es DETERMINISTA;
//   · el lugar de cada componente es la cuenta de la grilla del editor (FILA 30, MARGEN 16, 12 columnas);
//   · la miniatura dibuja con las piezas del editor (`CuerpoGrafico`, `PiezaGeneralDeMuestra`, `CuerpoSeccion`) y no con
//     un boceto, no pide datos, y los cuerpos entran después de montar y a la vista (la pantalla en blanco se dibuja
//     también en el server: el primer dibujo tiene que dar lo mismo en los dos lados);
//   · la galería muestra sólo el título de cada plantilla.
// ⚠️ NO SE DIBUJA EN EL TEST: la miniatura importa el editor, que importa server actions, y fuera de Next eso tira
//    «This module cannot be imported from a Client Component module». Se prueba lo que decide (el resultado y el lugar)
//    ejecutándolo, y el cableado leyendo el fuente.
// Correr: npx tsx --test tests/dashboard-miniatura-hoja.test.ts
//
// PROBADO ROMPIÉNDOLO (14/10/2026; base en verde: 5 pasan, 0 fallan). Una rotura por vez, restaurando de memoria:
//   · `resultadoDeMuestra` sin `anterior` aunque el gráfico pida comparar                 -> 4 / 1 «el resultado…»
//   · los valores con `Math.random()` en vez del azar por id                              -> 4 / 1 «el resultado…» (determinista)
//   · `lugarEnMiniatura` con el alto sin los márgenes (`h * fila`)                         -> 4 / 1 «el lugar…»
//   · la miniatura con su boceto de vuelta (`<Boceto` en vez de `<CuerpoGrafico`)          -> 4 / 1 «la miniatura dibuja…»
//   · la línea de la plantilla otra vez en la tarjeta (`<span className="nh-desc">{p.linea}`) -> 4 / 1 «la galería…»

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { dimensionDe, esGrafico, fuenteDe, metricaDe, sanearHoja, type Hoja } from '../lib/graficos-catalogo';
import { lugarEnMiniatura, resultadoDeMuestra } from '../lib/graficos-muestra';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TODAS = [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL];
const hojaDe = (p: (typeof TODAS)[number]) => sanearHoja({ ...p.armar((l) => l), plantilla: p.id }, 0) as Hoja;
const HOY = '2026-10-14';

test('el resultado de ejemplo de cada gráfico tiene la forma del suyo, y es determinista', () => {
  let vistos = 0;
  for (const p of TODAS) {
    for (const c of hojaDe(p).componentes) {
      if (!esGrafico(c)) continue;
      const r = resultadoDeMuestra(c, HOY);
      const f = fuenteDe(c.fuente)!;
      assert.deepEqual(r.columnas.map((x) => x.id), c.metricas, `${p.id}/${c.id}: las columnas no son sus métricas`);
      r.columnas.forEach((x) => assert.equal(x.formato, metricaDe(f, x.id)?.formato ?? 'numero', `${p.id}/${c.id}: ${x.id} con otro formato`));
      assert.ok(r.totales.every((t) => typeof t === 'number' && Number.isFinite(t)), `${p.id}/${c.id}: un total que no es un número`);
      const dim = dimensionDe(f, c.dimension);
      if (dim) {
        assert.ok(r.filas.length >= 3, `${p.id}/${c.id}: un gráfico por ${dim.id} con ${r.filas.length} filas`);
        assert.ok(r.filas.every((x) => x.valores.length === c.metricas.length && x.valores.every((v) => v != null && Number.isFinite(v))), `${p.id}/${c.id}: una fila rota`);
        if (dim.clase === 'tiempo') {
          const claves = r.filas.map((x) => x.clave);
          assert.deepEqual([...claves].sort(), claves, `${p.id}/${c.id}: el tiempo fuera de orden`);
          assert.ok(claves[claves.length - 1] <= HOY, `${p.id}/${c.id}: una fecha después de hoy`);
        }
      } else {
        assert.equal(r.filas.length, 0);
        assert.ok(r.serie && r.serie.length === 14, `${p.id}/${c.id}: un cuadro de resultados sin su tendencia`);
      }
      if (c.comparar) assert.ok(r.anterior && r.anterior.length === r.totales.length, `${p.id}/${c.id}: pide comparar y no trae el período anterior`);
      assert.deepEqual(resultadoDeMuestra(c, HOY), r, `${p.id}/${c.id}: dos resultados distintos para el mismo gráfico`);
      vistos++;
    }
  }
  assert.ok(vistos > 120, `revisé ${vistos} gráficos: el recorrido no está mirando`);
});

test('el lugar de cada componente es la cuenta de la grilla del editor', () => {
  // La grilla: 1180 de página, 24 de aire a cada lado, 12 columnas con 16 entre ellas, filas de 30.
  const col = (1180 - 48 - 11 * 16) / 12;
  assert.deepEqual(lugarEnMiniatura({ x: 0, y: 0, w: 12, h: 1 }), { left: 24, top: 66, width: 1180 - 48, height: 30 });
  assert.deepEqual(lugarEnMiniatura({ x: 6, y: 2, w: 6, h: 7 }), { left: 24 + 6 * (col + 16), top: 66 + 2 * 46, width: 6 * col + 5 * 16, height: 7 * 30 + 6 * 16 });
  // Dos de media hoja lado a lado llenan la fila sin pisarse.
  const a = lugarEnMiniatura({ x: 0, y: 0, w: 6, h: 4 });
  const b = lugarEnMiniatura({ x: 6, y: 0, w: 6, h: 4 });
  assert.equal(Math.round(a.left + a.width + 16), Math.round(b.left));
  assert.equal(Math.round(b.left + b.width), 1180 - 24);
});

test('la miniatura dibuja con las piezas del editor, no pide datos y el primer dibujo es el del server', () => {
  const src = leer('app/dashboard/MiniaturaHoja.tsx');
  assert.match(src, /<CuerpoGrafico g=\{c\} estado=\{\{ cargando: false, resultado: resultadoDeMuestra\(c, hoy\) \}\} tema=\{hoja\.tema\} \/>/);
  assert.match(src, /<PiezaGeneralDeMuestra e=\{e\} \/>/);
  assert.match(src, /<CuerpoSeccion e=\{e\}/);
  assert.match(src, /style=\{lugarEnMiniatura\(c\)\}/);
  assert.doesNotMatch(src, /Boceto|mh-tinta|formaDe\(/, 'volvió el boceto');
  assert.doesNotMatch(src, /\bfetch\(|datosDeGraficos|Math\.random/);
  // Los cuerpos entran después de montar y a la vista; antes, la tarjeta con su título (lo mismo en los dos lados).
  assert.match(src, /\{vivo && <CuerpoGrafico/);
  assert.match(src, /vivo=\{vivo && !!hoy\}/);
  assert.match(src, /new IntersectionObserver\(/);
  // Las variables de un Texto: las de quien mira (en General) o las de ejemplo; nunca la llave cruda.
  assert.match(src, /conVariables\(e\.texto, variables \?\? EJEMPLOS\)/);
});

test('la galería muestra el título de cada plantilla y nada más', () => {
  const nh = leer('app/dashboard/NuevaHoja.tsx');
  assert.doesNotMatch(nh, /nh-desc/, 'volvió la línea debajo del título');
  assert.match(nh, /<MiniaturaHoja hoja=\{muestras\.get\(p\.id\) \?\? null\} \/>\s*\{armando === p\.nombre/);
  assert.match(nh, /<span className="nh-nombre">\{p\.nombre\}<\/span>\s*<\/button>/);
});

test('el editor monta la hoja de estilos de las miniaturas una vez', () => {
  const nh = leer('app/dashboard/NuevaHoja.tsx');
  assert.equal((nh.match(/<style>\{CSS_MINIATURA\}<\/style>/g) ?? []).length, 1);
});
