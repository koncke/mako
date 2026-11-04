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
//   1. BARREDORAS: los tests que recorren el repo — usan `git ls-files`, `git grep` o hacen readdir/glob.
//      Corren SIEMPRE: un cambio en cualquier lado las puede romper, y por eso no se les puede preguntar
//      «¿tocaste lo mío?» (run 80 y 82). ⚠️ «Nombra 20+ archivos» ya NO es barrer (4/11/2026): ver
//      `motivoBarredora`.
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
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pausaVigente } from './pausa-cerebro.mjs';

const GB = 1024 ** 3;
export const SALIDA_SIN_CORRER = 99;   // misma convención que scripts/typecheck-lock.mjs: «no pude chequear», no «hay errores»

const EXT_CODIGO = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx'];
export const ES_CODIGO = /\.(?:[cm]?[jt]s|[jt]sx)$/;
export const ES_TEST = /^tests\/[^/]+\.test\.ts$/;     // el mismo glob que `npm test`

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

/**
 * `lib/nutricion` → `lib/nutricion.ts`, si existe. Y un archivo que NO lleva extensión (`scripts/claude-hooks/pre-push`) se
 * nombra tal cual: hasta el 4/11/2026 eso daba null, y un cambio al hook de pre-push no corría ninguno de los tests que lo
 * leen (integracion-ci, filtro-punta, typecheck-lock). `existe` es la lista de archivos de git, no el disco: una carpeta
 * (`lib/flujo`) no está ahí y sigue yendo a su `index`.
 */
export function resolverNombre(t, existe) {
  if (existe(t)) return t;
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

/**
 * ¿Este test recorre el repo en vez de mirar un archivo? Devuelve el porqué, o null.
 *
 * ⚠️ «NOMBRA 20+ ARCHIVOS» SE SACÓ EL 4/11/2026 (docs/hallazgos-infra.md → «Por qué tardaba horas»). Un test que nombra 20
 * archivos los LEE, pero no BARRE: sabe cuáles son, y la regla 2 (NOMBRAN) ya lo elige cuando cualquiera de los 20 cambia. Con la
 * regla, 37 tests corrían en TODAS las puntas sin que nada suyo cambiara, y entre ellos el más lento, `tests/tipos-por-tandas.test.ts`
 * (nombra 132). Lo que se pierde es lo que el test mira por un camino que no nombra (un import de lo nombrado, una lectura
 * armada en tiempo de ejecución): eso lo ve la suite de cada noche (semanal-tests.yml), que dio verde entera el 4/11 (run 41779837302).
 * Medido antes de sacarla: el replay de los rojos reales (scripts/replay-fallos-ci.mjs) da lo mismo con y sin la regla.
 */
export function motivoBarredora(src) {
  if (/ls-files/.test(src)) return 'git ls-files';
  if (/\bgit\s+grep\b|\[\s*['"]grep['"]/.test(src)) return 'git grep';
  if (/\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/.test(src)) return 'recorre carpetas';
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
 * @returns {{ tests: Map<string, {tipo: string, detalle: string}[]>, sinRed: string[], totalTests: number, importadoPor: Map<string, Set<string>>, aumentan: Set<string>, compartibles: Set<string>, barredoras: Map<string, string> }}
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
  const compartibles = new Set();  // las barredoras que sólo LEEN: pueden correr juntas en un proceso (ver compartible)

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
    const m = motivoBarredora(src);
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
  // `barredoras` sale afuera porque `compartibles` contesta otra pregunta: ver «lo seguro no es lo que conviene», más abajo.
  return { tests: elegidos, sinRed, totalTests: tests.length, importadoPor, aumentan, compartibles, barredoras: motivoBarre };
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
 */
export function alcanceTsc({ cambiados, archivos, importadoPor, aumentan = new Set(), importadores = false }) {
  const existentes = new Set(archivos);
  const esTs = (f) => /\.(?:ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && existentes.has(f);
  const alcance = new Set();
  for (const f of cambiados) {
    if (esTs(f)) alcance.add(f);
    if (importadores) for (const quien of importadoPor.get(f) ?? []) if (esTs(quien)) alcance.add(quien);
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
/**
 * DEMASIADO LENTOS PARA LA FASE QUE FRENA EL TREN (31/10/2026). No se saltean: los corre `--resto`, que en Actions va
 * DESPUÉS de los afectados y no bloquea el avance de `main`.
 *
 * ⚠️ POR QUÉ, y costó cuatro corridas de Actions averiguarlo. `grupo-leandro-2910` levanta la entrada REAL de un grupo de
 * WhatsApp y recorre doce escenas. Acá tarda 119 s; en el runner, MÁS DE 360 — se midió subiéndole la paciencia al vigía a
 * 6 minutos y volviendo a morir. Y como node imprime la salida de un archivo cuando el ARCHIVO termina, mientras él no
 * termina la tanda entera parece colgada y se lleva sus otros 99 archivos con un 99 o un rojo que no es de ellos.
 *
 * NO es que el test esté mal ni que sobre: es un end-to-end y vale. Lo que está mal es tenerlo en la fase de «fallar
 * rápido», que existe para dar un veredicto en minutos. Un end-to-end de doce escenas no pertenece ahí.
 *
 * Para sacar uno de acá: medí cuánto tarda en el runner, no en tu PC — fue la trampa de las cuatro corridas.
 */
export const LENTOS_FUERA_DE_LA_FASE_RAPIDA = new Map([
  ['tests/grupo-leandro-2910.test.ts', '12 escenas de un grupo real: 119 s acá, >360 s en el runner (31/10/2026)'],
]);

export function planear(base, { profundidad = Infinity } = {}) {
  const cambios = leerCambios(base);
  if (!cambios) return null;
  const archivos = [...lineasZ(git(['ls-files', '-z'])), ...cambios.nuevos];
  const sel = seleccionar({ cambiados: cambios.cambiados, archivos, leer: leerDisco, profundidad });
  if (cambios.cambiados.length === 0) sel.tests = new Map();     // sin cambios no hay nada «que corra siempre»
  // Los lentos salen de los AFECTADOS, así que `--resto` (todos menos los afectados) los toma solo: nadie queda sin correr.
  for (const f of LENTOS_FUERA_DE_LA_FASE_RAPIDA.keys()) sel.tests.delete(f);
  return { cambios, archivos, sel };
}

/**
 * Los tests en el orden en que conviene correrlos, agrupados por su motivo principal.
 * @param {Map<string, {tipo: string, detalle: string}[]>} tests
 * @param {Set<string>} [compartibles]
 * @param {{ compartir?: boolean | 'barredoras' | 'todo-lo-seguro' }} [opciones] compartir: false = cada test en su proceso; 'barredoras' (o true) = las que BARREN, que es lo unico que gana algo; 'todo-lo-seguro' = el de antes, todo lo que no toca estado global (quedo para volver a medirlo)
 */
export function agrupar(tests, compartibles = new Set(), { compartir = false } = {}) {
  const grupos = { cambio: [], nombra: [], importa: [], barre: [] };
  const compartidos = [];
  for (const [t, razones] of tests) {
    // Con `compartir`, los tests que no tocan estado global salen de la fila y van juntos a UN proceso por grupo (scripts/cache-lecturas.cjs).
    // Un test que el cambio mismo toca (nuevo o editado) va aparte, en su proceso: es el que más probablemente esté rojo, y se lee solo.
    // `compartir`: 'barredoras' (o true) = las que barren; 'todo-lo-seguro' = todas las compartibles, lo de antes (ver «lo seguro no es lo que conviene»).
    if (compartir && compartibles.has(t) && !razones.some((r) => r.tipo === 'cambio') && (compartir === 'todo-lo-seguro' || razones.some((r) => r.tipo === 'barre'))) { compartidos.push(t); continue; }
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
const ESPERA_RAM_MAX_MS = 15 * 60 * 1000;
const REINTENTO_MAX = 8;    // más rojos que esto en una tanda no es la carga: es un cambio que rompe cosas
// El tope de una tanda también dejó de ser un número fijo: `--tanda 1000` en Actions le daba 10 minutos a mil archivos.
// Ver «EL TOPE DE UN PROCESO DE TESTS», más abajo.
export const pisoRam = (concurrencia) => ZONA_ROJA_VIGIA_GB + COSTO_PROCESO_GB * concurrencia + MARGEN_GB;

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
    // La PAUSA del Cerebro (scripts/pausa-cerebro.mjs) cuenta como «no hay RAM», y MAKO_TESTS_SIN_ESPERA no la saltea: es justo lo
    // que frena mientras el Cerebro sube un tren (28/10/2026). Como «no hay RAM», respeta el tope y el candado de antes-de-subir.
    const pausa = pausaVigente();
    if (!pausa) {
      for (let c = concurrencia; c >= 1; c--) if (libre >= pisoGb(c)) return c;
      if (process.env.MAKO_TESTS_SIN_ESPERA === '1') {
        process.stderr.write(`  [${quien}] MAKO_TESTS_SIN_ESPERA=1 con ${libre.toFixed(1)} GB: corro igual, puede matarlo el vigía\n`);
        return 1;
      }
    }
    if (Date.now() >= hasta) return 0;
    if (!avisado) {
      process.stderr.write(pausa
        ? `  [${quien}] el Cerebro pidió PAUSA («${pausa}»): espero a que la levante, hasta ${Math.round(esperaMaxMs / 60000)} min…\n`
        : `  [${quien}] quedan ${libre.toFixed(1)} GB de RAM y hacen falta ${pisoGb(1).toFixed(1)}: espero hasta ${Math.round(esperaMaxMs / 60000)} min…\n`);
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

// ---------------------------------------------------------------------------
// EL TOPE DE UN PROCESO DE TESTS: un detector de que NO AVANZA, no un reloj de pared
// ---------------------------------------------------------------------------
// ⚠️ UN NÚMERO FIJO DE MINUTOS DEJA DE SERVIR EN CUANTO LA SUITE CRECE, y acá pasó dos veces con el mismo síntoma:
//   · 25/10/2026: «grupo compartido 1/1 · 796 archivos · 0 tests · ROJO · 25 min», y se escribió que la causa era la RAM (paginaba).
//   · 30/10/2026: «grupo compartido 1/2 · 495 archivos · 0 tests · ROJO · 25 min 2 s» y «2/2 · 514 · 0 tests · ROJO · 25 min 0 s»,
//     esta vez EN EL RUNNER DE ACTIONS, que tiene memoria dedicada y nadie más adentro. **Así que no era la RAM: era el tope.**
// `25 min 0 s` y `25 min 2 s` no son caídas, son el reloj: el tope valía 25 min FIJOS y `matarArbol` mataba el proceso, y `colgada`
// lo convertía en código 1, o sea ROJO. Se calibró con los números que están más abajo —12 archivos en 40 s, 148 en dos procesos en
// 267 s— y hoy son 1.028 compartibles: siete veces más, con el mismo número.
//
// LA FORMA DEL PROBLEMA: un tope de pared no distingue «es GRANDE» de «está COLGADO», que es lo único que tiene que cazar. Subirlo
// proporcional obliga a elegir entre matar grupos sanos y regalarle el job entero a uno colgado (el de Actions tiene 90 min).
// Así que el tope pasa a preguntar lo que de verdad importa: **¿AVANZA?** El runner imprime una línea por caso TERMINADO, así que
// un proceso que no imprime un caso nuevo en TOPE_SIN_AVANCE_MS está colgado, tenga 12 archivos o 1.028; y uno grande que avanza no
// se mata nunca por ser grande. Queda además un TECHO de pared proporcional a los archivos, como última red: un arrastre patológico
// (paginar con la RAM en 0) avanza de a poquito y no puede comerse el job entero.
//
// Y DE REGALO, EL QUE NO DEJÓ AVANZAR TIENE NOMBRE. Antes el mensaje era «un test se colgó» y había que adivinar cuál entre 514
// archivos. ⚠️ Pero el nombre NO sale del caso que sigue, sino del ARCHIVO que sigue: node imprime la salida de un archivo cuando
// el ARCHIVO termina, así que una tanda calla todo lo que tarde su archivo más lento y el último caso impreso es el ÚLTIMO de su
// archivo. El 31/10/2026 este mensaje mandó a buscar «el caso que sigue» a dos casos que eran el último de su archivo, y los 100
// archivos de cada tanda estaban bien: lo que pasaba es que uno tardaba más que la paciencia del vigía. Ver `elQueNoDejoAvanzar`.

/** Una línea de caso del runner, que se imprime cuando el caso TERMINA: es la señal de que el proceso avanza. */
export const CASO_REPORTADO = /^\s*[✔✖﹣]\s(.*?)\s*\(\d+(?:\.\d+)?ms\)/;
/** Cuántas muestras seguidas (de a 5 s) con la RAM en la zona roja del vigía antes de bajarse SOLO: 15 s, para no reaccionar a un pico. */
export const ROJO_SEGUIDAS = 3;
/** Sin un caso nuevo en este tiempo, el proceso no avanza: está colgado, y no importa cuántos archivos tenga. */
export const TOPE_SIN_AVANCE_MS = (Number(process.env.MAKO_TESTS_SIN_AVANCE_MIN) || 5) * 60 * 1000;

/**
 * LA PACIENCIA SALE DE LO QUE LOS ARCHIVOS DECLARAN, no de un número fijo (31/10/2026).
 *
 * ⚠️ POR QUÉ, medido dos veces en Actions: node imprime la salida de un archivo cuando el ARCHIVO termina, así que una tanda
 * queda MUDA todo lo que tarde su archivo más lento. El vigía, que mide «¿imprimió un caso nuevo?», no estaba midiendo un
 * cuelgue: estaba midiendo al más lento. `tests/grupo-leandro-2910.test.ts` corre la entrada real de un grupo de WhatsApp —
 * 119 s en la PC de Martín con el reloj ya acortado— y en el runner cruzó los 5 minutos DOS VECES, matando su tanda entera
 * con código 99 y dejando 100 archivos sin saber si estaban rotos. Subir el número fijo para todos sería regalarle minutos de
 * Actions a un cuelgue de verdad.
 *
 * Un `timeout: N` que un test le pasa a un hijo es su DECLARACIÓN de «puedo tardar N». La tanda que lo contiene tiene que
 * esperar al menos eso, más la gracia para que el rojo lo dé el ARCHIVO (que se nombra) y no el vigía (que acusa a 100).
 * `tests/tanda-no-la-mata-un-test-lento.test.ts` cuida que ninguna declaración crezca sin que alguien la mire.
 */
/**
 * ⚠️ LA GRACIA CUBRE EL ARCHIVO ENTERO, NO SÓLO SU HIJO, y la primera versión de esto se equivocó justo ahí: con 60 s,
 * 240 declarados + 60 daban exactamente los 300 de siempre y la paciencia NO subía — el arreglo no arreglaba nada.
 * Un archivo que declara 240 puede tardar 240 (su hijo, si se agota) MÁS el arranque de tsx (22 s medidos el 31/10) MÁS
 * los otros ocho tests del archivo. Dos minutos es lo que cubre eso con margen, y sólo lo paga la tanda que CONTIENE un
 * archivo así: una tanda sin declaraciones sigue cortando a los 5 minutos.
 */
const GRACIA_SOBRE_LO_DECLARADO_MS = 120 * 1000;
const DECLARA_TOPE = /timeout:\s*([\d_]+)/g;
/** Lo que declara el archivo más lento de la tanda, leído de su fuente. 0 si ninguno declara nada. */
export function topeDeclarado(archivos, leer = (f) => readFileSync(f, 'utf8')) {
  let mayor = 0;
  for (const f of archivos) {
    let src;
    try { src = leer(f); } catch { continue; }
    // Sin los comentarios: este repo CITA topes viejos dentro de comentarios para explicar por qué se bajaron.
    const limpio = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    for (const m of limpio.matchAll(DECLARA_TOPE)) mayor = Math.max(mayor, Number(m[1].replace(/_/g, '')));
  }
  return mayor;
}
/** La paciencia de ESTA tanda: la de siempre, o lo que declara su archivo más lento más la gracia. */
export const sinAvanceDe = (archivos, base = TOPE_SIN_AVANCE_MS, declarado = topeDeclarado(archivos)) =>
  Math.max(base, declarado ? declarado + GRACIA_SOBRE_LO_DECLARADO_MS : 0);
/**
 * EL ARRANQUE: lo que tarda un proceso compartido ANTES del primer caso, y por qué es por archivo.
 * ⚠️ Medido el 31/10/2026 (scripts/medir-grupo-compartido.mjs, 100 compartibles en un proceso): la curva de casos juzgados por
 * minuto fue `0′:0 1′:0 2′:0 3′:0 4′:0 5′:0 6′:56 7′:56 8′:742`. **Seis minutos sin juzgar UN caso**, y después los 889 en dos.
 * Con `--test-isolation=none` node importa TODOS los archivos antes de correr el primer test, y tsx los transpila de a uno: el
 * grupo no está colgado, está cargando. Un detector de «no avanza» con un arranque fijo mataría grupos sanos, que es el error que
 * esta medición cazó antes de que llegara al tren.
 */
const ARRANQUE_BASE_MS = 60 * 1000;
const ARRANQUE_POR_ARCHIVO_MS = 6000;      // 3,6 s/archivo medidos con 100, por 1,7 de holgura (y la carga es SUPER-lineal: ver el hallazgo)
const ARRANQUE_MS = ARRANQUE_BASE_MS;      // el arranque de un proceso sin archivos (una tanda chica)
export const arranqueDe = (archivos) => ARRANQUE_BASE_MS + ARRANQUE_POR_ARCHIVO_MS * Math.max(0, archivos);
/**
 * El TECHO de pared, proporcional. `POR_ARCHIVO_MS` sale de las dos mediciones del 17/10/2026 (12 archivos → 40 s y 74 por proceso
 * → 267 s: 3,7 s por archivo, con la contención de dos procesos adentro) remedidas el 31/10 (ver scripts/medir-grupo-compartido.mjs
 * y docs/hallazgos-infra.md). La HOLGURA es ×3 porque el techo no es un presupuesto de rendimiento: es la red de la red, y una PC
 * cargada tarda el doble sin que nada esté roto. Con 514 archivos da ~95 min, que sólo se alcanzan avanzando de a un caso cada 5 min.
 */
const POR_ARCHIVO_MS = 3700;
const HOLGURA = 3;
// El techo NUNCA es menor que la gracia del arranque mas el tope de no-avanzar: si lo fuera, un proceso que se cuelga antes del
// primer caso moriria por el techo (y el mensaje hablaria de avanzar de a poco) en vez de por lo que de verdad le paso.
export const topeDePared = (archivos, sinAvanceMs = TOPE_SIN_AVANCE_MS, arranqueMs = arranqueDe(archivos)) =>
  Math.max(arranqueMs + HOLGURA * POR_ARCHIVO_MS * Math.max(1, archivos), arranqueMs + sinAvanceMs + 30 * 1000);

/**
 * Lanza un proceso de tests y lo vigila: lo mata si NO AVANZA (ningún caso nuevo en TOPE_SIN_AVANCE_MS) o si pasa el techo de
 * pared. Devuelve, además de la salida: `colgada` (lo mataron), `porque` ('sin-avance' | 'techo') y `ultimoCaso`, el último caso
 * que TERMINÓ — que es el último caso de SU archivo: el que no dejó avanzar es el archivo siguiente (`elQueNoDejoAvanzar`).
 * Los topes se pueden pasar (`sinAvanceMs`, `techoMs`, `cada`) para probarlo con un proceso de mentira que se cuelga en 2 segundos
 * en vez de esperar cinco minutos: tests/tope-grupo-compartido.test.ts.
 * @param {string[]} args argumentos de node (después del ejecutable)
 * @param {{ archivos: number, env: NodeJS.ProcessEnv, cada?: number, ahora?: () => number, sinAvanceMs?: number, techoMs?: number }} o
 */
export function lanzarVigilado(args, { archivos, env, cada = 5000, ahora = Date.now, libre: leerLibre = ramLibreGb, sinAvanceMs = TOPE_SIN_AVANCE_MS, arranqueMs = arranqueDe(archivos), techoMs = topeDePared(archivos, sinAvanceMs, arranqueMs) }) {
  return new Promise((resolve) => {
    const t0 = ahora();
    const hijo = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const trozos = [];
    let resto = '';
    let ultimoCaso = '';
    let casos = 0;        // los casos que el runner alcanzo a JUZGAR, contados del stream: el pie puede no llegar nunca
    let visto = t0;         // cuándo se vio el último caso (o el arranque)
    const leer = (d) => {
      trozos.push(d);
      const lineas = (resto + d.toString('utf8')).split('\n');
      resto = lineas.pop() ?? '';
      for (const l of lineas) {
        const m = CASO_REPORTADO.exec(l);
        if (m) { ultimoCaso = m[1]; casos++; visto = ahora(); }
      }
    };
    hijo.stdout.on('data', leer);
    hijo.stderr.on('data', leer);
    let colgada = false;
    let porque = '';
    let libreMin = Infinity;
    let enRojo = 0;
    const vigilante = setInterval(() => {
      const quieto = ahora() - visto;
      const total = ahora() - t0;
      // ⚠️ UN TURNO DEL CANDADO ES UNA FOTO, NO UNA PROTECCIÓN (31/10/2026). El candado mira la RAM al dar el turno y no vuelve a
      // mirar; durante los minutos que dura un grupo, otras sesiones arrancan lo suyo y la memoria se hunde. Ese día tres chats
      // llegaron a menos de 0,3 GB y uno a CERO corriendo el barrido, con el turno en la mano. Con la RAM en cero se cuelga la app
      // de Claude y se caen TODOS los chats con lo que tengan sin commitear (pasó el 11/10). Así que el proceso se vigila también
      // desde adentro: si la RAM libre entra en la zona roja del vigía y se queda, se baja SOLO. No es un rojo del código, es un 99.
      const libre = leerLibre();
      libreMin = Math.min(libreMin, libre);
      enRojo = libre < ZONA_ROJA_VIGIA_GB ? enRojo + 1 : 0;
      if (enRojo >= ROJO_SEGUIDAS) { colgada = true; porque = 'sin-ram'; }
      // Antes del primer caso se le da el arranque entero (node + tsx + el cache de lecturas); después, el tope de «no avanza».
      else if (quieto > (ultimoCaso ? sinAvanceMs : sinAvanceMs + arranqueMs)) { colgada = true; porque = 'sin-avance'; }
      else if (total > techoMs) { colgada = true; porque = 'techo'; }
      if (colgada) { clearInterval(vigilante); matarArbol(hijo); }
    }, cada);
    hijo.on('close', (codigo) => {
      clearInterval(vigilante);
      resolve({ salida: Buffer.concat(trozos).toString('utf8'), codigo: colgada ? 1 : codigo, colgada, porque, ultimoCaso, casos, techo: techoMs, sinAvanceMs, libreMin, ms: ahora() - t0 });
    });
  });
}

/**
 * EL QUE NO DEJÓ AVANZAR ES EL ARCHIVO QUE SIGUE, NO EL CASO QUE SIGUE (31/10/2026, run 41207922805).
 * ⚠️ Node imprime la salida de un archivo de test cuando el archivo TERMINA: medido con tres archivos y
 * `--test-concurrency=3`, los dos rápidos (1 ms) imprimen sus casos recién cuando el lento (6 s) terminó, las tres líneas
 * juntas. O sea que una tanda deja de imprimir mientras corre su archivo más lento, aunque los otros 99 ya hayan pasado — y
 * el último caso impreso es el ÚLTIMO de su archivo, no «el anterior al que se colgó». Decir «el que se colgó es el que
 * sigue» mandó a buscar un caso que no existe: los dos casos que nombró ese run eran el último test de su archivo.
 * Como la salida va en orden ALFABÉTICO (node ordena los archivos, no respeta el orden de los argumentos: medido), el
 * culpable es el primero que todavía no imprimió: el que sigue, alfabéticamente, al archivo
 * donde vive el último caso. Buscarlo cuesta leer la tanda, y sólo se hace cuando ya hubo que matar algo.
 * @param {string} ultimoCaso el título del último caso que TERMINÓ
 * @param {string[]} archivos los archivos de la tanda, en el orden en que se los pasó a node
 */
const TITULO_DE_TEST = /^\s*(?:await\s+)?(?:it|test)(?:\.\w+)?\(\s*'((?:\\.|[^'\\])*)'/gm;
/** Los títulos de los casos de un archivo, en el orden del fuente. Los que se arman con una plantilla no salen: no se usan. */
export const titulosDe = (src) => [...src.matchAll(TITULO_DE_TEST)].map((m) => m[1].replace(/\\(['\\])/g, '$1'));

export function elQueNoDejoAvanzar(ultimoCaso, archivos = []) {
  if (!ultimoCaso || archivos.length === 0) return null;
  // ⚠️ EL ORDEN DE LA SALIDA ES EL ALFABÉTICO, NO EL DE LOS ARGUMENTOS (31/10/2026, medido sobre una tanda de 68 que mezcla los
  // tres grupos de `agrupar`): node ORDENA los archivos, así que los 68 últimos casos impresos salieron en orden alfabético
  // perfecto aunque la tanda iba cambio → nombra → importa. Con el orden de los argumentos se acusaba a un archivo que ya había
  // terminado; con el alfabético, el que nombra es el que estaba vivo de verdad (se confirmó mirando los procesos).
  const orden = [...archivos].sort();
  // ⚠️ Y SE BUSCA ENTRE LOS TÍTULOS DEL ARCHIVO, NO EN SU FUENTE: buscando el texto en el fuente, el primer archivo que
  // MENCIONA ese título se lleva la culpa — y el guard que documenta este cuelgue cita títulos de otros archivos como dato de
  // prueba, así que se acusó a sí mismo en vez de al que de verdad no avanzaba.
  const titulos = orden.map((f) => { try { return titulosDe(readFileSync(f, 'utf8')); } catch { return []; } });
  const cuales = titulos.flatMap((ts, n) => (ts.includes(ultimoCaso) ? [n] : []));
  const i = cuales[0] ?? -1;
  if (i < 0) return null;
  // ¿El último caso impreso es el ÚLTIMO de su archivo? Ahí está la diferencia entre los dos cuelgues posibles, y es lo único
  // que hace falta para nombrar al culpable en vez de a los 100.
  const termino = titulos[i][titulos[i].length - 1] === ultimoCaso;
  const siguiente = orden[i + 1] ?? null;
  return termino && siguiente
    // Terminó sus casos y la salida siguió: el que no deja avanzar es el que viene detrás, que todavía no imprimió nada.
    ? { culpable: siguiente, ultimo: orden[i], caso: 'el-que-sigue', siguiente, enVuelo: orden.slice(i + 1, i + 5) }
    : termino
      // Terminó sus casos, era el ÚLTIMO de la tanda y nunca llegó el pie: el proceso juzgó todo y NO SALIÓ (un handle abierto:
      // un timer, un socket, un servidor sin cerrar, un hijo que no murió).
      ? { culpable: orden[i], ultimo: orden[i], caso: 'no-salio', siguiente, enVuelo: [orden[i]] }
      // No terminó sus casos: sigue adentro de ese archivo, en el caso que viene después del último impreso.
      : { culpable: orden[i], ultimo: orden[i], caso: 'adentro', siguiente, enVuelo: [orden[i]] };
}

/** Lo que se le dice a quien lee el log, según cuál de los tres cuelgues fue. */
const COMO_SE_COLGO = {
  'el-que-sigue': (q) => `terminó TODOS sus casos, así que el que no dejó avanzar es el siguiente de la tanda: **${q.culpable}** (los que seguían: ${q.enVuelo.join(', ')})`,
  'no-salio': (q) => `terminó TODOS sus casos y era el ÚLTIMO de la tanda, y el pie nunca llegó: **${q.culpable}** juzgó todo y NO SALIÓ — un handle abierto (un timer, un socket, un servidor sin cerrar, un hijo que no murió)`,
  adentro: (q) => `NO terminó sus casos: el que no dejó avanzar es **${q.culpable}**, adentro, en el caso que viene después de ése`,
};

/** Lo que se dice de un proceso que hubo que matar: por qué, y qué archivo no dejó avanzar (ver `elQueNoDejoAvanzar`). */
export function porQueSeMato(r, archivos = []) {
  if (!r?.colgada) return '';
  const quien = elQueNoDejoAvanzar(r.ultimoCaso, archivos);
  const cual = !r.ultimoCaso
    ? ' Y no llegó a terminar NI UN caso: no alcanzó a arrancar.'
    : quien
      ? ` El último caso que TERMINÓ fue «${r.ultimoCaso}», de ${quien.ultimo}, y ${COMO_SE_COLGO[quien.caso](quien)}. Corrélo solo y tomale el tiempo: \`node --import tsx --test ${quien.culpable}\`.`
      : ` El último caso que TERMINÓ fue «${r.ultimoCaso}» y no pude decir de qué archivo es: la salida va en orden ALFABÉTICO, así que el que no dejó avanzar es el primero de la tanda, por nombre, que no imprimió nada.`;
  if (r.porque === 'sin-ram') {
    return `LO BAJÉ YO: la RAM libre cayó a ${Number.isFinite(r.libreMin) ? r.libreMin.toFixed(1) : '?'} GB (la zona roja del vigía es ${ZONA_ROJA_VIGIA_GB}) y se quedó ahí ${ROJO_SEGUIDAS * 5} s. `
      + `Con la RAM en cero se cuelga la app de Claude y se caen TODOS los chats con lo que tengan sin commitear. NO es un rojo del código: cerrá chats, o dejale el chequeo a Actions.${cual}`;
  }
  return r.porque === 'techo'
    ? `pasó el techo de ${min(r.techo)} (proporcional a sus archivos) avanzando de a poco: o la PC está paginando, o hay algo mucho más lento de lo medido.${cual}`
    : `estuvo ${min(r.sinAvanceMs ?? TOPE_SIN_AVANCE_MS)} sin terminar un solo caso: un test se colgó.${cual}`;
}

/**
 * El reporte de TIEMPO POR ARCHIVO (4/11/2026), sólo si se pidió con `MAKO_TIEMPOS_TESTS=<archivo.tsv>` (lo prende punta.yml). Va AL
 * LADO del spec, que sigue saliendo por stdout igual que siempre: todo lo de acá lo lee con regex. Comprobado con node 24: la salida
 * con `--test-reporter=spec` explícito es la misma que la de por default, letra por letra. Ver scripts/reporter-tiempos.mjs.
 */
const REPORTER_TIEMPOS = pathToFileURL(fileURLToPath(new URL('./reporter-tiempos.mjs', import.meta.url))).href;
export const banderasDeTiempos = (env) => (env.MAKO_TIEMPOS_TESTS
  ? ['--test-reporter=spec', '--test-reporter-destination=stdout', `--test-reporter=${REPORTER_TIEMPOS}`, '--test-reporter-destination=stdout']
  : []);

function correrTanda(archivos, concurrencia, env) {
  const bandera = concurrencia > 0 ? [`--test-concurrency=${concurrencia}`] : [];    // 0 = el de node (Actions)
  // Sin NODE_TEST_CONTEXT: si esto se llama desde adentro de un test, node cree que el hijo es un test ANIDADO y deja de imprimir el reporte.
  const { NODE_TEST_CONTEXT: _anidado, ...limpio } = env;
  return lanzarVigilado(['--import', 'tsx', '--test', ...bandera, ...banderasDeTiempos(limpio), ...archivos], { archivos: archivos.length, env: limpio, sinAvanceMs: sinAvanceDe(archivos) });
}

// Las barredoras que sólo leen corren JUNTAS en un proceso que memoriza las lecturas (scripts/cache-lecturas.cjs): medido el 17/10/2026,
// 12 barredoras globales tardaron 193 s en procesos separados y 40 s en uno compartido; las 148 que se pueden compartir, 267 s en dos.
const CACHE_LECTURAS = fileURLToPath(new URL('./cache-lecturas.cjs', import.meta.url)).replace(/\\/g, '/');
const POR_GRUPO = 12;             // no vale armar un proceso compartido para menos de esto

/**
 * LO QUE PIDE DE RAM un proceso compartido, y por qué es una FUNCIÓN de sus archivos. `COSTO_COMPARTIDO_GB = 0.8` se midió el
 * 17/10/2026 con 24 barredoras (~725 MB de pico) y se aplicaba igual a un grupo de 514: un piso que no escala deja arrancar lo que
 * no entra, y el vigía lo mata o la PC pagina (que es lo que hacía parecer que la causa era la RAM, 25/10 y 30/10).
 * Remedido el 31/10/2026 con scripts/medir-grupo-compartido.mjs (los números y la curva, en docs/hallazgos-infra.md): el costo es
 * una BASE (node + tsx + el cache de lecturas, que memoriza los ~5.400 archivos del repo una sola vez por proceso) más un poco por
 * archivo (su módulo y sus closures). La base es lo que domina, y por eso MENOS grupos piden MENOS RAM en total aunque cada proceso
 * sea más grande: `g × (BASE + k × T/g) = g × BASE + k × T`. Con el tope ya escalando, partir en más grupos dejó de ser necesario.
 */
export const COSTO_COMPARTIDO_BASE_GB = 0.7;
export const COSTO_COMPARTIDO_POR_ARCHIVO_GB = 0.0022;
export const costoCompartidoGb = (archivos) => COSTO_COMPARTIDO_BASE_GB + COSTO_COMPARTIDO_POR_ARCHIVO_GB * Math.max(1, archivos);
/** El piso de RAM para `grupos` procesos compartidos que se reparten `total` archivos. */
export const pisoCompartido = (grupos, total = 24 * grupos) => ZONA_ROJA_VIGIA_GB + grupos * costoCompartidoGb(Math.ceil(total / Math.max(1, grupos))) + MARGEN_GB;

function correrGrupoCompartido(archivos, env) {
  const { NODE_TEST_CONTEXT: _anidado, ...limpio } = env;
  const NODE_OPTIONS = `${limpio.NODE_OPTIONS ?? ''} --require ${JSON.stringify(CACHE_LECTURAS)}`.trim();
  return lanzarVigilado(['--import', 'tsx', '--test', '--test-isolation=none', ...banderasDeTiempos(limpio), ...archivos], { archivos: archivos.length, env: { ...limpio, NODE_OPTIONS }, sinAvanceMs: sinAvanceDe(archivos) });
}

/** Lo que el runner de node imprime al final: «ℹ tests N … ℹ fail M», y «test at <archivo>» por cada rojo. */
export function leerResultado(salida) {
  const num = (n) => Number((salida.match(new RegExp(`^ℹ ${n} (\\d+)`, 'm')) ?? [])[1] ?? 0);
  const rojos = [...new Set([...salida.matchAll(/^test at (\S+?\.test\.ts)/gm)].map((m) => m[1].replace(/\\/g, '/')))];
  const i = salida.indexOf('✖ failing tests:');
  return { tests: num('tests'), pasan: num('pass'), fallan: num('fail'), canceladas: num('cancelled'), rojos, detalle: i >= 0 ? salida.slice(i) : '' };
}

export const min = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(0)} s`);

// -----------------------------------------------------------------------------
// «CORRIÓ Y FALLÓ» contra «NO CORRIÓ»: lo que distingue un rojo de un 99
// -----------------------------------------------------------------------------
// ⚠️ EL 30/10/2026 UN GRUPO DE 495 BARREDORAS SE REPORTÓ COMO 495 TESTS ROTOS Y NO HABÍA CORRIDO NI UNO:
//   `grupo compartido 1/2 · 495 archivos · 0 tests · ROJO (? archivos) · 25 min 2 s`, con la RAM mínima de la corrida en 0,7 GB.
// Veinticinco minutos (el tope del grupo compartido: lo mató el reloj) sin ejecutar un solo test, y el veredicto final escribió los 495 nombres
// detrás de la palabra ROJO, que es lo único que lee quien pushea. Un archivo cuyo proceso murió sin ejecutar un test NO SE SABE si está roto.
//
// EL CRITERIO, medido con node 24.17 el 30/10/2026 (no supuesto — ver el final de tests/antes-de-subir-no-corrio.test.ts):
//   · Un archivo de test VACÍO (sin un solo caso) NO da «0 tests»: el runner lo cuenta como UN test que pasa, y lo imprime
//     («✔ vacio.test.ts (120ms)», `ℹ tests 1`), igual aislado que compartido, y sale con 0. Así que «0 tests» nunca es «el archivo no tenía nada».
//   · Un archivo que falla en su PRIMER caso imprime su «✖ <caso> (2ms)» mientras corre, el pie («ℹ tests 2 … ℹ fail 1») y el
//     «test at <archivo>» del pie de rojos: ejecutó tests, y hay con qué nombrarlo. Lo mismo uno que tira AL CARGAR en su propio proceso.
//   · Un proceso que MUERE sin llegar al pie (lo mata el vigía de RAM, o el tope de la tanda) sale con != 0 y **la salida es vacía**:
//     ni un caso, ni pie, ni nombres. Ése es el caso del 30/10.
// Por eso el discriminante NO es «el pie dice 0» (el pie puede faltar aunque se hayan corrido casos: una muerte a mitad) sino
// **¿el runner JUZGÓ algo?**: o llegó a su pie, o alcanzó a imprimir un caso FALLADO. Sin ninguna de las dos no hay veredicto que dar: «no corrió».
// Un caso VERDE impreso y después la muerte tampoco alcanza: nada falló, así que no hay rojo, y no se terminó, así que no hay verde.

/** El pie del runner de node: sólo se imprime si el proceso LLEGÓ al final. */
export const PIE_DEL_RUNNER = /^ℹ tests \d+/m;
/** Un caso que el runner alcanzó a JUZGAR y dio por fallado, impreso mientras corre (antes del pie). */
export const CASO_FALLADO = /^\s*✖ .*\(\d+(?:\.\d+)?ms\)/m;
/** ¿Este proceso de `node --test` juzgó algo, o murió sin juzgar nada? Sólo tiene sentido preguntárselo a uno que salió con != 0. */
export const juzgoAlgo = (salida) => PIE_DEL_RUNNER.test(salida) || CASO_FALLADO.test(salida);

/**
 * Corre `lista` por tandas. Devuelve { sinRam, total, rojos, sinCorrer, cortada, ms, ramMin }. `env` lleva el índice
 * temporal de git; `carpetaTmp` guarda el log completo de cada tanda roja. `compartidos`: los que corren juntos en un proceso por grupo.
 * `rojos` son los que CORRIERON y fallaron; `sinCorrer`, los que no se sabe (su proceso murió sin juzgar nada): un 99, no un rojo.
 * `esperar`: cómo se espera la RAM (default `esperarRam`). antes-de-subir pasa uno que SUELTA el candado de lo pesado mientras espera (el 21/10 un
 * `--solo tipos` lo retuvo 25 min esperando 4 GB que no había, con cuatro chats detrás): quien espera RAM no puede tener el candado.
 * `correr` y `correrGrupo` se inyectan para probar la CLASIFICACIÓN (rojo, flaky, no corrió) con salidas de node de verdad, copiadas de
 * una corrida, sin tener que vaciar los 16 GB de la PC ni esperar 25 minutos a que el vigía mate un grupo (tests/antes-de-subir-no-corrio.test.ts).
 * @param {{ lista: string[], compartidos?: string[], tanda: number, concurrencia: number, cortar: boolean, env: NodeJS.ProcessEnv, carpetaTmp: string, out: (s: string) => void, esperar?: typeof esperarRam, correr?: typeof correrTanda, correrGrupo?: typeof correrGrupoCompartido }} p
 */
export async function correrTests({ lista, compartidos = [], tanda, concurrencia, cortar, env, carpetaTmp, out, esperar = esperarRam, correr = correrTanda, correrGrupo = correrGrupoCompartido }) {
  const tandas = [];
  for (let i = 0; i < lista.length; i += tanda) tandas.push(lista.slice(i, i + tanda));
  const t0 = Date.now();
  let ramMin = Infinity;
  const vigilante = setInterval(() => { ramMin = Math.min(ramMin, ramLibreGb()); }, 1000);
  const total = { tests: 0, pasan: 0, fallan: 0 };
  const rojos = new Set();
  const sinCorrer = new Set();
  // Los que CORRIERON Y PASARON en esta corrida. Un proceso que salió con 0 y llegó a su pie pasó TODO lo que tenía, así que
  // alcanza con el resultado del proceso: nadie vuelve a correr nada. Lo usa la guarda de pendientes vencidos (un pendiente que
  // nombra un test verde está hecho y nadie lo borró, 30/10/2026): el resultado ya está en la mano, así que la guarda es gratis.
  const verdes = new Set();
  const flaky = [];
  let sinRam = false;
  let cortada = false;
  /** Un proceso que salió con != 0 sin juzgar nada: sus archivos no se sabe si están rotos. Dice POR QUÉ, para que el veredicto lo pueda repetir. */
  const noCorrio = (archivos, r, quien) => {
    if (archivos.length === 0) return;
    for (const f of archivos) sinCorrer.add(f);
    out(`    ⚠ NO CORRIÓ: ${quien} salió con ${r.codigo} sin juzgar un solo test (${r.colgada ? porQueSeMato(r, archivos) : `lo mató el vigía de RAM o se quedó sin memoria, con ${ramLibreGb().toFixed(1)} GB libres`}): de esos ${archivos.length} archivo(s) NO SE SABE si están rotos.`);
  };
  out(`  [tests-afectados] ${lista.length} archivos en ${tandas.length} tandas de hasta ${tanda}, ${concurrencia || 'los de node'} procesos a la vez (${os.availableParallelism()} CPU)`);
  try {
    for (let n = 0; n < tandas.length; n++) {
      const c = await esperar(concurrencia || 2);
      if (c === 0) { sinRam = true; break; }
      let r = await correr(tandas[n], concurrencia === 0 ? 0 : c, env);
      let res = leerResultado(r.salida);
      total.tests += res.tests; total.pasan += res.pasan; total.fallan += res.fallan + res.canceladas;
      let roja = r.codigo !== 0;
      if (!roja && PIE_DEL_RUNNER.test(r.salida)) for (const f of tandas[n]) verdes.add(f);
      total.tests += res.tests ? 0 : (r.casos ?? 0);      // sin el pie del runner (lo mataron), lo que se CONTÓ del stream
      out(`  tanda ${n + 1}/${tandas.length} · ${tandas[n].length} archivos · ${res.tests ? `${res.tests} tests` : `${r.casos ?? 0} casos juzgados (sin el pie del runner)`} · ${roja ? `ROJA (${res.rojos.length || '?'} archivos)` : 'verde'} · ${min(r.ms)}`);
      // ⚠️ Subir la concurrencia puede sacar rojos que son de la CARGA: medido el 17/10/2026, `ads-video-procesando` (un tope de 40 ms) falló con 2
      // procesos en una PC saturada y pasó solo. Cada rojo falso en Actions cuesta 11-14 min, así que un archivo rojo se REPITE de a uno: si
      // pasa, se informa como FLAKY (no se esconde: queda en la salida y en el resultado) y no frena; si sigue rojo, es rojo de verdad.
      if (roja && !r.colgada && c > 1 && res.rojos.length > 0 && res.rojos.length <= REINTENTO_MAX) {
        const solos = res.rojos.filter((f) => /\.test\.ts$/.test(f));
        if (solos.length === res.rojos.length) {
          out(`    ↻ ${solos.length} archivo(s) rojo(s) con ${c} procesos a la vez: los repito de a UNO, por si es la carga`);
          const r2 = await correr(solos, 1, env);
          if (r2.codigo === 0) {
            flaky.push(...solos);
            out(`    ⚠ FLAKY: ${solos.join(', ')} pasaron solos (rojos sólo con ${c} procesos). No frena, pero conviene arreglar el test: depende de la carga.`);
            roja = false;
          } else if (!juzgoAlgo(r2.salida)) {
            // El reintento murió sin juzgar: del rojo de la primera pasada no se sabe si era la carga, y los DEMÁS de la tanda pasaron. Sólo éstos quedan en «no se sabe».
            noCorrio(solos, r2, `el reintento de a uno de la tanda ${n + 1}`);
            try { writeFileSync(path.join(carpetaTmp, `tanda-${n + 1}-reintento.log`), r2.salida); } catch { /* el log es el detalle, no el veredicto */ }
            roja = false;
          } else { r = r2; res = leerResultado(r2.salida); }
        }
      }
      if (roja) {
        const log = path.join(carpetaTmp, `tanda-${n + 1}.log`);
        try { writeFileSync(log, r.salida); } catch { /* la carpeta de temporales se puede haber podado: el log es el detalle, no el veredicto */ }
        // Una tanda que murió sin juzgar nada no acusa a nadie: va a `sinCorrer` (99) y NO corta, porque las que siguen sí pueden encontrar un rojo de verdad.
        if (!juzgoAlgo(r.salida)) { noCorrio(tandas[n], r, `la tanda ${n + 1}`); out(`    (salida completa: ${log})`); continue; }
        for (const f of res.rojos) rojos.add(f);
        if (!res.rojos.length) for (const f of tandas[n]) rojos.add(`${f} (¿alguno de la tanda?)`);
        out(r.colgada ? `    ✖ la tanda se mató: ${porQueSeMato(r, tandas[n])}` : (res.detalle.split('\n').slice(0, 60).join('\n') || r.salida.split('\n').slice(-30).join('\n')));
        out(`    (salida completa: ${log})`);
        if (cortar) { cortada = true; break; }
      }
    }

    // Las barredoras que sólo leen, juntas: UN proceso por grupo, con las lecturas compartidas. Un rojo acá puede ser de la INTERFERENCIA
    // (comparten `globalThis` y los módulos: medido, `editor-landing-origen` falló así y pasó solo), así que TODO rojo se repite aislado
    // antes de contarlo: si pasa solo es FLAKY, si sigue rojo es rojo.
    if (compartidos.length && !cortada && !sinRam) {
      const grupos = Math.max(1, Math.min(concurrencia || 2, Math.floor(compartidos.length / POR_GRUPO)));
      // El piso DEPENDE de cuántos archivos le toca a cada proceso, no sólo de cuántos procesos son. `esperarRam` baja la cantidad
      // de grupos hasta que entre, y bajarla pide MENOS en total (la base por proceso es lo que domina) aunque cada proceso sea más grande.
      const g = await esperar(grupos, { pisoGb: (n) => pisoCompartido(n, compartidos.length), quien: 'tests-afectados' });
      if (g === 0) sinRam = true;
      else {
        const partes = Array.from({ length: g }, () => []);
        compartidos.forEach((f, i) => partes[i % g].push(f));    // reparto alternado: las pesadas no quedan todas en el mismo
        out(`  [tests-afectados] ${compartidos.length} barredoras que sólo leen, en ${g} proceso(s) compartido(s) con las lecturas en memoria`);
        const rs = await Promise.all(partes.map((p) => correrGrupo(p, env)));
        const rojosCompartidos = new Set();
        const mudos = new Set();      // los de un grupo que murió sin juzgar nada: todavía no se sabe nada de ellos
        for (const [i, r] of rs.entries()) {
          const res = leerResultado(r.salida);
          total.tests += res.tests; total.pasan += res.pasan; total.fallan += res.fallan + res.canceladas;
          const roja = r.codigo !== 0;
          const juzgo = roja && juzgoAlgo(r.salida);
          // ⚠️ `res.tests` sale del PIE del runner, que un proceso muerto nunca imprime: por eso el log decía «0 tests» de un grupo
          // que había juzgado miles, y dos diagnósticos (25/10 y 30/10) se armaron sobre ese cero. Si no hay pie se dice lo que se
          // CONTÓ del stream, y se dice que falta el pie.
          total.tests += res.tests ? 0 : (r.casos ?? 0);      // el pie ya se sumó arriba; sin pie, lo contado
          out(`  grupo compartido ${i + 1}/${rs.length} · ${partes[i].length} archivos · ${res.tests ? `${res.tests} tests` : `${r.casos ?? 0} casos juzgados (sin el pie del runner)`} · ${roja ? (juzgo ? `ROJO (${res.rojos.length || '?'} archivos)` : 'NO CORRIÓ: no juzgó NI UN caso') : 'verde'} · ${min(r.ms)}`);
          if (!roja && PIE_DEL_RUNNER.test(r.salida)) for (const f of partes[i]) verdes.add(f);
          if (roja) {
            try { writeFileSync(path.join(carpetaTmp, `compartido-${i + 1}.log`), r.salida); } catch { /* el log es el detalle, no el veredicto */ }
            if (!juzgo) { for (const f of partes[i]) mudos.add(f); }
            else if (!res.rojos.length || r.colgada) { for (const f of partes[i]) rojosCompartidos.add(f); }
            else for (const f of res.rojos) rojosCompartidos.add(f);
          }
        }
        // El reintento aislado se corre IGUAL para los mudos: es lo único que separa al caído por memoria del roto de verdad (30/10: dos de 615 estaban rojos de verdad).
        const aRepetir = [...new Set([...rojosCompartidos, ...mudos])];
        if (aRepetir.length) {
          const solos = aRepetir.filter((f) => /\.test\.ts$/.test(f));
          out(`    ↻ ${solos.length} archivo(s) ${rojosCompartidos.size && mudos.size ? 'rojos o sin juzgar' : rojosCompartidos.size ? 'rojo(s)' : 'sin juzgar'} en proceso compartido: los repito AISLADOS, uno por proceso, por si es la interferencia`);
          // Si cayó un grupo entero (se colgó, o murió) son cientos de archivos: de a uno tardaría una eternidad, así que con la concurrencia de siempre.
          const r2 = await correr(solos, solos.length > REINTENTO_MAX ? Math.max(1, concurrencia || 2) : 1, env);
          const res2 = leerResultado(r2.salida);
          // ⚠️ SIN EL PIE NADIE ES FLAKY. El pie («ℹ tests N») es lo que dice que el runner llegó al final y que, por lo tanto, los que no nombró
          // están bien. Si el reintento TAMBIÉN murió (el caso del 30/10: no hubo RAM ni para el grupo ni para el reintento), declarar FLAKY a los
          // que no nombró sería un VERDE FALSO. Y acusarlos a todos fue lo que pasó: 495 nombres detrás de la palabra ROJO.
          // Con el reintento muerto, lo que se sabe de cada archivo es lo que traía de antes, y es distinto:
          //   · el que FALLÓ en el proceso compartido (un rojo con nombre, o un grupo que juzgó y salió con != 0): corrió y falló. SIGUE ROJO —
          //     el reintento sólo existía para descartar la interferencia, y no haber podido correrlo no borra la falla; la línea lo dice.
          //   · el que estaba en un grupo que murió sin juzgar nada (`mudos`): no corrió NUNCA. No se sabe → 99.
          const pie = PIE_DEL_RUNNER.test(r2.salida);
          const juzgo = r2.codigo !== 0 && juzgoAlgo(r2.salida);
          const siguenRojos = r2.codigo === 0 ? [] : (res2.rojos.length ? res2.rojos : (juzgo ? solos : [...rojosCompartidos]));
          if (r2.codigo === 0 && pie) for (const f of solos) verdes.add(f);     // el reintento aislado pasó: corrieron y pasaron
          for (const f of solos) {
            if (siguenRojos.includes(f)) rojos.add(f);
            else if (pie && rojosCompartidos.has(f)) { flaky.push(f); out(`    ⚠ FLAKY: ${f} falló en el proceso compartido y pasa aislado (interferencia con otro test). No frena.`); }
          }
          if (!juzgo && r2.codigo !== 0) {
            if (rojosCompartidos.size) out(`    ✖ ${rojosCompartidos.size} archivo(s) fallaron en el proceso compartido y el reintento aislado no llegó a confirmarlo (murió sin juzgar nada): quedan ROJOS — corrélos a mano para descartar la interferencia.`);
            noCorrio(solos.filter((f) => !rojosCompartidos.has(f)), r2, 'el reintento aislado');
          }
          const log = path.join(carpetaTmp, 'compartido-aislado.log');
          try { writeFileSync(log, r2.salida); } catch { /* el log es el detalle, no el veredicto */ }
          if (siguenRojos.length || r2.codigo !== 0) {
            out(res2.detalle.split('\n').slice(0, 60).join('\n') || r2.salida.split('\n').slice(-30).join('\n'));
            out(`    (salida completa: ${log})`);
          }
        }
      }
    }
  } finally {
    clearInterval(vigilante);
  }
  // Un archivo que terminó rojo de verdad no queda además en «no se sabe»: el rojo confirmado manda.
  for (const f of rojos) sinCorrer.delete(f);
  for (const f of [...rojos, ...sinCorrer]) verdes.delete(f);
  return { sinRam, total, rojos, sinCorrer, verdes, flaky, cortada, ms: Date.now() - t0, ramMin, tandas: tandas.length };
}

// -----------------------------------------------------------------------------
// 7. La línea de comandos
// -----------------------------------------------------------------------------

function leerArgs(argv) {
  // `compartir`: las barredoras que sólo leen corren juntas en un proceso (ver scripts/cache-lecturas.cjs). En Actions (CI) no: ahí el disco es
  // rápido, cada test sigue en su proceso y un test que ensucia el entorno no puede dar un verde por contagio.
  const o = { base: 'origin/main', listar: false, explicar: false, cortar: false, resto: false, tanda: 6, concurrencia: 2, profundidad: Infinity, compartir: !process.env.CI, rapido: false };
  for (let i = 0; i < argv.length; i++) {
    const [k, v] = argv[i].split(/=(.*)/s);
    const valor = () => (v !== undefined ? v : argv[++i]);
    if (k === '--base') o.base = valor();
    else if (k === '--tanda') o.tanda = Math.max(1, Number.parseInt(valor(), 10) || 6);
    else if (k === '--concurrencia') { const c = valor(); o.concurrencia = c === 'auto' ? concurrenciaAuto() : Math.max(1, Number.parseInt(c, 10) || 2); }
    else if (k === '--profundidad') o.profundidad = Math.max(1, Number.parseInt(valor(), 10) || 1);
    else if (k === '--listar') o.listar = true;
    else if (k === '--sin-compartir') o.compartir = false;
    // `--compartir` comparte LAS BARREDORAS, que es lo único que gana algo (31/10/2026: de 1.850 compartibles, 227 barren).
    // `--compartir=todo-lo-seguro` es el de antes —todo lo que no toca estado global— y quedó sólo para volver a medirlo.
    else if (k === '--compartir') o.compartir = v === 'todo-lo-seguro' ? 'todo-lo-seguro' : 'barredoras';
    else if (k === '--rapido') { o.rapido = true; o.profundidad = 1; }
    else if (k === '--explicar') o.explicar = true;
    else if (k === '--cortar') o.cortar = true;
    else if (k === '--resto') o.resto = true;
    else if (k === '--barredoras') o.barredoras = true;
    else if (k === '--ayuda' || k === '-h') o.ayuda = true;
    else { process.stderr.write(`  [tests-afectados] no conozco «${argv[i]}» (mirá --ayuda)\n`); o.ayuda = true; }
  }
  return o;
}

const AYUDA = `node scripts/tests-afectados.mjs [--base origin/main] [--listar] [--explicar] [--cortar] [--resto] [--tanda 6] [--concurrencia 2|auto] [--profundidad N] [--rapido] [--sin-compartir]
  --rapido: lo que usan los jefes antes de pasar una punta: los que nombran o importan DIRECTO un archivo cambiado (profundidad 1) + las barredoras.
  --sin-compartir: cada barredora en su proceso (por default, localmente, las que sólo leen corren juntas con las lecturas en memoria).
  Elige los tests que lo cambiado desde --base puede romper (barredoras, nombran un archivo cambiado, importan uno) y los corre.
  --profundidad N: sólo sigue N saltos de import (por default todos). Es la palanca si el tiempo aprieta, con el costo de dejar afuera a los más lejanos.
  --resto: corre LOS DEMÁS (todos menos los afectados): Actions corre primero los afectados y después éstos, y así no se repite ninguno.
  --barredoras: corre TODAS las que barren el repo, sin mirar qué cambió (el chequeo sobre main de .github/workflows/sobre-main.yml).
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
  if (cambios.cambiados.length === 0 && !o.resto && !o.barredoras) { out(`[tests-afectados] Nada cambió respecto de ${o.base}: no hay tests que correr.`); return 0; }

  // ⚠️ EL BARRIDO COMPLETO (`--resto`) NO SE CORRE EN ESTA MÁQUINA. Decisión de Martín por el Cerebro, 31/10/2026, y va acá —en la
  // herramienta— y no en un documento, porque la regla escrita no alcanzó: el 31/10 TRES chats distintos llegaron a menos de 0,3 GB
  // libres corriéndolo y uno a CERO, con el turno del candado en la mano (el candado mira la RAM al dar el turno y no vuelve a
  // mirar: es una foto). Con la RAM en cero se cuelga la app de Claude y se caen todos los chats con lo que tengan sin commitear
  // (pasó el 11/10). Una corrida no puede costar eso. Acá se corren los tests de LO TOCADO, que piden tres veces menos.
  if (o.resto && !process.env.CI && process.env.MAKO_BARRIDO_AQUI !== '1') {
    process.stderr.write('\n  ✖ NO CORRO EL BARRIDO COMPLETO EN ESTA MÁQUINA (--resto son los ~1.900 tests del repo).\n');
    process.stderr.write('    El 31/10/2026 tres chats llegaron a menos de 0,3 GB libres corriéndolo y uno a CERO: con la RAM en cero se\n');
    process.stderr.write('    cuelga la app de Claude y se caen TODOS los chats con lo que tengan sin commitear. **Esto lo corre Actions**,\n');
    process.stderr.write('    que tiene memoria dedicada, cada noche en .github/workflows/semanal-tests.yml (la suite entera, aislada).\n');
    process.stderr.write('    Acá: `node scripts/tests-afectados.mjs` (los tests de lo tocado, que piden tres veces menos).\n');
    process.stderr.write('    Si de verdad hace falta y sabés lo que cuesta: MAKO_BARRIDO_AQUI=1.\n\n');
    return SALIDA_SIN_CORRER;
  }

  let lista;
  let compartidos = [];
  if (o.resto) {
    // Los demás: todos los tests menos los que ya corrieron como afectados. La suma de las dos fases es la suite entera.
    const todos = plan.archivos.filter((f) => ES_TEST.test(f)).sort();
    lista = todos.filter((t) => !sel.tests.has(t));
    out(`[tests-afectados] --resto: ${lista.length} tests (${todos.length} en total − ${sel.tests.size} afectados que ya corrieron)`);
    // Con `--compartir` (todo) los que no tocan estado global van juntos: el costo de la fase es el ARRANQUE de cada archivo (~0,4 s × cientos), no el cómputo.
    // ⚠️ LO SEGURO NO ES LO QUE CONVIENE (31/10/2026). Hasta hoy acá entraba TODO lo `compartible`, que contesta «¿es SEGURO
    // compartir este test?» (no toca estado global). Pero lo que un proceso compartido AHORRA es la relectura de los ~5.400
    // archivos del repo, y eso sólo lo pagan las BARREDORAS. Medido el 31/10 sobre 1.850 compartibles: **227 barren de verdad y
    // 1.623 sólo son seguros**. Los 1.623 no ganan nada y pagan la carga del grupo, que es super-lineal (ver `arranqueDe`): por
    // eso el grupo de 1.028 del 30/10 se quedó 25 min cargando sin juzgar un solo caso. Comparten las que barren; el resto, aislado.
    if (o.compartir) {
      const vale = (t) => sel.compartibles.has(t) && (o.compartir === 'todo-lo-seguro' || sel.barredoras.has(t));
      compartidos = lista.filter(vale);
      lista = lista.filter((t) => !vale(t));
      out(`  ↳ ${compartidos.length} barredoras corren juntas en procesos compartidos; ${lista.length} aisladas (no barren, o tocan el entorno o un global)`);
    }
    if (o.listar) return 0;
  } else if (o.barredoras) {
    // `--barredoras` (4/11/2026, .github/workflows/sobre-main.yml): TODAS las que barren el repo, sobre el árbol tal cual, sin mirar
    // qué cambió. Es lo que una MEZCLA rompe sin que ninguna de las dos puntas lo vea: cada una corrió las barredoras sobre su árbol, y
    // el de main es otro. Las que sólo leen van juntas con `--compartir`, como en la punta.
    const todas = [...sel.barredoras.keys()].filter((t) => !LENTOS_FUERA_DE_LA_FASE_RAPIDA.has(t)).sort();
    compartidos = o.compartir ? todas.filter((t) => sel.compartibles.has(t)) : [];
    lista = todas.filter((t) => !compartidos.includes(t));
    out(`[tests-afectados] --barredoras: las ${todas.length} que barren el repo (${compartidos.length} compartidas, ${lista.length} aisladas)`);
    if (o.listar) return 0;
  } else {
    imprimirPlan(plan, o, out);
    const ag = agrupar(sel.tests, sel.compartibles, { compartir: o.compartir });
    lista = ag.orden;
    compartidos = ag.compartidos;
    if (compartidos.length) out(`  ↳ ${compartidos.length} de las barredoras sólo leen: corren juntas en un proceso con las lecturas en memoria (--sin-compartir lo apaga)`);
    if (o.listar) return 0;
    if (lista.length === 0 && compartidos.length === 0) { out('[tests-afectados] Ningún test mira lo cambiado.'); return 0; }
  }

  const carpetaTmp = mkdtempSync(path.join(os.tmpdir(), 'tests-afectados-'));
  const indice = indiceConNuevos(cambios.nuevos, carpetaTmp);
  const env = { ...process.env, ...(indice ? { GIT_INDEX_FILE: indice } : {}) };
  const r = await correrTests({ lista, compartidos, tanda: o.tanda, concurrencia: o.concurrencia, cortar: o.cortar, env, carpetaTmp, out });

  if (r.sinRam && pausaVigente()) {
    process.stderr.write(`\n  ✖ NO CORRÍ LOS TESTS: el Cerebro tiene la PAUSA prendida («${pausaVigente()}»). Esto NO es un test roto: volvé a correrlo cuando la levante.\n\n`);
    return SALIDA_SIN_CORRER;
  }
  if (r.sinRam) {
    process.stderr.write(`\n  ✖ NO CORRÍ LOS TESTS: NO HAY RAM (quedan ${ramLibreGb().toFixed(1)} GB, hace falta ${pisoRam(1).toFixed(1)}). Esto NO es un test roto.\n`);
    process.stderr.write('    Cerrá unos chats de Claude y volvé a correrlo, o MAKO_TESTS_SIN_ESPERA=1 para correr igual (puede matarlo el vigía).\n\n');
    return SALIDA_SIN_CORRER;
  }
  // Los logs del detalle sólo se tiran si no hay nada que mirar: con un rojo o con archivos sin correr son la única forma de separarlos.
  if (r.rojos.size === 0 && r.sinCorrer.size === 0) rmSync(carpetaTmp, { recursive: true, force: true });
  out(`\n[tests-afectados] ${r.rojos.size ? '✖ ROJO' : r.sinCorrer.size ? '⚠ SIN CHEQUEAR' : '✔ VERDE'} · ${r.total.tests} tests de ${lista.length + compartidos.length} archivos${r.cortada ? ' (cortado en la primera tanda roja)' : ''} · ${min(r.ms)} · RAM libre mínima ${Number.isFinite(r.ramMin) ? r.ramMin.toFixed(1) : '?'} GB`);
  if (r.flaky.length) out(`  ⚠ ${r.flaky.length} FLAKY (rojos con varios procesos, verdes solos): ${r.flaky.join(', ')}`);
  if (r.sinCorrer.size) out(`  ⚠ ${r.sinCorrer.size} archivo(s) NO CORRIERON (su proceso murió sin juzgar un test): NO se sabe si están rotos. El detalle, en ${carpetaTmp}`);
  if (r.rojos.size) {
    out('  Rojos: ' + [...r.rojos].join(', '));
    out('  Repetilos solos: node --import tsx --test ' + [...r.rojos].filter((f) => f.startsWith('tests/') && !f.includes(' ')).join(' '));
    out('  Antes de tocar nada: `git status --short` de los archivos que ese test lee (AGENTS.md → «Si el pre-push da rojo»).');
    return 1;
  }
  // Nada roto y algo sin correr no es un verde: es «no pude chequear» (99), igual que la falta de RAM.
  return r.sinCorrer.size ? SALIDA_SIN_CORRER : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`  [tests-afectados] error inesperado: ${e?.stack ?? e}\n`); process.exit(2); });
}
