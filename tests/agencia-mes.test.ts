// =============================================================================
// La mensualidad de una agencia (acuerdo con Código Inmobiliario, 30/10/2026) — lib/agencia-mes-reglas.ts
// =============================================================================
// El acuerdo: la agencia paga su plan y cada cliente el suyo (del catálogo de planes); desde que la agencia invita a un
// cliente corren 14 días sin costo y después cuenta; si lo dan de baja antes, no se cobra; se paga una vez por mes, del 1
// al 5, por fuera de MaKo. El caso real, al 5/11/2026, con los clientes de la agencia por su nombre de pila y números de
// cuenta inventados.
//
// Probado ROMPIÉNDOLO (5/11/2026), una rotura a la vez sobre lib/agencia-mes-reglas.ts, con la base en verde:
//   · `cuentaDesde` con 0 días en vez de `DIAS_SIN_COSTO`             → 9 fallos (situaciones, meses, bajas, plazos, avisos).
//   · `baja <= desde` → `baja < desde` (la baja del día 15)          → 1 fallo («la baja el mismo día que empezaría a contar»).
//   · sin la corrección (`c.corregido ?? c.invitado` → `c.invitado`) → 7 fallos (Giselle cuenta desde el 12/10).
//   · `COBRA_LOS_DIAS_DEL_PRIMER_MES = false`                       → 2 fallos (diciembre y la baja después de contar).
//   · `anterior >= p.primerMes` → `true` (cobra los días de octubre) → 2 fallos (noviembre y su aviso).
//   · `planQueSeCobra` sin mirar `elegido`                          → 1 fallo (la cuenta sin elegir con capa Pro).
//   · `plazosPorVencer` con `faltan <= 3`                            → 1 fallo.
//   · `mesQueSeAvisa` con `d <= 6`                                    → 1 fallo.
// Renombrar una variable local de `cuentaDelMes` (`lineas` → `renglones`): 0 fallos.
//
// Correr: node --import tsx --test tests/agencia-mes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoDelMes, avisoDePlazo, clientesEnLaCuenta, cuentaDelMes, cuentaDesde, diasEntre, esDia, leerConfigMensualidad, leerPagoDelMes,
  mesQueSeAvisa, mesesEntre, planQueSeCobra, plazosPorVencer, preciosDelCatalogo, renglonDeLinea, situacion, sumarDias, textoDeSituacion, usd,
  type ClienteDeAgencia, type CuentaDelMes,
} from '../lib/agencia-mes-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { marcasDeVoseo } from '../lib/voseo';

// Los precios salen del catálogo de planes, no de un número escrito acá.
const PRECIOS = preciosDelCatalogo(PLANES_MAKO_DEFAULT)!;
const HOY = '2026-11-05';
const PRIMER_MES = '2026-11';

const cliente = (ws: number, nombre: string, invitado: string, extra: Partial<ClienteDeAgencia> = {}): ClienteDeAgencia => ({
  ws, nombre, estado: 'aprobado', invitado, corregido: null, baja: null, plan: 'esencial', ...extra,
});

/** La cartera de la agencia al 5/11/2026 (Giselle con la fecha corregida: su negocio nació el 28/09 como prueba). */
const CARTERA: ClienteDeAgencia[] = [
  cliente(101, 'Brigitte', '2026-09-28'),
  cliente(102, 'Natalia', '2026-10-14'),
  cliente(103, 'Sergio', '2026-10-16'),
  cliente(104, 'Pablo', '2026-10-14'),
  cliente(105, 'Patricia', '2026-10-21'),
  cliente(106, 'Giselle', '2026-09-28', { corregido: '2026-10-28' }),
  cliente(107, 'Marcela', '2026-10-30'),
];

const mes = (m: string, clientes = CARTERA): CuentaDelMes =>
  cuentaDelMes({ mes: m, primerMes: PRIMER_MES, planAgencia: 'pro', clientes, precios: PRECIOS })!;
const montos = (c: CuentaDelMes) => c.lineas.map((l) => [l.tipo === 'agencia' ? 'agencia' : `${l.nombre}:${l.tipo}`, l.montoUsd]);

test('los precios son los del catálogo: Esencial 47 y Pro 97', () => {
  assert.deepEqual(PRECIOS, { esencial: 47, pro: 97 });
  assert.equal(preciosDelCatalogo([{ id: 'esencial', precioUsd: 47 }]), null, 'sin Pro en el catálogo no se inventa un precio');
});

test('al 5/11: quién cuenta, desde cuándo, y cuándo vence el plazo de los demás', () => {
  const s = Object.fromEntries(CARTERA.map((c) => [c.nombre, situacion(c, HOY)]));
  assert.deepEqual(s.Brigitte, { tipo: 'cuenta', desde: '2026-10-12' });
  assert.deepEqual(s.Natalia, { tipo: 'cuenta', desde: '2026-10-28' });
  assert.deepEqual(s.Sergio, { tipo: 'cuenta', desde: '2026-10-30' });
  // Pablo y Patricia: su plazo ya venció, así que cuentan.
  assert.deepEqual(s.Pablo, { tipo: 'cuenta', desde: '2026-10-28' });
  assert.deepEqual(s.Patricia, { tipo: 'cuenta', desde: '2026-11-04' });
  assert.deepEqual(s.Giselle, { tipo: 'sin-costo', hasta: '2026-11-11', faltan: 6 }, 'Giselle vence el 11/11');
  assert.deepEqual(s.Marcela, { tipo: 'sin-costo', hasta: '2026-11-13', faltan: 8 }, 'Marcela vence el 13/11');
});

test('la fecha corregida manda sobre la invitación (Giselle sin corregir contaría desde el 12/10)', () => {
  const sinCorregir = { ...CARTERA[5], corregido: null };
  assert.deepEqual(situacion(sinCorregir, HOY), { tipo: 'cuenta', desde: '2026-10-12' });
  assert.equal(cuentaDesde(CARTERA[5]), '2026-11-11');
});

test('noviembre: el plan de la agencia y los cuatro que cuentan el 1/11; Patricia entra en diciembre', () => {
  const nov = mes('2026-11');
  assert.deepEqual(montos(nov), [['agencia', 97], ['Brigitte:mes', 47], ['Natalia:mes', 47], ['Pablo:mes', 47], ['Sergio:mes', 47]]);
  assert.equal(nov.totalUsd, 285);
  assert.equal(nov.limite, '2026-11-05');
  assert.equal(clientesEnLaCuenta(nov), 4);
  // Los días de octubre no se cobran: el acuerdo arrancó en noviembre.
  assert.ok(nov.lineas.every((l) => l.tipo !== 'dias'), 'noviembre no suma días de octubre');
});

test('diciembre: los siete con su mes, y los días de noviembre de los que empezaron a contar a mitad de mes', () => {
  const dic = mes('2026-12');
  const dias = dic.lineas.filter((l) => l.tipo === 'dias').map((l) => [l.nombre, l.dias, l.montoUsd]);
  assert.deepEqual(dias, [['Giselle', 20, 31.33], ['Marcela', 18, 28.2], ['Patricia', 27, 42.3]]);
  assert.equal(dic.lineas.filter((l) => l.tipo === 'mes').length, 7);
  assert.equal(dic.totalUsd, 527.83);
  assert.equal(clientesEnLaCuenta(dic), 7, 'una persona con su mes y sus días cuenta una vez');
});

test('si lo dan de baja antes de los 14 días, no se cobra nunca', () => {
  const marcela = { ...CARTERA[6], estado: 'revocado' as const, baja: '2026-11-12' };
  assert.deepEqual(situacion(marcela, '2026-11-20'), { tipo: 'baja-sin-costo', baja: '2026-11-12' });
  const dic = mes('2026-12', CARTERA.map((c) => (c.ws === 107 ? marcela : c)));
  assert.ok(!dic.lineas.some((l) => l.tipo !== 'agencia' && l.ws === 107), 'Marcela no entra a ninguna línea');
});

test('la baja el mismo día que empezaría a contar tampoco se cobra', () => {
  const marcela = { ...CARTERA[6], estado: 'revocado' as const, baja: '2026-11-13' };
  assert.equal(situacion(marcela, '2026-11-20').tipo, 'baja-sin-costo');
});

test('dado de baja después de contar: se cobran los días que contó, y no el mes siguiente', () => {
  const giselle = { ...CARTERA[5], estado: 'revocado' as const, baja: '2026-11-20' };
  assert.deepEqual(situacion(giselle, '2026-11-25'), { tipo: 'baja', desde: '2026-11-11', baja: '2026-11-20' });
  const dic = mes('2026-12', CARTERA.map((c) => (c.ws === 106 ? giselle : c)));
  const suyas = dic.lineas.filter((l) => l.tipo !== 'agencia' && l.ws === 106);
  assert.deepEqual(suyas.map((l) => [l.tipo, l.montoUsd]), [['dias', 14.1]], 'del 11 al 19: 9 días');
  assert.equal(renglonDeLinea(suyas[0]), 'Giselle · del 11 al 19 de noviembre (9 días): US$ 14,10');
});

test('una pendiente cuenta igual que una aprobada: el reloj corre desde la invitación', () => {
  const pend = cliente(108, 'Nuevo', '2026-10-01', { estado: 'pendiente' });
  assert.equal(situacion(pend, HOY).tipo, 'cuenta');
});

test('el plan: el elegido por su capa; sin elegir, Esencial (el acuerdo es 47 por cliente)', () => {
  assert.equal(planQueSeCobra({ elegido: true, capa: 'agencia' }), 'pro');
  assert.equal(planQueSeCobra({ elegido: true, capa: 'completo' }), 'esencial');
  assert.equal(planQueSeCobra({ elegido: false, capa: 'agencia' }), 'esencial', 'una cuenta de antes del 29/10 sin elegir no paga Pro');
  const pro = cliente(109, 'Con Pro', '2026-09-01', { plan: 'pro' });
  assert.deepEqual(montos(mes('2026-11', [pro])), [['agencia', 97], ['Con Pro:mes', 97]]);
});

test('el aviso de 2 días antes: el 9 y el 10 para Giselle, el 11 ya cuenta', () => {
  const nombres = (hoy: string) => plazosPorVencer(CARTERA, hoy).map((p) => `${p.nombre}:${p.faltan}`);
  assert.deepEqual(nombres('2026-11-08'), []);
  assert.deepEqual(nombres('2026-11-09'), ['Giselle:2']);
  assert.deepEqual(nombres('2026-11-10'), ['Giselle:1']);
  assert.deepEqual(nombres('2026-11-11'), ['Marcela:2']);
  const dada = CARTERA.map((c) => (c.ws === 106 ? { ...c, estado: 'revocado' as const, baja: '2026-11-08' } : c));
  assert.deepEqual(plazosPorVencer(dada, '2026-11-09'), [], 'a una dada de baja no se le avisa');
});

test('el aviso del mes sale del 1 al 5 (si el del 1 no salió, al día siguiente), desde el primer mes', () => {
  assert.equal(mesQueSeAvisa('2026-11-01', PRIMER_MES), '2026-11');
  assert.equal(mesQueSeAvisa('2026-11-05', PRIMER_MES), '2026-11');
  assert.equal(mesQueSeAvisa('2026-11-06', PRIMER_MES), null);
  assert.equal(mesQueSeAvisa('2026-10-01', PRIMER_MES), null, 'antes del primer mes no se avisa');
  assert.equal(cuentaDelMes({ mes: '2026-10', primerMes: PRIMER_MES, planAgencia: 'pro', clientes: CARTERA, precios: PRECIOS }), null);
});

test('lo guardado se lee saneado', () => {
  assert.deepEqual(leerConfigMensualidad({ desde: '2026-11' }), { desde: '2026-11', medio: 'Binance', prendidaPor: null, prendidaAt: null });
  assert.equal(leerConfigMensualidad('{"desde":"2026-13"}'), null);
  assert.equal(leerConfigMensualidad('roto'), null);
  assert.equal(leerPagoDelMes({ mes: '2026-11', pagadoEl: '2026-11-03', totalUsd: 285 })?.totalUsd, 285);
  assert.equal(leerPagoDelMes({ mes: '2026-11', pagadoEl: '2026-02-30', totalUsd: 285 }), null, 'un día que no existe');
  assert.equal(leerPagoDelMes({ mes: '2026-11', pagadoEl: '2026-11-03' }), null, 'sin el total no es un pago');
});

test('los días y los meses', () => {
  assert.equal(sumarDias('2026-10-28', 14), '2026-11-11');
  assert.equal(diasEntre('2026-11-05', '2026-11-11'), 6);
  assert.equal(esDia('2026-02-29'), false);
  assert.deepEqual(mesesEntre('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01']);
  assert.equal(usd(285), 'US$ 285');
  assert.equal(usd(1250.5), 'US$ 1.250,50');
});

test('los avisos dicen el total y cada línea, de tú y sin voseo', () => {
  const nov = mes('2026-11');
  const a = avisoDelMes({ agencia: 'La agencia', cuenta: nov, medio: 'Binance', sinCosto: [{ nombre: 'Giselle', hasta: '2026-11-11' }], link: 'https://hola-mako.com/agency' });
  assert.equal(a.titulo, 'Tu mensualidad de noviembre: US$ 285');
  assert.match(a.cuerpo, /entre el 1 y el 5 de noviembre, por Binance/);
  assert.match(a.cuerpo, /- Tu plan MaKo Pro: US\$ 97/);
  assert.match(a.cuerpo, /- Sergio · MaKo Esencial: US\$ 47/);
  assert.match(a.cuerpo, /Giselle hasta el 11\/11/);
  const p = avisoDePlazo({ nombre: 'Giselle', desde: '2026-11-11', plan: 'esencial', precioUsd: 47, link: 'https://hola-mako.com/agency' });
  assert.equal(p.titulo, 'Giselle empieza a contar el 11/11');
  assert.match(p.cuerpo, /dalo de baja antes de ese día/);
  for (const t of [a.titulo, a.resumen, a.cuerpo, a.preheader, p.titulo, p.resumen, p.cuerpo, p.preheader]) {
    assert.deepEqual(marcasDeVoseo(t), [], t);
  }
});

test('lo que dice la pantalla de cada cliente', () => {
  const t = (c: ClienteDeAgencia, hoy = HOY) => textoDeSituacion(situacion(c, hoy));
  assert.deepEqual(t(CARTERA[0]), { texto: 'Cuenta desde el 12/10', tono: 'good' });
  assert.deepEqual(t(CARTERA[5]), { texto: 'Sin costo hasta el 11/11', tono: null });
  assert.deepEqual(t(CARTERA[5], '2026-11-09'), { texto: 'Sin costo hasta el 11/11', tono: 'warn' }, 'a dos días, en ámbar');
  assert.deepEqual(t({ ...CARTERA[5], estado: 'revocado', baja: '2026-11-20' }, '2026-11-25'), { texto: 'Contó del 11/11 al 19/11', tono: null });
  assert.deepEqual(t({ ...CARTERA[6], estado: 'revocado', baja: '2026-11-12' }), { texto: 'De baja sin costo', tono: null });
  for (const c of CARTERA) assert.deepEqual(marcasDeVoseo(t(c).texto), []);
});
