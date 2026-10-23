// =============================================================================
// «Pasar a Pro» desde «Tu plan» (23/10/2026)
// =============================================================================
// Adonde llevan los carteles de tope. Sube de MaKo Esencial a Pro, y el negocio pasa a la capa de Pro en el acto.
// Lo que falla callado si se rompe:
//   1. EN STRIPE SE COBRA LA DIFERENCIA AHORA, y si ese cobro falla la suscripción no cambia: la capa tampoco sube.
//   2. EL ANUAL SIGUE ANUAL, con el precio anual de Pro (nunca un anual pasa a mensual).
//   3. DOS CLICS NO COBRAN DOS VECES: el reclamo antes de la pasarela, y Stripe «ya estaba» si ya cobra el de Pro.
//   4. LA CAPA SUBE SÓLO DESPUÉS DE QUE LA PASARELA ACEPTÓ.
//   5. SÓLO SUBE, y sólo el admin.
//
// Correr: node --import tsx --test tests/subir-plan.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { decidirSubida, subidaLibre, SUBIDA_VENCE_MS } from '../lib/subir-plan-reglas';
import { PLANES_MAKO_DEFAULT, type PlanMako } from '../lib/planes-mako';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_subir-plan-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const PLANES = PLANES_MAKO_DEFAULT as readonly PlanMako[];

test('a qué plan y a qué precio: Esencial sube a Pro; el anual sólo en Stripe y en USD; nunca baja', () => {
  const base = { montoHoy: 47, capa: 'completo' };
  const s = decidirSubida({ ...base, planActual: 'esencial', planes: PLANES, moneda: 'USD', proveedor: 'stripe' });
  assert.equal(s.accion, 'subir');
  assert.deepEqual(s.accion === 'subir' && { a: s.destino.id, mensual: s.mensual, anual: s.anual }, { a: 'pro', mensual: 97, anual: 970 });
  const mp = decidirSubida({ ...base, montoHoy: 47000, planActual: 'esencial', planes: PLANES.map((p) => ({ ...p, preciosLocales: { ARS: p.id === 'pro' ? 97000 : 47000 } })), moneda: 'ARS', proveedor: 'mercadopago' });
  assert.deepEqual(mp.accion === 'subir' && { mensual: mp.mensual, anual: mp.anual }, { mensual: 97000, anual: null }, 'Mercado Pago cobra por mes y en la moneda de su sitio');
  assert.equal(decidirSubida({ ...base, planActual: 'pro', planes: PLANES, moneda: 'USD', proveedor: 'stripe' }).accion, 'ya', 'un segundo clic volvía a cobrar');
  assert.match((decidirSubida({ ...base, planActual: 'esencial', planes: PLANES, moneda: 'ARS', proveedor: 'mercadopago' }) as { motivo: string }).motivo, /no tiene precio en ARS/, 'sin precio en esa moneda se inventaba uno');
  assert.match((decidirSubida({ ...base, planActual: 'continuidad', planes: PLANES, moneda: 'USD', proveedor: 'stripe' }) as { motivo: string }).motivo, /ya cuesta lo mismo o más/, '«Pasar a Pro» bajaba de plan');
  // Revisión adversarial: sin `plan_mako` (un acuerdo a mano de US$150), «subir» a 97 lo bajaba; y desde otra capa, no.
  assert.match((decidirSubida({ ...base, montoHoy: 150, planActual: null, planes: PLANES, moneda: 'USD', proveedor: 'stripe' }) as { motivo: string }).motivo, /ya cuesta lo mismo o más/, 'un acuerdo de 150 sin plan_mako pasaba a pagar 97');
  assert.equal(decidirSubida({ ...base, planActual: null, planes: PLANES, moneda: 'USD', proveedor: 'stripe' }).accion, 'subir');
  assert.match((decidirSubida({ ...base, capa: 'agencia', planActual: null, planes: PLANES, moneda: 'USD', proveedor: 'stripe' }) as { motivo: string }).motivo, /no se cambia desde aquí/, 'un acuerdo con capa agencia pasaba a pagar 97');
  assert.match((decidirSubida({ ...base, planActual: 'esencial', planes: PLANES.map((p) => (p.id === 'pro' ? { ...p, activo: false } : p)), moneda: 'USD', proveedor: 'stripe' }) as { motivo: string }).motivo, /no está a la venta/);
  // El reclamo: libre, con error, o una «aplicando» vencida; no una que está corriendo.
  const ahora = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(subidaLibre(null, ahora), true);
  assert.equal(subidaLibre(JSON.stringify({ estado: 'aplicando', at: new Date(ahora - 1000).toISOString() }), ahora), false, 'dos clics llegaban los dos a la pasarela');
  assert.equal(subidaLibre(JSON.stringify({ estado: 'aplicando', at: new Date(ahora - SUBIDA_VENCE_MS - 1).toISOString() }), ahora), true, 'un corte a mitad de camino la dejaba trabada para siempre');
  assert.equal(subidaLibre(JSON.stringify({ estado: 'error' }), ahora), true);
});

test('Stripe: la diferencia se cobra AHORA, y si falla no cambia nada; el anual sigue anual', () => {
  const [m] = R.mensual.posts;
  assert.equal(m.proration_behavior, 'always_invoice', 'sin cobrar la diferencia ahora, Pro quedaba gratis hasta el próximo período');
  assert.equal(m.payment_behavior, 'error_if_incomplete', 'con el cobro fallido, la suscripción quedaba en Pro sin pagar');
  assert.equal(m['items[0][price_data][unit_amount]'], '9700');
  assert.equal(m['items[0][price_data][recurring][interval]'], 'month');
  assert.equal(m['items[0][id]'], 'si_1', 'sin el ítem, Stripe SUMA un segundo precio en vez de cambiarlo');
  assert.equal(m.idem, 'mako-subir-1-pro-1');
  const [a] = R.anual.posts;
  assert.deepEqual([a['items[0][price_data][unit_amount]'], a['items[0][price_data][recurring][interval]']], ['97000', 'year'], 'el anual pasaba a mensual');
  assert.deepEqual(R.yaEstaba, { r: { ok: true, yaEstaba: true, intervalo: 'month', monto: 97 }, posts: [] }, 'un reintento volvía a cobrar la diferencia');
  assert.equal(R.falla.r.ok, false);
  assert.equal(R.otraMoneda.posts.length, 0);
  assert.equal(R.semanal.posts.length, 0);
  assert.equal(R.pausada.posts.length, 0, 'una suscripción pausada pasaba a Pro: Pro gratis el mes pausado');
  assert.match(R.pausada.r.error, /no está al día o está en pausa/);
  assert.equal(R.vencida.posts.length, 0, 'una suscripción en mora pasaba a Pro');
  assert.deepEqual(R.timeoutPaso.r, { ok: true, yaEstaba: false, intervalo: 'month', monto: 97 }, 'un timeout después de cobrar decía «tu plan sigue igual»');
  assert.match(R.timeoutNo.r.error, /no sabemos si el cambio pasó/);
});

test('subirAPro: reclama antes de la pasarela, y la capa sube SÓLO si la pasarela aceptó', () => {
  const src = sinComentarios(leer('lib/subir-plan.ts'));
  const f = src.slice(src.indexOf('export async function subirAPro('));
  const reclamo = f.indexOf('cambiarSettingSi(CLAVE_SUBIDA, antes, JSON.stringify(marca))');
  const pasarela = Math.min(f.indexOf('await subirPlanStripe('), f.indexOf('await montoSuscripcionMp('));
  assert.ok(reclamo > 0 && reclamo < pasarela, 'dos clics llegaban los dos a la pasarela');
  const corte = f.indexOf('if (error) {');
  const capa = f.indexOf('const capaOk = await subirCapa(ws, d.destino.capa);');
  assert.ok(corte > pasarela && capa > corte, 'la capa subía antes de saber si la pasarela aceptó');
  assert.match(f.slice(corte, capa), /return \{ ok: false, resumen: `No pudimos pasarte a/, 'con el cobro fallido seguía y subía la capa');
  assert.match(f, /if \(!capaOk\) return \{ ok: false, resumen: SIN_CAPA \};/, 'pagó y no se activó, y decía «Listo»');
  assert.match(f, /montoSuscripcionMp\(token, sub, d\.mensual, idem\)/, 'Mercado Pago: el monto de Pro desde el próximo período');
  // Sólo el admin.
  const accion = sinComentarios(leer('app/configuraciones/plan/actions.ts'));
  const a = accion.slice(accion.indexOf('export async function pasarAProAction('));
  assert.ok(a.indexOf('adminDeWorkspaceActual()') > 0 && a.indexOf('adminDeWorkspaceActual()') < a.indexOf('subirAPro('), 'cualquiera con sesión cambiaba el plan');
  assert.ok(a.indexOf('estaImpersonando()') > 0 && a.indexOf('estaImpersonando()') < a.indexOf('subirAPro('), 'la agencia mirando a su cliente le cobraba la subida a la tarjeta del cliente');
  assert.match(f, /r0\.estado === 'aplicada' && !r0\.restaurada/, 'con un descuento de retención vivo, el cron la devolvía al precio de antes');
  // Y la pantalla lo confirma antes de cobrar.
  assert.match(leer('app/configuraciones/plan/PlanPanel.tsx'), /onClick=\{corriendo \? undefined : \(\) => setConfirmarSubida\(true\)\}/);
});
