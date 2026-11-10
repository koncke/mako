// =============================================================================
// La computadora del cliente NUNCA atiende leads sola (22/10/2026, Martín; con ChatGPT, igual desde el 23/10/2026)
// =============================================================================
// Martín, al preguntarle por los términos de Anthropic sobre la suscripción en la PC del cliente (D6a): «No por ahora». La
// computadora del cliente se usa SÓLO para que cada dueño trabaje con SU IA, desde la app. NUNCA para atender leads solos,
// las 24 horas: ni las respuestas automáticas de WhatsApp, ni los AI Steps de Automations, ni la nutrición, ni los avisos, ni
// nada que corra solo hacia un lead. Ésos van por clave de API, o por el crédito donde está asignado (lib/credito-negocio.ts).
// Y el 23/10/2026, sobre su ChatGPT (Codex) en la PC: «Sí: ChatGPT en la computadora del cliente igual que Claude, sólo para
// que el dueño use su propio ChatGPT en su PC, nunca para atender leads solo». Por qué y las citas de los Terms de OpenAI:
// docs/hallazgos-ia.md, «ChatGPT en la PC: la misma regla que D6a».
//
// Medido el 23/10/2026 (un mapa de cinco agentes, docs/hallazgos-ia.md): un solo lugar crea turnos de PC (`encolarTurno`,
// lib/ia-pc.ts), lo llama un solo lugar (`turnoApp`, lib/mako-turno-app.ts), y a `turnoApp` lo llaman sólo cinco entradas con
// la sesión de una persona adentro. Pero eso solo era un test de NOMBRES: `turnoApp` le creía a la persona que le pasaban, y
// un cron que armara la del dueño llegaba a su PC. Desde ese día la sesión se mira ADENTRO del turno. Lo que fija:
//   1. a la PC (`encolarTurno`, `esperarALaPc`, un insert o un update a «esperando» en `ia_pc_turnos`) llega sólo
//      lib/mako-turno-app.ts, con UNA llamada a `encolarTurno`, dentro de `turnoApp`; y ninguna migración la toca;
//   2. a `turnoApp` (y a `turnoDelLead` / `turnoDelCrm`, que lo envuelven) lo llaman sólo esas entradas, con su sesión;
//   3. ninguna de ellas es un cron, un webhook, WhatsApp ni Automations;
//   4. el turno mira la sesión de ESTE pedido antes de leer la PC (`laPersonaEstaAdentro`): sin ella, ni se lee;
//   5. una PC contesta sólo con la IA que aceptó quien la conectó, y su turno vence cuando el chat deja de esperarlo;
//   7. el grupo de WhatsApp del DUEÑO (25/10/2026): el doer llega a la puerta SÓLO con `delGrupo` y el teléfono que manda
//      WhatsApp, y sólo si el lote es de una persona.
//
// 25/10/2026, Martín, por el audio de Florencia (ws21): «dijimos que todo eso se hace con la app de escritorio de MaKo y
// conectado a su claude o GPT». El grupo de MaKo del DUEÑO es él escribiéndole a SU MaKo, como el chat de la app: contesta con
// su computadora si quien escribe es quien la conectó (docs/conexiones-y-ayuda.md, decisión 2). El webhook no trae la cookie,
// así que la prueba es otra —el teléfono que manda WhatsApp, de UNA sola persona activa del negocio, y esa persona es quien
// conectó la PC— y la hace la PUERTA (`encolarTurno` con `delGrupo`, lib/ia-pc.ts; tests/ia-pc-puerta-grupo.test.ts). Lo
// que corre solo hacia un lead (las respuestas automáticas, Automations, la nutrición, los avisos, los crons) sigue sin llegar.
// Si necesitás otra entrada: que sea una PERSONA, y sumala acá con su porqué. Si corre sola, NO va a la PC.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTOR_PRUEBA_PC, CONSENTIMIENTO_DE, WS_PRUEBA_PC, actorDeSesion, iaDeLaPcConectada, laPersonaEstaAdentro } from '../lib/ia-pc-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
// Sólo los comentarios que EMPIEZAN una línea: un «/*» dentro de un texto (`accept="image/*"`, `'app/api/webhooks/*'`) se
// comía el código hasta el próximo «*/» y escondía lo que viniera (la refutación del 23/10). Un comentario a mitad de línea
// queda: a lo sumo, de más.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ES_CODIGO = /\.[cm]?[jt]sx?$/;
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (ES_CODIGO.test(n)) out.push(p);
  }
  return out;
}
// Todo el código que corre: no sólo app, lib y scripts (el mapa del 23/10 lo marcó), también .cjs/.cts/.jsx y supabase/ (las
// Edge Functions). Afuera: tests, docs y public (estáticos).
const CARPETAS = ['app', 'lib', 'scripts', 'extension', 'nativo', 'worker', 'supabase'].filter((d) => existsSync(join(RAIZ, d)));
const SUELTOS = readdirSync(RAIZ).filter((n) => ES_CODIGO.test(n) && statSync(join(RAIZ, n)).isFile());
let cache: Array<{ ruta: string; src: string }> | null = null;
const codigo = () => (cache ??= [...CARPETAS.flatMap((d) => archivos(join(RAIZ, d))), ...SUELTOS.map((n) => join(RAIZ, n))]
  .map((p) => ({ ruta: relative(RAIZ, p).replace(/\\/g, '/'), src: sinComentarios(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')) })));
const de = (ruta: string) => codigo().find((f) => f.ruta === ruta)!.src;
/** El cuerpo de una función exportada: desde su firma hasta la próxima función de primer nivel. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está ${firma}`);
  const fin = src.slice(i + firma.length).search(/\n(export )?(async )?function |\nexport const /);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
};

const ENTRADAS_DE_PERSONA: Record<string, RegExp> = {
  // El chat de la app (Ops Center, Second Brain) y el del teléfono: la persona de la sesión.
  'app/api/mako/chat/route.ts': /personaDelRequest\(\)/,
  'app/api/m/mako/route.ts': /personaDelRequest\(\)/,
  // El chat de MaKo en el CRM y el de la ficha del lead: la sesión ADENTRO, con el permiso de ver el CRM.
  'app/crm/mako-crm/chat-server.ts': /getUsuarioActual\(\)/,
  'lib/mako-analyst-lead.ts': /getUsuarioActual\(\)/,
  // La prueba de punta a punta que se corre A MANO (nadie la programa) y sólo en el ws3, el cliente de prueba.
  'scripts/ia-pc/probar-punta-a-punta.mts': /if \(WS !== 3\) \{ console\.error\('⛔ sólo en el ws3/,
  // La batería del Marketing CoPilot (9/11/2026), que se corre A MANO: sólo el ws 9 o uno de prueba, con una clave de chat de prueba
  // y sin `quien` (la persona no es nadie: no hay PC de ninguna persona a la que mandarle el turno).
  'scripts/probar-chats/copiloto.mts': /if \(!\[3, 4, 9\]\.includes\(WS\)\) throw new Error/,
};
// Los que envuelven a `turnoApp` con una persona ya armada: también se fija quién los llama (el mapa del 23/10).
const ENVOLTORIOS: Record<string, { de: string; llaman: string[] }> = {
  turnoDelLead: { de: 'lib/mako-analyst-lead.ts', llaman: ['app/api/crm/analyst/route.ts'] },
  turnoDelCrm: { de: 'app/crm/mako-crm/chat-server.ts', llaman: ['app/api/crm/mako/route.ts'] },
};

// Los que nombran la tabla de turnos fuera de lib/ia-pc.ts, SÓLO para leer (con su porqué). Cualquier otro, con cualquier
// comilla o en una variable, falla: se suma acá si de verdad sólo lee.
const LEEN_LOS_TURNOS: Record<string, string> = {
  'lib/tablas-de-inquilino.ts': 'la lista de tablas por negocio',
  'scripts/ia-pc/probar-punta-a-punta.mts': 'la prueba a mano del ws3 lee cómo quedaron sus turnos',
};

test('1. a la computadora del cliente llega sólo el turno del chat de la app, y una sola vez', () => {
  const tocan = codigo()
    .filter((f) => f.ruta !== 'lib/ia-pc.ts')
    .filter((f) => /\bencolarTurno\b|\besperarALaPc\b/.test(f.src))
    .map((f) => f.ruta);
  assert.deepEqual(tocan, ['lib/mako-doer-in.ts', 'lib/mako-turno-app.ts'], 'otra entrada manda turnos a la PC del cliente: si corre sola hacia un lead, no puede');
  // La tabla, por su nombre (no por cómo se la llama): cualquier comilla, una variable, un builder en otra línea.
  const nombran = codigo().filter((f) => f.ruta !== 'lib/ia-pc.ts' && /\bia_pc_turnos\b/.test(f.src)).map((f) => f.ruta).sort();
  assert.deepEqual(nombran, Object.keys(LEEN_LOS_TURNOS).sort(), 'otro archivo nombra la tabla de turnos de la PC');
  for (const ruta of Object.keys(LEEN_LOS_TURNOS)) {
    assert.doesNotMatch(de(ruta), /ia_pc_turnos[\s\S]{0,200}\.\s*(insert|upsert|update|delete|rpc)\(/, `${ruta} escribe los turnos de la PC`);
  }
  // En lib/ia-pc.ts: `encolarTurno` y `esperarALaPc` sólo en su definición (un envoltorio ahí, llamado desde un cron, no
  // pasa), un solo insert de turnos, y nada que vuelva un turno a «esperando».
  const ia = de('lib/ia-pc.ts');
  assert.equal((ia.match(/\bencolarTurno\b/g) ?? []).length, 1, 'lib/ia-pc.ts usa `encolarTurno` fuera de su definición');
  assert.equal((ia.match(/\besperarALaPc\b/g) ?? []).length, 1, 'lib/ia-pc.ts usa `esperarALaPc` fuera de su definición');
  assert.equal((ia.match(/ia_pc_turnos['"`]\)\s*\.\s*(insert|upsert)/g) ?? []).length, 1);
  assert.doesNotMatch(ia, /estado:\s*['"`]esperando/, 'un turno que vuelve a «esperando» se puede tomar otra vez');
  assert.doesNotMatch(ia, /\.rpc\(/);
  // En lib/mako-turno-app.ts, `encolarTurno` y `pcDe` sólo en el import y UNA vez dentro de `turnoApp` (un alias,
  // `(0, encolarTurno)(...)` o un `?? pcDe(...)` suman una mención).
  const turno = de('lib/mako-turno-app.ts');
  const delTurno = cuerpo(turno, 'export async function turnoApp(');
  for (const nombre of ['encolarTurno', 'pcDe']) {
    const re = new RegExp(`\\b${nombre}\\b`, 'g');
    assert.equal((turno.match(re) ?? []).length, 2, `lib/mako-turno-app.ts nombra \`${nombre}\` fuera del import y de su único uso`);
    assert.equal((delTurno.match(re) ?? []).length, 1, `\`${nombre}\` salió de \`turnoApp\``);
  }
  // Y ninguna migración nueva nombra los turnos de la PC: la 0320 los crea. Un trigger, una regla, un procedure o un pg_cron
  // que los toque falla acá.
  const migs = readdirSync(join(RAIZ, 'supabase/migrations')).filter((n) => n.endsWith('.sql'));
  const conTurnos = migs.filter((n) => /\bia_pc_turnos\b/.test(readFileSync(join(RAIZ, 'supabase/migrations', n), 'utf8')));
  assert.deepEqual(conTurnos, ['0320_ia_pc.sql'], 'una migración toca los turnos de la PC');
});

test('2. `turnoApp` (y lo que lo envuelve) lo llaman sólo las entradas con la sesión de una persona', () => {
  // Cualquier mención, no sólo `turnoApp(`: un alias (`{ turnoApp: t }`) o `.then(turnoApp)` también cuentan.
  const llaman = codigo()
    .filter((f) => f.ruta !== 'lib/mako-turno-app.ts' && /\bturnoApp\b/.test(f.src))
    .map((f) => f.ruta).sort();
  assert.deepEqual(llaman, Object.keys(ENTRADAS_DE_PERSONA).sort(), 'una entrada nueva llama al turno que usa la PC');
  for (const [ruta, sesion] of Object.entries(ENTRADAS_DE_PERSONA)) {
    assert.match(de(ruta), sesion, `${ruta} sin la sesión de la persona`);
  }
  for (const [nombre, { de: donde, llaman: quienes }] of Object.entries(ENVOLTORIOS)) {
    const usan = codigo()
      .filter((f) => f.ruta !== donde && new RegExp(`\\b${nombre}\\b`).test(f.src))
      .map((f) => f.ruta).sort();
    assert.deepEqual(usan, quienes, `${nombre} lo llama otra entrada: llega a \`turnoApp\` con una persona armada`);
  }
  // Un `after()` dentro de la ruta de la persona conserva su sesión (Next deja leer las cookies ahí): nada que llegue al turno
  // se cuelga de uno, para que nadie haga correr solo, después de responder, algo hacia un lead (la refutación del 23/10).
  for (const ruta of [...Object.keys(ENTRADAS_DE_PERSONA), ...Object.values(ENVOLTORIOS).flatMap((e) => [e.de, ...e.llaman]), 'lib/mako-turno-app.ts']) {
    assert.doesNotMatch(de(ruta), /\bafter\(/, `${ruta}: un after() al lado del turno que usa la PC`);
  }
  // Y dentro de lib/mako-turno-app.ts, nada más llama a `turnoApp` (un `turnoDeFondo` que lo envuelva, para un cron).
  const turno = de('lib/mako-turno-app.ts');
  // Fuera de los textos («turnoApp: mensaje vacío»): sólo la definición.
  assert.equal((turno.match(/(?<![\w'"`])turnoApp(?![\w:])/g) ?? []).length, 1, 'lib/mako-turno-app.ts usa `turnoApp` fuera de su definición');
});

test('3. ninguna es un cron, un webhook, WhatsApp ni Automations', () => {
  const rutas = ['lib/mako-turno-app.ts', ...Object.keys(ENTRADAS_DE_PERSONA), ...Object.values(ENVOLTORIOS).flatMap((e) => [e.de, ...e.llaman])];
  for (const ruta of rutas) {
    assert.doesNotMatch(ruta, /cron|webhook|whatsapp|evolution|automat|chatbot|nutricion|ai-step|flujo|aviso/i, ruta);
  }
});

test('4. el turno mira la sesión de ESTE pedido antes de leer la PC: sin ella (un cron, un webhook), ni la lee', () => {
  // Las reglas: la misma persona que arman las entradas; la prueba, sólo la de prueba del ws3.
  const ana = { email: 'ana@negocio.com', nombre: 'Ana', sub: '7' };
  assert.equal(laPersonaEstaAdentro(ana, { ws: 20, actor: 'ana@negocio.com' }), true);
  assert.equal(laPersonaEstaAdentro(null, { ws: 20, actor: 'ana@negocio.com' }), false, 'sin sesión llegó a la PC');
  assert.equal(laPersonaEstaAdentro({ email: 'beto@negocio.com', nombre: 'Beto', sub: '8' }, { ws: 20, actor: 'ana@negocio.com' }), false, 'otra persona llegó a la PC de Ana');
  assert.equal(laPersonaEstaAdentro({ email: '', nombre: '', sub: '' }, { ws: 20, actor: '' }), false, 'una sesión vacía coincidió con un actor vacío');
  assert.equal(laPersonaEstaAdentro({ email: '', nombre: 'Ana', sub: '7' }, { ws: 20, actor: 'Ana' }), true, 'sin email, el nombre (como las entradas)');
  assert.equal(laPersonaEstaAdentro(null, { ws: WS_PRUEBA_PC, actor: ACTOR_PRUEBA_PC }, true), true);
  assert.equal(laPersonaEstaAdentro(null, { ws: 20, actor: ACTOR_PRUEBA_PC }, true), false, 'la prueba sin sesión fuera del ws3');
  assert.equal(laPersonaEstaAdentro(null, { ws: WS_PRUEBA_PC, actor: 'ana@negocio.com' }, true), false, 'la prueba sin sesión con otra persona');
  assert.equal(actorDeSesion(null), null);
  // Las entradas arman el actor igual que `actorDeSesion`.
  assert.match(de('lib/mako-turno-app.ts'), /actor: sesion\.email \|\| sesion\.nombre \|\| sesion\.sub/);
  assert.match(de('app/crm/mako-crm/chat-server.ts'), /actor: sesion\.email \|\| sesion\.nombre \|\| sesion\.sub/);
  assert.match(de('lib/mako-analyst-lead.ts'), /actor: sesion\.email \|\| sesion\.nombre \|\| sesion\.sub/);
  // El turno: la sesión ANTES de leer la PC, y sin ella no la lee.
  const turno = cuerpo(de('lib/mako-turno-app.ts'), 'export async function turnoApp(');
  const mira = turno.indexOf('const adentro = laPersonaEstaAdentro(await getUsuarioActual().catch(() => null), persona, entrada.pruebaSinSesion === true);');
  assert.ok(mira > 0, 'el turno no mira la sesión del pedido');
  assert.ok(mira < turno.indexOf('let leidaPc = adentro ? await leerPc(iaDeLaPc) : { d: null, error: null };'), 'lee la PC sin mirar la sesión');
  assert.equal((turno.match(/\bleerPc\b/g) ?? []).length, 3, 'otra lectura de la PC (o `leerPc` pasado por otro lado)');
  // La PC que usa el turno es SÓLO la leída con la sesión: un `?? pcDe(...)` acá la leía sin ella (la refutación del 23/10).
  assert.match(turno, /const pc = leidaPc\.d;\n/, 'la PC del turno sale de otro lado que la lectura con la sesión');
  assert.match(turno, /if \(!ia && leidaPc\.d && !pcUsable\(leidaPc\.d, 'claude'\)\) \{/, 'Automático cae a su ChatGPT sólo desde una PC ya leída con la sesión');
  // La prueba a mano es la única que pasa `pruebaSinSesion`, con la persona de prueba.
  const conPrueba = codigo().filter((f) => /\bpruebaSinSesion\b/.test(f.src)).map((f) => f.ruta).sort();
  assert.deepEqual(conPrueba, ['lib/ia-pc.ts', 'lib/mako-turno-app.ts', 'scripts/ia-pc/probar-punta-a-punta.mts']);
  assert.match(de('scripts/ia-pc/probar-punta-a-punta.mts'), new RegExp(`const actor = '${ACTOR_PRUEBA_PC.replace(/\./g, '\\.')}';`));
});

test('5. una PC contesta sólo con la IA que aceptó quien la conectó, y su turno vence cuando el chat deja de esperarlo', () => {
  assert.equal(iaDeLaPcConectada(CONSENTIMIENTO_DE.chatgpt.version), 'chatgpt');
  assert.equal(iaDeLaPcConectada(CONSENTIMIENTO_DE.claude.version), 'claude');
  assert.equal(iaDeLaPcConectada(null), 'claude', 'las PC de antes del 21/10 no guardaron el texto: son de Claude');
  assert.equal(iaDeLaPcConectada('2027-01-01-chatgpt'), 'chatgpt', 'una versión nueva de ChatGPT dejaría a las PC conectadas sin su IA');
  assert.match(CONSENTIMIENTO_DE.chatgpt.version, /-chatgpt$/);
  assert.doesNotMatch(CONSENTIMIENTO_DE.claude.version, /-chatgpt$/);
  const ia = de('lib/ia-pc.ts');
  // Al leerla y al guardar su latido (lo que la ACTIVA para D6b): sólo las cuentas de su IA.
  assert.match(ia, /const COLUMNAS_PC = '[^']*\bconsentimiento\b[^']*';/);
  assert.match(ia, /const ia = iaDeLaPcConectada\(r\.consentimiento\);[\s\S]{0,300}cuentas: cuentasDeLaIA\(sanearCuentas\(r\.cuentas\), ia\)/);
  assert.match(ia, /const cuentas = cuentasDeLaIA\(sanearCuentas\(o\.cuentas\), d\.ia\);/);
  // Y la opción apagada no da el código con el texto de ChatGPT: ninguna PC puede ser de ChatGPT hasta que se prenda.
  assert.match(sinComentarios(readFileSync(join(RAIZ, 'app/api/ia-pc/codigo/route.ts'), 'utf8')), /if \(ia === 'chatgpt' && !CHATGPT_EN_LA_PC\) return/);
  // El turno vence con la espera del chat, nunca más tarde que TURNO_MS.
  assert.match(ia, /vence_at: new Date\(Date\.now\(\) \+ Math\.max\(0, Math\.min\(esperaMs, TURNO_MS\)\)\)\.toISOString\(\),/);
  const turno = cuerpo(de('lib/mako-turno-app.ts'), 'export async function turnoApp(');
  assert.match(turno, /const espera = esperaDelTurno\([^;]+;\s*const turnoPc = await encolarTurno\([\s\S]*?\}, espera, \{ pruebaSinSesion: [^}]+\}\);/, 'el turno de la PC vence a los 5 minutos aunque nadie lo espere');
});

test('6. la PUERTA mira la sesión: `encolarTurno` no le cree a quien la llama', () => {
  // Antes de tocar la base: la sesión de ESTE pedido tiene que ser la de quien conectó esa PC. Lo prueba de verdad
  // tests/ia-pc-varias.test.ts (`puerta`): sin sesión, con otra persona o con la prueba fuera del ws3, no encola.
  const ia = de('lib/ia-pc.ts');
  const puerta = cuerpo(ia, 'export async function encolarTurno(');
  const mira = puerta.indexOf('const sesion = await getUsuarioActual().catch(() => null);');
  const frena = puerta.indexOf("if (!laPersonaEstaAdentro(sesion, { ws: d.ws, actor: d.persona }, o.pruebaSinSesion === true)) {");
  assert.ok(mira > 0 && frena > mira, 'la puerta no mira la sesión');
  assert.ok(frena < puerta.indexOf('db()'), 'la puerta toca la base antes de mirar la sesión');
  assert.match(puerta, /throw new SinLaPersona\(/);
  assert.match(ia, /^import \{ getUsuarioActual \} from '\.\/auth';$/m);
  // El turno le pasa la prueba sólo como la recibió.
  assert.match(de('lib/mako-turno-app.ts'), /\}, espera, \{ pruebaSinSesion: entrada\.pruebaSinSesion === true \}\);/);
});

test('7. el grupo del DUEÑO llega a la puerta sólo con `delGrupo`, el teléfono que manda WhatsApp y un lote de una persona', () => {
  const doer = de('lib/mako-doer-in.ts');
  // Una sola llamada a la puerta y una sola espera, y la llamada trae `delGrupo`: sin eso miraría una cookie que el webhook no tiene.
  for (const nombre of ['encolarTurno', 'esperarALaPc']) {
    assert.equal((doer.match(new RegExp(`\\b${nombre}\\b`, 'g')) ?? []).length, 2, `el doer nombra \`${nombre}\` fuera del import y de su único uso`);
  }
  assert.match(doer, /await encolarTurno\(delGrupo\.pc, SESION_DEL_GRUPO, \{[^}]*\}, espera, \{ delGrupo: delGrupo\.email \? \{ email: delGrupo\.email \} : \{ telefono: delGrupo\.telefono \?\? '' \} \}\);/,
    'el doer llama la puerta sin `delGrupo`');
  // La PC y el teléfono salen de quién escribió según WhatsApp (`participant`), nunca de lo que dice el mensaje, y un lote de
  // varias personas no va.
  const busca = cuerpo(doer, 'async function pcDeQuienEscribe(');
  assert.match(busca, /if \(data\.loteDeVarios\) return null;/);
  assert.match(busca, /const telefono = telefonoDelParticipante\(data\.key\?\.participant\);/);
  assert.equal((doer.match(/\bpcDe\(/g) ?? []).length, 1, 'el doer busca una PC fuera de `pcDeQuienEscribe`');
  assert.ok(busca.includes('pcDe('), '`pcDe` salió de `pcDeQuienEscribe`');
  assert.match(doer, /\.\.\.\(autores\.size !== 1 \|\| autores\.has\(''\) \? \{ loteDeVarios: true \} : \{\}\),/, 'un lote de varias personas no queda marcado');
  // Y la puerta, para el grupo, no le cree al doer: mira el teléfono contra el perfil y contra quien conectó esa PC.
  const puerta = cuerpo(de('lib/ia-pc.ts'), 'export async function encolarTurno(');
  assert.match(puerta, /else if \(o\.delGrupo\) \{\s*if \(!\(await esLaPersonaDelGrupo\(d, o\.delGrupo\.telefono\)\)\) \{\s*throw new SinLaPersona\(/);
});

// 25/10/2026 (tanda 4 de docs/conexiones-y-ayuda.md): base 7 / 0; rotas, una por vez —el doer llama la puerta sin `delGrupo`,
// con el teléfono de lo que dice el mensaje, sin mirar el lote de varios, sin marcarlo, o con una segunda llamada a la PC—,
// las cinco caen en el 7.

// PROBADO ROMPIÉNDOLO (23/10/2026, con ia-pc-varias, chat-ia, ia-pc e ia-pc-proveedor; base 27/0). Los cuatro últimos AGREGAN
// un archivo (y lo borran):
//   · el turno no mira la sesión                                 → 26/1 (4)
//   · cualquier sesión (o ninguna) vale                          → 26/1 (4)
//   · la prueba sin sesión vale en cualquier negocio             → 26/1 (4)
//   · al leer la PC, cualquier IA                                → 24/3 (5; varias 2; chat-ia 2b)
//   · el latido guarda (y activa) con cualquier IA               → 25/2 (5; varias 2)
//   · sólo la versión de hoy del texto de ChatGPT                → 26/1 (5)
//   · el turno vence a los 5 minutos                             → 25/2 (5; varias 2)
//   · el turno no pasa su espera                                 → 25/2 (5; ia-pc)
//   · una segunda llamada a la PC en el turno, para un cron      → 26/1 (1)
//   · un cron que llama al turno con un alias                    → 26/1 (2)
//   · un webhook que usa turnoDelLead                            → 26/1 (2)
//   · otro archivo vuelve un turno a «esperando»                 → 26/1 (1)
//   · un trigger sobre los turnos de la PC                       → 26/1 (1)
