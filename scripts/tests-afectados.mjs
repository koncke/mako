#!/usr/bin/env node
// =============================================================================
// tests-afectados.mjs — los tests que un cambio PUEDE romper, sin correr los 10.800
// =============================================================================
// POR QUE EXISTE: el 17/10/2026 fallaron 3 de los 9 runs de integracion (80, 82 y 85) y cada
// falla costó ~15 min (11 de Actions + el arreglo + el run de vuelta). En los tres, cada jefe
// había corrido SÓLO los tests de su área, y lo que se rompió era OTRO test:
//   · run 80: `puente-panel-copy` (la guarda de voseo, que barre el repo con `git ls-files`:
//     el archivo NUEVO no estaba en git cuando el jefe la corrió) y `editor-acciones` (fija la
//     lista de parámetros de un registro que la punta cambió).
//   · run 82: `zona-negocio`, que barre `lib/` buscando literales de zona horaria.
//   · run 85: `centro-revisar` (lee la barra, nav.ts, que otra punta cambió) y
//     `medios-automatizacion` (lee la FORMA de app/automations/PanelProbar.tsx).
// «Correr los de tu área» no alcanza porque el área la define quien escribe el cambio, y lo que se
// rompe lo define quien escribió el test. Esto invierte la pregunta: dado lo que cambió, ¿qué
// tests lo miran? La respuesta sale del código, no de una lista a mano que se desactualiza.
//
// QUE ELIGE (todo se detecta solo, mirando el texto de cada test):
//   1. BARREDORAS: los tests que recorren el repo — usan `git ls-files`, hacen readdir/glob, o
//      nombran 20+ archivos. Corren SIEMPRE: un cambio en cualquier lado las puede romper, y por
//      eso no se les puede preguntar «¿tocaste lo mío?» (run 80 y 82).
//   2. NOMBRAN: el test escribe la ruta de un archivo cambiado como texto (`readFileSync('app/
//      automations/PanelProbar.tsx')`, o `join(raiz, 'app', 'automations', 'PanelProbar.tsx')`):
//      lo lee, y fija su forma (run 85).
//   3. IMPORTAN: el test importa el archivo cambiado, directo o TRANSITIVAMENTE (run 80 y 85).
//      El grafo sale de una pasada de regex sobre los .ts/.tsx/.mjs del repo (con `@/` y rutas
//      relativas); no hace falta un parser para esto.
//   4. Un test que el cambio mismo toca (lo nuevo o editado) corre, obvio.
//
// COMO CORRE: `node --import tsx --test` en TANDAS CHICAS y con `--test-concurrency=2`. ⚠️ SIN esa
// bandera node lanza un proceso por núcleo (cpus - 1): el 17/10/2026 a las 01:05 una tanda de 8
// archivos así se llevó la RAM de la PC y se cayó la app de Claude con todos los chats adentro.
// Antes de cada tanda espera RAM (mismo criterio que scripts/typecheck-lock.mjs: el piso se DERIVA
// de lo que el trabajo pide más la zona roja del vigía; si no hay, espera — no se cae, y si pasa
// el tiempo, avisa que NO corrió, que es otra cosa que «rojo»).
//
// ⚠️ LOS ARCHIVOS NUEVOS SIN `git add` SON INVISIBLES PARA LAS GUARDAS. `git ls-files` lista el
// ÍNDICE: el run 80 cayó porque `lib/campanita.ts` era nuevo y todavía no estaba en git. Acá los
// tests corren con un ÍNDICE TEMPORAL (GIT_INDEX_FILE: copia del real + `git add -N` de lo nuevo),
// así las guardas ven lo mismo que verán en Actions, y el índice de verdad no se toca.
//
// Uso:
//   node scripts/tests-afectados.mjs                      # lo cambiado desde origin/main, y corre
//   node scripts/tests-afectados.mjs --base origin/main   # (es el default)
//   node scripts/tests-afectados.mjs --listar             # sólo elige, no corre (--explicar: el porqué de cada uno)
//   node scripts/tests-afectados.mjs --cortar             # frena en la primera tanda roja (lo usa el pre-push)
//   --tanda N (default 6) · --concurrencia N (default 2)
// Salida: 0 verde · 1 hay tests rojos · 2 no se pudo calcular (base inexistente…) · 99 no corrió por falta de RAM.
// ⚠️ Que esto dé verde NO reemplaza a Actions (tipos, las demás guardas, y los ~950 tests que acá no
// se miran): reduce el riesgo de la falla más cara, no la elimina.
// =============================================================================

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GB = 1024 ** 3;
export const SALIDA_SIN_CORRER = 99;   // misma convención que scripts/typecheck-lock.mjs: «no pude chequear», no «hay errores»

const EXT_CODIGO = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx'];
export const ES_CODIGO = /\.(?:[cm]?[jt]s|[jt]sx)$/;
export const ES_TEST = /^tests\/[^/]+\.test\.ts$/;     // el mismo glob que `npm test`
/** Un test que nombra tantos archivos los está LEYENDO en lote (medido: 37 de 1.106 con ≥20 que no barren por otro lado). */
export const UMBRAL_NOMBRA_MUCHOS = 20;

// -----------------------------------------------------------------------------
// 0. Los comentarios no son dependencias
// -----------------------------------------------------------------------------

// Las cadenas se saltean (entran enteras en la alternativa 1); lo que sigue a `//` o dentro de /* */ se
// borra. El `(?<![:\\/])` deja en paz a `https://…` y a un regex como /a\/\//. Medido el 17/10 con las
// últimas 40 integraciones: SIN esto `AGENTS.md` «nombraba» a 167 tests — casi todos lo citan en un
// comentario («ver AGENTS.md → …»), no lo leen.
const RE_COMENTARIOS = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|(?<![:\\/])\/\/[^\n]*/g;
export function sinComentarios(src) {
  return src.replace(RE_COMENTARIOS, (_, cadena) => cadena ?? '');
}

// -----------------------------------------------------------------------------
// 1. El grafo de imports: una pasada de regex, sin parser
// -----------------------------------------------------------------------------

// import x from 'a' · import 'a' · import {\n a,\n b\n} from 'a' · export * from 'a' · export {a} from 'a'.
// El grupo 1 captura `type`: un `import type` se borra al compilar, así que cambiar ese archivo no
// puede romper el test en tiempo de ejecución (el tsc de Actions es quien lo mira).
const RE_ESTATICO = /(?:^|[^\w$.])(?:import|export)\s+(type\s+)?(?:[^'"`;()]*?\s+from\s+)?(['"])([^'"\n]+)\2/g;
// import('a') · require('a')
const RE_DINAMICO = /(?:^|[^\w$.])(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1\s*[,)]/g;
// new URL('./a', import.meta.url)
const RE_URL = /new\s+URL\(\s*(['"])(\.{1,2}\/[^'"\n]+)\1\s*,\s*import\.meta\.url/g;

/** Los especificadores que un fuente importa EN TIEMPO DE EJECUCIÓN. */
export function especificadores(src) {
  const salida = new Set();
  for (const m of src.matchAll(RE_ESTATICO)) if (!m[1]) salida.add(m[3]);
  for (const m of src.matchAll(RE_DINAMICO)) salida.add(m[2]);
  for (const m of src.matchAll(RE_URL)) salida.add(m[2]);
  return [...salida];
}

/**
 * A qué archivo del repo apunta un import. `existe(ruta)` dice si la ruta (relativa a la raíz, con
 * `/`) es un archivo conocido — incluye los BORRADOS por el cambio: un test que importa un archivo
 * que se borró también es un afectado. Devuelve null para paquetes (`react`, `node:fs`).
 */
export function resolver(desde, especificador, existe) {
  const spec = especificador.replace(/[?#].*$/, '');           // `./x.css?inline`
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);              // tsconfig: "@/*" → "./*"
  else if (spec.startsWith('./') || spec.startsWith('../')) base = path.posix.normalize(path.posix.join(path.posix.dirname(desde), spec));
  else return null;
  const sinJs = base.replace(/\.(?:m?js|jsx)$/, '');            // `./x.js` en un fuente TS apunta a x.ts
  const candidatos = [base];
  for (const b of new Set([base, sinJs])) {
    for (const e of EXT_CODIGO) candidatos.push(b + e);
    for (const e of EXT_CODIGO) candidatos.push(`${b}/index${e}`);
  }
  return candidatos.find(existe) ?? null;
}

// -----------------------------------------------------------------------------
// 2. Los archivos que un test NOMBRA como texto
// -----------------------------------------------------------------------------

const RE_RUTA = /[A-Za-z0-9_@.$()[\]\-/]+\.(?:[cm]?[jt]sx?|json|css|sql|md|ya?ml|sh|txt|html)\b/g;

/**
 * Las rutas-con-extensión que un fuente escribe, normalizadas (sin `./`, `../`, `@/`). Une los
 * trozos que `join()` recibe por separado: `join(raiz, 'app', 'automations', 'PanelProbar.tsx')`
 * nombra `app/automations/PanelProbar.tsx` igual que la cadena entera — y ESE era el caso de
 * medios-automatizacion.
 */
export function rutasNombradas(src) {
  const salida = new Set();
  // Las dos lecturas: la cruda (un array `['--import', 'tsx', 'tests/_hijo.ts']` nombra `tests/_hijo.ts`) y la
  // que junta los trozos del join() (que nombra `app/automations/PanelProbar.tsx`).
  for (const plano of [src, juntarTrozos(src)]) {
    for (const m of plano.matchAll(RE_RUTA)) {
      let t = m[0].replace(/^[()[\]]+/, '').replace(/^(?:@\/|\.{1,2}\/)+/, '').replace(/^\/+/, '');
      t = path.posix.normalize(t);
      if (t.includes('.') && !t.startsWith('../')) salida.add(t);
    }
  }
  return salida;
}

/** `'app', 'x'` → `'app/x'` y `'app/' + 'x'` → `'app/x'`. */
function juntarTrozos(src) {
  return src.replace(/['"`]\s*,\s*['"`]/g, '/').replace(/['"`]\s*\+\s*['"`]/g, '');
}

/**
 * Lo que un fuente escribe entre comillas como ruta SIN extensión (`leer('lib/nutricion')`,
 * `join(raiz, 'lib', 'nutricion')`): sólo cuentan las que tienen una `/` y, después, apuntan a un
 * archivo que existe (lo decide `resolverNombre`), así que `'text/html'` o `'/api/x'` no pesan.
 */
export function rutasSinExtension(src) {
  const salida = new Set();
  for (const plano of [src, juntarTrozos(src)]) {
    for (const m of plano.matchAll(/['"`]((?:@\/|\.{1,2}\/)?[A-Za-z0-9_@$()[\]-]+(?:\/[A-Za-z0-9_@.$()[\]-]+)+)['"`]/g)) {
      const t = path.posix.normalize(m[1].replace(/^(?:@\/|\.{1,2}\/)+/, '').replace(/^\/+/, ''));
      if (!t.startsWith('../')) salida.add(t);
    }
  }
  return salida;
}

/** `lib/nutricion` → `lib/nutricion.ts`, si existe. */
export function resolverNombre(t, existe) {
  for (const e of EXT_CODIGO) if (existe(t + e)) return t + e;
  for (const e of EXT_CODIGO) if (existe(`${t}/index${e}`)) return `${t}/index${e}`;
  return null;
}

/**
 * Las formas en que un test puede llamar a `ruta`: la entera y cada cola de 2+ segmentos
 * (`_components/nav.ts`), y el nombre solo si es DISTINTIVO (único en el repo y de 8+ letras:
 * `PanelProbar.tsx` sí; `page.tsx` o `route.ts` no, nombrarían cualquier cosa).
 */
export function clavesDe(ruta, basenameUnico) {
  const seg = ruta.split('/');
  const claves = [ruta];
  for (let i = 1; i < seg.length; i++) {
    const cola = seg.slice(i).join('/');
    if (i < seg.length - 1) claves.push(cola);
    else if (cola.length >= 8 && basenameUnico(cola)) claves.push(cola);
  }
  return claves;
}

// -----------------------------------------------------------------------------
// 3. Las barredoras
// -----------------------------------------------------------------------------

/** ¿Este test recorre el repo en vez de mirar un archivo? Devuelve el porqué, o null. */
export function motivoBarredora(src, nombradas = rutasNombradas(src)) {
  if (/ls-files/.test(src)) return 'git ls-files';
  if (/\bgit\s+grep\b|\[\s*['"]grep['"]/.test(src)) return 'git grep';
  if (/\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/.test(src)) return 'recorre carpetas';
  if (nombradas.size >= UMBRAL_NOMBRA_MUCHOS) return `nombra ${nombradas.size} archivos`;
  return null;
}

// -----------------------------------------------------------------------------
// 4. La selección (pura: recibe los archivos y cómo leerlos)
// -----------------------------------------------------------------------------

/**
 * @param {{ cambiados: string[], archivos: string[], leer: (ruta: string) => string | null }} p
 *   cambiados: lo que el cambio toca (incluye borrados); archivos: lo que existe ahora (incluye
 *   lo nuevo sin git); leer: el texto de un archivo de código; profundidad: cuántos saltos de import se siguen
 *   (default: todos; `--profundidad 3` es la palanca si el tiempo aprieta: ver el replay, qué rojos salen a cada profundidad).
 * @returns {{ tests: Map<string, {tipo: string, detalle: string}[]>, sinRed: string[], totalTests: number, importadoPor: Map<string, Set<string>> }}
 */
export function seleccionar({ cambiados, archivos, leer, profundidad = Infinity }) {
  const existentes = new Set(archivos);
  const conocidos = new Set([...archivos, ...cambiados]);
  const existe = (r) => conocidos.has(r);
  const cambiadosSet = new Set(cambiados);

  const basenames = new Map();
  for (const f of conocidos) { const b = f.slice(f.lastIndexOf('/') + 1); basenames.set(b, (basenames.get(b) ?? 0) + 1); }
  const basenameUnico = (b) => basenames.get(b) === 1;
  const porClave = new Map();      // cómo se la puede llamar → los archivos a los que apunta
  for (const f of conocidos) for (const c of clavesDe(f, basenameUnico)) { if (!porClave.has(c)) porClave.set(c, new Set()); porClave.get(c).add(f); }

  const importadoPor = new Map();  // archivo → quienes lo importan (o lo lanzan, ver abajo)
  const arista = (destino, origen) => { if (destino === origen) return; if (!importadoPor.has(destino)) importadoPor.set(destino, new Set()); importadoPor.get(destino).add(origen); };
  const tests = [...existentes].filter((f) => ES_TEST.test(f)).sort();
  const aumentan = new Set();      // archivos que agregan tipos a otros (`declare module`/`declare global`)
  const nombradasPor = new Map();  // test → archivos que nombra
  const motivoBarre = new Map();

  for (const f of existentes) {
    if (!ES_CODIGO.test(f)) continue;
    const crudo = leer(f);
    if (crudo == null) continue;
    const src = sinComentarios(crudo);
    if (/^\s*declare\s+(?:module|global)\b/m.test(src)) aumentan.add(f);
    for (const spec of especificadores(src)) { const d = resolver(f, spec, existe); if (d) arista(d, f); }
    if (!ES_TEST.test(f)) continue;
    const nombradas = rutasNombradas(src);
    const archivosNombrados = new Set();
    for (const t of nombradas) for (const a of porClave.get(t) ?? []) if (a !== f) archivosNombrados.add(a);
    for (const t of rutasSinExtension(src)) { const a = resolverNombre(t, existe); if (a && a !== f) archivosNombrados.add(a); }
    nombradasPor.set(f, archivosNombrados);
    // Un test que LANZA un script o un hijo (`spawn('node', ['tests/_x-hijo.ts'])`) depende de todo lo que ese
    // hijo importa. Sólo ayudantes (`tests/_*`) y scripts: nombrar a OTRO test no es correrlo.
    for (const a of archivosNombrados) if (ES_CODIGO.test(a) && /^(?:tests\/_|scripts\/)/.test(a)) arista(a, f);
    const m = motivoBarredora(src, nombradas);
    if (m) motivoBarre.set(f, m);
  }

  const elegidos = new Map();
  const sumar = (test, tipo, detalle) => { if (!elegidos.has(test)) elegidos.set(test, []); elegidos.get(test).push({ tipo, detalle }); };

  for (const [t, m] of motivoBarre) sumar(t, 'barre', m);
  for (const t of tests) {
    if (cambiadosSet.has(t)) sumar(t, 'cambio', 'el cambio lo toca');
    for (const a of nombradasPor.get(t) ?? []) if (cambiadosSet.has(a)) sumar(t, 'nombra', a);
  }

  // Quién importa a los cambiados, directo o por la cadena. BFS: la primera cadena es la más corta.
  const alcanzaTest = new Set();   // cambiados desde los que se llega a ALGÚN test (para decir cuáles quedan sin red)
  for (const origen of cambiados) {
    const padre = new Map([[origen, null]]);
    const saltos = new Map([[origen, 0]]);
    const cola = [origen];
    for (let i = 0; i < cola.length; i++) {
      const actual = cola[i];
      if (saltos.get(actual) >= profundidad) continue;
      for (const quien of importadoPor.get(actual) ?? []) {
        if (padre.has(quien)) continue;
        padre.set(quien, actual);
        saltos.set(quien, saltos.get(actual) + 1);
        cola.push(quien);
        if (ES_TEST.test(quien)) {
          alcanzaTest.add(origen);
          const cadena = [];
          for (let n = quien; n != null; n = padre.get(n)) cadena.push(n);
          sumar(quien, 'importa', cadena.join(' → '));
        }
      }
    }
  }

  const mencionados = new Set();
  for (const set of nombradasPor.values()) for (const a of set) mencionados.add(a);
  const sinRed = cambiados.filter((f) => !ES_TEST.test(f) && !alcanzaTest.has(f) && !mencionados.has(f)).sort();
  return { tests: elegidos, sinRed, totalTests: tests.length, importadoPor, aumentan };
}

/** Un solo motivo por test, el más específico: lo que lo toca de verdad gana sobre «corre siempre». */
export function motivoPrincipal(razones) {
  for (const tipo of ['cambio', 'nombra', 'importa', 'barre']) {
    const r = razones.find((x) => x.tipo === tipo);
    if (r) return r;
  }
  return razones[0];
}

// -----------------------------------------------------------------------------
// 4b. Qué tipos mirar (el tsc acotado de scripts/antes-de-subir.mjs)
// -----------------------------------------------------------------------------

/**
 * Los .ts/.tsx que el tsc acotado tiene que compilar para que un cambio no llegue roto a Actions:
 * lo que el cambio toca (run 10: una bitácora sin `puntos`; runs 51 y 52: un ayudante de tests nuevo) y
 * los que lo IMPORTAN, un nivel (un test SIN tocar que llama a la firma vieja de lo que cambiaste: en el run 31 un test
 * llamaba con 2 argumentos a una firma que pedía 1). tsc suma solo lo que esos archivos importan.
 *
 * ⚠️ Y los archivos que AUMENTAN tipos (`declare module '…'` / `declare global`) de la misma carpeta de primer nivel
 * (`app/web-generator/…`): un archivo compilado SOLO no ve el tipo que agrega otro. Medido el 17/10/2026 al reproducir el
 * run 10 con el tsc real: sin esto, `insertar.ts` daba TS2339 («toggleEtiqueta no existe en ChainedCommands») que el tsc
 * completo no da — la limitación que scripts/tsc-acotado.mjs ya avisaba, y que hacía un ROJO que Actions no iba a dar.
 */
export function alcanceTsc({ cambiados, archivos, importadoPor, aumentan = new Set() }) {
  const existentes = new Set(archivos);
  const esTs = (f) => /\.(?:ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && existentes.has(f);
  const alcance = new Set();
  for (const f of cambiados) {
    if (esTs(f)) alcance.add(f);
    for (const quien of importadoPor.get(f) ?? []) if (esTs(quien)) alcance.add(quien);
  }
  const zona = (f) => f.split('/').slice(0, 2).join('/');
  const zonas = new Set([...alcance].map(zona));
  for (const a of aumentan) if (esTs(a) && zonas.has(zona(a))) alcance.add(a);
  return [...alcance].sort();
}

// -----------------------------------------------------------------------------
// 5. Git: el cambio, y de dónde se leen los archivos (el disco, o un commit sin checkout)
// -----------------------------------------------------------------------------

function git(args, opciones = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...opciones });
}
export const lineasZ = (s) => s.split('\0').filter(Boolean);
export { git };

/** Lo que el cambio toca: commiteado desde el ancestro común con la base + sin commitear + archivos nuevos sin git. */
export function leerCambios(base) {
  let ancestro;
  try { ancestro = git(['merge-base', base, 'HEAD']).trim(); }
  catch { return null; }
  const tocados = new Set(lineasZ(git(['diff', '--name-only', '-z', '--no-renames', ancestro])));
  const nuevos = lineasZ(git(['ls-files', '--others', '--exclude-standard', '-z']));
  for (const n of nuevos) tocados.add(n);
  return { ancestro, cambiados: [...tocados].sort(), nuevos };
}

export const leerDisco = (r) => { try { return readFileSync(r, 'utf8'); } catch { return null; } };

/**
 * Los archivos de un commit, SIN checkout: `git ls-tree` + un solo `git cat-file --batch` para todo el código.
 * Es lo que permite repetir la selección sobre el árbol exacto que falló en Actions (scripts/replay-fallos-ci.mjs)
 * sin armar un worktree de 17.000 archivos por cada run.
 */
export function fuenteGit(sha) {
  const archivos = lineasZ(git(['ls-tree', '-r', '--name-only', '-z', sha]));
  const codigo = archivos.filter((f) => ES_CODIGO.test(f));
  const r = spawnSync('git', ['cat-file', '--batch'], { input: codigo.map((f) => `${sha}:${f}`).join('\n') + '\n', maxBuffer: 1 << 30 });
  const buf = r.stdout;
  const mapa = new Map();
  let pos = 0;
  for (const f of codigo) {
    const fin = buf.indexOf(10, pos);
    const cabecera = buf.toString('utf8', pos, fin);
    pos = fin + 1;
    if (cabecera.endsWith(' missing')) continue;
    const tam = Number(cabecera.split(' ')[2]);
    mapa.set(f, buf.toString('utf8', pos, pos + tam));
    pos += tam + 1;
  }
  return { archivos, leer: (f) => mapa.get(f) ?? null };
}

/** Lo que cambió entre dos commits (el delta de un run de Actions: del último verde a la cabeza). */
export function cambiosEntre(base, cabeza) {
  return lineasZ(git(['diff', '--name-only', '-z', '--no-renames', base, cabeza])).sort();
}

/** Copia del índice con lo nuevo agregado como intent-to-add: `git ls-files` lo ve, el índice real no cambia. */
export function indiceConNuevos(nuevos, carpetaTmp) {
  if (nuevos.length === 0) return null;
  try {
    const real = git(['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
    const copia = path.join(carpetaTmp, 'index');
    copyFileSync(real, copia);
    git(['add', '-N', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: nuevos.join('\0'), env: { ...process.env, GIT_INDEX_FILE: copia } });
    return copia;
  } catch (e) {
    process.stderr.write(`  [tests-afectados] no pude armar el índice temporal (${String(e.message).split('\n')[0]}): las guardas de git ls-files no verán lo nuevo\n`);
    return null;
  }
}

/** Mira el disco y arma el plan: qué cambió y qué tests lo miran. null si la base no existe. */
export function planear(base, { profundidad = Infinity } = {}) {
  const cambios = leerCambios(base);
  if (!cambios) return null;
  const archivos = [...lineasZ(git(['ls-files', '-z'])), ...cambios.nuevos];
  const sel = seleccionar({ cambiados: cambios.cambiados, archivos, leer: leerDisco, profundidad });
  if (cambios.cambiados.length === 0) sel.tests = new Map();     // sin cambios no hay nada «que corra siempre»
  return { cambios, archivos, sel };
}

/** Los tests en el orden en que conviene correrlos, agrupados por su motivo principal. */
export function agrupar(tests) {
  const grupos = { cambio: [], nombra: [], importa: [], barre: [] };
  for (const [t, razones] of tests) grupos[motivoPrincipal(razones).tipo].push(t);
  for (const g of Object.values(grupos)) g.sort();
  // El orden de corrida: lo que fija la FORMA de un archivo (los que lo nombran, las barredoras) antes que los que sólo lo
  // importan — de los 6 rojos de los runs 80, 82, 85 y 89, cinco eran de los primeros. Con --cortar, el rojo sale en las primeras tandas.
  return { grupos, orden: [...grupos.cambio, ...grupos.nombra, ...grupos.barre, ...grupos.importa] };
}

// -----------------------------------------------------------------------------
// 6. Correr, con la RAM mirada
// -----------------------------------------------------------------------------

// El piso de RAM se DERIVA (como en typecheck-lock.mjs): la zona roja del vigía de ~/.claude/guardia
// (por debajo de eso mata al proceso más grande) + lo que pide cada proceso de test (medido ~0,25-0,4
// GB con tsx) + margen. Un número a ojo es un permiso para que lo maten.
export const ZONA_ROJA_VIGIA_GB = 0.9;
const COSTO_PROCESO_GB = 0.35;
const MARGEN_GB = 0.3;
const ESPERA_RAM_MAX_MS = 15 * 60 * 1000;
const TOPE_TANDA_MS = 10 * 60 * 1000;
export const pisoRam = (concurrencia) => ZONA_ROJA_VIGIA_GB + COSTO_PROCESO_GB * concurrencia + MARGEN_GB;

export function ramLibreGb() {
  try { const m = readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)\s*kB/); if (m) return Number(m[1]) * 1024 / GB; } catch { /* no es Linux */ }
  return os.freemem() / GB;     // Windows: lo «disponible» del Administrador de tareas
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera a que haya RAM para `concurrencia` procesos (o para 1, si apenas alcanza). 0 = no hubo en 15 min.
 * `pisoGb`: para trabajos que pesan otra cosa (el tsc acotado pide su heap). En Actions (CI=true) el runner es
 * nuestro y nadie más está adentro: no se espera.
 */
export async function esperarRam(concurrencia, { pisoGb = pisoRam, quien = 'tests-afectados', esperaMaxMs = ESPERA_RAM_MAX_MS } = {}) {
  if (process.env.CI) return concurrencia;
  const hasta = Date.now() + esperaMaxMs;
  let avisado = false;
  for (;;) {
    const libre = ramLibreGb();
    for (let c = concurrencia; c >= 1; c--) if (libre >= pisoGb(c)) return c;
    if (process.env.MAKO_TESTS_SIN_ESPERA === '1') {
      process.stderr.write(`  [${quien}] MAKO_TESTS_SIN_ESPERA=1 con ${libre.toFixed(1)} GB: corro igual, puede matarlo el vigía\n`);
      return 1;
    }
    if (Date.now() >= hasta) return 0;
    if (!avisado) {
      process.stderr.write(`  [${quien}] quedan ${libre.toFixed(1)} GB de RAM y hacen falta ${pisoGb(1).toFixed(1)}: espero hasta ${Math.round(esperaMaxMs / 60000)} min…\n`);
      avisado = true;
    }
    await dormir(2000);
  }
}

function matarArbol(hijo) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
    else hijo.kill('SIGKILL');
  } catch { /* ya murió */ }
}

function correrTanda(archivos, concurrencia, env) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const bandera = concurrencia > 0 ? [`--test-concurrency=${concurrencia}`] : [];    // 0 = el de node (Actions)
    const hijo = spawn(process.execPath, ['--import', 'tsx', '--test', ...bandera, ...archivos], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = [];
    hijo.stdout.on('data', (d) => trozos.push(d));
    hijo.stderr.on('data', (d) => trozos.push(d));
    let colgada = false;
    const reloj = setTimeout(() => { colgada = true; matarArbol(hijo); }, TOPE_TANDA_MS);
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      resolve({ salida: Buffer.concat(trozos).toString('utf8'), codigo: colgada ? 1 : codigo, colgada, ms: Date.now() - t0 });
    });
  });
}

/** Lo que el runner de node imprime al final: «ℹ tests N … ℹ fail M», y «test at <archivo>» por cada rojo. */
export function leerResultado(salida) {
  const num = (n) => Number((salida.match(new RegExp(`^ℹ ${n} (\\d+)`, 'm')) ?? [])[1] ?? 0);
  const rojos = [...new Set([...salida.matchAll(/^test at (\S+?\.test\.ts)/gm)].map((m) => m[1].replace(/\\/g, '/')))];
  const i = salida.indexOf('✖ failing tests:');
  return { tests: num('tests'), pasan: num('pass'), fallan: num('fail'), canceladas: num('cancelled'), rojos, detalle: i >= 0 ? salida.slice(i) : '' };
}

export const min = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(0)} s`);

/**
 * Corre `lista` por tandas. Devuelve { sinRam, total, rojos, cortada, ms, ramMin }. `env` lleva el índice
 * temporal de git; `carpetaTmp` guarda el log completo de cada tanda roja.
 */
export async function correrTests({ lista, tanda, concurrencia, cortar, env, carpetaTmp, out }) {
  const tandas = [];
  for (let i = 0; i < lista.length; i += tanda) tandas.push(lista.slice(i, i + tanda));
  const t0 = Date.now();
  let ramMin = Infinity;
  const vigilante = setInterval(() => { ramMin = Math.min(ramMin, ramLibreGb()); }, 1000);
  const total = { tests: 0, pasan: 0, fallan: 0 };
  const rojos = new Set();
  let sinRam = false;
  let cortada = false;
  try {
    for (let n = 0; n < tandas.length; n++) {
      const c = await esperarRam(concurrencia || 2);
      if (c === 0) { sinRam = true; break; }
      const r = await correrTanda(tandas[n], concurrencia === 0 ? 0 : c, env);
      const res = leerResultado(r.salida);
      total.tests += res.tests; total.pasan += res.pasan; total.fallan += res.fallan + res.canceladas;
      const roja = r.codigo !== 0;
      out(`  tanda ${n + 1}/${tandas.length} · ${tandas[n].length} archivos · ${res.tests} tests · ${roja ? `ROJA (${res.rojos.length || '?'} archivos)` : 'verde'} · ${min(r.ms)}`);
      if (roja) {
        for (const f of res.rojos) rojos.add(f);
        if (!res.rojos.length) for (const f of tandas[n]) rojos.add(`${f} (¿alguno de la tanda?)`);
        const log = path.join(carpetaTmp, `tanda-${n + 1}.log`);
        writeFileSync(log, r.salida);
        out(r.colgada ? `    ✖ la tanda pasó los ${min(TOPE_TANDA_MS)} y se mató: un test se colgó.` : (res.detalle.split('\n').slice(0, 60).join('\n') || r.salida.split('\n').slice(-30).join('\n')));
        out(`    (salida completa: ${log})`);
        if (cortar) { cortada = true; break; }
      }
    }
  } finally {
    clearInterval(vigilante);
  }
  return { sinRam, total, rojos, cortada, ms: Date.now() - t0, ramMin, tandas: tandas.length };
}

// -----------------------------------------------------------------------------
// 7. La línea de comandos
// -----------------------------------------------------------------------------

function leerArgs(argv) {
  const o = { base: 'origin/main', listar: false, explicar: false, cortar: false, resto: false, tanda: 6, concurrencia: 2, profundidad: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    const valor = () => (v !== undefined ? v : argv[++i]);
    if (k === '--base') o.base = valor();
    else if (k === '--tanda') o.tanda = Math.max(1, Number.parseInt(valor(), 10) || 6);
    else if (k === '--concurrencia') { const c = valor(); o.concurrencia = c === 'auto' ? 0 : Math.max(1, Number.parseInt(c, 10) || 2); }
    else if (k === '--profundidad') o.profundidad = Math.max(1, Number.parseInt(valor(), 10) || 1);
    else if (k === '--listar') o.listar = true;
    else if (k === '--explicar') o.explicar = true;
    else if (k === '--cortar') o.cortar = true;
    else if (k === '--resto') o.resto = true;
    else if (k === '--ayuda' || k === '-h') o.ayuda = true;
    else { process.stderr.write(`  [tests-afectados] no conozco «${argv[i]}» (mirá --ayuda)\n`); o.ayuda = true; }
  }
  return o;
}

const AYUDA = `node scripts/tests-afectados.mjs [--base origin/main] [--listar] [--explicar] [--cortar] [--resto] [--tanda 6] [--concurrencia 2|auto] [--profundidad N]
  Elige los tests que lo cambiado desde --base puede romper (barredoras, nombran un archivo cambiado, importan uno) y los corre.
  --profundidad N: sólo sigue N saltos de import (por default todos). Es la palanca si el tiempo aprieta, con el costo de dejar afuera a los más lejanos.
  --resto: corre LOS DEMÁS (todos menos los afectados): Actions corre primero los afectados y después éstos, y así no se repite ninguno.
  Salida: 0 verde · 1 rojo · 2 no se pudo calcular · 99 no corrió (falta RAM).`;

const ETIQUETA = { cambio: 'los toca el cambio', nombra: 'nombran un archivo cambiado', barre: 'barren el repo (corren siempre)', importa: 'importan un archivo cambiado' };

/** Imprime el plan: cuántos tests, por qué motivo, y los avisos (archivos sin red, nuevos sin git, árbol atrasado). */
export function imprimirPlan(plan, o, out) {
  const { cambios, sel } = plan;
  const { grupos } = agrupar(sel.tests);
  out(`[tests-afectados] ${cambios.cambiados.length} archivos cambiados respecto de ${o.base} → ${sel.tests.size} de ${sel.totalTests} tests`);
  for (const tipo of ['cambio', 'nombra', 'barre', 'importa']) {
    const lista = grupos[tipo];
    if (lista.length === 0) continue;
    out(`  · ${String(lista.length).padStart(3)} ${ETIQUETA[tipo]}`);
    const ver = o.explicar ? lista : lista.slice(0, 5);
    for (const t of ver) {
      const razones = sel.tests.get(t);
      const principal = motivoPrincipal(razones);
      const otros = razones.filter((r) => r !== principal && r.tipo !== 'barre').map((r) => `${r.tipo}: ${r.detalle}`);
      out(`      ${t.replace(/^tests\//, '')}  (${principal.detalle}${o.explicar && otros.length ? ' · ' + otros.join(' · ') : ''})`);
    }
    if (!o.explicar && lista.length > ver.length) out(`      …y ${lista.length - ver.length} más (--explicar los lista)`);
  }
  if (sel.sinRed.length) out(`  ⚠ ${sel.sinRed.length} archivos cambiados que ningún test mira: ${sel.sinRed.slice(0, 6).join(', ')}${sel.sinRed.length > 6 ? '…' : ''}`);
  if (cambios.nuevos.length) out(`  ℹ ${cambios.nuevos.length} archivos NUEVOS sin git: las guardas de git ls-files los ven igual acá (índice temporal), pero commitealos o no viajan.`);
  try {
    const atras = Number(git(['rev-list', '--count', `HEAD..${o.base}`]).trim());
    if (atras > 0) out(`  ℹ ${o.base} tiene ${atras} commits que tu árbol no tiene: los tests de acá no ven lo que hicieron los demás.`);
  } catch { /* sin base remota */ }
}

async function main(argv) {
  const o = leerArgs(argv);
  if (o.ayuda) { process.stdout.write(AYUDA + '\n'); return 2; }
  const out = (s = '') => process.stdout.write(s + '\n');

  let raiz;
  try { raiz = git(['rev-parse', '--show-toplevel']).trim(); } catch { process.stderr.write('  [tests-afectados] esto no es un repo de git\n'); return 2; }
  process.chdir(raiz);

  const plan = planear(o.base, { profundidad: o.profundidad });
  if (!plan) {
    process.stderr.write(`  [tests-afectados] no encuentro «${o.base}». Probá \`git fetch origin\`, o pasá otra base con --base.\n`);
    return 2;
  }
  const { cambios, sel } = plan;
  if (cambios.cambiados.length === 0 && !o.resto) { out(`[tests-afectados] Nada cambió respecto de ${o.base}: no hay tests que correr.`); return 0; }

  let lista;
  if (o.resto) {
    // Los demás: todos los tests menos los que ya corrieron como afectados. La suma de las dos fases es la suite entera.
    const todos = plan.archivos.filter((f) => ES_TEST.test(f)).sort();
    lista = todos.filter((t) => !sel.tests.has(t));
    out(`[tests-afectados] --resto: ${lista.length} tests (${todos.length} en total − ${sel.tests.size} afectados que ya corrieron)`);
    if (o.listar) return 0;
  } else {
    imprimirPlan(plan, o, out);
    lista = agrupar(sel.tests).orden;
    if (o.listar) return 0;
    if (lista.length === 0) { out('[tests-afectados] Ningún test mira lo cambiado.'); return 0; }
  }

  const carpetaTmp = mkdtempSync(path.join(os.tmpdir(), 'tests-afectados-'));
  const indice = indiceConNuevos(cambios.nuevos, carpetaTmp);
  const env = { ...process.env, ...(indice ? { GIT_INDEX_FILE: indice } : {}) };
  const r = await correrTests({ lista, tanda: o.tanda, concurrencia: o.concurrencia, cortar: o.cortar, env, carpetaTmp, out });

  if (r.sinRam) {
    process.stderr.write(`\n  ✖ NO CORRÍ LOS TESTS: NO HAY RAM (quedan ${ramLibreGb().toFixed(1)} GB, hace falta ${pisoRam(1).toFixed(1)}). Esto NO es un test roto.\n`);
    process.stderr.write('    Cerrá unos chats de Claude y volvé a correrlo, o MAKO_TESTS_SIN_ESPERA=1 para correr igual (puede matarlo el vigía).\n\n');
    return SALIDA_SIN_CORRER;
  }
  rmSync(carpetaTmp, { recursive: true, force: true });
  out(`\n[tests-afectados] ${r.rojos.size === 0 ? '✔ VERDE' : '✖ ROJO'} · ${r.total.tests} tests de ${lista.length} archivos${r.cortada ? ' (cortado en la primera tanda roja)' : ''} · ${min(r.ms)} · RAM libre mínima ${Number.isFinite(r.ramMin) ? r.ramMin.toFixed(1) : '?'} GB`);
  if (r.rojos.size) {
    out('  Rojos: ' + [...r.rojos].join(', '));
    out('  Repetilos solos: node --import tsx --test ' + [...r.rojos].filter((f) => f.startsWith('tests/') && !f.includes(' ')).join(' '));
    out('  Antes de tocar nada: `git status --short` de los archivos que ese test lee (AGENTS.md → «Si el pre-push da rojo»).');
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`  [tests-afectados] error inesperado: ${e?.stack ?? e}\n`); process.exit(2); });
}
