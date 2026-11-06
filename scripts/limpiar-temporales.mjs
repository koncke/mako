#!/usr/bin/env node
// =============================================================================
// limpiar-temporales — lo que los scripts dejan en %TEMP% y nadie borra (6/11/2026)
// =============================================================================
// Pendiente: «unos scripts llenan el disco: hasta 1 GB por día que nadie borra».
//
// ⚠️ MEDIDO EL 6/11/2026, Y LA CULPA NO ESTABA REPARTIDA COMO DECÍA EL PENDIENTE:
//   · `tsx-marti` (la caché de transpilado de tsx): **216.852 entradas de primer nivel**. Un `du` sobre esa carpeta no
//     terminó en 120 segundos. Es la que llena el disco.
//   · `mako-cdp-*` (los perfiles de Chrome): **0 carpetas** en ese momento. El agujero existía igual —ninguno de los tres
//     scripts borraba el suyo, y eso se arregló en `scripts/perfil-cdp.mjs`—, pero no es lo que está ocupando el disco hoy.
//   La regla: antes de barrer, contar. «Estos dos llenan el disco» eran uno grande y uno teórico.
//
// Uso:
//   node scripts/limpiar-temporales.mjs            # dice qué borraría, sin borrar nada
//   node scripts/limpiar-temporales.mjs --aplicar  # borra
//   node scripts/limpiar-temporales.mjs --aplicar --dias 3
//
// ⚠️ NO BORRA LO DE HOY. La caché de tsx la está usando cualquier chat que corra un test en este momento: sacarle una entrada
// a un proceso vivo lo hace fallar con un error que no tiene nada que ver con su código. Por eso el corte es por fecha de
// modificación (`--dias`, 2 por default) y nunca toca la carpeta raíz, sólo lo de adentro.
// =============================================================================

import { readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIA_MS = 86_400_000;

/** Lo que se barre: una carpeta entera (los perfiles) o lo de ADENTRO de una (la caché de tsx, que se reusa). */
export const BLANCOS = [
  { patron: /^mako-cdp-/, adentro: false, que: 'perfiles de Chrome de los scripts de CDP' },
  { patron: /^tsx-/, adentro: true, que: 'caché de transpilado de tsx' },
];

/** Qué se borraría: `[{ ruta, que, dias }]`. `ahora` y `base` se inyectan para poder probarlo. */
export function aBorrar({ base = tmpdir(), dias = 2, ahora = Date.now(), ls = readdirSync, st = statSync } = {}) {
  const corte = ahora - dias * DIA_MS;
  const out = [];
  let raices = [];
  try { raices = ls(base); } catch { return out; }
  for (const nombre of raices) {
    const blanco = BLANCOS.find((b) => b.patron.test(nombre));
    if (!blanco) continue;
    const raiz = join(base, nombre);
    const candidatos = blanco.adentro
      ? (() => { try { return ls(raiz).map((n) => join(raiz, n)); } catch { return []; } })()
      : [raiz];
    for (const ruta of candidatos) {
      let mtime;
      try { mtime = st(ruta).mtimeMs; } catch { continue; }
      if (mtime >= corte) continue; // en uso, o de hoy
      out.push({ ruta, que: blanco.que, dias: Math.floor((ahora - mtime) / DIA_MS) });
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const i = args.indexOf('--dias');
  const dias = i >= 0 ? Number(args[i + 1]) : 2;
  if (!Number.isFinite(dias) || dias < 1) { console.error('--dias tiene que ser un número de 1 para arriba.'); return 1; }

  const lista = aBorrar({ dias });
  if (!lista.length) { console.log(`Nada para borrar en ${tmpdir()} con más de ${dias} día(s).`); return 0; }
  const porQue = new Map();
  for (const x of lista) porQue.set(x.que, (porQue.get(x.que) ?? 0) + 1);
  for (const [que, n] of porQue) console.log(`${n.toLocaleString('es-AR')} · ${que}`);
  if (!aplicar) {
    console.log(`\nSon ${lista.length.toLocaleString('es-AR')} en total, sin tocar nada de los últimos ${dias} día(s).`);
    console.log('Para borrarlos: node scripts/limpiar-temporales.mjs --aplicar');
    return 0;
  }
  let ok = 0;
  let fallaron = 0;
  for (const x of lista) {
    try { rmSync(x.ruta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); ok++; }
    catch { fallaron++; } // uno en uso no frena al resto
  }
  console.log(`\nBorrados ${ok.toLocaleString('es-AR')}${fallaron ? `; ${fallaron.toLocaleString('es-AR')} en uso, quedaron` : ''}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
