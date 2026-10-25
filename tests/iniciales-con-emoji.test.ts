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
