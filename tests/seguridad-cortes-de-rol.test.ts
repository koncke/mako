// =============================================================================
// Cortes de rol en las APIs (auditoría de seguridad, paquete g4, 14/10/2026)
// =============================================================================
// El proxy sólo pide SESIÓN para todo lo que no es /admin ni /metodo (proxy.ts, SOLO_ADMIN): el rol
// lo tiene que mirar cada ruta. Estas rutas no lo miraban, y sus pantallas sí (`requireRolWs([])`),
// así que un closer o un setter con su cookie hacía por la API lo que su pantalla le esconde:
//   · /api/perfil/destinatarios y /api/perfil (prefs): sumarse a los reportes del negocio;
//   · /api/ads-analyst/*: leer gasto por anuncio y ESCRIBIR ángulos, avatares, overrides, borradores;
//   · /api/landing-analyst/{analyze,sync}: correr IA y PISAR diagnósticos;
//   · /api/meta-health y sus cuatro hermanas: balance, gasto y el MEDIO DE PAGO de la cuenta;
//   · /api/mako-doer: pedirle a MaKo `metricas_negocio` y `analisis_negocio` (rolMinimo admin);
//   · /api/anthropic-usage: el admin de OTRO cliente leía y PISABA el saldo de Claude del ws1.
//
// Las rutas importan `server-only` (vía lib/workspace): no se pueden ejecutar desde un test. Se mira
// el FUENTE, sin comentarios, y se fija que el corte esté y que vaya ANTES de leer o escribir. Lo
// único que sí corre es la regla pura que usa el chat de escritorio (`entraAlChat`).
//
// Verificado rompiéndolo, 13 roturas de a una (11 tests; cada una se restauró a mano y volvió a 11 de 11):
//   · destinatarios: sin las dos líneas del corte en el POST                  → 1 falla, 10 pasan.
//   · perfil: el `if (getRolWsEfectivo() !== 'admin')` de prefs, fuera          → 1 falla, 10 pasan.
//   · ads-analyst: sin el corte en el DELETE de valorar                         → 1 falla, 10 pasan.
//   · ads-analyst/puerta.ts: `!== 'admin'` en vez de `=== 'admin'`              → 1 falla, 10 pasan.
//   · landing-analyst/sync: sin el corte                                         → 1 falla, 10 pasan.
//   · account-insights: el guardAdsWs DESPUÉS de conversorGastoMeta             → 1 falla, 10 pasan.
//   · mako-doer: `tools: [...MAKO_TOOLS, ...extra]` de nuevo                     → 1 falla, 10 pasan.
//   · mako-doer: `runTool` sin mirar `permitidas`                               → 1 falla, 10 pasan.
//   · anthropic-usage: el `: 'anthropic'` de la coerción de vuelta              → 1 falla, 10 pasan.
//   · anthropic-usage: sin el `if (ws == null) return` del POST                  → 1 falla, 10 pasan.
//   · anthropic-usage: claudeEsSuyo dejando escribir a la agencia metida en otro → 1 falla, 10 pasan.
//   · anthropic-usage: el GET con `...(await getUsageSummary())` crudo          → 1 falla, 10 pasan.
//   · anthropic-usage: veSaldoDeClaude con `return true` (lo ve cualquier admin) → 1 falla, 10 pasan.
//
// Correr: node --import tsx --test tests/seguridad-cortes-de-rol.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { entraAlChat } from '../lib/mako-turno-app-reglas';
import { tabsDeCapa, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: los de bloque, las líneas enteras de `//` y la cola `// …` de una línea con
 *  código (sólo detrás de `;`, `,` o una llave/paréntesis: no toca un `https://` dentro de un string). */
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([;,{}()\]])[ \t]+\/\/.*$/gm, '$1');
const fuente = (rel: string) => sinComentarios(leer(rel));

/** El cuerpo de una función de nivel 0 (`async function x(` o `export async function GET(`), sin la
 *  firma: desde la línea que sigue a `) {` hasta la `}` que cierra en la columna 0. */
function cuerpo(src: string, firma: string, que: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${que} (${firma}): el test dejó de mirar el archivo`);
  const abre = src.indexOf('{\n', i);
  const cierra = src.indexOf('\n}\n', abre);
  assert.ok(abre > 0 && cierra > abre, `no pude recortar ${que}`);
  return src.slice(abre + 2, cierra + 1);
}
/** Las primeras `n` sentencias (líneas no vacías, sin sangría) de un cuerpo. */
const primeras = (c: string, n: number) => c.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n);
const pos = (src: string, aguja: string, que: string) => {
  const i = src.indexOf(aguja);
  assert.ok(i >= 0, `no está ${que} (${aguja})`);
  return i;
};
const HANDLERS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const handlersDe = (src: string) => HANDLERS.filter((m) => src.includes(`export async function ${m}(`));

// ── 1. /api/perfil ───────────────────────────────────────────────────────────────────────────

test('/api/perfil/destinatarios: GET y POST cortan al que no es admin ANTES de leer o escribir', () => {
  const src = fuente('app/api/perfil/destinatarios/route.ts');
  for (const m of ['GET', 'POST'] as const) {
    assert.deepEqual(primeras(cuerpo(src, `export async function ${m}(`, `el ${m}`), 2),
      ['const cerrada = await soloAdmin();', 'if (cerrada) return cerrada;'],
      `el ${m} no arranca con el corte de rol: un setter se suma a los reportes del negocio`);
  }
  // La regla en POSITIVO: pasa el admin (getRolWsEfectivo da 'admin' también a la agencia), nadie más.
  assert.deepEqual(primeras(cuerpo(src, 'async function soloAdmin(', 'soloAdmin'), 3), [
    "if ((await getRolWsEfectivo()) === 'admin') return null;",
    "return Response.json({ ok: false, error: 'Solo el admin de la cuenta puede configurar los destinatarios.' }, { status: 403 });",
  ]);
});

test('/api/perfil: las preferencias del workspace (prefs) son sólo del admin; el perfil propio no', () => {
  const post = cuerpo(fuente('app/api/perfil/route.ts'), 'export async function POST(', 'el POST');
  const prefs = post.slice(pos(post, "if (body.action === 'prefs' && body.prefs) {", 'la rama de prefs'));
  const corte = pos(prefs, "if ((await getRolWsEfectivo()) !== 'admin') {", 'el corte de rol de prefs');
  assert.ok(corte < pos(prefs, 'await setNotifPrefs(', 'la escritura'), 'el corte va DESPUÉS de escribir');
  assert.match(prefs.slice(corte, prefs.indexOf('await setNotifPrefs(')), /status: 403/);
  assert.equal(post.split('setNotifPrefs(').length - 1, 1, 'hay otra escritura de prefs fuera del corte');
  // El GET queda abierto a propósito: el Sidebar de todos los roles lee el nombre y la foto ahí.
  const perfil = post.slice(0, pos(post, "if (body.action === 'prefs'", 'la rama de prefs'));
  assert.doesNotMatch(perfil, /getRolWsEfectivo/, 'el perfil PROPIO (nombre, foto) no lleva corte de rol');
});

// ── 2. /api/ads-analyst/* ────────────────────────────────────────────────────────────────────

test('/api/ads-analyst/*: TODO handler de TODA ruta arranca con la puerta (una ruta nueva nace cerrada)', () => {
  const base = 'app/api/ads-analyst';
  const rutas = (readdirSync(join(RAIZ, base), { recursive: true }) as string[])
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => p.endsWith('route.ts'));
  assert.ok(rutas.length >= 9, `esperaba las 9 rutas de ads-analyst y encontré ${rutas.length}`);
  let n = 0;
  for (const r of rutas) {
    const src = fuente(`${base}/${r}`);
    assert.match(src, /import \{ soloAdminAdsAnalyst \} from '(\.\.\/)+puerta';/, `${r} no importa la puerta`);
    const hs = handlersDe(src);
    assert.ok(hs.length > 0, `${r} no tiene handlers: el test dejó de mirarlo`);
    for (const m of hs) {
      assert.deepEqual(primeras(cuerpo(src, `export async function ${m}(`, `${r} ${m}`), 2),
        ['const cerrada = await soloAdminAdsAnalyst();', 'if (cerrada) return cerrada;'],
        `${r} ${m}: no arranca con la puerta de Ads Analyst`);
      n++;
    }
  }
  assert.ok(n >= 12, `esperaba los 12 handlers y encontré ${n}`);
});

test('ads-analyst/puerta.ts: pasan la agencia y el admin del workspace, y NADIE más', () => {
  const c = cuerpo(fuente('app/api/ads-analyst/puerta.ts'), 'export async function soloAdminAdsAnalyst(', 'la puerta');
  assert.deepEqual(primeras(c, 3), [
    'if ((await getSesionAdmin()) != null) return null;',
    "if ((await getRolWsEfectivo()) === 'admin') return null;",
    "return Response.json({ ok: false, error: 'Solo el admin de la cuenta' }, { status: 403 });",
  ]);
});

// ── 3. /api/landing-analyst/{analyze,sync} ───────────────────────────────────────────────────

test('/api/landing-analyst/analyze y /sync: la misma puerta que /view y /mapa, antes de la IA', () => {
  for (const r of ['app/api/landing-analyst/analyze/route.ts', 'app/api/landing-analyst/sync/route.ts']) {
    const c = cuerpo(fuente(r), 'export async function POST(', `${r} POST`);
    assert.deepEqual(primeras(c, 3), [
      "if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {",
      "return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });",
      '}',
    ], `${r}: el POST no arranca con el corte de admin`);
  }
});

// ── 4. Los insights de Meta ──────────────────────────────────────────────────────────────────

test('meta-health, ad-, account-, entity-insights y meta-recommendations: guardAdsWs ANTES de tocar Meta', () => {
  for (const r of ['meta-health', 'ad-insights', 'account-insights', 'entity-insights', 'meta-recommendations']) {
    const src = fuente(`app/api/${r}/route.ts`);
    assert.match(src, /import \{ guardAdsWs \} from '@\/lib\/ads-guard';/, `${r} no importa guardAdsWs`);
    assert.deepEqual(handlersDe(src), ['GET'], `${r}: cambió la lista de handlers, revisá el corte de cada uno`);
    assert.deepEqual(primeras(cuerpo(src, 'export async function GET(', `${r} GET`), 2),
      ['const no = await guardAdsWs();', 'if (no) return no;'],
      `${r}: el GET no arranca con guardAdsWs (un closer lee balance, gasto y la tarjeta de la cuenta)`);
  }
});

// ── 5. /api/mako-doer ────────────────────────────────────────────────────────────────────────

test('/api/mako-doer: las de siempre pasan por entraAlChat y runTool rechaza lo que no viajó', () => {
  const src = fuente('app/api/mako-doer/route.ts');
  assert.match(src, /import \{ entraAlChat \} from '@\/lib\/mako-turno-app-reglas';/);
  const t = cuerpo(src, 'async function herramientasDelTurno(', 'herramientasDelTurno');
  assert.match(t, /const \[ws, rolWs\] = await Promise\.all\(\[getWorkspaceActual\(\), getRolWsEfectivo\(\)\]\);/);
  assert.match(t, /const rol = rolWs === 'admin' \? 'admin' : 'miembro';/);
  assert.match(t, /const vista = await vistaDe\(ctx\);/);
  assert.match(t, /const propias = MAKO_TOOLS\.filter\(\(t\) => entraAlChat\(t\.name, vista\)\);/,
    'MAKO_TOOLS no pasa por la vista: un closer recibe metricas_negocio');
  assert.doesNotMatch(t, /\.\.\.MAKO_TOOLS/, 'MAKO_TOOLS volvió a viajar entero');
  // La ÚNICA lista sin filtrar: la agencia sin workspace, como estaba.
  assert.equal(t.split('tools: MAKO_TOOLS').length - 1, 1, 'MAKO_TOOLS sin filtrar aparece más de una vez');
  assert.match(t, /if \(ws == null\) \{\s*if \(rol === 'admin'\) return \{ tools: MAKO_TOOLS, runTool: runMakoTool \};/,
    'la lista sin filtrar ya no está atada a la agencia sin workspace');
  assert.equal(t.split('return soloLasQueViajan(').length - 1, 2, 'hay un camino que devuelve herramientas sin soloLasQueViajan');

  const s = cuerpo(src, 'function soloLasQueViajan(', 'soloLasQueViajan');
  assert.match(s, /const permitidas = new Set\(tools\.map\(\(t\) => t\.name\)\);/);
  assert.match(s, /permitidas\.has\(name\)\s*\?\s*correr\(name, input\)\s*:\s*\{ content: JSON\.stringify\(\{ ok: false, [^\n]*isError: true \}/,
    'runTool corre lo que el modelo pida aunque no haya viajado');
});

/** Los NOMBRES de MAKO_TOOLS. lib/mako-tools.ts lleva `server-only`: se los pide a un node aparte
 *  con la condición del server (el mismo truco que tests/agenda-whatsapp.test.ts). */
function nombresDeSiempre(): string[] {
  const url = JSON.stringify(pathToFileURL(join(RAIZ, 'lib/mako-tools.ts')).href);
  const codigo = `import { MAKO_TOOLS } from ${url}; process.stdout.write(JSON.stringify(MAKO_TOOLS.map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}

test('entraAlChat (la regla que usa el chat de escritorio): el admin conserva todo, el miembro no ve las métricas', () => {
  const nombres = nombresDeSiempre();
  assert.ok(nombres.includes('metricas_negocio') && nombres.includes('analisis_negocio'), 'MAKO_TOOLS cambió: revisá este test');
  const vista = (rol: Vista['rol'], tabs: Vista['tabs']): Vista => ({ canal: 'app', alcance: 'lectura', ws: 9, rol, tabs });
  const completo = tabsDeCapa('completo');
  // El admin con la capa completa: las de siempre, TODAS (el arreglo no le saca nada al usuario legítimo).
  assert.deepEqual(nombres.filter((n) => !entraAlChat(n, vista('admin', completo))), []);
  // El closer o el setter: sin las dos que el registro reserva al admin.
  const delMiembro = nombres.filter((n) => entraAlChat(n, vista('miembro', completo)));
  for (const n of ['metricas_negocio', 'analisis_negocio']) assert.ok(!delMiembro.includes(n), `${n} le llega a un closer`);
  assert.ok(delMiembro.includes('buscar_leads'), 'el miembro perdió también lo que sí puede usar');
  // Sin workspace (la vista fail-closed de la ruta, sin tabs): algo viaja, nada reservado al admin.
  const sinWs = nombres.filter((n) => entraAlChat(n, { canal: 'app', alcance: 'lectura', ws: 0, rol: 'miembro', tabs: [] }));
  assert.ok(sinWs.length > 0, 'sin workspace no viaja ninguna: chatClaudeTools recibiría una lista vacía');
  assert.ok(!sinWs.includes('metricas_negocio') && !sinWs.includes('analisis_negocio'));
});

// ── 6. /api/anthropic-usage ──────────────────────────────────────────────────────────────────

const USAGE = 'app/api/anthropic-usage/route.ts';

test('/api/anthropic-usage POST: el proveedor se valida en positivo, sin caer a «anthropic»', () => {
  const src = fuente(USAGE);
  assert.match(src, /const CON_SALDO: readonly string\[\] = \['anthropic', 'openai', 'gemini'\];/);
  const post = cuerpo(src, 'export async function POST(', 'el POST');
  assert.doesNotMatch(post, /:\s*'anthropic'\s*;/, 'volvió la coerción: un provider desconocido escribe el saldo de Claude');
  assert.match(post, /const provider = typeof body\.provider === 'string' && CON_SALDO\.includes\(body\.provider\) \? body\.provider : null;/);
  const corte = pos(post, 'if (!provider) return Response.json(', 'el 400 del proveedor');
  assert.match(post.slice(corte, post.indexOf('\n', corte)), /status: 400/);
});

test('/api/anthropic-usage POST: una escritura nunca cae a OWNER_WS (ni sin workspace ni con el Claude ajeno)', () => {
  const src = fuente(USAGE);
  const post = cuerpo(src, 'export async function POST(', 'el POST');
  const primeraEscritura = Math.min(pos(post, 'await agregarCarga(', 'agregarCarga'), pos(post, 'await setSaldo(', 'setSaldo'));
  assert.ok(pos(post, 'if (ws == null) return Response.json(', 'el corte sin workspace') < primeraEscritura,
    'sin workspace se escribe: lib/anthropic-usage.ts lo manda al ws1');
  const ajeno = pos(post, "if (provider === 'anthropic' && !(await claudeEsSuyo(ws))) {", 'el corte del Claude ajeno');
  assert.ok(ajeno < primeraEscritura, 'el saldo de Claude ajeno se escribe antes del corte');
  assert.match(post.slice(ajeno, primeraEscritura), /status: 403/);
  // De quién es el Claude: el ws1, o un workspace con SU key. Para ESCRIBIR no hay excepción de agencia.
  assert.deepEqual(primeras(cuerpo(src, 'async function claudeEsSuyo(', 'claudeEsSuyo'), 3), [
    'if (ws === OWNER_WS) return true;',
    "return !!(await credDelCliente('ANTHROPIC_API_KEY', ws).catch(() => null));",
  ]);
});

test('/api/anthropic-usage: GET y POST contestan sin el saldo de Claude que quien pide no ve', () => {
  const src = fuente(USAGE);
  assert.doesNotMatch(src, /\.\.\.\(await getUsageSummary\(\)\)/, 'una respuesta devuelve el resumen crudo, con el saldo del ws1');
  for (const m of ['GET', 'POST'] as const) {
    const c = cuerpo(src, `export async function ${m}(`, `el ${m}`);
    assert.match(c, /const \[u, ve\] = await Promise\.all\(\[getUsageSummary\(\), veSaldoDeClaude\(ws\)\]\);/, `el ${m}`);
    assert.match(c, /return Response\.json\(\{ ok: true, \.\.\.sinSaldoAjeno\(u, ve\) \}\);/, `el ${m}`);
  }
  // Lo ve la agencia (la key compartida es suya) o el workspace del que es; nadie más.
  assert.deepEqual(primeras(cuerpo(src, 'async function veSaldoDeClaude(', 'veSaldoDeClaude'), 3), [
    'if ((await getSesionAdmin()) != null) return true;',
    'return ws != null && claudeEsSuyo(ws);',
  ]);
  const s = cuerpo(src, 'function sinSaldoAjeno(', 'sinSaldoAjeno');
  assert.match(s, /if \(ve\) return u;/);
  assert.match(s, /saldo: null,\s*restanteUsd: null,/);
  assert.match(s, /p\.provider === 'anthropic' \? \{ \.\.\.p, saldo: null, restanteUsd: null \} : p/);
});

// ── 7. El cierre de la revisión (lo que los revisores encontraron abierto) ───────────────────

const DOER = 'app/api/mako-doer/route.ts';

test('/api/mako-doer: el chat de un closer o setter es SUYO (`mako-doer:u<id>`), el de un admin el del workspace', () => {
  const src = fuente(DOER);
  assert.deepEqual(primeras(cuerpo(src, 'async function quienPide(', 'quienPide'), 3), [
    'const [rolWs, sesion] = await Promise.all([getRolWsEfectivo(), getUsuarioActual()]);',
    "const admin = rolWs === 'admin';",
    "return { admin, clave: admin ? CHART_KEY : `${CHART_KEY}:u${sesion?.sub ?? 'sin-sesion'}` };",
  ]);
  assert.deepEqual(primeras(cuerpo(src, 'async function puedeAbrir(', 'puedeAbrir'), 3), [
    'if (q.admin) return true;',
    'const s = Number.isInteger(sessionId) && sessionId > 0 ? await getSession(sessionId) : null;',
    'return !!s && s.chart_key === q.clave;',
  ], 'puedeAbrir dejó de exigir que el chat sea de quien pide');
  // Crear y listar usan la clave de quien pide; la clave del workspace pelada ya no lista ni crea.
  assert.match(cuerpo(src, 'async function crearYSaludar(', 'crearYSaludar'), /createSession\(q\.clave, null, ''\)/);
  assert.doesNotMatch(src, /listSessions\(CHART_KEY/, 'un listado volvió a la clave del workspace: el closer ve los chats del admin');
  assert.doesNotMatch(src, /createSession\(CHART_KEY/, 'un alta volvió a la clave del workspace');
});

test('/api/mako-doer GET: `?all`, `?sessionId` y `?chartKey` no abren el chat de otro', () => {
  const get = cuerpo(fuente(DOER), 'export async function GET(', 'el GET');
  assert.match(get, /if \(sp\.get\('all'\)\) return Response\.json\(\{ sessions: q\.admin \? await listAllSessions\(arch\) : await listSessions\(q\.clave, arch\) \}\);/,
    '?all le devuelve a un closer la lista de todos');
  const leer = pos(get, 'await getSessionMessages(Number(sessionId))', 'la lectura de mensajes');
  assert.ok(pos(get, 'if (!(await puedeAbrir(Number(sessionId), q))) return', 'el corte de ?sessionId') < leer,
    '?sessionId lee los mensajes antes de mirar de quién es');
  const listar = pos(get, 'await listSessions(chartKey, arch)', 'el listado por chartKey');
  assert.ok(pos(get, 'if (!q.admin && chartKey !== q.clave) return', 'el corte de ?chartKey') < listar,
    '?chartKey lista los chats de otro');
});

test('/api/mako-doer POST: send/rename/pin/archive/delete por id pasan por puedeAbrir ANTES de la primera acción', () => {
  const post = cuerpo(fuente(DOER), 'export async function POST(', 'el POST');
  const corte = pos(post, 'if (body.sessionId != null && !(await puedeAbrir(Number(body.sessionId), q))) {', 'el corte por id');
  assert.ok(corte < pos(post, "if (action === '", 'la primera acción'), 'una acción corre antes del corte');
  assert.ok(pos(post, 'const q = await quienPide();', 'quienPide') < corte);
});

test('el system prompt de un closer o setter va SIN los números del trimestre (escritorio y teléfono)', () => {
  const ctx = fuente('lib/mako-context.ts');
  assert.match(ctx, /const objetivosTxt = opts\.sinNumerosDelNegocio \? '' : await objetivosContextoTexto\(\)\.catch\(\(\) => ''\);/);
  assert.equal(ctx.split('objetivosContextoTexto(').length - 1, 1, 'hay otra lectura del avance del trimestre fuera de la opción');
  const doer = fuente(DOER);
  assert.match(cuerpo(doer, 'async function buildDoerSystem(', 'buildDoerSystem'), /sinNumerosDelNegocio: !opts\.admin/);
  // Cada armado del system dice de quién es: un `buildDoerSystem` sin `admin:` no compila, y éste
  // cuenta que todos lo tomen de quien pide.
  assert.equal(doer.split('await buildDoerSystem(').length - 1, doer.split('admin: q.admin }').length - 1,
    'un armado del system no pasa el rol de quien pide');
  assert.match(fuente('lib/mako-turno-app.ts'), /buildSystemPrompt\(\{[^\n]*sinNumerosDelNegocio: persona\.rol !== 'admin' \}\)/,
    'el teléfono le cuenta la plata a un closer');
});

test('chart-chats: la lista de «todos los chats» no mezcla los del doer de cada persona', () => {
  const c = cuerpo(fuente('lib/chart-chats.ts'), 'export async function listAllSessions(', 'listAllSessions');
  assert.match(c, /\.neq\('chart_key', 'mako-doer'\)\.not\('chart_key', 'like', 'mako-doer:%'\)/);
});

test('pulso, regenerate-transcript y perfil/plantilla: el corte de admin antes de leer, pagar o escribir', () => {
  const ADMIN = [
    "if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {",
    "return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });",
    '}',
  ];
  const pulso = fuente('app/api/landing-analyst/pulso/route.ts');
  assert.deepEqual(handlersDe(pulso), ['GET']);
  assert.deepEqual(primeras(cuerpo(pulso, 'export async function GET(', 'pulso GET'), 3), ADMIN,
    'pulso: un closer lee lo que midió el Pixel');

  const regen = fuente('app/api/regenerate-transcript/route.ts');
  assert.deepEqual(handlersDe(regen), ['POST']);
  const post = cuerpo(regen, 'export async function POST(', 'regenerate POST');
  const corte = pos(post, ADMIN[0], 'el corte de admin');
  assert.ok(corte < pos(post, 'if (!(await esWorkspaceDueno()))', 'esWorkspaceDueno'),
    'regenerate-transcript: el corte va después de esWorkspaceDueno, que lo pasa cualquier closer del ws1');
  assert.doesNotMatch(post.slice(0, corte), /fetch\(|transcrib|openai|from\('ad_transcripts'\)/i, 'algo paga o escribe antes del corte');

  const plant = fuente('app/api/perfil/plantilla/route.ts');
  assert.deepEqual(handlersDe(plant), ['GET', 'POST']);
  assert.deepEqual(primeras(cuerpo(plant, 'async function noEsAdmin(', 'noEsAdmin'), 1),
    ["return (await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin';"]);
  for (const m of ['GET', 'POST'] as const) {
    assert.equal(primeras(cuerpo(plant, `export async function ${m}(`, `plantilla ${m}`), 1)[0],
      "if (await noEsAdmin()) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });",
      `perfil/plantilla ${m}: un closer crea la plantilla del negocio y la manda a Meta`);
  }
});
