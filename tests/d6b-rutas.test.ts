// =============================================================================
// D6b en las RUTAS: toda ruta que llega a la cascada barata está decidida — adentro de «sólo su IA», o afuera con su porqué
// =============================================================================
// Martín (D6b, 21/10/2026): un negocio con su Claude o su GPT corre su Ops Center con SU cuenta, y nada de sus datos va a
// Gemini ni a una IA o red gratis. El corte vive abajo (lib/ai-cheap.ts), pero sólo corta lo que corre ADENTRO del contexto
// (lib/solo-su-ia.ts), y el contexto lo prende quien atiende el pedido. La segunda revisión del Cerebro encontró tres
// caminos del Ops Center que no lo prendían e iban a la Gemini gratis: El Archivero de su pantalla, «Buscar con MaKo» y las
// áreas del Second Brain. Y pidió la guarda: «el test que recorre los callers tiene que cubrir también las RUTAS
// (app/api/**), no sólo el turno».
//
// Lo que fija este archivo:
//   1. EL GRAFO: cada app/api/**/route.ts y cada archivo 'use server' de app/** con su clausura de imports (estáticos y
//      `import()`, transitivos, del repo; el armador es el de scripts/tests-afectados.mjs). Las que llegan a
//      lib/ai-cheap.ts son las que pueden pedirle algo a la cascada.
//   2. CADA UNA ESTÁ DECIDIDA: o PRENDE el contexto (su archivo llama a `conSuIADelNegocio`, `conSoloSuIA` o
//      `entrarSoloSuIA`, o a una función del repo que lo prende — `turnoApp`, `confirmarDesdeTarjeta`… se DETECTA
//      siguiendo las llamadas, no es una lista a mano), o está en `SIN_IA` (del Ops Center, no le pide nada a una IA:
//      sus imports quedan fijados), o en `FUERA_DE_D6B` con su porqué. Una ruta nueva sin decidir → rojo, con su nombre.
//   3. EL OPS CENTER VA ADENTRO: las rutas que llaman sus pantallas (el Second Brain de escritorio y del teléfono, el chat,
//      /mako; se SACAN de sus componentes, no de una lista) nunca pueden ir a `FUERA_DE_D6B`.
//   4. Y CORRIENDO: tests/_d6b-rutas-hijo.ts corre DE VERDAD «Buscar con MaKo» y El Archivero (una foto y un texto) con un
//      negocio que tiene sólo su PC: cero pedidos a Gemini, Groq, Mistral, OpenRouter o Cerebras, y la pantalla dice lo
//      cierto; el control (sin su IA) sí sale; y con el onboarding en curso el crédito de Claude de la plataforma sigue.
//
// ⚠️ PRENDER EL CONTEXTO PROTEGE SÓLO LO QUE PASA POR lib/ai-cheap.ts. lib/transcribe.ts (cursos, anuncios, reuniones) va
// DIRECTO a Groq y a Gemini con las keys del entorno, sin el corte: una ruta del Ops Center que lo use no queda
// protegida por envolverse (docs/hallazgos-ia.md).
//
// PROBADO ROMPIÉNDOLO (21/10/2026; una rotura por vez, restaurada y comprobada con sha256; base 8 / 0). 23 roturas, todas
// con su rojo:
//   · cada una de las 11 rutas envueltas sin el contexto (la misma forma, sin «sólo su IA») → rojas la 3 y la 4; Buscar
//     además la 2 y la 7, y El Archivero la 2, la 7 y la 8 (esas dos corren de verdad en el hijo).
//   · una ruta NUEVA que llama a la cascada, sin decidir → la 3 · un área sin contexto ESCONDIDA en FUERA_DE_D6B → la 4 ·
//     el detector sin seguir las llamadas → 2, 3 y 4 · el grafo sin resolver `@/` → 1 y 5 · una ruta SIN_IA que importa la
//     cascada → la 5 · un prefijo de FUERA_DE_D6B que no toca nada → la 5.
//   · el corte de D6b ANTES del crédito de Claude en `chatCheapCascade` → la 8 · `errorDeCascada`, `leerDocumentoIA`,
//     `extraerDeArchivo` y Buscar sin su texto de D6b → cada uno, la 7.
//
// Correr: npx tsx --test tests/d6b-rutas.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { especificadores, resolver, sinComentarios } from '../scripts/tests-afectados.mjs';

const RAIZ = join(__dirname, '..');
const CASCADA = 'lib/ai-cheap.ts';
const ES_CODIGO = /\.(?:[cm]?[jt]s|[jt]sx)$/;

// ─────────────────────────────────────────────────────────────────────────────
// La tabla: lo que se DECIDIÓ dejar afuera de D6b, y por qué
// ─────────────────────────────────────────────────────────────────────────────

const FONDO = 'lo de FONDO: no va por la suscripción del negocio (D6a), y «lo de fondo sin Gemini» (AI Step, nutrición, reuniones) es de cada chat — docs/ia-del-cliente.md §8 y §13';
const ENTRANTE = 'lo que ENTRA de afuera (webhooks, WhatsApp, el tracking de las landings): sin la pantalla del Ops Center; WhatsApp no va por la suscripción (§13, «MaKo en WhatsApp»)';
const PLAN = 'el Plan, el Perro y las reuniones: «lo interno sigue por ahora» (el Cerebro, D6b), y el Plan nunca paga IA (FEATURES_DEL_PLAN, lib/veto-claude.ts)';
const PLATAFORMA = 'el super admin y la agencia: sus claves son las de la plataforma, no «su IA» de un cliente (`negocioConSuIA` dice que no para el workspace de la plataforma)';
const API_MAKO = 'la API de MaKo y el agente externo: los llama un agente con su token, sin la pantalla del Ops Center; si D6b los alcanza lo decide la API (lib/api-mako) — pendiente';
const OTRA_TAB = 'otra tab, no el Ops Center: D6b (Martín, 21/10/2026) es el Ops Center, y esta tab sigue con la cascada del negocio. Extenderlo es una decisión pendiente, no un olvido (docs/ia-del-cliente.md §13)';
const OFFER = 'Offer y el chat de arranque del onboarding (que ES el de Offer): corre con el crédito de Claude de la plataforma mientras el onboarding está en curso; otra tab — extender D6b es de Offer';
const CUENTA = 'la cuenta de la persona, el login y sus avisos: no es una pantalla del negocio, y lo que la alcanza es de paso (los avisos y las plantillas)';
const PC = 'la conexión de la PC (emparejar, estado, modelo, desconectar): no le pide nada a una IA; el turno de la PC lo corre `turnoApp`, que prende el contexto';

/** Por PREFIJO de ruta o de archivo. Un prefijo que ya no toca ninguna ruta que llegue a la cascada, se borra (lo pide la prueba 5). */
const FUERA_DE_D6B: ReadonlyArray<{ prefijo: string; porque: string }> = [
  { prefijo: 'app/api/cron/', porque: FONDO },
  { prefijo: 'app/api/webhooks/', porque: ENTRANTE },
  { prefijo: 'app/api/whatsapp/', porque: ENTRANTE },
  { prefijo: 'app/api/zernio/', porque: ENTRANTE },
  { prefijo: 'app/api/track/', porque: ENTRANTE },
  { prefijo: 'app/api/plan-', porque: PLAN },
  { prefijo: 'app/api/todo/', porque: PLAN },
  { prefijo: 'app/api/mako-guardian/', porque: PLAN },
  { prefijo: 'app/api/checklist-coach/', porque: PLAN },
  { prefijo: 'app/api/regenerate-transcript/', porque: PLAN },
  { prefijo: 'app/api/onboarding/plan-arranque/', porque: PLAN },
  { prefijo: 'app/m/plan/', porque: PLAN },
  { prefijo: 'app/configuraciones/plan/', porque: PLAN },
  { prefijo: 'app/api/admin/', porque: PLATAFORMA },
  { prefijo: 'app/api/agencia/', porque: PLATAFORMA },
  { prefijo: 'app/api/anthropic-usage/', porque: PLATAFORMA },
  { prefijo: 'app/api/operaciones/', porque: PLATAFORMA },
  { prefijo: 'app/api/centro/', porque: PLATAFORMA },
  { prefijo: 'app/api/mako/knowledge/', porque: PLATAFORMA },
  { prefijo: 'app/api/mako/copywriting/', porque: PLATAFORMA },
  { prefijo: 'app/api/mako/config-prompts/', porque: PLATAFORMA },
  { prefijo: 'app/api/datos-mau/', porque: PLATAFORMA },
  { prefijo: 'app/admin/', porque: PLATAFORMA },
  { prefijo: 'app/api/v1/', porque: API_MAKO },
  { prefijo: 'app/api/agente/', porque: API_MAKO },
  { prefijo: 'app/api-mako/', porque: API_MAKO },
  { prefijo: 'app/api/offer/', porque: OFFER },
  { prefijo: 'app/api/onboarding/arranque/', porque: OFFER },
  { prefijo: 'app/api/auth/', porque: CUENTA },
  { prefijo: 'app/api/perfil/', porque: CUENTA },
  { prefijo: 'app/api/push/', porque: CUENTA },
  { prefijo: 'app/api/notificaciones/', porque: CUENTA },
  { prefijo: 'app/api/ia-pc/', porque: PC },
  // Las otras tabs.
  ...[
    'app/api/account-insights/', 'app/api/ad-insights/', 'app/api/ads-analyst/', 'app/api/ads-manager/', 'app/api/alumno/',
    'app/api/anuncios/', 'app/api/automations/', 'app/api/chart-insights/', 'app/api/chat-agent/', 'app/api/chats/',
    'app/api/closing/', 'app/api/compartido/', 'app/api/compartir/', 'app/api/crm/', 'app/api/datos-sin-marcar-count/',
    'app/api/email/', 'app/api/entity-insights/', 'app/api/equipo/', 'app/api/experimentos/', 'app/api/extract-',
    'app/api/flujos/', 'app/api/graficos/', 'app/api/ia/', 'app/api/image-editor/', 'app/api/integraciones/',
    'app/api/landing-analyst/', 'app/api/landing-generator/', 'app/api/lead-plan/', 'app/api/meta-', 'app/api/metodo/',
    'app/api/pagar/', 'app/api/plantillas/', 'app/api/video-editor/', 'app/api/mako-doer/', 'app/api/mako/nutricion/',
    'app/api/mako/voz/', 'app/api/mako/onboarding/', 'app/api/onboarding/voz/', 'app/api/onboarding/extraccion/',
    'app/api/onboarding/route.ts',
    'app/_components/', 'app/ai-avatar/', 'app/automations/', 'app/calendario/', 'app/carousels/',
    'app/configuraciones/', 'app/creaciones/', 'app/crm/', 'app/customer-success/', 'app/general/',
    'app/integraciones/', 'app/m/crm/', 'app/partners/', 'app/reels/', 'app/stories/',
    'app/tickets/', 'app/video-editor/', 'app/video-generator/',
  ].map((prefijo) => ({ prefijo, porque: OTRA_TAB })),
];

/**
 * Del Ops Center, y NO le piden nada a una IA: llegan a la cascada sólo de paso (lib/onboarding.ts por `getSchema`,
 * lib/archivero.ts…). Sus imports del repo quedan FIJADOS en `usa`: si uno cambia, la prueba lo dice y se vuelve a
 * mirar si ahora le pide algo a una IA (entonces va adentro, con `conSuIADelNegocio`).
 */
const SIN_IA: ReadonlyArray<{ ruta: string; usa: string[]; porque: string }> = [
  { ruta: 'app/api/second-brain/cerebro/route.ts', usa: ['soloAdminDeTab', 'construirCerebro', 'chatsMakoDeQuienMira', 'cerebroQueSeDibuja'], porque: 'arma el mapa con lecturas (lib/cerebro-grafo.ts)' },
  { ruta: 'app/api/second-brain/exportar/route.ts', usa: ['requireRolWs', 'construirCerebro', 'construirVault', 'AREAS'], porque: 'exporta el mapa que ya está armado' },
  { ruta: 'app/api/onboarding/archivero/download/route.ts', usa: ['runWithWorkspace', 'getFile', 'urlDescarga', 'urlPreview', 'resolverWsAdmin'], porque: 'firma el link de un archivo guardado' },
  { ruta: 'app/api/onboarding/archivero/manual/route.ts', usa: ['runWithWorkspace', 'getSesionAdmin', 'listFiles', 'getManual', 'setManual', 'computeEffective', 'buildEstado', 'resolverWsAdmin'], porque: 'guarda lo que la persona escribe a mano' },
  { ruta: 'app/api/onboarding/archivero/upload-url/route.ts', usa: ['runWithWorkspace', 'resolverWsAdmin', 'getSupabaseServer'], porque: 'firma la subida de un archivo (lo lee el POST de El Archivero, que sí va adentro)' },
  { ruta: 'app/api/onboarding/fase/route.ts', usa: ['runWithWorkspace', 'resolverWsAdmin', 'getDiagnosticoFase', 'guardarHechasFase', 'setDiagnosticoFase'], porque: 'el diagnóstico de la fase es una cuenta, sin IA (lib/fase-store.ts)' },
];

/** Las pantallas del Ops Center: de acá se sacan las rutas que llaman (prueba 3). Se siguen sus imports SÓLO adentro de estas carpetas. */
const PANTALLAS_OPS_CENTER = ['app/second-brain/page.tsx', 'app/m/second-brain/page.tsx', 'app/mako/page.tsx', 'app/m/mako/page.tsx'];
const CARPETAS_OPS_CENTER = ['app/second-brain/', 'app/m/second-brain/', 'app/mako/', 'app/m/mako/', 'app/onboarding/', 'app/_chat/'];

// ─────────────────────────────────────────────────────────────────────────────
// El grafo
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVOS = execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter(Boolean);
const EXISTE = new Set(ARCHIVOS);
const existe = (r: string) => EXISTE.has(r);
const memo = <T>(f: (a: string) => T) => { const m = new Map<string, T>(); return (a: string): T => { if (!m.has(a)) m.set(a, f(a)); return m.get(a)!; }; };
const limpio = memo((f: string) => { try { return sinComentarios(readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')) as string; } catch { return ''; } });
const deps = memo((f: string) => [...new Set((especificadores(limpio(f)) as string[]).map((s) => resolver(f, s, existe) as string | null).filter((r): r is string => !!r && ES_CODIGO.test(r)))]);

const RUTAS = ARCHIVOS.filter((f) => /^app\/api\/.+\/route\.tsx?$/.test(f));
const ACCIONES = ARCHIVOS.filter((f) => /^app\/.+\.tsx?$/.test(f) && !f.startsWith('app/api/') && /^\s*['"]use server['"]/.test(limpio(f)));
const ENTRADAS = [...RUTAS, ...ACCIONES];

/** Los archivos desde los que se llega a `destino` (incluido), sobre la clausura de las entradas. */
function llegan(destino: string): Set<string> {
  const inversa = new Map<string, string[]>();
  const vistos = new Set<string>();
  const cola = [...ENTRADAS];
  while (cola.length) {
    const f = cola.pop()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    for (const d of deps(f)) {
      if (!inversa.has(d)) inversa.set(d, []);
      inversa.get(d)!.push(f);
      if (!vistos.has(d)) cola.push(d);
    }
  }
  const out = new Set<string>([destino]);
  const pila = [destino];
  while (pila.length) for (const p of inversa.get(pila.pop()!) ?? []) if (!out.has(p)) { out.add(p); pila.push(p); }
  return out;
}
const LLEGAN = llegan(CASCADA);
const ALCANZAN = ENTRADAS.filter((f) => LLEGAN.has(f));

// ─────────────────────────────────────────────────────────────────────────────
// ¿Prende el contexto? Siguiendo las llamadas, no con una lista a mano
// ─────────────────────────────────────────────────────────────────────────────

const RE_CONTEXTO = /(?<![\w$.])(?:conSuIADelNegocio|conSoloSuIA|entrarSoloSuIA)\s*\(/;
type Importado = { archivo: string; nombre: string };

/** Los nombres que un archivo importa del repo (por valor): local → de dónde y con qué nombre. */
const importsDe = memo((f: string) => {
  const src = limpio(f);
  const out = new Map<string, Importado>();
  const sumar = (lista: string, spec: string, sep: RegExp) => {
    const archivo = resolver(f, spec, existe) as string | null;
    if (!archivo) return;
    for (const parte of lista.split(',')) {
      const p = parte.trim();
      if (!p || /^type\s/.test(p)) continue;
      const [nombre, local] = p.split(sep).map((s) => s.trim());
      out.set(local || nombre, { archivo, nombre });
    }
  };
  for (const m of src.matchAll(/import\s+(?!type\s)(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) sumar(m[1], m[2], /\s+as\s+/);
  for (const m of src.matchAll(/import\s+(?!type\s)([\w$]+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g)) sumar(`default as ${m[1]}`, m[2], /\s+as\s+/);
  // const { a, b: c } = await import('…')
  for (const m of src.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) sumar(m[1], m[2], /\s*:\s*/);
  return out;
});

/** Las declaraciones de primer nivel de un archivo (funciones y constantes): nombre → su texto, hasta la siguiente. */
const declaraciones = memo((f: string) => {
  const src = limpio(f);
  const inicios = [...src.matchAll(/^(?:export|import|const|let|var|function|async|type|interface|class|enum|declare)\b/gm)].map((m) => m.index!);
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)|^(?:export\s+)?const\s+([\w$]+)\s*(?::[^=\n]*)?=/gm)) {
    const fin = inicios.find((i) => i > m.index!) ?? src.length;
    out.set(m[1] ?? m[2], src.slice(m.index!, fin));
  }
  return out;
});

/** Los nombres que un texto LLAMA (`x(`, `x<T>(`), sin los métodos (`a.x(`). Una pasada por texto. */
const llamados = (texto: string) => new Set([...texto.matchAll(/(?<![\w$.])([\w$]+)\s*(?:<[^>()]*>)?\(/g)].map((m) => m[1]));

const prendeMemo = new Map<string, boolean>();
/** ¿La función `nombre` de `f` prende el contexto (ella o algo que llama, del repo)? */
function prende(f: string, nombre: string, pila: Set<string>): boolean {
  const k = `${f}#${nombre}`;
  if (prendeMemo.has(k)) return prendeMemo.get(k)!;
  if (pila.has(k)) return false;
  pila.add(k);
  const cuerpo = declaraciones(f).get(nombre);
  let r = false;
  if (cuerpo != null) r = textoPrende(f, cuerpo, pila);
  else {
    // Un re-export (`export { x } from './y'`).
    const src = limpio(f);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const parte = m[1].split(',').map((p) => p.trim().split(/\s+as\s+/)).find(([n, l]) => (l || n) === nombre);
      const archivo = parte && (resolver(f, m[2], existe) as string | null);
      if (parte && archivo) { r = prende(archivo, parte[0], pila); break; }
    }
  }
  pila.delete(k);
  prendeMemo.set(k, r);
  return r;
}
function textoPrende(f: string, texto: string, pila: Set<string>): boolean {
  if (RE_CONTEXTO.test(texto)) return true;
  const imps = importsDe(f);
  const decls = declaraciones(f);
  for (const n of llamados(texto)) {
    const imp = imps.get(n);
    if (imp && prende(imp.archivo, imp.nombre, pila)) return true;
    if (!imp && decls.has(n) && prende(f, n, pila)) return true;
  }
  return false;
}
const entradaPrende = memo((f: string) => textoPrende(f, limpio(f), new Set()));

const fueraDe = (f: string) => FUERA_DE_D6B.find((x) => f.startsWith(x.prefijo));
const sinIADe = (f: string) => SIN_IA.find((x) => x.ruta === f);

// ─────────────────────────────────────────────────────────────────────────────
// Las rutas que llaman las pantallas del Ops Center
// ─────────────────────────────────────────────────────────────────────────────

function rutasDelOpsCenter(): { rutas: Set<string>; sinRuta: string[] } {
  const vistos = new Set<string>();
  const cola = [...PANTALLAS_OPS_CENTER, ...ACCIONES.filter((f) => CARPETAS_OPS_CENTER.some((c) => f.startsWith(c)))];
  const rutas = new Set<string>();
  const sinRuta: string[] = [];
  while (cola.length) {
    const f = cola.pop()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    if (ACCIONES.includes(f)) rutas.add(f);
    for (const m of limpio(f).matchAll(/['"`](\/api\/[A-Za-z0-9/_[\]-]+)/g)) {
      const api = m[1].replace(/\/+$/, '');
      const ruta = [`app${api}/route.ts`, `app${api}/route.tsx`].find(existe);
      if (ruta) rutas.add(ruta); else sinRuta.push(`${api} (${f})`);
    }
    for (const d of deps(f)) if (CARPETAS_OPS_CENTER.some((c) => d.startsWith(c))) cola.push(d);
  }
  return { rutas, sinRuta };
}
const OPS_CENTER = rutasDelOpsCenter();

// ─────────────────────────────────────────────────────────────────────────────
// Las pruebas
// ─────────────────────────────────────────────────────────────────────────────

test('1. el grafo ve la cascada: las rutas que le piden a la IA llegan, y una que no, no', () => {
  // Rota: un armador que no sigue los imports (o los lee mal) daría un verde vacío. Medido el 21/10/2026: ~300 de ~370.
  assert.ok(ALCANZAN.length >= 150, `sólo ${ALCANZAN.length} entradas llegan a la cascada: el grafo no está leyendo los imports`);
  for (const r of ['app/api/second-brain/buscar/route.ts', 'app/api/onboarding/archivero/route.ts', 'app/api/mako/chat/route.ts', 'app/api/onboarding/avatares/route.ts']) {
    assert.ok(LLEGAN.has(r), `${r} tendría que llegar a ${CASCADA}`);
  }
  assert.ok(!LLEGAN.has('app/api/auth/me/route.ts'), 'auth/me no le pide nada a una IA: si llega, el grafo está de más');
});

test('2. el detector de «prende» ve a quien lo prende, por su archivo o por lo que llama', () => {
  // Directo en la ruta, o en la server action.
  for (const r of ['app/api/mako/pedidos/route.ts', 'app/api/plan-dictado/route.ts', 'app/api/second-brain/buscar/route.ts', 'app/api/onboarding/archivero/route.ts', 'app/mako/pendientes/acciones.ts']) {
    assert.ok(entradaPrende(r), `${r} prende el contexto`);
  }
  // A través de lo que llama: `turnoApp` (el chat), `confirmarDesdeTarjeta` (el teléfono), `confirmarAccionAction` (la
  // propuesta del chat), y `turnoDelCrm` → `turnoApp` (el chat del CRM, dos saltos).
  for (const r of ['app/api/mako/chat/route.ts', 'app/api/m/mako/route.ts', 'app/m/mako/acciones.ts', 'app/api/mako/propuesta/route.ts', 'app/api/crm/mako/route.ts']) {
    assert.ok(entradaPrende(r), `${r} prende el contexto (por lo que llama)`);
  }
  // Y no a cualquiera: un cron que le pide a la IA no lo prende (si el detector dijera que sí, todo pasaría).
  assert.equal(entradaPrende('app/api/cron/nutricion/route.ts'), false, 'el detector dice «prende» de más');
});

test('3. TODA ruta que llega a la cascada está decidida: adentro, sin IA, o afuera con su porqué', () => {
  // Rota: sacar `conSuIADelNegocio` de app/api/second-brain/buscar → esta prueba la nombra (y la 4 también).
  // `D6B_VOLCAR=1 npx tsx --test tests/d6b-rutas.test.ts` lista cómo quedó decidida cada una.
  if (process.env.D6B_VOLCAR) for (const f of ALCANZAN) console.log(`D6B ${entradaPrende(f) ? 'PRENDE' : sinIADe(f) ? 'SIN_IA' : fueraDe(f) ? 'FUERA ' + fueraDe(f)!.prefijo : '??'} ${f}`);
  const sinDecidir = ALCANZAN.filter((f) => !entradaPrende(f) && !sinIADe(f) && !fueraDe(f));
  assert.deepEqual(sinDecidir, [], [
    `Estas entradas llegan a la cascada barata (${CASCADA}) y nadie decidió D6b (Martín, 21/10/2026: con su Claude o su GPT,`,
    'nada de sus datos va a Gemini). Decídelo: si es del Ops Center, que corra adentro de `conSuIADelNegocio(ws, …)`',
    '(lib/ia-del-negocio.ts); si no, súmala a FUERA_DE_D6B en tests/d6b-rutas.test.ts con su porqué:',
    ...sinDecidir.map((f) => `  · ${f}`),
  ].join('\n'));
});

test('4. el Ops Center va ADENTRO: lo que llaman sus pantallas prende el contexto o no le pide nada a una IA', () => {
  // Rota: sacar el contexto de una ruta de un área (app/api/onboarding/razones) → esta prueba la nombra, aunque alguien la
  // sume a FUERA_DE_D6B para callar la 3.
  const { rutas, sinRuta } = OPS_CENTER;
  for (const r of ['app/api/second-brain/buscar/route.ts', 'app/api/onboarding/archivero/route.ts', 'app/api/onboarding/razones/route.ts', 'app/api/mako/chat/route.ts', 'app/mako/pendientes/acciones.ts']) {
    assert.ok(rutas.has(r), `las pantallas del Ops Center llaman ${r}: si no aparece, la lectura de sus componentes está rota`);
  }
  assert.deepEqual(sinRuta, [], 'una pantalla del Ops Center llama una /api/… que no existe (o la lectura de sus rutas está rota)');
  const afuera = [...rutas].filter((r) => LLEGAN.has(r) && !entradaPrende(r) && !sinIADe(r));
  assert.deepEqual(afuera, [], [
    'Estas rutas las llaman las pantallas del Ops Center, llegan a la cascada barata y NO prenden «sólo su IA»: con su Claude,',
    'lo que piden iría a la Gemini gratis. Que corran adentro de `conSuIADelNegocio(ws, …)` (lib/ia-del-negocio.ts):',
    ...afuera.map((f) => `  · ${f}${fueraDe(f) ? ` (está en FUERA_DE_D6B: «${fueraDe(f)!.prefijo}», y el Ops Center no va afuera)` : ''}`),
  ].join('\n'));
});

test('5. la tabla es HONESTA: cada «afuera» dice por qué y toca algo, y cada «sin IA» sigue sin IA', () => {
  for (const x of FUERA_DE_D6B) {
    assert.ok(x.porque.length >= 40, `«${x.prefijo}» sin un porqué de verdad`);
    assert.ok(!CARPETAS_OPS_CENTER.some((c) => c.startsWith(x.prefijo) || x.prefijo.startsWith(c)), `«${x.prefijo}» deja afuera una carpeta del Ops Center`);
  }
  // Rota: dejar un prefijo que ya no toca nada → esta prueba lo nombra (una tabla vieja deja de decir lo que pasa).
  const viejos = FUERA_DE_D6B.filter((x) => !ALCANZAN.some((f) => f.startsWith(x.prefijo) && !entradaPrende(f))).map((x) => x.prefijo);
  assert.deepEqual(viejos, [], 'estos prefijos de FUERA_DE_D6B ya no tocan ninguna ruta que llegue a la cascada sin prender el contexto: bórralos');
  for (const x of SIN_IA) {
    assert.ok(existe(x.ruta), `${x.ruta} ya no existe: bórrala de SIN_IA`);
    assert.ok(LLEGAN.has(x.ruta), `${x.ruta} ya no llega a la cascada: bórrala de SIN_IA`);
    assert.ok(!entradaPrende(x.ruta), `${x.ruta} ya prende el contexto: bórrala de SIN_IA`);
    // Rota: sumarle a una de éstas un import de una función con IA → esta prueba lo nombra, y se decide si va adentro.
    const usa = [...importsDe(x.ruta).keys()].sort();
    assert.deepEqual(usa, [...x.usa].sort(), `${x.ruta} cambió lo que importa del repo: ¿ahora le pide algo a una IA? Si sí, adentro de \`conSuIADelNegocio\`; si no, actualiza \`usa\` en SIN_IA`);
    assert.ok(![...importsDe(x.ruta).values()].some((i) => i.archivo === CASCADA), `${x.ruta} importa la cascada directo: no es «sin IA»`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Y corriendo de verdad (tests/_d6b-rutas-hijo.ts)
// ─────────────────────────────────────────────────────────────────────────────

type Corrida = { red: string[]; status: number; cuerpo: { ok?: boolean; ids?: unknown; porTexto?: boolean; explico?: string; warnings?: string[] } };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_d6b-rutas-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  sinSuIA: Record<string, Corrida>; conSuPc: Record<string, Corrida>; enOnboardingConSuPc: Record<string, Corrida>;
  errorAdentro: string; errorAdentroConSuyo: string; error?: string;
};
const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;

test('6. el control: sin su IA, «Buscar con MaKo» y El Archivero (foto y texto) SÍ salen a la Gemini gratis', () => {
  assert.equal(R.error, undefined, R.error);
  for (const [caso, c] of Object.entries(R.sinSuIA)) {
    assert.ok(c.red.some((h) => GRATIS.test(h)), `${caso}: el control no salió a la red gratis (${c.red.join(', ') || 'nada'}): la prueba no vería una fuga`);
  }
});

test('7. con sólo su PC (su Claude), las rutas de verdad no mandan NADA a una IA gratis, y la pantalla dice lo cierto', () => {
  assert.deepEqual(Object.keys(R.conSuPc).sort(), ['archiveroFoto', 'archiveroTexto', 'buscar']);
  for (const [caso, c] of Object.entries(R.conSuPc)) {
    // Rota: sacar `conSuIADelNegocio` de app/api/second-brain/buscar o de app/api/onboarding/archivero → esta prueba falla.
    assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), [], `${caso} salió a una IA gratis con el negocio en su propio Claude`);
  }
  // Buscar: vuelve a la búsqueda por texto y lo dice (no «MaKo eligió 0»).
  const b = R.conSuPc.buscar.cuerpo;
  assert.equal(b.porTexto, true);
  assert.equal(b.ids, null);
  assert.match(String(b.explico), /^Con tu propio Claude, para buscar con MaKo necesito tu clave de Claude o de OpenAI.* por texto\.$/);
  // El Archivero: la foto pide su OpenAI (sólo su OpenAI mira); el texto, su clave de Claude o de OpenAI. Nunca «Gemini».
  assert.match(String(R.conSuPc.archiveroFoto.cuerpo.warnings?.[0]), /las fotos y los PDF escaneados los leo con tu clave de OpenAI/);
  assert.match(String(R.conSuPc.archiveroTexto.cuerpo.warnings?.[0]), /para leer tus documentos necesito tu clave de Claude o de OpenAI/);
  for (const c of Object.values(R.conSuPc)) assert.doesNotMatch(JSON.stringify(c.cuerpo), /Gemini|IA gratis/, 'con su propio Claude no se le ofrece Gemini');
  // Un área (lib/ai-cheap.ts, `errorDeCascada`): sin nada suyo, lo de D6b; con un error suyo, tiene IA (nunca «no hay ninguna IA»).
  assert.equal(R.errorAdentro, 'Con tu propio Claude, para armar los productos necesito tu clave de Claude o de OpenAI (en Integraciones).');
  assert.doesNotMatch(R.errorAdentroConSuyo, /No hay ninguna IA|Gemini/);
});

test('8. el onboarding no se rompe: adentro del contexto, el crédito de Claude de la plataforma sigue', () => {
  const c = R.enOnboardingConSuPc.archiveroTexto;
  // Rota: mover el corte de D6b de `chatCheapCascade` antes del crédito → esta prueba falla (El Archivero del onboarding
  // de un negocio que conectó su Claude quedaría sin IA).
  assert.ok(c.red.includes('api.anthropic.com'), `con el onboarding en curso, El Archivero tendría que probar el crédito de Claude (salió a: ${c.red.join(', ') || 'nada'})`);
  assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), []);
});
