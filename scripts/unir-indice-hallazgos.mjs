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
//   Y en los dos caminos se deja UNA FILA POR ÁREA, uniendo las celdas por entrada (`unaFilaPorClave`, más abajo): hace
//   falta incluso cuando la mezcla sale limpia, porque una punta cortada antes del 6/11/2026 trae las filas viejas y git
//   las devuelve. Si alguna entrada no sobrevive textual, esa clave no se toca.
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

// =============================================================================
// Juntar DOS FILAS de la misma área que NO son idénticas (6/11/2026, de noche)
// =============================================================================
// Tirar sólo las idénticas alcanzaba mientras el índice estaba duplicado: eran el caso seguro a ciegas. Dejó de alcanzar
// el día que main pasó a tener UNA fila por área: una punta cortada ANTES de eso tiene las filas viejas, y al mezclar el
// main nuevo **git las devuelve** (un lado borró, el otro conservó → se conserva). Medido en `punta/spy-oferta-capturada`:
// 85 filas para 77 áreas, 8 de más. ⚠️ Y de esas 8, sólo 2 estaban CONTENIDAS en la fila de main: las otras 6 traían la
// cosecha propia de la punta, así que tirarlas por clave **perdería hallazgos**. Por eso se unen por ENTRADA.
//
// ⚠️ El límite de una entrada es `**Título (fecha)**:` —la negrita seguida de DOS PUNTOS—, no cualquier `**negrita**`:
// `**99**, que NO es verde` es un énfasis a mitad de oración, y cortar ahí deja las dos mitades separadas cuando se
// reordena. Y unir por el sufijo común más largo tampoco sirve: arranca a mitad de palabra.
//
// Y nunca se junta a ciegas: si alguna entrada original no aparece TEXTUAL en el resultado, esta clave **no se toca** y
// quedan las dos filas. Mejor un rojo de la guarda, que lo mira una persona, que una entrada perdida en silencio.
const ARRANQUE_DE_ENTRADA = /(?:^|(?<=[\s·]))\*\*[^*]{2,200}\*\*\s*:/g;
const normalizar = (s) => s.replace(/\s+/g, ' ').trim();

/** Parte una celda en entradas de cosecha. Lo que haya antes de la primera es una entrada más (prosa sin título). */
export function entradasDeCelda(celda) {
  const t = celda.trim();
  const cortes = [];
  ARRANQUE_DE_ENTRADA.lastIndex = 0;
  for (let m; (m = ARRANQUE_DE_ENTRADA.exec(t)) !== null; ) cortes.push(m.index);
  if (!cortes.length) return t ? [t] : [];
  const out = cortes[0] > 0 ? [t.slice(0, cortes[0]).trim()] : [];
  for (let i = 0; i < cortes.length; i++) out.push(t.slice(cortes[i], cortes[i + 1]).trim());
  return out.filter(Boolean);
}

/**
 * Une las celdas de varias filas de la MISMA área en una. Cada celda es una lista ordenada de entradas (lo más nuevo
 * adelante, que es como escribe la cosecha), así que se mezclan como listas ordenadas: se emite la cabeza que no
 * aparezca más atrás en ninguna otra. Devuelve null si alguna entrada no sobrevivió textual.
 */
export function unirCeldas(celdas) {
  const limpias = [...new Set(celdas.map((c) => c.trim()))].filter(Boolean);
  const vivas = limpias.filter((x) => !limpias.some((y) => y !== x && y.includes(x))); // contenida es contenida
  let piezas;
  if (vivas.length <= 1) {
    piezas = entradasDeCelda(vivas[0] ?? '');
  } else {
    const listas = vivas.map((c) => entradasDeCelda(c).map(normalizar));
    const textoDe = new Map();
    for (const c of vivas) for (const e of entradasDeCelda(c)) if (!textoDe.has(normalizar(e))) textoDe.set(normalizar(e), e);
    const pos = listas.map(() => 0);
    const puestas = new Set();
    piezas = [];
    for (let guarda = 0; guarda < 20000; guarda++) {
      for (let j = 0; j < listas.length; j++) while (pos[j] < listas[j].length && puestas.has(listas[j][pos[j]])) pos[j]++;
      const cabezas = listas.map((l, i) => (pos[i] < l.length ? { i, k: l[pos[i]] } : null)).filter(Boolean);
      if (!cabezas.length) break;
      const masAtras = (k, propia) => listas.some((l, j) => l.indexOf(k, pos[j] + (j === propia ? 1 : 0)) >= 0);
      const elegida = cabezas.find((c) => !masAtras(c.k, c.i)) ?? cabezas[0];
      piezas.push(textoDe.get(elegida.k));
      puestas.add(elegida.k);
    }
  }
  // una entrada repetida palabra por palabra no aporta (hay celdas que ya la traían dos veces); las cortas no se tocan
  const vistas = new Set();
  const finales = [];
  for (const p of piezas) {
    const k = normalizar(p);
    if (k.length >= 40 && vistas.has(k)) continue;
    vistas.add(k);
    finales.push(p);
  }
  const texto = finales.join(' ').replace(/[ \t]+/g, ' ').trim();
  // la red: todo lo que entró tiene que seguir, textual
  const blob = normalizar(texto);
  for (const c of limpias) for (const e of entradasDeCelda(c)) if (!blob.includes(normalizar(e))) return null;
  return texto;
}

/** Deja UNA fila por área, uniendo las celdas. La fila queda donde estaba la primera. Devuelve { lineas, juntadas }. */
export function unaFilaPorClave(lineas) {
  const porClave = new Map();
  for (const l of lineas) {
    const f = filaDelIndice(l);
    if (!f) continue;
    if (!porClave.has(f.clave)) porClave.set(f.clave, []);
    porClave.get(f.clave).push(l);
  }
  const unido = new Map();
  for (const [clave, filas] of porClave) {
    if (filas.length < 2) continue;
    const texto = unirCeldas(filas.map((l) => filaDelIndice(l).celda));
    if (texto == null) continue; // no se pudo verificar: quedan las dos y lo mira una persona
    const c = filas[0].split('|');
    unido.set(clave, `|${c[1]}|${c[2]}| ${texto} |`);
  }
  if (!unido.size) return { lineas, juntadas: 0 };
  const hechas = new Set();
  const out = [];
  let juntadas = 0;
  for (const l of lineas) {
    const f = filaDelIndice(l);
    if (!f || !unido.has(f.clave)) { out.push(l); continue; }
    if (hechas.has(f.clave)) { juntadas++; continue; }
    hechas.add(f.clave);
    out.push(unido.get(f.clave));
  }
  return { lineas: out, juntadas };
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
  return unaFilaPorClave(out).lineas.join(eol);
}

/** `--consolidar <archivo> [--aplicar]`: deja UNA fila por área, uniendo las celdas sin perder una entrada. */
function consolidar(args) {
  const archivo = args.find((a) => !a.startsWith('--'));
  if (!archivo) { console.error('uso: unir-indice-hallazgos.mjs --consolidar <archivo> [--aplicar]'); return 2; }
  const texto = readFileSync(archivo, 'utf8');
  const eol = texto.includes('\r\n') ? '\r\n' : '\n';
  const { lineas, juntadas } = unaFilaPorClave(texto.replace(/\r\n/g, '\n').split('\n'));
  const filas = lineas.filter((l) => filaDelIndice(l)).length;
  const claves = new Set(lineas.map((l) => filaDelIndice(l)?.clave).filter(Boolean)).size;
  const quedan = filas - claves;
  const aviso = quedan ? ` ⚠️ Quedan ${quedan} fila(s) de más que NO se pudieron verificar: se juntan a mano.` : '';
  if (!juntadas) { console.log(`${archivo}: ${filas} filas para ${claves} área(s), nada que juntar.${aviso}`); return 0; }
  if (!args.includes('--aplicar')) {
    // `filas` ya es la cuenta de DESPUÉS: `lineas` viene unido. Restarle `juntadas` contaría dos veces.
    console.log(`${archivo}: juntaría ${juntadas} fila(s) y quedarían ${filas}. Con --aplicar se escribe.${aviso}`);
    return 0;
  }
  writeFileSync(archivo, lineas.join(eol));
  console.log(`${archivo}: junté ${juntadas} fila(s); quedaron ${filas} para ${claves} área(s).${aviso}`);
  return 0;
}

/** El driver: `node scripts/unir-indice-hallazgos.mjs <base> <ours> <theirs> [ruta]`. Escribe en <ours>; 0 = limpio. */
function driver([base, ours, theirs, ruta = ours]) {
  const texto = (f) => readFileSync(f, 'utf8');
  const m = spawnSync('git', ['merge-file', '-p', '-L', 'la punta', '-L', 'la base', '-L', 'main', ours, base, theirs], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (m.status === 0) {
    const eol = m.stdout.includes('\r\n') ? '\r\n' : '\n';
    // ⚠️ Una mezcla LIMPIA puede dejar filas de más: una punta cortada antes de que main tuviera una fila por área trae
    // las viejas, y «un lado borró, el otro conservó» se resuelve conservando. Así que acá también se junta por área.
    const { lineas, juntadas } = unaFilaPorClave(m.stdout.replace(/\r\n/g, '\n').split('\n'));
    writeFileSync(ours, lineas.join(eol));
    if (juntadas) console.error(`[unir-indice-hallazgos] ${ruta}: mezcla limpia, y junté ${juntadas} fila(s) de la misma área.`);
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
