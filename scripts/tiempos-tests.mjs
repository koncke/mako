#!/usr/bin/env node
// =============================================================================
// tiempos-tests.mjs — la tabla de los archivos de test más lentos, desde lo que dejó reporter-tiempos.mjs
// =============================================================================
// Uso:  node scripts/tiempos-tests.mjs <tiempos.tsv> [--top 15]
// Imprime markdown (va al resumen del run en Actions). Un archivo que aparece dos veces (un reintento aislado de un rojo)
// se queda con su tiempo MAYOR: es el que costó. Sin archivo o vacío, lo dice y sale con 0: es un dato de más, no un rojo.
// =============================================================================

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Lee el TSV y devuelve [{ ms, archivo, medida, rojo }] de mayor a menor, uno por archivo. */
export function tabla(texto) {
  const porArchivo = new Map();
  for (const l of String(texto).split('\n')) {
    const [ms, archivo, medida = 'archivo', estado = 'verde'] = l.replace(/\r$/, '').split('\t');
    if (!archivo || !/^\d+$/.test(ms ?? '')) continue;
    const fila = { ms: Number(ms), archivo, medida, rojo: estado === 'rojo' };
    const antes = porArchivo.get(archivo);
    if (!antes || fila.ms > antes.ms) porArchivo.set(archivo, { ...fila, rojo: fila.rojo || antes?.rojo === true });
  }
  return [...porArchivo.values()].sort((a, b) => b.ms - a.ms || a.archivo.localeCompare(b.archivo));
}

const seg = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

export function markdown(filas, top = 15) {
  if (filas.length === 0) return 'Sin tiempos por archivo (no corrió ningún test con el reporter).';
  const total = filas.reduce((s, f) => s + f.ms, 0);
  const lineas = [
    `**Los ${Math.min(top, filas.length)} archivos de test más lentos** (de ${filas.length}; suman ${seg(total)} s de proceso, no de reloj: corren de a varios).`,
    '',
    '| s | archivo | medida |',
    '|---:|---|---|',
    ...filas.slice(0, top).map((f) => `| ${seg(f.ms)} | \`${f.archivo}\`${f.rojo ? ' ✖' : ''} | ${f.medida === 'casos' ? 'suma de casos (compartido, sin la carga)' : 'el archivo entero'} |`),
  ];
  return lineas.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [archivo, ...resto] = process.argv.slice(2);
  const i = resto.indexOf('--top');
  const top = i >= 0 ? Number(resto[i + 1]) || 15 : 15;
  const texto = archivo && existsSync(archivo) ? readFileSync(archivo, 'utf8') : '';
  process.stdout.write(markdown(tabla(texto), top) + '\n');
}
