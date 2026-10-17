#!/usr/bin/env node
// =============================================================================
// replay-fallos-ci.mjs — la PRUEBA de que tests-afectados.mjs sirve: repetir los rojos de Actions
// =============================================================================
// Para cada run de integracion que falló (docs/fallos-ci-integracion.jsonl: 16 al 17/10/2026), toma
// el árbol EXACTO de la cabeza que falló y la base de verdad —el último run VERDE anterior: del
// último verde a la cabeza es lo que Actions tuvo que chequear de nuevo— y pregunta:
//   · si el rojo fue un test: ¿tests-afectados.mjs lo habría elegido?
//   · si fue un error de tipos: ¿el archivo con el error estaría en lo que compila el tsc acotado
//     (scripts/antes-de-subir.mjs → alcanceTsc: lo cambiado + quienes lo importan, un nivel)?
// No hace checkout: lee los objetos de git (`ls-tree` + `cat-file --batch`), ~2 s por run.
//
// Uso:  node scripts/replay-fallos-ci.mjs            # la tabla, y exit 1 si alguno NO sale
//       node scripts/replay-fallos-ci.mjs --md       # la tabla en markdown (la de abajo salió de acá)
//       node scripts/replay-fallos-ci.mjs --solo 80,85
//
// Si agregás un run rojo nuevo, sumalo a docs/fallos-ci-integracion.jsonl (n, sha, base = el último verde,
// rojos[]) y corré esto: si no sale, el script todavía no está.
// =============================================================================

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alcanceTsc, cambiosEntre, fuenteGit, motivoPrincipal, seleccionar } from './tests-afectados.mjs';
import { sinModulo } from './modulos-ts.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function cargarCasos() {
  return readFileSync(path.join(RAIZ, 'docs', 'fallos-ci-integracion.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const tiene = (sha) => { try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: RAIZ, stdio: 'ignore' }); return true; } catch { return false; } };

/** Repite un run. Devuelve { n, sha, base, baseRun, elegidos, total, filas: [{paso, archivo, sale, porque}] }. */
export function repetir(caso) {
  const { archivos, leer } = fuenteGit(caso.sha);
  const cambiados = cambiosEntre(caso.base, caso.sha);
  const sel = seleccionar({ cambiados, archivos, leer });
  const tsc = alcanceTsc({ cambiados, archivos, importadoPor: sel.importadoPor, aumentan: sel.aumentan });
  const cambiadosSet = new Set(cambiados);
  const filas = caso.rojos.map((r) => {
    if (r.paso === 'Tests') {
      const razones = sel.tests.get(r.archivo);
      if (!razones) return { ...r, sale: false, porque: 'ningún motivo' };
      const p = motivoPrincipal(razones);
      const todos = razones.filter((x) => x.tipo !== 'barre' || x === p).map((x) => x.tipo);
      const cadena = p.detalle.split(' → ');
      return { ...r, sale: true, porque: `${p.tipo}: ${cadena.slice(-1)[0]}${p.tipo === 'importa' ? ` (${cadena.length - 1} salto${cadena.length === 2 ? '' : 's'})` : ''}`, tipos: [...new Set(todos)] };
    }
    if (!tsc.includes(r.archivo)) {
      // Runs 51 y 52: el archivo del error NO cambió; chocaba con scripts globales que sí (ver scripts/modulos-ts.mjs).
      const globales = sinModulo(archivos, leer);
      if (globales.includes(r.archivo)) return { ...r, sale: true, porque: `guarda de módulos: ${globales.filter((g) => cambiadosSet.has(g)).map((g) => g.replace(/^tests\//, '')).join(', ') || r.archivo} sin import/export` };
      return { ...r, sale: false, porque: 'fuera del alcance del tsc acotado' };
    }
    if (cambiadosSet.has(r.archivo)) return { ...r, sale: true, porque: 'tsc: el cambio lo toca' };
    const culpable = cambiados.find((c) => sel.importadoPor.get(c)?.has(r.archivo));
    return { ...r, sale: true, porque: `tsc: importa ${culpable}` };
  });
  return { ...caso, cambiados: cambiados.length, elegidos: sel.tests.size, total: sel.totalTests, tsc: tsc.length, filas };
}

function main(argv) {
  const solo = (argv.find((a) => a.startsWith('--solo=')) ?? (argv.includes('--solo') ? `--solo=${argv[argv.indexOf('--solo') + 1]}` : ''))
    .slice(7).split(',').filter(Boolean).map(Number);
  const md = argv.includes('--md');
  const casos = cargarCasos().filter((c) => solo.length === 0 || solo.includes(c.n));
  const resultados = [];
  for (const c of casos) {
    if (!tiene(c.sha) || !tiene(c.base)) { console.error(`  [replay] run ${c.n}: faltan objetos de git (${c.sha}/${c.base}); corré \`git fetch origin\``); resultados.push({ ...c, filas: c.rojos.map((r) => ({ ...r, sale: false, porque: 'sin objetos' })), cambiados: 0, elegidos: 0, total: 0 }); continue; }
    resultados.push(repetir(c));
  }
  const filas = resultados.flatMap((r) => r.filas.map((f) => ({ r, f })));
  const bien = filas.filter(({ f }) => f.sale).length;
  const cab = md ? ['| run | cabeza | base (run) | paso | el rojo | lo elige porque | tests elegidos |', '|---|---|---|---|---|---|---|'] : [];
  const lineas = filas.map(({ r, f }) => {
    const base = `${r.base.slice(0, 9)}${r.baseRun ? ` (${r.baseRun})` : ' (sin verde)'}`;
    const elegidos = f.paso === 'Tests' ? `${r.elegidos}/${r.total}` : `tsc: ${r.tsc} archivos`;
    const archivo = f.archivo.replace(/^tests\//, '');
    return md
      ? `| ${r.n} | ${r.sha.slice(0, 9)} | ${base} | ${f.paso} | ${archivo} | ${f.sale ? `✔ ${f.porque}` : `✖ ${f.porque}`} | ${elegidos} |`
      : `${f.sale ? '✔' : '✖'} run ${String(r.n).padStart(2)} ${r.sha.slice(0, 9)} base ${base.padEnd(18)} ${f.paso.padEnd(5)} ${archivo.padEnd(42)} ${f.porque} · ${elegidos}`;
  });
  console.log([...cab, ...lineas].join('\n'));
  console.log(`\n${bien}/${filas.length} rojos de ${resultados.length} runs: ${bien === filas.length ? 'el script los habría frenado a todos' : 'ALGUNO NO SALE: el script todavía no está'}`);
  return bien === filas.length ? 0 : 1;
}

if (process.argv[1] && existsSync(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
