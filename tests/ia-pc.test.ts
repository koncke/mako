// =============================================================================
// La IA del cliente en SU computadora: la puerta, el programa y el turno (docs/ia-del-cliente.md, ola 1, 21/10/2026)
// =============================================================================
// Martín (D6a): el Claude o el GPT del cliente corre en su computadora, con el programa oficial y sus cuentas; MaKo le
// manda los pedidos y nunca toma el token. Lo que fija este archivo:
//   1. LA PC ES SÓLO EL CEREBRO: Claude Code sin herramientas propias y sólo con el MCP de MaKo del turno; el comando es
//      FIJO y es el mismo en el servidor y en el programa; nada de la persona en la línea de comandos; sin la API key en
//      el entorno; nunca `--bare`;
//   2. LA PUERTA, MULTI-INQUILINO: el negocio sale del token; la PC sólo toma turnos suyos, una vez, y los contesta; el
//      token de las herramientas es POR TURNO y vence; lo que manda la PC se sanea; ningún secreto en claro en la base;
//   3. EL TURNO: va a la PC de QUIEN escribe sólo si está en línea, corre las herramientas con el `runTool` del chat, y lo
//      que falla en la PC del cliente no es un bug de MaKo; con su Claude o su GPT, sin la cascada barata (D6b).
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-ia-pc.mjs`: una rotura por vez, restaurada de memoria y
// comprobada con sha256; base 6 / 0). Doce roturas, todas con su rojo:
//   · la PC con sus herramientas (sin `--tools ""`) → 4 / 2 · el programa con otro comando (`mcp__mako,Bash`) → 4 / 2;
//   · el prompt en la línea de comandos · la API key en el entorno de Claude · la cuenta entera (con secretos) en la base
//     · un token revocado que sigue sirviendo · el turno que se toma dos veces · contestar un turno de otra PC · el MCP
//     que corre lo que no viajó · el turno a la PC apagada · la PC de otra persona · con su IA, igual la cascada barata
//     → cada una 5 / 1.
// Restaurado: 6 / 0.
//
// Correr: npx tsx --test tests/ia-pc.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ARGS_CLAUDE, AVISO_PC_APAGADA, AVISO_PC_ERROR, AVISO_PC_TARDE, EN_LINEA_MS, PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO,
  armarPrompt, avisoDeLaPc, bearer, codigoDe, enLinea, mcpDelTurno, normalizarCodigo, sanearCuentas, sanearRespuesta,
  tieneFormaDeToken,
} from '../lib/ia-pc-reglas';
import { ARGS_CLAUDE as ARGS_DEL_PROGRAMA, SIN_ESTAS, pensar } from '../scripts/ia-pc/mako-pc.mjs';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = (p: string) => `${p}${'A'.repeat(43)}`;

test('la PC es sólo el cerebro: el comando es fijo, sin herramientas propias, y el mismo en el servidor y en la PC', () => {
  // Rota: sacar `--tools ""` (o dejarle la terminal) → este test falla.
  const i = ARGS_CLAUDE.indexOf('--tools');
  assert.ok(i >= 0 && ARGS_CLAUDE[i + 1] === '', 'sin herramientas propias: ni terminal, ni archivos, ni web');
  assert.ok(ARGS_CLAUDE.includes('--strict-mcp-config'), 'sólo el MCP del turno, ningún otro de la PC');
  assert.ok(ARGS_CLAUDE.includes('-p') && ARGS_CLAUDE.includes('--no-session-persistence'));
  assert.ok(!ARGS_CLAUDE.includes('--bare'), '--bare apaga el login de la suscripción');
  assert.ok(!ARGS_CLAUDE.some((a) => /dangerously|bypass/i.test(a)), 'ningún permiso de más');
  // La copia del programa es idéntica: el servidor no le puede pedir otro comando.
  assert.deepEqual([...ARGS_DEL_PROGRAMA], [...ARGS_CLAUDE]);
  assert.ok(SIN_ESTAS.includes('ANTHROPIC_API_KEY'), 'con la API key en el entorno, -p no usa la suscripción');
});

test('el programa corre Claude con el texto por stdin, en su carpeta, con la cuenta elegida y sin la API key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-test-'));
  const vistos: Array<{ cmd: string; args: string[]; opts: { cwd: string; env: Record<string, string>; shell: boolean }; stdin: string }> = [];
  const falso = (respuesta: string) => (cmd: string, args: string[], opts: { cwd: string; env: Record<string, string>; shell: boolean }) => {
    const p = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; stdin: EventEmitter & { end: (s: string) => void }; kill: () => void };
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => {};
    p.stdin = Object.assign(new EventEmitter(), { end: (s: string) => { vistos.push({ cmd, args, opts, stdin: s }); setImmediate(() => { p.stdout.emit('data', respuesta); p.emit('close', 0); }); } });
    return p;
  };
  const antes = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-no-deberia-viajar';
  try {
    const ok = await pensar({ dir, system: 'el system', prompt: 'el mensaje de la persona', mcp: mcpDelTurno('https://x/api/ia-pc/mcp', 't'), configDir: '/cuentas/ana' },
      falso(JSON.stringify({ type: 'result', is_error: false, result: 'Tienes 7 leads.', usage: { input_tokens: 10, output_tokens: 4 } })) as never, 'claude');
    assert.deepEqual(ok, { texto: 'Tienes 7 leads.', uso: { entrada: 10, salida: 4 }, limites: {} });
    const v = vistos[0];
    assert.equal(v.cmd, 'claude');
    assert.equal(v.opts.shell, false, 'sin shell: los argumentos no se reinterpretan');
    assert.equal(v.opts.cwd, dir);
    assert.deepEqual(v.args.slice(0, ARGS_CLAUDE.length), [...ARGS_CLAUDE]);
    // Desde la ola 2, el modelo (por su lista: tests/ia-pc-ola2.test.ts) y después los archivos del turno.
    assert.deepEqual(v.args.slice(ARGS_CLAUDE.length), ['--model', 'sonnet', '--system-prompt-file', join(dir, 'system.txt'), '--mcp-config', join(dir, 'mcp.json')]);
    // Rota: pasar el prompt como argumento → este test falla.
    assert.equal(v.stdin, 'el mensaje de la persona');
    assert.ok(!v.args.some((a) => a.includes('el mensaje de la persona')), 'nada de la persona en la línea de comandos');
    assert.equal(v.opts.env.ANTHROPIC_API_KEY, undefined, 'sin la API key: usa la suscripción');
    assert.equal(v.opts.env.CLAUDE_CONFIG_DIR, '/cuentas/ana', 'la cuenta elegida');
    const error = await pensar({ dir, system: 's', prompt: 'p', mcp: {} }, falso(JSON.stringify({ type: 'result', is_error: true, result: 'Login expired' })) as never, 'claude');
    assert.deepEqual(error, { error: 'Login expired', limites: {} });
  } finally {
    if (antes === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = antes;
  }
});

test('las reglas puras de la puerta: código, tokens, en línea, y lo que manda la PC se sanea', () => {
  // 8 letras desde la revisión del 21/10/2026: ya no se dicta (viaja dentro de la línea que se copia).
  assert.equal(normalizarCodigo('ab-cd 2345'), 'ABCD2345');
  assert.equal(normalizarCodigo('ABC1D3EF'), null, 'sin 1, 0, I ni O');
  assert.equal(normalizarCodigo('ABC234'), null, 'las 6 de antes ya no');
  assert.match(codigoDe(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])), /^[A-HJ-NP-Z2-9]{8}$/);
  assert.ok(tieneFormaDeToken(TOKEN(PREFIJO_TOKEN_PC), PREFIJO_TOKEN_PC));
  assert.equal(tieneFormaDeToken(TOKEN(PREFIJO_TOKEN_TURNO), PREFIJO_TOKEN_PC), false, 'el del turno no abre la PC');
  assert.equal(tieneFormaDeToken(`${PREFIJO_TOKEN_PC}corto`, PREFIJO_TOKEN_PC), false);
  assert.equal(bearer('Bearer abc'), 'abc');
  assert.equal(bearer('abc'), null);
  const ahora = Date.parse('2026-10-21T12:00:00Z');
  assert.ok(enLinea(new Date(ahora - EN_LINEA_MS).toISOString(), ahora));
  assert.equal(enLinea(new Date(ahora - EN_LINEA_MS - 1).toISOString(), ahora), false);
  assert.equal(enLinea(null, ahora), false);
  // Una cuenta nunca guarda un secreto: lo que no se reconoce, no entra.
  // Rota: guardar la cuenta entera → este test falla.
  assert.deepEqual(sanearCuentas([{ proveedor: 'claude', email: 'ana@negocio.com', plan: 'max', usado5h: 41.6, token: 'sk-ant-secreto' }, { proveedor: 'otro' }]),
    [{ proveedor: 'claude', email: 'ana@negocio.com', plan: 'max', usado5h: 42 }]);
  assert.deepEqual(sanearRespuesta({ texto: '  hola  ', cuenta: 'ana@negocio.com', uso: { entrada: 5, salida: 2 } }), { ok: true, texto: 'hola', cuenta: 'ana@negocio.com', uso: { entrada: 5, salida: 2 } });
  assert.deepEqual(sanearRespuesta({ error: 'Login expired' }), { ok: false, error: 'Login expired' });
  assert.deepEqual(sanearRespuesta({ error: 'al tope', tipo: 'tope', repone: '2026-10-21T15:30:00Z' }), { ok: false, error: 'al tope', tipo: 'tope', repone: '2026-10-21T15:30:00.000Z' });
  assert.deepEqual(sanearRespuesta({ error: 'x', tipo: 'otro-cualquiera' }), { ok: false, error: 'x' }, 'un tipo que no se conoce, no entra');
  assert.equal(sanearRespuesta({ nada: 1 }), null);
  assert.equal((sanearRespuesta({ texto: 'x'.repeat(30_000) }) as { texto: string }).texto.length, 20_000);
  assert.match(armarPrompt([{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'buenas' }], '¿y?'), /La persona: hola\nMaKo: buenas\n\nEl mensaje nuevo de la persona:\n¿y\?/);
  assert.equal(avisoDeLaPc('tarde', false), AVISO_PC_TARDE);
  assert.equal(avisoDeLaPc('error', true), AVISO_PC_ERROR);
  assert.equal(avisoDeLaPc(null, true), AVISO_PC_APAGADA);
  assert.equal(avisoDeLaPc(null, false), null);
});

test('la puerta del servidor: el negocio sale del token, la PC sólo toma lo suyo una vez, y el token del turno vence', () => {
  const s = sinComentarios(leer('lib/ia-pc.ts'));
  const cuerpo = (f: string) => s.slice(s.indexOf(`export async function ${f}(`), s.indexOf('\nexport ', s.indexOf(`export async function ${f}(`) + 10));
  // Rota: un token revocado que sigue sirviendo → este test falla.
  assert.match(cuerpo('dispositivoDelToken'), /\.eq\('token_hash', hash\(token\)\)\.is\('revocado_at', null\)/);
  assert.match(cuerpo('emparejar'), /\.eq\('codigo_hash', hash\(codigo\)\)\.is\('usado_at', null\)\.gt\('vence_at'/, 'el código se gasta en el mismo update que lo valida');
  const tomar = cuerpo('tomarTurno');
  assert.match(tomar, /\.eq\('dispositivo_id', d\.id\)\.eq\('workspace_id', d\.ws\)\.eq\('estado', 'esperando'\)/, 'sólo los turnos de ESTA PC y su negocio');
  // Rota: tomar sin la condición de estado → este test falla (dos PC tomarían el mismo turno).
  assert.match(tomar, /\.eq\('id', prox\.id\)\.eq\('estado', 'esperando'\)/, 'se toma una sola vez');
  assert.match(tomar, /token_hash: hash\(token\)/, 'el token del turno se acuña al tomarlo, y se guarda sólo su hash');
  assert.match(cuerpo('contestarTurno'), /\.eq\('id', id\)\.eq\('dispositivo_id', d\.id\)\.eq\('workspace_id', d\.ws\)\.eq\('estado', 'tomado'\)/);
  assert.match(cuerpo('turnoDelToken'), /\.eq\('token_hash', hash\(token\)\)\.eq\('estado', 'tomado'\)\.gt\('vence_at'/);
  assert.match(cuerpo('esperarALaPc'), /update\(\{ estado: 'vencido' \}\)/, 'lo que no volvió a tiempo, vence');
  // Las rutas: el negocio nunca sale del pedido.
  for (const r of ['emparejar', 'latido', 'turno', 'turno/[id]', 'mcp', 'soltar', 'confirmar']) {
    const src = sinComentarios(leer(`app/api/ia-pc/${r}/route.ts`));
    assert.doesNotMatch(src, /workspace|searchParams\.get\('ws'\)|body\??\.ws\b/, `${r}: el negocio no sale del pedido`);
  }
  // Las rutas de la PC sacan la PC del token en UN lugar (lib/ia-pc-ruta.ts), que distingue 401 `revocado` de 503.
  assert.match(leer('lib/ia-pc-ruta.ts'), /dispositivoDelToken\(bearer\(req\.headers\.get\('authorization'\)\), o\)/);
  // `soltar` y `confirmar` aceptan la PC PENDIENTE (mig 0322): es lo único que puede hacer antes del «sí».
  for (const r of ['latido', 'turno', 'turno/[id]', 'soltar', 'confirmar']) assert.match(leer(`app/api/ia-pc/${r}/route.ts`), /const p = await pcDelPedido\(req, '[a-z]+'(, \{ pendientesTambien: true \})?\);\s*if \('respuesta' in p\) return p\.respuesta;/, r);
  assert.match(leer('app/api/ia-pc/mcp/route.ts'), /turnoDelToken\(bearer\(req\.headers\.get\('authorization'\)\)\)/);
  assert.match(leer('app/api/ia-pc/codigo/route.ts'), /personaDelRequest\(\)/, 'el código lo pide una persona con sesión');
  const publicas = leer('lib/rutas-publicas.ts');
  for (const p of ['/api/ia-pc/emparejar', '/api/ia-pc/latido', '/api/ia-pc/turno', '/api/ia-pc/mcp', '/api/ia-pc/soltar']) assert.ok(publicas.includes(`'${p}'`), p);
  assert.ok(!publicas.includes("'/api/ia-pc/codigo'") && !publicas.includes("'/api/ia-pc'"), 'codigo es con sesión');
  // La base: RLS, revoke y ningún secreto en claro.
  const mig = leer('supabase/migrations/0320_ia_pc.sql');
  for (const t of ['ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos', 'ia_pc_llamadas']) {
    assert.match(mig, new RegExp(`alter table ${t} enable row level security;`));
    assert.match(mig, new RegExp(`revoke all on ${t} from anon, authenticated;`));
  }
  assert.doesNotMatch(mig, /\b(token|codigo)\s+text/, 'sólo los hashes');
});

test('el MCP es un relevo: sólo las herramientas del turno, y las corre el turno que espera', () => {
  const m = sinComentarios(leer('app/api/ia-pc/mcp/route.ts'));
  // Rota: correr lo que pida aunque no haya viajado → este test falla.
  const i = m.indexOf("if (!t.tools.some((x) => x.name === nombre))");
  assert.ok(i > 0 && i < m.indexOf('await pedirLlamada(t.id, nombre, entrada,'), 'lo que no viajó en el turno no corre');
  assert.match(m, /tools: herramientasParaMcp\(t\.tools\)/);
});

test('el turno: la PC de QUIEN escribe, sólo en línea Y con sesión, con su runTool; y con su IA, sin la cascada barata', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /const leidaPc = await pcDe\(ws, persona\.actor\)/, 'la cuenta es de una persona: sólo sus turnos');
  // Rota: mandar a la PC aunque esté apagada o sin sesión → este test falla.
  assert.match(t, /const pcPuede = pcUsable\(pc\);/);
  assert.match(t, /if \(conLaPc && pc && pcPuede\) \{\s*try \{\s*const modelo = ia\?\.cuenta === 'pc' && ia\.modelo \? modeloPc\(ia\.modelo\) : modeloPc\(await getSetting\(CLAVE_MODELO_PC\)\.catch\(\(\) => null\)\);\s*const turnoPc = await encolarTurno\(pc, s\.id, \{ system, prompt: armarPrompt\(historial, textoModelo\), tools, modelo \}\);/);
  // Lo que le queda a la ruta, no 240 s fijos; y la PC que se apaga a mitad del turno se ve (no 4 minutos).
  assert.match(t, /const espera = esperaDelTurno\(entrada\.plazoMs \?\? PLAZO_RUTA_MS, Date\.now\(\) - inicio\);\s*const r = await esperarALaPc\(turnoPc, ws, pc\.id, nuevoIntento\(\) as Ejecutor, espera\);/);
  assert.match(t, /else if \('apagada' in r\) \{ falloDeLaPc = 'apagada';/);
  // Sin su PC (o si no pudo), su clave: con «sólo su IA» del NEGOCIO (D6b, tests/solo-su-ia.test.ts).
  assert.match(t, /if \(!texto && falloDeLaPc !== 'tarde' && falloDeLaPc !== 'muchos' && ia\?\.cuenta !== 'pc'\) \{/);
  assert.match(t, /soloSuIA: negocio\.suIA/, 'D6b: por negocio, sin la cascada barata');
  // Lo que falla en la PC del cliente, o en SU cuenta, no abre un ticket de bug.
  assert.match(t, /\.\.\.\(fallo && !sinIA && !falloDeLaPc && \(!deSuClave \|\| suOpenAI === 'no-existe'\) \? \[\{ nombre: 'responder'/);
  assert.match(t, /const delaPc = avisoDeLaPc\(falloDeLaPc, false, \{ repone: reponeDeLaPc, tz: tzAviso \}\);/);
  const a = sinComentarios(leer('lib/anthropic.ts'));
  // Desde IA6 (22/10/2026) también cuando lo decidió la puerta de la capa de IA (`soloSuIA()`), no sólo el turno.
  assert.match(a, /const provs: ProvName\[\] = opts\.soloSuIA \|\| soloSuIA\(\) \? \['openai'\] : /, 'sólo su GPT, después su Claude');
});
