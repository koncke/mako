// =============================================================================
// Con qué IA corre UN chat: el servidor del «+» de la caja (8b, 23/10/2026)
// =============================================================================
// Martín: «En el Ops Center, el "+" de la caja deja elegir con qué corre ese chat: el modelo y la cuenta (Claude o GPT, y
// cuál). Por defecto decide el chat jefe, salvo que se elija otro». El selector es de Ops Center (lib/chat-ia-reglas.ts y la
// caja); esto es lo del servidor (lib/chat-ia.ts, la ruta, turnoApp y lib/anthropic.ts), con lo REAL contra una base y unas
// APIs de mentira (tests/_chat-ia-hijo.ts). Lo que fija:
//   1. qué se ofrece: SU computadora (la de esta persona), SU Claude (con el crédito de MaKo, sólo Haiku) y SU OpenAI;
//      nada de la plataforma, y nada en el workspace del super admin;
//   2. qué elección pasa: sólo una de esas, con un modelo que esa cuenta acepta; lo demás, Automático;
//   3. lo elegido llega a la llamada: el modelo y la clave de SU cuenta, y con el crédito de MaKo Haiku igual; SU OpenAI no
//      cae a Claude;
//   4. la ruta lo lee en las dos ramas (JSON y multipart) y el turno lo respeta (con la computadora, no cae a las claves).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_chat-ia-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CHATIA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@CHATIA@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. qué se ofrece: su computadora, su Claude y su OpenAI; con el crédito, sólo Haiku; nada en el super admin', () => {
  const r = correr();
  assert.deepEqual(r.cuentasAna, [
    { cuenta: 'pc', nombre: 'Tu computadora (Oficina)', modelos: ['sonnet', 'opus', 'haiku'], modeloDefault: 'sonnet' },
    { cuenta: 'anthropic', nombre: 'Tu Claude', modelos: ['haiku', 'sonnet'], modeloDefault: 'haiku' },
    { cuenta: 'openai', nombre: 'Tu ChatGPT', modelos: [], modeloDefault: null },
  ]);
  assert.deepEqual(r.cuentasOtraPersona, ['anthropic', 'openai'], 'la computadora de Ana se le ofreció a otra persona');
  // El modelo de la clave paga del negocio lo elige el admin (revisión del selector): a un miembro, sin elegir.
  assert.deepEqual(r.modelosDelMiembro, [], 'un miembro elige el modelo de la clave paga');
  assert.deepEqual(r.cuentasMauricio, [{ cuenta: 'anthropic', nombre: 'Tu Claude', modelos: ['haiku'], modeloDefault: 'haiku', soloHaiku: true }], 'el crédito de MaKo con Sonnet');
  assert.deepEqual(r.cuentasSinNada, [], 'se le ofreció la IA de la plataforma');
  assert.deepEqual(r.cuentasSuperAdmin, []);
});

test('2. qué elección pasa: una de las que se ofrecen, con un modelo que esa cuenta acepta; lo demás, Automático', () => {
  const e = correr().eleccion;
  assert.deepEqual(e.sonnet, { cuenta: 'anthropic', modelo: 'sonnet' });
  assert.deepEqual(e.pcOpus, { cuenta: 'pc', modelo: 'opus' }, 'el multipart manda el JSON');
  assert.deepEqual(e.openaiConModelo, { cuenta: 'openai' }, 'OpenAI todavía sin elegir modelo');
  assert.equal(e.pcDeOtro, null, 'la computadora de otra persona');
  assert.deepEqual(e.sonnetDelMiembro, { cuenta: 'anthropic' }, 'un miembro pisó el modelo del admin sobre la clave paga');
  assert.deepEqual(e.sonnetConElCredito, { cuenta: 'anthropic' }, 'Sonnet sobre el crédito de MaKo');
  assert.equal(e.openaiSinClave, null);
  assert.equal(e.basura, null);
  assert.equal(e.nada, null);
});

test('3. lo elegido llega a la llamada: su clave y su modelo; con el crédito, Haiku igual; su OpenAI no cae a Claude', () => {
  const r = correr();
  assert.deepEqual(r.suClaudeSonnet.llamadas, [{ a: 'anthropic', clave: 'sk-ant-api03-propia-de-ana-a', modelo: 'claude-sonnet-5' }]);
  assert.equal(r.suClaudeSinElegir.llamadas[0].modelo, 'claude-haiku-4-5', 'sin elegir, el del negocio');
  assert.deepEqual(r.creditoConSonnet.llamadas, [{ a: 'anthropic', clave: 'sk-ant-api03-credito-cuenta1', modelo: 'claude-haiku-4-5' }], 'el crédito de MaKo pagó Sonnet');
  assert.equal(r.suOpenAI.r, 'hola desde OpenAI');
  assert.deepEqual(r.suOpenAI.llamadas.map((l: { a: string; clave: string }) => [l.a, l.clave]), [['openai', 'sk-proj-propia-de-ana-']]);
  assert.match(r.suOpenAISinClave.r, /^TIRÓ: falló la IA/);
  assert.deepEqual(r.suOpenAISinClave.llamadas, [], 'sin su OpenAI cayó a otra IA');
});

test('4. la ruta lo lee en las dos ramas y manda las cuentas; el turno lo respeta y con la computadora no cae a las claves', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.get\('suIA'\)\) return json\(\{ ok: true, conectada: await conSuIA\(persona\), cuentas: await cuentasDeIA\(persona\)\.catch\(\(\) => \[\]\) \}\);/);
  assert.match(ruta, /const ia = await eleccionDelPedido\(quien, form\.get\('ia'\)\);\n\s*const r = await turnoApp\(quien, sessionId, \{[^}]*voz[^}]*desde, ia \}\);/, 'el multipart (la nota de voz) no lee la elección');
  assert.match(ruta, /const ia = await eleccionDelPedido\(quien, body\.ia\);\n\s*const r = await turnoApp\(quien, sessionId, \{[^}]*sanearDesde\(body\.desde\), ia \}\);/, 'el JSON no lee la elección');
  // Nunca tal cual: la elección cruda no llega al turno.
  assert.doesNotMatch(ruta, /ia: body\.ia|ia: form\.get/);
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /const conLaPc = !ia \|\| ia\.cuenta === 'pc';/);
  // Con una de sus claves elegida, lo de la computadora no es lo que pasó (revisión del selector).
  assert.match(turno, /let falloDeLaPc: FalloDeLaPc \| null = conLaPc && pc && !pcPuede \?/, 'con «Tu Claude» elegido, el aviso habla de la computadora');
  assert.match(turno, /if \(conLaPc && pc && pcPuede\) \{/, 'con una de sus claves elegida, igual piensa la computadora');
  assert.match(turno, /const modelo = ia\?\.cuenta === 'pc' && ia\.modelo \? modeloPc\(ia\.modelo\) : modeloPc\(await getSetting\(CLAVE_MODELO_PC\)/);
  assert.match(turno, /falloDeLaPc !== 'muchos' && ia\?\.cuenta !== 'pc'\) \{/, 'con la computadora elegida, cae a las claves');
  assert.match(turno, /\.\.\.\(ia\?\.cuenta === 'anthropic' \? \{ soloSuClaude: true, \.\.\.\(ia\.modelo \? \{ modeloSuClaude: ia\.modelo \} : \{\}\) \} : ia\?\.cuenta === 'openai' \? \{ soloSuOpenAI: true \} : \{\}\),/);
  // El turno no valida por su cuenta: confía en la ruta, que ya la pasó por eleccionDelPedido.
  assert.match(sinComentarios(leer('lib/chat-ia.ts')), /return eleccionVigente\(e, await cuentasDeIA\(persona\)\.catch\(\(\) => \[\]\)\);/);
});
