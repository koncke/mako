// =============================================================================
// Ningún archivo de la extensión trae un «no carácter» ni un surrogate suelto (26/10/2026)
// =============================================================================
// La extensión de Martín dejó de cargar (sin ícono, sin el puente en hola-mako.com, también sin Flow). Chrome: «No se ha
// podido cargar el archivo "wa-fichas.js" para el script de contenido. No está codificado con UTF-8.» El archivo ERA UTF-8
// válido, pero traía un U+FFFF LITERAL (`IDBKeyRange.bound('false_', 'false_<U+FFFF>')`): Chrome rechaza los no caracteres
// (U+FFFE/U+FFFF de cada plano y U+FDD0–U+FDEF) en un content script, y python, `file` y `node --check` lo dan por bueno.
// Se coló porque la herramienta de edición convirtió la secuencia de escape en el carácter. El diagnóstico obvio fue el
// equivocado: «se recargó demasiadas veces» (lo encontró el Cerebro leyendo chrome://extensions).
// Esto mira cada .js, .json y .html de extension/ por número de código (sin escapes que el camino se pueda comer). Y el
// U+FFFD: un surrogate suelto mal codificado llega así al leer el archivo.
// PROBADO ROMPIÉNDOLO: ver el pie.
// Correr: node --import tsx --test tests/extension-sin-no-caracteres.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const carpeta = join(raiz, 'extension');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.(js|json|html)$/i.test(n) ? [p] : [];
  });
}

/** Los no caracteres, surrogates sueltos y U+FFFD de un texto, con su renglón. */
export function prohibidos(s: string): Array<{ linea: number; cp: string }> {
  const out: Array<{ linea: number; cp: string }> = [];
  let linea = 1;
  const hex = (n: number) => `U+${n.toString(16).toUpperCase().padStart(4, '0')}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 10) { linea++; continue; }
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        const cp = ((c - 0xd800) << 10) + (d - 0xdc00) + 0x10000;
        if ((cp & 0xfffe) === 0xfffe) out.push({ linea, cp: hex(cp) });
        i++;
        continue;
      }
      out.push({ linea, cp: `${hex(c)} (surrogate suelto)` });
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) { out.push({ linea, cp: `${hex(c)} (surrogate suelto)` }); continue; }
    if (c === 0xfffe || c === 0xffff || (c >= 0xfdd0 && c <= 0xfdef) || c === 0xfffd) out.push({ linea, cp: hex(c) });
  }
  return out;
}

test('ningún archivo de extension/ trae un no carácter, un surrogate suelto ni U+FFFD (Chrome no carga el content script)', () => {
  const lista = archivos(carpeta);
  assert.ok(lista.length >= 10, 'no encontré los archivos de la extensión');
  const fallas = lista.flatMap((p) => prohibidos(readFileSync(p, 'utf8')).map((x) => `${relative(raiz, p)}:${x.linea} ${x.cp}`));
  assert.deepEqual(fallas, [], 'Chrome rechaza estos caracteres en un content script («No está codificado con UTF-8»): usa la secuencia de escape (barra, u, y el código) en vez del carácter.');
});

test('el detector: los ve, y deja pasar un emoji, una eñe y la secuencia de escape escrita', () => {
  const barra = String.fromCharCode(92);
  assert.deepEqual(prohibidos(`a\n${'b'}${String.fromCharCode(0xffff)}`), [{ linea: 2, cp: 'U+FFFF' }]);
  assert.deepEqual(prohibidos(String.fromCharCode(0xfdd0)).map((x) => x.cp), ['U+FDD0']);
  assert.deepEqual(prohibidos(String.fromCodePoint(0x1fffe)).map((x) => x.cp), ['U+1FFFE']);
  assert.deepEqual(prohibidos(String.fromCharCode(0xd800)).map((x) => x.cp), ['U+D800 (surrogate suelto)']);
  assert.deepEqual(prohibidos('ñandú 🙂 «hola» ' + barra + 'uffff'), []);
});

// PROBADO ROMPIÉNDOLO (26/10/2026), contra una base de 2 / 0, con el caso real: un U+FFFF literal de vuelta en
// extension/wa-fichas.js (`IDBKeyRange.bound('false_', 'false_<U+FFFF>')`) → 1 / 1; restaurado → 2 / 0.
