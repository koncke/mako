// =============================================================================
// F85 (18/11/2026): escuchar una clase de un curso de MaKo deja su fila en el gasto de IA
// =============================================================================
// lib/transcribe-plataforma.ts es la cascada de audio de la PLATAFORMA (las clases de los cursos y el Conocimiento de MaKo,
// que carga sólo el super admin). Se decidió que no pase por la puerta del audio de la capa de IA —la decisión y sus cuatro
// razones están en su cabecera— y lo que faltaba era registrar el uso: una clase pasada por el whisper-1 pago no aparecía en
// ningún lado. Lo que fija este test, corriendo `transcribeMediaBuffer` de verdad (tests/_transcribe-plataforma-hijo.ts):
//   1. en el servidor, cada transcripción que salió deja UNA fila, con el proveedor que escuchó; la pagada, con su costo;
//   2. lo que rebotó no deja fila (no se cobró), y si no escuchó nadie, no queda ninguna;
//   3. en un script de línea de comandos (sin `react-server`) la transcripción sale igual: anotar no la tumba.
//
// Probado rompiéndolo (18/11/2026), base 3 pases / 0 fallos, una rotura por vez y restaurando de memoria:
//   · sin `await anotarUso(...)` después de un Whisper                                  → 2 / 1
//   · sin `await anotarUso(...)` después de Gemini                                      → 2 / 1
//   · `anotarUso` sin su try/catch (en el script tira al importar lib/anthropic-usage) → 2 / 1 — y es peor que no anotar:
//     el error cae en el catch del proveedor, la transcripción buena se tira y se le pide al siguiente (se paga dos veces)
//   · el proveedor fijo en 'openai' (la fila de Groq diría que cobró)                  → 2 / 1
// Correr: node --import tsx --test tests/transcribe-plataforma-uso.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Fila = { workspace_id: number; feature: string; provider: string; model: string; cost_usd: number; motivo: string | null };
type Corrida = { status: string; model: string | null; duracion_s: number | null; filas: Fila[] };
type Salida = Record<'groq' | 'openai' | 'gemini' | 'ninguno', Corrida> & { error?: string };

function correr(conServidor: boolean): Salida {
  const args = [...(conServidor ? ['--conditions=react-server'] : []), '--import', 'tsx', join(RAIZ, 'tests', '_transcribe-plataforma-hijo.ts')];
  const salida = execFileSync(process.execPath, args, {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
  });
  return JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Salida;
}

const SERVIDOR = correr(true);
const SCRIPT = correr(false);

test('1. en el servidor, cada transcripción deja una fila con el proveedor que escuchó', () => {
  assert.equal(SERVIDOR.error, undefined, String(SERVIDOR.error));
  const esperado: Record<'groq' | 'openai' | 'gemini', { provider: string; model: RegExp; paga: boolean }> = {
    groq: { provider: 'groq', model: /^whisper-large-v3-turbo$/, paga: false },
    openai: { provider: 'openai', model: /^whisper-1$/, paga: true },
    gemini: { provider: 'gemini', model: /^gemini-/, paga: false },
  };
  for (const [e, x] of Object.entries(esperado) as Array<[keyof typeof esperado, (typeof esperado)['groq']]>) {
    const c = SERVIDOR[e];
    assert.equal(c.status, 'ok', `${e}: tendría que transcribir`);
    assert.equal(c.filas.length, 1, `${e}: una fila por transcripción, no ${c.filas.length}`);
    const f = c.filas[0];
    assert.equal(f.feature, 'cursos-transcribir', `${e}: la fila dice qué fue`);
    assert.equal(f.provider, x.provider, `${e}: la fila dice quién escuchó`);
    assert.match(f.model, x.model, `${e}: con su modelo`);
    assert.equal(f.workspace_id, 9, `${e}: en el workspace de la plataforma`);
    assert.match(String(f.motivo), /clase-03\.m4a/, `${e}: el motivo nombra la clase`);
    if (x.paga) assert.ok(f.cost_usd > 0, `${e}: el whisper-1 cobra por segundo`);
    else assert.equal(f.cost_usd, 0, `${e}: ${x.provider} no cobra`);
  }
  // Los 60 s del whisper-1 a US$0,006 por minuto.
  assert.ok(Math.abs(SERVIDOR.openai.filas[0].cost_usd - 0.006) < 1e-9, `el costo del whisper-1 sale de los segundos (${SERVIDOR.openai.filas[0].cost_usd})`);
});

test('2. lo que rebotó no deja fila, y si no escuchó nadie no queda ninguna', () => {
  assert.equal(SERVIDOR.ninguno.status, 'error');
  assert.deepEqual(SERVIDOR.ninguno.filas, []);
});

test('3. en un script de línea de comandos la transcripción sale igual, sin anotar', () => {
  assert.equal(SCRIPT.error, undefined, String(SCRIPT.error));
  for (const e of ['groq', 'openai', 'gemini'] as const) {
    assert.equal(SCRIPT[e].status, 'ok', `${e}: anotar no puede tumbar una transcripción`);
    assert.deepEqual(SCRIPT[e].filas, [], `${e}: sin servidor no hay dónde anotar`);
  }
});
