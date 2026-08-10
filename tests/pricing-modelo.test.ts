// =============================================================================
// El CAC se mide en DOS monedas que nunca se suman
// =============================================================================
// El modelo viejo tenía un solo campo `cacUsd` que sumaba los medios, el costo de
// los Free que no pagan y las horas del dueño valuadas a US$100. Sumar horas con
// dólares dio «el único canal que entra es referidos», que es absurdo para alguien
// que tiene tiempo y no tiene capital: las dos monedas no son intercambiables.
//
// Estas guardas son la segunda capa (AGENTS.md → «Una regla en un prompt no es una
// regla»): el tipo puede volver a mezclarlas y el compilador no diría nada.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { CAC_CANALES } from '../app/admin/dev/pricing/modelo';

test('ningún canal mezcla horas con dólares', () => {
  for (const c of CAC_CANALES) {
    assert.equal(typeof c.plataPorCliente, 'number', `${c.id}: falta plataPorCliente`);
    assert.equal(typeof c.horas.aMano, 'number', `${c.id}: falta horas.aMano`);
    // La guarda que importa: no puede sobrevivir ningún campo que sume las dos.
    assert.ok(!('cacUsd' in c), `${c.id}: cacUsd todavía existe y suma horas con plata`);
    assert.ok(!('horasDueno' in c), `${c.id}: horasDueno en dólares todavía existe`);
  }
});

test('las horas con MaKo nunca son más que a mano', () => {
  for (const c of CAC_CANALES) {
    assert.ok(c.horas.conMaKo <= c.horas.aMano,
      `${c.id}: conMaKo (${c.horas.conMaKo}) > aMano (${c.horas.aMano})`);
  }
});

test('si conMaKo es menor que aMano, dice qué feature lo habilita', () => {
  for (const c of CAC_CANALES) {
    if (c.horas.conMaKo < c.horas.aMano) {
      assert.ok(c.horas.loHabilita, `${c.id}: baja las horas y no dice con qué feature`);
    }
  }
});

// =============================================================================
// El modelo de tiempo por fase
// =============================================================================
// Las fases NO cambian las horas del mes: las REPARTEN. Lo que hay que impedir es
// que el reparto prometa más horas de las que existen, y que el tope de clientes
// de high ticket se FIJE a mano en vez de salir del residual — que es justo lo que
// el dueño pidió: «la cantidad de clientes lo puedes sacar de la promesa de horas
// que les doy».
// =============================================================================

import { FASES, HORAS_MES, horasLibres, topeClientes1a1 } from '../app/admin/dev/pricing/modelo';

test('ninguna fase reparte más horas de las que hay', () => {
  for (const f of FASES) {
    const usadas = f.pisoAdquisicion + f.topeDebug + f.topeAgencia;
    assert.ok(usadas <= HORAS_MES, `${f.id}: reparte ${usadas} de ${HORAS_MES}`);
  }
});

test('el tope de clientes 1a1 sale del residual, no se fija', () => {
  const regimen = FASES.find((f) => f.id === 'regimen')!;
  // 19 h en 12 semanas ≈ 6,33 h/mes por cliente (HIGH_TICKET.entrega)
  const tope = topeClientes1a1(regimen, 6.33);
  assert.equal(tope, Math.floor(horasLibres(regimen) / 6.33));
  assert.ok(tope > 0, 'en régimen tiene que entrar al menos un cliente de high ticket');
});

test('en la fase de adquisición no entra ningún cliente de high ticket', () => {
  const adq = FASES.find((f) => f.id === 'adquisicion')!;
  assert.equal(topeClientes1a1(adq, 6.33), 0,
    'septiembre es 100% adquisición: no puede haber horas de entrega');
});
