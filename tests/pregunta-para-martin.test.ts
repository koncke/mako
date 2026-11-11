// =============================================================================
// A Martín sólo le llegan SUS decisiones (10/11/2026): el juez, sus cuatro fuentes y lo que ya había llegado
// =============================================================================
// Martín: «Me están llegando un montón de preguntas al Ops Center… Son preguntas técnicas… Que solamente me llegan las preguntas de
// decisiones importantes. Y nunca tiene que ser con lenguaje técnico que yo no entiendo». Esto fija:
//   1. el banco de preguntas REALES (tests/fixtures/preguntas-ops-center.json): cero de Martín perdidas, y las técnicas que caza;
//   2. la copia del cartero contesta lo mismo que lib/pregunta-para-martin.ts, sobre el banco y variantes;
//   3. el motivo nombra la palabra y dice qué hacer;
//   4. `cartero preguntar` (el REAL, con CARTERO_DIR en una carpeta temporal) rechaza la técnica sin guardarla y guarda la de Martín;
//   5. el hook de AskUserQuestion (el REAL) le pasa al chat ese motivo, no el «mandala a mano»;
//   6. lo que ya llegó: una técnica no sale en el bloque ni en el conteo, pero un AskUserQuestion técnico igual traba al chat;
//   7. la Ticketera: la técnica no espera ni se publica, y la de Martín sí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { FIRMA_DEL_JUEZ, juzgarPregunta, llegaAMartin, motivoParaElChat, type PreguntaAJuzgar } from '../lib/pregunta-para-martin';
import { esperaAMartinEnElChat, estaAbierta, type PreguntaChat } from '../lib/centro-preguntas-chat';
import { chatTrabadoEnLaApp, esperasPorChat, piezaParaLaApi, preguntasDeLaApp, preguntasParaElBloque, type LineaChat } from '../lib/centro-chats';
import { esperaAMartin, repartir, sanearPublicada, type Decision } from '../app/admin/runway/decisiones';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CARTERO = join(REPO, 'scripts', 'operaciones', 'cartero.mjs');
const HOOK = join(REPO, 'scripts', 'claude-hooks', 'guardia', 'sin-ask.mjs');
const LOCAL = 'local_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

type Entrada = PreguntaAJuzgar & { esperado: 'chat' | 'martin' | 'martin-reescribir' | 'escapa'; fuente: string };
const BANCO: Entrada[] = JSON.parse(readFileSync(join(REPO, 'tests', 'fixtures', 'preguntas-ops-center.json'), 'utf8')).preguntas;

test('1. el banco: ninguna de Martín se pierde, y las técnicas no le llegan', () => {
  assert.ok(BANCO.length >= 40, `el banco tiene ${BANCO.length}: no se leyó`);
  const deMartin = BANCO.filter((e) => e.esperado === 'martin' || e.esperado === 'martin-reescribir');
  const tecnicas = BANCO.filter((e) => e.esperado === 'chat');
  assert.ok(deMartin.length >= 20 && tecnicas.length >= 15, `${deMartin.length} de Martín y ${tecnicas.length} técnicas`);
  for (const e of deMartin) {
    const j = juzgarPregunta(e);
    assert.equal(j.llega, true, `«${e.pregunta}» (${e.fuente}) es de Martín y no le llega: ${JSON.stringify(j)}`);
    assert.equal(j.seAcepta, e.esperado === 'martin', `«${e.pregunta}»: ${e.esperado === 'martin' ? 'se acepta' : 'se pide reescribirla'} (${JSON.stringify(j)})`);
  }
  for (const e of tecnicas) {
    const j = juzgarPregunta(e);
    assert.equal(j.llega, false, `«${e.pregunta}» (${e.fuente}) es técnica y le llega a Martín: ${JSON.stringify(j)}`);
    assert.equal(j.seAcepta, false, `«${e.pregunta}» se aceptaría al preguntarla`);
  }
  // Las que se escapan se cuentan, no se exigen: si un día el juez las caza, se pasan a «chat».
  for (const e of BANCO.filter((x) => x.esperado === 'escapa')) assert.equal(juzgarPregunta(e).llega, true, `«${e.pregunta}» ya la caza: pasala a «chat»`);
  // Las cuatro de Martín, una por una (las que motivaron esto).
  assert.deepEqual(juzgarPregunta({ pregunta: '¿Arreglo los 2 rojos de tipos-ci-tiempo (CRLF) en otra punta?' }).jerga.sort(), ['CRLF', 'de tipos', 'punta', 'tipos-ci-tiempo'].sort());
  assert.equal(juzgarPregunta({ pregunta: '¿Liberás RAM para que corra el tsc acotado ahora?' }).hecho, 'Liberás RAM');
  assert.ok(juzgarPregunta({ pregunta: '¿Agrego {{pago_motivo}} con su propio alcance?' }).jerga.includes('{{pago_motivo}}'));
  assert.ok(!juzgarPregunta({ pregunta: '¿Agrego {{pago_motivo}} con su propio alcance?' }).tema, 'el «pago» de un nombre de variable no es un tema de plata');
  assert.equal(juzgarPregunta({ pregunta: '¿Conectás Chrome para que mire la pantalla?' }).hecho, 'Conectás Chrome');
});

test('1b. la jerga de una OPCIÓN también cuenta, y el tema rescata lo que ya llegó', () => {
  const conOpcion = { pregunta: '¿Cómo sigo?', opciones: [{ titulo: 'Lo subo a otra punta', detalle: null }, { titulo: 'Lo dejo', detalle: null }] };
  assert.equal(juzgarPregunta(conOpcion).llega, false);
  const dePlata = { pregunta: '¿Cobramos el plan a US$97?', opciones: [{ titulo: 'Sí', detalle: 'Cambia `lib/planes.ts`' }, { titulo: 'No', detalle: null }] };
  assert.equal(juzgarPregunta(dePlata).llega, true, 'una de plata con un archivo en el detalle se le sigue mostrando');
  assert.equal(juzgarPregunta(dePlata).seAcepta, false, 'pero al preguntarla se pide reescribirla');
});

test('2. la copia del cartero contesta lo mismo que lib/pregunta-para-martin.ts', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  const variantes: PreguntaAJuzgar[] = BANCO.flatMap((e) => [
    e,
    { ...e, contexto: 'Lo vi en `lib/x.ts` y en la rama punta/algo' },
    { ...e, opciones: [{ titulo: 'Sí, ahora', detalle: 'Corre el tsc y sube' }, { titulo: 'Mañana', detalle: null }] },
    { pregunta: e.pregunta.toUpperCase() },
    { pregunta: `¿Liberás RAM? ${e.pregunta}` },
  ]);
  for (const p of variantes) {
    assert.deepEqual(c.juzgarPregunta(p), juzgarPregunta(p), `distinto para «${p.pregunta}»`);
    assert.equal(c.motivoParaElChat(c.juzgarPregunta(p)), motivoParaElChat(juzgarPregunta(p)), `motivo distinto para «${p.pregunta}»`);
  }
});

test('3. el motivo nombra la palabra y dice qué hacer, en tú', () => {
  const jerga = motivoParaElChat(juzgarPregunta({ pregunta: '¿Hago el commit en otra punta?' }))!;
  assert.match(jerga, /«commit»/);
  assert.match(jerga, /decídela tú con la opción recomendada/);
  assert.match(jerga, /palabras de producto/);
  const hecho = motivoParaElChat(juzgarPregunta({ pregunta: '¿Te llegó el aviso?' }))!;
  assert.match(hecho, /puedes medir tú \(«Te llegó»\)/);
  const orden = motivoParaElChat(juzgarPregunta({ pregunta: '¿Sigo con la tanda 2?' }))!;
  assert.match(orden, /qué haces primero/);
  assert.equal(motivoParaElChat(juzgarPregunta({ pregunta: '¿Cobramos US$47 o US$97?' })), null);
  // Con el tema de Martín, se reescribe: nunca «decídela tú» sobre un precio (la revisión del 10/11/2026).
  const precio = motivoParaElChat(juzgarPregunta({ pregunta: '¿Subimos el Esencial a US$97? (hay que hacer deploy de /planes)' }))!;
  assert.match(precio, /decisión de Martín/);
  assert.match(precio, /No la decidas tú/);
  assert.doesNotMatch(precio, /decídela tú/);
  for (const m of [jerga, hecho, orden]) assert.doesNotMatch(m, /\b(?:decidila|vos|mandala|medilo)\b/i, `voseo en «${m}»`);
});

/** El cartero REAL, con su carpeta en un temporal (no sube nada). */
function correrCartero(dir: string, args: string[], extra: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CARTERO, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000,
    // Un env limpio (sin los GIT_* ni las claves de afuera); `as unknown as` porque ProcessEnv exige NODE_ENV (AGENTS.md).
    env: { PATH: process.env.PATH ?? '', HOME: dir, USERPROFILE: dir, CARTERO_DIR: dir, CLAUDE_CODE_HOST_SESSION_ID: LOCAL, ...extra } as unknown as NodeJS.ProcessEnv,
  });
}

test('4. `cartero preguntar` rechaza la técnica (sale con 3, no la guarda) y guarda la de Martín', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pregunta-para-martin-'));
  try {
    const tecnica = join(dir, 'tecnica.json');
    writeFileSync(tecnica, JSON.stringify({ pregunta: '¿Arreglo los 2 rojos de tipos-ci-tiempo (CRLF) en otra punta?', opciones: [{ titulo: 'Sí' }, { titulo: 'No' }], recomendada: 0 }));
    const r = correrCartero(dir, ['preguntar', tecnica]);
    assert.equal(r.status, 3, `salió ${r.status}: ${r.stderr}`);
    const o = JSON.parse(r.stdout);
    assert.equal(o.ok, false);
    assert.equal(o.rechazada, true);
    assert.match(o.motivo, /no le llega a Martín/);
    assert.match(r.stderr, /no le llega a Martín/, 'el motivo también por stderr');
    const preguntas = join(dir, 'preguntas');
    assert.equal(existsSync(preguntas) ? readdirSync(preguntas).length : 0, 0, 'la técnica no se guardó');
    const suya = join(dir, 'suya.json');
    writeFileSync(suya, JSON.stringify({ pregunta: '¿Subo hoy el instalador 0.3.2 de «MaKo en tu computadora»?', opciones: [{ titulo: 'Súbelo ya' }, { titulo: 'Lo subo yo' }], recomendada: 0 }));
    const r2 = correrCartero(dir, ['preguntar', suya]);
    assert.equal(r2.status, 0, r2.stderr);
    const o2 = JSON.parse(r2.stdout);
    assert.equal(o2.ok, true);
    assert.deepEqual(readdirSync(preguntas), [`${o2.id}.json`]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('5. el hook de AskUserQuestion le pasa al chat el motivo de la técnica', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'pregunta-hook-'));
  try {
    const proyecto = join(raiz, 'proyecto');
    const cartero = join(raiz, 'cartero');
    mkdirSync(proyecto); mkdirSync(cartero);
    const config = join(raiz, 'config.json');
    writeFileSync(config, JSON.stringify({ cwds: [proyecto] }));
    const correr = (questions: unknown[]) => spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000,
      input: JSON.stringify({ tool_name: 'AskUserQuestion', session_id: '11111111-2222-4333-8444-555555555555', tool_use_id: 'toolu_1', tool_input: { questions } }),
      env: {
        PATH: process.env.PATH ?? '', HOME: raiz, USERPROFILE: raiz, CLAUDE_PROJECT_DIR: proyecto, CLAUDE_CODE_HOST_SESSION_ID: LOCAL,
        CARTERO_DIR: cartero, MAKO_SIN_ASK_LIB: CARTERO, MAKO_SIN_ASK_CARTERO: CARTERO, MAKO_SIN_ASK_CONFIG: config,
        MAKO_SIN_ASK_LOG: join(raiz, 'guardia.log'), MAKO_SIN_ASK_DUP: join(raiz, 'dup'), MAKO_SIN_ASK_SESIONES: join(raiz, 'sesiones'),
      } as unknown as NodeJS.ProcessEnv,
    });
    const motivoDe = (r: ReturnType<typeof correr>) => JSON.parse(r.stdout).hookSpecificOutput as { permissionDecision: string; permissionDecisionReason: string };
    const tecnica = correr([{ question: '¿Liberás RAM para que corra el tsc acotado ahora?', header: 'RAM', options: [{ label: 'Sí (Recommended)' }, { label: 'No' }] }]);
    assert.equal(tecnica.status, 0, tecnica.stderr);
    const m = motivoDe(tecnica);
    assert.equal(m.permissionDecision, 'deny');
    assert.match(m.permissionDecisionReason, /no le llega a Martín/);
    assert.match(m.permissionDecisionReason, /NO la vuelvas a preguntar/);
    assert.doesNotMatch(m.permissionDecisionReason, /no se guardó|mandala/i, 'no es una falla del cartero');
    assert.equal(existsSync(join(cartero, 'preguntas')) ? readdirSync(join(cartero, 'preguntas')).length : 0, 0);
    // Una de Martín con jerga: se le pide reescribirla y mandarla con `preguntar`, nunca decidirla (la revisión del 10/11/2026).
    const precio = motivoDe(correr([{ question: '¿Subimos el Esencial a US$97? (hay que hacer deploy de /planes)', header: 'Precio', options: [{ label: 'Sí (Recommended)' }, { label: 'No' }] }]));
    assert.equal(precio.permissionDecision, 'deny');
    assert.match(precio.permissionDecisionReason, /Reescríbela sin lenguaje técnico y mándala con `.*preguntar`/);
    assert.doesNotMatch(precio.permissionDecisionReason, /NO la vuelvas a preguntar|decídela y sigue/);
    const suya = correr([{ question: '¿Cobramos US$47 o US$97 por el plan Esencial?', header: 'Precio', options: [{ label: 'US$47 (Recommended)' }, { label: 'US$97' }] }]);
    assert.match(motivoDe(suya).permissionDecisionReason, /YA QUEDÓ GUARDADA/);
    assert.equal(readdirSync(join(cartero, 'preguntas')).length, 1);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

const pregunta = (id: string, texto: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`, local: LOCAL, pregunta: texto, contexto: null,
  opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'No', detalle: null }], recomendada: 0, varias: false,
  at: '2026-11-10T12:00:00.000Z', respuesta: null, ...extra,
});
const lineaDe = (p: PreguntaChat): LineaChat => ({ tipo: 'pregunta', instante: Date.parse(p.at), pregunta: p, trabajo: null });

test('6. lo que ya llegó: la técnica sigue abierta para su chat, pero no espera a Martín (y un AskUserQuestion técnico igual traba)', () => {
  // El globito guardado se recuenta cuando cambian las reglas del juez: la regla del recuento es la FIRMA de sus listas, y lee TODOS
  // los chats del mapa, sin corte (la revisión del 10/11/2026).
  assert.match(FIRMA_DEL_JUEZ, /^[0-9a-z]+$/);
  const db = readFileSync(join(REPO, 'lib', 'centro-preguntas-chat-db.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(db, /export const REGLA_ABIERTAS = `para-martin-\$\{FIRMA_DEL_JUEZ\}`;/);
  assert.doesNotMatch(db, /Object\.keys\(mapa\)\.slice\(/, 'el recuento no corta');
  const tecnica = pregunta('1', '¿Hago el commit en otra punta?');
  const suya = pregunta('2', '¿Cobramos US$47 o US$97?');
  const askTecnica = pregunta('3', '¿Liberás RAM?', { origen: 'ask' });
  assert.equal(estaAbierta(tecnica), true);
  assert.equal(esperaAMartinEnElChat(tecnica), false);
  assert.equal(esperaAMartinEnElChat(suya), true);
  const lineas = [tecnica, suya, askTecnica].map(lineaDe);
  assert.deepEqual(preguntasParaElBloque(lineas).map((p) => p.id), [suya.id]);
  assert.deepEqual(preguntasDeLaApp(lineas), []);
  assert.equal(chatTrabadoEnLaApp(lineas), true, 'el chat sigue trabado en la app aunque Martín no vea la pregunta');
  // La API se lo dice al Cerebro.
  const api = piezaParaLaApi({ tipo: 'pregunta', instante: 0, pregunta: tecnica, trabajo: null } as never, 'CRM') as { para_el_chat?: boolean; abierta?: boolean };
  assert.equal(api.para_el_chat, true);
  const apiSuya = piezaParaLaApi({ tipo: 'pregunta', instante: 0, pregunta: suya, trabajo: null } as never, 'CRM') as { para_el_chat?: boolean };
  assert.equal(apiSuya.para_el_chat, undefined);
});

const decision = (id: number, preguntaTxt: string, extra: Partial<Decision> = {}): Decision => ({
  id, ref: `d-${id}`, chat: 'CRM', pregunta: preguntaTxt, opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }], destraba: null,
  contexto: null, recomendada: 'A', urgencia: 'criterio', href: null, orden: 100, respuesta: null, respuestaTexto: null, respondidaAt: null,
  recogidaAt: null, creadaAt: '2026-11-10T12:00:00.000Z', destino: LOCAL, ...extra,
});

test('7. la Ticketera: la técnica no espera (ni en el globito ni en el mazo) y no se publica; la de Martín, sí', () => {
  const tecnica = decision(1, '¿Arreglo los rojos de tipos en otra punta?');
  const suya = decision(2, '¿El semanal a los clientes va también por el grupo de MaKo?');
  assert.equal(esperaAMartin(tecnica), false);
  assert.equal(esperaAMartin(suya), true);
  assert.deepEqual(esperasPorChat([tecnica, suya], []), { [LOCAL]: 1 });
  const r = repartir([tecnica, suya]);
  assert.deepEqual(r.pendientes.criterio.map((d) => d.id), [2]);
  assert.deepEqual(r.ignoradas, [], 'una técnica no aparece como ignorada');
  const pub = (p: string) => sanearPublicada({ ref: 'una-ref', chat: 'CRM', pregunta: p, opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }] });
  const rechazada = pub('¿Hago el commit en otra punta?');
  assert.equal(rechazada.ok, false);
  assert.match(!rechazada.ok ? rechazada.motivo : '', /^una-ref: Esta pregunta no le llega a Martín/);
  assert.equal(pub('¿El semanal a los clientes va también por el grupo de MaKo?').ok, true);
  // Sin el texto (una prueba que sólo pasa la respuesta), espera como antes.
  assert.equal(esperaAMartin({ respuesta: null, ignoradaAt: null }), true);
  assert.equal(llegaAMartin({ pregunta: '' }), true);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 8/0; cada rotura aplicada sola y restaurada de memoria):
//   · `llega` sin el rescate del tema (`seAcepta || tema` → `seAcepta`)            → 5/3 (1, 1b, 2)
//   · sin la palabra «punta» en la lib                                            → 5/3 (1, 1b, 2)
//   · la lib con el push sin `(?<!un )` («¿Mandamos un push con la promo?»)        → 6/2 (1, 2)
//   · la lib con `liber…` sin la máquina de objeto                                → 6/2 (1, 2)
//   · la copia del cartero con el push sin `(?<!un )`                             → 7/1 (2)  (verde hasta sumar la trampa al banco)
//   · `cartero preguntar` guardando la técnica igual                              → 6/2 (4, 5)
//   · el hook sin la rama de `rechazada`                                          → 7/1 (5)
//   · el bloque con `estaAbierta` (sin el juez)                                   → 7/1 (6)
//   · «trabado» con la lista filtrada                                             → 7/1 (6)
//   · el globito (`esperaAMartinEnElChat`) sin el juez                            → 7/1 (6)
//   · la Ticketera: `esperaAMartin` sin el juez                                   → 7/1 (7)
//   · la Ticketera: `repartir` mandando a «ignoradas» lo que no espera            → 7/1 (7)
//   · la Ticketera: publicar sin el juez                                          → 7/1 (7)
// Y con lo que encontró la revisión (10/11/2026, base 8/0; el banco suma 10 casos):
//   · «otra rama» / «hooks» sueltos otra vez                                      → 6/2 (1, 2) cada una
//   · «seguimos» como orden, «conectás» sin la máquina                            → 6/2 (1, 2) cada una
//   · el tema también del contexto, o «grupo» suelto en el tema                   → 6/2 (1, 2) cada una
//   · el motivo sin la rama del tema («decídela tú» sobre un precio)              → 6/2 (2, 3)
//   · el hook decide también la de Martín                                         → 7/1 (5)
//   · la regla del recuento un texto fijo, o el recuento con corte                → 7/1 (6) cada una
