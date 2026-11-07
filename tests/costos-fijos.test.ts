// =============================================================================
// El gasto fijo: quién lo paga cambia el número, y una cifra vieja se tiene que ver (7/11/2026)
// =============================================================================
// Las dos cosas que esto cuida, y las dos son de las que se rompen en silencio:
//
// 1. QUIÉN PAGA. Hoy Mauricio paga su Claude, Vercel, Supabase y Railway, y las otras cuentas van
//    a mitad con Leandro. Sumar todo da US$1.123 y un equilibrio de 31 clientes; lo que de verdad
//    sale del bolsillo de Martín son US$438 y 10 clientes. Si alguien «simplifica» el reparto, la
//    pantalla pasa a contestar una pregunta que nadie hizo.
//
// 2. QUE UNA CIFRA VIEJA SE VEA VIEJA. Vercel y GitHub no se pueden leer por API, así que van
//    declarados. Un número declarado sin fecha envejece en silencio.
//
// Correr: node --import tsx --test tests/costos-fijos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTIDAS_FIJAS, DIAS_PARA_ENVEJECER,
  cuestaAMartin, cuestaSiPagaTodo, fijoDeMartin, fijoSiPagaTodo,
  diasSinConfirmar, partidasViejas, fijoPorCliente,
  type PartidaFija,
} from '../lib/costos-fijos';

const uno = (p: Partial<PartidaFija> = {}): PartidaFija => ({
  id: 'x', nombre: 'X', usdPorMes: 100, quienPaga: 'martin', parteDeMartin: 1,
  comoSeSabe: 'declarado', confirmado: '2026-11-07', ...p,
});

test('lo que paga Mauricio NO entra en el fijo de Martín, pero sí en el de «si paga todo»', () => {
  const p = uno({ usdPorMes: 60, quienPaga: 'mauricio' });
  assert.equal(cuestaAMartin(p), 0, 'lo que paga otro no sale del bolsillo de Martín');
  assert.equal(cuestaSiPagaTodo(p), 60, 'pero el día que lo pague, cuesta los 60 enteros');
});

test('lo compartido se cuenta por la parte que le toca, no entero ni cero', () => {
  const p = uno({ usdPorMes: 800, quienPaga: 'compartido', parteDeMartin: 0.5 });
  assert.equal(cuestaAMartin(p), 400);
  assert.equal(cuestaSiPagaTodo(p), 800);
});

test('los dos totales de HOY, sobre las partidas reales', () => {
  const hoy = fijoDeMartin();
  const todo = fijoSiPagaTodo();
  // Lo que sale del bolsillo de Martín: 4 Claude a mitad (400) + Actions (30) + App Store (8,25).
  assert.ok(Math.abs(hoy - 438.25) < 0.01, `el fijo de Martín dio US$${hoy.toFixed(2)}`);
  // Y el total, con lo de Mauricio adentro.
  assert.ok(Math.abs(todo - 1144.25) < 0.01, `el fijo total dio US$${todo.toFixed(2)}`);
  assert.ok(todo > hoy, 'pagarlo todo no puede salir menos que pagar una parte');
});

test('el reparto cambia el punto de equilibrio, que es para lo que existe esta distinción', () => {
  // Growth deja ~US$63 por cliente (precio − cobrar − IA − CAC/vida). El equilibrio es fijo/margen.
  const DEJA = 63.25;
  const hoy = Math.ceil(fijoDeMartin() / DEJA);
  const todo = Math.ceil(fijoSiPagaTodo() / DEJA);
  assert.equal(hoy, 7, `con lo que paga hoy hacen falta ${hoy} clientes`);
  assert.ok(todo >= hoy + 5, `pagar todo tiene que mover el equilibrio de verdad (${hoy} → ${todo})`);
});

test('una cifra vieja se detecta, y una de hoy no', () => {
  const vieja = uno({ confirmado: '2026-06-01' });
  const nueva = uno({ confirmado: '2026-11-01' });
  assert.equal(diasSinConfirmar(nueva, '2026-11-07'), 6);
  assert.ok(diasSinConfirmar(vieja, '2026-11-07') >= DIAS_PARA_ENVEJECER);
  const viejas = partidasViejas('2026-11-07', [nueva, vieja]);
  assert.deepEqual(viejas.map((p) => p.confirmado), ['2026-06-01'], 'sólo la vieja, y nada más');
});

test('las viejas salen de la más vieja a la menos vieja', () => {
  const a = uno({ id: 'a', confirmado: '2026-01-01' });
  const b = uno({ id: 'b', confirmado: '2026-05-01' });
  assert.deepEqual(partidasViejas('2026-11-07', [b, a]).map((p) => p.id), ['a', 'b']);
});

test('una fecha rota no rompe la pantalla: cuenta 0 días, no NaN', () => {
  assert.equal(diasSinConfirmar(uno({ confirmado: 'ayer' }), '2026-11-07'), 0);
  assert.equal(diasSinConfirmar(uno(), 'cuando sea'), 0);
});

test('con CERO clientes el fijo por cliente es null, NUNCA 0', () => {
  // Un 0 diría «no cuesta nada», que es lo contrario de la verdad. Es la misma trampa que el
  // «0 min» de GitHub, que significa «no pude leer».
  assert.equal(fijoPorCliente(0, 438.25), null);
  assert.equal(fijoPorCliente(-3, 438.25), null);
  assert.equal(fijoPorCliente(Number.NaN, 438.25), null);
  assert.equal(fijoPorCliente(Number.POSITIVE_INFINITY, 438.25), null);
  assert.equal(fijoPorCliente(10, 1000), 100);
});

test('ninguna partida real quedó sin fecha ni con un reparto imposible', () => {
  assert.ok(PARTIDAS_FIJAS.length > 0);
  for (const p of PARTIDAS_FIJAS) {
    assert.match(p.confirmado, /^\d{4}-\d{2}-\d{2}$/, `«${p.nombre}» sin fecha de confirmación`);
    assert.ok(p.usdPorMes >= 0, `«${p.nombre}» con un costo negativo`);
    assert.ok(p.parteDeMartin > 0 && p.parteDeMartin <= 1, `«${p.nombre}» con una parte fuera de 0-1`);
    if (p.quienPaga === 'compartido') assert.ok(p.parteDeMartin < 1, `«${p.nombre}» es compartida pero Martín paga todo`);
  }
});

test('lo que NO se puede leer por API está marcado como tal', () => {
  // Vercel (403) y GitHub (el token no ve facturación) NO pueden decir «api»: si alguien los
  // marcara así, la pantalla mostraría como consultado algo que nadie consultó.
  for (const id of ['vercel', 'github']) {
    const p = PARTIDAS_FIJAS.find((x) => x.id === id);
    assert.ok(p, `falta la partida «${id}»`);
    assert.notEqual(p.comoSeSabe, 'api', `«${p.nombre}» dice que se lee por API, y no se puede`);
  }
  // Supabase sí se consultó hoy: su plan salió de la API.
  assert.equal(PARTIDAS_FIJAS.find((x) => x.id === 'supabase')?.comoSeSabe, 'api');
});
