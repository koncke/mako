// =============================================================================
// Lo que se parecía a lo pedido y no viajó: lo que le faltaba al ticket de un «no puedo» falso (31/10/2026)
// =============================================================================
// El recorte del presupuesto de 12.000 caracteres avisaba con un `console.warn` que nadie lee, y `cambiar_crons_secuencia`
// quedó afuera hasta que el piso de la batería lo cazó de casualidad. Ahora, cuando MaKo dice «no puedo», el ticket trae las
// operaciones parecidas que no viajaron (el camino entero con su base simulada, en tests/no-pude-server.test.ts).
//
// Probado rompiéndolo (31/10/2026), cada rotura corrida y restaurada:
//   · sin filtrar lo que viajó                              → rojo 2
//   · sin `.filter((x) => x.p > 0)`                         → rojo 3
//   · sin `visible`                                         → rojo 4
//   · sin el tope                                           → rojo 5
//   · `sanearContexto` sin `noViajaron`                     → rojo 6
//   · la app sin pasarlo al ticket                          → rojo 7
//   · el grupo sin pasarlo al ticket                        → rojo 7
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parecidasQueNoViajaron, REGISTRO } from '../lib/api-mako/registro';
import { sanearContexto } from '../lib/tickets-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
const FRASE = 'Hacé que la automatización de reactivación salga todos los martes a las 15';

test('1. nombra la operación que MaKo necesitaba y no viajó', () => {
  assert.ok(parecidasQueNoViajaron({ vista, pedido: FRASE, viajaron: [], tope: 30 }).includes('cambiar_crons_secuencia'));
});

test('2. lo que viajó no se nombra', () => {
  const nombres = parecidasQueNoViajaron({ vista, pedido: FRASE, viajaron: ['cambiar_crons_secuencia'], tope: 30 });
  assert.ok(!nombres.includes('cambiar_crons_secuencia'));
});

test('3. sin parecido no nombra nada: un ticket con ruido se deja de leer', () => {
  assert.deepEqual(parecidasQueNoViajaron({ vista, pedido: 'zzzqx wwwkj', viajaron: [] }), []);
  assert.deepEqual(parecidasQueNoViajaron({ vista, pedido: 'sí', viajaron: [] }), []);
});

test('4. lo que esta persona no puede usar no cuenta como «no viajó»', () => {
  const soloPlataforma = REGISTRO.find((d) => d.id === 'vender_plan_mako');
  assert.ok(soloPlataforma?.gating?.soloPlataforma, 'vender_plan_mako dejó de ser sólo de la plataforma: elegir otra');
  const nombres = parecidasQueNoViajaron({ vista, pedido: `${soloPlataforma.id} ${soloPlataforma.titulo}`, viajaron: [], tope: 400 });
  assert.ok(!nombres.includes('vender_plan_mako'));
});

test('5. trae las más parecidas, con tope', () => {
  const nombres = parecidasQueNoViajaron({ vista, pedido: FRASE, viajaron: [] });
  assert.equal(nombres.length, 6);
  assert.equal(nombres.join(), parecidasQueNoViajaron({ vista, pedido: FRASE, viajaron: [], tope: 30 }).slice(0, 6).join());
});

test('6. el contexto del ticket lo guarda, y con tope', () => {
  assert.equal(sanearContexto({ noViajaron: 'cambiar_crons_secuencia' }).noViajaron, 'cambiar_crons_secuencia');
  assert.equal(sanearContexto({ noViajaron: 'x'.repeat(900) }).noViajaron?.length, 300);
});

test('7. los dos chats se lo pasan al ticket', () => {
  const trozo = (src: string) => src.slice(src.indexOf('const np = await conTicketsDeMaKo('), src.indexOf('const np = await conTicketsDeMaKo(') + 500);
  assert.match(trozo(fuente('lib/mako-turno-app.ts')), /noViajaron: \(\) => parecidasQueNoViajaron\(\{ vista, pedido: dondeDelTurno\.pedido \?\? '', viajaron: tools\.map/);
  assert.match(trozo(fuente('lib/mako-doer-in.ts')), /noViajaron: \(\) => parecidasQueNoViajaron\(\{ vista: vistaDelTurno, pedido: texto, viajaron: tools\.map/);
});
