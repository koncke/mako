import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  preparaUnaReunion,
  TRIGGER_AGENDA_CONOCIDO,
  TRIGGER_AGENDA_NUEVO,
  TRIGGER_AGENDA_SIN_CONFIRMAR,
} from '../lib/nutricion-familias';

// =============================================================================
// Si la reunión ya pasó, la post-agenda no manda nada
// =============================================================================
// La guarda existía, pero solo para el paso con `ancla: 'reunion'`. Los pasos de la
// post-agenda no están anclados: salen 1 h y 24 h después de AGENDARSE. Con la línea de
// Mauricio caída 22 días, el reintento diario empujó a sus dos únicos leads en cola (2439 y
// 2400) hasta DESPUÉS de su reunión — medido el 25/09/2026 en producción: reuniones el 23/09 y
// el 25/09 20:00, primer audio programado el 25/09 21:00. El mensaje era «te dejo el video
// para que llegues con contexto», con la voz del dueño.
//
// Probado rompiéndolo, las dos mitades:
//   · `preparaUnaReunion` devolviendo siempre false → cae el primer test (3 pasan / 1 falla).
//   · sacando `|| preparaUnaReunion(sec.trigger_tipo)` del motor → caen los DOS del cableado
//     (2 pasan / 2 fallan), porque el segundo se ancla en esa misma condición.
//   · con el trozo por BLOQUE (06/10/2026, #789): las dos de arriba dan lo mismo (3/1 y 2/2), y
//     dejando `proximo_envio_at: enHorasISO(24)` en el cierre cae el cuarto (3 pasan / 1 falla).
// Como está: 4/4.

test('preparaUnaReunion cubre las dos mitades de la post-agenda y la vieja', () => {
  assert.equal(preparaUnaReunion(TRIGGER_AGENDA_CONOCIDO), true);
  assert.equal(preparaUnaReunion(TRIGGER_AGENDA_NUEVO), true);
  // La secuencia #199 de ws1 sigue existiendo con este trigger: si alguien la reactiva, sus
  // tres pasos también hablan de una reunión.
  assert.equal(preparaUnaReunion(TRIGGER_AGENDA_SIN_CONFIRMAR), true);
});

test('preparaUnaReunion NO se lleva puesta a las demás secuencias', () => {
  // Éstas no hablan de ninguna reunión: cerrarlas por «la reunión ya pasó» sería matar la
  // nutrición de alguien que nunca agendó.
  for (const t of ['instant_form_sin_agenda', 'vio_vsl_sin_agendar', 'reactivacion_viejo', 'no_show_j1', 'post_j2_sin_cerrar', 'etapa_actual', '']) {
    assert.equal(preparaUnaReunion(t), false, t || '(vacío)');
  }
});

/** Sin `\r`: en un checkout de Windows el archivo llega con CRLF (aprendido a la mala). */
const MOTOR = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

test('el motor pregunta por la reunión también cuando el paso NO está anclado', () => {
  // El guard mira el fuente porque la decisión vive en una condición del loop de envío, que
  // no se puede importar: `procesarEnvios` arrastra todo el runtime de Next.
  // Desde el 08/10/2026 «anclada» es el `ancla` de siempre O la espera «N antes de la reunión»
  // del flujo con tarjetas: un recordatorio que cuelga de esa espera re-mira la agenda igual.
  // Probado rompiéndolo (08/10/2026): `anclada` sin la espera del flujo → 1 falla (3/1).
  assert.match(
    MOTOR,
    // Undécima tanda (M2): «prepara una reunión» mira la automatización entera (`preparaReunion(sec)`).
    /if \(anclada \|\| preparaReunion\(sec\)\) \{\s*if \(reunionFuturaMs\(lead\) == null\)/,
    'procesarEnvios volvió a mirar solo `paso.ancla`: la post-agenda vuelve a mandar tarde',
  );
  assert.match(MOTOR, /const anclada = paso\.ancla === 'reunion' \|\| minAntes != null;/);
  assert.match(MOTOR, /const minAntes = minutosAntesDeReunion\(sec\.pasos, insc\.paso_actual\);/);
});

test('y cerrar por reunión pasada NO deja la inscripción para mañana', () => {
  // Cerrar mal acá es peor que no cerrar: una inscripción con `proximo_envio_at` viva vuelve a
  // intentar mañana, y el reintento es justo lo que produjo el atraso.
  //
  // ⚠️ EL TROZO ES EL BLOQUE, desde la condición entera hasta el bloque que le sigue (el
  // re-anclado). Se cortaba desde la PRIMERA aparición de `preparaUnaReunion(sec.trigger_tipo)`
  // + 700 caracteres, y desde el 06/10/2026 (#789) esa cadena aparece antes en el archivo —el
  // reuso de inscripciones también pregunta si la secuencia prepara una reunión—: el guard
  // pasó a mirar otra función y falló sobre un motor sano.
  // Undécima tanda: la condición es `preparaReunion(sec)` (M2) y el bloque que le sigue es el del carril del
  // recordatorio (`let carril: {`), que reemplazó al re-anclado.
  const ini = MOTOR.indexOf('if (anclada || preparaReunion(sec))');
  const fin = MOTOR.indexOf('let carril: {', ini);
  assert.ok(ini >= 0 && fin > ini, 'no encontré el bloque de «la reunión ya pasó» en procesarEnvios');
  const trozo = MOTOR.slice(ini, fin);
  assert.ok(trozo.length < 1500, `el bloque mide ${trozo.length}: está mirando otra cosa`);
  assert.match(trozo, /estado: 'completada', proximo_envio_at: null/);
});
