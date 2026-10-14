import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instanteDeReunionManual } from '../app/crm/horarios-respuesta';

/**
 * Mover a mano a una etapa con reunión pregunta también la HORA. Martín (14/10/2026, por el chat de
 * Automations): «con respecto a la fecha, si, sería bueno que si se mueve a mano, se pregunte la
 * hora». Sin `junta_N_at`, el «1 h antes» de Automations nunca sale a un agendado a mano.
 *
 * Verificado rompiéndolo (base 3/0): la conversión en UTC en vez de la zona del negocio, 1 fallo;
 * conservar la hora vieja con otra fecha, 1 fallo; el server sin escribir `junta_1_at`, 1 fallo; el
 * wizard sin mandar la hora, 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('la hora se toma en la zona del NEGOCIO, y sin hora sólo se conserva la del mismo día', () => {
  // 18:30 en Ciudad de México (UTC-6) es 00:30 UTC del día siguiente.
  assert.equal(instanteDeReunionManual('2026-10-20', '18:30', 'America/Mexico_City', null), '2026-10-21T00:30:00.000Z');
  // Sin hora: la que ya estaba, si es de ese día en esa zona…
  assert.equal(instanteDeReunionManual('2026-10-20', '', 'America/Mexico_City', '2026-10-21T00:30:00.000Z'), '2026-10-21T00:30:00.000Z');
  // …y si la fecha cambió, ninguna: la hora vieja sería de otra reunión.
  assert.equal(instanteDeReunionManual('2026-10-25', null, 'America/Mexico_City', '2026-10-21T00:30:00.000Z'), null);
  assert.equal(instanteDeReunionManual('2026-10-20', '25:00', 'UTC', null), null, 'una hora que no existe no inventa un instante');
  assert.equal(instanteDeReunionManual(null, '10:00', 'UTC', '2026-10-21T00:30:00.000Z'), null, 'sin fecha no hay reunión');
});

test('el server escribe la hora con la fecha que vino, contra lo que ya tenía el lead', () => {
  const ACC = leer('../app/crm/actions.ts');
  assert.match(ACC, /if \(d\.fechaJ1 !== undefined\) horas\.junta_1_at = instanteDeReunionManual\(d\.fechaJ1, d\.horaJ1, tzHora, before\?\.junta_1_at\);/);
  assert.match(ACC, /if \(d\.fechaJ2 !== undefined\) horas\.junta_2_at = instanteDeReunionManual\(d\.fechaJ2, d\.horaJ2, tzHora, before\?\.junta_2_at\);/);
  assert.match(ACC, /const tzHora = wsHora != null \? await tzDeWorkspace\(wsHora\)/, 'la zona es la del negocio, no la del navegador');
});

test('el wizard pregunta la hora junto a la fecha y la manda', () => {
  const UI = leer('../app/crm/StageMoveDialog.tsx');
  assert.match(UI, /\{ fechaJ1: fechaJ1 \|\| null, horaJ1: horaJ1 \|\| null \}/);
  assert.match(UI, /\{ fechaJ2: fechaJ2 \|\| null, horaJ2: horaJ2 \|\| null \}/);
  assert.equal((UI.match(/<FechaYHora fecha=/g) ?? []).length, 2, 'los dos pasos de fecha');
  assert.match(UI, /<input type="time" value=\{hora\}/);
});
