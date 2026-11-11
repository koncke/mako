// =============================================================================
// WA1 (22/10/2026): Hola MaKo contesta con el Claude o el GPT del negocio (por clave, nunca por suscripción)
// =============================================================================
// Los candidatos del doer de WhatsApp eran [pin, groq, openai] y el escalado pedía `claude-sonnet-5` con `model` explícito,
// que el veto corta: el Claude del negocio no se probaba nunca, y en 30 días hubo 231 llamadas a Gemini desde el doer. Lo
// que fija este test:
//   1. el doer pregunta `negocioConSuIA(wsData)`, y con su IA los candidatos son sólo su OpenAI (sin Groq ni Gemini);
//   2. después de su OpenAI, su Claude por la puerta 2 (`soloSuClaude`), sólo si el turno no ejecutó nada, y la red gratis
//      de la plataforma ni se arma;
//   3. corriendo `chatClaudeTools` con `soloSuClaude` (tests/_doer-su-claude-hijo.ts): con su clave, a Anthropic con SU
//      clave y el modelo de la puerta 2, con su marca; sin su clave, «falló la IA», sin tocar la de MaKo.
// Nunca la suscripción: el doer no encola nada a la PC (D6a: es de fondo).
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · sin el chequeo de su IA en los candidatos (vuelve a [pin, groq, openai]) → 1 en rojo;
//   · sin el intento de su Claude → 2 en rojo;
//   · su Claude aunque el turno ya ejecutó algo → 2 en rojo;
//   · `soloSuClaude` cayendo al Claude de MaKo → 3 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinDelDoer } from '../lib/doer-modelo';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const DOER = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8')).replace(/\r\n/g, '\n');

test('1. con su IA, el candidato del doer es su OpenAI: su Gemini, no (en el grupo, sin Gemini desde el 28/10/2026)', () => {
  // Con `conPc` a mano desde el 25/10/2026: el cartel de un negocio con su computadora y sin clave no dice «no tiene su IA».
  assert.match(DOER, /const iaDelNegocio = await negocioConSuIA\(wsData\);\s*const suIA = iaDelNegocio\.suIA;/);
  // Sin Gemini desde el 28/10/2026 (Martín: «deprequemos Gemini por los grupos de WhatsApp»): ni el suyo ni un pin a Gemini.
  assert.match(DOER, /const cands = \(suIA \? \[\.\.\.PROVS_SU_IA\] : \[pinL\.provider, 'openai'\]\)\.filter\(\(p, i, a\) => p !== 'groq' && p !== 'gemini' && a\.indexOf\(p\) === i\);/);
  // Y Gemini de RESPALDO (11/11/2026, Martín: «gastemos eso para todo esto en lugar de Gemini»): al final, sólo el DEL NEGOCIO, y
  // el orden por cuota no lo adelanta.
  assert.match(DOER, /const geminiDeRespaldo = suIA && PROVS_SU_IA\.includes\('gemini'\) \? \['gemini'\] : \[\];\n\s*const orden = \[\.\.\.await ordenarPorCuota\(cands\)\.catch\(\(\) => cands\), \.\.\.geminiDeRespaldo\];/,
    'el Gemini del negocio no quedó de respaldo, al final');
  assert.match(DOER, /import \{ PROVS_SU_IA \} from '@\/lib\/solo-su-ia';/);
  // El pin vive en lib/doer-modelo.ts desde el 27/10/2026 (el modelo por defecto de la app, no `gpt-4o-mini` fijo).
  assert.match(DOER, /const pinL = pinDelDoer\(pin, suIA\);/, 'con su IA y sin pin barato, el loop corre igual (con su OpenAI)');
  assert.equal(pinDelDoer(null, true)?.provider, 'openai', 'con su IA y sin pin barato, el loop corre igual (con su OpenAI)');
  assert.equal(pinDelDoer({ provider: 'anthropic', model: 'claude' }, true)?.provider, 'openai', 'un pin a Claude dejó sin loop barato');
});

test('2. después de su OpenAI, su Claude por la puerta 2 — sólo si el turno no ejecutó nada — y sin la red de la plataforma', () => {
  // (Si Claude ya se probó primero, «Claude primero» del test 4, no se repite.)
  const i = DOER.indexOf('if (!respuesta && suIA && !linkBorrador && corridasDelTurno === 0 && !claudeProbado) {');
  assert.ok(i > 0, 'falta el intento con su Claude (o perdió la guarda de «no ejecutó nada»)');
  const bloque = DOER.slice(i, i + 900);
  assert.match(bloque, /chatClaudeTools\(system, msgs, tools, nuevoIntento\(\), \{\s*feature: 'mako-doer-in', soloSuClaude: true,/);
  assert.doesNotMatch(bloque, /model: '/, 'sin `model` explícito: eso va al veto de la plataforma');
  // 24/10/2026 (el cartel del ws21): la red se pide antes de decidir qué saltear, y sin red no hay `turnoRed` (ni marca).
  assert.match(DOER, /if \(!respuesta && !suIA\) red = await provsGratisDePlataforma\(\)/, 'con su IA, la red gratis ni se arma');
  assert.match(DOER, /const turnoRed = red\.length \? turnoParaLaRed\(/, 'con su IA, la red gratis ni se arma');
});

test('3. `soloSuClaude` de verdad: su clave y su marca; sin su clave, «falló la IA» y la de MaKo intacta', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_doer-su-claude-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.ws3.r.text, 'Tienes 3 leads nuevos hoy.');
  assert.deepEqual(r.ws3.pedidos.map((p: { clave: string; model: string }) => [/DEL-NEGOCIO/.test(p.clave), p.model]), [[true, 'claude-haiku-4-5']]);
  assert.match(String(r.ws13.r), /^tiró: falló la IA \(el negocio no tiene su clave de Claude\)/);
  assert.deepEqual(r.ws13.pedidos, [], 'sin su clave no se le pide nada a nadie');
  for (const g of r.gasto as Array<{ motivo: string }>) assert.match(g.motivo, /^⚠ clave de Anthropic del negocio/);
});

test('4. el grupo contesta con CLAUDE PRIMERO: su Claude, o el crédito de los planes 200 repartido entre las cuentas', () => {
  // Martín, 28/10/2026 (ws10, Leandro): «te pedí que habilites las API que tenemos disponibles con todas las cuentas de planes 200».
  const i = DOER.indexOf("const claudeDelGrupo = async (cuenta?: string): Promise<'listo' | 'sin_su_claude' | 'otra_cuenta'> => {");
  const iOtras = DOER.indexOf('const instancias = (await Promise.all(');
  assert.ok(i > 0 && iOtras > i, 'Claude no va antes de su OpenAI');
  const bloque = DOER.slice(i, iOtras);
  assert.match(bloque, /feature: 'mako-doer-in', soloSuClaude: true, cuentaDeLosGrupos: cuenta,/);
  assert.doesNotMatch(bloque, /model: '/, 'sin `model` explícito: eso va al veto de la plataforma');
  // Su Claude primero; el crédito, SÓLO si no tiene (con el suyo, la puerta 2 le daría el suyo otra vez).
  assert.match(bloque, /if \(!cuenta && \/no tiene su clave de Claude\/\.test\(m\)\) return 'sin_su_claude';/);
  assert.match(bloque, /if \(!cuenta\) \{ probadasCliente\+\+; erroresIA\.push\(`anthropic\/ANTHROPIC_API_KEY: \$\{m\}`\); return 'listo'; \}/);
  assert.match(bloque, /if \(!respuesta && !linkBorrador && \(await claudeDelGrupo\(\)\) === 'sin_su_claude'\) \{\n\s*for \(const cuenta of await cuentasDelCreditoDeLosGrupos\(\)\) \{\n\s*if \(respuesta \|\| corridasDelTurno > 0 \|\| \(await claudeDelGrupo\(cuenta\)\) === 'listo'\) break;/,
    'otra cuenta después de una escritura la duplicaría');
  // El crédito es NUESTRO: su error no elige el veredicto, y la cuenta sin crédito se saltea.
  // Plazo, 5xx u «overloaded» (el mismo Anthropic) no prueba la otra cuenta (11/11/2026)… salvo que no haya respaldo (revisión del
  // 11/11/2026: un negocio sin su IA no tiene ni Gemini ni red, y un 529 era el cartel de fallo): entonces UNA vez más, en el plazo.
  assert.match(bloque, /if \(\/credit balance is too low\/i\.test\(m\)\) marcarCuentaDeLosGruposSinCredito\(cuenta\);\n\s*erroresPlataforma\.push\(`plataforma\/anthropic \(\$\{cuenta\}\): \$\{m\}`\);\n\s*const status = \(e as \{ status\?: number \}\)\.status;\n\s*const pasajera = esFallaPasajeraDelCredito\(status, m\);\n\s*const entraOtro = Date\.now\(\) - \(ctxApi\.turnStart \?\? Date\.now\(\)\) \+ PLAZO_CLAUDE_DEL_GRUPO_MS < PLAZO_DOER_MS;\n\s*const sinRespaldo = pasajera && entraOtro && !\(await hayRespaldoDespuesDeClaude\(\)\);\n\s*if \(queHacerSiFallaElCredito\(status, m, \{ sinRespaldo, pasajerasAntes: pasajerasDelCredito \}\) !== 'otra_cuenta'\) return 'listo';\n\s*if \(pasajera\) pasajerasDelCredito\+\+;\n\s*return 'otra_cuenta';/,
    'sin respaldo, un 529 o un 5xx del crédito corta el turno del grupo (o lo pasajero se prueba en todas las cuentas)');
  // «Hay respaldo» es lo que corre después: una IA suya con clave (`orden`) o la red de la plataforma (sin su IA, como la de abajo).
  // La red NO se pide para saberlo (11/11/2026, corrida 1035): pedirla es gastarla, y red-plataforma fija que se pide UNA vez, al
  // final. Alcanza su regla: sólo en el ws de la plataforma y nunca con su IA.
  assert.match(DOER, /const conClave = \(await Promise\.all\(\(orden as Array<'groq' \| 'openai' \| 'gemini' \| 'cerebras' \| 'mistral'>\)\.map\(\(p\) => provsDe\(p\)\.catch\(\(\) => \[\]\)\)\)\)\.some\(\(l\) => l\.length > 0\);\s*return conClave \|\| \(!suIA && wsData === \(await wsSuperAdmin\(\)\.catch\(\(\) => null\)\)\);/);
  assert.match(bloque, /if \(!cuenta\) \{ probadasCliente\+\+; contestaronCliente\+\+; \}/, 'lo que contestó nuestro crédito contó como del cliente');
  // La charla barata (que prueba Gemini primero) no corre en el grupo.
  assert.doesNotMatch(DOER, /await chatCheap\(/, 'volvió la charla barata (Gemini primero) al grupo');
  // La puerta 2 (lo de verdad, en tests/credito-grupos.test.ts): la cuenta del grupo pasa por ahí.
  const ant = sinComentarios(readFileSync(join(RAIZ, 'lib/anthropic.ts'), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(ant, /permisoDeLaClaveDelNegocio\(opts\.feature, \{ modelo: opts\.modeloSuClaude, cuentaDeLosGrupos: opts\.cuentaDeLosGrupos \}\)/);
});

test('5. sin pin y sin su IA, el grupo va igual con CLAUDE PRIMERO (nunca a la puerta 1), y cada pedido a Claude tiene plazo', () => {
  // 11/11/2026: `pinDelDoer` devolvía null sin su IA y sin pin, y el turno caía a un `else` que pedía Sonnet u Opus a la puerta 1
  // (el veto lo corta: sólo `closing` tiene permiso). Hoy no pasaba porque hay un pin; sacarlo en /modelos-ia lo rompía.
  assert.ok(pinDelDoer(null, false), 'sin su IA y sin pin, el doer se queda sin el camino de «Claude primero»');
  assert.doesNotMatch(DOER, /model: pin \? pin\.model : ruta\.model/, 'volvió la rama que le pide Sonnet u Opus a la puerta 1');
  // Los plazos: 45 s el turno (dos cuentas, 90 s, entran en PLAZO_DOER_MS) y 8 s el clasificador.
  assert.match(DOER, /const PLAZO_CLAUDE_DEL_GRUPO_MS = 45_000;/);
  assert.match(DOER, /const PLAZO_CLASIFICADOR_MS = 8_000;/);
  const i = DOER.indexOf("const claudeDelGrupo = async (cuenta?: string): Promise<'listo' | 'sin_su_claude' | 'otra_cuenta'> => {");
  assert.match(DOER.slice(i, i + 900), /cuentaDeLosGrupos: cuenta, maxSteps: 8, maxTokens: 2500, plazoPasoMs: PLAZO_CLAUDE_DEL_GRUPO_MS,/, 'el turno del grupo sin plazo');
  const c = DOER.indexOf('function clasificadorDelGrupo(');
  const clasificador = DOER.slice(c, DOER.indexOf('\n}\n', c));
  assert.match(clasificador, /maxSteps: 1, maxTokens: 300, plazoPasoMs: PLAZO_CLASIFICADOR_MS,/, 'el clasificador sin plazo');
  assert.match(clasificador, /if \(queHacerSiFallaElCredito\(\(e as \{ status\?: number \}\)\.status, m\) !== 'otra_cuenta'\) break;/, 'un plazo vencido del clasificador prueba otra cuenta (otros 8 s)');
  // El `fetch` del bucle lleva su `signal` (lo de verdad, en tests/credito-grupos.test.ts 8).
  const ant = sinComentarios(readFileSync(join(RAIZ, 'lib/anthropic.ts'), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(ant, /signal: AbortSignal\.timeout\(Math\.max\(1_000, plazo\)\),/);
});

// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada):
//   · `pinDelDoer` devolviendo null sin su IA                                  → 5 en rojo;
//   · el `else` de la puerta 1 de vuelta                                        → 5 en rojo;
//   · Gemini otra vez adelante (ordenado por cuota con los demás)               → 1 en rojo;
//   · el turno del grupo sin `plazoPasoMs`                                      → 5 en rojo.
