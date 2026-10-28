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
  assert.match(bloque, /if \(\/credit balance is too low\/i\.test\(m\)\) marcarCuentaDeLosGruposSinCredito\(cuenta\);\n\s*erroresPlataforma\.push\(`plataforma\/anthropic \(\$\{cuenta\}\): \$\{m\}`\);\n\s*return 'otra_cuenta';/);
  assert.match(bloque, /if \(!cuenta\) \{ probadasCliente\+\+; contestaronCliente\+\+; \}/, 'lo que contestó nuestro crédito contó como del cliente');
  // La charla barata (que prueba Gemini primero) no corre en el grupo.
  assert.match(DOER, /if \(SIN_GEMINI_EN_EL_GRUPO === false && ruta\.tier === 'cheap'/);
  // La puerta 2 (lo de verdad, en tests/credito-grupos.test.ts): la cuenta del grupo pasa por ahí.
  const ant = sinComentarios(readFileSync(join(RAIZ, 'lib/anthropic.ts'), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(ant, /permisoDeLaClaveDelNegocio\(opts\.feature, \{ modelo: opts\.modeloSuClaude, cuentaDeLosGrupos: opts\.cuentaDeLosGrupos \}\)/);
});
