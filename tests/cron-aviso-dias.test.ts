// =============================================================================
// El RECURRENTE del CRON: varios días, «el segundo martes», fecha de inicio y huso propio
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON punto 9, literal: «no puedo poner más de 1 día a la
// semana, martes y jueves por ejemplo... Copia el diseño de Google Calendar... Con un calendario
// para que se pueda seleccionar fecha, con un reloj para la hora... Y con respecto al huso horario,
// por defecto, siempre dejalo en el huso del usuario, pero que se pueda editar».
//
// Lo de siempre (un día, el día del mes, la zona del negocio) lo cuida tests/cron-aviso.test.ts y
// no cambia: un horario de antes —y los de /mensajes, que no ofrecen nada de esto— se sanea y se
// calcula idéntico. Lo que se persigue acá falla en silencio, como todo lo del horario: un martes y
// jueves que sale sólo el martes, un «cada 2 semanas» que se corre una, una fecha de inicio que se
// ignora y manda el día que se guardó.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), contra una base de 11 pass / 0 fail, una rotura por vez y
// restaurando de memoria:
//   · `proximaSemanalVarios` con semanas que arrancan en la PLANTA (sin el lunes)  → 10 / 1 (cada 2 semanas)
//   · sin anclar en la fecha de inicio (`antesDelPiso` siempre false)             →  9 / 2 (inicio y «cada hora»)
//   · `zonaDelCron` devolviendo siempre la del negocio                              → 10 / 1 (el huso)
//   · `diaDelOrdinal` sin el `(ordinal - 1) * 7`                                    → 10 / 1 (el segundo martes)
//   · `sanearCron` guardando `dias` también con UNO solo                           → 10 / 1 (lo de antes, idéntico)
// Restaurado: 11 / 0. (Un piso de `desde` adentro de `vale` se probó también y NO cambiaba nada: con
// el ancla puesta un milisegundo antes del inicio, era redundante, y se sacó.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearCron, textoCron, partesEn, instanteDe, proximaOcurrencia, zonaDelCron, type CronAviso } from '../lib/cron-aviso';

const AR = 'America/Argentina/Buenos_Aires';
const MX = 'America/Mexico_City';
const enAR = (y: number, m: number, d: number, h: number, min = 0) => instanteDe(AR, y, m, d, h, min);
const cron = (p: Partial<CronAviso>): CronAviso => sanearCron({ unidad: 'semana', cada: 1, hora: 9, minuto: 0, ...p })!;
const dia = (t: Date, tz = AR) => { const p = partesEn(tz, t); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')} ${p.h}:${String(p.min).padStart(2, '0')}`; };

/** Las próximas N ocurrencias, encadenadas como lo hace el motor (cada una ancla la siguiente). */
function serie(c: CronAviso, desde: Date, n: number, tz = AR): string[] {
  const out: string[] = [];
  let ant = desde;
  for (let i = 0; i < n; i++) { ant = proximaOcurrencia(c, ant, tz, ant); out.push(dia(ant, tz)); }
  return out;
}

test('el saneo: martes y jueves quedan en el orden de la semana; con UNO solo, como un horario de antes', () => {
  const c = cron({ dias: [4, 2, 2, 9, -1] });
  assert.deepEqual(c.dias, [2, 4]);
  assert.equal(c.diaSemana, 2, 'diaSemana es el primero: lo leen los que no saben de varios');
  // Domingo va AL FINAL (la semana arranca el lunes, como el diálogo del Plan).
  assert.deepEqual(cron({ dias: [0, 1] }).dias, [1, 0]);
  // Con uno solo NO se escribe la lista: el objeto es idéntico al de siempre.
  assert.deepEqual(cron({ dias: [3] }), { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 3 });
  // Los de antes no cambian.
  assert.deepEqual(sanearCron({ unidad: 'semana', diaSemana: 5 }), { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 5 });
});

test('martes y jueves: salen LOS DOS, todas las semanas', () => {
  // Lunes 5/10/2026.
  assert.deepEqual(serie(cron({ dias: [2, 4] }), enAR(2026, 10, 5, 10), 4), [
    '2026-10-06 9:00', '2026-10-08 9:00', '2026-10-13 9:00', '2026-10-15 9:00',
  ]);
});

test('⚠️ cada 2 semanas, martes y jueves, desde un MIÉRCOLES: jueves de esta, y el martes de dentro de DOS', () => {
  // Con semanas que arrancan en la planta (jueves), el martes siguiente caía en la «misma» semana y
  // salía cinco días después: no es lo que nadie eligió. Semanas de calendario, de lunes a domingo.
  assert.deepEqual(serie(cron({ cada: 2, dias: [2, 4] }), enAR(2026, 10, 7, 10), 3), [
    '2026-10-08 9:00', '2026-10-20 9:00', '2026-10-22 9:00',
  ]);
});

test('con UN día, el camino de varios da lo mismo que el de siempre (cada 1, 2 y 3 semanas)', () => {
  for (const cada of [1, 2, 3]) {
    const uno = { unidad: 'semana', cada, hora: 9, minuto: 0, diaSemana: 1 } as CronAviso;
    // `dias` con el mismo día repetido fuerza el camino de varios sin cambiar qué días son.
    const varios = { ...uno, dias: [1, 1] } as CronAviso;
    for (const desde of [enAR(2026, 10, 5, 10), enAR(2026, 10, 7, 10), enAR(2026, 10, 12, 8)]) {
      assert.deepEqual(serie(varios, desde, 4), serie(uno, desde, 4), `cada ${cada} desde ${dia(desde)}`);
    }
  }
});

test('con el cron caído un mes, manda UNA y sigue en su grilla', () => {
  const c = cron({ cada: 2, dias: [2, 4] });
  const anterior = enAR(2026, 10, 6, 9);              // martes 6/10, semana que vale
  const ahora = enAR(2026, 11, 9, 12);                // lunes 9/11: cinco semanas sin tick
  const prox = proximaOcurrencia(c, anterior, AR, ahora);
  // Semanas que valen: 5/10, 19/10, 2/11, 16/11 → la próxima es el martes 17/11.
  assert.equal(dia(prox), '2026-11-17 9:00');
});

test('«el segundo martes» y «el último viernes» de cada mes', () => {
  const segundoMartes = sanearCron({ unidad: 'mes', cada: 1, hora: 9, minuto: 0, ordinal: 2, diaSemana: 2 })!;
  assert.equal(segundoMartes.diaMes, undefined, 'con ordinal no hay día del mes');
  assert.deepEqual(serie(segundoMartes, enAR(2026, 10, 1, 10), 3), ['2026-10-13 9:00', '2026-11-10 9:00', '2026-12-08 9:00']);
  const ultimoViernes = sanearCron({ unidad: 'mes', cada: 1, hora: 18, minuto: 0, ordinal: -1, diaSemana: 5 })!;
  assert.deepEqual(serie(ultimoViernes, enAR(2026, 10, 1, 10), 2), ['2026-10-30 18:00', '2026-11-27 18:00']);
  // Un ordinal que no se entiende vuelve al día del mes.
  assert.equal(sanearCron({ unidad: 'mes', ordinal: 7, diaMes: 10 })!.diaMes, 10);
  // Y sólo es del mes.
  assert.equal(sanearCron({ unidad: 'anio', ordinal: 2, diaSemana: 2 })!.ordinal, undefined);
});

test('⚠️ la fecha de inicio: antes no sale, y la grilla ARRANCA ahí', () => {
  // Guardado hoy (lunes 5/10), «todos los días desde el jueves 8»: el primero es el jueves.
  const c = sanearCron({ unidad: 'dia', cada: 1, hora: 9, minuto: 0, desde: '2026-10-08' })!;
  assert.equal(c.desde, '2026-10-08');
  assert.equal(dia(proximaOcurrencia(c, enAR(2026, 10, 5, 10), AR, enAR(2026, 10, 5, 10))), '2026-10-08 9:00');
  // «Cada 2 días desde el jueves»: jueves, sábado — no viernes por haber contado desde hoy.
  const cada2 = sanearCron({ unidad: 'dia', cada: 2, hora: 9, minuto: 0, desde: '2026-10-08' })!;
  assert.deepEqual(serie(cada2, enAR(2026, 10, 5, 10), 2), ['2026-10-08 9:00', '2026-10-10 9:00']);
  // Semanal con varios días y la fecha de inicio en la semana que viene.
  const sem = cron({ dias: [2, 4], desde: '2026-10-14' });
  assert.deepEqual(serie(sem, enAR(2026, 10, 5, 10), 2), ['2026-10-15 9:00', '2026-10-20 9:00']);
  // Una fecha que no existe no se guarda.
  assert.equal(sanearCron({ unidad: 'dia', desde: '2026-02-30' })!.desde, undefined);
});

test('⚠️ el huso propio MANDA sobre el del negocio, y la frase nombra el que se usa', () => {
  const c = sanearCron({ unidad: 'dia', cada: 1, hora: 9, minuto: 0, tz: MX })!;
  assert.equal(zonaDelCron(c, AR), MX);
  assert.equal(zonaDelCron({}, AR), AR);
  // Pidiendo con la zona del negocio (Buenos Aires), sale a las 9 de MÉXICO.
  const prox = proximaOcurrencia(c, enAR(2026, 10, 5, 12), AR, enAR(2026, 10, 5, 12));
  assert.equal(dia(prox, MX), '2026-10-06 9:00');
  assert.match(textoCron(c, AR), /de America\/Mexico_City$/);
  // Una zona inventada no se guarda (y no tira el horario).
  assert.equal(sanearCron({ unidad: 'dia', tz: 'Marte/Olympus' })!.tz, undefined);
});

test('la frase: varios días, el ordinal, y lo de antes igual que ayer', () => {
  assert.equal(textoCron(cron({ dias: [2, 4] })), 'Todos los martes y jueves a las 09:00');
  assert.equal(textoCron(cron({ dias: [1, 3, 5] })), 'Todos los lunes, miércoles y viernes a las 09:00');
  assert.equal(textoCron(cron({ cada: 2, dias: [6, 0] })), 'Cada 2 semanas, los sábados y domingos a las 09:00');
  assert.equal(textoCron(sanearCron({ unidad: 'mes', cada: 1, hora: 9, minuto: 0, ordinal: 2, diaSemana: 2 })!), 'El segundo martes de cada mes a las 09:00');
  assert.equal(textoCron(sanearCron({ unidad: 'mes', cada: 3, hora: 9, minuto: 0, ordinal: -1, diaSemana: 5 })!), 'Cada 3 meses, el último viernes a las 09:00');
  assert.equal(textoCron(cron({ diaSemana: 1 })), 'Todos los lunes a las 09:00');
});

test('una semana con varios días nunca agenda en el pasado ni repite la anterior', () => {
  const c = cron({ dias: [1, 2, 3, 4, 5] });
  let ant = enAR(2026, 10, 9, 9);   // viernes
  for (let i = 0; i < 20; i++) {
    const prox = proximaOcurrencia(c, ant, AR, ant);
    assert.ok(prox.getTime() > ant.getTime(), 'repitió o retrocedió');
    assert.ok([1, 2, 3, 4, 5].includes(partesEn(AR, prox).dow), 'salió un fin de semana');
    ant = prox;
  }
});

test('«cada hora» con fecha de inicio: el primero sale al arrancar el día de inicio', () => {
  const c = sanearCron({ unidad: 'hora', cada: 6, hora: 0, minuto: 0, desde: '2026-10-08' })!;
  const prox = proximaOcurrencia(c, enAR(2026, 10, 5, 10), AR, enAR(2026, 10, 5, 10));
  assert.equal(dia(prox), '2026-10-08 0:00');
  assert.equal(dia(proximaOcurrencia(c, prox, AR, prox)), '2026-10-08 6:00');
});
