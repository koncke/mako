// =============================================================================
// Reagendar: la hora se resuelve en la zona del WORKSPACE, no la del navegador
// =============================================================================
// El bug que blindan estos guards no tiene síntoma en pantalla: el wizard dice
// "6:00 PM", el resumen dice "6:00 PM", y lo que se guarda es otro instante. Se
// nota recién cuando al invitado le llega el mail de Google con la hora corrida
// (sendUpdates=all), o cuando `fecha_junta_N` y `junta_N_at` caen en días
// distintos y el lead entra o sale del worklist a destiempo.
//
// La causa era `new Date('YYYY-MM-DDTHH:mm')` en el cliente: por spec eso es hora
// LOCAL DEL NAVEGADOR. Solo el camino con slot verificado estaba bien, y `slots`
// llega en null en TODO workspace sin Google Calendar conectado — o sea que ahí el
// 100% de los reagendados pasaba por el parseo del navegador.
//
// Son guards de CABLEADO (mismo patrón que stage-requirements.test.ts): la lógica
// en sí ya está cubierta por instanteDeLocal en tests/horarios-grilla.test.ts; lo
// que se puede volver a romper es que alguien reconecte los cables al revés.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instanteDeLocal } from '../app/crm/horarios-respuesta';

/** Normalizado a \n: en Windows el CRLF rompe los cortes por '\n}\n'. */
const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** El cuerpo de una función, desde su firma hasta el primer cierre a nivel 0. */
function cuerpoDe(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.notEqual(i, -1, `no encontré «${firma}» — ¿la renombraron?`);
  const resto = src.slice(i);
  return resto.slice(0, resto.indexOf('\n}\n'));
}

test('CABLEADO: el navegador manda HH:MM, nunca un instante que armó él', () => {
  const src = leer('../app/crm/CrmBoard.tsx');
  assert.ok(
    /reagendarReunionAction\(leadId, cual, reagFecha, reagHora,/.test(src),
    'la hora tiene que viajar pelada: el cliente no sabe en qué zona vive el negocio',
  );
  assert.ok(
    !/new Date\(`\$\{reagFecha\}T\$\{reagHora\}`\)\.toISOString\(\)/.test(src),
    'volvió el parseo en zona del navegador al guardar',
  );
});

test('CABLEADO: el server convierte con la zona del workspace', () => {
  const fn = cuerpoDe(leer('../app/crm/actions.ts'), 'export async function reagendarReunionAction');
  assert.ok(fn.includes('tzDeWorkspace'), 'sin la zona del workspace no hay conversión correcta posible');
  assert.ok(fn.includes('instanteDeLocal'), 'tiene que usar la MISMA función que arma la grilla');
  assert.ok(
    !/timeZone:\s*'America\//.test(fn),
    'el historial de reagendado no puede formatearse en una zona fija: es multi-inquilino',
  );
  assert.ok(/timeZone:\s*tzWs/.test(fn), 'el historial se escribe en la zona del workspace');
});

test('CABLEADO: la duración real viaja del wizard al calendario', () => {
  // Leer y escribir usaban duraciones distintas: la grilla calculaba los huecos
  // con 45' fijos y el PATCH conservaba la duración REAL del evento. Una R1 de 60'
  // se ofrecía a las 18:30 teniendo algo a las 19:15, y terminaba encima.
  const board = leer('../app/crm/CrmBoard.tsx');
  assert.ok(board.includes('duracionReunionAction'), 'el wizard tiene que preguntar cuánto dura de verdad');
  const acciones = leer('../app/crm/actions.ts');
  assert.ok(
    /moverEnCalendario\(antes, cual, at, opts\.duracionMin\)/.test(acciones),
    'la duración con la que se calcularon los huecos tiene que llegar al alta del evento',
  );
});

test('la conversión da el MISMO instante que el slot que vio el usuario', () => {
  // Es la razón por la que se puede mandar HH:MM en vez del inicioIso del slot:
  // el server rehace exactamente la cuenta que hizo al armar la grilla.
  const tz = 'America/Montevideo';
  assert.equal(instanteDeLocal('2026-08-10', 18 * 60, tz), '2026-08-10T21:00:00.000Z');
  // Y una hora tipeada fuera de la grilla entra por el mismo camino.
  assert.equal(instanteDeLocal('2026-08-10', 18 * 60 + 7, tz), '2026-08-10T21:07:00.000Z');
});

test('dos zonas distintas para la misma hora local dan instantes distintos', () => {
  // El escenario exacto del bug: negocio en Montevideo, closer en Ciudad de México.
  const mvd = instanteDeLocal('2026-08-10', 18 * 60, 'America/Montevideo');
  const mex = instanteDeLocal('2026-08-10', 18 * 60, 'America/Mexico_City');
  assert.notEqual(mvd, mex, 'si dieran igual, este test no probaría nada');
});
