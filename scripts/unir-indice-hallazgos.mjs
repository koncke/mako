#!/usr/bin/env node
// =============================================================================
// El ÍNDICE de hallazgos se une por celda, no por líneas: `merge=union` lo DUPLICA (6/11/2026)
// =============================================================================
// `docs/hallazgos*.md merge=union` (.gitattributes) es correcto para los documentos POR ÁREA: cada cosecha agrega una
// sección nueva, así que juntar las líneas de los dos lados deja las dos secciones.
//
// ⚠️ PERO EL GLOB TAMBIÉN AGARRA `docs/hallazgos.md`, QUE NO ES ESO. El índice es una TABLA con UNA FILA POR ÁREA, y una
// cosecha no agrega una fila: REESCRIBE la celda de su área metiendo su entrada adelante. Para `union`, la fila vieja y la
// fila nueva son dos líneas distintas, así que **deja las dos**. Cada punta que cosecha duplica la fila de su área, y la
// siguiente duplica la duplicada.
//
// Medido el 6/11/2026 en main: **207 filas de datos para 110 rótulos de área y sólo 53 documentos** `hallazgos-*.md` en
// disco. Competitors Spy tenía 27 filas; Infraestructura, 24. Cuatro filas eran la MISMA, palabra por palabra — incluida la
// fila que documenta este problema, duplicada por el problema que documenta.
//
// ⚠️ Y la regla «Una fila por área» que el índice declara arriba (6/11/2026) no alcanzaba, porque no es algo que alguien
// esté haciendo mal: lo duplica la MEZCLA, después de que los dos lados escribieron bien. **Un documento que se corrige a
// mano contra algo que lo rompe solo, pierde.**
//
// Lo que hace esto, como «merge driver» de git (`merge=indice-hallazgos` en .gitattributes, `%O %A %B %P`):
//   1. la mezcla de siempre (`git merge-file`). Si sale limpia, es ésa: acá no se inventa nada que git ya resuelve.
//   2. si choca, sólo entiende UN caso: los dos lados tocaron CELDAS de la tabla y nada más (mismas filas, mismas líneas
//      fuera de la tabla). Entonces une celda por celda: si los dos metieron texto ADELANTE de lo que había, quedan los dos
//      (primero el de main, después el de la punta, como en las bitácoras). Si los dos escribieron lo mismo, queda una vez.
//   3. cualquier otra cosa —una fila nueva, una borrada, el encabezado cambiado de los dos lados, una celda reescrita de
//      punta a punta— queda como el choque de siempre, con sus marcas, y lo resuelve una persona.
//   Y en los dos caminos se tiran las filas BYTE A BYTE IDÉNTICAS, que sólo pueden ser daño de `union`.
//
// También se puede correr a mano para reparar lo ya duplicado, sin mezclar nada:
//   node scripts/unir-indice-hallazgos.mjs --consolidar docs/hallazgos.md          # dice cuántas filas sacaría
//   node scripts/unir-indice-hallazgos.mjs --consolidar docs/hallazgos.md --aplicar
//
// En GitHub lo configura punta.yml (el mismo paso que el de las bitácoras). En la PC, una vez por clon:
//   git config merge.indice-hallazgos.name "el índice de hallazgos: una fila por área, las dos entradas"
//   git config merge.indice-hallazgos.driver "node scripts/unir-indice-hallazgos.mjs %O %A %B %P"
// Sin esa configuración git usa la mezcla de siempre (el atributo nombra un driver que no existe y git cae al suyo).
//
// ⚠️ SIN IMPORTS DEL REPO: punta.yml lo copia de main a una carpeta temporal para que también sirva a una punta vieja que
// todavía no lo tiene. Sólo `node:`.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Una fila de la tabla del índice: `| Área | [doc](doc.md) | lo que cubre |`. La clave son las DOS primeras celdas. */
export function filaDelIndice(linea) {
  if (!linea.startsWith('|')) return null;
  const celdas = linea.split('|');
  // `| a | b | c |` parte en ['', ' a ', ' b ', ' c ', '']: hacen falta al menos tres celdas de contenido.
  if (celdas.length < 5) return null;
  if (!/\]\(hallazgos[-.]/.test(celdas[2] ?? '')) return null; // la 2.ª celda es el link al documento del área
  const clave = `${celdas[1].trim()}|${celdas[2].trim()}`;
  return { clave, celda: celdas.slice(3, -1).join('|'), cola: celdas[celdas.length - 1] };
}

/** `b` metido ADELANTE de `a`: devuelve lo que se agregó, o null si no es un prefijo nuevo. */
const prefijoNuevo = (base, x) => (x.length > base.length && x.endsWith(base) ? x.slice(0, x.length - base.length) : null);

/** Las filas idénticas sobran: sólo pueden ser daño de `merge=union`. Devuelve { lineas, sacadas }. */
export function sinFilasRepetidas(lineas) {
  const vistas = new Set();
  const out = [];
  let sacadas = 0;
  for (const l of lineas) {
    if (filaDelIndice(l) && vistas.has(l)) { sacadas++; continue; }
    if (filaDelIndice(l)) vistas.add(l);
    out.push(l);
  }
  return { lineas: out, sacadas };
}

/**
 * Une el índice cuando los dos lados sólo tocaron CELDAS de filas que ya existían. Devuelve el texto, o null si es
 * cualquier otro choque (y entonces lo resuelve una persona).
 */
export function unirPorCelda(base, ours, theirs) {
  const eol = ours.includes('\r\n') ? '\r\n' : '\n';
  const lineas = (s) => s.replace(/\r\n/g, '\n').split('\n');
  const B = lineas(base);
  const A = lineas(ours);
  const T = lineas(theirs);
  // El esqueleto tiene que ser el mismo: misma cantidad de líneas, y las de fuera de la tabla iguales en los tres.
  if (A.length !== B.length || T.length !== B.length) return null;
  const out = [];
  for (let i = 0; i < B.length; i++) {
    const fb = filaDelIndice(B[i]);
    const fa = filaDelIndice(A[i]);
    const ft = filaDelIndice(T[i]);
    if (!fb || !fa || !ft) {
      // Fuera de la tabla: se acepta que UN lado haya cambiado, no los dos distinto.
      if (A[i] === T[i] || A[i] === B[i]) { out.push(A[i] === B[i] ? T[i] : A[i]); continue; }
      if (T[i] === B[i]) { out.push(A[i]); continue; }
      return null;
    }
    if (fa.clave !== fb.clave || ft.clave !== fb.clave) return null; // se movió o se reemplazó una fila
    if (A[i] === T[i] || A[i] === B[i]) { out.push(A[i] === B[i] ? T[i] : A[i]); continue; }
    if (T[i] === B[i]) { out.push(A[i]); continue; }
    // Los dos tocaron esta celda: sólo se entiende «los dos metieron texto adelante».
    const pa = prefijoNuevo(fb.celda, fa.celda);
    const pt = prefijoNuevo(fb.celda, ft.celda);
    if (pa == null || pt == null) return null;
    const celda = `${pt}${pa}${fb.celda}`; // primero lo que ya llegó a main, después lo de la punta
    out.push(`|${B[i].split('|')[1]}|${B[i].split('|')[2]}|${celda}|${fb.cola}`);
  }
  return sinFilasRepetidas(out).lineas.join(eol);
}

/** `--consolidar <archivo> [--aplicar]`: saca las filas repetidas de un índice ya dañado. */
function consolidar(args) {
  const archivo = args.find((a) => !a.startsWith('--'));
  if (!archivo) { console.error('uso: unir-indice-hallazgos.mjs --consolidar <archivo> [--aplicar]'); return 2; }
  const texto = readFileSync(archivo, 'utf8');
  const eol = texto.includes('\r\n') ? '\r\n' : '\n';
  const { lineas, sacadas } = sinFilasRepetidas(texto.replace(/\r\n/g, '\n').split('\n'));
  const filas = lineas.filter((l) => filaDelIndice(l)).length;
  if (!sacadas) { console.log(`${archivo}: ${filas} filas, ninguna repetida.`); return 0; }
  if (!args.includes('--aplicar')) {
    console.log(`${archivo}: sacaría ${sacadas} fila(s) repetida(s) y quedarían ${filas}. Con --aplicar se escribe.`);
    return 0;
  }
  writeFileSync(archivo, lineas.join(eol));
  console.log(`${archivo}: saqué ${sacadas} fila(s) repetida(s); quedaron ${filas}.`);
  return 0;
}

/** El driver: `node scripts/unir-indice-hallazgos.mjs <base> <ours> <theirs> [ruta]`. Escribe en <ours>; 0 = limpio. */
function driver([base, ours, theirs, ruta = ours]) {
  const texto = (f) => readFileSync(f, 'utf8');
  const m = spawnSync('git', ['merge-file', '-p', '-L', 'la punta', '-L', 'la base', '-L', 'main', ours, base, theirs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (m.status === 0) {
    const eol = m.stdout.includes('\r\n') ? '\r\n' : '\n';
    const { lineas, sacadas } = sinFilasRepetidas(m.stdout.replace(/\r\n/g, '\n').split('\n'));
    writeFileSync(ours, lineas.join(eol));
    if (sacadas) console.error(`[unir-indice-hallazgos] ${ruta}: mezcla limpia, y saqué ${sacadas} fila(s) repetida(s).`);
    return 0;
  }
  const unido = unirPorCelda(texto(base), texto(ours), texto(theirs));
  if (unido != null) {
    writeFileSync(ours, unido);
    console.error(`[unir-indice-hallazgos] ${ruta}: los dos lados cosecharon en la tabla; quedan las dos entradas, primero la de main.`);
    return 0;
  }
  if (typeof m.stdout === 'string' && m.stdout.length) writeFileSync(ours, m.stdout);
  console.error(`[unir-indice-hallazgos] ${ruta}: no es sólo «los dos cosecharon en su celda»; queda el choque para resolver a mano.`);
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  process.exit(args[0] === '--consolidar' ? consolidar(args.slice(1)) : driver(args));
}
