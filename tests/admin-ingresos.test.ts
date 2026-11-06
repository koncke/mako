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
  calcularIngresos, periodosDe, porCobrarDe, proximoDeHistoria, tramosDe, TIPOS_MOVIMIENTO, type ClienteIngreso, type PagoIngreso,
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
