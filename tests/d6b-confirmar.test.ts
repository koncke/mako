// =============================================================================
// D6b al CONFIRMAR una tarjeta: lo que se ejecuta después del toque tampoco va a la Gemini gratis (21/10/2026)
// =============================================================================
// La segunda revisión del Cerebro: una tarjeta con costo de IA (analizar una hoja, el insight de un lead, una landing)
// se ejecuta al confirmarla —en el chat, en la bandeja /mako/pendientes o en /mako/revisar—, no en el turno que la
// propuso, y ahí no había «sólo su IA»: los números del negocio iban a la Gemini y la Groq gratis. Lo que fija este
// archivo, CORRIENDO los caminos reales (tests/_d6b-confirmar-hijo.ts):
//   1. el control: la misma ejecución, fuera, sale a Gemini y a Groq (si no, la prueba no vería nada);
//   2. `confirmarDesdeTarjeta` (el chat de la app, el teléfono, el CRM y el Analyst) y la acción de la bandeja corren la
//      tarjeta ADENTRO del contexto: ni un pedido a un proveedor gratis;
//   3. /mako/revisar prende el contexto antes de aplicar (leído: su acción pide la sesión del navegador).
//
// PROBADO ROMPIÉNDOLO (21/10/2026): sacar el contexto de `confirmarDesdeTarjeta`, de la bandeja o de /mako/revisar → cada
// una cae acá (los números en docs/hallazgos-ia.md).
//
// Correr: npx tsx --test tests/d6b-confirmar.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;

type Camino = { red: string[]; adentro: boolean | null; ok?: unknown };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_d6b-confirmar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Camino> & { error?: string };

test('el control: la tarjeta fuera de «sólo su IA» sale a Gemini y a Groq', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.control.adentro, false);
  assert.ok(R.control.red.some((h) => GRATIS.test(h)), `el control no salió a la red gratis: ${R.control.red.join(', ')}`);
});

test('confirmar en el chat y en la bandeja corre la tarjeta adentro: cero pedidos a la red gratis', () => {
  for (const camino of ['tarjetaDelChat', 'bandeja'] as const) {
    const c = R[camino];
    assert.equal(c.ok, true, `${camino}: la confirmación no terminó (${String(c.ok)})`);
    // Rota: sacar el contexto de ese camino → este test falla.
    assert.equal(c.adentro, true, `${camino}: la tarjeta corrió fuera de «sólo su IA»`);
    assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), [], `${camino} salió a un proveedor gratis`);
  }
});

test('/mako/revisar prende el contexto antes de aplicar la propuesta (y lo que va por detrás lo hereda)', () => {
  const r = sinComentarios(leer('app/mako/revisar/[id]/acciones.ts'));
  const prende = r.indexOf('entrarSoloSuIA((await negocioConSuIA(c.ctx.ws)).suIA);');
  // Rota: sacarlo, o prenderlo después de aplicar → este test falla.
  assert.ok(prende > 0, 'prende el contexto');
  assert.ok(prende < r.indexOf('enSegundoPlano(') && prende < r.indexOf('await aplicarPropuestaGenerica('), 'antes de aplicar, también lo que va por detrás');
  assert.ok(prende > r.indexOf('const c = await ctxDeBandeja();'), 'después de un await de la acción: en la acción misma, no en quien la llama');
});
