// =============================================================================
// Los pasos que MaKo le dicta a la persona nombran SÓLO botones que existen (Web Generator)
// =============================================================================
// La cabecera de 'landing-escribir' en lib/mako-capacidades.ts lo decía desde el 11/10/2026: «los pasos nombran
// SÓLO botones que existen: MaKo los repite en un chat y una instrucción inventada se sigue y no se encuentra». Y
// nada lo miraba. La verificación de la tanda 7 (15/10/2026) encontró, con el cuadro nuevo ya en la rama, que MaKo
// seguía diciendo «abre Diagnóstico», «toca Analizar», «toca "Crear nuevo"» y «toca "Generar esquema"»: ninguno
// existe desde que la primera pantalla es UN cuadro con modos. Martín, ese día: «tienen que pasarle absolutamente
// todos los botones. Todas las funciones a la API de MaKo».
//
// Lo que se EJECUTA: cada rótulo entre comillas de los pasos (`como`) de las capacidades del Web Generator se busca
// en el fuente de app/web-generator SIN comentarios (los comentarios de Inicio.tsx todavía nombran «Crear nuevo»:
// un guard que los leyera se engañaría con eso), y como texto de la pantalla: entre comillas de un string o como
// texto de JSX (`>Rótulo<`), no como un pedazo de otra palabra («Plan» no vale por «Planificar»).
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256). Base: 2 / 0.
//   · 'landing-escribir' vuelve a decir «toca "Crear nuevo"»                          → 1 / 1 «cada rótulo…»
//   · lo mismo, con «toca "Crear nuevo"» escrito en un comentario de Inicio.tsx       → 1 / 1 «cada rótulo…»
//   · el modo del cuadro se llama «Analizar» en vez de «Analizar landing»             → 1 / 1 «cada rótulo…»
//   · «Plan» del desplegable pasa a llamarse «Planificar»                              → 1 / 1 «cada rótulo…»
//   · los pasos sin ningún rótulo entre comillas                                       → 1 / 1 «los pasos del Web…»
// Restaurado: 2 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CAPACIDADES } from '../lib/mako-capacidades';

const RAIZ = join(__dirname, '..');
const PANTALLA = join(RAIZ, 'app', 'web-generator');

/** Sin comentarios de línea (enteros o al final de una línea) ni de bloque (también los `{/* … *\/}` de JSX). */
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/(^|[ \t])\/\/.*$/gm, '$1');

function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...fuentes(p));
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Los rótulos entre comillas de un paso. Un «/» suelto es una tecla, no un botón. */
const rotulos = (paso: string) => [...paso.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((r) => /\p{L}/u.test(r));

const DEL_WEB_GENERATOR = CAPACIDADES.filter((c) => c.tab === 'Web Generator');

test('los pasos del Web Generator nombran sus botones entre comillas (el guard no mira el vacío)', () => {
  assert.ok(DEL_WEB_GENERATOR.length >= 2, 'no encontré las capacidades del Web Generator');
  const todos = DEL_WEB_GENERATOR.flatMap((c) => c.como.flatMap(rotulos));
  assert.ok(todos.length >= 3, `muy pocos rótulos entre comillas: ${JSON.stringify(todos)}`);
});

test('cada rótulo entre comillas de los pasos existe como texto de la pantalla (sin contar comentarios)', () => {
  const src = fuentes(PANTALLA).map((f) => sinComentarios(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'))).join('\n');
  const faltan: string[] = [];
  for (const c of DEL_WEB_GENERATOR) {
    for (const r of c.como.flatMap(rotulos)) {
      // Entre comillas de un string ('…', "…", `…`) o como texto de JSX (>…<), con espacios alrededor.
      const re = new RegExp('(?:[\'"\\x60]|>)\\s*' + escapar(r) + '\\s*(?:[\'"\\x60]|<)');
      if (!re.test(src)) faltan.push(`${c.id}: "${r}"`);
    }
  }
  assert.deepEqual(faltan, [], 'MaKo le dice a la persona que toque un botón que la pantalla no tiene');
});
