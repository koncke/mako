// =============================================================================
// D6b al CONFIRMAR una tarjeta: lo que se ejecuta después del toque tampoco va a la Gemini gratis (21/10/2026)
// =============================================================================
// La segunda revisión del Cerebro: una tarjeta con costo de IA (analizar una hoja, el insight de un lead, una landing)
// se ejecuta al confirmarla —en el chat, en la bandeja /mako/pendientes o en /mako/revisar—, no en el turno que la
// propuso, y ahí no había «sólo su IA»: los números del negocio iban a la Gemini y la Groq gratis. Lo que fija este
// archivo, CORRIENDO los caminos reales (tests/_d6b-confirmar-hijo.ts):
//   1. el control: la misma ejecución, fuera, corre afuera de «sólo su IA» y aun así no lleva una clave de la plataforma
//      (IA16, 22/10/2026: MaKo no le presta IA a un negocio); en la plataforma (ws9) sí sale con la suya, que es lo que
//      prueba que el anotador ve una clave de la plataforma cuando sale (si no, la prueba no vería nada);
//   2. `confirmarDesdeTarjeta` (el chat de la app, el teléfono, el CRM y el Analyst) y la acción de la bandeja corren la
//      tarjeta ADENTRO del contexto: ni un pedido a un proveedor gratis;
//   3. /mako/revisar prende el contexto antes de aplicar (leído: su acción pide la sesión del navegador).
//
// PROBADO ROMPIÉNDOLO (21/10/2026): sacar el contexto de `confirmarDesdeTarjeta`, de la bandeja o de /mako/revisar → cada
// una cae acá (los números en docs/hallazgos-ia.md).
// Y con IA16 sobre main (23/10/2026), base 4/0: abrirle la red de la plataforma a un negocio (sacar el corte por workspace de
// `provsGratisDePlataforma`) → 1 fallo (el control), 3 pases. El original volvió byte a byte.
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
// Lo que no puede salir de un negocio: una clave de la PLATAFORMA (el hijo anota «host#plataforma»), o un proveedor que no es su
// IA. Desde IA16 su Gemini ES su IA (Martín, 22/10/2026: «Cada usuario debe poder pagar su token, su propia IA de gemini»): un
// pedido a Gemini con SU clave («#negocio») no es una fuga, y antes este archivo lo contaba como una (dos rojos al mergear main).
const FUGA = /#plataforma$|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;

type Camino = { red: string[]; adentro: boolean | null; ok?: unknown };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_d6b-confirmar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Camino> & { error?: string };

test('el control: fuera de «sólo su IA» la tarjeta corre afuera, y ni así lleva una clave de la plataforma (IA16)', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.control.adentro, false);
  // Rota: abrirle la red de la plataforma a un negocio (sacar el corte por workspace de `provsGratisDePlataforma`) → falla.
  assert.deepEqual(R.control.red.filter((h) => FUGA.test(h)), [], `afuera, el negocio salió con la IA de MaKo: ${R.control.red.join(', ')}`);
  // El anotador sí ve una clave de la plataforma: en la plataforma, la misma tarjeta sale con la suya.
  assert.ok(R.controlPlataforma.red.some((h) => h.endsWith('#plataforma')), `el anotador no vio la clave de la plataforma: ${R.controlPlataforma.red.join(', ')}`);
});

test('IA6: a pelo dentro del negocio, sin que nadie decida, la puerta de la capa de IA la pone adentro: cero pedidos a la red gratis', () => {
  // Antes de IA16, sacar la puerta de lib/ai-cheap.ts (`conD6bDelPedido`) lo ponía rojo. Desde IA16 hay dos cerrojos: ni
  // afuera de D6b la plataforma le presta a un negocio, así que sacar la puerta sola ya no fuga (lo fija el control).
  assert.deepEqual(R.aPelo.red.filter((h) => FUGA.test(h)), [], `a pelo salió a un proveedor gratis: ${R.aPelo.red.join(', ')}`);
});

test('confirmar en el chat y en la bandeja corre la tarjeta adentro: cero pedidos a la red gratis', () => {
  for (const camino of ['tarjetaDelChat', 'bandeja'] as const) {
    const c = R[camino];
    assert.equal(c.ok, true, `${camino}: la confirmación no terminó (${String(c.ok)})`);
    // Rota: sacar el contexto de ese camino → este test falla.
    assert.equal(c.adentro, true, `${camino}: la tarjeta corrió fuera de «sólo su IA»`);
    assert.deepEqual(c.red.filter((h) => FUGA.test(h)), [], `${camino} salió con la IA de MaKo o a un proveedor que no es su IA`);
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
