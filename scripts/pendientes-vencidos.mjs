#!/usr/bin/env node
// =============================================================================
// pendientes-vencidos.mjs — un pendiente que nombra un test, y el test está verde, es un pendiente VENCIDO
// =============================================================================
// POR QUE EXISTE (medido el 30/10/2026): `docs/pendientes.md` tenía una sección «Rojos en `main` sin dueño» con tres tests.
// LOS TRES ESTABAN VERDES. La sección se escribió el 24/10 a las 19:23 y los arreglos entraron a las 20:58 y 20:59 del MISMO
// día —95 minutos después—; el documento se editó seis veces más hasta el 29/10 y nadie borró la sección. Seis días después el
// Cerebro repartió esos tres rojos a dos chats para que los arreglaran.
//
// ⚠️ Y LA REGLA YA ESTABA ESCRITA. El encabezado del documento dice «Al cerrar uno, borralo de acá en el mismo commit». No faltaba
// la regla: faltó cumplirla. Por eso esto no es otro párrafo en prosa sino una herramienta, igual que cuando «corré los tests de tu
// área» no alcanzó y la cura fue que `antes-de-subir.mjs` los elija solo.
//
// AVISA, NO BLOQUEA — y es la única guarda del push que no bloquea. La razón es medida: un test puede estar VERDE por el entorno.
// Un clon atrasado fabrica rojos y verdes falsos (el clon compartido de esta máquina estuvo 4.431 commits atrás), y un árbol sin
// `node_modules` o con otra rama checkouteada dice cualquier cosa. Bloquear un push por el estado de un DOCUMENTO sería peor que el
// problema que arregla. Así que grita, nombra archivo y línea, y deja pasar. Siempre sale con 0.
//
// LOS DOS CASOS, y los dos son «vencido»:
//   · el test que nombra está VERDE → el pendiente está hecho y nadie lo borró (lo del 24/10);
//   · el test que nombra NO EXISTE → se renombró o se borró, y el pendiente quedó apuntando a la nada. Este caso es GRATIS
//     (es mirar el disco, no correr nada), así que es el que corre en cada push.
//
// COMO SE ENTERA DE QUE ESTÁ VERDE, SIN PAGARLO: no corre tests. `antes-de-subir.mjs` ya corrió los afectados en esta misma corrida
// y tiene el resultado en la mano: le pasa la lista de los que salieron verdes (`--verdes`, o `avisar()` desde adentro). Correr los
// tests nombrados es un modo APARTE y explícito (`--correr`), para la mano o un cron, nunca para el push.
//
// ⚠️ Y SE CORREN CON `node --import tsx --test`, NUNCA con `node --test` pelado: sin tsx, los imports sin extensión dan un
// `ERR_MODULE_NOT_FOUND` falso (medido: 0/1 pelado contra 6/0 con tsx). Una guarda con el runner equivocado diría «sigue rojo» para
// siempre, que es el error opuesto y igual de caro. Y un proceso que muere sin juzgar nada NO es un verde: se usa el mismo
// discriminante que el veredicto del push (`juzgoAlgo` de tests-afectados), para no decirle «cerralo» a un test que no corrió.
//
// Uso:
//   node scripts/pendientes-vencidos.mjs                    el chequeo GRATIS (los que nombran un test que no existe). Lo corre guardas-push.sh.
//   node scripts/pendientes-vencidos.mjs --verdes a.test.ts b.test.ts   cruza con tests que YA corrieron verdes (lo que usa antes-de-subir).
//   node scripts/pendientes-vencidos.mjs --correr           corre los tests nombrados y avisa los que están verdes. CARO: a mano o en un cron.
//   node scripts/pendientes-vencidos.mjs --doc otro.md      otro documento (default: docs/pendientes.md).
// Siempre sale con 0.
// =============================================================================

import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { juzgoAlgo, leerResultado } from './tests-afectados.mjs';

export const DOC_POR_DEFECTO = 'docs/pendientes.md';

/** Un pendiente que nombra un test, con de dónde salió (para poder ir a borrarlo). @typedef {{ test: string, linea: number, seccion: string, texto: string, lineaDelTest: string | null, doc: string }} Pendiente */

/** Un archivo de test nombrado en el documento, con su línea opcional: `tests/paso-ia.test.ts:135`. */
const NOMBRA_TEST = /(tests\/[A-Za-z0-9._-]+\.test\.ts)(?::(\d+))?/g;

/**
 * La sección dice que lo suyo YA SE CERRÓ: lo que nombre no es un pendiente («## Se cerraron hoy (100): para que los revises»).
 * Se mira el encabezado, no la línea: un pendiente puede contar que una PARTE está hecha y seguir abierto.
 */
export const SECCION_CERRADA = /\bse cerraron\b|\bcerrados?\b|\bya est[áa] hecho\b/i;

/**
 * Lo que marca a un test como ROJO o PENDIENTE, y no como «el test que FIJA esto». La diferencia importa: los documentos nombran
 * tests todo el tiempo para decir qué cubre un arreglo («Lo fija tests/vercel-salida.test.ts»), y ésos están verdes a propósito —
 * avisar por ellos haría la guarda ruidosa, y una guarda ruidosa se apaga. Se mira el encabezado de la sección Y la línea.
 */
export const DICE_ROJO = /\brojos?\b|\bfalla\b|\bfallan\b|\bsin arreglar\b|\bno pasa\b|\bsigue roto\b/i;
/** El test nombrado como la red que CUBRE algo, no como algo roto. */
export const ES_LA_RED = /\blo fija\b|\blos fija\b|\blo cubre\b|\blo prueba\b|\bfijad[oa] (?:por|en)\b|\bqueda fijado\b/i;

/**
 * Lee el documento y devuelve los tests que figuran como rojos o pendientes, con la línea donde están.
 * @param {string} texto
 * @param {{ doc?: string }} [o]
 * @returns {Pendiente[]}
 */
export function leerPendientes(texto, { doc = DOC_POR_DEFECTO } = {}) {
  const salida = [];
  const vistos = new Set();
  let seccion = '';
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const enc = /^#{1,6}\s+(.*)$/.exec(l);
    if (enc) { seccion = enc[1].trim(); continue; }
    if (SECCION_CERRADA.test(seccion)) continue;
    if (!DICE_ROJO.test(seccion) && !DICE_ROJO.test(l)) continue;
    if (ES_LA_RED.test(l)) continue;
    for (const m of l.matchAll(NOMBRA_TEST)) {
      const clave = `${m[1]}@${i + 1}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ test: m[1], linea: i + 1, seccion, texto: l.trim(), lineaDelTest: m[2] ?? null, doc });
    }
  }
  return salida;
}

/**
 * Separa los vencidos de los que siguen vivos.
 * @param {Pendiente[]} entradas
 * @param {{ existe?: (f: string) => boolean, verdes?: Iterable<string> }} [o] `verdes`: tests que YA corrieron verdes (rutas relativas al repo o absolutas)
 */
export function vencidos(entradas, { existe = existsSync, verdes = [] } = {}) {
  // Los verdes pueden venir con ruta absoluta (así los corre antes-de-subir) o con separador de Windows: se comparan por nombre de archivo.
  const verdePorNombre = new Set([...verdes].map((f) => String(f).replace(/\\/g, '/').split('/').pop()));
  /** @type {Pendiente[]} */ const porFalta = [];
  /** @type {Pendiente[]} */ const porVerde = [];
  for (const e of entradas) {
    if (!existe(e.test)) porFalta.push(e);
    else if (verdePorNombre.has(e.test.split('/').pop())) porVerde.push(e);
  }
  return { porFalta, porVerde, vivos: entradas.filter((e) => !porFalta.includes(e) && !porVerde.includes(e)) };
}

/**
 * El aviso, en las líneas que se van a leer (no hay más: esto nunca bloquea).
 * @param {{ porFalta?: Pendiente[], porVerde?: Pendiente[] }} [v]
 */
export function lineasDelAviso({ porFalta = [], porVerde = [] } = {}) {
  const fila = (e) => `      ${e.doc}:${e.linea} → ${e.test}${e.lineaDelTest ? `:${e.lineaDelTest}` : ''}   («${e.seccion}»)`;
  const out = [];
  if (porVerde.length) {
    out.push(`  ⚠ ${porVerde.length} pendiente(s) VENCIDO(s): figuran como rojos y el test está VERDE. Cerralos en el mismo commit, o escribí por qué siguen abiertos:`);
    out.push(...porVerde.map(fila));
  }
  if (porFalta.length) {
    out.push(`  ⚠ ${porFalta.length} pendiente(s) que nombran un test que YA NO EXISTE (se renombró o se borró): el pendiente apunta a la nada:`);
    out.push(...porFalta.map(fila));
  }
  if (out.length) out.push('    (esto AVISA, no bloquea: un test puede estar verde por el entorno — un clon atrasado fabrica verdes falsos.)');
  return out;
}

/**
 * El cruce completo, para llamarlo desde adentro de otro script (antes-de-subir): no corre nada, usa los verdes que ya se tienen.
 * @param {{ raiz?: string, doc?: string, verdes?: Iterable<string>, leer?: (f: string) => string, existe?: (f: string) => boolean }} [o]
 */
export function pendientesVencidos({ raiz = '.', doc = DOC_POR_DEFECTO, verdes = [], leer, existe } = {}) {
  const abs = (f) => path.join(raiz, f);
  let texto;
  try { texto = (leer ?? ((f) => readFileSync(abs(f), 'utf8')))(doc); } catch { return { porFalta: [], porVerde: [], vivos: [], sinDoc: true }; }
  const entradas = leerPendientes(texto, { doc });
  return { ...vencidos(entradas, { existe: existe ?? ((f) => existsSync(abs(f))), verdes }), sinDoc: false };
}

// ---------------------------------------------------------------------------
// El modo CARO, explícito: correr los tests nombrados
// ---------------------------------------------------------------------------

/**
 * Corre los tests nombrados y devuelve los que están VERDES. ⚠️ `node --import tsx --test`, nunca pelado, y un proceso que murió
 * sin juzgar nada no deja a nadie verde (el mismo discriminante que el veredicto del push).
 */
export function correrLosNombrados(tests, { raiz = '.', correr } = {}) {
  if (tests.length === 0) return { verdes: [], rojos: [], juzgo: true };
  const lanzar = correr ?? ((args) => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...args], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { salida: `${r.stdout ?? ''}${r.stderr ?? ''}`, codigo: r.status };
  });
  const r = lanzar(tests);
  if (!juzgoAlgo(r.salida)) return { verdes: [], rojos: [], juzgo: false };
  const res = leerResultado(r.salida);
  const rojos = new Set(res.rojos.map((f) => f.split('/').pop()));
  return { verdes: tests.filter((t) => !rojos.has(t.split('/').pop())), rojos: [...rojos], juzgo: true };
}

async function main(argv) {
  const out = (s = '') => process.stdout.write(s + '\n');
  let doc = DOC_POR_DEFECTO;
  let correrlos = false;
  const verdes = [];
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    if (k === '--doc') doc = v !== undefined ? v : argv[++i];
    else if (k === '--correr') correrlos = true;
    else if (k === '--verdes') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) verdes.push(argv[++i]); }
    else { process.stderr.write(`  [pendientes-vencidos] no conozco «${argv[i]}»\n`); return 0; }
  }
  const raiz = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch { return process.cwd(); } })();

  const v = pendientesVencidos({ raiz, doc, verdes });
  if (v.sinDoc) { out(`  [pendientes-vencidos] no encontré ${doc}: nada que mirar`); return 0; }
  if (correrlos && v.vivos.length) {
    const r = correrLosNombrados([...new Set(v.vivos.map((e) => e.test))], { raiz });
    if (!r.juzgo) out('  ⚠ los tests nombrados no llegaron a juzgar nada (sin RAM, o el proceso murió): NO digo que estén verdes');
    else {
      const verdePorNombre = new Set(r.verdes.map((f) => f.split('/').pop()));
      for (const e of v.vivos) if (verdePorNombre.has(e.test.split('/').pop())) v.porVerde.push(e);
    }
  }
  const lineas = lineasDelAviso(v);
  if (lineas.length === 0) {
    out(`  ✔ ${doc}: ningún pendiente vencido (${v.vivos.length} que nombran un test, todos existentes${correrlos ? ' y rojos' : ''})`);
    return 0;
  }
  for (const l of lineas) out(l);
  return 0;     // ⚠️ SIEMPRE 0: avisa, no bloquea.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`  [pendientes-vencidos] error inesperado: ${e?.stack ?? e}\n`); process.exit(0); });
}
