#!/usr/bin/env node
// =============================================================================
// Un choque en una bitácora de /admin/dev que es sólo «los dos agregaron un hito al final» se resuelve solo
// =============================================================================
// Pedido del Cerebro (4/11/2026): puntas con los tests y los tipos en verde perdían «Llevar a main» porque chocaban en
// `app/admin/dev/<área>/bitacora.ts`. Cada chat agrega su hito al FINAL del mismo array, así que dos puntas del mismo día
// insertan en el mismo lugar: para git es un choque, aunque las dos tengan razón. Le pasó tres veces a
// `punta/tickets-0411` y dos a `punta/desktop-offline-t2-2810`.
//
// ⚠️ `merge=union` NO SIRVE ACÁ, y lo probó el Cerebro: junta las líneas de los dos lados, y como dos hitos comparten
// renglones (`  {`, `    fecha: …`, `  },`) el diff los alinea y arma UN objeto con la mitad de cada uno. El guard de las
// bitácoras (scripts/tsc-bitacoras.mjs) lo frena, y la punta queda igual de trabada.
//
// Lo que hace esto, como «merge driver» de git (`merge=bitacora` en .gitattributes, `%O %A %B`):
//   1. la mezcla de siempre (`git merge-file`). Si sale limpia, es ésa: este archivo no inventa nada que git ya resuelve.
//   2. si choca, mira si CADA lado sólo INSERTÓ un bloque, en el MISMO lugar, sin tocar una línea de la base, y si cada
//      bloque es uno o más elementos COMPLETOS del array (`{ … },`). Entonces deja los dos, uno después del otro: primero
//      el de main (%B, lo que ya llegó) y después el de la punta. Si los dos agregaron lo mismo, queda una vez.
//   3. cualquier otra cosa (editaron el mismo hito, borraron uno, insertaron en lugares distintos, un bloque que no cierra)
//      queda como el choque de siempre, con sus marcas: eso lo decide una persona.
//
// En GitHub lo configura punta.yml (paso «Las bitácoras se unen solas al mezclar»). En la PC, para que también ande al
// mezclar a mano:
//   git config merge.bitacora.name "las bitácoras: dos hitos al final, los dos"
//   git config merge.bitacora.driver "node scripts/unir-bitacora.mjs %O %A %B %P"
// Sin esa configuración git usa la mezcla de texto de siempre (el atributo nombra un driver que no existe y git cae al
// suyo, sin error).
//
// ⚠️ SIN IMPORTS DEL REPO: punta.yml lo copia de main a una carpeta temporal para que también sirva a una punta vieja que
// todavía no lo tiene. Sólo `node:`.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Si `x` es `base` con UN bloque insertado (sin tocar nada de la base), dónde y qué. Si no, null. */
export function insercion(base, x) {
  let p = 0;
  while (p < base.length && p < x.length && base[p] === x[p]) p++;
  let s = 0;
  while (s < base.length - p && s < x.length - p && base[base.length - 1 - s] === x[x.length - 1 - s]) s++;
  if (p + s !== base.length) return null; // cambió o borró algo de la base
  return { en: p, bloque: x.slice(p, x.length - s) };
}

/**
 * ¿Estas líneas son uno o más elementos COMPLETOS de un array (`{ … },` seguidos)? Cuenta llaves, corchetes y
 * paréntesis afuera de las cadenas y los comentarios: a profundidad 0 sólo puede haber espacios, comas y el `{` que abre
 * el elemento siguiente, y el bloque termina a profundidad 0 con una coma.
 */
export function sonElementosCompletos(lineas) {
  const t = lineas.join('\n');
  let prof = 0;
  let hayElemento = false;
  let ultimo = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && t[i + 1] === '*') { const f = t.indexOf('*/', i + 2); if (f < 0) return false; i = f + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {
      if (prof === 0) return false; // una cadena suelta entre elementos: esto no es un array de hitos
      let j = i + 1;
      while (j < t.length && t[j] !== c) { if (t[j] === '\\') j++; else if (c !== '`' && t[j] === '\n') return false; j++; }
      if (j >= t.length) return false;
      i = j; ultimo = c; continue;
    }
    if (/\s/.test(c)) continue;
    if (prof === 0) {
      if (c === ',') { if (ultimo !== '}') return false; ultimo = ','; continue; }
      if (c !== '{') return false;
      if (hayElemento && ultimo !== ',') return false;
      hayElemento = true;
    }
    if (c === '{' || c === '[' || c === '(') prof++;
    else if (c === '}' || c === ']' || c === ')') { prof--; if (prof < 0) return false; }
    ultimo = c;
  }
  return hayElemento && prof === 0 && ultimo === ',';
}

/**
 * La unión de dos lados que sólo agregaron elementos en el mismo lugar, o null si no es ese caso. Primero lo de
 * `theirs` (main, lo que ya llegó) y después lo de `ours` (la punta). Conserva el fin de línea de `ours`.
 */
export function unirAgregados(base, ours, theirs) {
  const eol = ours.includes('\r\n') ? '\r\n' : '\n';
  const lineas = (s) => s.replace(/\r\n/g, '\n').split('\n');
  const B = lineas(base);
  const a = insercion(B, lineas(ours));
  const b = insercion(B, lineas(theirs));
  if (!a || !b || a.en !== b.en) return null;
  if (!a.bloque.length || !b.bloque.length) return null; // un lado no agregó nada: eso no es un choque de este tipo
  if (!sonElementosCompletos(a.bloque) || !sonElementosCompletos(b.bloque)) return null;
  const iguales = a.bloque.join('\n') === b.bloque.join('\n');
  const medio = iguales ? b.bloque : [...b.bloque, ...a.bloque];
  return [...B.slice(0, a.en), ...medio, ...B.slice(a.en)].join(eol);
}

/** El driver: `node scripts/unir-bitacora.mjs <base> <ours> <theirs> [ruta]`. Escribe en <ours> y sale 0 si quedó limpio. */
function driver([base, ours, theirs, ruta = ours]) {
  const texto = (f) => readFileSync(f, 'utf8');
  const m = spawnSync('git', ['merge-file', '-p', '-L', 'la punta', '-L', 'la base', '-L', 'main', ours, base, theirs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (m.status === 0) { writeFileSync(ours, m.stdout); return 0; }
  const unido = unirAgregados(texto(base), texto(ours), texto(theirs));
  if (unido != null) {
    writeFileSync(ours, unido);
    console.error(`[unir-bitacora] ${ruta}: los dos lados agregaron hitos al final; quedan los dos, primero los de main.`);
    return 0;
  }
  // El choque de siempre, con sus marcas: lo resuelve una persona.
  if (typeof m.stdout === 'string' && m.stdout.length) writeFileSync(ours, m.stdout);
  console.error(`[unir-bitacora] ${ruta}: no es sólo «los dos agregaron un hito»; queda el choque para resolver a mano.`);
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(driver(process.argv.slice(2)));
}
