// =============================================================================
// Cuándo le toca inscribir a una secuencia: por tiempo o por una acción
// =============================================================================
// Lo que esto decide es si salen mensajes de WhatsApp, así que el caso que más importa
// es el que NO tiene que pasar: una secuencia recién configurada «por tiempo» no puede
// disparar en el momento en que alguien elige el horario, y un cron caído un día no
// puede mandar las 24 ocurrencias perdidas de golpe.
//
// El otro caso crítico es `cron: null` — las 62 filas de producción —, que tiene que
// seguir contestando exactamente lo de antes: inscribe en cada corrida.
// ⚠️ PROBADO ROMPIÉNDOLO, que es lo único que distingue un test de una afirmación.
// Las seis roturas y lo que contestó cada una (11 tests en total):
//
//   sembrar DISPARA (toca: true al sembrar) .............. 2 fallos / 9 pases
//   ancla en `ahora` en vez de la agendada ............... 1 fallo  / 10 pases
//   `cron: null` devuelve toca: false ................... 2 fallos / 9 pases
//   una fecha ilegible se trata como «ya toca» .......... 2 fallos / 9 pases
//   el dry-run sin la puerta del horario ................ 1 fallo  / 10 pases
//   el update sin el compare-and-set .................... 1 fallo  / 10 pases
//
// La segunda es la que vale la regla: la PRIMERA versión de ese test usaba «los lunes a
// las 9» y daba 11/11 EN VERDE con el ancla rota. Ver su comentario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidirAgenda } from '../lib/nutricion-agenda';
import type { CronAviso } from '../lib/cron-aviso';

const TZ = 'America/Tijuana';
const LUNES_9 = { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 1 } as CronAviso;
const CADA_DIA_9 = { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } as CronAviso;

// ── Por una acción: el comportamiento de siempre ────────────────────────────
test('sin horario inscribe en cada corrida, y no escribe nada', () => {
  // Las 62 filas de la base tienen `cron` NULL. Si esto devolviera false, la nutrición
  // entera dejaría de inscribir SIN UN SOLO ERROR — el modo de falla más caro del
  // cambio, y el único que no se nota mirando la pantalla.
  const d = decidirAgenda({ cron: null, cronProximaAt: null }, TZ, new Date('2026-10-05T17:00:00Z'));
  assert.equal(d.toca, true);
  assert.equal(d.proxima, null);
});

test('sin horario, un cron_proxima_at que quedó colgado no frena nada', () => {
  // Apagar el horario deja la columna en null (setCronSecuencia), pero si una fila
  // quedara con la fecha puesta y el horario apagado, manda el horario apagado: lo que
  // decide es `cron`, no la fecha.
  const d = decidirAgenda({ cron: null, cronProximaAt: '2099-01-01T00:00:00Z' }, TZ, new Date('2026-10-05T17:00:00Z'));
  assert.equal(d.toca, true);
});

// ── Por tiempo ──────────────────────────────────────────────────────────────
test('sembrar NO dispara: con horario y sin ocurrencia, se agenda y se abstiene', () => {
  // ⚠️ ES EL CASO QUE PAGA EL TEST. Si sembrar disparara, elegir «todos los lunes a las
  // 9» mandaría los mensajes en ese mismo instante — lo contrario de lo que la persona
  // acaba de pedir, y sobre leads reales.
  const ahora = new Date('2026-10-05T17:00:00Z');
  const d = decidirAgenda({ cron: LUNES_9, cronProximaAt: null }, TZ, ahora);
  assert.equal(d.toca, false);
  assert.ok(d.proxima, 'tiene que dejar la ocurrencia agendada');
  assert.ok(new Date(d.proxima!).getTime() > ahora.getTime(), 'la primera ocurrencia es posterior a ahora');
});

test('antes de la hora se abstiene y no escribe nada', () => {
  const d = decidirAgenda({ cron: LUNES_9, cronProximaAt: '2026-10-12T16:00:00Z' }, TZ, new Date('2026-10-05T17:00:00Z'));
  assert.equal(d.toca, false);
  // `proxima: null` es «no hay nada que escribir»: un update por corrida sobre las 23
  // que no tocan es ruido y, peor, una carrera con la invocación que sí toca.
  assert.equal(d.proxima, null);
});

test('llegada la hora inscribe y avanza a la ocurrencia siguiente', () => {
  const agendada = '2026-10-05T16:00:00Z';          // lunes 9:00 de Tijuana
  const d = decidirAgenda({ cron: LUNES_9, cronProximaAt: agendada }, TZ, new Date('2026-10-05T16:04:00Z'));
  assert.equal(d.toca, true);
  assert.equal(d.proxima, '2026-10-12T16:00:00.000Z');
});

test('el ancla es la ocurrencia AGENDADA, no `ahora`: el horario no deriva', () => {
  /**
   * ⚠️ LA REGLA DE LA CASA, Y SE MIDE CON LA UNIDAD «HORA». Con `ahora` como ancla, una
   * corrida que llega 7 minutos tarde agenda la siguiente 7 minutos más tarde, después
   * 14, y el horario se corre para siempre sin que nada falle.
   *
   * ⚠️ Y VA CON `unidad: 'hora'` A PROPÓSITO: la PRIMERA versión de este test usaba
   * «los lunes a las 9» y pasaba en VERDE con el ancla rota (11/11), porque para día,
   * semana, mes y año `proximaOcurrencia` RECONSTRUYE la hora de pared desde el cron y
   * la deriva no puede sobrevivir. El único lado donde el ancla decide el resultado es
   * el relativo, y era justo el que el test no miraba — un verde sobre la propiedad
   * equivocada. Verificado rompiéndolo: con el ancla en `ahora`, 1 fallo / 10 pases.
   */
  const CADA_2H = { unidad: 'hora', cada: 2, hora: 0, minuto: 0 } as CronAviso;
  const d = decidirAgenda({ cron: CADA_2H, cronProximaAt: '2026-10-05T16:00:00Z' }, TZ, new Date('2026-10-05T16:07:33Z'));
  assert.equal(d.toca, true);
  assert.equal(d.proxima, '2026-10-05T18:00:00.000Z');
});

test('con el cron caído tres días, inscribe UNA vez y vuelve a la grilla', () => {
  // Un «cada día a las 9» con la ocurrencia del día 1 sin procesar y «ahora» en el día 4
  // no puede devolver las tres perdidas: inscribe una y agenda el día 5.
  const d = decidirAgenda({ cron: CADA_DIA_9, cronProximaAt: '2026-10-01T16:00:00Z' }, TZ, new Date('2026-10-04T18:00:00Z'));
  assert.equal(d.toca, true);
  assert.equal(d.proxima, '2026-10-05T16:00:00.000Z');
});

test('una fecha ilegible se trata como «nunca se sembró», no como «ya toca»', () => {
  // El default va para el lado que NO manda mensajes: con un valor corrupto en la
  // columna, disparar sería mandar sobre una cohorte entera por un dato roto.
  const d = decidirAgenda({ cron: LUNES_9, cronProximaAt: 'no es una fecha' }, TZ, new Date('2026-10-05T17:00:00Z'));
  assert.equal(d.toca, false);
  assert.ok(d.proxima);
});

// ── Las dos puertas del motor, cableadas ────────────────────────────────────
//
// ⚠️ UN GUARD DE CABLEADO NO REEMPLAZA A LOS TESTS DE ARRIBA: contesta «¿está
// enchufado?», nunca «¿hace lo que dice?». Van los dos.
const MOTOR = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8');

const bloque = (desde: string, hasta: string): string => {
  const i = MOTOR.indexOf(desde);
  assert.ok(i > 0, `no encontré ${desde}`);
  const j = MOTOR.indexOf(hasta, i);
  assert.ok(j > i, `no encontré el cierre de ${desde}`);
  return MOTOR.slice(i, j);
};

test('los DOS caminos de inscripción miran el horario', () => {
  // El dry-run también: un preview que no mira el horario miente sobre a quién va a
  // inscribir, y es lo que alguien lee antes de apretar.
  for (const fn of ['export async function planificarInscripciones', 'export async function comprometerInscripciones']) {
    const cuerpo = bloque(fn, '\n}\n');
    assert.ok(cuerpo.length < 3500, `el recorte de ${fn} mide ${cuerpo.length}: está mirando otra cosa`);
    assert.match(cuerpo, /decidirAgenda\(/, `${fn} no mira el horario`);
  }
});

test('el commit avanza la ocurrencia con compare-and-set y ANTES de inscribir', () => {
  const cuerpo = bloque('export async function comprometerInscripciones', '\n}\n');
  // El compare-and-set es lo único que impide que dos invocaciones del mismo tick
  // inscriban dos veces. Ya se midió en esta casa: 21 pares duplicados el 27/09.
  assert.match(cuerpo, /cron_proxima_at: agenda\.proxima/);
  // El compare-and-set en sí: sin el `.eq`, el update toca la fila igual y las dos
  // invocaciones del mismo tick creen las dos que reclamaron la ocurrencia.
  assert.match(cuerpo, /\.eq\('cron_proxima_at', sec\.cron_proxima_at\)/);
  assert.ok(
    cuerpo.indexOf('cron_proxima_at: agenda.proxima') < cuerpo.indexOf('nutricion_inscripciones'),
    'la marca tiene que ir ANTES del insert de inscripciones',
  );
});

test('el dry-run NO escribe la ocurrencia', () => {
  // Si el preview avanzara el ancla, el commit de al lado se quedaría sin su ocurrencia
  // y la secuencia no inscribiría nunca — con las dos mitades «funcionando».
  const cuerpo = bloque('export async function planificarInscripciones', '\n}\n');
  assert.doesNotMatch(cuerpo, /cron_proxima_at:/);
});
