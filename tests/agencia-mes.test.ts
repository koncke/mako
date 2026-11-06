// =============================================================================
// La mensualidad de una agencia (Martín, 5/11/2026, sobre el acuerdo del 30/10) — lib/agencia-mes-reglas.ts y la pausa
// =============================================================================
// Las reglas de Martín: el ciclo va del 5 al 5; cada cliente paga sus días desde que empieza hasta el próximo 5, sin contar
// ese 5 (US$47 ÷ días del ciclo); la cuenta que pasa su día sin pagar se pausa, y el día 6 sin el total del mes se pausan la
// agencia y todos sus clientes; pagado, entra solo; un error de la base o de una lectura NUNCA pausa. El caso real de Código
// Inmobiliario, con sus clientes por su nombre de pila y números de cuenta inventados.
//
// Probado ROMPIÉNDOLO (6/11/2026), una rotura a la vez, con la base en verde (37 / 0):
//   · `proximoCinco` con el 5 como «próximo» (el que empieza un 5 no paga)       → 2 fallos.
//   · `diasDelCiclo` = 31 fijo                                                    → 8 fallos (la tarifa de noviembre: Pablo, Giselle…).
//   · `entraEnElMes` con `desde > inicio` en vez de `>=` (el 5 se cobra dos veces) → 1 fallo («el que empieza un 5»).
//   · `entraEnElMes` contando a quien está en «Paga para entrar»                  → 3 fallos (noviembre 238 y diciembre proyectado).
//   · `quienVaEnPausa` sin pedir el aviso de la entrada                           → 1 fallo.
//   · `quienVaEnPausa` pausando el día 5 (`<` en vez de `<=`)                     → 1 fallo.
//   · `quienVaEnPausa` exigiendo el total de hoy en vez del avisado               → 1 fallo («lo que no se le dijo no se exige»).
//   · `pasoDePausa` reabriendo una pausa a mano (sin corte)                       → 1 fallo.
//   · `asignarPago` sin buscar un pendiente exacto antes de completar en orden    → 1 fallo (el pago de Giselle iba a Pablo).
//   · `revisarPausas` decidiendo con una lectura que tiró                         → 1 fallo (la base que falla).
//   · `asignarPago` eligiendo el primero cuando dos entradas cuestan lo mismo      → 1 fallo (Pablo y Patricia el mismo día).
// Renombrar una variable local de `cuentaDelMes` (`lineas` → `renglones`): 0 fallos.
//
// Correr: node --import tsx --test tests/agencia-mes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asignarPago, cicloDe, cuentaDelMes, cuentaDesde, diasDelCiclo, diferencialDe, entradasPorAvisar, esDia, leerConfigMensualidad,
  leerCortePagaParaEntrar, leerEntrada, leerPagoDelMes, mesQueSeAvisa, pasoDePausa, planQueSeCobra, preciosDelCatalogo, proximoCinco,
  quienVaEnPausa, situacion, tablaDeEntradas, tablaDelMes, textoDeComprobante, textoDePausaDelMes, textoDeSituacion, textoDelAvisoDeEntradas,
  textoDelAvisoDelMes, usd, usdDia, clavePendiente,
  type ClienteDeAgencia, type CuentaDelMes, type Pendiente,
} from '../lib/agencia-mes-reglas';
import { revisarPausas, type DepsPausas, type LecturaParaPausas } from '../lib/agencia-mes-pausas';
import { leerCorte, leOfrecePagar, pasoDeAcceso, textoDelCorte, type CorteGuardado } from '../lib/plan-acceso-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { marcasDeVoseo } from '../lib/voseo';

// Los precios salen del catálogo de planes, no de un número escrito acá.
const PRECIOS = preciosDelCatalogo(PLANES_MAKO_DEFAULT)!;
const ENTRADAS_DESDE = '2026-11-07';

const cliente = (ws: number, nombre: string, invitado: string, extra: Partial<ClienteDeAgencia> = {}): ClienteDeAgencia => ({
  ws, nombre, estado: 'aprobado', invitado, corregido: null, baja: null, plan: 'esencial', entrada: null, fueraPorEntrada: false, ...extra,
});

/**
 * La cartera de la agencia al 7/11/2026. Brigitte, Natalia y Sergio pagaron noviembre a mano; Pablo y Patricia estaban
 * suspendidos (con el script, «Paga para entrar»); Giselle con la fecha corregida (empieza el 11/11) y Marcela (el 13/11).
 */
const CARTERA: ClienteDeAgencia[] = [
  cliente(101, 'Brigitte', '2026-09-28'),
  cliente(102, 'Natalia', '2026-10-14'),
  cliente(103, 'Sergio', '2026-10-16'),
  cliente(104, 'Pablo', '2026-10-14', { fueraPorEntrada: true }),
  cliente(105, 'Patricia', '2026-10-21', { fueraPorEntrada: true }),
  cliente(106, 'Giselle', '2026-09-28', { corregido: '2026-10-28' }),
  cliente(107, 'Marcela', '2026-10-30'),
];

const mes = (m: string, hoy: string, clientes = CARTERA): CuentaDelMes =>
  cuentaDelMes({ mes: m, primerMes: '2026-11', planAgencia: 'pro', clientes, precios: PRECIOS, hoy, entradasDesde: ENTRADAS_DESDE })!;
const quienes = (c: CuentaDelMes) => c.lineas.map((l) => (l.tipo === 'agencia' ? 'agencia' : l.nombre));

test('los precios son los del catálogo: Esencial 47 y Pro 97', () => {
  assert.deepEqual(PRECIOS, { esencial: 47, pro: 97 });
  assert.equal(preciosDelCatalogo([{ id: 'esencial', precioUsd: 47 }]), null, 'sin Pro en el catálogo no se inventa un precio');
});

// ── 1. El diferencial: los casos de Martín ───────────────────────────────────────────────────────────────────────

test('el ciclo va del 5 al 5: 30 días del 5/11 al 5/12, 31 del 5/12 al 5/1', () => {
  assert.equal(diasDelCiclo('2026-11'), 30);
  assert.equal(diasDelCiclo('2026-12'), 31);
  assert.equal(cicloDe('2026-11-09'), '2026-11');
  assert.equal(cicloDe('2026-12-04'), '2026-11', 'el 4 todavía es del ciclo anterior');
  assert.equal(cicloDe('2026-12-05'), '2026-12');
  assert.equal(proximoCinco('2026-11-09'), '2026-12-05');
  assert.equal(proximoCinco('2026-12-02'), '2026-12-05');
  assert.equal(proximoCinco('2026-12-05'), '2027-01-05', 'el que empieza un 5 paga su ciclo entero: ese 5 no cuenta como próximo');
});

test('Pablo entra el 9/11: 26 días, US$ 40,73, hasta el 4/12, y se paga ese mismo día', () => {
  const d = diferencialDe('2026-11-09', PRECIOS.esencial);
  assert.deepEqual({ dias: d.dias, monto: d.montoUsd, hasta: d.hasta, limite: d.limite, ciclo: d.ciclo, diasDelCiclo: d.diasDelCiclo }, { dias: 26, monto: 40.73, hasta: '2026-12-04', limite: '2026-11-09', ciclo: '2026-11', diasDelCiclo: 30 });
});

test('Giselle el 11/11: 24 días, US$ 37,60; Marcela el 13/11: 22 días, US$ 34,47', () => {
  const g = diferencialDe('2026-11-11', PRECIOS.esencial);
  const m = diferencialDe('2026-11-13', PRECIOS.esencial);
  assert.deepEqual([g.dias, g.montoUsd, g.hasta], [24, 37.6, '2026-12-04']);
  assert.deepEqual([m.dias, m.montoUsd, m.hasta], [22, 34.47, '2026-12-04']);
});

test('Patricia: US$ 1,5667 por día desde que entre', () => {
  const p = diferencialDe('2026-11-20', PRECIOS.esencial);
  assert.equal(p.tarifaUsd, 1.5667);
  assert.equal(usdDia(p.tarifaUsd), 'US$ 1,5667');
  assert.equal(p.dias, 15);
  assert.equal(p.montoUsd, 23.5);
});

test('el que entra del 1 al 4 paga sus días hasta ese 5 (a la tarifa del ciclo anterior); el que entra un 5, el ciclo entero', () => {
  const d = diferencialDe('2026-12-02', PRECIOS.esencial);
  assert.deepEqual([d.dias, d.montoUsd, d.ciclo], [3, 4.7, '2026-11']);
  const cinco = diferencialDe('2026-12-05', PRECIOS.esencial);
  assert.deepEqual([cinco.dias, cinco.montoUsd, cinco.ciclo], [31, 47, '2026-12']);
});

// ── 2. La mensualidad de cada mes ────────────────────────────────────────────────────────────────────────────────

test('noviembre: US$ 238 (Pro, Brigitte, Natalia y Sergio): Pablo y Patricia están en pausa, Giselle y Marcela entran después del 5', () => {
  const nov = mes('2026-11', '2026-11-07');
  assert.deepEqual(quienes(nov), ['agencia', 'Brigitte', 'Natalia', 'Sergio']);
  assert.equal(nov.totalUsd, 238);
  assert.equal(nov.limite, '2026-11-05');
});

test('diciembre: US$ 426 con los siete, una vez que entraron (el 5/12 no se cuenta en sus entradas: lo cubre la mensualidad)', () => {
  const entraron = CARTERA.map((c) => {
    const desde = { Pablo: '2026-11-09', Patricia: '2026-11-20', Giselle: '2026-11-11', Marcela: '2026-11-13' }[c.nombre];
    return desde ? { ...c, fueraPorEntrada: false, entrada: { desde, pagadoEl: desde, montoUsd: diferencialDe(desde, 47).montoUsd } } : c;
  });
  const dic = mes('2026-12', '2026-12-01', entraron);
  assert.equal(dic.totalUsd, 426);
  assert.equal(dic.lineas.length, 8);
  for (const c of entraron.filter((x) => x.entrada)) assert.equal(diferencialDe(c.entrada!.desde, 47).hasta, '2026-12-04', `${c.nombre}: su entrada termina el 4/12`);
});

test('diciembre proyectado el 7/11: Giselle y Marcela cuentan si pagan a tiempo; Pablo y Patricia no hasta que paguen', () => {
  const dic = mes('2026-12', '2026-11-07');
  assert.deepEqual(quienes(dic), ['agencia', 'Brigitte', 'Giselle', 'Marcela', 'Natalia', 'Sergio']);
  assert.equal(dic.totalUsd, 97 + 5 * 47);
});

test('a quien se le venció la entrada sin pagar no entra en el mes (si paga, se rehace con él)', () => {
  const dic = mes('2026-12', '2026-11-12');
  assert.ok(!quienes(dic).includes('Giselle'), 'el 12/11 Giselle ya venció (11/11)');
  assert.ok(quienes(dic).includes('Marcela'), 'Marcela todavía está a tiempo (13/11)');
});

test('el que empieza un 5 no está en esa mensualidad: su entrada cubre el ciclo', () => {
  const c = cliente(201, 'Dora', '2026-11-21'); // 14 días → 5/12
  assert.equal(cuentaDesde(c), '2026-12-05');
  assert.ok(!quienes(mes('2026-12', '2026-12-01', [c])).includes('Dora'));
  assert.ok(quienes(mes('2027-01', '2026-12-01', [c])).includes('Dora'));
});

test('dado de baja antes de entrar no se cobra nunca; de baja después de entrar, no entra al mes siguiente', () => {
  const antes = cliente(301, 'Eva', '2026-11-01', { estado: 'revocado', baja: '2026-11-10' }); // empezaría el 15/11
  assert.deepEqual(situacion(antes, '2026-11-20', ENTRADAS_DESDE, 47), { tipo: 'baja-sin-costo', baja: '2026-11-10' });
  const despues = cliente(302, 'Flor', '2026-09-01', { estado: 'revocado', baja: '2026-12-10' });
  assert.equal(situacion(despues, '2026-12-20', ENTRADAS_DESDE, 47).tipo, 'baja');
  assert.ok(quienes(mes('2026-12', '2026-12-20', [despues])).includes('Flor'), 'estaba el 5/12');
  assert.ok(!quienes(mes('2027-01', '2026-12-20', [despues])).includes('Flor'), 'se fue antes del 5/1');
});

test('el plan: el elegido por su capa; sin elegir, Esencial (el acuerdo es 47 por cliente)', () => {
  assert.equal(planQueSeCobra({ elegido: true, capa: 'agencia' }), 'pro');
  assert.equal(planQueSeCobra({ elegido: false, capa: 'agencia' }), 'esencial');
  assert.equal(planQueSeCobra({ elegido: true, capa: 'completo' }), 'esencial');
});

// ── 3. En qué está cada cliente, y cuándo se avisa ───────────────────────────────────────────────────────────────

test('Giselle: sin costo hasta el 11/11 (con su entrada a la vista), vence ese día, y el 12 está vencida', () => {
  const g = CARTERA.find((c) => c.nombre === 'Giselle')!;
  const s9 = situacion(g, '2026-11-09', ENTRADAS_DESDE, 47);
  assert.equal(s9.tipo, 'sin-costo');
  assert.equal(s9.tipo === 'sin-costo' && s9.entrada?.montoUsd, 37.6);
  const s11 = situacion(g, '2026-11-11', ENTRADAS_DESDE, 47);
  assert.deepEqual(s11.tipo === 'debe-entrada' && [s11.vencida, s11.entrada.montoUsd], [false, 37.6]);
  const s12 = situacion(g, '2026-11-12', ENTRADAS_DESDE, 47);
  assert.deepEqual(s12.tipo === 'debe-entrada' && [s12.vencida, s12.entrada.desde], [true, '2026-11-12'], 'si paga tarde, se cuenta desde ese día');
});

test('los que entraron antes de prenderla («de antes») ya cuentan y no pagan entrada', () => {
  assert.deepEqual(situacion(CARTERA[0], '2026-11-07', ENTRADAS_DESDE, 47), { tipo: 'cuenta', desde: '2026-10-12' });
  assert.equal(textoDeSituacion(situacion(CARTERA[0], '2026-11-07', ENTRADAS_DESDE, 47)).texto, 'Cuenta desde el 12/10');
});

test('en «Paga para entrar» paga sus días desde hoy, y baja cada día', () => {
  const pablo = CARTERA.find((c) => c.nombre === 'Pablo')!;
  const s = situacion(pablo, '2026-11-09', ENTRADAS_DESDE, 47);
  assert.deepEqual(s.tipo === 'paga-para-entrar' && [s.entrada.dias, s.entrada.montoUsd], [26, 40.73]);
  const s10 = situacion(pablo, '2026-11-10', ENTRADAS_DESDE, 47);
  assert.equal(s10.tipo === 'paga-para-entrar' && s10.entrada.montoUsd, 39.17);
});

test('con la entrada pagada: cuenta desde ese día', () => {
  const g = { ...CARTERA[5], entrada: { desde: '2026-11-11', pagadoEl: '2026-11-10', montoUsd: 37.6 } };
  assert.equal(situacion(g, '2026-11-10', ENTRADAS_DESDE, 47).tipo, 'sin-costo');
  assert.deepEqual(situacion(g, '2026-11-15', ENTRADAS_DESDE, 47), { tipo: 'cuenta', desde: '2026-11-11' });
});

test('el PDF de la entrada sale 2 días antes, el día antes y el mismo día; nunca después ni a quien ya pagó', () => {
  const avisa = (hoy: string) => entradasPorAvisar(CARTERA, hoy, ENTRADAS_DESDE, PRECIOS).map((e) => e.nombre);
  assert.deepEqual(avisa('2026-11-08'), []);
  assert.deepEqual(avisa('2026-11-09'), ['Giselle']);
  assert.deepEqual(avisa('2026-11-11'), ['Giselle', 'Marcela']);
  assert.deepEqual(avisa('2026-11-12'), ['Marcela']);
  const pagada = CARTERA.map((c) => (c.nombre === 'Giselle' ? { ...c, entrada: { desde: '2026-11-11', pagadoEl: '2026-11-09', montoUsd: 37.6 } } : c));
  assert.deepEqual(entradasPorAvisar(pagada, '2026-11-10', ENTRADAS_DESDE, PRECIOS), []);
});

test('el aviso del mes sale del 1 al 5 (si el del 1 no salió, al día siguiente), desde el primer mes', () => {
  assert.equal(mesQueSeAvisa('2026-12-01', '2026-12'), '2026-12');
  assert.equal(mesQueSeAvisa('2026-12-05', '2026-12'), '2026-12');
  assert.equal(mesQueSeAvisa('2026-12-06', '2026-12'), null);
  assert.equal(mesQueSeAvisa('2026-11-03', '2026-12'), null, 'noviembre se cobró a mano: el primer aviso es el 1/12');
});

// ── 4. A qué se aplica un pago ───────────────────────────────────────────────────────────────────────────────────

const pend = (clave: string, debe: number, limite: string): Pendiente => (clave.startsWith('mes:')
  ? { tipo: 'mes', mes: clave.slice(4), totalUsd: debe, pagadoUsd: 0, debeUsd: debe, limite }
  : { tipo: 'entrada', ws: Number(clave.slice(8)), nombre: clave, plan: 'esencial', entrada: diferencialDe(limite, 47), pagadoUsd: 0, debeUsd: debe, limite });
const PENDIENTES = [pend('entrada:104', 40.73, '2026-11-09'), pend('entrada:106', 37.6, '2026-11-11')];

test('un pago exacto de una entrada va a ESA entrada, aunque otra venza antes', () => {
  const r = asignarPago(37.6, PENDIENTES);
  assert.deepEqual(r.tipo === 'cubre' && r.claves, ['entrada:106']);
  assert.deepEqual((asignarPago(41, PENDIENTES) as { claves: string[] }).claves, ['entrada:104'], 'un dólar de redondeo, dentro del 1 %');
});

test('el total, o una combinación exacta, cubre todo eso', () => {
  assert.deepEqual((asignarPago(78.33, PENDIENTES) as { claves: string[] }).claves, ['entrada:104', 'entrada:106']);
  const tres = [...PENDIENTES, pend('mes:2026-12', 426, '2026-12-05')];
  assert.deepEqual((asignarPago(463.6, tres) as { claves: string[] }).claves, ['entrada:106', 'mes:2026-12']);
});

test('menos de lo que se debe: completa en orden y lo que sobra queda a cuenta («un pago parcial no frena nada»)', () => {
  const r = asignarPago(50, PENDIENTES);
  assert.equal(r.tipo, 'parcial');
  if (r.tipo !== 'parcial') return;
  assert.deepEqual(r.aplicado, [{ clave: 'entrada:104', montoUsd: 40.73 }, { clave: 'entrada:106', montoUsd: 9.27 }]);
  assert.deepEqual(r.cubiertas, ['entrada:104']);
  assert.equal(r.faltaUsd, 28.33);
});

test('dos entradas del mismo día cuestan lo mismo: un pago que calza con las dos no se elige, va a una persona', () => {
  const pablo = pend('entrada:104', 40.73, '2026-11-09');
  const patricia = pend('entrada:105', 40.73, '2026-11-09');
  assert.deepEqual(asignarPago(40.73, [pablo, patricia, PENDIENTES[1]]), { tipo: 'ambiguo', opciones: [['entrada:104'], ['entrada:105']] });
  assert.equal(asignarPago(81.46, [pablo, patricia]).tipo, 'cubre', 'las dos juntas sí se sabe');
});

test('de más, o sin nada que pagar, no se decide solo', () => {
  assert.deepEqual(asignarPago(200, PENDIENTES), { tipo: 'de-mas', debeUsd: 78.33 });
  assert.deepEqual(asignarPago(47, []), { tipo: 'nada-pendiente' });
  assert.equal(clavePendiente(PENDIENTES[0]), 'entrada:104');
});

// ── 5. «Paga para entrar»: quién va en pausa ─────────────────────────────────────────────────────────────────────

const AG = 13;
const sit = (c: ClienteDeAgencia, hoy: string) => situacion(c, hoy, ENTRADAS_DESDE, 47);

test('la entrada vencida pausa al cliente, sólo si el PDF de su entrada salió', () => {
  const g = CARTERA[5];
  const con = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-11-12', meses: [], clientes: [{ ws: g.ws, situacion: sit(g, '2026-11-12'), avisoEntrada: true }] });
  assert.deepEqual(con.get(g.ws), ['entrada']);
  const sin = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-11-12', meses: [], clientes: [{ ws: g.ws, situacion: sit(g, '2026-11-12'), avisoEntrada: false }] });
  assert.equal(sin.get(g.ws), undefined, 'sin aviso no se pide que pague');
  const dia = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-11-11', meses: [], clientes: [{ ws: g.ws, situacion: sit(g, '2026-11-11'), avisoEntrada: true }] });
  assert.equal(dia.get(g.ws), undefined, 'el día límite todavía puede pagar');
});

test('quien ya está en «Paga para entrar» sigue ahí hasta que pague', () => {
  const pablo = CARTERA[3];
  assert.deepEqual(quienVaEnPausa({ agenciaWs: AG, hoy: '2026-11-09', meses: [], clientes: [{ ws: pablo.ws, situacion: sit(pablo, '2026-11-09'), avisoEntrada: false }] }).get(pablo.ws), ['entrada']);
});

test('el día 6 sin el total del mes: la agencia y todos sus clientes (no los de baja); el 5, nadie', () => {
  const clientes = [
    { ws: 101, situacion: sit(CARTERA[0], '2026-12-06'), avisoEntrada: false },
    { ws: 302, situacion: { tipo: 'baja', desde: '2026-10-01', baja: '2026-11-20' } as const, avisoEntrada: false },
  ];
  const meses = [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 200, avisadoUsd: 426 }];
  const seis = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-12-06', meses, clientes });
  assert.deepEqual([...seis.keys()].sort((a, b) => a - b), [13, 101]);
  assert.deepEqual(seis.get(AG), ['mes:2026-12']);
  assert.equal(quienVaEnPausa({ agenciaWs: AG, hoy: '2026-12-05', meses, clientes }).size, 0);
});

test('lo que no se le dijo no se exige: sin aviso no se pausa, y con un total que subió se exige el avisado', () => {
  const sinAviso = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-12-06', meses: [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 0, avisadoUsd: null }], clientes: [] });
  assert.equal(sinAviso.size, 0);
  const subio = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-12-06', meses: [{ mes: '2026-12', totalUsd: 473, pagadoUsd: 426, avisadoUsd: 426 }], clientes: [] });
  assert.equal(subio.size, 0, 'pagó lo que se le dijo');
  const bajo = quienVaEnPausa({ agenciaWs: AG, hoy: '2026-12-06', meses: [{ mes: '2026-12', totalUsd: 379, pagadoUsd: 379, avisadoUsd: 426 }], clientes: [] });
  assert.equal(bajo.size, 0, 'un cliente se fue después del aviso: alcanza con el total de hoy');
});

test('qué se hace con cada cuenta: pausar, reabrir, actualizar, respetar la reactivación a mano y no tocar lo ajeno', () => {
  const corte = (causas: string[], vigente = true, perdonadas: string[] = []) => ({ vigente, causas: causas as never, perdonadas: perdonadas as never });
  assert.deepEqual(pasoDePausa({ quiere: ['entrada'], pausada: false, corte: null, otroMotivo: false }), { tipo: 'pausar', causas: ['entrada'] });
  assert.deepEqual(pasoDePausa({ quiere: [], pausada: true, corte: corte(['entrada']), otroMotivo: false }), { tipo: 'reabrir' });
  assert.deepEqual(pasoDePausa({ quiere: ['mes:2026-12'], pausada: true, corte: corte(['entrada']), otroMotivo: false }), { tipo: 'actualizar', causas: ['mes:2026-12'] });
  assert.deepEqual(pasoDePausa({ quiere: ['entrada'], pausada: false, corte: corte(['entrada']), otroMotivo: false }), { tipo: 'soltar' }, 'la reactivaron a mano');
  assert.deepEqual(pasoDePausa({ quiere: ['entrada'], pausada: false, corte: corte(['entrada'], false, ['entrada']), otroMotivo: false }), { tipo: 'nada' }, 'perdonada');
  assert.deepEqual(pasoDePausa({ quiere: ['mes:2026-12'], pausada: false, corte: corte(['entrada'], false, ['entrada']), otroMotivo: false }), { tipo: 'pausar', causas: ['mes:2026-12'] }, 'una causa nueva');
  assert.deepEqual(pasoDePausa({ quiere: [], pausada: true, corte: null, otroMotivo: false }), { tipo: 'nada' }, 'una pausa a mano no se reabre');
  assert.deepEqual(pasoDePausa({ quiere: ['entrada'], pausada: false, corte: null, otroMotivo: true }), { tipo: 'nada' }, 'otro motivo: no se toca');
});

// ── 6. La pausa contra una base de mentira, y la base que FALLA ──────────────────────────────────────────────────

function base(o: { leer?: () => Promise<LecturaParaPausas>; falla?: number } = {}) {
  const escrito: string[] = [];
  const deps: DepsPausas = {
    leer: o.leer ?? (async () => ({
      agenciaWs: AG, hoy: '2026-12-06',
      meses: [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 0, avisadoUsd: 426 }],
      clientes: [{ ws: 101, situacion: sit(CARTERA[0], '2026-12-06'), avisoEntrada: false }, { ws: 103, situacion: sit(CARTERA[2], '2026-12-06'), avisoEntrada: false }],
      cuentas: new Map([[AG, { pausada: false, corte: null }], [101, { pausada: false, corte: null }], [103, { pausada: false, corte: null }]]),
    })),
    pausar: async (ws, c) => { if (ws === o.falla) throw new Error('la base no contestó'); escrito.push(`pausar ${ws} ${c.mensualidad?.rol} ${c.mensualidad?.causas.join(',')}`); return true; },
    reabrir: async (ws) => { escrito.push(`reabrir ${ws}`); return true; },
    guardarCorte: async (ws) => { escrito.push(`corte ${ws}`); },
  };
  return { deps, escrito };
}

test('⛔ una lectura que falla NUNCA pausa ni reabre: no se escribe nada', async () => {
  const { deps, escrito } = base({ leer: async () => { throw new Error('connect ETIMEDOUT'); } });
  const r = await revisarPausas(AG, deps);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /No pausé ni reabrí nada: connect ETIMEDOUT/);
  assert.deepEqual(escrito, []);
});

test('el día 6 sin el total: pausa la agencia (rol agencia) y sus clientes; en seco no escribe', async () => {
  const { deps, escrito } = base();
  const r = await revisarPausas(AG, deps);
  assert.ok(r.ok);
  assert.deepEqual(escrito.sort(), ['pausar 101 cliente mes:2026-12', 'pausar 103 cliente mes:2026-12', 'pausar 13 agencia mes:2026-12']);
  const seco = base();
  const r2 = await revisarPausas(AG, seco.deps, { enSeco: true });
  assert.equal(r2.ok && r2.cambios.length, 3);
  assert.deepEqual(seco.escrito, []);
});

test('si la base falla al pausar UNA cuenta, las demás siguen y esa queda con su error', async () => {
  const { deps, escrito } = base({ falla: 101 });
  const r = await revisarPausas(AG, deps);
  assert.ok(r.ok);
  assert.deepEqual(r.cambios.filter((c) => !c.ok).map((c) => [c.ws, c.error]), [[101, 'la base no contestó']]);
  assert.equal(escrito.length, 2);
});

test('pagado, entra solo: la cuenta en pausa por la mensualidad se reabre', async () => {
  const corte: CorteGuardado = { cobroId: 0, hasta: '2026-12-06', motivo: 'paga-para-entrar', desde: '2026-12-06T14:07:00Z', vigente: true, mensualidad: { agenciaWs: AG, rol: 'agencia', causas: ['mes:2026-12'], perdonadas: [] } };
  const { deps, escrito } = base({ leer: async () => ({ agenciaWs: AG, hoy: '2026-12-07', meses: [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 426, avisadoUsd: 426 }], clientes: [], cuentas: new Map([[AG, { pausada: true, corte }]]) }) });
  await revisarPausas(AG, deps);
  assert.deepEqual(escrito, ['reabrir 13']);
});

// ── 7. El corte «Paga para entrar» en el acceso ──────────────────────────────────────────────────────────────────

test('«Paga para entrar»: el cliente ve «contacta a tu agencia» sin montos; la agencia, por dónde pagar; nada se ofrece pagar', () => {
  const base0: CorteGuardado = { cobroId: 0, hasta: '2026-12-06', motivo: 'paga-para-entrar', desde: '2026-12-06T14:07:00Z', vigente: true, mensualidad: { agenciaWs: AG, rol: 'cliente', causas: ['entrada'], perdonadas: [] } };
  const cli = textoDelCorte(base0);
  assert.match(cli.detalle, /Contacta a tu agencia/);
  assert.doesNotMatch(`${cli.titulo} ${cli.detalle}`, /US\$|\$|\d{2}\/\d{2}/, 'sin montos ni fechas');
  const ag = textoDelCorte({ ...base0, mensualidad: { ...base0.mensualidad!, rol: 'agencia' } });
  assert.match(ag.detalle, /comprobante de Binance al grupo de MaKo/);
  assert.equal(leOfrecePagar({ esAgencia: false, corte: base0, quienPaga: null }), false);
  assert.deepEqual(pasoDeAcceso({ estado: 'al-dia', cobroId: 1 }, 'pausado', base0), { tipo: 'nada' }, 'la pasarela no la reabre');
  // El campo anidado sobrevive a la vuelta de `guardarCorte` de lib/plan-acceso.ts (un spread y JSON.stringify).
  const vuelta = leerCorte(JSON.stringify({ ...leerCorte(JSON.stringify(base0))!, vigente: false }));
  assert.deepEqual(vuelta?.mensualidad, base0.mensualidad);
  assert.deepEqual(leerCortePagaParaEntrar(base0.mensualidad), { agenciaWs: AG, rol: 'cliente', causas: ['entrada'], perdonadas: [] });
});

// ── 8. Lo guardado, y cómo se dice ───────────────────────────────────────────────────────────────────────────────

test('lo guardado se lee saneado (y lo de antes del 6/11 sigue valiendo)', () => {
  assert.deepEqual(leerConfigMensualidad({ desde: '2026-12', medio: 'Binance' })?.entradasDesde, '2026-12-01', 'sin el día: desde el primer mes');
  assert.equal(leerConfigMensualidad({ desde: '2026-12', entradasDesde: '2026-11-07' })?.entradasDesde, '2026-11-07');
  assert.equal(leerConfigMensualidad({ desde: 'diciembre' }), null);
  assert.equal(leerPagoDelMes({ mes: '2026-11', pagadoEl: '2026-11-04', totalUsd: 238 })?.pagadoUsd, 238, 'un mes marcado antes cuenta completo');
  assert.equal(leerPagoDelMes({ mes: '2026-12', pagadoEl: '2026-12-02', totalUsd: 426, pagadoUsd: 200, ordenes: ['123456789012345678', 'x'] })?.ordenes.length, 1);
  assert.equal(leerEntrada({ ws: 104, desde: '2026-11-09', montoUsd: 40.73, pagadoUsd: 40.73, pagadoEl: '2026-11-09' })?.desde, '2026-11-09');
  assert.equal(leerEntrada({ ws: 'x' }), null);
  assert.ok(esDia('2026-02-28') && !esDia('2026-02-30'));
});

test('los textos del grupo: piden el comprobante, dicen el monto, de tú y sin voseo', () => {
  const dic = mes('2026-12', '2026-11-07');
  const t = tablaDelMes({ agencia: 'Código Inmobiliario', cuenta: dic, medio: 'Binance' });
  const aviso = textoDelAvisoDelMes({ agencia: 'Código Inmobiliario', tabla: t, medio: 'Binance' });
  assert.match(aviso, /US\$ 332/);
  assert.match(aviso, /comprobante/);
  const entradas = [{ nombre: 'Giselle', entrada: diferencialDe('2026-11-11', 47) }];
  const te = tablaDeEntradas({ agencia: 'Código Inmobiliario', medio: 'Binance', entradas });
  assert.equal(te.totalUsd, 37.6);
  assert.deepEqual(te.filas[0], ['Entrada de Giselle', 'del 11/11 al 04/12', '24 × US$ 1,5667', 'US$ 37,60']);
  const todos = [
    aviso, textoDelAvisoDeEntradas({ tabla: te, medio: 'Binance', entradas }), textoDelAvisoDeEntradas({ tabla: te, medio: 'Binance', entradas, enPausa: true }),
    textoDePausaDelMes({ mes: '2026-12', faltaUsd: 226 }), ...t.notas, ...te.notas,
    textoDeComprobante({ tipo: 'cubre', montoUsd: 426, conceptos: ['la mensualidad de diciembre'], reabiertas: 3 }),
    textoDeComprobante({ tipo: 'parcial', montoUsd: 200, conceptos: ['la mensualidad de diciembre'], cubiertos: [], faltaUsd: 226 }),
    textoDeComprobante({ tipo: 'repetido', numero: 3 }), textoDeComprobante({ tipo: 'revisar' }),
  ];
  for (const x of todos) assert.deepEqual(marcasDeVoseo(x), [], x);
  assert.match(textoDeComprobante({ tipo: 'repetido', numero: 3 }), /N\.º 0003/);
  assert.equal(usd(40.733), 'US$ 40,73');
});

test('el PDF del cobro es determinista (mismos datos, mismos bytes) y es un PDF', async () => {
  const { pdfDelCobro } = await import('../lib/agencia-mes-pdf');
  const t = tablaDelMes({ agencia: 'Código Inmobiliario', cuenta: mes('2026-12', '2026-11-07'), medio: 'Binance' });
  const a = await pdfDelCobro(t, '2026-12-01', 'Código Inmobiliario');
  const b = await pdfDelCobro(t, '2026-12-01', 'Código Inmobiliario');
  assert.equal(Buffer.from(a.slice(0, 5)).toString(), '%PDF-');
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
});
