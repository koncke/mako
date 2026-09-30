// =============================================================================
// CUÁNDO toca la próxima vez: la RRULE deja de ser una etiqueta (#813)
// =============================================================================
// La mig 0167 guardó la recurrencia como una RRULE de RFC 5545 y dejó escrito lo que
// faltaba: «Nada en este producto calcula la próxima ocurrencia: el día es una ETIQUETA,
// no dispara ni el reparto diario ni un aviso ni un recordatorio.»
//
// Las fechas de este archivo están verificadas contra el calendario real de 2026, no
// contra lo que devuelve la función: un test escrito desde la salida confirma el modelo
// mental de quien lo escribió y nada más.
//   · 2026-01-01 es JUEVES · 2026-02-28 es sábado (no bisiesto) · 2026-03-31 es martes
//   · los martes de marzo 2026: 3, 10, 17, 24, 31 (cinco) · los de abril: 7, 14, 21, 28
//
// ⚠️ PROBADO ROMPIÉNDOLO, cuatro veces (30/09/2026):
//   1. Contando el intervalo semanal en DÍAS y no en semanas enteras: falla 1 de 14. Es
//      el borde que más caro sale: «cada 2 semanas, lunes y viernes» pasa a dar UN día
//      por semana en vez de dos cada dos semanas, y la diferencia recién se ve al mes.
//   2. Corriendo «el 31» al último día del mes en vez de saltear febrero: falla 1 de 14.
//   3. Sacando el `?? ancla.getUTCDate()` de la anual: falla 1 de 14.
//   4. Arrancando la búsqueda en el mismo día (`>=` en vez de `>`): fallan **12 de 14** — una
//      próxima ocurrencia que devuelve HOY deja al generador creando la misma instancia
//      para siempre, y por eso lo ve casi todo el archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximaFecha, ocurrenciasEntre, aFecha, aISO, calza, queGenerar } from '../lib/plan-recurrentes-fechas';
import { leerRRule } from '../lib/plan-recurrentes';

/** La serie entera desde un ancla, para poder leerla de un vistazo. */
const serie = (rrule: string, desde: string, n: number): string[] => {
  const out: string[] = [];
  let c = desde;
  for (let i = 0; i < n; i++) {
    const p = proximaFecha(rrule, c, desde);
    if (!p) break;
    out.push(p);
    c = p;
  }
  return out;
};

test('la próxima es SIEMPRE estrictamente después: si devolviera hoy, el generador gira', () => {
  // El bucle del generador avanza con la fecha que devuelve esto. Una que devuelva el
  // mismo día no da error: crea la misma instancia para siempre.
  for (const r of ['FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=TH', 'FREQ=MONTHLY;BYMONTHDAY=1']) {
    const p = proximaFecha(r, '2026-01-01');
    assert.ok(p && p > '2026-01-01', `${r} devolvió ${p}`);
  }
});

test('DAILY: todos los días, y cada N', () => {
  assert.deepEqual(serie('FREQ=DAILY', '2026-01-01', 3), ['2026-01-02', '2026-01-03', '2026-01-04']);
  // Cada 3 días desde el jueves 1: 4, 7, 10.
  assert.deepEqual(serie('FREQ=DAILY;INTERVAL=3', '2026-01-01', 3), ['2026-01-04', '2026-01-07', '2026-01-10']);
});

test('DAILY cruza el fin de mes y el fin de año sin tropezar', () => {
  assert.deepEqual(serie('FREQ=DAILY', '2026-01-31', 2), ['2026-02-01', '2026-02-02']);
  assert.deepEqual(serie('FREQ=DAILY', '2026-12-31', 1), ['2027-01-01']);
  // 2028 sí es bisiesto: el 29 de febrero existe y no se puede saltear.
  assert.deepEqual(serie('FREQ=DAILY', '2028-02-28', 2), ['2028-02-29', '2028-03-01']);
});

test('WEEKLY con varios días: los da TODOS, en orden de semana', () => {
  // Lunes, miércoles y viernes desde el jueves 1/1/2026. El primero es el viernes 2.
  assert.deepEqual(
    serie('FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-01-01', 5),
    ['2026-01-02', '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12'],
  );
});

test('EL QUE IMPORTA: «cada 2 semanas» cuenta SEMANAS ENTERAS, no días', () => {
  // ⚠️ Con el intervalo contado en días desde el ancla, el lunes y el viernes de la
  // misma semana caen en paridades distintas y sale UNO por semana — que es otra
  // repetición, y que recién se nota al mes. Son los dos días de una semana sí y una no.
  //
  // Ancla: jueves 1/1/2026, semana del lunes 29/12/2025. Las semanas «pares» son esa y
  // la del 12/1. Así que: viernes 2 (semana 0), después lunes 12 y viernes 16 (semana 2).
  assert.deepEqual(
    serie('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR', '2026-01-01', 5),
    ['2026-01-02', '2026-01-12', '2026-01-16', '2026-01-26', '2026-01-30'],
  );
});

test('WEEKLY sin días es «cada N semanas, el mismo día»', () => {
  assert.deepEqual(serie('FREQ=WEEKLY', '2026-01-01', 2), ['2026-01-08', '2026-01-15']);
  assert.deepEqual(serie('FREQ=WEEKLY;INTERVAL=3', '2026-01-01', 2), ['2026-01-22', '2026-02-12']);
});

test('MONTHLY con día del mes: el 15 de cada mes', () => {
  assert.deepEqual(serie('FREQ=MONTHLY;BYMONTHDAY=15', '2026-01-15', 3), ['2026-02-15', '2026-03-15', '2026-04-15']);
});

test('EL OTRO QUE IMPORTA: «el 31» SALTEA febrero, no lo corre al 28', () => {
  // ⚠️ Correrlo pone la tarea un día que nadie eligió, y en silencio. La 0167 dejó
  // escrito que entre saltear y correr nadie tomó la decisión; saltear es la única que
  // no miente sobre la fecha. 2026 no es bisiesto: febrero llega hasta el 28.
  assert.deepEqual(
    serie('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31', 4),
    ['2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31'],
  );
  assert.ok(!serie('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31', 12).some((f) => f.startsWith('2026-02')));
});

test('MONTHLY con ordinal: «el segundo martes», y el quinto que no existe no sale', () => {
  // Martes de marzo 2026: 3, 10, 17, 24, 31 — el segundo es el 10.
  assert.deepEqual(
    serie('FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2', '2026-01-01', 3),
    ['2026-01-13', '2026-02-10', '2026-03-10'],
  );
  // El ÚLTIMO martes (-1): marzo tiene cinco y el último es el 31.
  assert.equal(proximaFecha('FREQ=MONTHLY;BYDAY=TU;BYSETPOS=-1', '2026-03-01'), '2026-03-31');
});

test('MONTHLY con día pero sin ordinal es «los martes de cada mes», todos', () => {
  // Es lo que dice la frase que lee la persona («Cada mes, los martes»): el generador y
  // la pantalla no se pueden contradecir.
  assert.deepEqual(
    serie('FREQ=MONTHLY;BYDAY=TU', '2026-03-01', 5),
    ['2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24', '2026-03-31'],
  );
});

test('YEARLY: el mismo día del mismo mes, y el mes sale del ANCLA', () => {
  // Sin BYMONTH, RFC 5545 saca el mes del arranque de la serie.
  assert.deepEqual(serie('FREQ=YEARLY', '2026-03-15', 2), ['2027-03-15', '2028-03-15']);
  assert.deepEqual(serie('FREQ=YEARLY;BYMONTHDAY=1', '2026-03-15', 1), ['2027-03-01']);
});

test('lo que no se puede leer devuelve null, no una fecha inventada', () => {
  for (const basura of ['', 'cada tanto', 'FREQ=NUNCA', null, undefined, 42]) {
    assert.equal(proximaFecha(basura, '2026-01-01'), null, `«${String(basura)}» devolvió una fecha`);
  }
  assert.equal(proximaFecha('FREQ=DAILY', 'no es una fecha'), null);
  // Y la regla se lee con el MISMO parser que la pantalla: si `leerRRule` la rechaza,
  // acá tampoco existe. Dos parsers serían dos ideas de qué está guardado.
  assert.equal(leerRRule('FREQ=NUNCA'), null);
});

test('`ocurrenciasEntre` no pasa el tope y respeta el borde', () => {
  const ene = ocurrenciasEntre('FREQ=WEEKLY;BYDAY=MO', '2026-01-01', '2026-01-31');
  assert.deepEqual(ene, ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  // `hasta` es INCLUSIVO: el lunes 2/2 no entra en enero, pero el 26 sí.
  assert.deepEqual(ocurrenciasEntre('FREQ=WEEKLY;BYDAY=MO', '2026-01-01', '2026-01-26'), ene);
  assert.equal(ocurrenciasEntre('FREQ=DAILY', '2026-01-01', '2026-12-31', '2026-01-01', 5).length, 5);
});

test('las utilidades de fecha no se corren un día', () => {
  // Mediodía UTC y no medianoche, a propósito: es lo que hace que ninguna zona ni
  // ningún redondeo pueda mover la fecha para atrás.
  const d = aFecha('2026-03-15');
  assert.ok(d);
  assert.equal(aISO(d), '2026-03-15');
  assert.equal(aFecha('2026-02-30'), null, 'un 30 de febrero se leyó como una fecha');
  const r = leerRRule('FREQ=WEEKLY;BYDAY=SU');
  assert.ok(r);
  // 2026-03-15 es DOMINGO. Verificado contra el calendario, no contra la función.
  assert.ok(calza(r, d, d));
});

// ── LAS TRES DECISIONES DEL GENERADOR ────────────────────────────────────────
// Viven en una funcion pura y no adentro de `plan-recurrentes-generar.ts` justamente
// para esto: ese modulo tiene `server-only` y ningun test lo puede importar. Es la regla
// de la casa — una condicion que decide que se ESCRIBE necesita red.
//
// ⚠️ PROBADO ROMPIENDOLO, tres veces (30/09/2026), una por decision:
//   1. Sacando el corte de «hay una abierta»: falla 1. Es la que evita que doce «grabar
//      contenido» se apilen, o sea el tablero que nadie mira que la feature vino a evitar.
//   2. Creando la PRIMERA vencida en vez de la ultima: falla 1. Con el cron caido tres
//      dias, la instancia nace con la fecha del martes y al dia siguiente nace la del
//      miercoles: la serie se arrastra atrasada para siempre.
//   3. Mirando hasta manana en vez de hasta hoy: fallan 3. Una tarea con fecha futura
//      vuelve a llenar el tablero de trabajo que todavia no es.

test('DECISION 1: con una instancia abierta NO nace otra', () => {
  const r = queGenerar({ rrule: 'FREQ=DAILY', ancla: '2026-01-01', cursor: '2026-01-01', hayAbierta: true, hoy: '2026-01-10' });
  assert.equal(r.crear, null);
  assert.equal(r.crear === null && r.motivo, 'hay-una-abierta');
  // Y el motivo que se reporta es el que explica la pantalla: una plantilla con trabajo
  // abierto Y sin regla es «hay una abierta», no «sin regla».
  const sinRegla = queGenerar({ rrule: null, ancla: '2026-01-01', cursor: '2026-01-01', hayAbierta: true, hoy: '2026-01-10' });
  assert.equal(sinRegla.crear === null && sinRegla.motivo, 'hay-una-abierta');
});

test('DECISION 2: con el cron caido, nace UNA y con la fecha de la ULTIMA vencida', () => {
  // Diaria anclada el 1, el cron vuelve el 10: hay nueve vencidas (2..10) y nace la del
  // 10. Con la primera, la serie se arrastra atrasada para siempre: al dia siguiente
  // naceria la del 3, y asi.
  const r = queGenerar({ rrule: 'FREQ=DAILY', ancla: '2026-01-01', cursor: '2026-01-01', hayAbierta: false, hoy: '2026-01-10' });
  assert.equal(r.crear, '2026-01-10');
  assert.equal(r.salteadas, 8, 'las salteadas no se cuentan: un descarte sin rastro no se puede auditar');
});

test('DECISION 3: nada hacia adelante, ni un dia', () => {
  // Una diaria anclada HOY no genera nada hoy: la proxima es manana, y manana es manana.
  const r = queGenerar({ rrule: 'FREQ=DAILY', ancla: '2026-01-10', cursor: '2026-01-10', hayAbierta: false, hoy: '2026-01-10' });
  assert.equal(r.crear, null);
  assert.equal(r.crear === null && r.motivo, 'no-toca');
});

test('el caso normal: toca hoy y nace una sola, sin salteadas', () => {
  const r = queGenerar({ rrule: 'FREQ=DAILY', ancla: '2026-01-09', cursor: '2026-01-09', hayAbierta: false, hoy: '2026-01-10' });
  assert.deepEqual(r, { crear: '2026-01-10', salteadas: 0 });
});

test('«se repite y nadie dijo cada cuanto» no es un error, y se distingue de «no toca»', () => {
  // Son dos estados distintos y llevan a dos arreglos distintos: uno se arregla poniendo
  // la frecuencia, el otro es que el sistema esta funcionando.
  const sinRegla = queGenerar({ rrule: null, ancla: '2026-01-01', cursor: '2026-01-01', hayAbierta: false, hoy: '2026-01-10' });
  assert.equal(sinRegla.crear === null && sinRegla.motivo, 'sin-regla');
  const noToca = queGenerar({ rrule: 'FREQ=YEARLY', ancla: '2026-01-01', cursor: '2026-01-01', hayAbierta: false, hoy: '2026-01-10' });
  assert.equal(noToca.crear === null && noToca.motivo, 'no-toca');
});

test('la FASE sale del ANCLA, no del cursor: una serie atrasada no se corre de dia', () => {
  // «Cada 2 semanas, los lunes», anclada el lunes 5/1/2026. Los lunes de la serie son el
  // 5, el 19, el 2/2... Si el cursor se usara como ancla, al recuperar desde el 19 la
  // fase se resetearia y el siguiente saldria el 26 — un lunes que NO es de la serie.
  const r = queGenerar({ rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', ancla: '2026-01-05', cursor: '2026-01-19', hayAbierta: false, hoy: '2026-02-10' });
  assert.equal(r.crear, '2026-02-02', 'se corrio de semana: la fase se tomo del cursor');
});
