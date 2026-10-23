// =============================================================================
// «API» en el Uso: el crédito de API de cada plan Max 20x (22/10/2026): lo que, roto, no da error
// =============================================================================
// Martín: «En USO de SuperAdmin quiero ver también el USO de la API, que como tenemos 4 cuentas de Claude x20, deberían ser
// 800 usd al mes...». Lo que se fija:
//   1. qué crédito pagó cada fila de `anthropic_usage`: la marca del crédito con su número, o el negocio cuya clave ES la de
//      un crédito (el ws10 usa la de la cuenta 2 como su Claude, medido el 22/10/2026);
//   2. lo gastado por cuenta en su ciclo: sin lo de antes del ciclo, sin los vetos, con el «sin crédito» aparte;
//   3. NUNCA UN NÚMERO INVENTADO: sin el registro, null («No pude leer lo gastado») y el total sin dato;
//   4. el ciclo: sin el día de cobro, el mes calendario de Argentina; con él, de cobro a cobro (y los meses cortos);
//   5. lo que se dibuja: «US$X de US$800 este mes», cada cuenta, «Falta vincular» con lo que hay que hacer;
//   6. la sección se pide UNA vez al abrir (la acción llega nueva en cada refresco del Centro), y la acción pasa por la guarda.
//
// Probado ROMPIÉNDOLO (22/10/2026), contra la base en verde de este archivo (6 pases), una rotura por vez (el script restaura
// byte a byte y lo comprueba en un finally):
//   · `creditoQuePago` sin mirar el negocio (sólo la marca) → 3 fallos (1, 2 y 5: lo del ws10 no se sumaba);
//   · el número de la cuenta leído de la columna antes que del motivo → 2 fallos (1 y 2);
//   · `resumenCredito` sin filtrar por `desde` → 1 fallo (2); contando el «sin crédito» como llamada → 1 fallo (2);
//   · `gastos: null` leído como 0 → 2 fallos (3 y 5: «US$0» inventado);
//   · `cicloDelCredito` sin acotar el día al largo del mes → 1 fallo (4);
//   · el efecto de `SeccionCredito` con `[leer]` de dependencias → 1 fallo (6).
//   Restaurado: 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CUENTAS_DEL_CREDITO, cicloDelCredito, creditoQuePago, resumenCredito, totalCredito, vinculableDesde,
  type FilaGasto, type LecturaCredito,
} from '../lib/credito-api';
import { MOTIVO_CREDITO_PLATAFORMA, MOTIVO_CLAVE_DEL_NEGOCIO } from '../lib/veto-claude';
import { VistaCredito, usd } from '../app/admin/operaciones/UsoCredito';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const codigo = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// 22/10/2026 a las 11:47 de Argentina.
const AHORA = Date.parse('2026-10-22T14:47:52Z');
const WS10 = new Map([[10, 'claude2']]);
const fila = (p: Partial<FilaGasto>): FilaGasto => ({
  workspace_id: 21, created_at: '2026-10-18T22:25:00Z', motivo: `${MOTIVO_CREDITO_PLATAFORMA} (cuenta 1) · Armar el catálogo`,
  cuenta: 1, cost_usd: 0.1, provider: 'anthropic', model: 'claude-haiku-4-5', ...p,
});

test('1: qué crédito pagó cada fila: la marca con su número, o el negocio que usa la clave de un crédito como su Claude', () => {
  assert.deepEqual(creditoQuePago(fila({}), WS10), { cuenta: 'claude1', negocio: null });
  assert.deepEqual(creditoQuePago(fila({ motivo: `${MOTIVO_CREDITO_PLATAFORMA} (cuenta 2)`, cuenta: 1 }), WS10), { cuenta: 'claude2', negocio: null },
    'el número del motivo manda sobre la columna');
  assert.deepEqual(creditoQuePago(fila({ motivo: `${MOTIVO_CREDITO_PLATAFORMA} · sin número`, cuenta: 2 }), WS10), { cuenta: 'claude2', negocio: null });
  // El ws10: su ANTHROPIC_API_KEY es la del crédito de la cuenta 2.
  assert.deepEqual(creditoQuePago(fila({ workspace_id: 10, motivo: `${MOTIVO_CLAVE_DEL_NEGOCIO} · Analizar`, cuenta: 1 }), WS10), { cuenta: 'claude2', negocio: 10 });
  assert.deepEqual(creditoQuePago(fila({ workspace_id: 10, motivo: 'Analizar la llamada', cuenta: 1 }), WS10), { cuenta: 'claude2', negocio: 10 });
  assert.equal(creditoQuePago(fila({ workspace_id: 10, motivo: null, cuenta: 2 }), WS10), null, 'otra clave del negocio');
  assert.equal(creditoQuePago(fila({ workspace_id: 10, motivo: null, provider: 'gemini' }), WS10), null, 'no es Anthropic');
  assert.equal(creditoQuePago(fila({ workspace_id: 9, motivo: 'Chat del Ops Center' }), WS10), null, 'la clave de la plataforma no es un crédito');
  assert.equal(creditoQuePago(fila({ motivo: `${MOTIVO_CREDITO_PLATAFORMA} (cuenta 7)` }), WS10), null, 'un crédito que no existe');
});

test('2: lo gastado por cuenta en su ciclo, con la parte del negocio, sin vetos y con el «sin crédito» aparte', () => {
  const gastos = [
    fila({ cost_usd: 0.1341 }),
    fila({ cost_usd: '0.0382', created_at: '2026-10-21T19:00:00Z' }),
    fila({ cost_usd: 5, created_at: '2026-09-30T23:00:00Z' }), // 30/9 a las 20:00 de Argentina: el mes anterior
    fila({ workspace_id: 10, motivo: 'Analizar la llamada', cost_usd: 0.1 }),
    fila({ workspace_id: 10, motivo: 'Analizar', model: 'vetado:claude-sonnet-5', cost_usd: 0 }),
    fila({ motivo: `${MOTIVO_CREDITO_PLATAFORMA} (cuenta 2) · sin crédito hasta el próximo ciclo`, cost_usd: 0, created_at: '2026-10-20T10:00:00Z' }),
  ];
  const filas = resumenCredito({ vinculadas: { claude1: true, claude2: true, claude3: false, claude4: false }, gastos, wsConClave: WS10, ahora: AHORA });
  assert.deepEqual(filas.map((f) => f.cuenta), ['claude1', 'claude2', 'claude3', 'claude4']);
  const [uno, dos, tres] = filas;
  assert.equal(uno.gastadoUsd, 0.1723);
  assert.equal(uno.llamadas, 2);
  assert.equal(uno.desde, '2026-10-01T03:00:00.000Z', 'el mes de Argentina');
  assert.equal(uno.renueva, null, 'sin el día de cobro no se sabe: se dice');
  assert.equal(dos.gastadoUsd, 0.1);
  assert.equal(dos.llamadas, 1, 'el veto no llegó a Anthropic; el «sin crédito» tampoco es una llamada');
  assert.deepEqual(dos.delNegocio, [{ ws: 10, usd: 0.1 }]);
  assert.equal(dos.sinCreditoAt, '2026-10-20T10:00:00.000Z');
  assert.equal(tres.gastadoUsd, 0);
  assert.equal(tres.vinculada, false);
});

test('3: nunca un número inventado: sin registro, null; sin saber si está vinculada, null', () => {
  const filas = resumenCredito({ vinculadas: { claude1: true, claude2: null }, gastos: null, wsConClave: new Map(), ahora: AHORA });
  assert.equal(filas[0].gastadoUsd, null);
  assert.equal(filas[1].vinculada, null, 'no se pudo leer no es «falta vincular»');
  assert.deepEqual(totalCredito(filas), { gastadoUsd: null, vinculadas: 1, rindeUsd: 200, totalUsd: 800 });
  const ok = resumenCredito({ vinculadas: { claude1: true, claude2: true, claude3: false, claude4: false }, gastos: [fila({ cost_usd: 0.25 })], wsConClave: new Map(), ahora: AHORA });
  assert.deepEqual(totalCredito(ok), { gastadoUsd: 0.25, vinculadas: 2, rindeUsd: 400, totalUsd: 800 });
  // Con el registro leído pero la clave de una cuenta sin leer: el total tiene un hueco (lo de esa cuenta). Rotura: el total
  // sin mirar `vinculada == null` → 1 fallo.
  const hueco = resumenCredito({ vinculadas: { claude1: true, claude2: null, claude3: false, claude4: false }, gastos: [fila({ cost_usd: 0.25 })], wsConClave: new Map(), ahora: AHORA });
  assert.equal(totalCredito(hueco).gastadoUsd, null, 'una cuenta en «No pude leerlo»: el total no es un dato');
});

test('4: el ciclo, de cobro a cobro, a la medianoche de Argentina (y los meses cortos)', () => {
  const iso = (c: { desde: number; renueva: number | null }) => [new Date(c.desde).toISOString(), c.renueva == null ? null : new Date(c.renueva).toISOString()];
  assert.deepEqual(iso(cicloDelCredito(undefined, AHORA)), ['2026-10-01T03:00:00.000Z', null]);
  assert.deepEqual(iso(cicloDelCredito(16, AHORA)), ['2026-10-16T03:00:00.000Z', '2026-11-16T03:00:00.000Z']);
  assert.deepEqual(iso(cicloDelCredito(25, AHORA)), ['2026-09-25T03:00:00.000Z', '2026-10-25T03:00:00.000Z']);
  assert.deepEqual(iso(cicloDelCredito(31, Date.parse('2026-11-15T12:00:00Z'))), ['2026-10-31T03:00:00.000Z', '2026-11-30T03:00:00.000Z']);
  assert.deepEqual(iso(cicloDelCredito(5, Date.parse('2027-01-02T12:00:00Z'))), ['2026-12-05T03:00:00.000Z', '2027-01-05T03:00:00.000Z']);
  // A las 23:00 del 31/10 en Argentina todavía es octubre (en UTC ya es noviembre).
  assert.deepEqual(iso(cicloDelCredito(undefined, Date.parse('2026-11-01T02:00:00Z'))), ['2026-10-01T03:00:00.000Z', null]);
  // La cuenta 4, suscripta el 16/10: se puede vincular desde el 23/10.
  assert.equal(new Date(vinculableDesde('2026-10-16')!).toISOString(), '2026-10-23T03:00:00.000Z');
  assert.equal(CUENTAS_DEL_CREDITO.find((c) => c.cuenta === 'claude4')?.suscripta, '2026-10-16');
  const [, , , cuatro] = resumenCredito({ vinculadas: {}, gastos: [], wsConClave: new Map(), ahora: AHORA });
  assert.equal(cuatro.vinculableDesde, '2026-10-23T03:00:00.000Z');
  const [, , , despues] = resumenCredito({ vinculadas: {}, gastos: [], wsConClave: new Map(), ahora: Date.parse('2026-10-24T12:00:00Z') });
  assert.equal(despues.vinculableDesde, null, 'pasados los 7 días ya se puede');
});

const plano = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const CUENTAS = [
  { cuenta: 'claude1', vistoAt: null, cuota: null, titular: { nombre: 'Mauricio Bustos', email: null, alias: null } },
  { cuenta: 'claude2', vistoAt: null, cuota: null, titular: { nombre: 'Leandro Tejado', email: null, alias: null } },
  { cuenta: 'claude3', vistoAt: null, cuota: null, titular: { nombre: 'Martin Koncke', email: null, alias: null } },
  { cuenta: 'claude4', vistoAt: null, cuota: null, titular: { nombre: 'Leandro Tejado 2', email: null, alias: null } },
];

test('5: lo que se dibuja: el total de los cuatro planes, cada cuenta, y lo que falta vincular', () => {
  const gastos = [fila({ cost_usd: 0.2528 }), fila({ workspace_id: 10, motivo: null, cost_usd: 0.1 })];
  const filas = resumenCredito({ vinculadas: { claude1: true, claude2: true, claude3: false, claude4: false }, gastos, wsConClave: WS10, ahora: AHORA });
  const lectura: LecturaCredito = { ok: true, filas, total: totalCredito(filas), negociosSinLeer: false };
  const t = plano(renderToStaticMarkup(createElement(VistaCredito, { lectura, cuentas: CUENTAS })));
  assert.match(t, /^API US\$0,35 de US\$800 este mes 2 de 4 vinculadas: hoy rinden US\$400 /);
  assert.match(t, /Mauricio Bustos US\$0,25 de US\$200 Quedan US\$199,75 · se renueva con el cobro del plan/);
  assert.match(t, /Leandro Tejado US\$0,10 de US\$200 Quedan US\$199,90 · se renueva con el cobro del plan Incluye US\$0,10 del negocio 10, que la usa como su Claude/);
  assert.match(t, /Martin Koncke Falta vincular claude\.ai → Configuración → Facturación → Créditos de API, y su clave a MaKo/);
  assert.match(t, /Leandro Tejado 2 Falta vincular Se puede desde el 23\/10 \(7 días después de suscribirse\)/);
  assert.match(t, /El saldo real, en platform\.claude\.com → Billing/);
  // Sin el registro: ningún «US$0» inventado.
  const sin = resumenCredito({ vinculadas: { claude1: true, claude2: true, claude3: false, claude4: false }, gastos: null, wsConClave: WS10, ahora: AHORA });
  const ts = plano(renderToStaticMarkup(createElement(VistaCredito, { lectura: { ok: true, filas: sin, total: totalCredito(sin), negociosSinLeer: true }, cuentas: CUENTAS })));
  assert.match(ts, /^API Sin dato de lo gastado /);
  assert.match(ts, /Mauricio Bustos No pude leer lo gastado/);
  assert.doesNotMatch(ts, /US\$0 |Quedan/);
  assert.match(ts, /No pude leer las claves de los negocios/);
  // Leyendo y con error: lo dice, sin número.
  assert.equal(plano(renderToStaticMarkup(createElement(VistaCredito, { lectura: null, cuentas: CUENTAS }))), 'API Leyendo el crédito…');
  assert.equal(plano(renderToStaticMarkup(createElement(VistaCredito, { lectura: { ok: false, error: 'Entra con tu segundo factor para usar el Centro.' }, cuentas: CUENTAS }))),
    'API Entra con tu segundo factor para usar el Centro.');
  assert.equal(usd(0.004), 'menos de US$0,01');
  assert.equal(usd(800), 'US$800');
  assert.equal(usd(199.7472), 'US$199,75');
});

test('6: la sección se pide UNA vez al abrir, con la acción guardada, en la computadora y en el teléfono', () => {
  const seccion = codigo('app/admin/operaciones/UsoCredito.tsx');
  assert.match(seccion, /useEffect\(\(\) => \{[\s\S]*?leerRef\.current\(\)[\s\S]*?\}, \[\]\);/, 'con `[leer]` pediría la lectura en cada refresco del Centro');
  assert.doesNotMatch(seccion, /from '\.\/acciones'|^import (?!type )[^;]*from '@\/lib\/credito-api(-db)?'/m, 'la pantalla no importa el servidor (de lib/credito-api, sólo tipos)');
  assert.match(codigo('app/admin/operaciones/PiezasCentro.tsx'), /<BotonUso [^>]*onLeerCredito=\{k\.leerCreditoApi\}/);
  assert.match(codigo('app/m/operaciones/CentroAppMovil.tsx'), /onLeerCredito=\{k\.leerCreditoApi\}/);
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /const leerCreditoApi = async \(\): Promise<LecturaCredito> =>\s*\(await leerCentro<LecturaCredito>\('credito'\)/);
  // La acción pasa por la guarda (la lista de tests/operaciones.test.ts la incluye) y devuelve sólo números.
  const lector = codigo('lib/credito-api-db.ts');
  assert.match(lector, /return \{ ok: true, filas, total: totalCredito\(filas\), negociosSinLeer, asignados \};/, 'con los negocios con crédito asignado (el ws1)');
  assert.doesNotMatch(lector, /\.(insert|update|upsert|delete)\(/, 'sólo lee');
});
