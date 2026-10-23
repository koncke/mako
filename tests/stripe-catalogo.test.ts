// =============================================================================
// Los productos de Stripe en «Vincular cobro» (23/10/2026, llamada con Mauricio, Fathom 195591907, min 20-28)
// =============================================================================
// Mauricio conectó su Stripe y fue a «Vincular cobro» en Ganado: su producto de US$270 no aparecía, «Volver a leer» no
// traía nada, y el «Sprint 3 días» de MaKo decía «no tiene precio». Medido en el ws1: la clave andaba (secreta, de
// producción, cuenta de México con moneda por defecto MXN y el precio en USD); MaKo NUNCA leía el catálogo de Stripe.
// Lo que falla callado si se rompe:
//   1. LOS PRECIOS SE LEEN EN VIVO, de TODAS las cuentas de Stripe conectadas, cada una con su clave; la que no se puede
//      leer se dice con su nombre (no es «no tiene productos»).
//   2. TRAERLO NO DUPLICA: el producto de MaKo con el mismo nombre recibe el precio de Stripe.
//   3. EL MONTO SE VUELVE A LEER EN STRIPE con la clave de la cuenta elegida: del navegador viene sólo qué precio.
//   4. Lo que MaKo no puede cobrar tal cual (otra moneda, cada año) se muestra con el porqué, y no se trae.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 6 / 0, una rotura por vez y restaurada:
//   · se lee sólo la primera cuenta                                → 5 / 1
//   · la cuenta que no se lee se calla                             → 5 / 1
//   · otra moneda entra como dólares                               → 3 / 3
//   · una anual entra como mensual                                 → 4 / 2
//   · un producto archivado se muestra                             → 3 / 3
//   · el nombre sin sacar los acentos                              → 5 / 1
//   · traer siempre crea uno nuevo                                 → 5 / 1
//   · el precio se lee con la clave de la principal                → 4 / 2
//   · un id raro llega a Stripe                                    → 5 / 1
//   · el mismo precio se vuelve a escribir                         → 4 / 2
//   · varios con el mismo nombre: se adivina                       → 3 / 3
//   · la acción sin el corte de admin                              → 5 / 1
//
// Correr: node --import tsx --test tests/stripe-catalogo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { importacionDelPrecio, nombreComparable, precioDeStripe, productoDeMako } from '../lib/stripe-catalogo-reglas';
import type { ProductoCobro } from '../lib/cobro-etapa';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_stripe-catalogo-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const CUENTA = { id: 'stripe:principal', nombre: 'Stripe' };
const prod = (name: string, active = true) => ({ id: 'prod_x', name, active });
const mako = (id: number, nombre: string, montoUsd: number | null, tipo: 'unico' | 'suscripcion' = 'unico'): ProductoCobro =>
  ({ id, nombre, tipo, montoUsd, suscripcionMeses: null, cuotas: null, activo: true });

test('un precio de Stripe: lo que se puede traer, y el porqué de lo que no', () => {
  const p = precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 27000, type: 'one_time', product: prod('sprint 3 días') }, CUENTA);
  assert.deepEqual(p && { monto: p.monto, moneda: p.moneda, montoUsd: p.montoUsd, tipo: p.tipo, noSe: p.noSe }, { monto: 270, moneda: 'USD', montoUsd: 270, tipo: 'unico', noSe: null });
  const no = (c: Record<string, unknown>) => precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 1000, product: prod('X'), ...c }, CUENTA)?.noSe;
  assert.match(no({ currency: 'mxn' }) ?? '', /Está en MXN/, 'un precio en pesos entraba como dólares');
  assert.match(no({ recurring: { interval: 'year', interval_count: 1 } }) ?? '', /cada año/);
  assert.match(no({ recurring: { interval: 'month', interval_count: 3 } }) ?? '', /cada 3 meses/);
  assert.equal(no({ recurring: { interval: 'month', interval_count: 1 } }), null, 'una mensual se trae como suscripción');
  assert.match(no({ custom_unit_amount: { minimum: 100 }, unit_amount: null }) ?? '', /lo elige quien paga/);
  assert.match(no({ billing_scheme: 'tiered', unit_amount: null }) ?? '', /escalones/);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'jpy', unit_amount: 500, product: prod('Y') }, CUENTA)?.monto, 500, 'el yen no tiene centavos');
  // Lo que no se muestra: inactivo, producto archivado, sin nombre (sin expandir).
  assert.equal(precioDeStripe({ id: 'price_1', active: false, currency: 'usd', unit_amount: 1, product: prod('X') }, CUENTA), null);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 1, product: prod('X', false) }, CUENTA), null);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 1, product: 'prod_x' }, CUENTA), null);
});

test('el mismo nombre es el mismo producto: no se duplica, y entre varios no se adivina', () => {
  assert.equal(nombreComparable('  Sprint  3 DÍAS '), nombreComparable('sprint 3 dias'));
  const p = { nombre: 'sprint 3 días', montoUsd: 270, tipo: 'unico' as const };
  assert.deepEqual(productoDeMako(p, [mako(54, 'Sprint 3 días', null)]), { id: 54, ambiguo: false }, 'el de MaKo sin precio no se reconocía');
  assert.deepEqual(productoDeMako(p, [mako(1, 'Sprint 3 días', 100), mako(2, 'sprint 3 dias', 270)]), { id: 2, ambiguo: false }, 'el que ya cobra lo mismo');
  assert.deepEqual(productoDeMako(p, [mako(1, 'Sprint 3 días', 100), mako(2, 'Sprint 3 días', 200)]), { id: null, ambiguo: true });
  assert.deepEqual(productoDeMako(p, [{ ...mako(1, 'Sprint 3 días', null), activo: false }]), { id: null, ambiguo: false }, 'uno desactivado no cuenta');
  // Qué se escribe: el nombre de MaKo se respeta; el precio y el tipo vienen de Stripe.
  assert.deepEqual(importacionDelPrecio(p, mako(54, 'Sprint 3 días', null)), { accion: 'precio', input: { nombre: 'Sprint 3 días', tipo: 'unico', montoUsd: 270 } });
  assert.equal((importacionDelPrecio(p, mako(54, 'Sprint 3 días', 270)) as { accion: string }).accion, 'igual');
  assert.equal((importacionDelPrecio(p, null) as { accion: string }).accion, 'crear');
  assert.match((importacionDelPrecio({ ...p, montoUsd: null }, null) as { error: string }).error, /dólares/);
});

test('en el negocio: los precios de las dos cuentas, en vivo, cada uno con su cuenta y el producto de MaKo que es', () => {
  assert.deepEqual(R.lista, [
    'Membresía|stripe:principal|Stripe|49|suscripcion|sí|null',
    'Mentoría|stripe:c2|Stripe del equipo|100|unico|sí|60',
    'sprint 3 días|stripe:principal|Stripe|270|unico|sí|54',
    'Taller|stripe:principal|Stripe|300|unico|sí|null',
    'Curso MX|stripe:principal|Stripe|null|unico|no: Está en MXN: el catálogo de MaKo va en dólares.|null',
    'Plan anual|stripe:principal|Stripe|990|suscripcion|no: Se cobra cada año: MaKo cobra las suscripciones por mes.|null',
  ], 'el producto de US$270 de Mauricio no aparecía');
  assert.deepEqual(R.errores, []);
  assert.deepEqual(R.rota, { cuentas: ['stripe:principal'], errores: ['stripe:c2|Stripe del equipo|Invalid API Key provided'] }, 'una cuenta que no se lee se tomaba como «no tiene productos»');
  assert.equal(R.listados, 4, '«Volver a leer» tiene que ir a Stripe cada vez (dos cuentas × dos lecturas)');
});

test('traer el de Mauricio le pone el precio al «Sprint 3 días» de MaKo, sin duplicarlo', () => {
  assert.equal(R.sprint, 'precio:54:Sprint 3 días:unico:270:antes=null');
  assert.equal(R.sprintFila, 'Sprint 3 días|270|unico');
  assert.equal(R.creadosPorSprint, 0, 'traerlo creaba otro «Sprint 3 días»');
  assert.equal(R.sprintOtraVez, 'igual:54:Sprint 3 días:unico:270:antes=270');
  assert.equal(R.mentoria, 'igual:60:Mentoría:unico:100:antes=100', 'la segunda cuenta, con SU clave');
  assert.equal(R.membresia, 'creado:100:Membresía:suscripcion:49:antes=null');
});

test('lo que no se trae: otra moneda, el precio de otra cuenta, una cuenta que no está, un id raro, el nombre ambiguo', () => {
  assert.equal(R.mxn, 'error: Está en MXN: el catálogo de MaKo va en dólares.');
  assert.equal(R.deOtraCuenta, 'error: Ese precio ya no está en Stripe del equipo.', 'el precio se lee con la clave de la cuenta elegida');
  assert.equal(R.sinCuenta, 'error: Esa cuenta de Stripe no está conectada.');
  assert.equal(R.idRaro, 'error: Ese precio de Stripe no existe.', 'un id que no es `price_…` llegaba a la URL de Stripe');
  assert.match(R.ambiguo, /Hay varios «Taller»/);
  assert.match(R.archivado, /ya no están activos/);
});

test('la acción: sólo el admin, el monto nunca viene del navegador, y vincula lo que trajo', () => {
  const src = sinComentarios(leer('app/crm/cobro-etapa-actions.ts'));
  const i = src.indexOf('export async function vincularPrecioDeStripeAction(');
  const f = src.slice(i, src.indexOf('\nexport ', i + 10));
  assert.match(f, /^export async function vincularPrecioDeStripeAction\(p: \{ funnelId: number; etapa: string; cuenta: string; precio: string; cuentas\?: string\[\] \}\)/, 'la firma trae un monto: se cobraría lo que mande el navegador');
  const corte = f.indexOf('if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };');
  assert.ok(corte > 0 && corte < f.indexOf('importarPrecioDeStripe('), 'trae al catálogo sin mirar si es admin');
  assert.match(f, /productoId: imp\.producto\.id/);
  assert.match(f, /producto: imp\.producto \};/, 'si lo trajo y no se vinculó, el modal tiene que poder ponerlo');
  const lee = src.slice(src.indexOf('export async function preciosDeStripeAction('), src.indexOf('export async function vincularPrecioDeStripeAction('));
  assert.match(lee, /await exigirSesion\(\);/);
});
