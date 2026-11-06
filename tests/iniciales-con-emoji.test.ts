// =============================================================================
// Las iniciales de un avatar, UNA pieza (lib/unicode-seguro.ts → iniciales), sin medio emoji (25/10/2026)
// =============================================================================
// Lo vio Automations: un nombre que empieza con un emoji («🚀 Martín») dibujaba «�M» en el avatar. Cada pantalla tenía su
// copia con `w[0]` / `charAt(0)` / `slice(0, 1)`, que toman la primera UNIDAD UTF-16 (la mitad de un emoji). Esto fija:
//   1. la pieza: la primera letra o número de cada palabra, saltando emojis y símbolos, nunca una mitad;
//   2. la guarda: ninguna pantalla vuelve a sacar iniciales a mano con el primer «carácter» de cada palabra.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 2/0): la pieza con `palabra[0]` → 1 rojo (1); una copia vieja de vuelta en
// app/_ui/Avatar.tsx → 1 rojo (2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { iniciales } from '../lib/unicode-seguro';

const RAIZ = join(__dirname, '..');
const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('1. la primera letra de cada palabra, saltando emojis y símbolos; nunca medio emoji', () => {
  assert.equal(iniciales('🚀 Martín Koncke'), 'MK', 'el emoji suelto adelante no es una palabra con letra');
  assert.equal(iniciales('😀Ana'), 'A', 'pegado a la palabra: se saltea');
  assert.equal(iniciales('ana maría lópez'), 'AM', 'dos, como siempre');
  assert.equal(iniciales('élida ñandú'), 'ÉÑ');
  assert.equal(iniciales('Ana'), 'A');
  assert.equal(iniciales('🚀'), '?', 'sin ninguna letra: lo de sin nada');
  assert.equal(iniciales('   ', 2, '·'), '·');
  assert.equal(iniciales(null), '?');
  assert.equal(iniciales('Martín', 1, 'T'), 'M');
  assert.equal(iniciales('3er Piso'), '3P', 'un número también es inicial');
  for (const n of ['🚀 Martín', '👩‍💻Ana Torres', '🇦🇷 Equipo', '𝐀𝐧𝐚 B', '#1 Ventas']) {
    assert.doesNotMatch(iniciales(n), SUELTO, `«${n}» dio medio emoji`);
  }
});

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '_opencut') archivos(p, fuera); } else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('2. ninguna pantalla saca las iniciales a mano con el primer «carácter» de cada palabra', () => {
  // Las formas de las copias viejas: `.map((w) => w[0]…)` sobre un `split(/\s+/)`, y `${p[0][0]}${p[1][0]}`.
  const VIEJAS = [/split\(\/\\s\+\/\)[^;\n]*\.map\(\((\w+)\) => \1\[0\]/, /\$\{(\w+)\[0\]\[0\]\}\$\{\1\[1\]\[0\]\}/, /\(\(\w+\[0\]\?\.\[0\] \|\| ''\) \+ \(\w+\[1\]\?\.\[0\]/];
  const malos: string[] = [];
  for (const f of archivos(join(RAIZ, 'app'))) {
    const src = readFileSync(f, 'utf8');
    if (VIEJAS.some((re) => re.test(src))) malos.push(relative(RAIZ, f).replace(/\\/g, '/'));
  }
  assert.deepEqual(malos, [], 'iniciales a mano: usa `iniciales` de lib/unicode-seguro.ts (un nombre con emoji dibuja «�»)');
});

/**
 * 3. LA INICIAL DE UNA SOLA LETRA, que es por donde se escapó dos veces (6/11/2026).
 *
 * El caso 2 busca las formas de MUCHAS palabras (`split` + `map`). Una inicial de UNA letra
 * —`nombre.charAt(0).toUpperCase()`— no tiene esa forma, así que pasaba. Y cuesta la pantalla entera:
 * el HTML del server no puede llevar media pieza de emoji («�»), el navegador sí la tiene, y React
 * tira el árbol al hidratar con un #418. Pasó en /calendario (ticket #10, 27/10) y en el CRM
 * (ticket #39, 1/11). El 6/11 seguía vivo en los TRES lugares de Competitors Spy, donde los nombres
 * vienen de Instagram y el emoji en el nombre es la norma.
 *
 * ⚠️ LO QUE NO SE MARCA: poner la mayúscula a una palabra conocida
 * (`charAt(0).toUpperCase() + x.slice(1)`) conserva el resto, así que no corta nada. Por eso la
 * línea con `slice(1)` queda afuera: lo peligroso es tomar la primera unidad y TIRAR el resto.
 *
 * ⚠️ `_opencut`, `_doory` y `_polar` son ports de código ajeno y van afuera, como ya hacía el
 * recorrido de archivos. `_polar` además limpia todo lo que no sea `[a-zA-Z ]` antes de indexar,
 * así que su `charAt(0)` no puede partir un emoji: no es un falso negativo, es que no aplica.
 *
 * PROBADO ROMPIÉNDOLO (6/11/2026): devolver `charAt(0).toUpperCase()` en el `inicial` de
 * app/competitor-spy/SpyApp.tsx da 1 rojo con ese archivo nombrado; dejarlo con `iniciales`, verde.
 */
test('3. ni la inicial de UNA letra: la primera unidad UTF-16 puede ser media pieza de emoji', () => {
  const PELIGRO = /(?:\.charAt\(0\)|\.slice\(0, ?1\)|\[0\])\s*\.toUpperCase\(\)/;
  const CONSERVA_EL_RESTO = /slice\(1\)/;
  const PORTADO = /[/\\]_(?:opencut|doory|polar)[/\\]/;
  const malos: string[] = [];
  for (const f of archivos(join(RAIZ, 'app'))) {
    if (PORTADO.test(f)) continue;
    const rel = relative(RAIZ, f).replace(/\\/g, '/');
    readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
      if (PELIGRO.test(linea) && !CONSERVA_EL_RESTO.test(linea)) malos.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(malos, [], 'la inicial sale de `iniciales(nombre, 1, …)` de lib/unicode-seguro.ts: `charAt(0)` de «🔥 Alex» es media pieza del emoji y tira la pantalla al hidratar (#418)');
});
