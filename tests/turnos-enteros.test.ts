// =============================================================================
// Los turnos de los chats llegan ENTEROS al Ops Center: el corte a 4000 pasa a ser un tope técnico (25/10/2026)
// =============================================================================
// Martín: «que no haya nunca un limite de caracteres, en todo caso achica el mensaje y hazlo más claro». Hasta ese día la PC
// cortaba cada turno a 4000 caracteres y el «Completado» decía «Cortado a los 4000 caracteres». El Cerebro: que llegue entero,
// con sólo un tope técnico muy alto contra abusos, primero en el servidor y después en el cartero. Esto fija:
//   1. el servidor guarda entero lo que contesta el chat y lo de Martín, hasta el tope técnico (200.000);
//   2. un chat no pesa megas: se guardan sus turnos más nuevos que entren en `TEXTO_POR_CHAT` (el último, siempre);
//   3. lo cortado se reconoce igual: justo 4000 (un cartero viejo) o el tope nuevo; lo demás no;
//   4. el cartero (1.19.0) tiene la MISMA copia del tope, sube entero, y reparte la vuelta por un presupuesto de texto para no
//      pasar el límite del cuerpo (lo que no entra, en la vuelta siguiente; el primer chat entra siempre, con lo más nuevo).
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): el servidor con el tope de 4000 → 3 rojos (1, 3 y 4: la copia del cartero ya no
// es igual); `unirTurnos` sin el presupuesto →
// 1 rojo (2); `cortadoPorLaPC` sin el tope viejo → 1 rojo (3); el cartero sin el presupuesto de la vuelta → 1 rojo (4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEXTO_POR_CHAT, TOPE_TURNO, TOPE_TURNO_VIEJO, sanearTurnos, unirTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { cortadoPorLaPC } from '../lib/centro-chats';

const S = 'local_00000001-0000-4000-8000-000000000000';
const turno = (uuid: string, minuto: number, largo: number, rol: TurnoChat['rol'] = 'el'): TurnoChat =>
  ({ local: S, uuid, rol, de: null, texto: 'x'.repeat(largo), at: new Date(Date.UTC(2026, 9, 25, 12, minuto)).toISOString(), trabajo: null });

test('1. el servidor guarda entero lo que contesta el chat y lo de Martín, hasta el tope técnico', () => {
  assert.equal(TOPE_TURNO, 200_000);
  const [el, yo, abuso] = sanearTurnos([turno('u-el-00000001', 1, 50_000), turno('u-yo-00000001', 2, 60_000, 'yo'), turno('u-ab-00000001', 3, 250_000)]);
  assert.equal(el.texto.length, 50_000, 'lo del chat, entero');
  assert.equal(yo.texto.length, 60_000, 'lo de Martín, entero (antes, hasta 40.000)');
  assert.equal(abuso.texto.length, TOPE_TURNO, 'sólo un abuso se corta');
});

test('2. un chat no pesa megas: sus turnos más nuevos que entren, y el último siempre', () => {
  assert.equal(TEXTO_POR_CHAT, 600_000);
  const viejos = [turno('a0000001', 1, 250_000), turno('a0000002', 2, 250_000)];
  const r = unirTurnos(viejos, [turno('a0000003', 3, 250_000)]);
  assert.deepEqual(r.map((t) => t.uuid), ['a0000002', 'a0000003'], 'se va el más viejo');
  assert.deepEqual(unirTurnos([], [turno('b0000001', 1, 199_000), turno('b0000002', 2, 199_000)]).length, 2);
  assert.deepEqual(unirTurnos([turno('c0000001', 1, 100)], [turno('c0000002', 2, 700_000)]).map((t) => t.uuid), ['c0000002'], 'el último, aunque solo lo pase');
});

test('3. lo cortado se reconoce igual: justo 4000 (un cartero viejo) o el tope nuevo', () => {
  assert.equal(TOPE_TURNO_VIEJO, 4000);
  assert.equal(cortadoPorLaPC('x'.repeat(4000)), true, 'un cartero viejo cortaba ahí');
  assert.equal(cortadoPorLaPC('x'.repeat(4001)), false);
  assert.equal(cortadoPorLaPC('x'.repeat(12_000)), false, 'entero');
  assert.equal(cortadoPorLaPC('x'.repeat(TOPE_TURNO)), true);
});

test('4. el cartero 1.19.0: la misma copia del tope, sube entero, y reparte la vuelta por un presupuesto de texto', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(c.TOPE_TURNO, TOPE_TURNO, 'la copia del cartero y la del servidor, iguales');
  assert.ok(['1.19.0', '1.20.0', '1.21.0', '1.22.0', '1.22.1', '1.23.0', '1.24.0', '1.25.0', '1.26.0', '1.26.1'].includes(c.VERSION), 'los turnos enteros llegaron en la 1.19.0');
  const largo = 'Lo que contestó el chat. '.repeat(2000);
  const lineas = [
    JSON.stringify({ type: 'user', uuid: 'u-yo-00000009', timestamp: '2026-10-25T12:00:00Z', message: { content: 'contame todo' } }),
    JSON.stringify({ type: 'assistant', uuid: 'u-el-00000009', timestamp: '2026-10-25T12:01:00Z', message: { content: [{ type: 'text', text: largo }] } }),
    JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', uuid: 's-00000009', timestamp: '2026-10-25T12:01:01Z' }),
  ];
  const el = c.turnosDeLineas(lineas).turnos.find((t: { rol: string }) => t.rol === 'el');
  assert.equal(el?.texto.length, largo.trim().length, 'sube entero (hasta la 1.18, 4000)');
  // La vuelta: por cantidad y por texto; el primer chat entra siempre, con lo más nuevo que entre.
  const t = (n: number) => ({ texto: 'x'.repeat(n) });
  assert.equal(c.entraEnLaVuelta(0, 0, [t(5_000_000)]), true, 'el primero entra siempre');
  assert.equal(c.entraEnLaVuelta(1, 1_000_000, [t(600_000)]), false, 'pasaría el presupuesto: a la vuelta siguiente');
  assert.equal(c.entraEnLaVuelta(1, 1_000_000, [t(400_000)]), true);
  assert.deepEqual(c.ultimosQueEntran([t(900_000), t(900_000), t(100)]).map((x: { texto: string }) => x.texto.length), [900_000, 100], 'lo más nuevo que entra');
  assert.equal(c.ultimosQueEntran([t(3_000_000)]).length, 1, 'el último, aunque solo lo pase');
  const src = readFileSync(join(__dirname, '..', 'scripts/operaciones/cartero.mjs'), 'utf8');
  assert.match(src, /if \(!entraEnLaVuelta\(turnos\.length, texto, n\.turnos\)\) break;\s*const suyos = ultimosQueEntran\(n\.turnos\.slice\(-MAX_TURNOS_VUELTA\)\);/, 'la vuelta usa el presupuesto');
});
