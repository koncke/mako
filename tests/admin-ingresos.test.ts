// =============================================================================
// Admin › Revenue: lo que entra a MaKo, con los pagos reales (5/11/2026)
// =============================================================================
// Martín: «¿Cuánto es lo que me pagaron totalmente? ¿Cuánto me van pagando mes a mes?». Lo que fija, EJECUTANDO las cuentas
// de lib/admin-ingresos-reglas.ts:
//   1. el caso real medido en producción: octubre Leila 97, Código 146, Florencia 97; noviembre Código 238 en dos pagos;
//   2. dos pagos a menos de 7 días son UN cobro, y un cobro nuevo reemplaza al anterior (sube / baja), no se suma;
//   3. quien paga tarde adentro de la gracia no se corta; pasada la gracia, el corte; y si vuelve, «vuelve»;
//   4. un pago único es cash y nunca MRR; un pago sin dólares no se suma; uno con fecha futura no entra;
//   5. dos lugares de una agencia se suman (el segundo es «sube», no «nuevo»);
//   6. la identidad: MRR del mes = MRR del anterior + nuevo + vuelve + sube − baja − corte, todos los meses;
//   7. el lector: qué pago cuenta como recurrente (`esRecurrente`), y que la pantalla y la API se queden con el super admin;
//   8. la tabla de saldos del teléfono (app/admin/ingresos/ingresos-vista.ts) cierra exacta desde el primer mes.
// (Hasta el 6/11/2026 fijaba también la pantalla de Studio Admin, app/admin/ingresos/revenue.tsx, y las pestañas por
//  `?tab=`. Se borraron con la copia de Polar: los links viejos y el gráfico de ingresos los fija tests/admin-polar-resumen.test.ts.)
//
// Probado rompiéndolo el 5/11/2026 (con todo puesto: 0 fallos; el arnés restaura de memoria). Cada rotura, sola:
//   · `VENTANA_JUNTAR_DIAS = 0` (los dos pagos de Código, dos cobros)                       → 3 fallos (1, 2, 8)
//   · `tramosDe` suma los períodos que se pisan en vez de reemplazar                         → 4 fallos (1, 2, 3, 8)
//   · `GRACIA_DIAS = 0` (el que paga dos días tarde se corta y vuelve)                       → 1 fallo (3)
//   · `montoEn` cuenta el día del corte (`fecha > t.fin`)                                     → 2 fallos (3, 6)
//   · `periodosDe` mete los pagos únicos (sin `if (!p.suscripcion) continue`)                → 1 fallo (4)
//   · `usdDe` convierte `null` en 0 (sinDolares en 0)                                         → 1 fallo (4)
//   · `pagosValidos` deja entrar un pago de mañana                                            → 1 fallo (4)
//   · `movimientosDe` por suscripción y no por cliente (el segundo lugar sale «nuevo»)        → 1 fallo (5)
//   · `esRecurrente` cuenta una cuota del plan de un pago único                               → 1 fallo (7)
//   · Analytics › Metrics lee los ingresos antes de `exigirSuperAdmin()` (era app/admin/page.tsx) → 1 fallo (7)
//   · `filasDeSaldos` saca «Al empezar» del cierre del mes anterior                           → 1 fallo (8)
//   · `mesesVisibles` dibuja los doce meses aunque los primeros estén vacíos                  → 1 fallo (8)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ATRASO_MAXIMO_DIAS, calcularIngresos, diaEnLaZona, diasEntre, esLeadDeSuscripcion, periodosDe, porCobrarDe, proximoDeHistoria, tramosDe,
  TIPOS_MOVIMIENTO, type ClienteIngreso, type PagoIngreso,
} from '../lib/admin-ingresos-reglas';
import { historiaDeSuscripcion, type MovimientoSuscripcion, type PagoDeSuscripcion } from '../lib/suscripcion-meses';
import { filasDeSaldos, mesesVisibles } from '../app/admin/ingresos/ingresos-vista';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let n = 0;
const pago = (cliente: string, fecha: string, usd: number | null, suscripcion: string | null = `sub:${cliente}`, medio = 'transferencia'): PagoIngreso =>
  ({ id: `p:${++n}`, cliente, suscripcion, fecha, usd, medio, concepto: null });
const quien = (...nombres: string[]) => new Map<string, ClienteIngreso>(nombres.map((c) => [c, { clave: c, nombre: c, ws: null, leadId: null }]));

// Los nombres son de mentira (AGENTS.md: nada de datos reales en tests/). Los montos y las fechas, los medidos.
const OCTUBRE = [pago('leila', '2026-10-26', 97), pago('codigo', '2026-10-21', 146), pago('flor', '2026-10-18', 97)];
const NOVIEMBRE_CODIGO = [pago('codigo', '2026-11-04', 94, 'sub:codigo', 'binance'), pago('codigo', '2026-11-05', 144, 'sub:codigo', 'binance')];

test('1 · el caso medido: octubre 340, y noviembre con los dos pagos de Código es 238 y sube el MRR a 432', () => {
  const sinNov = calcularIngresos(OCTUBRE, quien('leila', 'codigo', 'flor'), '2026-11-05');
  const oct = sinNov.meses.find((m) => m.mes === '2026-10')!;
  assert.equal(oct.cobrado, 340, 'lo cobrado en octubre');
  assert.equal(oct.mrr, 340, 'el MRR al cierre de octubre');
  assert.equal(oct.nuevo, 340, 'los tres entraron en octubre');
  assert.equal(sinNov.mrr, 340, 'hoy, sin los pagos de noviembre cargados, siguen los tres vivos');
  assert.equal(sinNov.pagando, 3);
  assert.equal(sinNov.cobradoTotal, 340);

  const conNov = calcularIngresos([...OCTUBRE, ...NOVIEMBRE_CODIGO], quien('leila', 'codigo', 'flor'), '2026-11-05');
  const nov = conNov.meses.find((m) => m.mes === '2026-11')!;
  assert.equal(nov.cobrado, 238, 'noviembre: los dos pagos de Código');
  assert.equal(conNov.mrr, 432, 'MRR de hoy: 97 + 97 + 238');
  assert.equal(nov.sube, 92, 'Código subió de 146 a 238');
  assert.equal(nov.nuevo + nov.vuelve + nov.baja + nov.corte, 0, 'nada más se movió en noviembre');
  assert.equal(conNov.cobradoTotal, 578, 'lo que entró desde siempre');
  const codigo = conNov.clientes.find((c) => c.clave === 'codigo')!;
  assert.equal(codigo.total, 384, 'Código pagó 146 + 94 + 144');
  assert.equal(codigo.mrr, 238);
  assert.equal(codigo.proximo, '2026-12-04', 'el próximo, un mes después del primer pago de noviembre');
  assert.equal(conNov.clientes[0].clave, 'codigo', 'el que más paga, primero');
  assert.deepEqual(conNov.porCobrar.map((p) => [p.cliente, p.fecha, p.usd]), [['flor', '2026-11-18', 97], ['leila', '2026-11-26', 97], ['codigo', '2026-12-04', 238]]);
});

test('2 · dos pagos a menos de 7 días son UN cobro, y uno nuevo reemplaza al anterior (baja)', () => {
  const ps = [...OCTUBRE.filter((p) => p.cliente === 'codigo'), ...NOVIEMBRE_CODIGO];
  const periodos = periodosDe(ps, '2026-11-05');
  assert.deepEqual(periodos.map((p) => [p.inicio, p.usd]), [['2026-10-21', 146], ['2026-11-04', 238]]);
  // Baja: paga 200 y después 150.
  const bajo = calcularIngresos([pago('b', '2026-08-01', 200), pago('b', '2026-09-01', 150)], quien('b'), '2026-09-10');
  const sep = bajo.meses.find((m) => m.mes === '2026-09')!;
  assert.equal(sep.baja, 50);
  assert.equal(bajo.mrr, 150, 'el cobro nuevo REEMPLAZA: no 350');
});

test('3 · la gracia: dos días tarde no corta; sin pagar, el corte cae el día que venció; y si vuelve, «vuelve»', () => {
  const tarde = calcularIngresos([pago('t', '2026-09-26', 97), pago('t', '2026-10-28', 97)], quien('t'), '2026-11-05');
  assert.deepEqual(tarde.movimientos.map((m) => m.tipo), ['nuevo'], 'pagar dos días tarde no es cortar y volver');
  assert.equal(tarde.meses.find((m) => m.mes === '2026-10')!.mrr, 97);

  const atrasado = calcularIngresos([pago('a', '2026-10-01', 100)], quien('a'), '2026-11-10');
  assert.equal(atrasado.mrr, 100, 'adentro de la gracia sigue contando');
  assert.equal(atrasado.clientes[0].estado, 'atrasado');
  assert.equal(atrasado.clientes[0].diasAtraso, 9);

  const cortado = calcularIngresos([pago('c', '2026-09-01', 100), pago('c', '2026-10-01', 100)], quien('c'), '2026-11-20');
  assert.equal(cortado.mrr, 0);
  const corte = cortado.movimientos.find((m) => m.tipo === 'corte')!;
  assert.equal(corte.fecha, '2026-11-01', 'el corte, el día que venció');
  assert.equal(cortado.clientes[0].estado, 'cortado');
  const tramos = tramosDe(periodosDe([pago('c2', '2026-09-01', 100), pago('c2', '2026-10-01', 100)], '2026-11-20'), '2026-11-20');
  assert.equal(tramos[0].fin, '2026-11-01');

  const vuelve = calcularIngresos([pago('v', '2026-07-01', 80), pago('v', '2026-10-01', 80)], quien('v'), '2026-10-05');
  assert.deepEqual(vuelve.movimientos.map((m) => [m.tipo, m.fecha]).reverse(), [['nuevo', '2026-07-01'], ['corte', '2026-08-01'], ['vuelve', '2026-10-01']]);
});

test('4 · un pago único es cash y no MRR; sin dólares no se suma; una fecha futura no entra', () => {
  const r = calcularIngresos([pago('u', '2026-10-10', 1500, null), pago('u', '2026-10-12', null, null), pago('u', '2026-11-06', 500, null)], quien('u'), '2026-11-05');
  assert.equal(r.mrr, 0, 'un pago único no es MRR');
  assert.equal(r.meses.find((m) => m.mes === '2026-10')!.cobrado, 1500, 'pero es cash del mes');
  assert.equal(r.cobradoTotal, 1500, 'el de mañana todavía no entró, y el sin dólares no se inventa');
  assert.equal(r.sinDolares, 1);
  assert.equal(r.clientes[0].estado, 'pago-unico');
  assert.equal(r.clientes[0].sinDolares, 1);
});

test('5 · dos lugares de una agencia se suman, y el segundo es «sube»', () => {
  const r = calcularIngresos([pago('ag', '2026-10-01', 47, 'lugar:1'), pago('ag', '2026-10-15', 47, 'lugar:2')], quien('ag'), '2026-10-20');
  assert.equal(r.mrr, 94);
  assert.deepEqual(r.movimientos.map((m) => m.tipo).reverse(), ['nuevo', 'sube']);
});

test('6 · MRR del mes = anterior + nuevo + vuelve + sube − baja − corte, todos los meses', () => {
  // Un universo con de todo: entradas, subas, bajas, atrasos, cortes y vueltas, en 14 meses.
  let semilla = 7;
  const azar = () => { semilla = (semilla * 48271) % 2147483647; return semilla / 2147483647; };
  const ps: PagoIngreso[] = [];
  for (let c = 0; c < 12; c++) {
    let d = new Date(Date.UTC(2025, 9 + Math.floor(azar() * 6), 1 + Math.floor(azar() * 27)));
    let monto = [47, 97, 146, 238][Math.floor(azar() * 4)];
    for (let k = 0; k < 14; k++) {
      if (d.toISOString().slice(0, 10) > '2026-11-05') break;
      ps.push(pago(`c${c}`, d.toISOString().slice(0, 10), monto));
      if (azar() < 0.3) ps.push(pago(`c${c}`, new Date(d.getTime() + 86_400_000 * 2).toISOString().slice(0, 10), 20));
      if (azar() < 0.2) monto += 50;
      else if (azar() < 0.1) monto = Math.max(20, monto - 30);
      const salto = azar() < 0.15 ? 60 + Math.floor(azar() * 60) : 28 + Math.floor(azar() * 10);
      d = new Date(d.getTime() + salto * 86_400_000);
    }
  }
  const r = calcularIngresos(ps, quien(), '2026-11-05', 14);
  assert.ok(r.movimientos.some((m) => m.tipo === 'corte') && r.movimientos.some((m) => m.tipo === 'vuelve'), 'el universo trae cortes y vueltas');
  for (let i = 1; i < r.meses.length; i++) {
    const [a, b] = [r.meses[i - 1], r.meses[i]];
    const esperado = Math.round((a.mrr + b.nuevo + b.vuelve + b.sube - b.baja - b.corte) * 100) / 100;
    assert.equal(b.mrr, esperado, `${b.mes}: ${a.mrr} + movimientos ≠ ${b.mrr}`);
  }
  for (const t of TIPOS_MOVIMIENTO) assert.ok(r.meses.every((m) => m[t] >= 0), `${t} va en positivo`);
});

test('7 · el lector: qué es recurrente, y la puerta del super admin antes de leer', async () => {
  // `esRecurrente` vive en el lector (server-only): se fija leyendo su cuerpo, que es corto y no tiene ramas escondidas.
  const lector = sinComentarios(leer('lib/admin-ingresos.ts'));
  const cuerpo = lector.slice(lector.indexOf('export function esRecurrente'), lector.indexOf('async function leadsDe'));
  assert.ok(cuerpo.length > 100 && cuerpo.length < 700, 'el recorte es la función, no el archivo');
  assert.match(cuerpo, /es_mensualidad === true\) return true/, 'la mensualidad registrada a mano, siempre');
  assert.match(cuerpo, /cobrosDeSuscripcion\.has/, 'el cobro de una suscripción de la pasarela');
  assert.match(cuerpo, /venta_tipo === 'suscripcion' && p\.nacio_cobrada !== true && p\.resto_de == null/, 'una cuota del plan, sólo de un lead de suscripción');
  assert.match(lector, /wsSuperAdmin\(\)/, 'la plataforma por su capa');
  assert.doesNotMatch(lector, /OWNER_WS/, 'nunca el 1, que es un cliente');
  assert.match(lector, /nombrados\.has\(Number\(c\.id\)\)/, 'un cobro que ya asentó su pago no se cuenta dos veces');

  // Desde el 6/11/2026 los ingresos se ven en Analytics › Metrics (la copia de Polar; el `?tab=revenue` viejo va ahí). La puerta
  // es `exigirSuperAdmin()` (getSesionAdmin, el rol global: app/admin/_polar/datos/guarda.ts).
  const page = sinComentarios(leer('app/admin/(polar)/analytics/metrics/page.tsx'));
  const puerta = page.indexOf('await exigirSuperAdmin()');
  assert.ok(puerta > 0, 'la página pregunta por el super admin');
  const lectura = page.indexOf('vistaDeIngresos(', page.indexOf('export default'));
  assert.ok(lectura > 0 && puerta < lectura, 'la puerta va ANTES de leer los ingresos');
  assert.match(sinComentarios(leer('app/admin/_polar/datos/guarda.ts')), /await getSesionAdmin\(\)/, 'la puerta es el super admin global');
});

test('8 · la tabla de saldos (el teléfono) cierra exacta desde el primer mes', () => {
  const r = calcularIngresos([...OCTUBRE, ...NOVIEMBRE_CODIGO], quien('leila', 'codigo', 'flor'), '2026-11-05');
  const meses = mesesVisibles(r.meses);
  assert.deepEqual(meses.map((m) => m.mes), ['2026-09', '2026-10', '2026-11'], 'desde el primero con plata, y al menos tres');
  const filas = filasDeSaldos(meses);
  const fila = (id: string) => filas.find((f) => f.id === id)!;
  assert.deepEqual(fila('inicio').valores, [0, 0, 340]);
  assert.deepEqual(fila('cierre').valores, [0, 340, 432]);
  assert.deepEqual(fila('nuevo').valores, [0, 340, 0]);
  assert.deepEqual(fila('sube').valores, [0, 0, 92]);
  assert.ok(!filas.some((f) => f.id === 'corte'), 'una fila en cero en todos los meses no se dibuja');
  // Desde un mes que no es el primero, «Al empezar» sigue cerrando: inicio + movimientos = cierre.
  const dos = filasDeSaldos(meses.slice(-1));
  assert.deepEqual(dos.find((f) => f.id === 'inicio')!.valores, [340]);
});

// =============================================================================
// 10 · El próximo cobro sale de la historia mes a mes (6/11/2026, Admin › Sales)
// =============================================================================
// Con la regla de los tramos, el próximo cobro era el último pago más un mes, con el monto de ese pago. Una suscripción que
// vence el día 5, que pagó noviembre en dos pagos (el 4 y el 5) y que tiene guardado que desde diciembre paga más, salía «vence
// el 4/12 por 238» cuando la ficha dice «próxima el 5 de diciembre» por 426 (la forma de un cliente real, con datos de mentira).
// Probado rompiéndolo el 6/11/2026: base 9/1 (el 7 ya estaba rojo: lee app/admin/page.tsx, que la tab nueva borró). Cada rotura,
// sola, deja 8/2 (el 7 y el 10):
//   · `porCobrarDe` ignora `proximos` (la regla de antes)                                   → 10 cae (12-04 · 238)
//   · `proximoDeHistoria` toma `montoHoyUsd` y no lo que falta del mes que toca              → 10 cae (el parcial de enero)
//   · `proximoDeHistoria` no corta con `cortadaDesde`                                        → 10 cae (la cortada sigue «por cobrar»)
//   · `porCobrarDe` sin el `usadas` (dos claves de la misma suscripción)                     → 10 cae (sale dos veces)
//   · `proximoDeHistoria` con `proximaFecha >= hoy` (el que vence hoy, dos veces)            → 10 cae
test('10 · el próximo cobro de una suscripción a mano sale de su historia: el día de cobro y el monto guardado del mes', () => {
  const hoy = '2026-11-06';
  // La mensualidad cambió dos veces: 146 desde la venta, 238 desde noviembre y 426 desde diciembre (mig 0401).
  const movimientos: MovimientoSuscripcion[] = [
    { tipo: 'monto', desde: '2026-08-05', montoUsd: 146 },
    { tipo: 'monto', desde: '2026-11-01', montoUsd: 238 },
    { tipo: 'monto', desde: '2026-12-01', montoUsd: 426 },
  ];
  let id = 500;
  const mensualidad = (fecha: string, usd: number): PagoDeSuscripcion =>
    ({ id: ++id, monto_usd: usd, pagado: true, fecha_esperada: null, fecha_pago: fecha, es_mensualidad: true, nacio_cobrada: true });
  const pagosLead = [mensualidad('2026-08-05', 146), mensualidad('2026-09-05', 146), mensualidad('2026-10-06', 146), mensualidad('2026-11-04', 94), mensualidad('2026-11-05', 144)];
  const historia = historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos, pagos: pagosLead, hoy });
  assert.equal(historia.proximaFecha, '2026-12-05', 'la ficha: próxima el 5 de diciembre');
  // Lo cobrado en Admin: los mismos pagos, normalizados por el lector (la clave de una suscripción de la casa).
  const sub = 'lead:900:casa';
  const pagos: PagoIngreso[] = pagosLead.map((q) => ({ id: `p:${q.id}`, cliente: 'ws:77', suscripcion: sub, fecha: q.fecha_pago as string, usd: Number(q.monto_usd), medio: 'transferencia', concepto: null }));
  const quienes = new Map<string, ClienteIngreso>([['ws:77', { clave: 'ws:77', nombre: 'Estudio Norte', ws: 77, leadId: 900 }]]);
  const viejo = calcularIngresos(pagos, quienes, hoy);
  assert.deepEqual(viejo.porCobrar.map((p) => [p.cliente, p.fecha, p.usd]), [['ws:77', '2026-12-04', 238]], 'sin la historia, la regla de los tramos (la de antes)');
  const proximos = new Map([[sub, proximoDeHistoria(historia, hoy)]]);
  const nuevo = calcularIngresos(pagos, quienes, hoy, 12, proximos);
  assert.deepEqual(nuevo.porCobrar.map((p) => [p.cliente, p.fecha, p.usd, p.atrasado]), [['ws:77', '2026-12-05', 426, false]], 'el 5/12 por 426, como la ficha');
  assert.equal(nuevo.mrr, viejo.mrr, 'el MRR no cambia: la historia sólo pone cuándo y cuánto');

  // El 10/12, sin pagar diciembre: atrasado por lo que falta, y enero (que ya tiene un adelanto de 100) por lo que falta de enero.
  const hoy2 = '2026-12-10';
  const conAdelanto = [...pagosLead, { id: ++id, monto_usd: 100, pagado: true, fecha_esperada: null, fecha_pago: '2026-12-09', suscripcion_mes: '2027-01-01' } satisfies PagoDeSuscripcion];
  const h2 = historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos, pagos: conAdelanto, hoy: hoy2 });
  const p2 = proximoDeHistoria(h2, hoy2);
  assert.deepEqual(p2.atrasado, { fecha: '2026-12-05', usd: 426 });
  assert.deepEqual(p2.siguiente, { fecha: '2027-01-05', usd: 326 }, 'lo que FALTA de enero, no la mensualidad entera');
  const tramos2 = tramosDe(periodosDe(pagos, hoy2), hoy2);
  assert.deepEqual(porCobrarDe(tramos2, hoy2, 31, new Map([[sub, p2]])).map((p) => [p.fecha, p.usd, p.atrasado]), [['2026-12-05', 426, true], ['2027-01-05', 326, false]]);
  // Lo que vence HOY va una sola vez, en lo atrasado.
  const pHoy = proximoDeHistoria(historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos, pagos: pagosLead, hoy: '2026-12-05' }), '2026-12-05');
  assert.deepEqual([pHoy.atrasado, pHoy.siguiente], [{ fecha: '2026-12-05', usd: 426 }, null]);

  // Un corte guardado desde diciembre: no se espera diciembre, aunque el tramo siga vivo (vence el 4/12 y tiene su gracia).
  const seCorta = historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos: [...movimientos, { tipo: 'corte', desde: '2026-12-01' }], pagos: pagosLead, hoy });
  assert.deepEqual(calcularIngresos(pagos, quienes, hoy, 12, new Map([[sub, proximoDeHistoria(seCorta, hoy)]])).porCobrar, [], 'el corte que viene: nada por cobrar');
  // Cortada desde este mes: `sinCobro`, ni lo atrasado.
  const cortada = historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos: [...movimientos, { tipo: 'corte', desde: '2026-12-01' }], pagos: pagosLead, hoy: '2026-12-10' });
  const pc = proximoDeHistoria(cortada, '2026-12-10');
  assert.equal(pc.sinCobro, true);
  assert.deepEqual(porCobrarDe(tramosDe(periodosDe(pagos, '2026-12-10'), '2026-12-10'), '2026-12-10', 31, new Map([[sub, pc]])), [], 'cortada: ni lo atrasado');

  // Dos claves de la misma suscripción (pagos con y sin su CRM) son UNA historia: sale una vez.
  const conCrm = pagos.map((p, i) => (i === 4 ? { ...p, suscripcion: 'lead:900:31' } : p));
  const p1 = proximoDeHistoria(historia, hoy);
  const dos = calcularIngresos(conCrm, quienes, hoy, 12, new Map([[sub, p1], ['lead:900:31', p1]]));
  assert.equal(dos.porCobrar.length, 1, 'una sola vez');
});

// =============================================================================
// 11 · El estado y el próximo pago de CADA CLIENTE salen de la misma historia que lo que viene (6/11/2026, Admin › Customers)
// =============================================================================
// El test 10 arregló `porCobrar`; el renglón de cada cliente (`clientes[].proximo`, `estado`, `diasAtraso`: lo que leen At Risk y la
// ficha) seguía con el último pago más un mes. El mismo cliente decía «vence el 4/12» (y el 4/12 «Atrasado») en su renglón y «el
// 5/12» en lo que viene. Ahora `clientesDe` recibe las mismas historias (`proximoDelCliente`).
// Probado rompiéndolo el 6/11/2026 (base, con el 11 puesto: 10/0). Cada rotura, sola:
//   · `calcularIngresos` no le pasa `proximos` a `clientesDe` (la regla de antes)                → 9/1 (11)
//   · `proximoDelCliente` sin el `sinCobro`, y cae al último cobro más un mes (la cortada espera) → 9/1 (11)
//   · `proximoDelCliente` toma `siguiente` antes que `atrasado` (lo atrasado se esconde)        → 9/1 (11)
//   · `clientesDe` con un `vence == null` que cae a «atrasado» (en vez de «al día»)               → 9/1 (11)
test('11 · el próximo pago y el estado de cada cliente salen de la historia: el 5/12, no el 4/12, y sin «atrasado» de mentira', () => {
  const movimientos: MovimientoSuscripcion[] = [
    { tipo: 'monto', desde: '2026-08-05', montoUsd: 146 },
    { tipo: 'monto', desde: '2026-11-01', montoUsd: 238 },
    { tipo: 'monto', desde: '2026-12-01', montoUsd: 426 },
  ];
  let id = 700;
  const mensualidad = (fecha: string, usd: number): PagoDeSuscripcion =>
    ({ id: ++id, monto_usd: usd, pagado: true, fecha_esperada: null, fecha_pago: fecha, es_mensualidad: true, nacio_cobrada: true });
  const pagosLead = [mensualidad('2026-08-05', 146), mensualidad('2026-09-05', 146), mensualidad('2026-10-06', 146), mensualidad('2026-11-04', 94), mensualidad('2026-11-05', 144)];
  const sub = 'lead:910:casa';
  const pagos: PagoIngreso[] = pagosLead.map((q) => ({ id: `p:${q.id}`, cliente: 'ws:78', suscripcion: sub, fecha: q.fecha_pago as string, usd: Number(q.monto_usd), medio: 'transferencia', concepto: null }));
  const quienes = new Map<string, ClienteIngreso>([['ws:78', { clave: 'ws:78', nombre: 'Estudio Norte', ws: 78, leadId: 910 }]]);
  const conHistoria = (hoy: string, extra: MovimientoSuscripcion[] = []) =>
    new Map([[sub, proximoDeHistoria(historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 426, plazoMeses: null, movimientos: [...movimientos, ...extra], pagos: pagosLead, hoy }), hoy)]]);
  const cliente = (hoy: string, proximos?: ReturnType<typeof conHistoria>) => calcularIngresos(pagos, quienes, hoy, 12, proximos).clientes.find((c) => c.clave === 'ws:78')!;

  // El 4/12: el último cobro (4/11) más un mes dice «vence hoy, atrasado»; la ficha dice que vence el 5.
  const viejo = cliente('2026-12-04');
  assert.deepEqual([viejo.proximo, viejo.estado, viejo.diasAtraso], ['2026-12-04', 'atrasado', 0], 'sin la historia, la regla de antes');
  const nuevo = cliente('2026-12-04', conHistoria('2026-12-04'));
  assert.deepEqual([nuevo.proximo, nuevo.estado, nuevo.diasAtraso], ['2026-12-05', 'por-vencer', null], 'con la historia: el 5/12, por vencer');
  // Desde el punto 10 de la revisión del 6/11/2026, con la historia el MRR de diciembre es su MENSUALIDAD (426), no lo pagado en
  // noviembre (238): es lo mismo que dice su tabla. Sin la historia sigue lo pagado.
  assert.deepEqual([viejo.mrr, nuevo.mrr], [238, 426], 'el MRR: lo pagado sin la historia, la mensualidad del mes con ella');
  const r = calcularIngresos(pagos, quienes, '2026-12-04', 12, conHistoria('2026-12-04'));
  assert.equal(r.porCobrar[0].fecha, nuevo.proximo, 'el renglón del cliente y lo que viene dicen la MISMA fecha');

  // El 10/12 sin pagar diciembre: atrasado desde el 5 (5 días), no desde el 4 (6 días).
  const tarde = cliente('2026-12-10', conHistoria('2026-12-10'));
  assert.deepEqual([tarde.proximo, tarde.estado, tarde.diasAtraso], ['2026-12-05', 'atrasado', 5]);

  // Cortada desde diciembre: no se espera nada y no está atrasada. Desde el punto 10 (revisión del 6/11/2026) el corte guardado
  // corta su tramo ESE día, así que el renglón dice «cortado», como Subscriptions (antes, «al día» hasta que pasaba la gracia).
  const cortada = cliente('2026-12-10', conHistoria('2026-12-10', [{ tipo: 'corte', desde: '2026-12-01' }]));
  assert.deepEqual([cortada.proximo, cortada.estado, cortada.diasAtraso], [null, 'cortado', null], 'cortada: ningún pago esperado');
});

// =============================================================================
// 12-14 · La revisión del Cerebro del 6/11/2026 (docs/admin/revision-cerebro-6-11.md), puntos 6, 9 y 10
// =============================================================================
// 12 (punto 9): pasada la gracia, el tramo de una suscripción a mano se da por cortado, pero su historia sigue diciendo que
//    debe, y el moroso salía de «Por cobrar» a los 15 días sin que nadie cobrara. Ahora la historia manda, con un tope de
//    `ATRASO_MAXIMO_DIAS` (60): a los 20 días sigue, a los 70 sale. El MRR sigue con la gracia.
// 13 (punto 10): una suscripción con su historia vale su MENSUALIDAD en el MRR (quien pagó 100 de 238 vale 238, lo mismo que su
//    tabla), su corte guardado la saca ESE día (no después de la gracia), y sus dos claves (con y sin su CRM) no la duplican. Un
//    lead con una mensualidad registrada sin `venta_tipo` de suscripción también es una suscripción (`esLeadDeSuscripcion`).
// 14 (punto 6): el día de un pago es el de la zona de la plataforma, no el de UTC.
// Probado rompiéndolo el 6/11/2026 (base, con 12-14 puestos: 13/0). Cada rotura, sola:
//   · `porCobrarDe` vuelve a descartar el tramo cortado ANTES de mirar la historia (`t.fin` primero) → 12/1 (12)
//   · `ATRASO_MAXIMO_DIAS = 1000` (sin tope)                                                         → 12/1 (12)
//   · `calcularIngresos` sin `conMensualidad` (el MRR de lo pagado)                                  → 11/2 (11 y 13)
//   · `conMensualidad` sin juntar los tramos de las dos claves                                       → 12/1 (13)
//   · `conMensualidad` sin el corte guardado                                                         → 11/2 (11 y 13)
//   · `esLeadDeSuscripcion` mira sólo `venta_tipo`                                                   → 12/1 (13)
//   · `diaEnLaZona` con el día en UTC (`iso.slice(0, 10)`)                                           → 12/1 (14)
test('12 · Por cobrar: a los 20 días de atraso el moroso sigue (aunque su tramo esté cortado); a los 70, sale', () => {
  let id = 900;
  const mensualidad = (fecha: string, usd: number): PagoDeSuscripcion =>
    ({ id: ++id, monto_usd: usd, pagado: true, fecha_esperada: null, fecha_pago: fecha, es_mensualidad: true, nacio_cobrada: true });
  const pagosLead = [mensualidad('2026-08-05', 100), mensualidad('2026-09-05', 100), mensualidad('2026-10-05', 100)];
  const sub = 'lead:920:casa';
  const pagos: PagoIngreso[] = pagosLead.map((q) => ({ id: `p:${q.id}`, cliente: 'ws:79', suscripcion: sub, fecha: q.fecha_pago as string, usd: Number(q.monto_usd), medio: 'transferencia', concepto: null }));
  const quienes = new Map<string, ClienteIngreso>([['ws:79', { clave: 'ws:79', nombre: 'Taller Sur', ws: 79, leadId: 920 }]]);
  const conHistoria = (hoy: string) =>
    new Map([[sub, proximoDeHistoria(historiaDeSuscripcion({ inicio: '2026-08-05', montoUsd: 100, plazoMeses: null, movimientos: [], pagos: pagosLead, hoy }), hoy)]]);

  // A los 20 días del vencimiento (el 5/11): la gracia (15) ya pasó y el tramo está cortado.
  const hoy20 = '2026-11-25';
  assert.equal(diasEntre('2026-11-05', hoy20), 20);
  assert.notEqual(tramosDe(periodosDe(pagos, hoy20), hoy20)[0].fin, null, 'pasada la gracia, el tramo está cortado');
  const r20 = calcularIngresos(pagos, quienes, hoy20, 12, conHistoria(hoy20));
  assert.deepEqual(r20.porCobrar.map((p) => [p.fecha, p.usd, p.atrasado]), [['2026-11-05', 100, true], ['2026-12-05', 100, false]], 'sigue en Por cobrar, con lo que debe');
  assert.equal(r20.mrr, 0, 'el MRR sigue con la gracia');
  assert.deepEqual(calcularIngresos(pagos, quienes, hoy20).porCobrar, [], 'sin la historia, la regla de los tramos: cortado, fuera');

  // A los 70 días: pasó el tope y sale (sigue «Atrasada» en Subscriptions y en At Risk).
  const hoy70 = '2027-01-14';
  assert.equal(diasEntre('2026-11-05', hoy70), 70);
  assert.ok(70 > ATRASO_MAXIMO_DIAS && 20 <= ATRASO_MAXIMO_DIAS, 'el tope está entre los dos casos');
  assert.deepEqual(calcularIngresos(pagos, quienes, hoy70, 12, conHistoria(hoy70)).porCobrar, [], 'a los 70 días sale de Por cobrar');
});

test('13 · el MRR de una suscripción con su historia es su mensualidad, su corte guardado la saca ese día y sus dos claves cuentan una vez', () => {
  let id = 950;
  const mensualidad = (fecha: string, usd: number): PagoDeSuscripcion =>
    ({ id: ++id, monto_usd: usd, pagado: true, fecha_esperada: null, fecha_pago: fecha, es_mensualidad: true, nacio_cobrada: true });
  // Paga 238 por mes; en noviembre pagó sólo 100.
  const pagosLead = [mensualidad('2026-10-01', 238), mensualidad('2026-11-01', 100)];
  const sub = 'lead:930:casa';
  const pagos: PagoIngreso[] = pagosLead.map((q) => ({ id: `p:${q.id}`, cliente: 'ws:80', suscripcion: sub, fecha: q.fecha_pago as string, usd: Number(q.monto_usd), medio: 'transferencia', concepto: null }));
  const quienes = new Map<string, ClienteIngreso>([['ws:80', { clave: 'ws:80', nombre: 'Estudio Este', ws: 80, leadId: 930 }]]);
  const historia = (hoy: string, movimientos: MovimientoSuscripcion[] = []) =>
    historiaDeSuscripcion({ inicio: '2026-10-01', montoUsd: 238, plazoMeses: null, movimientos, pagos: pagosLead, hoy });

  const hoy = '2026-11-06';
  assert.equal(calcularIngresos(pagos, quienes, hoy).mrr, 100, 'sin la historia, lo pagado (la regla de antes)');
  const con = calcularIngresos(pagos, quienes, hoy, 12, new Map([[sub, proximoDeHistoria(historia(hoy), hoy)]]));
  assert.equal(con.mrr, 238, 'pagó 100 de 238: vale 238, lo mismo que su tabla');
  assert.equal(con.clientes[0].mrr, 238, 'el renglón del cliente (la caja de la ficha) dice lo mismo');
  assert.equal(con.meses.find((m) => m.mes === '2026-11')!.mrr, 238, 'y el cierre del mes');
  for (let i = 1; i < con.meses.length; i++) {
    const [a, b] = [con.meses[i - 1], con.meses[i]];
    assert.equal(b.mrr, Math.round((a.mrr + b.nuevo + b.vuelve + b.sube - b.baja - b.corte) * 100) / 100, `${b.mes}: la identidad sigue cerrando`);
  }

  // El corte guardado desde diciembre la saca el 1/12, aunque adentro de la gracia el tramo siga vivo.
  const hoy2 = '2026-12-02';
  assert.equal(calcularIngresos(pagos, quienes, hoy2, 12, new Map([[sub, proximoDeHistoria(historia(hoy2), hoy2)]])).mrr, 238, 'sin corte, adentro de la gracia sigue');
  const cortada = calcularIngresos(pagos, quienes, hoy2, 12, new Map([[sub, proximoDeHistoria(historia(hoy2, [{ tipo: 'corte', desde: '2026-12-01' }]), hoy2)]]));
  assert.equal(cortada.mrr, 0, 'con el corte guardado, el día del corte ya no cuenta');
  assert.deepEqual(cortada.movimientos.filter((m) => m.tipo === 'corte').map((m) => [m.fecha, m.despues]), [['2026-12-01', 0]], 'el corte, el 1/12');

  // Dos claves de la misma suscripción (un pago con su CRM y otro sin) son UNA historia: 238, no 476.
  const conCrm = pagos.map((p, i) => (i === 1 ? { ...p, suscripcion: 'lead:930:31' } : p));
  const p1 = proximoDeHistoria(historia(hoy), hoy);
  assert.equal(calcularIngresos(conCrm, quienes, hoy, 12, new Map([[sub, p1], ['lead:930:31', p1]])).mrr, 238, 'una vez');

  // Un lead con una mensualidad registrada es una suscripción aunque su `venta_tipo` no lo diga (entra en Subscriptions).
  const conMensualidad = new Set([930]);
  assert.equal(esLeadDeSuscripcion({ id: 930, venta_tipo: null }, conMensualidad), true, 'con una mensualidad registrada');
  assert.equal(esLeadDeSuscripcion({ id: 931, venta_tipo: 'unico' }, conMensualidad), false, 'un pago único sin mensualidad, no');
  assert.equal(esLeadDeSuscripcion({ id: 932, venta_tipo: 'suscripcion' }, conMensualidad), true, 'el de siempre');
});

test('14 · el día de un pago es el de la zona de la plataforma: el 31/10 a las 22:00 de Argentina es el 31/10', () => {
  assert.equal(diaEnLaZona('2026-11-01T01:00:00Z', 'America/Argentina/Buenos_Aires'), '2026-10-31', 'en Argentina, todavía octubre');
  assert.equal(diaEnLaZona('2026-11-01T01:00:00Z', null), '2026-11-01', 'sin zona, el día en UTC');
  assert.equal(diaEnLaZona('2026-11-01T01:00:00Z', 'Marte/Olimpo'), '2026-11-01', 'una zona que no existe no rompe: UTC');
});
