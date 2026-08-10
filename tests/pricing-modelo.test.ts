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

import { FASES_TIEMPO, HORAS_MES, horasLibres, topeClientes1a1 } from '../app/admin/dev/pricing/modelo';

test('ninguna fase reparte más horas de las que hay', () => {
  for (const f of FASES_TIEMPO) {
    const usadas = f.pisoAdquisicion + f.topeDebug + f.topeAgencia;
    assert.ok(usadas <= HORAS_MES, `${f.id}: reparte ${usadas} de ${HORAS_MES}`);
  }
});

test('el tope de clientes 1a1 sale del residual, no se fija', () => {
  const regimen = FASES_TIEMPO.find((f) => f.id === 'regimen')!;
  // 19 h en 12 semanas ≈ 6,33 h/mes por cliente (HIGH_TICKET.entrega)
  const tope = topeClientes1a1(regimen, 6.33);
  assert.equal(tope, Math.floor(horasLibres(regimen) / 6.33));
  assert.ok(tope > 0, 'en régimen tiene que entrar al menos un cliente de high ticket');
});

test('en la fase de adquisición no entra ningún cliente de high ticket', () => {
  const adq = FASES_TIEMPO.find((f) => f.id === 'adquisicion')!;
  assert.equal(topeClientes1a1(adq, 6.33), 0,
    'septiembre es 100% adquisición: no puede haber horas de entrega');
});

// =============================================================================
// Los 1.000 contactos: la cadena tiene que cerrar contra las altas
// =============================================================================
// BASE_PROPIA no es un canal, es un EVENTO de arranque que se agota en dos meses.
// Y como sus tasas se editan a mano, lo único que impide que las altas y las tasas
// se vayan cada una por su lado es esta cuenta. Ya pasó: nacieron declarando 8,5
// altas con tasas que dan 5,95 — el 3,5% de cierre y el 5% de otra corrida
// conviviendo en la misma línea.
// =============================================================================

import { BASE_PROPIA } from '../app/admin/dev/pricing/modelo';

test('las altas de los 1.000 contactos salen de sus propias tasas', () => {
  const cadena = BASE_PROPIA.contactos * BASE_PROPIA.responden * BASE_PROPIA.cierran * BASE_PROPIA.aprobacionCobro;
  const declaradas = BASE_PROPIA.altasMes1 + BASE_PROPIA.altasMes2;
  assert.ok(Math.abs(cadena - declaradas) <= 0.1,
    `la cadena da ${cadena.toFixed(2)} altas y la tabla declara ${declaradas.toFixed(2)} (mes 1 ${BASE_PROPIA.altasMes1} + mes 2 ${BASE_PROPIA.altasMes2})`);
});

// =============================================================================
// La matriz: qué canal entra en qué fase
// =============================================================================
// Acá es donde las dos monedas se podrían volver a mezclar sin que el compilador
// diga nada, porque `entraEn` recibe las dos y devuelve un solo booleano. El test
// que importa es el último: un canal que no cuesta plata tiene que entrar aunque
// el límite de plata sea de un centavo.
// =============================================================================

import { entraEn, horasDe } from '../app/admin/dev/pricing/modelo';

const canal = (id: string) => CAC_CANALES.find((c) => c.id === id)!;
const fase = (id: string) => FASES_TIEMPO.find((f) => f.id === id)!;

test('sin la feature construida rige el costo a mano', () => {
  const p = canal('prospeccion');
  assert.equal(horasDe(p, []), p.horas.aMano);
  assert.equal(horasDe(p, ['Agente: Chatbot']), p.horas.conMaKo);
});

test('el orgánico NO entra en desarrollo y SÍ en adquisición', () => {
  const o = canal('organico');
  assert.equal(entraEn(o, fase('desarrollo'), [], 105.84).entra, false);
  assert.equal(entraEn(o, fase('adquisicion'), [], 105.84).entra, true);
});

test('un canal caro en plata no entra aunque sobren horas', () => {
  const c = canal('carrito'); // 136,22 contra un límite de 105,84
  const v = entraEn(c, fase('adquisicion'), [], 105.84);
  assert.equal(v.entra, false);
  assert.match(v.porQueNo!, /plata/);
});

test('el veredicto nunca compara horas contra el límite de plata', () => {
  const o = canal('organico'); // plata 0, horas 26
  const v = entraEn(o, fase('adquisicion'), [], 0.01);
  // Con plata 0 entra aunque el límite sea de un centavo: las horas no cuentan acá.
  assert.equal(v.entra, true);
});
