// La animación de Competitors Spy: sus piezas se juntan y se reparten en carpetas (Martín, 1/11/2026, copiada de «Sort my footage»).
// Probado rompiéndolo:
//   · contar el sitio como una pieza                         → 1
//   · volver a partir las carpetas por etapa                 → 1 y 1b
//   · repartirMiniaturas sin el tope                         → 2
//   · dejar una carpeta sin miniaturas al cortar             → 2
//   · rectDe sin calcular cuántas entran                     → 3 (se salen de su carpeta)
//   · la animación montada también sin piezas                → 5
// Y del 12/11/2026 (Martín: «más cuadros» y «que esté centrada»):
//   · carpetasDe sin partir por formato                      → 6
//   · partir sin el tope de carpetas                         → 6
//   · dejar la carpeta del tipo vacía cuando un formato se lleva todas → 6
//   · las miniaturas de una carpeta arriba a la izquierda    → 7
//   · las carpetas pegadas a los bordes de la escena         → 7
//   · la bola arriba en una escena de 850 (el umbral de 860) → 7
//   · el teléfono con 8 carpetas (de 60 px)                 → 8
//   · cerrar la película antes de medir el ancho            → 8

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAXIMO_CARPETAS, MAXIMO_CARPETAS_ANGOSTA, TOPE_MINIATURAS, carpetasDe, disponer, maximoDeCarpetas, repartirMiniaturas, type PiezaParaOrdenar } from '../lib/spy-orden';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const etapas = ['probado', 'ganando-traccion', 'test-nuevo', null] as const;
const piezas = (n: number): PiezaParaOrdenar[] => Array.from({ length: n }, (_, i) => (
  i % 3 === 0 ? { id: i, canal: 'instagram', tipo: 'reel', etapa: etapas[i % 4] } : { id: i, canal: 'youtube', tipo: 'video', etapa: etapas[i % 4] }
));

test('1. las carpetas salen de las piezas: todas caen en una, y el sitio no es una pieza', () => {
  const ps = [...piezas(40), { id: 900, canal: 'landing', tipo: 'landing', etapa: null } as PiezaParaOrdenar];
  const cs = carpetasDe(ps);
  assert.equal(cs.reduce((s, c) => s + c.n, 0), 40);
  assert.equal(new Set(cs.flatMap((c) => c.ids)).size, 40);
  // Una carpeta por TIPO DE CONTENIDO, sin la etapa («Videos · Probado» se fue el 4/11: Martín no entendía «Probado»).
  assert.deepEqual(cs.map((c) => c.rotulo), ['Reels', 'Videos de YouTube']);
  assert.deepEqual(carpetasDe([]), []);
});

test('1b. los Shorts y los carruseles van en su carpeta, en el orden del desplegable de la ficha', () => {
  const cs = carpetasDe([
    { id: 1, canal: 'youtube', tipo: 'video', duracion: 'PT45S' },
    { id: 2, canal: 'youtube', tipo: 'video', duracion: 'PT12M3S' },
    { id: 3, canal: 'instagram', tipo: 'publicacion' },
    { id: 4, canal: 'instagram', tipo: 'reel' },
    { id: 5, canal: 'anuncios', tipo: 'anuncio' },
  ]);
  assert.deepEqual(cs.map((c) => [c.rotulo, c.ids]), [
    ['Reels', [4]], ['Carruseles e imágenes', [3]], ['Videos de YouTube', [2]], ['Shorts', [1]], ['Anuncios', [5]],
  ]);
});

test('2. se dibujan como mucho las del tope, y ninguna carpeta se queda sin la suya', () => {
  const cs = carpetasDe([...piezas(600), { id: 999, canal: 'anuncios', tipo: 'anuncio', etapa: null }]);
  const v = repartirMiniaturas(cs);
  const total = [...v.values()].reduce((s, x) => s + x.length, 0);
  assert.ok(total <= TOPE_MINIATURAS, `${total}`);
  assert.ok(total >= TOPE_MINIATURAS - cs.length, 'el tope se aprovecha');
  for (const c of cs) assert.ok((v.get(c.clave)?.length ?? 0) >= 1, c.rotulo);
  // Con pocas, todas.
  const pocas = carpetasDe(piezas(12));
  assert.equal([...repartirMiniaturas(pocas).values()].reduce((s, x) => s + x.length, 0), 12);
});

for (const [ancho, alto] of [[1200, 487], [1500, 700], [800, 460], [420, 620]] as const) {
  test(`3. en ${ancho}×${alto} todo cae adentro: la bola, las carpetas y cada miniatura en la suya`, () => {
    for (const n of [1, 3, 12, 64, 140]) {
      const cs = carpetasDe(piezas(n));
      const v = repartirMiniaturas(cs);
      const d = disponer(ancho, alto, cs, v);
      assert.equal(d.bola.length, [...v.values()].reduce((s, x) => s + x.length, 0));
      for (const r of d.carpetas) {
        assert.ok(r.x >= -0.5 && r.x + r.w <= ancho + 0.5 && r.y >= -0.5 && r.y + r.h <= alto + 0.5, `${r.clave} se sale de la escena (${n})`);
        assert.equal(r.huecos.length, v.get(r.clave)?.length);
        for (const h of r.huecos) {
          assert.ok(h.x >= r.x && h.x <= r.x + r.w && h.y >= r.y && h.y <= r.y + r.h, `una miniatura cae afuera de ${r.clave} (${n})`);
        }
      }
      for (const a of d.carpetas) for (const b of d.carpetas) {
        if (a !== b) assert.ok(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5, `se pisan ${a.clave} y ${b.clave}`);
      }
    }
  });
}

test('4. la bola no pisa las carpetas: en una pantalla ancha queda en el medio', () => {
  const cs = carpetasDe(piezas(140));
  const v = repartirMiniaturas(cs);
  const d = disponer(1200, 487, cs, v);
  const izq = Math.max(...d.carpetas.filter((c) => c.x < 600).map((c) => c.x + c.w));
  const der = Math.min(...d.carpetas.filter((c) => c.x >= 600).map((c) => c.x));
  for (const p of d.bola) assert.ok(p.x - d.ladoBola / 2 >= izq && p.x + d.ladoBola / 2 <= der, 'una miniatura de la bola quedó encima de una carpeta');
});

test('5. sólo anima lo que se leyó, nunca traba y una relectura sola va callada', () => {
  const spy = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(spy, /setOrdenando\(\(v\) => \(v\?\.id !== id \|\| actual\.current !== id \? null : p\?\.length \? \{ id, piezas: p \} : null\)\)/, 'sin piezas no hay animación');
  // Animada sólo sin piezas, o en un alta (el loader ya está puesto: tests/spy-alta-loader.test.ts).
  assert.match(spy, /await leer\(id, esAlta \|\| !p\?\.length, esAlta \? 'alta' : undefined\)/, 'una ficha que ya tiene piezas se relee sin correrle la pantalla');
  // Tocar «Revisar» a mitad de la película dejaba la escena sin carpetas, y la página se caía (la revisión del 1/11/2026).
  // Desde el 4/11 «Revisar ahora» no existe (Martín: se revisa una vez, sola); el único botón que vuelve a leer es
  // «Probar de nuevo», el de una lectura que falló, y sigue apagado mientras corre la película.
  assert.equal((spy.match(/disabled=\{estaLeyendo \|\| ordenando != null \|\|/g) ?? []).length, 1);
  assert.match(spy, /disabled=\{estaLeyendo \|\| ordenando != null \|\| elegido == null\}[^\n]*\n\s*Probar de nuevo/);
  // Desde el 4/11 la ficha que abre la página trae sus piezas del server: «trayendo» sólo si no las trae (`!ini`). Lo que se cuida
  // es lo mismo: abrir otra ficha corta la película de la anterior.
  // Salvo la del alta de ESE competidor, que la ficha encuentra puesta (`abrirRecienAgregado`).
  assert.match(spy, /setTrayendo\(!ini\);\s*setOrdenando\(\(v\) => \(esAlta && v\?\.id === id \? v : null\)\);/, 'cambiar de ficha corta la película');
  const o = leer('app/competitor-spy/OrdenSpy.tsx');
  assert.match(o, /if \(!total \|\| quieto\(\)\) \{ terminar\.current\(\); return; \}/, 'con «reducir movimiento» no corre');
  assert.match(o, /className="spyo-saltar" onClick=\{onTerminar\}>Saltar/);
  assert.match(o, /return \(\) => \{ vivo = false; anims\.forEach\(\(a\) => a\.cancel\(\)\); \};/, 'salir a la mitad no deja nada corriendo');
});

test('6. más carpetas: de cada tipo sale una por formato, la más grande primero, hasta el tope', () => {
  const con = (id: number, canal: string, tipo: PiezaParaOrdenar['tipo'], formato: string | null, duracion?: string): PiezaParaOrdenar =>
    ({ id, canal, tipo, duracion, analisis: formato ? { formato } : null });
  // 46 de Instagram, como la que se grabó para el sitio: 2 carpetas por tipo, y ahora se parten por formato.
  const ig = [
    ...Array.from({ length: 14 }, (_, i) => con(i, 'instagram', 'reel', 'tutorial')),
    ...Array.from({ length: 9 }, (_, i) => con(100 + i, 'instagram', 'reel', 'storytime')),
    con(200, 'instagram', 'reel', 'pov'), // uno solo: no tiene su carpeta
    ...Array.from({ length: 6 }, (_, i) => con(300 + i, 'instagram', 'reel', null)),
    ...Array.from({ length: 16 }, (_, i) => con(400 + i, 'instagram', 'publicacion', 'testimonio')),
  ];
  const cs = carpetasDe(ig);
  assert.deepEqual(cs.map((c) => [c.rotulo, c.detalle ?? '', c.n]), [
    ['Tutorial', 'Reels', 14], ['Storytime', 'Reels', 9], ['Reels', 'Otros formatos', 7], ['Testimonio', 'Carruseles e imágenes', 16],
  ], 'los carruseles son todos testimonios: su carpeta es «Testimonio» y no queda una vacía');
  assert.equal(cs.reduce((s, c) => s + c.n, 0), ig.length, 'ninguna se pierde ni se repite');
  assert.equal(new Set(cs.flatMap((c) => c.ids)).size, ig.length);

  // Con muchos formatos, el tope: las más grandes tienen la suya y el resto queda en la de su tipo.
  const muchos = ['tutorial', 'lista', 'storytime', 'pov', 'antes-despues', 'testimonio', 'opinion', 'mito', 'resena', 'detras']
    .flatMap((f, k) => Array.from({ length: 12 - k }, (_, i) => con(k * 100 + i, 'youtube', 'video', f, 'PT10M')));
  const tope = carpetasDe(muchos);
  assert.equal(tope.length, MAXIMO_CARPETAS);
  assert.deepEqual(tope.slice(0, 3).map((c) => c.rotulo), ['Tutorial', 'Lista o tips', 'Storytime'], 'la más grande primero');
  assert.equal(tope.at(-1)?.detalle, 'Otros formatos');
  assert.equal(tope.reduce((s, c) => s + c.n, 0), muchos.length);
  // Sin formatos, como antes: una por tipo.
  assert.deepEqual(carpetasDe(piezas(30)).map((c) => c.rotulo), ['Reels', 'Videos de YouTube']);
});

test('7. centrada: la bola en el medio de la escena, las carpetas junto a ella y las miniaturas en el medio de su carpeta', () => {
  const cs = carpetasDe(piezas(46));
  const v = repartirMiniaturas(cs);
  // 960 de pantalla: la escena mide ~850. Con el umbral de antes (860) la bola iba ARRIBA y las carpetas debajo, de borde a borde.
  for (const [ancho, alto] of [[850, 420], [1170, 560]] as const) {
    const d = disponer(ancho, alto, cs, v);
    assert.equal(d.centro.y, alto / 2, `en ${ancho} la bola va en el medio, no arriba`);
    const izq = d.carpetas.filter((c) => c.x + c.w / 2 < ancho / 2);
    const der = d.carpetas.filter((c) => c.x + c.w / 2 >= ancho / 2);
    assert.ok(izq.length && der.length, `en ${ancho}, a los dos lados`);
    assert.ok(izq.every((c) => c.x > 0) && der.every((c) => c.x + c.w < ancho), `en ${ancho} no van pegadas a los bordes`);
    const margenIzq = Math.min(...izq.map((c) => c.x));
    const margenDer = ancho - Math.max(...der.map((c) => c.x + c.w));
    assert.ok(Math.abs(margenIzq - margenDer) < 1, `en ${ancho} el conjunto queda centrado (${margenIzq} / ${margenDer})`);
  }
  // Las miniaturas, en el medio de su carpeta: con una sola, su centro es el de la carpeta (debajo de la cabecera).
  const una = carpetasDe([{ id: 1, canal: 'instagram', tipo: 'reel' }]);
  const d1 = disponer(1170, 560, una, repartirMiniaturas(una));
  const r = d1.carpetas[0];
  assert.ok(Math.abs(r.huecos[0].x - (r.x + r.w / 2)) < 1, 'centrada a lo ancho');
  assert.ok(Math.abs(r.huecos[0].y - (r.y + 40 + (r.h - 40 - 10) / 2)) < 1, 'centrada a lo alto, debajo de su cabecera');
});

test('8. en el teléfono, menos carpetas; y la película no se cierra antes de medir el ancho', () => {
  assert.equal(maximoDeCarpetas(343), MAXIMO_CARPETAS_ANGOSTA, 'a 375 van debajo de la bola, de a dos');
  assert.equal(maximoDeCarpetas(850), MAXIMO_CARPETAS, 'una pantalla de 960 ya las pone a los costados');
  const con = (id: number, formato: string): PiezaParaOrdenar => ({ id, canal: 'instagram', tipo: 'reel', analisis: { formato } });
  const muchas = ['tutorial', 'lista', 'storytime', 'pov', 'opinion', 'mito'].flatMap((f, k) => Array.from({ length: 6 }, (_, i) => con(k * 10 + i, f)));
  assert.equal(carpetasDe(muchas, maximoDeCarpetas(343)).length, MAXIMO_CARPETAS_ANGOSTA);
  // Cada carpeta del teléfono tiene lugar para sus miniaturas (con 8 quedaban de 60 px de alto).
  const cs = carpetasDe(muchas, maximoDeCarpetas(343));
  for (const r of disponer(343, 560, cs, repartirMiniaturas(cs)).carpetas) assert.ok(r.h >= 100, `${r.clave}: ${Math.round(r.h)} px`);

  const o = leer('app/competitor-spy/OrdenSpy.tsx');
  assert.match(o, /carpetasDe\(piezas, maximoDeCarpetas\(ancho\)\)/, 'las carpetas, según el ancho de SU escena');
  assert.match(o, /if \(!piezas \|\| ancho == null\) return;\n\s+if \(!total \|\| quieto\(\)\) \{ terminar\.current\(\); return; \}/,
    'sin el ancho no hay carpetas y total da 0: cerrar ahí cortaba la película');
});
