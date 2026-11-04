// La animación de Competitors Spy: sus piezas se juntan y se reparten en carpetas (Martín, 1/11/2026, copiada de «Sort my footage»).
// Probado rompiéndolo:
//   · contar el sitio como una pieza                         → 1
//   · volver a partir las carpetas por etapa                 → 1 y 1b
//   · repartirMiniaturas sin el tope                         → 2
//   · dejar una carpeta sin miniaturas al cortar             → 2
//   · rectDe sin calcular cuántas entran                     → 3 (se salen de su carpeta)
//   · la animación montada también sin piezas                → 5

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOPE_MINIATURAS, carpetasDe, disponer, repartirMiniaturas, type PiezaParaOrdenar } from '../lib/spy-orden';

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
  assert.match(spy, /await leer\(id, !p\?\.length\)/, 'una ficha que ya tiene piezas se relee sin correrle la pantalla');
  // Tocar «Revisar» a mitad de la película dejaba la escena sin carpetas, y la página se caía (la revisión del 1/11/2026).
  // Desde el 4/11 «Revisar ahora» no existe (Martín: se revisa una vez, sola); el único botón que vuelve a leer es
  // «Probar de nuevo», el de una lectura que falló, y sigue apagado mientras corre la película.
  assert.equal((spy.match(/disabled=\{estaLeyendo \|\| ordenando != null \|\|/g) ?? []).length, 1);
  assert.match(spy, /disabled=\{estaLeyendo \|\| ordenando != null \|\| elegido == null\}[^\n]*\n\s*Probar de nuevo/);
  assert.match(spy, /setTrayendo\(true\); setOrdenando\(null\);/, 'cambiar de ficha corta la película');
  const o = leer('app/competitor-spy/OrdenSpy.tsx');
  assert.match(o, /if \(!total \|\| quieto\(\)\) \{ terminar\.current\(\); return; \}/, 'con «reducir movimiento» no corre');
  assert.match(o, /className="spyo-saltar" onClick=\{onTerminar\}>Saltar/);
  assert.match(o, /return \(\) => \{ vivo = false; anims\.forEach\(\(a\) => a\.cancel\(\)\); \};/, 'salir a la mitad no deja nada corriendo');
});
