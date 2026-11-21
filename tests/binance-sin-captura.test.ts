// =============================================================================
// El pago de una agencia que entró por Binance SIN captura en el grupo — la vuelta del cron (lib/binance-sin-captura-reglas.ts)
// =============================================================================
// Martín (20/11/2026): «si ya pagan por Binance debería ser todo automático». La vuelta lee los pagos recibidos de las últimas horas y
// los calza contra lo que debe cada agencia: quién paga (alguien que ya le pagó a MaKo por ella), monto exacto, ventana y orden sin usar.
// Acá corre la vuelta REAL (`vueltaSinCaptura`) contra un mundo de mentira: el libro de la agencia con su compare-and-set de la orden
// (como `aplicarPagoDeAgencia`), la cuenta de Binance, el grupo y Martín. Nombres e ids inventados; los números tienen la forma real.
// Correr: node --import tsx --test tests/binance-sin-captura.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirSinCaptura, GRACIA_MIN, vueltaSinCaptura, VENTANA_HORAS, type AgenciaVista, type DepsSinCaptura, type Pagadores } from '../lib/binance-sin-captura-reglas';
import { asignarPago, clavePendiente, textoDeComprobante, type Pendiente } from '../lib/agencia-mes-reglas';
import type { MovimientoBinance } from '../lib/binance-pay-reglas';

const H = 3_600_000;
const AHORA = Date.parse('2026-11-20T22:00:00Z');
const AG = 13;
const OTRA = 21;

const mes = (m: string, usdDebe: number): Pendiente => ({ tipo: 'mes', mes: m, totalUsd: usdDebe, pagadoUsd: 0, debeUsd: usdDebe, limite: `${m}-05` });
const mov = (orderId: string, monto: number, o: { at?: number; id?: string | null; nombre?: string | null; moneda?: string } = {}): MovimientoBinance => ({
  orderId, monto, at: o.at ?? AHORA - 2 * H, moneda: o.moneda ?? 'USDT', pagadorNombre: o.nombre === undefined ? 'CODIGO_INMO' : o.nombre, pagadorId: o.id === undefined ? '300000013' : o.id,
});
/** El pago de octubre que entró CON captura: ya está en el libro de la agencia, y de ahí se aprende quién paga. */
const PAGO_DE_OCTUBRE = mov('463333000111222880', 97, { at: AHORA - 30 * 24 * H });

type Mundo = {
  movs: MovimientoBinance[];
  libros: Map<number, Set<string>>;
  recibos: Set<string>;
  pendientes: Map<number, Pendiente[]>;
  guardados: Map<number, Pagadores>;
  comprobantes: Map<number, AgenciaVista['comprobantesSinCerrar']>;
  avisados: Map<string, string>;
  grupo: Array<{ ws: number; texto: string }>;
  martin: string[];
  escrituras: number;
};

function mundo(p: Partial<Pick<Mundo, 'movs' | 'pendientes'>> = {}): Mundo {
  return {
    movs: p.movs ?? [PAGO_DE_OCTUBRE],
    libros: new Map([[AG, new Set([PAGO_DE_OCTUBRE.orderId])], [OTRA, new Set()]]),
    recibos: new Set(),
    pendientes: p.pendientes ?? new Map([[AG, [mes('2026-11', 97)]], [OTRA, [mes('2026-11', 47)]]]),
    guardados: new Map(),
    comprobantes: new Map(),
    avisados: new Map(),
    grupo: [],
    martin: [],
    escrituras: 0,
  };
}

/** Las lecturas y escrituras de la vuelta, contra el mundo. La orden se anota con compare-and-set, como en el libro de verdad. */
function deps(w: Mundo, o: { soloLectura?: boolean } = {}): DepsSinCaptura {
  const escribe = () => { if (o.soloLectura) throw new Error('¡escribió en seco!'); w.escrituras++; };
  return {
    leerCuenta: async (desde, hasta) => ({ ok: true, movs: w.movs.filter((m) => m.at >= desde && m.at <= hasta) }),
    ordenesAnotadas: async () => new Set([...[...w.libros.values()].flatMap((s) => [...s]), ...w.recibos]),
    agencias: async () => ({
      vistas: [...w.libros.keys()].map((ws): AgenciaVista => ({
        agenciaWs: ws, nombre: ws === AG ? 'Código Inmobiliario' : 'Otra agencia', pendientes: [...(w.pendientes.get(ws) ?? [])],
        ordenes: [...w.libros.get(ws)!], guardados: w.guardados.get(ws) ?? { ids: [], nombres: [] }, comprobantesSinCerrar: w.comprobantes.has(ws) ? w.comprobantes.get(ws)! : [],
      })),
      errores: 0,
    }),
    avisados: async () => new Set(w.avisados.keys()),
    guardarPagadores: async (ws, pg) => { escribe(); w.guardados.set(ws, pg); },
    aplicar: async ({ agenciaWs, mov: m }) => {
      escribe();
      // Como el servidor: PRIMERO si la orden ya se anotó (otra corrida la acaba de aplicar: eso no es «no cierra», es repetida), después
      // lo que se debe AHORA, y la orden una vez (el compare-and-set de `aplicarPagoDeAgencia`).
      if ([...w.libros.values()].some((s) => s.has(m.orderId))) return { tipo: 'repetido', que: 'la orden ya estaba anotada' };
      const ps = w.pendientes.get(agenciaWs) ?? [];
      const a = asignarPago(m.monto, ps);
      if (a.tipo !== 'cubre') return { tipo: 'revisar', porque: 'ya no cierra' };
      const libro = w.libros.get(agenciaWs)!;
      libro.add(m.orderId);
      w.pendientes.set(agenciaWs, ps.filter((p) => !a.claves.includes(clavePendiente(p))));
      w.grupo.push({ ws: agenciaWs, texto: textoDeComprobante({ tipo: 'cubre', montoUsd: m.monto, conceptos: a.claves, medio: 'Binance' }) });
      return { tipo: 'aplicado', que: a.claves.join(',') };
    },
    marcarAvisado: async (orderId, porque) => { escribe(); if (w.avisados.has(orderId)) return false; w.avisados.set(orderId, porque); return true; },
    avisarAMartin: async ({ mov: m, porque }) => { escribe(); w.martin.push(`${m.orderId}: ${porque}`); },
  };
}

test('un pago de Binance que CALZA con lo que debe la agencia se aplica UNA sola vez, aunque el cron corra dos veces', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466100000000000880', 97)] });
  const r1 = await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.equal(r1.aplicadas, 1);
  assert.ok(w.libros.get(AG)!.has('466100000000000880'));
  assert.equal(w.grupo.length, 1);
  assert.match(w.grupo[0].texto, /^Recibí tu pago de US\$ 97 por Binance\./);
  // La segunda corrida (media hora después): la orden ya está anotada, no se aplica otra vez ni se dice nada.
  const r2 = await vueltaSinCaptura(deps(w), { ahora: AHORA + H / 2 });
  assert.equal(r2.aplicadas, 0);
  assert.equal(r2.usados, 1);
  assert.equal(w.grupo.length, 1);
  assert.deepEqual(w.martin, []);
});

test('dos corridas A LA VEZ (las dos leen antes de que la otra anote): la orden se anota una vez y el grupo recibe UN mensaje', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466100000000000880', 97)] });
  const [a, b] = await Promise.all([vueltaSinCaptura(deps(w), { ahora: AHORA }), vueltaSinCaptura(deps(w), { ahora: AHORA })]);
  assert.equal(a.aplicadas + b.aplicadas, 1);
  assert.equal(w.grupo.length, 1);
  assert.deepEqual(w.martin, []);
});

test('uno que NO CALZA no hace nada: de alguien que nunca le pagó a MaKo, aunque el monto sea justo lo que se debe', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466200000000000880', 97, { id: '999999999', nombre: 'OTRA_PERSONA' })] });
  const r = await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.equal(r.aplicadas, 0);
  assert.equal(r.ajenos, 1);
  assert.equal(w.grupo.length, 0);
  assert.deepEqual(w.martin, []);
  assert.equal(w.libros.get(AG)!.size, 1);
});

test('uno de quien paga por la agencia con un monto que NO CIERRA no se aplica: va a Martín UNA vez (la próxima corrida no repite)', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466300000000000880', 50)] });
  await vueltaSinCaptura(deps(w), { ahora: AHORA });
  await vueltaSinCaptura(deps(w), { ahora: AHORA + H / 2 });
  assert.equal(w.grupo.length, 0);
  assert.equal(w.libros.get(AG)!.size, 1);
  assert.equal(w.martin.length, 1);
  assert.match(w.martin[0], /no cierra/);
  // Y con dos corridas A LA VEZ (las dos leen «no avisado» antes de que la otra anote): el aviso sale una vez (compare-and-set).
  const w2 = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466300000000000880', 50)] });
  await Promise.all([vueltaSinCaptura(deps(w2), { ahora: AHORA }), vueltaSinCaptura(deps(w2), { ahora: AHORA })]);
  assert.equal(w2.martin.length, 1);
});

test('uno YA USADO por una captura no vuelve a aplicarse: en el libro, en un recibo, o anotado con un dígito de más', async () => {
  for (const anotar of [
    (w: Mundo) => w.libros.get(AG)!.add('466400000000000880'),
    (w: Mundo) => w.recibos.add('466400000000000880'),
    // El caso del 16/11: la captura se leyó con un 0 de más y así quedó anotada.
    (w: Mundo) => w.libros.get(AG)!.add('4664000000000000880'),
  ]) {
    const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466400000000000880', 97)] });
    anotar(w);
    const r = await vueltaSinCaptura(deps(w), { ahora: AHORA });
    assert.equal(r.aplicadas, 0);
    assert.equal(r.usados, 1);
    assert.equal(w.grupo.length, 0);
    assert.deepEqual(w.martin, []);
  }
});

test('DOS candidatos no se activan solos: quien pagó le pagó antes por dos agencias, o dos pagos de la agencia para lo mismo', async () => {
  // El mismo Binance ID en los libros de las dos agencias.
  const w1 = mundo({ movs: [PAGO_DE_OCTUBRE, mov('463333000111222990', 47, { at: AHORA - 20 * 24 * H }), mov('466500000000000880', 97)] });
  w1.libros.get(OTRA)!.add('463333000111222990');
  await vueltaSinCaptura(deps(w1), { ahora: AHORA });
  assert.equal(w1.grupo.length, 0);
  assert.equal(w1.martin.length, 1);
  assert.match(w1.martin[0], /más de una agencia/);
  // Dos pagos de 97 con un solo mes de 97.
  const w2 = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466600000000000880', 97), mov('466600000000000990', 97, { at: AHORA - 3 * H })] });
  await vueltaSinCaptura(deps(w2), { ahora: AHORA });
  assert.equal(w2.grupo.length, 0);
  assert.equal(w2.martin.length, 2);
  // Dos pagos de la misma agencia para cosas DISTINTAS sí: cada uno cubre lo suyo.
  const w3 = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466700000000000880', 97), mov('466700000000000990', 29.77, { at: AHORA - 3 * H })], pendientes: new Map([[AG, [mes('2026-11', 97), mes('2026-12', 29.77)]], [OTRA, []]]) });
  const r3 = await vueltaSinCaptura(deps(w3), { ahora: AHORA });
  assert.equal(r3.aplicadas, 2);
  assert.deepEqual(w3.martin, []);
});

test('lo que todavía espera: un pago de hace menos de GRACIA_MIN, o el pago del que habla un comprobante del grupo sin cerrar', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466800000000000880', 97, { at: AHORA - (GRACIA_MIN - 5) * 60_000 })] });
  let r = await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.equal(r.esperando, 1);
  assert.equal(w.grupo.length, 0);
  // Pasada la gracia, se aplica.
  r = await vueltaSinCaptura(deps(w), { ahora: AHORA + GRACIA_MIN * 60_000 });
  assert.equal(r.aplicadas, 1);
  // Un comprobante sin cerrar con ESE número (leído con un dígito de más), con ESE monto, o sin poder leerlos: no se toca.
  for (const cs of [[{ operacion: '4669000000000000880', monto: null }], [{ operacion: null, monto: 97 }], null]) {
    const w2 = mundo({ movs: [PAGO_DE_OCTUBRE, mov('466900000000000880', 97)] });
    w2.comprobantes.set(AG, cs);
    r = await vueltaSinCaptura(deps(w2), { ahora: AHORA });
    assert.equal(r.esperando, 1);
    assert.equal(w2.grupo.length, 0);
    assert.deepEqual(w2.martin, []);
  }
});

test('un comprobante sin cerrar de OTRO pago no frena éste (el caso de Código el 20/11: uno de US$ 23,5 sin número, y los que Martín cerró a mano)', async () => {
  // Como en producción: el de hoy, sin número; y uno que Martín cerró a mano (su orden ya está en el libro, pero `aplicado_a` quedó vacío,
  // y anotada con un dígito de más). Ninguno es de ESTE pago de 97: se aplica.
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('467000000000000770', 97)] });
  w.comprobantes.set(AG, [{ operacion: null, monto: 23.5 }, { operacion: `${PAGO_DE_OCTUBRE.orderId.slice(0, 5)}0${PAGO_DE_OCTUBRE.orderId.slice(5)}`, monto: 97 }]);
  const r = await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.equal(r.aplicadas, 1);
  assert.equal(w.grupo.length, 1);
});

test('fuera de la ventana no se mira; y BTC de quien paga por la agencia va a Martín (no se convierte solo)', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('467000000000000880', 97, { at: AHORA - (VENTANA_HORAS + 1) * H }), mov('467000000000000990', 0.001, { moneda: 'BTC' })] });
  const r = await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.equal(r.aplicadas, 0);
  assert.equal(r.enVentana, 1);
  assert.equal(w.martin.length, 1);
  assert.match(w.martin[0], /BTC/);
});

test('APRENDE quién paga del libro y lo guarda; sin Binance ID, calza por el nombre aprendido', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE] });
  await vueltaSinCaptura(deps(w), { ahora: AHORA });
  assert.deepEqual(w.guardados.get(AG), { ids: ['300000013'], nombres: ['codigo_inmo'] });
  // Lo guardado alcanza aunque la orden vieja ya no esté en la historia que devuelve Binance.
  const w2 = mundo({ movs: [mov('467100000000000880', 97, { id: null, nombre: 'Codigo_Inmo' })] });
  w2.guardados.set(AG, { ids: ['300000013'], nombres: ['codigo_inmo'] });
  const r = await vueltaSinCaptura(deps(w2), { ahora: AHORA });
  assert.equal(r.aplicadas, 1);
});

test('EN SECO no escribe nada: dice qué haría con cada pago', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('467200000000000880', 97), mov('467200000000000990', 50, { at: AHORA - 4 * H })] });
  const r = await vueltaSinCaptura(deps(w, { soloLectura: true }), { ahora: AHORA, enSeco: true, desde: AHORA - 40 * 24 * H });
  assert.equal(r.error, undefined);
  assert.equal(w.escrituras, 0);
  assert.equal(r.usados, 1);
  assert.equal(r.aplicadas, 1);
  assert.equal(r.aMartin, 1);
  assert.deepEqual(r.filas.map((f) => f.estado), ['usado', 'a-martin', 'aplicar']);
});

test('sin la cuenta o sin el registro de «usado», no se aplica nada', async () => {
  const w = mundo({ movs: [PAGO_DE_OCTUBRE, mov('467300000000000880', 97)] });
  const d = deps(w);
  let r = await vueltaSinCaptura({ ...d, leerCuenta: async () => ({ ok: false, error: 'Binance contestó 500' }) }, { ahora: AHORA });
  assert.equal(r.aplicadas, 0);
  r = await vueltaSinCaptura({ ...d, ordenesAnotadas: async () => null }, { ahora: AHORA });
  assert.equal(r.aplicadas, 0);
  assert.equal(w.grupo.length, 0);
});

test('la decisión es pura: el mismo pago de alguien que pagó por la agencia SÓLO por el nombre, y otro con id conocido que gana', () => {
  const vista = (ws: number, g: Pagadores): AgenciaVista => ({ agenciaWs: ws, nombre: `ag${ws}`, pendientes: [mes('2026-11', 97)], ordenes: [], guardados: g, comprobantesSinCerrar: [] });
  const d = decidirSinCaptura({
    movs: [mov('467400000000000880', 97, { id: '111', nombre: 'Juan Perez' })], anotadas: [], ahora: AHORA, avisados: new Set(),
    agencias: [vista(1, { ids: ['111'], nombres: [] }), vista(2, { ids: [], nombres: ['juan perez'] })],
  });
  assert.equal(d.filas[0].estado, 'aplicar');
  assert.equal(d.filas[0].agenciaWs, 1);
});

test('el cron de cobros corre la vuelta DESPUÉS de los comprobantes en espera, y el servidor reusa el aplicar del camino con captura', () => {
  const cron = readFileSync(join(__dirname, '..', 'app', 'api', 'cron', 'cobros-reconciliar', 'route.ts'), 'utf8');
  const iEspera = cron.indexOf('await revisarPagosEnEspera(');
  const iSin = cron.indexOf('await revisarPagosSinCaptura(');
  assert.ok(iEspera > 0 && iSin > iEspera, 'la vuelta sin captura va después de la espera (la captura gana)');
  const srv = readFileSync(join(__dirname, '..', 'lib', 'binance-sin-captura.ts'), 'utf8');
  assert.match(srv, /aplicarPagoVerificado\(/);
  assert.match(srv, /pagosRecibidosEnBinance/);
  // Sin otra lógica de anotar: la orden la escribe sólo el camino de siempre.
  assert.doesNotMatch(srv, /cambiarSettingSi\(\s*KEY_ORDEN|\.orden\.\$\{/);
});
