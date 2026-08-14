// Deja la carpeta LOCAL del curso con el mismo nombre y la misma estructura que Drive
// y que la plataforma: «<Curso> - <Autor>/<NN Módulo>/…».
//
// Por qué: el nombre local era el slug (`aumenta-tu-valor-y-atv-advantage`) y todo
// plano, mientras en Drive ya se usa «<Curso> - <Autor>» con subcarpetas por módulo.
// Dos convenciones distintas para lo mismo obliga a traducir de cabeza cada vez.
//
// Qué mueve y qué NO:
//   video/  → por módulo    (es lo que se navega)
//   texto/  → por módulo    (es lo que se lee para escribir los apuntes)
//   audio/  → queda PLANO   (es intermedio: no se navega, y moverlo obliga a que
//                            los transcriptores sepan el módulo sin ganar nada)
//   recursos/ → queda plano (ya vienen con el número de módulo en el nombre)
//
// Los .json de trabajo (plan, drive, sa-fileids, bajados) se quedan en la raíz: son
// la memoria del pipeline y todos los scripts los buscan al lado del plan.
//
// Simula por defecto. Con --aplicar mueve de verdad.
//
//   node <abs>\scripts\curso-organizar.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-organizar.mjs --plan … --aplicar

import { readFileSync, existsSync, readdirSync, mkdirSync, renameSync, rmdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const APLICAR = process.argv.includes('--aplicar');

const PLAN = arg('plan', '');
if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
let base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120);
const nDe = (f) => { const m = /^(\d{1,3})\s*-\s*/.exec(f); return m ? Number(m[1]) : null; };
const esIntermedio = (f) => /\.f[^.]*\.(mp4|mkv|webm|m4v)$/i.test(f);

// Misma regla que curso-a-drive: «<NN> Módulo», con el número al frente y pad a 2.
const carpetaDe = (c) => limpio(c.modulo ?? 'Sin módulo').replace(/^(\d+)\.\s*/, (_, n) => `${String(n).padStart(2, '0')} `);
const moduloPorClase = new Map(plan.clases.map((c) => [c.n, carpetaDe(c)]));

console.log(`\n  Curso : ${plan.curso}${plan.autor ? ` — ${plan.autor}` : ''}`);
console.log(`  Modo  : ${APLICAR ? 'APLICAR (mueve de verdad)' : 'simulación'}\n`);

// ── 1. El nombre de la carpeta raíz ──────────────────────────────────────────
// ⚠️ NO se agrega el autor si el título ya lo nombra: «Jaque Blue - Creacion de
// Contenido» de Jaque Blue daba «… - Jaque Blue - Jaque Blue». Es la MISMA regla que
// aplican curso-a-drive.mjs, curso-a-portal.mjs y el mapa AUTOR de catalogo.ts — el
// punto es que la carpeta local y la de Drive se llamen igual, y si cada script
// decide por su cuenta terminan divergiendo (acá se arregló último, y por unas horas
// la local decía una cosa y la de Drive otra).
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const autorPlan = plan.autor?.trim() ?? '';
const nombreDestino = autorPlan && !sinAcentos(plan.curso).includes(sinAcentos(autorPlan))
  ? `${limpio(plan.curso)} - ${limpio(autorPlan)}`
  : limpio(plan.curso);
const raizNueva = join(dirname(base), nombreDestino);

if (basename(base) !== nombreDestino) {
  console.log(`  Raíz: «${basename(base)}»  →  «${nombreDestino}»`);
  if (APLICAR) {
    if (existsSync(raizNueva)) { console.error(`  ✖ Ya existe ${raizNueva}. No piso nada.\n`); process.exit(1); }
    try {
      renameSync(base, raizNueva);
      console.log(`  ✓ renombrada`);
    } catch (e) {
      // ⚠️ En Windows un handle abierto sobre el DIRECTORIO hace fallar el rename con
      // EPERM aunque ningún proceso lo tenga como cwd: lo agarran Drive for Desktop,
      // el indexador o el antivirus, y no se puede esperar a que suelten.
      // Mover los HIJOS sí funciona: el lock es del handle del directorio, no de su
      // contenido. Se crea el destino, se mueve cada entrada y se borra el cascarón.
      if (e.code !== 'EPERM' && e.code !== 'EBUSY' && e.code !== 'EACCES') throw e;
      console.log(`  (rename directo falló con ${e.code} — muevo el contenido)`);
      mkdirSync(raizNueva, { recursive: true });
      for (const entrada of readdirSync(base)) renameSync(join(base, entrada), join(raizNueva, entrada));
      try { rmdirSync(base); console.log(`  ✓ movida`); }
      catch { console.log(`  ✓ movida (quedó la carpeta vieja VACÍA: ${base} — borrala cuando el handle se suelte)`); }
    }
    base = raizNueva;
    console.log('');
  } else { console.log(`  (simulación: no la toco)\n`); }
} else {
  console.log(`  Raíz: ya se llama «${nombreDestino}»\n`);
}

// ── 2. Subcarpetas por módulo ────────────────────────────────────────────────
const organizar = (sub, extensiones) => {
  const dir = join(base, sub);
  if (!existsSync(dir)) return;
  const sueltos = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && extensiones.test(e.name) && !esIntermedio(e.name));

  if (!sueltos.length) { console.log(`  ${sub}/  ya está organizado (0 archivos sueltos)`); return; }

  let movidos = 0, sinModulo = 0;
  const porCarpeta = new Map();
  for (const e of sueltos) {
    const n = nDe(e.name);
    const carpeta = n != null ? moduloPorClase.get(n) : null;
    if (!carpeta) { sinModulo++; continue; }
    porCarpeta.set(carpeta, (porCarpeta.get(carpeta) ?? 0) + 1);
    if (!APLICAR) continue;
    const dst = join(dir, carpeta);
    mkdirSync(dst, { recursive: true });
    const destino = join(dst, e.name);
    // Nunca se pisa: si ya hay uno con ese nombre, se deja donde está y se avisa.
    if (existsSync(destino)) { console.log(`    ⚠ ya existía en destino, lo dejo: ${e.name}`); continue; }
    renameSync(join(dir, e.name), destino);
    movidos++;
  }
  console.log(`  ${sub}/  ${sueltos.length} archivo(s) → ${porCarpeta.size} carpeta(s)${APLICAR ? ` · ${movidos} movido(s)` : ''}${sinModulo ? ` · ⚠ ${sinModulo} sin módulo (se quedan sueltos)` : ''}`);
  if (!APLICAR) {
    for (const [c, n] of [...porCarpeta].sort()) console.log(`      ${c}  ${n}`);
  }
};

organizar('video', /\.(mp4|mkv|webm|m4v)$/i);
organizar('texto', /\.md$/i);

// audio/ y recursos/ quedan planos a propósito (ver la cabecera).
for (const sub of ['audio', 'recursos']) {
  const dir = join(base, sub);
  if (existsSync(dir)) {
    const n = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).length;
    console.log(`  ${sub}/  ${n} archivo(s), plano a propósito`);
  }
}

console.log(`\n  ${APLICAR ? 'Listo' : 'Simulación terminada'}. Carpeta: ${base}`);
if (!APLICAR) console.log(`  Para hacerlo de verdad: agregá --aplicar\n`);
else console.log(`  ⚠ El _indice.md de texto/ apunta a los nombres viejos: se regenera solo\n    en la próxima corrida del transcriptor.\n`);
