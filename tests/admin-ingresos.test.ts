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
//   7. el lector: qué pago cuenta como recurrente (`esRecurrente`), y que la pantalla y la API se queden con el super admin.
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
//   · app/admin/page.tsx lee los ingresos antes de `getSesionAdmin`                           → 1 fallo (7)
//   · `destinoDeCustomers` sin `?tab=` manda a Revenue (no a Customers)                       → 1 fallo (8)
//   · `destinoDeCustomers` deja pasar un `?cuenta=` que no es un número                       → 1 fallo (8)
//   · `filasDeSaldos` saca «Al empezar» del cierre del mes anterior                           → 1 fallo (8)
//   · `mesesVisibles` dibuja los doce meses aunque los primeros estén vacíos                  → 1 fallo (8)
//   · la pantalla dibuja el MRR del mes pasado en vez del de hoy (`usd(vista.mrrMesPasado)`)  → 1 fallo (9)
//   · sin pagos, la pantalla dibuja las tarjetas en «US$ 0»                                  → 1 fallo (9)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularIngresos, periodosDe, tramosDe, TIPOS_MOVIMIENTO, type ClienteIngreso, type PagoIngreso,
} from '../lib/admin-ingresos-reglas';
import { filasDeSaldos, mesesVisibles } from '../app/admin/ingresos/ingresos-vista';
import { destinoDeCustomers, PESTANAS_ADMIN, rutaPestanaAdmin } from '../app/admin/pestanas-reglas';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { IngresosAdmin } from '../app/admin/ingresos/IngresosAdmin';

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

  const page = sinComentarios(leer('app/admin/page.tsx'));
  const puerta = page.indexOf('await getSesionAdmin()');
  assert.ok(puerta > 0, 'la página pregunta por el super admin');
  const lectura = page.indexOf('vistaDeIngresos(');
  assert.ok(lectura > 0 && puerta < lectura, 'la puerta va ANTES de leer los ingresos');
});

test('8 · /customers llega a la MISMA pestaña de Admin, y la tabla de saldos cierra exacta desde el primer mes', () => {
  assert.equal(PESTANAS_ADMIN[0], 'revenue', 'Revenue primero: es lo que Martín pide hoy');
  assert.equal(rutaPestanaAdmin('revenue'), '/admin');
  assert.equal(destinoDeCustomers({}), '/admin?tab=customers', 'sin tab, /customers abría la lista de los negocios');
  assert.equal(destinoDeCustomers({ tab: 'accounts', cuenta: '12' }), '/admin?tab=accounts&cuenta=12');
  assert.equal(destinoDeCustomers({ tab: 'billing' }), '/admin?tab=billing');
  assert.equal(destinoDeCustomers({ tab: 'customers', cliente: '7' }), '/admin?tab=customers&cliente=7');
  assert.equal(destinoDeCustomers({ tab: 'nada', cuenta: '1;drop' }), '/admin?tab=customers', 'un id que no es un número se cae');

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

test('9 · la pantalla DIBUJA el caso real: el MRR de hoy, lo que pagó cada uno y el medio; sin pagos, qué hacer', () => {
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  const texto = (v: Parameters<typeof IngresosAdmin>[0]['vista']) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(IngresosAdmin, { vista: v })))
    .replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
  const quienes = new Map<string, ClienteIngreso>([
    ['leila', { clave: 'leila', nombre: 'Negocio L', ws: 11, leadId: 1 }],
    ['codigo', { clave: 'codigo', nombre: 'Negocio C', ws: 13, leadId: 2 }],
    ['flor', { clave: 'flor', nombre: 'Negocio F', ws: null, leadId: 3 }],
  ]);
  const t = texto({ ...calcularIngresos([...OCTUBRE, ...NOVIEMBRE_CODIGO], quienes, '2026-11-05'), avisos: [] });
  assert.match(t, /Ingreso mensual \(MRR\) US\$ 432/, 'el MRR de hoy, grande');
  assert.match(t, /desde US\$ 340 en oct/, 'con su «desde»');
  assert.match(t, /Cobrado desde siempre US\$ 578/);
  assert.match(t, /Negocio C .*US\$ 238 US\$ 384/, 'lo que paga por mes y lo que pagó en total');
  assert.match(t, /Subió Negocio C/, 'el movimiento de noviembre');
  assert.match(t, /\+US\$ 92/);
  assert.match(t, /Binance/, 'el medio real del pago');
  assert.match(t, /sin cuenta en MaKo/, 'un cliente sin cuenta se dice');
  const vacio = texto({ ...calcularIngresos([], new Map(), '2026-11-05'), avisos: [] });
  assert.match(vacio, /Todavía no entró ningún pago/);
  assert.doesNotMatch(vacio, /US\$ 0/, 'sin tarjetas en cero');
});

