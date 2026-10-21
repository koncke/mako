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
//   --tanda N (default 6) · --concurrencia N (default 2) | auto (= todos los núcleos, 4 como tope: es lo que usa Actions)
// Salida: 0 verde · 1 hay tests rojos · 2 no se pudo calcular (base inexistente…) · 99 no corrió por falta de RAM.
// ⚠️ Que esto dé verde NO reemplaza a Actions (tipos, las demás guardas, y los ~950 tests que acá no
// se miran): reduce el riesgo de la falla más cara, no la elimina.
// =============================================================================

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armarTsconfig, dtsVersionados } from './tsc-acotado.mjs';
import { veredicto } from './tsc-bitacoras.mjs';

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
 * Los especificadores de EJECUCIÓN más los `import type` / `export type … from`. Un import de tipos se borra al compilar (el test no puede romperse en tiempo de ejecución:
 * por eso `especificadores` no lo cuenta), pero el tsc SÍ lo sigue: es la puerta por la que un tipo que cambió rompe a un test que no se tocó (run 187 de Actions).
 */
export function especificadoresConTipos(src) {
  const salida = new Set(especificadores(src));
  for (const m of src.matchAll(RE_ESTATICO)) if (m[1]) salida.add(m[3]);
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

// Lo que un test hace y que, si comparte proceso con otros (scripts/cache-lecturas.cjs), les cambiaría el mundo: el directorio de trabajo, el entorno,
// los globales, la carga de módulos, los relojes y los mocks. Una barredora que no hace nada de esto sólo LEE: se puede correr con las demás.
const PELIGRO_COMPARTIR = new RegExp([
  String.raw`process\.(?:chdir|exit|on|once)\b`, String.raw`Module\._load`, String.raw`require\.cache`, String.raw`\bmock\.(?:module|method|fn|timers|getter|setter)`,
  String.raw`\bt\.mock\b`, String.raw`\bsetSystemTime\b`, String.raw`delete\s+process\.env`,
  String.raw`process\.env(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=[^=]`,
  String.raw`\b(?:globalThis|global)\b(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=[^=]`,
  String.raw`\(\s*(?:globalThis|global)\s+as\b[^)]*\)\s*(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=[^=]`,
  String.raw`Object\.defineProperty\(\s*(?:globalThis|global)\b`, String.raw`\b(?:window|document)\s*=[^=]`,
].join('|'));

/** ¿Esta barredora puede correr en un proceso COMPARTIDO con otras (sólo lee)? `src` va sin comentarios. */
export const compartible = (src) => !PELIGRO_COMPARTIR.test(src);

// -----------------------------------------------------------------------------
// 4. La selección (pura: recibe los archivos y cómo leerlos)
// -----------------------------------------------------------------------------

/**
 * @param {{ cambiados: string[], archivos: string[], leer: (ruta: string) => string | null, profundidad?: number }} p
 *   cambiados: lo que el cambio toca (incluye borrados); archivos: lo que existe ahora (incluye
 *   lo nuevo sin git); leer: el texto de un archivo de código; profundidad: cuántos saltos de import se siguen
 *   (default: todos; `--profundidad 3` es la palanca si el tiempo aprieta: ver el replay, qué rojos salen a cada profundidad).
 * @returns {{ tests: Map<string, {tipo: string, detalle: string}[]>, sinRed: string[], totalTests: number, importadoPor: Map<string, Set<string>>, importadoPorTipos: Map<string, Set<string>>, aumentan: Set<string>, compartibles: Set<string> }}
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
  // Lo mismo MÁS los `import type`: el grafo por el que un tipo que cambia llega a un test que no se tocó. Sirve al tsc acotado (`alcanceTsc`), no a elegir qué tests correr.
  const importadoPorTipos = new Map();
  const aristaTipos = (destino, origen) => { if (destino === origen) return; if (!importadoPorTipos.has(destino)) importadoPorTipos.set(destino, new Set()); importadoPorTipos.get(destino).add(origen); };
  const tests = [...existentes].filter((f) => ES_TEST.test(f)).sort();
  const aumentan = new Set();      // archivos que agregan tipos a otros (`declare module`/`declare global`)
  const nombradasPor = new Map();  // test → archivos que nombra
  const motivoBarre = new Map();
  const compartibles = new Set();  // las barredoras que sólo LEEN: pueden correr juntas en un proceso (ver compartible)

  for (const f of existentes) {
    if (!ES_CODIGO.test(f)) continue;
    const crudo = leer(f);
    if (crudo == null) continue;
    const src = sinComentarios(crudo);
    if (/^\s*declare\s+(?:module|global)\b/m.test(src)) aumentan.add(f);
    const enEjecucion = especificadores(src);
    for (const spec of enEjecucion) { const d = resolver(f, spec, existe); if (d) { arista(d, f); aristaTipos(d, f); } }
    for (const spec of especificadoresConTipos(src)) { if (enEjecucion.includes(spec)) continue; const d = resolver(f, spec, existe); if (d) aristaTipos(d, f); }
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
    // Quién puede correr en un proceso COMPARTIDO: todo test que no toca estado global (ver `compartible`). Medido el 17/10/2026: los
    // 1.050 compartibles de los 1.125 tests, en 2 procesos, dieron 10.905 casos, 0 rojos y 0 interferencias, en 260 s (separados, ~50 min en
    // esa misma PC cargada). El riesgo conocido es un FALSO VERDE por contagio (un test que pasa sólo por lo que dejó otro): lo cubre Actions,
    // donde cada test sigue en su proceso.
    if (m) motivoBarre.set(f, m);
    if (compartible(src)) compartibles.add(f);
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
  return { tests: elegidos, sinRed, totalTests: tests.length, importadoPor, importadoPorTipos, aumentan, compartibles };
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
 * lo que el cambio toca (run 10: una bitácora sin `puntos`; run 31: un test que llamaba con 2 argumentos a una firma que
 * pedía 1; runs 51 y 52: un ayudante de tests nuevo). tsc suma solo lo que esos archivos importan.
 *
 * `importadores: true` suma además los que importan lo cambiado, un nivel (un test SIN tocar que llama a la firma vieja de lo que
 * cambiaste). NO es el default en local: el 17/10/2026, con ~14 chats abiertos, el alcance con importadores (188 archivos) pedía
 * 4,3 GB y la PC tenía 1,3 libres — el gate se trababa y nadie lo iba a usar. El tsc completo de Actions, que corre justo después de
 * los tests afectados, cubre a los importadores; los 4 rojos de «Tipos» del replay están en lo CAMBIADO o los frena modulos-ts.
 *
 * ⚠️ Y los archivos que AUMENTAN tipos (`declare module '…'` / `declare global`) de la misma carpeta de primer nivel
 * (`app/web-generator/…`): un archivo compilado SOLO no ve el tipo que agrega otro (la limitación que scripts/tsc-acotado.mjs ya
 * avisaba: `insertar.ts` da TS2339 «toggleEtiqueta no existe en ChainedCommands» si `extensiones/marcas.ts` no está en la lista).
 * Cuando el archivo suelto NO está en el alcance sino que llega por arrastre, no alcanza con esto: ahí los errores no bloquean
 * (scripts/antes-de-subir.mjs → correrTsc). Medido el 17/10/2026 reproduciendo el run 10 con el tsc real.
 * @param {{ cambiados: string[], archivos: string[], importadoPor: Map<string, Set<string>>, importadoPorTipos?: Map<string, Set<string>> | null, aumentan?: Set<string>, importadores?: boolean, profundidadTests?: number }} p
 * @returns {string[]}
 */
export function alcanceTsc({ cambiados, archivos, importadoPor, importadoPorTipos = null, aumentan = new Set(), importadores = false, profundidadTests = PROFUNDIDAD_TESTS_TIPOS }) {
  const existentes = new Set(archivos);
  const esTs = (f) => /\.(?:ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && existentes.has(f);
  // El grafo de los TIPOS (con `import type`) si lo hay: `importadoPor` no ve a quien importa sólo tipos.
  const grafo = importadoPorTipos ?? importadoPor;
  const alcance = new Set();
  for (const f of cambiados) {
    if (esTs(f)) alcance.add(f);
    if (importadores) for (const quien of grafo.get(f) ?? []) if (esTs(quien)) alcance.add(quien);
    // Un archivo BORRADO ya no compila ni se mira: quien lo importaba sí, y es quien se rompe.
    if (!existentes.has(f)) for (const quien of grafo.get(f) ?? []) if (esTs(quien)) alcance.add(quien);
  }
  // ⚠️ LOS TESTS QUE DEPENDEN DE LO CAMBIADO ENTRAN AL ALCANCE, los toque el cambio o no (21/10/2026, la revisión de este mismo gate). Run 187: cambió un TIPO de lib/ y
  // tests/m-mako-chat.test.ts —sin tocar— dejó de compilar: tests-afectados lo eligió y lo corrió con tsx (que no chequea tipos), pero el tsc acotado sólo compilaba lo cambiado, y nadie
  // importa un test, así que el test nunca entraba al programa. Se siguen los imports DE TIPOS (`import type` también: m-mako-chat importaba el tipo sólo así) hasta `profundidadTests` saltos (uno),
  // desde TODO lo cambiado —un .mjs incluido: el run 173 era un .ts que importaba un .mjs sin JSDoc— y sólo se suman los tests (no los intermedios).
  if (importadoPorTipos) {
    const saltos = new Map(cambiados.map((f) => [f, 0]));
    const cola = [...cambiados];
    for (let i = 0; i < cola.length; i++) {
      if (saltos.get(cola[i]) >= profundidadTests) continue;
      for (const quien of importadoPorTipos.get(cola[i]) ?? []) {
        if (saltos.has(quien)) continue;
        saltos.set(quien, saltos.get(cola[i]) + 1);
        cola.push(quien);
        if (ES_TEST.test(quien) && esTs(quien)) alcance.add(quien);
      }
    }
  }
  const zona = (f) => f.split('/').slice(0, 2).join('/');
  const zonas = new Set([...alcance].map(zona));
  for (const a of aumentan) if (esTs(a) && zonas.has(zona(a))) alcance.add(a);
  return [...alcance].sort();
}

// ⚠️ Lo que DEFINE tipos para todo el repo no se puede chequear con un alcance acotado: `tsconfig*.json` (las opciones de compilación), `package.json`/`package-lock.json` (las versiones de
// typescript y de los @types) y los `.d.ts` (globales y `declare module`). Un cambio ahí puede romper a un archivo que no cambió y que ningún alcance conoce; con un alcance vacío daba
// `nada` → VERDE (la revisión del 21/10/2026). Si el acotado da bien, el resultado NO es verde: es `sin-tipos`, y lo decide el tsc completo (Actions).
const DEFINE_TIPOS = /^(?:tsconfig[^/]*\.json|package(?:-lock)?\.json)$|\.d\.ts$/;
export const tiposNoAcotables = (cambiados) => cambiados.map((f) => f.replace(/\\/g, '/')).filter((f) => DEFINE_TIPOS.test(f)).sort();
/**
 * Cuántos saltos de import (con tipos) se siguen desde lo cambiado para sumar tests al alcance del tsc acotado. UNO: los tests que importan DIRECTO lo cambiado (los runs 173 y 187 eran así).
 * ⚠️ MEDIDO el 21/10/2026 sobre los últimos 40 merges de main (alcance en archivos, mediana / máximo / merges con más de 120): sin tests 6 / 121 / 1 · un salto 16 / 208 / 1 · dos 32 / 359 / 6 · tres 42 / 488 / 13 ·
 * TODOS los saltos 518 / 687 / 21. Con todos, casi cualquier cambio en `lib/` arrastra 500 tests (los hubs de `lib/` los importan todos) y con ellos casi todo el programa: ~5 GB, que en esta PC casi nunca hay (SIN TIPOS casi siempre).
 * `MAKO_TIPOS_PROFUNDIDAD=3` (o 99) lo ensancha a propósito para un cambio de riesgo; lo que queda más lejos lo decide el tsc completo de Actions.
 */
export const PROFUNDIDAD_TESTS_TIPOS = Number(process.env.MAKO_TIPOS_PROFUNDIDAD) || 1;

/**
 * Todo lo que el tsc acotado necesita saber, en un solo lugar para que `tests-afectados` y `antes-de-subir` no puedan discrepar:
 * el alcance (lo cambiado + los tests que dependen de lo cambiado) y lo que no se puede acotar.
 * @param {{ cambiados: string[], archivos: string[], sel: { importadoPor: Map<string, Set<string>>, importadoPorTipos?: Map<string, Set<string>>, aumentan: Set<string> }, importadores?: boolean }} p
 */
export function planDeTipos({ cambiados, archivos, sel, importadores = false }) {
  return {
    alcance: alcanceTsc({ cambiados, archivos, importadoPor: sel.importadoPor, importadoPorTipos: sel.importadoPorTipos, aumentan: sel.aumentan, importadores }),
    noAcotables: tiposNoAcotables(cambiados),
  };
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

/**
 * Los tests en el orden en que conviene correrlos, agrupados por su motivo principal.
 * @param {Map<string, {tipo: string, detalle: string}[]>} tests
 * @param {Set<string>} [compartibles]
 * @param {{ compartir?: boolean | 'todo' | 'barredoras' }} [opciones] compartir: false/true/'todo' (todos los compartibles) o 'barredoras' (sólo las que barren)
 */
export function agrupar(tests, compartibles = new Set(), { compartir = false } = {}) {
  const grupos = { cambio: [], nombra: [], importa: [], barre: [] };
  const compartidos = [];
  for (const [t, razones] of tests) {
    // Con `compartir`, los tests que no tocan estado global salen de la fila y van juntos a UN proceso por grupo (scripts/cache-lecturas.cjs).
    // Un test que el cambio mismo toca (nuevo o editado) va aparte, en su proceso: es el que más probablemente esté rojo, y se lee solo.
    // `compartir`: true / 'todo' = todos los compartibles; 'barredoras' = sólo las que barren (lo que más pesa y menos riesgo tiene).
    if (compartir && compartibles.has(t) && !razones.some((r) => r.tipo === 'cambio') && (compartir !== 'barredoras' || razones.some((r) => r.tipo === 'barre'))) { compartidos.push(t); continue; }
    grupos[motivoPrincipal(razones).tipo].push(t);
  }
  for (const g of Object.values(grupos)) g.sort();
  // El orden de corrida: lo que fija la FORMA de un archivo (los que lo nombran, las barredoras) antes que los que sólo lo
  // importan — de los 6 rojos de los runs 80, 82, 85 y 89, cinco eran de los primeros. Con --cortar, el rojo sale en las primeras tandas.
  return { grupos, orden: [...grupos.cambio, ...grupos.nombra, ...grupos.barre, ...grupos.importa], compartidos: compartidos.sort() };
}

// -----------------------------------------------------------------------------
// 6. Correr, con la RAM mirada
// -----------------------------------------------------------------------------

// El piso de RAM se DERIVA (como en typecheck-lock.mjs): la zona roja del vigía de ~/.claude/guardia
// (por debajo de eso mata al proceso PESADO más grande: tsc, eslint, vitest, next build — NUNCA un `node --test`) + lo que pide cada
// proceso de test (medido ~0,25-0,4 GB con tsx) + margen. Un número a ojo es un permiso para que lo maten.
// ⚠️ El margen era 0,3 (piso de 1,55 GB para un proceso) y el 17/10/2026, con ~14 chats abiertos y 1,1-1,5 GB libres, el gate
// esperaba tanda tras tanda: «tiene que poder correr con 14 chats abiertos, o nadie lo va a usar». Los tests no los mata el vigía,
// así que el margen sólo cuida no empujar a la zona roja a los tsc de los OTROS chats: 0,05 deja 1,3 GB para uno (y 1,65 para dos).
export const ZONA_ROJA_VIGIA_GB = 0.9;
const COSTO_PROCESO_GB = 0.35;
const MARGEN_GB = 0.05;
const ESPERA_RAM_MAX_MS = (Number(process.env.MAKO_TESTS_ESPERA_S) || 15 * 60) * 1000;   // MAKO_TESTS_ESPERA_S: lo usan las pruebas de «sin RAM»
const REINTENTO_MAX = 8;    // más rojos que esto en una tanda no es la carga: es un cambio que rompe cosas
const TOPE_TANDA_MS = 10 * 60 * 1000;
export const pisoRam = (concurrencia) => Number(process.env.MAKO_TESTS_PISO_GB) || ZONA_ROJA_VIGIA_GB + COSTO_PROCESO_GB * concurrencia + MARGEN_GB;   // MAKO_TESTS_PISO_GB: lo usan las pruebas de «sin RAM»

/**
 * `--concurrencia auto`: TODOS los núcleos de la máquina (2 como mínimo, 4 como tope por la RAM). ⚠️ NO es el default de node, que es
 * `núcleos − 1`: en el runner de Actions (2 vCPU) eso es UN proceso a la vez y deja un núcleo parado. Medido el 17/10/2026 con la API
 * (`/actions/runs/{id}/timing`): con ese default las dos fases de tests sumaron 550 s contra 508 s del `npm test` de antes, y un run
 * verde pasó de ~11 a 14 min facturables (el rojo bajó de 5-10 a 2: fallar rápido funcionó, pero el verde es ~85 % de los runs).
 */
export const concurrenciaAuto = () => Math.max(2, Math.min(os.availableParallelism(), 4));

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
    // Sin NODE_TEST_CONTEXT: si esto se llama desde adentro de un test, node cree que el hijo es un test ANIDADO y deja de imprimir el reporte.
    const { NODE_TEST_CONTEXT: _anidado, ...limpio } = env;
    const hijo = spawn(process.execPath, ['--import', 'tsx', '--test', ...bandera, ...archivos], { env: limpio, stdio: ['ignore', 'pipe', 'pipe'] });
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

// Las barredoras que sólo leen corren JUNTAS en un proceso que memoriza las lecturas (scripts/cache-lecturas.cjs): medido el 17/10/2026,
// 12 barredoras globales tardaron 193 s en procesos separados y 40 s en uno compartido; las 148 que se pueden compartir, 267 s en dos.
const CACHE_LECTURAS = fileURLToPath(new URL('./cache-lecturas.cjs', import.meta.url)).replace(/\\/g, '/');
const TOPE_COMPARTIDO_MS = 25 * 60 * 1000;
const POR_GRUPO = 12;             // no vale armar un proceso compartido para menos de esto
const COSTO_COMPARTIDO_GB = 0.8;  // medido: ~725 MB de pico con 24 barredoras (guarda en memoria lo que lee)
const pisoCompartido = (grupos) => ZONA_ROJA_VIGIA_GB + COSTO_COMPARTIDO_GB * grupos + MARGEN_GB;

function correrGrupoCompartido(archivos, env) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const { NODE_TEST_CONTEXT: _anidado, ...limpio } = env;
    const NODE_OPTIONS = `${limpio.NODE_OPTIONS ?? ''} --require ${JSON.stringify(CACHE_LECTURAS)}`.trim();
    const hijo = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-isolation=none', ...archivos], { env: { ...limpio, NODE_OPTIONS }, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = [];
    hijo.stdout.on('data', (d) => trozos.push(d));
    hijo.stderr.on('data', (d) => trozos.push(d));
    let colgada = false;
    const reloj = setTimeout(() => { colgada = true; matarArbol(hijo); }, TOPE_COMPARTIDO_MS);
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
 * temporal de git; `carpetaTmp` guarda el log completo de cada tanda roja. `compartidos`: los que corren juntos en un proceso por grupo.
 * @param {{ lista: string[], compartidos?: string[], tanda: number, concurrencia: number, cortar: boolean, env: NodeJS.ProcessEnv, carpetaTmp: string, out: (s: string) => void }} p
 */
export async function correrTests({ lista, compartidos = [], tanda, concurrencia, cortar, env, carpetaTmp, out }) {
  const tandas = [];
  for (let i = 0; i < lista.length; i += tanda) tandas.push(lista.slice(i, i + tanda));
  const t0 = Date.now();
  let ramMin = Infinity;
  const vigilante = setInterval(() => { ramMin = Math.min(ramMin, ramLibreGb()); }, 1000);
  const total = { tests: 0, pasan: 0, fallan: 0 };
  const rojos = new Set();
  const flaky = [];
  let sinRam = false;
  let cortada = false;
  out(`  [tests-afectados] ${lista.length} archivos en ${tandas.length} tandas de hasta ${tanda}, ${concurrencia || 'los de node'} procesos a la vez (${os.availableParallelism()} CPU)`);
  try {
    for (let n = 0; n < tandas.length; n++) {
      const c = await esperarRam(concurrencia || 2);
      if (c === 0) { sinRam = true; break; }
      let r = await correrTanda(tandas[n], concurrencia === 0 ? 0 : c, env);
      let res = leerResultado(r.salida);
      total.tests += res.tests; total.pasan += res.pasan; total.fallan += res.fallan + res.canceladas;
      let roja = r.codigo !== 0;
      out(`  tanda ${n + 1}/${tandas.length} · ${tandas[n].length} archivos · ${res.tests} tests · ${roja ? `ROJA (${res.rojos.length || '?'} archivos)` : 'verde'} · ${min(r.ms)}`);
      // ⚠️ Subir la concurrencia puede sacar rojos que son de la CARGA: medido el 17/10/2026, `ads-video-procesando` (un tope de 40 ms) falló con 2
      // procesos en una PC saturada y pasó solo. Cada rojo falso en Actions cuesta 11-14 min, así que un archivo rojo se REPITE de a uno: si
      // pasa, se informa como FLAKY (no se esconde: queda en la salida y en el resultado) y no frena; si sigue rojo, es rojo de verdad.
      if (roja && !r.colgada && c > 1 && res.rojos.length > 0 && res.rojos.length <= REINTENTO_MAX) {
        const solos = res.rojos.filter((f) => /\.test\.ts$/.test(f));
        if (solos.length === res.rojos.length) {
          out(`    ↻ ${solos.length} archivo(s) rojo(s) con ${c} procesos a la vez: los repito de a UNO, por si es la carga`);
          const r2 = await correrTanda(solos, 1, env);
          if (r2.codigo === 0) {
            flaky.push(...solos);
            out(`    ⚠ FLAKY: ${solos.join(', ')} pasaron solos (rojos sólo con ${c} procesos). No frena, pero conviene arreglar el test: depende de la carga.`);
            roja = false;
          } else { r = r2; res = leerResultado(r2.salida); }
        }
      }
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

    // Las barredoras que sólo leen, juntas: UN proceso por grupo, con las lecturas compartidas. Un rojo acá puede ser de la INTERFERENCIA
    // (comparten `globalThis` y los módulos: medido, `editor-landing-origen` falló así y pasó solo), así que TODO rojo se repite aislado
    // antes de contarlo: si pasa solo es FLAKY, si sigue rojo es rojo.
    if (compartidos.length && !cortada && !sinRam) {
      const grupos = Math.max(1, Math.min(concurrencia || 2, Math.floor(compartidos.length / POR_GRUPO)));
      const g = await esperarRam(grupos, { pisoGb: pisoCompartido, quien: 'tests-afectados' });
      if (g === 0) sinRam = true;
      else {
        const partes = Array.from({ length: g }, () => []);
        compartidos.forEach((f, i) => partes[i % g].push(f));    // reparto alternado: las pesadas no quedan todas en el mismo
        out(`  [tests-afectados] ${compartidos.length} barredoras que sólo leen, en ${g} proceso(s) compartido(s) con las lecturas en memoria`);
        const rs = await Promise.all(partes.map((p) => correrGrupoCompartido(p, env)));
        const rojosCompartidos = new Set();
        for (const [i, r] of rs.entries()) {
          const res = leerResultado(r.salida);
          total.tests += res.tests; total.pasan += res.pasan; total.fallan += res.fallan + res.canceladas;
          const roja = r.codigo !== 0;
          out(`  grupo compartido ${i + 1}/${rs.length} · ${partes[i].length} archivos · ${res.tests} tests · ${roja ? `ROJO (${res.rojos.length || '?'} archivos)` : 'verde'} · ${min(r.ms)}`);
          if (roja) {
            if (!res.rojos.length || r.colgada) { for (const f of partes[i]) rojosCompartidos.add(f); } else for (const f of res.rojos) rojosCompartidos.add(f);
            writeFileSync(path.join(carpetaTmp, `compartido-${i + 1}.log`), r.salida);
          }
        }
        if (rojosCompartidos.size) {
          const solos = [...rojosCompartidos].filter((f) => /\.test\.ts$/.test(f));
          out(`    ↻ ${solos.length} archivo(s) rojo(s) en proceso compartido: los repito AISLADOS, uno por proceso, por si es la interferencia`);
          // Si cayó un grupo entero (se colgó, o murió) son cientos de archivos: de a uno tardaría una eternidad, así que con la concurrencia de siempre.
          const r2 = await correrTanda(solos, solos.length > REINTENTO_MAX ? Math.max(1, concurrencia || 2) : 1, env);
          const res2 = leerResultado(r2.salida);
          const siguenRojos = r2.codigo === 0 ? [] : (res2.rojos.length ? res2.rojos : solos);
          for (const f of solos) {
            if (siguenRojos.includes(f)) rojos.add(f);
            else { flaky.push(f); out(`    ⚠ FLAKY: ${f} falló en el proceso compartido y pasa aislado (interferencia con otro test). No frena.`); }
          }
          if (siguenRojos.length) {
            const log = path.join(carpetaTmp, 'compartido-aislado.log');
            writeFileSync(log, r2.salida);
            out(res2.detalle.split('\n').slice(0, 60).join('\n') || r2.salida.split('\n').slice(-30).join('\n'));
            out(`    (salida completa: ${log})`);
          }
        }
      }
    }
  } finally {
    clearInterval(vigilante);
  }
  return { sinRam, total, rojos, flaky, cortada, ms: Date.now() - t0, ramMin, tandas: tandas.length };
}

// -----------------------------------------------------------------------------
// 6b. Los TIPOS: el tsc acotado de lo que cambió, y cuándo un VERDE puede decirse VERDE
// -----------------------------------------------------------------------------
// ⚠️ `tsx` NO CHEQUEA TIPOS (21/10/2026). Un test nuevo o editado con un error de tipos corre perfecto con `node --import tsx --test` —tsx sólo quita los tipos— y
// sale VERDE acá; el error aparece recién en el paso «Tipos» de Actions. Ese día fallaron cuatro runs (173, 177, 187, 198) por eso, cada uno un email de GitHub a
// Martín («integracion → main: All jobs have failed») y un lote trabado; las puntas venían con `VERDE (tipos: los chequea Actions)` porque el tsc acotado no entró
// en RAM, y esa leyenda se leía como un verde. Por eso:
//   · los tipos de lo cambiado son PARTE del veredicto, no un adorno;
//   · si NO se pudieron chequear (no hay RAM, el vigía mató el tsc, otro typecheck no se liberó) la línea final NO dice VERDE: dice «SIN TIPOS: <por qué>» y sale 98;
//   · sólo un `--sin-tipos` a propósito (o MAKO_SIN_TIPOS=1) lo evita, y entonces tampoco dice VERDE: dice PARCIAL.
// En Actions (CI) no se corren: ahí está el paso «Tipos» con el tsc completo.

/** Misma idea que 99 (`SALIDA_SIN_CORRER`) pero para los tipos: «no pude chequear los tipos», que NO es «hay errores» ni «hay tests rojos». */
export const SALIDA_SIN_TIPOS = 98;

/**
 * Heap según cuántos archivos hay que compilar. ⚠️ El `tsc` suma TODO lo que esos archivos importan, y en este repo un solo archivo de app/ o lib/ ya arrastra ~1.800
 * archivos y ~2,5 GB (medido el 17/10/2026: 1 archivo → 1.835 archivos y 2.533 MB; 10 → 2.196 y 2.729 MB; 60 → 3.476 y 2.514 MB, 96 s). Con un tope de 2 GB (lo que
 * había puesto antes para alcances chicos) el `tsc` moría sin heap a partir de ~10 archivos, y eso se leía como «no terminó» y se SALTABA: los tipos casi nunca se
 * chequeaban. Por eso el mínimo es 3 GB (y el piso de RAM, ~4 GB: en una PC con 14 chats abiertos los tipos van a quedar «SIN TIPOS» seguido, y lo dice la línea final).
 */
export const heapPara = (n) => (n > 600 ? 5120 : n > 120 ? 4096 : 3072);
/** El piso de RAM del tsc acotado: su heap + 0,1 + la zona roja del vigía. `MAKO_TIPOS_PISO_GB` lo baja (lo usan las pruebas, que chequean un archivito, y quien sabe lo que hace). */
const pisoTsc = (heapMb) => () => (Number(process.env.MAKO_TIPOS_PISO_GB) || heapMb / 1024 + 0.1 + ZONA_ROJA_VIGIA_GB);

// ⚠️ EL TIPO NO ES UN CANDADO QUE SE ARREGLE ESPERANDO MUCHO (17/10/2026): el primer push del Cerebro con el pre-push nuevo se trabó en «tipos (188 archivos)», que pedía
// 4,3 GB cuando la PC tenía 1,3 libres. Se espera un rato razonable (2 min) y, si no entra, el resultado es «SIN TIPOS»: ya no se disfraza de verde, pero tampoco se espera media hora
// con el candado de lo pesado puesto. `MAKO_TIPOS_ESPERA_S` lo cambia.
export const ESPERA_TIPOS_MS = (Number(process.env.MAKO_TIPOS_ESPERA_S) || 120) * 1000;
const TOPE_TSC_MS = 15 * 60 * 1000;

// El MISMO archivo que scripts/typecheck-lock.mjs: un tsc por máquina, sea completo o acotado. `MAKO_TIPOS_LOCK` lo cambia (las pruebas, para no pelearse con el typecheck de otro chat).
const lockDeTipos = () => process.env.MAKO_TIPOS_LOCK || path.join(os.tmpdir(), 'mako-typecheck.lock');
const pidVivo = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch { return false; } };
const duenoDelLockTipos = (ruta) => { try { return Number.parseInt(readFileSync(ruta, 'utf8').trim(), 10); } catch { return NaN; } };

async function tomarLockTipos(maxMs, ruta) {
  const hasta = Date.now() + maxMs;
  let aviso = false;
  while (Date.now() < hasta) {
    try { writeFileSync(ruta, String(process.pid), { flag: 'wx' }); return true; } catch { /* ocupado */ }
    if (!pidVivo(duenoDelLockTipos(ruta))) { try { unlinkSync(ruta); } catch { /* otro lo sacó */ } continue; }
    if (!aviso) { process.stderr.write(`  [tipos] otro typecheck está corriendo (pid ${duenoDelLockTipos(ruta)}); espero mi turno…\n`); aviso = true; }
    await dormir(500);
  }
  return false;
}
export const soltarLockTipos = (ruta = lockDeTipos()) => { try { if (duenoDelLockTipos(ruta) === process.pid) unlinkSync(ruta); } catch { /* ya no es mío */ } };

/**
 * Corre el tsc acotado de verdad. Se inyecta en las pruebas para simular que lo mató el vigía, que se quedó sin heap…
 * @param {{ config: string, heap: number, raiz: string }} a
 * @returns {{ status: number | null, salida: string, error?: string }}
 */
function ejecutarTsc({ config, heap, raiz }) {
  const r = spawnSync(process.execPath, [`--max-old-space-size=${heap}`, path.join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', config], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TOPE_TSC_MS });
  return { status: r.error ? null : r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`, error: r.error?.message };
}

/**
 * El tsc ACOTADO de los .ts/.tsx que cambiaron (más los de `aumentan`): tsconfig temporal, noEmit, sin incremental, borrado al final. Medido por su CÓDIGO DE SALIDA y su salida,
 * sin pipes. Devuelve el estado, no un booleano:
 *   · `ok`        compiló y no hay errores en lo cambiado.
 *   · `nada`      ningún .ts/.tsx cambió: nada que compilar (cuenta como verde).
 *   · `rojo`      hay errores de tipos en los archivos del alcance (`porque` lista cuáles).
 *   · `sin-tipos` NO se pudo chequear: sin RAM, otro typecheck que no se liberó, o el tsc murió sin decir error (el vigía, o sin heap). NO es un error de tipos y NO es un verde.
 * ⚠️ SÓLO BLOQUEAN los errores de los archivos DEL ALCANCE. tsc también compila todo lo que esos archivos importan, y ahí un archivo suelto no ve los tipos que AGREGA otro
 * (`declare module`, `.d.ts` ambientes): medido el 17/10/2026 al reproducir el run 10, `insertar.ts` (TipTap) daba TS2339 que el tsc completo no da. Esos errores se muestran
 * pero no frenan: los decide el tsc completo de Actions. Un cambio que rompe a un importador DIRECTO sí frena (con `--importadores` entra al alcance).
 * @param {string[]} alcance rutas relativas a `raiz`
 * @param {{ raiz?: string, out?: (s: string) => void, esperaMs?: number, ejecutar?: typeof ejecutarTsc, heapMb?: number }} [o]
 * @returns {Promise<{ estado: 'ok' | 'nada' | 'rojo' | 'sin-tipos', porque?: string, archivos: number, ms?: number, heap?: number, arrastre?: number }>}
 */
async function correrTiposAcotado(alcance, { raiz = process.cwd(), out = () => {}, esperaMs = ESPERA_TIPOS_MS, ejecutar = ejecutarTsc, heapMb } = {}) {
  const archivos = alcance.length;
  if (archivos === 0) { out('  ✔ ningún .ts/.tsx cambió: nada que compilar'); return { estado: 'nada', archivos }; }
  const heap = heapMb ?? heapPara(archivos);
  const sinTipos = (porque) => { out(`  ✖ SIN TIPOS: ${porque}`); return { estado: 'sin-tipos', porque, archivos, heap }; };
  const lock = lockDeTipos();
  if (!(await tomarLockTipos(esperaMs, lock))) return sinTipos(`otro typecheck está corriendo y no se liberó en ${Math.round(esperaMs / 1000)} s`);
  try {
    const c = await esperarRam(1, { pisoGb: pisoTsc(heap), quien: 'tipos', esperaMaxMs: esperaMs });
    if (c === 0) return sinTipos(`no hay RAM: quedan ${ramLibreGb().toFixed(1)} GB y el tsc acotado pide ${pisoTsc(heap)(1).toFixed(1)}`);
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tipos-del-cambio-'));
    const config = path.join(dir, 'tsconfig.json');
    writeFileSync(config, JSON.stringify(armarTsconfig(raiz, alcance, { dts: dtsVersionados(raiz) }), null, 2));
    const t0 = Date.now();
    try {
      const r = await ejecutar({ config, heap, raiz });
      const v = veredicto(r.status, r.salida);
      const ms = Date.now() - t0;
      if (v === 'ok') { out(`  ✔ tipos de ${archivos} archivos sin errores · ${min(ms)} · heap ${heap} MB`); return { estado: 'ok', archivos, ms, heap }; }
      if (v === 'errores') {
        const delAlcance = new Set(alcance.map((f) => f.replace(/\\/g, '/')));
        const errores = r.salida.split('\n').filter((l) => /error TS\d+/.test(l));
        // ⚠️ La ruta es lo que va ANTES de «(línea,col): error TS…», no antes del primer «(»: una ruta con grupo de Next (`app/(publico)/precios/page.tsx`) se cortaba en `app/` y el
        // error se contaba como arrastre (VERDE). Y un error SIN archivo (TS5023 por una opción mal escrita, TS6053) es del programa entero: cuenta como propio, nunca como arrastre.
        const archivoDe = (l) => { const m = /^(.*?)\(\d+,\d+\): error TS\d+/.exec(l.trim()); return m ? m[1].replace(/\\/g, '/') : null; };
        const propios = errores.filter((l) => { const a = archivoDe(l); return a === null || delAlcance.has(a); });
        const arrastre = errores.length - propios.length;
        if (propios.length === 0) {
          out(`  ✔ tipos de ${archivos} archivos sin errores · ${min(ms)} · heap ${heap} MB`);
          out(`  ℹ ${arrastre} error(es) en archivos que sólo se compilan por arrastre (no frenan; los decide el tsc de Actions): ${[...new Set(errores.map((l) => archivoDe(l) ?? '(sin archivo)'))].slice(0, 3).join(', ')}`);
          return { estado: 'ok', archivos, ms, heap, arrastre };
        }
        out(propios.slice(0, 30).join('\n') + (propios.length > 30 ? `\n  …y ${propios.length - 30} más` : ''));
        if (arrastre) out(`  ℹ y ${arrastre} más en archivos que sólo se compilan por arrastre (no cuentan acá)`);
        return { estado: 'rojo', archivos, ms, heap, arrastre, porque: `tipos: ${propios.length} errores (${[...new Set(propios.map((l) => archivoDe(l) ?? '(sin archivo)'))].slice(0, 3).join(', ')})` };
      }
      return sinTipos(`el tsc acotado no terminó (código ${r.status ?? r.error}, ${r.salida.length} bytes): lo mató el vigía de RAM o se quedó sin heap — no es un error de tipos`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } finally { soltarLockTipos(lock); }
}

/**
 * `correrTiposAcotado` + lo que NO se puede acotar (`tiposNoAcotables`: tsconfig, package.json, .d.ts). Si el acotado da `ok` o `nada` pero cambió algo de eso, el resultado es `sin-tipos`
 * —nunca un verde—; un `rojo` sigue siendo `rojo` (un rojo manda), y un `sin-tipos` propio conserva su causa.
 * @param {string[]} alcance
 * @param {{ raiz?: string, out?: (s: string) => void, esperaMs?: number, ejecutar?: typeof ejecutarTsc, heapMb?: number, noAcotables?: string[] }} [o]
 * @returns {ReturnType<typeof correrTiposAcotado>}
 */
export async function correrTipos(alcance, { noAcotables = [], ...o } = {}) {
  const r = await correrTiposAcotado(alcance, o);
  if (!noAcotables.length || (r.estado !== 'ok' && r.estado !== 'nada')) return r;
  const porque = `cambió ${noAcotables.slice(0, 3).join(', ')}${noAcotables.length > 3 ? '…' : ''}: define tipos para todo el repo y un tsc acotado no puede chequear a los archivos que no cambiaron — lo decide el tsc completo (Actions)`;
  (o.out ?? (() => {}))(`  ✖ SIN TIPOS: ${porque}`);
  return { ...r, estado: 'sin-tipos', porque };
}

/**
 * Qué hace `tests-afectados` cuando los tests no encontraron RAM (sale 99, «no es un test roto») pero los tipos ya habían dado ROJO: el rojo de tipos GANA y sale 1. Perderlo sería decirle a
 * quien lee el exit «sin RAM, no es un rojo del código» sobre una punta que tiene un error de tipos (la revisión del 21/10/2026).
 * @param {{ estado: string, porque?: string } | null} tipos
 * @returns {{ codigo: number, linea: string | null }}
 */
export function salidaSinRam(tipos) {
  if (tipos?.estado === 'rojo') return { codigo: 1, linea: `ROJO: ${tipos.porque} · (además, los tests no corrieron: no había RAM)` };
  return { codigo: SALIDA_SIN_CORRER, linea: null };
}

/**
 * Cómo termina una corrida que mira tipos y tests: la PALABRA del veredicto, el detalle y el código de salida. Es una sola función para que `tests-afectados` y
 * `antes-de-subir` digan lo mismo, y es lo que decide que un verde sin tipos NO se llame VERDE.
 *   · cualquier rojo (tests, guardas, tipos con errores…)  → `ROJO`,  exit 1
 *   · sin rojos pero los tipos NO se pudieron chequear      → `SIN TIPOS`, exit 98
 *   · sin rojos y `--sin-tipos` pedido a propósito          → `PARCIAL`, exit 0 (no vale como VERDE)
 *   · sin rojos y los tipos corrieron (o nada que compilar) → `VERDE`, exit 0
 * @param {{ rojos?: string[], tipos?: { estado: string, porque?: string } | null, sinTiposPedido?: boolean }} o
 */
export function cerrar({ rojos = [], tipos = null, sinTiposPedido = false } = {}) {
  const sinTipos = tipos?.estado === 'sin-tipos' ? (tipos.porque ?? 'no se pudieron chequear') : null;
  if (rojos.length) return { palabra: 'ROJO', detalle: `${rojos.join(' · ')}${sinTipos ? ` · (además, SIN TIPOS: ${sinTipos})` : ''}`, codigo: 1 };
  if (sinTipos) return { palabra: 'SIN TIPOS', detalle: `${sinTipos} — lo demás dio verde, pero un VERDE sin tipos no es un VERDE (el error de tipos aparece recién en Actions): liberá RAM y repetí, o --sin-tipos si lo decidís vos`, codigo: SALIDA_SIN_TIPOS };
  if (sinTiposPedido) return { palabra: 'PARCIAL', detalle: 'sin tipos (--sin-tipos): sin rojos, pero no vale como VERDE — los tipos los decide Actions', codigo: 0 };
  return { palabra: 'VERDE', detalle: '', codigo: 0 };
}

// -----------------------------------------------------------------------------
// 7. La línea de comandos
// -----------------------------------------------------------------------------

function leerArgs(argv) {
  // `compartir`: las barredoras que sólo leen corren juntas en un proceso (ver scripts/cache-lecturas.cjs). En Actions (CI) no: ahí el disco es
  // rápido, cada test sigue en su proceso y un test que ensucia el entorno no puede dar un verde por contagio.
  // `tipos`: el tsc acotado de lo cambiado es PARTE del veredicto (ver 6b). En Actions no: ahí está el paso «Tipos» con el tsc completo. `--sin-tipos` (o MAKO_SIN_TIPOS=1) lo apaga A PROPÓSITO,
  // y entonces el veredicto es PARCIAL, nunca VERDE.
  const sinTiposPedido = !process.env.CI && process.env.MAKO_SIN_TIPOS === '1';
  const o = { base: 'origin/main', listar: false, explicar: false, cortar: false, resto: false, tanda: 6, concurrencia: 2, profundidad: Infinity, compartir: !process.env.CI, rapido: false, tipos: !process.env.CI && !sinTiposPedido, sinTiposPedido };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    const valor = () => (v !== undefined ? v : argv[++i]);
    if (k === '--base') o.base = valor();
    else if (k === '--tanda') o.tanda = Math.max(1, Number.parseInt(valor(), 10) || 6);
    else if (k === '--concurrencia') { const c = valor(); o.concurrencia = c === 'auto' ? concurrenciaAuto() : Math.max(1, Number.parseInt(c, 10) || 2); }
    else if (k === '--profundidad') o.profundidad = Math.max(1, Number.parseInt(valor(), 10) || 1);
    else if (k === '--listar') o.listar = true;
    else if (k === '--sin-compartir') o.compartir = false;
    else if (k === '--compartir') o.compartir = v === 'barredoras' ? 'barredoras' : 'todo';   // `--compartir` o `--compartir=barredoras`: Actions lo pide; por default NO se comparte allá
    else if (k === '--rapido') { o.rapido = true; o.profundidad = 1; }
    else if (k === '--explicar') o.explicar = true;
    else if (k === '--cortar') o.cortar = true;
    else if (k === '--resto') o.resto = true;
    else if (k === '--sin-tipos') { o.tipos = false; o.sinTiposPedido = !process.env.CI; }
    else if (k === '--ayuda' || k === '-h') o.ayuda = true;
    else { process.stderr.write(`  [tests-afectados] no conozco «${argv[i]}» (mirá --ayuda)\n`); o.ayuda = true; }
  }
  return o;
}

const AYUDA = `node scripts/tests-afectados.mjs [--base origin/main] [--listar] [--explicar] [--cortar] [--resto] [--tanda 6] [--concurrencia 2|auto] [--profundidad N] [--rapido] [--sin-compartir] [--sin-tipos]
  Los TIPOS de lo cambiado (tsc acotado) son parte del veredicto —tsx no los chequea—: si no se pueden chequear (sin RAM, lo mató el vigía) la línea final dice «SIN TIPOS: …» y sale 98,
  no VERDE. --sin-tipos (o MAKO_SIN_TIPOS=1) los saltea A PROPÓSITO: la línea final es PARCIAL, tampoco VERDE. En Actions (CI) y con --resto no se corren (está el paso «Tipos»).
  --rapido: lo que usan los jefes antes de pasar una punta: los que nombran o importan DIRECTO un archivo cambiado (profundidad 1) + las barredoras.
  --sin-compartir: cada barredora en su proceso (por default, localmente, las que sólo leen corren juntas con las lecturas en memoria).
  Elige los tests que lo cambiado desde --base puede romper (barredoras, nombran un archivo cambiado, importan uno) y los corre.
  --profundidad N: sólo sigue N saltos de import (por default todos). Es la palanca si el tiempo aprieta, con el costo de dejar afuera a los más lejanos.
  --resto: corre LOS DEMÁS (todos menos los afectados): Actions corre primero los afectados y después éstos, y así no se repite ninguno.
  Salida: 0 verde (o PARCIAL a propósito) · 1 rojo · 2 no se pudo calcular · 98 SIN TIPOS (los tests dieron verde, los tipos no se pudieron chequear) · 99 no corrió (falta RAM).`;

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
  let compartidos = [];
  let sinTests = false;
  if (o.resto) {
    // Los demás: todos los tests menos los que ya corrieron como afectados. La suma de las dos fases es la suite entera.
    const todos = plan.archivos.filter((f) => ES_TEST.test(f)).sort();
    lista = todos.filter((t) => !sel.tests.has(t));
    out(`[tests-afectados] --resto: ${lista.length} tests (${todos.length} en total − ${sel.tests.size} afectados que ya corrieron)`);
    // Con `--compartir` (todo) los que no tocan estado global van juntos: el costo de la fase es el ARRANQUE de cada archivo (~0,4 s × cientos), no el cómputo.
    if (o.compartir === 'todo' || o.compartir === true) {
      compartidos = lista.filter((t) => sel.compartibles.has(t));
      lista = lista.filter((t) => !sel.compartibles.has(t));
      out(`  ↳ ${compartidos.length} corren juntos en procesos compartidos; ${lista.length} aislados (tocan el entorno o un global)`);
    }
    if (o.listar) return 0;
  } else {
    imprimirPlan(plan, o, out);
    const ag = agrupar(sel.tests, sel.compartibles, { compartir: o.compartir });
    lista = ag.orden;
    compartidos = ag.compartidos;
    if (compartidos.length) out(`  ↳ ${compartidos.length} de las barredoras sólo leen: corren juntas en un proceso con las lecturas en memoria (--sin-compartir lo apaga)`);
    if (o.listar) return 0;
    if (lista.length === 0 && compartidos.length === 0) { out('[tests-afectados] Ningún test mira lo cambiado.'); sinTests = true; }
  }

  // Los TIPOS de lo cambiado son PARTE del veredicto (ver 6b): primero, que es lo más barato y falla rápido. En Actions (CI), con --resto y con --sin-tipos no se corren.
  let tipos = null;
  if (o.tipos && !o.resto) {
    const { alcance, noAcotables } = planDeTipos({ cambiados: cambios.cambiados, archivos: plan.archivos, sel });
    out(`\n[tests-afectados] tipos (tsc acotado a ${alcance.length} archivos: lo cambiado y los tests que dependen de eso)`);
    tipos = await correrTipos(alcance, { raiz, out, noAcotables });
  }
  const conVeredictoDeTipos = tipos !== null || o.sinTiposPedido;   // sin esto (Actions, --resto) la salida es la de siempre
  const resumenTipos = tipos?.estado === 'ok' ? `tipos de ${tipos.archivos} archivos sin errores` : tipos?.estado === 'nada' ? 'tipos: ningún .ts/.tsx cambió' : '';
  const cerrarConTipos = (rojos, detalleTests) => {
    const fin = cerrar({ rojos, tipos, sinTiposPedido: o.sinTiposPedido });
    out(fin.palabra === 'VERDE' ? `VERDE · ${[resumenTipos, detalleTests].filter(Boolean).join(' · ')}`
      : fin.palabra === 'ROJO' ? `ROJO: ${fin.detalle}`
        : fin.palabra === 'SIN TIPOS' ? `SIN TIPOS: ${fin.detalle}`
          : `PARCIAL (${fin.detalle})`);
    return fin.codigo;
  };

  if (sinTests) {
    if (!conVeredictoDeTipos) return 0;
    return cerrarConTipos(tipos?.estado === 'rojo' ? [tipos.porque] : [], 'ningún test mira lo cambiado');
  }

  const carpetaTmp = mkdtempSync(path.join(os.tmpdir(), 'tests-afectados-'));
  const indice = indiceConNuevos(cambios.nuevos, carpetaTmp);
  const env = { ...process.env, ...(indice ? { GIT_INDEX_FILE: indice } : {}) };
  const r = await correrTests({ lista, compartidos, tanda: o.tanda, concurrencia: o.concurrencia, cortar: o.cortar, env, carpetaTmp, out });

  if (r.sinRam) {
    process.stderr.write(`\n  ✖ NO CORRÍ LOS TESTS: NO HAY RAM (quedan ${ramLibreGb().toFixed(1)} GB, hace falta ${pisoRam(1).toFixed(1)}). Esto NO es un test roto.\n`);
    process.stderr.write('    Cerrá unos chats de Claude y volvé a correrlo, o MAKO_TESTS_SIN_ESPERA=1 para correr igual (puede matarlo el vigía).\n\n');
    // Un ROJO de tipos gana: sin esto, la punta con un error de tipos salía 99 («no es un rojo del código»).
    const fin = salidaSinRam(tipos);
    if (fin.linea) out(fin.linea);
    return fin.codigo;
  }
  rmSync(carpetaTmp, { recursive: true, force: true });
  // La palabra VERDE se reserva para el veredicto final, que ya cuenta los tipos: acá, si los tipos están en juego, los tests dicen «en verde».
  const detalleTests = `${r.total.tests} tests de ${lista.length + compartidos.length} archivos${r.cortada ? ' (cortado en la primera tanda roja)' : ''} · ${min(r.ms)} · RAM libre mínima ${Number.isFinite(r.ramMin) ? r.ramMin.toFixed(1) : '?'} GB`;
  out(`\n[tests-afectados] ${r.rojos.size === 0 ? (conVeredictoDeTipos ? '✔ tests en verde' : '✔ VERDE') : '✖ ROJO'} · ${detalleTests}`);
  if (r.flaky.length) out(`  ⚠ ${r.flaky.length} FLAKY (rojos con varios procesos, verdes solos): ${r.flaky.join(', ')}`);
  if (r.rojos.size) {
    out('  Rojos: ' + [...r.rojos].join(', '));
    out('  Repetilos solos: node --import tsx --test ' + [...r.rojos].filter((f) => f.startsWith('tests/') && !f.includes(' ')).join(' '));
    out('  Antes de tocar nada: `git status --short` de los archivos que ese test lee (AGENTS.md → «Si el pre-push da rojo»).');
  }
  if (!conVeredictoDeTipos) return r.rojos.size ? 1 : 0;
  const rojos = [];
  if (r.rojos.size) rojos.push(`tests: ${[...r.rojos].map((f) => f.replace(/^tests\//, '')).slice(0, 6).join(', ')}${r.rojos.size > 6 ? '…' : ''}`);
  if (tipos?.estado === 'rojo') rojos.push(tipos.porque);
  return cerrarConTipos(rojos, `${r.total.tests} tests de ${lista.length + compartidos.length} archivos`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`  [tests-afectados] error inesperado: ${e?.stack ?? e}\n`); process.exit(2); });
}
