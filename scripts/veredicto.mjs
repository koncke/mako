#!/usr/bin/env node
// =============================================================================
// veredicto.mjs — los tests que ya corrieron sobre el mismo árbol no se pagan otra vez en GitHub
// =============================================================================
// Martín, 4/11/2026 (por el Cerebro): «Por que actions subió tanto?... Y estamos con 1 sola cuenta, imagina que tengo 5
// cuentas... No debe subir tanto el precio ese... No hay otra manera de resolverlo? Que los chats en la nube hagan los
// testeos o algo así...». Medido ese día: 159 corridas de punta.yml, 2.157 min; una punta de código, 13,7 min, de los que
// 7,7 son tests (690 de 2.137 archivos: casi todo importa el registro de la API) y 4,5 el tsc entero. Ver
// docs/hallazgos-infra.md → «Actions sin repetir».
//
// QUÉ ES UN VEREDICTO: «estos tests pasaron sobre ESTE árbol». Hay dos:
//   · el de una sesión de la NUBE (`sacar`): corre los tests afectados y el tsc entero con Node 24 —el de Actions— y lo
//     deja como un renglón `Veredicto:` en el mensaje del último commit. El árbol del commit es lo que se probó: el renglón
//     no es parte del árbol, así que no se muerde la cola.
//   · el de ACTIONS (`guardar`): lo que una corrida de punta.yml dejó en verde, en la caché de esa rama. Sirve cuando la
//     misma punta vuelve a subir (se arregló un rojo, se relanzó): no se repite lo que ya pasó y nada tocó.
//
// QUÉ HACE GITHUB CON ÉL (`revisar`, en punta.yml): lo ata al árbol, a la base y a la SELECCIÓN —recalcula qué tests le
// tocaban a esa punta y exige el mismo hash—, y después mezcla main. Repite SÓLO lo que la mezcla pudo cambiar:
//   · los tests que miran algo que cambió entre el árbol probado y el mezclado (las barredoras siempre, si cambió algo);
//   · los que el veredicto no tenía en verde;
//   · y, si es de la nube, una MUESTRA: los tests que la punta toca más 4 al azar (fijo por el árbol). Es lo único que
//     prueba en GitHub que lo dicho es cierto.
// Un test que no mira nada de lo que cambió da lo mismo que en el árbol probado: es la misma regla con la que
// tests-afectados ya deja afuera a los demás. Lo que la mezcla rompe entre dos puntas lo ve `sobre-main.yml` (tipos enteros
// y barredoras) y la suite de cada noche: una punta que no corrió su tsc acá llega a main marcada «sin probar», y eso
// lanza sobre-main.
//
// ⚠️ ESTO NO ES UNA FIRMA. El renglón ata el veredicto a un árbol, a una base y a una selección, y frena el veredicto viejo,
// el de otro árbol, el de una selección más chica, el editado a mano y el de otro Node. NO frena a quien arma uno a propósito
// sin correr nada: el algoritmo está en este archivo. Para eso hace falta una clave que tengan SÓLO las sesiones y GitHub
// (`MAKO_VEREDICTO_CLAVE`: secreto del repo + variable del entorno de la nube). Con la clave cargada en GitHub, un renglón sin
// firma o con otra firma no pasa; sin ella, GitHub lo acepta y lo dice «sin firma». La muestra y las redes de main quedan igual.
//
// Uso:
//   node scripts/veredicto.mjs sacar                      # en la nube, antes de `git push origin HEAD:punta/<nombre>`
//   node scripts/veredicto.mjs revisar --punta <sha> --main <ref> --salida <dir> [--previo <json>]   # lo corre punta.yml
//   node scripts/veredicto.mjs guardar --punta <sha> --main <sha> --corrida <json> --tipos ok|no --salida <json>
// =============================================================================

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { seleccionar, fuenteGit, ES_TEST, LENTOS_FUERA_DE_LA_FASE_RAPIDA } from './tests-afectados.mjs';

export const VERSION = 1;
/** El Node de Actions (setup-node `node-version: 24`). Con el 22, ~40 archivos dan rojo y los grupos compartidos no corren. */
export const NODE_MAYOR = 24;
/** Cuántos tests de la muestra salen al azar, además de los que la punta toca. */
export const MUESTRA_AL_AZAR = 4;
const CAMPOS = ['v', 'arbol', 'base', 'sel', 'archivos', 'tests', 'tipos', 'node', 'quien'];
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// ── El renglón ──────────────────────────────────────────────────────────────────────────────────

/** El texto que se suma y se firma: los campos en un orden fijo, uno por línea. */
export function canonico(c) {
  return ['mako-veredicto', ...CAMPOS.map((k) => `${k}=${c[k] ?? ''}`)].join('\n');
}
export const sumaDe = (c) => sha256(canonico(c));
export const firmaDe = (c, clave) => createHmac('sha256', clave).update(canonico(c)).digest('hex');

/** `v=1 arbol=… base=… … suma=… [firma=…]`: lo que va después de «Veredicto:». */
export function escribirRenglon(c, clave = '') {
  const t = { ...c, v: VERSION, suma: sumaDe({ ...c, v: VERSION }) };
  if (clave) t.firma = firmaDe({ ...c, v: VERSION }, clave);
  return [...CAMPOS, 'suma', ...(clave ? ['firma'] : [])].map((k) => `${k}=${t[k]}`).join(' ');
}

/**
 * Lee un renglón. null si no tiene la forma (un campo repetido, uno sin `=`, uno que no conozco).
 * @param {unknown} s
 * @returns {Record<string, string> | null}
 */
export function leerRenglon(s) {
  if (typeof s !== 'string') return null;
  /** @type {Record<string, string>} */
  const o = {};
  for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
    const i = tok.indexOf('=');
    if (i <= 0) return null;
    const k = tok.slice(0, i);
    if (!(CAMPOS.includes(k) || k === 'suma' || k === 'firma') || k in o) return null;
    o[k] = tok.slice(i + 1);
  }
  return o;
}

const igualSeguro = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * ¿Vale este renglón para ESTA punta? Puro: lo que mira el disco o git entra por parámetro.
 * @param {{ renglon: string, arbolPunta: string, esAncestro: (a: string, b: string) => boolean, existe: (sha: string) => boolean,
 *   seleccion: (base: string) => string[] | null, clave?: string, main: string }} p
 * @returns {{ ok: true, c: object, verdes: string[], firmado: boolean } | { ok: false, motivo: string }}
 */
export function revisarRenglon({ renglon, arbolPunta, esAncestro, existe, seleccion, clave = '', main }) {
  const c = leerRenglon(renglon);
  if (!c) return { ok: false, motivo: 'el renglón Veredicto no tiene la forma de un veredicto' };
  if (c.v !== String(VERSION)) return { ok: false, motivo: `versión de veredicto ${c.v} (se espera ${VERSION})` };
  for (const k of CAMPOS) if (c[k] == null) return { ok: false, motivo: `al veredicto le falta «${k}»` };
  if (!HEX40.test(c.arbol) || !HEX40.test(c.base) || !HEX64.test(c.sel ?? '') || !/^\d+$/.test(c.archivos) || !/^\d+$/.test(c.tests)) {
    return { ok: false, motivo: 'un campo del veredicto no tiene su forma (árbol, base, selección o números)' };
  }
  if (!igualSeguro(c.suma, sumaDe(c))) return { ok: false, motivo: 'la suma del veredicto no coincide: lo editaron a mano o se cortó' };
  if (clave) {
    if (!c.firma) return { ok: false, motivo: 'GitHub tiene la clave de los veredictos y este no viene firmado' };
    if (!igualSeguro(c.firma, firmaDe(c, clave))) return { ok: false, motivo: 'la firma del veredicto no es la de la clave de GitHub' };
  }
  if (c.arbol !== arbolPunta) return { ok: false, motivo: `el veredicto es del árbol ${c.arbol.slice(0, 10)} y la punta es ${arbolPunta.slice(0, 10)}: se probó otra cosa` };
  if (Number(String(c.node).split('.')[0]) !== NODE_MAYOR) return { ok: false, motivo: `el veredicto corrió con Node ${c.node}: Actions corre el ${NODE_MAYOR}` };
  if (c.tipos !== 'ok') return { ok: false, motivo: `los tipos del veredicto dicen «${c.tipos}», no ok` };
  if (!existe(c.base)) return { ok: false, motivo: `no encuentro la base del veredicto (${c.base.slice(0, 10)})` };
  if (!esAncestro(c.base, 'PUNTA')) return { ok: false, motivo: 'la base del veredicto no está en la historia de la punta' };
  if (!esAncestro(c.base, main)) return { ok: false, motivo: 'la base del veredicto no es un commit de main' };
  const lista = seleccion(c.base);
  if (!lista) return { ok: false, motivo: 'no pude recalcular los tests que le tocaban a la punta' };
  if (lista.length !== Number(c.archivos) || sha256(lista.join('\n')) !== c.sel) {
    return { ok: false, motivo: `la selección del veredicto (${c.archivos} archivos) no es la que le toca a la punta (${lista.length}): corrió otra cosa` };
  }
  if (lista.length > 0 && Number(c.tests) === 0) return { ok: false, motivo: 'el veredicto dice 0 tests sobre una selección que no está vacía' };
  return { ok: true, c, verdes: lista, firmado: Boolean(clave) };
}

// ── Qué se repite ───────────────────────────────────────────────────────────────────────────────

/** Una muestra FIJA para un árbol: los mismos k tests cada vez que se revisa el mismo veredicto. */
export function muestraDe(lista, semilla, k) {
  return [...lista].map((t) => [sha256(`${semilla}\n${t}`), t]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, k).map((x) => x[1]).sort();
}

/**
 * Lo que hay que correr en GitHub con un veredicto en la mano. Puro.
 * @param {{ sel: string[], verdes: Set<string>, afectados: Set<string> | null, muestra?: string[] }} p
 *   sel: lo que la punta corre sin veredicto (los afectados sobre el árbol mezclado); verdes: lo que el veredicto tiene en verde;
 *   afectados: los tests que miran algo que cambió entre el árbol probado y el mezclado (null: no cambió nada).
 */
export function aRepetir({ sel, verdes, afectados, muestra = [] }) {
  const enSel = new Set(sel);
  const r = new Set(sel.filter((t) => !verdes.has(t) || (afectados && afectados.has(t))));
  for (const t of muestra) if (enSel.has(t)) r.add(t);
  return [...r].sort();
}

// ── Git y la selección, de verdad ───────────────────────────────────────────────────────────────

function g(args, o = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30, ...o });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim().split('\n')[0]}`);
  return r.stdout;
}
const gOk = (args) => spawnSync('git', args, { encoding: 'utf8' }).status === 0;
const lineasZ = (s) => s.split('\0').filter(Boolean);
export const arbolDe = (rev) => g(['rev-parse', `${rev}^{tree}`]).trim();
const cambiosEntre = (a, b) => lineasZ(g(['diff', '--name-only', '-z', '--no-renames', a, b])).sort();

/** Los tests que tests-afectados elige para `cambiados` sobre el árbol de `rev` (sin los lentos, como `planear`). */
export function seleccionSobre(rev, cambiados, fuente = fuenteGit(rev)) {
  if (cambiados.length === 0) return { tests: [], barredoras: new Set() };
  const sel = seleccionar({ cambiados, archivos: fuente.archivos, leer: fuente.leer });
  for (const f of LENTOS_FUERA_DE_LA_FASE_RAPIDA.keys()) sel.tests.delete(f);
  return { tests: [...sel.tests.keys()].sort(), barredoras: new Set(sel.barredoras.keys()) };
}

/** El último renglón `Veredicto:` del mensaje del commit, o null. */
export function renglonDe(sha) {
  const v = g(['log', '-1', '--format=%(trailers:key=Veredicto,valueonly,unfold)', sha]).split('\n').map((l) => l.trim()).filter(Boolean);
  return v.length ? v[v.length - 1] : null;
}

// ── revisar (punta.yml) ─────────────────────────────────────────────────────────────────────────

function revisarCli(o) {
  const salida = o.salida ?? mkdtempSync(path.join(os.tmpdir(), 'veredicto-'));
  mkdirSync(salida, { recursive: true });
  const repetir = path.join(salida, 'repetir.txt');
  const outputs = [];
  const decir = (s) => process.stdout.write(s + '\n');
  const cerrar = (campos) => {
    for (const [k, v] of Object.entries(campos)) outputs.push(`${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    else decir(outputs.join('\n'));
  };
  const sinVeredicto = (motivos) => {
    const m = motivos.join(' · ') || 'no hay veredicto';
    decir(`[veredicto] Sin veredicto que sirva: ${m}. Corre todo, como siempre.`);
    resumen(`Veredicto: ninguno que sirva (${m}). Se corrieron los tests de siempre.`);
    cerrar({ usar: 'false', tipos_saltear: 'false', sin_probar: '0', origen: 'ninguno' });
    return 0;
  };

  const punta = o.punta;
  const main = o.main ?? 'origin/main';
  let arbolPunta, selMezcla, barredorasMezcla, fuenteMezcla;
  try {
    arbolPunta = arbolDe(punta);
    fuenteMezcla = fuenteGit('HEAD');
    const s = seleccionSobre('HEAD', cambiosEntre(main, 'HEAD'), fuenteMezcla);
    selMezcla = s.tests;
    barredorasMezcla = s.barredoras;
  } catch (e) {
    return sinVeredicto([`no pude leer el árbol (${String(e.message).split('\n')[0]})`]);
  }
  const existe = (sha) => gOk(['cat-file', '-e', `${sha}^{commit}`]);
  const esAncestro = (a, b) => gOk(['merge-base', '--is-ancestor', a, b === 'PUNTA' ? punta : b]);
  const motivos = [];
  const candidatos = [];

  // 1. El de la nube, en el commit.
  const renglon = (() => { try { return renglonDe(punta); } catch { return null; } })();
  if (renglon) {
    const clave = process.env.MAKO_VEREDICTO_CLAVE ?? '';
    const r = revisarRenglon({
      renglon, arbolPunta, existe, esAncestro, clave, main,
      seleccion: (base) => { try { return seleccionSobre(punta, cambiosEntre(base, punta)).tests; } catch { return null; } },
    });
    if (!r.ok) motivos.push(`el de la nube no vale: ${r.motivo}`);
    else {
      const delta = cambiosEntre(punta, 'HEAD');
      const afectados = delta.length ? new Set(seleccionSobre('HEAD', delta, fuenteMezcla).tests) : null;
      // La muestra: los tests que la punta toca (los que más probablemente estén mal) y 4 de los que eligió por lo que cambió.
      // Las barredoras no entran: no dicen nada de lo que esta punta afirma, y con main movido ya corren todas.
      const propios = cambiosEntre(r.c.base, punta).filter((f) => ES_TEST.test(f));
      const elegibles = r.verdes.filter((t) => !propios.includes(t) && !barredorasMezcla.has(t));
      const muestra = [...propios, ...muestraDe(elegibles, arbolPunta, MUESTRA_AL_AZAR)];
      candidatos.push({
        origen: 'nube', quien: r.c.quien || 'sin nombre', firmado: r.firmado, delta: delta.length, tipos: true,
        lista: aRepetir({ sel: selMezcla, verdes: new Set(r.verdes), afectados, muestra }), muestra: muestra.length,
      });
    }
  } else motivos.push('la punta no trae un veredicto de la nube');

  // 2. El de Actions: lo que una corrida anterior de ESTA rama dejó en verde.
  if (o.previo && existsSync(o.previo)) {
    try {
      const p = JSON.parse(readFileSync(o.previo, 'utf8'));
      if (p.v !== VERSION || !HEX40.test(p.punta ?? '') || !HEX40.test(p.main ?? '') || !Array.isArray(p.verdes)) throw new Error('no tiene la forma');
      if (!existe(p.punta) || !existe(p.main)) throw new Error('sus commits ya no están');
      // El árbol mezclado de esa corrida no existe acá (la mezcla no se subió si dio rojo): lo que pudo cambiar es lo que movió la
      // punta MÁS lo que movió main desde entonces. Es más que la diferencia exacta, así que se repite de más, nunca de menos.
      const delta = [...new Set([...cambiosEntre(p.punta, punta), ...cambiosEntre(p.main, main)])].sort();
      const afectados = delta.length ? new Set(seleccionSobre('HEAD', delta, fuenteMezcla).tests) : null;
      const mismaPunta = arbolDe(p.punta) === arbolPunta;
      candidatos.push({
        origen: 'actions', quien: `la corrida anterior de esta rama (${String(p.corrida ?? '?')})`, firmado: true, delta: delta.length,
        tipos: p.tipos === 'ok' && mismaPunta, lista: aRepetir({ sel: selMezcla, verdes: new Set(p.verdes), afectados }), muestra: 0,
      });
    } catch (e) { motivos.push(`el de la corrida anterior no sirve (${e.message})`); }
  }

  if (candidatos.length === 0) return sinVeredicto(motivos);
  // El que menos hace repetir; a igual cantidad, el que además cubre los tipos.
  candidatos.sort((a, b) => a.lista.length - b.lista.length || Number(b.tipos) - Number(a.tipos));
  const v = candidatos[0];
  writeFileSync(repetir, v.lista.length ? v.lista.join('\n') + '\n' : '');
  // Los tipos se saltean SÓLO con un veredicto que los cubre sobre este mismo contenido de la punta. Lo que main movió desde
  // entonces lo chequea sobre-main.yml: por eso la punta llega a main «sin probar» (y si es de la nube, siempre: es la red que
  // mira en Actions lo que la nube dijo).
  const tiposSaltear = v.tipos;
  const sinProbar = tiposSaltear && (v.origen === 'nube' || v.delta > 0) ? '1' : '0';
  const de = v.origen === 'nube' ? `la sesión de la nube ${v.quien}${v.firmado ? ' (firmado)' : ' (sin firma)'}` : v.quien;
  decir(`[veredicto] Uso el de ${de}: se repiten ${v.lista.length} de ${selMezcla.length} archivos de test` +
    `${v.delta ? ` (main se movió en ${v.delta} archivo(s) desde lo probado)` : ' (el árbol es el mismo que se probó)'}` +
    `${v.muestra ? `, ${v.muestra} de muestra` : ''}. Tipos: ${tiposSaltear ? 'los cubre el veredicto' : 'corren acá'}.`);
  resumen(`Veredicto de ${de}: se repiten ${v.lista.length} de ${selMezcla.length} archivos de test; tipos ${tiposSaltear ? 'del veredicto' : 'acá'}.`);
  cerrar({ usar: 'true', repetir, cuantos: String(v.lista.length), tipos_saltear: String(tiposSaltear), sin_probar: sinProbar, origen: v.origen });
  return 0;
}

function resumen(s) { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n'); }

// ── guardar (punta.yml, después de los tests y los tipos) ───────────────────────────────────────

function guardarCli(o) {
  if (!o.corrida || !existsSync(o.corrida)) { process.stdout.write('[veredicto] Sin corrida de tests que guardar: no queda veredicto de Actions.\n'); return 0; }
  const corrida = JSON.parse(readFileSync(o.corrida, 'utf8'));
  const main = g(['rev-parse', o.main ?? 'origin/main']).trim();
  const sel = seleccionSobre('HEAD', cambiosEntre(main, 'HEAD')).tests;
  // Todo lo seleccionado que no quedó rojo ni sin correr está en verde sobre este árbol: lo que corrió acá y lo que el veredicto
  // ya cubría. Por eso alcanza con restar lo que no dio verde.
  const noVerdes = new Set(corrida.noVerdes ?? []);
  const verdes = sel.filter((t) => !noVerdes.has(t));
  const datos = { v: VERSION, punta: g(['rev-parse', o.punta]).trim(), main, verdes, tipos: o.tipos === 'ok' ? 'ok' : 'no', node: process.versions.node, corrida: process.env.GITHUB_RUN_ID ?? null };
  writeFileSync(o.salida, JSON.stringify(datos));
  process.stdout.write(`[veredicto] Guardé el de Actions: ${verdes.length} de ${sel.length} en verde, tipos ${datos.tipos}.\n`);
  return 0;
}

// ── sacar (una sesión de la nube, antes de subir) ───────────────────────────────────────────────

function correr(cmd, args, o = {}) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`);
  // El Node de este proceso (el 24) va primero en el PATH de los hijos: npm, npx y los `#!/usr/bin/env node` lo usan a él.
  const env = { ...process.env, ...(o.env ?? {}), PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}` };
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 28, ...o, env });
  if (r.stdout) process.stdout.write(r.stdout);
  return r;
}

function sacarCli(o) {
  const fallar = (s) => { process.stderr.write(`\n  ✖ ${s}\n\n`); return 1; };
  if (process.platform === 'win32') return fallar('El veredicto es para las sesiones de la NUBE. En la PC la punta la chequea GitHub, como siempre.');
  if (Number(process.versions.node.split('.')[0]) !== NODE_MAYOR) {
    return fallar(`Esto corre con Node ${process.versions.node} y Actions usa el ${NODE_MAYOR} (con el 22, ~40 archivos dan rojo de mentira).\n    export PATH="$(sh scripts/node24.sh):$PATH"   y volvé a correrlo.`);
  }
  const sucio = g(['status', '--porcelain', '--untracked-files=all']).replace(/\s+$/, '');
  if (sucio) return fallar(`El árbol tiene cosas sin commitear: el veredicto es del ÚLTIMO COMMIT, y esto no viaja.\n${sucio.split('\n').slice(0, 8).map((l) => '      ' + l).join('\n')}`);
  if (!gOk(['fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main'])) return fallar('No pude traer origin/main.');
  if (gOk(['rev-parse', '--is-shallow-repository']) && g(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    return fallar('El clon es superficial: la base que calcularía es falsa. `git fetch --unshallow origin main` primero.');
  }
  const base = g(['merge-base', 'HEAD', 'origin/main']).trim();
  const atras = Number(g(['rev-list', '--count', 'HEAD..origin/main']).trim());
  if (atras > 0) process.stdout.write(`  ℹ main tiene ${atras} commit(s) que la punta no: GitHub va a repetir lo que eso toque. Conviene \`git merge origin/main\` antes.\n`);
  const arbol = arbolDe('HEAD');
  if (arbol === arbolDe('origin/main')) return fallar('La punta es igual a main: no hay nada que probar.');

  // Que node_modules sea el del lockfile de ESTE commit (un npm ci viejo da verdes y rojos de otra versión).
  const lock = sha256(readFileSync('package-lock.json', 'utf8'));
  const sello = 'node_modules/.mako-lock';
  if (!existsSync(sello) || readFileSync(sello, 'utf8').trim() !== lock) {
    if (correr('npm', ['ci', '--no-audit', '--no-fund']).status !== 0) return fallar('npm ci falló.');
    writeFileSync(sello, lock + '\n');
  }
  if (correr('npx', ['next', 'typegen']).status !== 0) return fallar('next typegen falló.');

  const lista = seleccionSobre('HEAD', cambiosEntre(base, 'HEAD')).tests;
  let tests = 0;
  if (lista.length) {
    const t = correr(process.execPath, ['scripts/tests-afectados.mjs', '--base', base, '--concurrencia', 'auto', '--tanda', '100', '--compartir']);
    const m = /✔ VERDE · (\d+) tests de (\d+) archivos/.exec(t.stdout ?? '');
    if (t.status !== 0 || !m) return fallar('Los tests no dieron verde: no hay veredicto. Arreglalo y volvé a correrlo.');
    if (Number(m[2]) !== lista.length) return fallar(`tests-afectados corrió ${m[2]} archivos y la selección son ${lista.length}: no coinciden, no firmo eso.`);
    tests = Number(m[1]);
  }
  const ti = correr(process.execPath, ['scripts/tipos-ci.mjs'], { env: { TIPOS_TANDAS: '1', TIPOS_HEAP_MB: process.env.TIPOS_HEAP_MB ?? '12288' } });
  if (ti.status !== 0 || !/^Tipos: OK · /m.test(ti.stdout ?? '')) return fallar('El tsc entero no dio OK: no hay veredicto.');
  if (g(['status', '--porcelain', '--untracked-files=all']).trim()) return fallar('Correr los tests ensució el árbol: el veredicto no sería del commit. Mirá `git status`.');
  if (arbolDe('HEAD') !== arbol) return fallar('El árbol cambió mientras corrían los tests.');

  const quien = (process.env.CLAUDE_CODE_SESSION_ID ? `cli_${process.env.CLAUDE_CODE_SESSION_ID}` : process.env.CLAUDE_CODE_HOST_SESSION_ID ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'nube';
  const c = { arbol, base, sel: sha256(lista.join('\n')), archivos: lista.length, tests, tipos: 'ok', node: process.versions.node, quien };
  const linea = `Veredicto: ${escribirRenglon(c, process.env.MAKO_VEREDICTO_CLAVE ?? '')}`;

  // Dónde va: en el último commit si es tuyo y no se subió a ningún lado (no se reescribe nada publicado); si no, en un commit
  // nuevo VACÍO (mismo árbol: el veredicto sigue valiendo).
  const subido = g(['branch', '-r', '--contains', 'HEAD']).trim().length > 0;
  const mio = g(['log', '-1', '--format=%ae']).trim() === g(['config', 'user.email']).trim();
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'veredicto-msg-'));
  const archivoMsg = path.join(tmp, 'msg');
  if (!subido && mio) {
    writeFileSync(archivoMsg, g(['log', '-1', '--format=%B']));
    const nuevo = g(['interpret-trailers', '--if-exists', 'replace', '--trailer', linea, archivoMsg]);
    writeFileSync(archivoMsg, nuevo);
    if (correr('git', ['commit', '--amend', '-F', archivoMsg]).status !== 0) return fallar('No pude sumar el renglón al commit.');
  } else {
    writeFileSync(archivoMsg, `Veredicto de los tests de ${g(['rev-parse', '--short', 'HEAD']).trim()} (el mismo árbol)\n\n${linea}\n`);
    if (correr('git', ['commit', '--allow-empty', '-F', archivoMsg]).status !== 0) return fallar('No pude crear el commit del veredicto.');
  }
  if (arbolDe('HEAD') !== arbol) return fallar('El commit del veredicto cambió el árbol: no lo subas.');
  process.stdout.write(`\n  ✔ Veredicto en ${g(['rev-parse', '--short', 'HEAD']).trim()}: ${tests} tests de ${lista.length} archivos y el tsc entero, en verde, sobre el árbol ${arbol.slice(0, 10)}.\n`);
  process.stdout.write('    Subilo tal cual: git push origin HEAD:punta/<nombre>   (un commit más encima y GitHub vuelve a correr todo).\n\n');
  return 0;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────

export function leerArgs(argv) {
  const o = { orden: argv[0] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (['punta', 'main', 'salida', 'previo', 'corrida', 'tipos'].includes(k)) o[k] = argv[++i];
    else throw new Error(`no conozco «${argv[i]}»`);
  }
  return o;
}

function main(argv) {
  const o = leerArgs(argv);
  if (o.orden === 'sacar') return sacarCli(o);
  if (o.orden === 'revisar') { if (!o.punta) throw new Error('falta --punta'); return revisarCli(o); }
  if (o.orden === 'guardar') { if (!o.punta || !o.salida) throw new Error('faltan --punta y --salida'); return guardarCli(o); }
  process.stdout.write('Uso: node scripts/veredicto.mjs sacar | revisar --punta <sha> [--main origin/main] [--salida dir] [--previo json] | guardar --punta <sha> --corrida <json> --tipos ok|no --salida <json>\n');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { process.stderr.write(`[veredicto] ${e?.message ?? e}\n`); process.exit(2); }
}
