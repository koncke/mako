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
// PROBADO ROMPIÉNDOLO (23/10/2026, después de la revisión adversarial), con el archivo en 7 / 0, una rotura por vez:
//   · se lee sólo la primera cuenta                                → 6 / 1
//   · la cuenta que no se lee se calla                             → 6 / 1
//   · otra moneda entra como dólares                               → 4 / 3
//   · una anual entra como mensual                                 → 5 / 2
//   · un producto archivado se muestra                             → 4 / 3
//   · el nombre sin sacar los acentos                              → 6 / 1
//   · la fracción de centavo se dice «escalones»                   → 6 / 1
//   · la moneda con su propia lista (UGX sin ×100)                 → 6 / 1
//   · traer siempre crea uno nuevo                                 → 5 / 2
//   · el precio se lee con la clave de la principal                → 5 / 2
//   · un id raro llega a Stripe                                    → 6 / 1
//   · el mismo precio se vuelve a escribir                         → 5 / 2
//   · el que cobra otra cosa se toma como éste                     → 4 / 3
//   · importar pisa el que cobra otra cosa                         → 6 / 1
//   · las cuotas viejas se conservan                               → 6 / 1
//   · el freno no se mira (se escribe aunque el vínculo no vaya)   → 5 / 2
//   · la acción sin el corte de admin                              → 6 / 1
//   · la acción no mira el CRM antes de escribir                   → 6 / 1
//   · la acción no pasa el freno                                   → 6 / 1
//   · vincular tira y se dice «no se pudo traer»                   → 6 / 1
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
  assert.match(no({ unit_amount: null, unit_amount_decimal: '1050.5' }) ?? '', /fracciones de centavo/, 'un precio con fracción de centavo se decía «por escalones»');
  // La misma conversión que los cobros (lib/pasarela-moneda.ts): el yen no tiene centavos; el chelín de Uganda va ×100.
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'jpy', unit_amount: 500, product: prod('Y') }, CUENTA)?.monto, 500);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'ugx', unit_amount: 50000, product: prod('Y') }, CUENTA)?.monto, 500);
  // Lo que no se muestra: inactivo, producto archivado, sin nombre (sin expandir).
  assert.equal(precioDeStripe({ id: 'price_1', active: false, currency: 'usd', unit_amount: 1, product: prod('X') }, CUENTA), null);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 1, product: prod('X', false) }, CUENTA), null);
  assert.equal(precioDeStripe({ id: 'price_1', active: true, currency: 'usd', unit_amount: 1, product: 'prod_x' }, CUENTA), null);
});

test('el mismo nombre es el mismo producto: no se duplica, y uno que cobra OTRA cosa nunca se pisa', () => {
  assert.equal(nombreComparable('  Sprint  3 DÍAS '), nombreComparable('sprint 3 dias'));
  const p = { nombre: 'sprint 3 días', montoUsd: 270, tipo: 'unico' as const };
  assert.deepEqual(productoDeMako(p, [mako(54, 'Sprint 3 días', null)]), { id: 54, conflicto: null }, 'el de MaKo sin precio no se reconocía');
  assert.deepEqual(productoDeMako(p, [mako(1, 'Sprint 3 días', 100), mako(2, 'sprint 3 dias', 270)]), { id: 2, conflicto: null }, 'el que ya cobra lo mismo');
  assert.deepEqual(productoDeMako(p, [{ ...mako(1, 'Sprint 3 días', null), activo: false }]), { id: null, conflicto: null }, 'uno desactivado no cuenta');
  // Revisión adversarial: el mismo producto de Stripe con dos precios (US$600 único y US$100 por mes) pisaba el de MaKo.
  const mensual = { nombre: 'Mentoría', montoUsd: 100, tipo: 'suscripcion' as const };
  const choca = productoDeMako(mensual, [mako(7, 'Mentoría', 600)]);
  assert.equal(choca.id, null, 'el de MaKo que cobra otra cosa se tomaba como éste y se le cambiaba el precio');
  assert.match(choca.conflicto ?? '', /En MaKo «Mentoría» ya cobra US\$ 600 · pago único: cámbialo ahí/);
  assert.match(productoDeMako(p, [mako(1, 'Sprint 3 días', 100), mako(2, 'Sprint 3 días', 200, 'suscripcion')]).conflicto ?? '', /US\$ 100 · pago único y US\$ 200 por mes/);
  // Qué se escribe: el nombre de MaKo se respeta; el precio viene de Stripe y se cobra ENTERO (sin las cuotas viejas).
  assert.deepEqual(importacionDelPrecio(p, mako(54, 'Sprint 3 días', null)), { accion: 'precio', input: { nombre: 'Sprint 3 días', tipo: 'unico', montoUsd: 270, cuotas: null } },
    'con cuotas viejas el link cobraba la cuota de un precio que la persona no vio');
  assert.equal((importacionDelPrecio(p, mako(54, 'Sprint 3 días', 270)) as { accion: string }).accion, 'igual');
  assert.match((importacionDelPrecio(mensual, mako(7, 'Mentoría', 600)) as { error: string }).error, /ya cobra US\$ 600/, 'si llega uno que cobra otra cosa, es un error: nunca se pisa');
  assert.equal((importacionDelPrecio(p, null) as { accion: string }).accion, 'crear');
  assert.match((importacionDelPrecio({ ...p, montoUsd: null }, null) as { error: string }).error, /dólares/);
});

test('en el negocio: los precios de las dos cuentas, en vivo, cada uno con su cuenta y el producto de MaKo que es', () => {
  assert.deepEqual(R.lista, [
    'Membresía|stripe:principal|Stripe|49|suscripcion|sí|null',
    'Mentoría|stripe:c2|Stripe del equipo|100|unico|sí|60',
    'sprint 3 días|stripe:principal|Stripe|270|unico|sí|54',
    'Curso MX|stripe:principal|Stripe|null|unico|no: Está en MXN: el catálogo de MaKo va en dólares.|null',
    'Mentoría|stripe:c2|Stripe del equipo|50|suscripcion|no: En MaKo «Mentoría» ya cobra US$ 100 · pago único: cámbialo ahí, o renombra uno de los dos.|null',
    'Plan anual|stripe:principal|Stripe|990|suscripcion|no: Se cobra cada año: MaKo cobra las suscripciones por mes.|null',
    'Taller|stripe:principal|Stripe|300|unico|no: En MaKo «Taller» ya cobra US$ 250 · pago único y US$ 280 · pago único: cámbialo ahí, o renombra uno de los dos.|null',
  ], 'el producto de US$270 de Mauricio no aparecía');
  assert.deepEqual(R.errores, []);
  assert.deepEqual(R.rota, { cuentas: ['stripe:principal'], errores: ['stripe:c2|Stripe del equipo|Invalid API Key provided'] }, 'una cuenta que no se lee se tomaba como «no tiene productos»');
  assert.equal(R.listados, 4, '«Volver a leer» tiene que ir a Stripe cada vez (dos cuentas × dos lecturas)');
});

test('lo que frena el vínculo frena ANTES de escribir: el catálogo queda como estaba', () => {
  assert.equal(R.frenado, 'error: Ese producto ya cobra en «Otro»: quítalo de ahí primero.');
  assert.deepEqual(R.frenadoVio, [54], 'el freno tiene que saber qué producto de MaKo se iba a tocar');
  assert.equal(R.frenadoFila, null, 'el precio quedaba cambiado para todo el negocio aunque el vínculo no se hiciera');
});

test('traer el de Mauricio le pone el precio al «Sprint 3 días» de MaKo, sin duplicarlo', () => {
  assert.equal(R.sprint, 'precio:54:Sprint 3 días:unico:270:antes=null');
  assert.equal(R.sprintFila, 'Sprint 3 días|270|unico');
  assert.equal(R.creadosPorSprint, 0, 'traerlo creaba otro «Sprint 3 días»');
  assert.equal(R.sprintOtraVez, 'igual:54:Sprint 3 días:unico:270:antes=270');
  assert.equal(R.mentoria, 'igual:60:Mentoría:unico:100:antes=100', 'la segunda cuenta, con SU clave');
  assert.match(R.mentoriaMensual, /^error: En MaKo «Mentoría» ya cobra US\$ 100 · pago único/);
  assert.equal(R.mentoriaFila, '100|unico', 'el otro precio del mismo producto de Stripe pisaba el de MaKo');
  assert.equal(R.membresia, 'creado:100:Membresía:suscripcion:49:antes=null');
});

test('lo que no se trae: otra moneda, el precio de otra cuenta, una cuenta que no está, un id raro, el nombre ambiguo', () => {
  assert.equal(R.mxn, 'error: Está en MXN: el catálogo de MaKo va en dólares.');
  assert.equal(R.deOtraCuenta, 'error: Ese precio ya no está en Stripe del equipo.', 'el precio se lee con la clave de la cuenta elegida');
  assert.equal(R.sinCuenta, 'error: Esa cuenta de Stripe no está conectada.');
  assert.equal(R.idRaro, 'error: Ese precio de Stripe no existe.', 'un id que no es `price_…` llegaba a la URL de Stripe');
  assert.match(R.ambiguo, /En MaKo «Taller» ya cobra US\$ 250 · pago único y US\$ 280/);
  assert.match(R.archivado, /ya no están activos/);
});

test('la acción: sólo el admin, el monto nunca viene del navegador, y vincula lo que trajo', () => {
  const src = sinComentarios(leer('app/crm/cobro-etapa-actions.ts'));
  const i = src.indexOf('export async function vincularPrecioDeStripeAction(');
  const f = src.slice(i, src.indexOf('\nexport ', i + 10));
  assert.match(f, /^export async function vincularPrecioDeStripeAction\(p: \{ funnelId: number; etapa: string; cuenta: string; precio: string; cuentas\?: string\[\] \}\)/, 'la firma trae un monto: se cobraría lo que mande el navegador');
  const corte = f.indexOf('if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };');
  assert.ok(corte > 0 && corte < f.indexOf('importarPrecioDeStripe('), 'trae al catálogo sin mirar si es admin');
  const importa = f.indexOf('imp = await importarPrecioDeStripe(');
  assert.ok(importa > 0);
  const antes = ['conectadas = await cuentasConectadas();', 'const g = await ganadoDelCrm(funnelId);', "if (g.etapa !== String(p.etapa)) return"].map((x) => f.indexOf(x));
  assert.ok(antes.every((i) => i > 0 && i < importa),
    'el CRM y las cuentas se miraban DESPUÉS de tocar el catálogo');
  assert.match(f.slice(importa), /^imp = await importarPrecioDeStripe\(await wsObligatorio\(\), p\.cuenta, p\.precio, async \(productoId\) => \{[\s\S]*?vinculosDelNegocio\(\)[\s\S]*?quítalo de ahí primero/,
    'que el producto ya cobre en otro CRM se miraba después de cambiarle el precio');
  assert.match(f, /productoId: traido\.producto\.id/);
  assert.match(f, /return noSeVinculo\(msg\(e\)\);/, 'si vincular tira después de traerlo, se decía «no se pudo traer»');
  assert.match(f, /producto: traido\.producto \}\);/, 'si lo trajo y no se vinculó, el modal tiene que poder ponerlo');
  const lee = src.slice(src.indexOf('export async function preciosDeStripeAction('), src.indexOf('export async function vincularPrecioDeStripeAction('));
  assert.match(lee, /await exigirSesion\(\);/);
});
