// Prueba de ~/.claude/guardia/sin-ask.mjs. Uso: node sin-ask-prueba.mjs [ruta del hook]
// El camino feliz corre el cartero REAL con CARTERO_DIR en una carpeta temporal (no sube nada: sólo escribe ahí). Las fallas,
// con carteros falsos. Lección de la revisión del 24/10: un falso que imprime distinto que el real escondió la falla grande.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HOOK = process.argv[2] || path.join(os.homedir(), '.claude', 'guardia', 'sin-ask.mjs');
const REAL = path.join(os.homedir(), '.claude', 'operaciones', 'cartero.mjs');
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'sin-ask-prueba-'));
const proyecto = path.join(raiz, 'proyecto');
const afuera = path.join(raiz, 'afuera');
fs.mkdirSync(proyecto); fs.mkdirSync(afuera);
const config = path.join(raiz, 'config.json');
fs.writeFileSync(config, JSON.stringify({ cwds: [proyecto] }));
const sesiones = path.join(raiz, 'sesiones');
const CLI = '11111111-2222-4333-8444-555555555555';
const LOCAL = 'local_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
fs.mkdirSync(path.join(sesiones, 'cuenta', 'sub'), { recursive: true });
fs.writeFileSync(path.join(sesiones, 'suelto.txt'), 'un archivo suelto no corta la búsqueda');
fs.writeFileSync(path.join(sesiones, 'cuenta', 'sub', `${LOCAL}.json`), JSON.stringify({ sessionId: LOCAL, cliSessionId: CLI, title: 'x' }));
fs.writeFileSync(path.join(sesiones, 'cuenta', 'sub', 'local_roto.json'), '{no es json');
const carteroDir = path.join(raiz, 'cartero');
const log = path.join(raiz, 'guardia.log');
const dup = path.join(raiz, 'dup');
const registro = path.join(raiz, 'registro.jsonl');
const falso = (nombre, cuerpo) => { const f = path.join(raiz, nombre); fs.writeFileSync(f, cuerpo); return f; };
const FALLA = falso('cartero-falla.mjs', `console.error('Error: algo se rompió adentro'); process.exit(1);`);
const LENTO = falso('cartero-lento.mjs', `setTimeout(() => {}, 30000);`);
const CUENTA = falso('cartero-cuenta.mjs', `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(registro)}, process.argv[2] + '\\n'); console.log(JSON.stringify({ ok: true, id: 'x' }, null, 2));`);

const ASK = {
  questions: [
    { question: '¿Subo el tren ahora?', header: 'Tren', multiSelect: false,
      options: [{ label: 'Sí, ahora (Recommended)', description: 'Sale en 10 minutos.' }, { label: 'Mañana', description: 'Espera.' }] },
    { question: '¿Qué canales?', header: 'Canales', multiSelect: true,
      options: [{ label: 'WhatsApp', description: '' }, { label: 'Email' }, { label: 'Instagram' }] },
  ],
};

const guardadas = () => {
  const d = path.join(carteroDir, 'preguntas');
  return fs.existsSync(d) ? fs.readdirSync(d).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : [];
};
function limpiar() { for (const d of [carteroDir, dup]) fs.rmSync(d, { recursive: true, force: true }); fs.rmSync(registro, { force: true }); }

function correr(entrada, env = {}, { limpio = true } = {}) {
  if (limpio) limpiar();
  const base = { ...process.env };
  for (const k of ['CLAUDE_CODE_HOST_SESSION_ID', 'CLAUDE_PROJECT_DIR', 'CLAUDE_CODE_SESSION_ID', 'MAKO_SIN_ASK_CARTERO']) delete base[k];
  const t = Date.now();
  const r = spawnSync(process.execPath, [HOOK], {
    input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada), encoding: 'utf8', timeout: 60_000,
    env: { ...base, CARTERO_DIR: carteroDir, MAKO_SIN_ASK_LIB: REAL, MAKO_SIN_ASK_CONFIG: config, MAKO_SIN_ASK_SESIONES: sesiones, MAKO_SIN_ASK_LOG: log, MAKO_SIN_ASK_DUP: dup, ...env },
  });
  let salida = null;
  try { salida = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch { salida = { crudo: r.stdout }; }
  return { status: r.status, salida, ms: Date.now() - t, stderr: r.stderr };
}

let fallas = 0;
const ok = (cond, nombre, extra) => { if (cond) console.log(`  ✓ ${nombre}`); else { fallas++; console.log(`  ✗ ${nombre}`, extra === undefined ? '' : JSON.stringify(extra).slice(0, 600)); } };
const decision = (r) => r.salida?.hookSpecificOutput?.permissionDecision;
const motivo = (r) => r.salida?.hookSpecificOutput?.permissionDecisionReason ?? '';
const HOST = 'local_99999999-8888-4777-8666-555555555555';

console.log('1. Dos preguntas con el cartero REAL (aislado): quedan guardadas y el motivo trae sus ids');
let r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: path.join(proyecto, 'sub'), tool_use_id: 'toolu_1', tool_input: ASK }, { CLAUDE_CODE_HOST_SESSION_ID: HOST });
let g = guardadas();
ok(r.status === 0 && decision(r) === 'deny', 'niega la herramienta', r);
ok(g.length === 2 && g.every((q) => q.local === HOST), 'dos preguntas guardadas, del chat del entorno', g);
ok(g.every((q) => motivo(r).includes(`[pregunta ${q.id}]`)), 'el motivo trae los ids de las que quedaron guardadas', motivo(r));
ok(/YA QUEDÓ GUARDADA/.test(motivo(r)) && /terminá el turno/.test(motivo(r)) && !/NO se guardaron/.test(motivo(r)), 'dice que quedó guardada y que termine el turno', motivo(r));
const tren = g.find((q) => /tren/.test(q.pregunta)); const canales = g.find((q) => /canales/.test(q.pregunta));
ok(tren?.recomendada === 0 && tren?.opciones[0].titulo === 'Sí, ahora' && tren?.contexto === 'Tren', 'recomendada sin «(Recommended)», el header de contexto', tren);
ok(canales?.varias === true && canales?.recomendada == null && !canales?.opciones[0].detalle, 'multiSelect → varias; sin recomendada; descripción vacía afuera', canales);
ok(/cartero\.mjs" (preguntar|retirar)/.test(motivo(r)) && !/~\//.test(motivo(r).replace(/~\/\.claude\/operaciones\/preguntas/, '')), 'los comandos van con la ruta entera, sin «~»', motivo(r));

console.log('2. La misma pregunta otra vez (reintento del modelo): no se guarda de nuevo, mismo id');
const idTren = tren?.id;
const antes = guardadas().length;
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: { questions: [ASK.questions[0]] } }, { CLAUDE_CODE_HOST_SESSION_ID: HOST }, { limpio: false });
ok(guardadas().length === antes && motivo(r).includes(`[pregunta ${idTren}]`), 'devuelve el id de la primera sin guardar otra', { antes, ahora: guardadas().length, m: motivo(r) });

console.log('3. Sin la sesión en el entorno: la busca por el cliSessionId (con un archivo suelto en la carpeta)');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK });
ok(guardadas().length === 2 && guardadas().every((q) => q.local === LOCAL), 'encuentra el local_ de la app', guardadas());

console.log('4. Una sesión que la app no conoce: cli_ (y queda anotado)');
r = correr({ tool_name: 'AskUserQuestion', session_id: '22222222-2222-4333-8444-555555555555', cwd: proyecto, tool_input: ASK });
ok(guardadas().every((q) => q.local === 'cli_22222222-2222-4333-8444-555555555555'), 'pregunta como cli_', guardadas());
ok(/sin local_ para 22222222/.test(fs.readFileSync(log, 'utf8')), 'el log lo dice');

console.log('5. El proyecto decide, no la carpeta actual');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: afuera, tool_input: ASK }, { CLAUDE_PROJECT_DIR: proyecto });
ok(decision(r) === 'deny' && guardadas().length === 2, 'un chat de MaKo que hizo cd afuera: niega y guarda', r.salida);
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK }, { CLAUDE_PROJECT_DIR: afuera });
ok(r.status === 0 && r.salida === null && guardadas().length === 0, 'un proyecto ajeno: no se mete', r);
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto + '-hermano', tool_input: ASK });
ok(r.salida === null && guardadas().length === 0, 'una carpeta hermana con el mismo comienzo tampoco', r);

console.log('6. Otra herramienta: nada');
r = correr({ tool_name: 'Bash', session_id: CLI, cwd: proyecto, tool_input: { command: 'ls' } });
ok(r.status === 0 && r.salida === null && guardadas().length === 0, 'sin salida', r);

console.log('7. Sin sesión: niega igual, pero dice que NO se guardó');
r = correr({ tool_name: 'AskUserQuestion', cwd: proyecto, tool_input: ASK });
ok(decision(r) === 'deny' && /NO se guardó/.test(motivo(r)) && guardadas().length === 0, 'niega con instrucciones', motivo(r));

console.log('8. El cartero falla: dice que el cartero no confirmó (no culpa a las reglas) y pide mirar antes de duplicar');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK }, { MAKO_SIN_ASK_CARTERO: FALLA });
ok(decision(r) === 'deny' && /el cartero no confirmó/.test(motivo(r)) && /algo se rompió/.test(motivo(r)) && /para no duplicarla/.test(motivo(r)), 'motivo claro', motivo(r));

console.log('9. Una pregunta con una sola opción no pasa; la otra sí');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: { questions: [ASK.questions[0], { question: '¿Una?', header: 'x', options: [{ label: 'Sola' }] }] } });
ok(guardadas().length === 1 && /1 de las que hiciste NO se guardaron/.test(motivo(r)), 'sale una y avisa la otra', motivo(r));
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: { questions: [{ question: '¿Una?', header: 'x', options: [{ label: 'Sola' }] }] } });
ok(/no pasó las reglas/.test(motivo(r)) && !/cartero no confirmó/.test(motivo(r)), 'sólo la mala: culpa a las reglas', motivo(r));

console.log('10. Un cartero colgado: el hook corta a tiempo (presupuesto 15 s)');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK }, { MAKO_SIN_ASK_CARTERO: LENTO });
ok(decision(r) === 'deny' && r.ms < 20_000 && /NO se guardó/.test(motivo(r)), `termina en ${Math.round(r.ms / 1000)} s y niega`, { ms: r.ms, m: motivo(r) });

console.log('11. Un cartero que imprime con sangría (como el real): se lee igual');
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK }, { MAKO_SIN_ASK_CARTERO: CUENTA });
ok(/YA QUEDÓ GUARDADA/.test(motivo(r)), 'reconoce el ok', motivo(r));

console.log('12. Entrada rota o biblioteca que no existe: no bloquea, y deja rastro');
fs.rmSync(log, { force: true });
r = correr('esto no es json');
ok(r.status === 0 && r.salida === null, 'stdin roto: exit 0 sin salida', r);
r = correr({ tool_name: 'AskUserQuestion', session_id: CLI, cwd: proyecto, tool_input: ASK }, { MAKO_SIN_ASK_LIB: path.join(raiz, 'no-existe.mjs') });
ok(r.status === 0 && r.salida === null, 'sin biblioteca: exit 0 sin salida (la herramienta corre como antes)', r);
ok(/error, AskUserQuestion sigue/.test(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''), 'el error queda en el log');

fs.rmSync(raiz, { recursive: true, force: true });
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO VERDE');
process.exit(fallas ? 1 : 0);
