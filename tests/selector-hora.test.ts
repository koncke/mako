// =============================================================================
// SelectorHora — el parseo de texto libre y QUÉ guarda Enter
// =============================================================================
// Las dos cosas de este componente que pueden fallar sin dar un solo síntoma:
//
//  1. parsearHora(): entiende mal y guarda otra hora. Se ve en el eco, pero el eco
//     se lee poco.
//  2. indiceActivo(): el eco dice una hora y Enter guarda OTRA. Esto no se ve nunca
//     — el usuario confirma y la reunión queda dos horas antes. Era un bug real:
//     el filtro de la lista es por substring y "16:15" contiene "6:15", así que
//     items[0] no era la hora entendida.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearHora, horaLegible, indiceActivo, indiceDeAncla } from '../app/crm/SelectorHora';
import { hhmm, HORA_DESDE_DEFECTO, HORA_HASTA_DEFECTO, PASO_MIN_DEFECTO } from '../app/crm/horarios-respuesta';

// ── parsearHora ────────────────────────────────────────────────────────────────

test('el caso del dueño: "y cuarto" en todas las formas de escribirlo', () => {
  for (const t of ['6:15', '615', '6.15', '6h15', '6:15 pm', '6:15pm', '6:15 p.m.', '6 y cuarto', 'seis y cuarto']) {
    assert.equal(parsearHora(t), '18:15', `«${t}»`);
  }
});

test('cero adelante y 4 dígitos son 24h EXPLÍCITAS: no se adivina la mitad del día', () => {
  assert.equal(parsearHora('06:15'), '06:15');
  assert.equal(parsearHora('0615'), '06:15');
  assert.equal(parsearHora('1815'), '18:15');
  assert.equal(parsearHora('18:15'), '18:15');
  assert.equal(parsearHora('18.15'), '18:15');
  assert.equal(parsearHora('18h15'), '18:15');
});

test('sin sufijo: 1..7 son de tarde, 8..12 de mañana', () => {
  assert.equal(parsearHora('3'), '15:00');
  assert.equal(parsearHora('7'), '19:00');
  assert.equal(parsearHora('8'), '08:00');
  assert.equal(parsearHora('12'), '12:00');
});

test('el sufijo manda por encima del criterio de la tarde', () => {
  assert.equal(parsearHora('6:15 am'), '06:15');
  assert.equal(parsearHora('12:30 am'), '00:30');
  assert.equal(parsearHora('12:30 pm'), '12:30');
  assert.equal(parsearHora('9 pm'), '21:00');
});

test('las formas habladas', () => {
  assert.equal(parsearHora('7 menos cuarto'), '18:45');
  assert.equal(parsearHora('seis y media'), '18:30');
  assert.equal(parsearHora('6 en punto'), '18:00');
  assert.equal(parsearHora('mediodía'), '12:00');
  assert.equal(parsearHora('medianoche'), '00:00');
  assert.equal(parsearHora('a las 20'), '20:00');
  assert.equal(parsearHora('20 hs'), '20:00');
});

test('lo que NO se entiende devuelve null y NO se guarda a medias', () => {
  for (const t of ['', '   ', 'mañana', '6:60', '999', '2500', '25:00', '6 y 70', 'x']) {
    assert.equal(parsearHora(t), null, `«${t}» tendría que ser null`);
  }
});

test('horaLegible es lo que ve el usuario en el eco', () => {
  assert.equal(horaLegible('18:15'), '6:15 PM');
  assert.equal(horaLegible('00:30'), '12:30 AM');
  assert.equal(horaLegible('12:00'), '12:00 PM');
});

// ── indiceActivo: el eco y Enter tienen que coincidir ──────────────────────────

/** La grilla real del producto: 07:00–22:00 cada 15', todo libre. */
const GRILLA: string[] = (() => {
  const out: string[] = [];
  for (let m = HORA_DESDE_DEFECTO * 60; m <= HORA_HASTA_DEFECTO * 60; m += PASO_MIN_DEFECTO) out.push(hhmm(m));
  return out;
})();

/** Reproduce el filtro por substring del componente (es el que causaba el bug). */
function visiblesDe(consulta: string, tipeada: string | null): string[] {
  const q = consulta.toLowerCase().replace(/[\s.]/g, '');
  return GRILLA.filter((h) => {
    const leg = horaLegible(h).toLowerCase().replace(/[\s.]/g, '');
    return h.includes(q) || h.replace(':', '').includes(q) || leg.includes(q) || h === tipeada;
  });
}

/** Lo que guardaría Enter con ese texto tipeado y sin haber tocado las flechas. */
function loQueGuardaEnter(texto: string): string | undefined {
  const tipeada = parsearHora(texto);
  const visibles = visiblesDe(texto, tipeada);
  const extra = tipeada && !visibles.includes(tipeada) ? tipeada : null;
  const items = extra ? [extra, ...visibles] : visibles;
  const i = indiceActivo({ activo: -1, abierto: true, items, tipeada, consulta: texto, value: '', ancla: '09:00' });
  return items[i];
}

test('Enter guarda EXACTAMENTE lo que dice el eco (la tabla que estaba toda mal)', () => {
  // Antes de arreglarlo: 6:15→16:15, 6→16:00, 615→16:15, 7→07:00, 5→07:15, 3→07:30.
  for (const [texto, esperado] of [
    ['6:15', '18:15'],
    ['6', '18:00'],
    ['615', '18:15'],
    ['7', '19:00'],
    ['5', '17:00'],
    ['3', '15:00'],
  ] as const) {
    assert.equal(loQueGuardaEnter(texto), esperado, `tipeando «${texto}»`);
    assert.equal(loQueGuardaEnter(texto), parsearHora(texto), `«${texto}»: Enter y el eco tienen que decir lo mismo`);
  }
});

test('una hora que NO está en la grilla se ofrece igual y Enter la respeta', () => {
  assert.equal(loQueGuardaEnter('18:07'), '18:07');
  assert.equal(loQueGuardaEnter('6:07'), '18:07');
});

test('si el usuario movió las flechas, manda su puntero y no la hora entendida', () => {
  const items = ['16:15', '18:15'];
  assert.equal(indiceActivo({ activo: 0, abierto: true, items, tipeada: '18:15', consulta: '6:15', value: '', ancla: '09:00' }), 0);
});

test('el puntero explícito nunca se sale de la lista cuando el filtro la achica', () => {
  assert.equal(indiceActivo({ activo: 40, abierto: true, items: ['07:00', '07:15'], tipeada: null, consulta: '07', value: '', ancla: '09:00' }), 1);
});

test('cerrado no hay nada activo (aria-activedescendant tiene que quedar vacío)', () => {
  assert.equal(indiceActivo({ activo: -1, abierto: false, items: GRILLA, tipeada: null, consulta: '', value: '', ancla: '09:00' }), -1);
  assert.equal(indiceActivo({ activo: -1, abierto: true, items: [], tipeada: null, consulta: '', value: '', ancla: '09:00' }), -1);
});

test('sin texto abre en el ancla, no en la madrugada', () => {
  const i = indiceActivo({ activo: -1, abierto: true, items: GRILLA, tipeada: null, consulta: '', value: '', ancla: '14:30' });
  assert.equal(GRILLA[i], '14:30');
});

test('lo ya elegido le gana al ancla', () => {
  assert.equal(GRILLA[indiceDeAncla(GRILLA, '20:45', '09:00')], '20:45');
  // Un ancla más tarde que el último horario cae al principio en vez de romper.
  assert.equal(indiceDeAncla(GRILLA, '', '23:59'), 0);
  assert.equal(indiceDeAncla([], '', '09:00'), -1);
});
