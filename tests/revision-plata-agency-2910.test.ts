// =============================================================================
// La revisión adversarial de plata de la rama de Thiago (29/10/2026): lo que se arregló
// =============================================================================
// Un revisor (Opus) leyó el commit 33c131f6b buscando cómo la rama cobraba mal, seguía cobrando, daba acceso gratis o le
// acreditaba a un partner lo que no ganó. Trece hallazgos; los arreglos están en lib/agencia-baja.ts, lib/agencia-plan.ts,
// lib/agencia-cobro.ts, lib/plan-acceso.ts, lib/workspace.ts, lib/plan-esencial.ts, lib/vender-plan.ts, lib/compra-plan.ts,
// lib/partners.ts y lib/partners-programa.ts. La cosecha, en docs/hallazgos-agencias.md y docs/hallazgos-partners.md.
//
// Y una SEGUNDA PASADA del mismo revisor sobre los arreglos (1f49ea387): cinco hallazgos nuevos (A-E), arreglados acá. Y una
// TERCERA, corta (775a83ef4): la clave de idempotencia del día, el monto de la subida pendiente y la pausa programada sin topes.
//
// Probado rompiéndolo (29/10/2026; base 12 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · la baja cancela sólo la marcada `activa` (la pagada sin estado sigue cobrando)  -> 11 / 1
//   · la baja cancela la suscripción que paga el cliente en vez de pasársela        -> 11 / 1
//   · el plazo del cliente que pagaba él se mide desde el pago, no del onboarding    -> 11 / 1
//   · la subida a Pro con Mercado Pago, en el acto                                   -> 11 / 1
//   · la subida pendiente se aplica con un pago del mismo día                        -> 11 / 1
//   · la vigencia de la cuenta soltada con los cobros de la agencia                  -> 11 / 1
//   · subir a Pro en Stripe sin cobrar la diferencia                                 -> 11 / 1
//   · rehacer el primer mes creando el nuevo con el viejo vivo                        -> 11 / 1
//   · la renovación cae al monto del primer mes cuando su plan no tiene precio        -> 11 / 1
//   · el cron renueva sin releer la cartera                                          -> 11 / 1
//   · el Esencial de agencia sin los candados de Pro                                 -> 11 / 1
//   · el ex cliente con su Esencial propio sin los candados                          -> 11 / 1
//   · la pausa programada marca la cuenta pausada en el acto                         -> 11 / 1
//   · el partner gana lo cobrado cuando la compra no anota el plan                    -> 11 / 1
//   · el primer plan propio con la agencia todavía pagando                           -> 11 / 1
//   · la clave de idempotencia por día (ir y volver dos veces el mismo día)          -> 11 / 1
//   · la subida pendiente con un pago de cualquier monto                             -> 11 / 1
//   · la cuenta en pausa programada, sin topes                                       -> 11 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esSuscripcionViva, finDeLoQuePago, leerCambioDePlan, queHacerEnLaBaja, subeEnElActo, subidaCobrada } from '../lib/agencia-cobro-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');
const DIA = 24 * 3600_000;

test('la baja (3): toda suscripción viva se cancela, también la devuelta y la autorizada sin cobrar; un link sin pagar se anula', () => {
  const sus = (estado: string, suscripcion_estado: string | null) => ({ tipo: 'suscripcion' as const, estado, suscripcion_estado, pagado_at: null });
  for (const estado of ['pagado', 'pendiente', 'fallido', 'reembolsado']) assert.equal(queHacerEnLaBaja(sus(estado, 'activa'), false), 'cancelar', estado);
  // E (segunda pasada): la pagada (o devuelta) sin `suscripcion_estado` también sigue cobrando.
  assert.equal(queHacerEnLaBaja(sus('pagado', null), false), 'cancelar');
  assert.equal(queHacerEnLaBaja(sus('reembolsado', null), false), 'cancelar');
  assert.equal(esSuscripcionViva(sus('pagado', null)), true);
  assert.equal(queHacerEnLaBaja(sus('pendiente', null), false), 'anular');
  assert.equal(queHacerEnLaBaja({ tipo: 'unico', estado: 'pendiente', suscripcion_estado: null, pagado_at: null }, false), 'anular');
  assert.equal(queHacerEnLaBaja({ tipo: 'unico', estado: 'pagado', suscripcion_estado: null, pagado_at: '2026-10-01' }, false), null);
  assert.equal(queHacerEnLaBaja(sus('pagado', 'cancelada'), false), null);
  // Y la baja cancela con `cancelarSuscripcionCobro`, que frena si la pasarela falla (anularCobro se tragaba el error).
  assert.match(fuente('lib/agencia-baja.ts'), /if \(que === 'cancelar'\) \{\n\s*const r = await cancelarSuscripcionCobro\(plataforma, c\.id, p\.autor\);\n\s*if \(!r\.ok\) return/);
});

test('la baja (5): si la paga el cliente, su suscripción pasa a ser SU plan y la cuenta no se pausa; si sólo pagó el primer mes, usa lo que pagó', () => {
  const viva = { tipo: 'suscripcion' as const, estado: 'pagado', suscripcion_estado: 'activa', pagado_at: '2026-10-01T00:00:00.000Z' };
  assert.equal(queHacerEnLaBaja(viva, true), 'pasar');
  const b = fuente('lib/agencia-baja.ts');
  assert.match(b, /\.update\(\{ alta_ws: clienteWs, agencia_ws: null, cliente_ws: null \}\)\n\s*\.eq\('id', c\.id\)\.eq\('workspace_id', plataforma\)\.eq\('agencia_ws', agenciaWs\)\.eq\('cliente_ws', clienteWs\)/);
  // Un reintento mira su plan propio, y sin poder leerlo NO sigue (pausar a quien ya paga su plan es peor que reintentar).
  assert.match(b, /let conPlanPropio = pasados > 0;\n\s*if \(!conPlanPropio && pagaCliente\) \{\n\s*try \{ conPlanPropio = await tienePlanPropioVivo\(plataforma, clienteWs\); \} catch \(e\) \{ return \{ ok: false/);
  assert.match(b, /if \(!conPlanPropio\) \{\n\s*const fin = pagaCliente \? finDeLoQuePago\(/);
  // D (segunda pasada): la pausa del que pagaba él queda PROGRAMADA (`cobroId: -1`), sin marcar la cuenta pausada en el acto.
  assert.match(b, /cobroId: programada \? -1 : 0/);
  assert.match(b, /if \(!programada\) \{\n[^\n]*\n\s*const \{ error: ePausa \} = await db\.from\('workspaces'\)\.update\(\{ estado: 'pausado'/);
  assert.match(fuente('lib/plan-acceso.ts'), /if \(corte\?\.motivo === 'sin-agencia' && corte\.vigente && corte\.cobroId === -1 && estado === 'activo' && v\.estado !== 'al-dia' && Date\.parse\(corte\.desde\) <= ahoraMs\) \{/);
  // El primer mes corre desde el onboarding (si terminó después del pago); una renovación, desde su pago.
  const primero = { tipo: 'unico' as const, estado: 'pagado', suscripcion_estado: null, pagado_at: '2026-10-01T10:00:00.000Z' };
  assert.equal(finDeLoQuePago([primero], '2026-10-05T10:00:00.000Z'), '2026-11-05T10:00:00.000Z');
  assert.equal(finDeLoQuePago([primero, { ...viva, pagado_at: '2026-11-05T10:00:00.000Z', suscripcion_estado: 'cancelada' }], '2026-10-05T10:00:00.000Z'), '2026-12-05T10:00:00.000Z');
  assert.equal(finDeLoQuePago([{ ...primero, estado: 'pendiente' }], null), null);
});

test('la baja (1): el corte `sin-agencia` pausa aunque el corte general esté apagado, y la reabre SÓLO su plan', () => {
  const acceso = fuente('lib/plan-acceso.ts');
  assert.match(acceso, /const propios = suyos\.filter\(\(c\) => Number\(c\.alta_ws\) === ws && c\.cliente_ws == null\);/);
  assert.match(acceso, /const deEl = corte\?\.motivo === 'sin-agencia' \|\| propios\.some\(\(c\) => c\.tipo === 'suscripcion'\) \? propios : suyos;\n\s*const v = vigenciaDelLugar\(deEl,/);
  assert.match(fuente('lib/workspace.ts'), /export const negocioPausado = cache\(async \(ws: number\): Promise<boolean> => \{\n\s*if \(\(await filaDelNegocio\(ws\)\)\?\.estado !== 'pausado'\) return false;/);
});

test('cambiar el plan (2a, C): Pro se tiene cuando se paga a precio de Pro', () => {
  assert.equal(subeEnElActo({ diferenciaCobrada: true, algoPagado: true, hayQueCobrar: true }), true, 'Stripe cobró la diferencia');
  assert.equal(subeEnElActo({ diferenciaCobrada: false, algoPagado: false, hayQueCobrar: true }), true, 'todavía no pagó nada: el link se rehace a Pro');
  assert.equal(subeEnElActo({ diferenciaCobrada: false, algoPagado: true, hayQueCobrar: true }), false, 'Mercado Pago, o el primer mes ya pagado: pendiente');
  const cambio = leerCambioDePlan(JSON.stringify({ at: '2026-10-29T12:00:00.000Z', plan: 'pro', pendiente: true }));
  assert.ok(cambio?.pendiente);
  assert.equal(subidaCobrada(cambio, [{ fecha_pago: '2026-10-29', alcanza: true }]), false, 'un pago del mismo día pudo ser el de antes');
  assert.equal(subidaCobrada(cambio, [{ fecha_pago: '2026-11-29T09:00:00.000Z', alcanza: true }]), true);
  assert.equal(subidaCobrada(cambio, [{ fecha_pago: '2026-11-29', alcanza: false }]), false, 'un cobro de Esencial (la pasarela no tomó el monto) no sube');
  assert.equal(subidaCobrada({ ...cambio!, pendiente: false }, [{ fecha_pago: '2026-11-29', alcanza: true }]), false);
  const plan = fuente('lib/agencia-plan.ts');
  assert.match(plan, /const enElActo = p\.plan === 'esencial' \|\| yaTeniaPro \|\| subeEnElActo\(\{ diferenciaCobrada: diferenciaCobrada && vivas\.every\(\(c\) => c\.proveedor === 'stripe'\), algoPagado, hayQueCobrar \}\);\n\s*if \(enElActo\) \{/);
  // El cron la aplica con el primer pago de una suscripción anotada en Pro.
  assert.match(plan, /\.eq\('tipo', 'suscripcion'\)\.eq\('plan_mako', 'pro'\)/);
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await aplicarSubidasPendientes\(\)/);
});

test('cambiar el plan (2a, 2b, 2c, 2d): subir con Stripe cobra la diferencia, la clave lleva el día, el precio se valida antes y el primer mes sin pagar se rehace', () => {
  const plan = fuente('lib/agencia-plan.ts');
  assert.match(plan, /else if \(p\.plan === 'pro'\) \{\n\s*const r = await subirPlanStripe\(key, c\.proveedor_suscripcion_id, \{ mensual: monto, anual: null, moneda: c\.moneda, idem \}\);/);
  // Una clave por PEDIDO (tercera pasada): la del día se repetía al ir y volver dos veces, y Stripe devolvía la guardada.
  assert.match(plan, /const pedido = Date\.now\(\)\.toString\(36\);/);
  assert.match(plan, /const idem = `mako-plan-agencia-\$\{c\.id\}-\$\{plan\.id\}-\$\{pedido\}`;/);
  assert.match(plan, /else if \(Math\.abs\(r\.monto - monto\) > 0\.01\) fallo = /, 'Mercado Pago tiene que tomar el monto');
  const valida = plan.indexOf('const v = await precioDelPlanEn(plan, m);');
  assert.ok(valida > 0 && valida < plan.indexOf('subirPlanStripe(key'), 'el precio en la moneda de la cuenta, antes de la pasarela');
  assert.match(plan, /for \(const c of primerMesSinPagar\) \{\n\s*const r = await rehacerPrimerMes\(c\.id, plan, p\.autor\);/);
  assert.match(plan, /if \(pagaCliente\) \{\n\s*for \(const to of await adminsDeCuenta\(p\.clienteWs\)/, 'si la paga el cliente, se le avisa');
  // A (segunda pasada): el viejo se anula PRIMERO (un único vivo por cliente: con el viejo vivo, crear devolvía el viejo), y si
  // el nuevo no sale se rehace el de antes.
  const cobro = fuente('lib/agencia-cobro.ts');
  const rehacer = cobro.slice(cobro.indexOf('export async function rehacerPrimerMes('));
  const anula = rehacer.indexOf('const anulado = await anularCobro(plataforma, cobroId, autor);');
  assert.ok(anula > 0 && anula < rehacer.indexOf('const r = await crear('), 'anula antes de crear');
  assert.match(rehacer, /if \(!r\.ok \|\| r\.cobro\.id === cobroId\) \{\n[^\n]*\n\s*const atras = await crear\(Number\(c\.monto\)/);
});

test('la renovación (2d, 3a, 10, 11): sin precio del plan no se crea, la devuelta cuenta, la cartera se relee y sin `inicio_at` se anula', () => {
  const cobro = fuente('lib/agencia-cobro.ts');
  assert.match(cobro, /return plan && monto != null \? \{ monto, montoUsd: plan\.precioUsd \} : null;/);
  assert.doesNotMatch(cobro, /\?\? Number\(f\.monto\);/);
  assert.match(cobro, /\.in\('estado', \['pendiente', 'fallido', 'pagado', 'reembolsado'\]\)\.limit\(500\),/);
  assert.match(cobro, /if \(eRev\) throw new Error\(`No pude leer las cuentas dadas de baja/);
  const releo = cobro.indexOf("const { data: cart, error: eCart } = await db.from('agencia_clientes').select('estado')");
  assert.ok(releo > 0 && releo < cobro.indexOf('const r = await crearCobro(plataforma, {\n        leadId: f.lead_id'), 'la cartera, releída antes de crear la renovación');
  assert.match(cobro, /if \(eAnotar && f\.proveedor === 'stripe'\) \{[\s\S]*?await anularCobro\(plataforma, r\.cobro\.id,/);
});

test('los candados de Pro (4): el Esencial de una cuenta de agencia los tiene, por su cartera', () => {
  const e = fuente('lib/plan-esencial.ts');
  assert.match(e, /if \(!capaVendida\) \{\n\s*const \{ data: cart, error: eCart \} = await getSupabaseServer\(\)\.from\('agencia_clientes'\)\.select\('cliente_ws'\)\.eq\('cliente_ws', ws\)\.neq\('estado', 'revocado'\)/);
  // Con el plan elegido (H1 de la verificación independiente: tests/verificacion-plata-agency-2910.test.ts).
  assert.match(e, /if \(\(cart\?\.length \|\| \(await soltadaPorSuAgencia\(ws\)\)\) && \(await rigeElPlanDeAgenciaEn\(ws\)\)\) capaVendida = capa \?\? null;/);
  // Y la que su agencia soltó y todavía usa lo que pagó (tercera pasada): candados y topes.
  assert.match(fuente('lib/topes-plan-server.ts'), /if \(!\(data \?\? \[\]\)\.length && !\(await soltadaPorSuAgencia\(ws\)\)\) return false;/);
  // B (segunda pasada): el ex cliente que paga su propio Esencial (sin `alta_capa`) también.
  assert.match(e, /if \(!capaVendida && data\) capaVendida = capa \?\? null;/);
});

test('la venta a mano (6, 12): el partner gana la lista de la capa vendida, y sin el código guardado no queda el link', () => {
  const pp = fuente('lib/partners-programa.ts');
  assert.match(pp, /const plan = porPrecio\.find\(\(p\) => p\.capa === c\.alta_capa\) \?\? porPrecio\[0\];/, 'una capa sin plan, al más barato de todos');
  assert.equal((pp.match(/precioDeListaPorMes\(conPlanDeLista\(c\), listaDe\)/g) ?? []).length, 2, 'en el panel y en la acreditación');
  assert.equal((pp.match(/select\('alta_ws, (ref_codigo, )?monto_usd, plan_mako, alta_capa, meses, created_at'\)/g) ?? []).length, 2);
  const v = fuente('lib/vender-plan.ts');
  assert.doesNotMatch(v, /plan_mako/, 'la venta a mano no escribe el plan (entraba a la retención y a reactivar a lista)');
  assert.match(v, /if \(e\) \{\n\s*await anularCobro\(ws, r\.cobro\.id,/);
  assert.match(v, /update\(\{ ref_codigo: venta\.refCodigo \}\)\.eq\('id', c\.id\)\.eq\('workspace_id', ws\)\.is\('ref_codigo', null\)/, 'el link que ya existía recibe el código');
  assert.match(v, /if \(otro && otro !== venta\.refCodigo\) return \{ ok: false/, 'o se dice que tiene el de otro partner');
});

test('el primer plan propio (7): sólo sin agencia, y con la pasarela de SU país', () => {
  const c = fuente('lib/compra-plan.ts');
  const f = c.slice(c.indexOf('async function primerPlanPropio('));
  assert.ok(f.indexOf("db.from('agencia_clientes').select('estado').eq('cliente_ws', ws).neq('estado', 'revocado')") < f.indexOf('await crearCobro('));
  assert.match(f, /if \(cart\?\.length\) return \{ ok: false, status: 409/);
  assert.match(f, /const opciones = pasarelasDelPais\(p\.pais \?\? null,/);
  assert.match(fuente('app/api/plan/pagar/route.ts'), /reactivarPlan\(a\.ws, \{ email: a\.email, nombre: a\.nombre, pais: paisDelVisitante\(req\.headers\.get\('x-vercel-ip-country'\)\) \}\)/);
});

test('el país por la zona (8): sólo si el negocio la guardó (la de por defecto es Tijuana)', () => {
  assert.match(fuente('lib/partners.ts'), /const pais = p\.pais \?\? \(zona\?\.guardada \? paisDeZona\(zona\.tz\) : null\);/);
});

test('Partners (13): el cliente de una agencia no se hace partner, tampoco por la API', () => {
  const pp = fuente('lib/partners-programa.ts');
  const f = pp.slice(pp.indexOf('export async function hacermePartner('));
  assert.ok(f.indexOf('if (await agenciaDeCliente(ws)) return { ok: false') < f.indexOf('await codigoDe(ws)'));
});

test('la pantalla: cambiar el plan pide confirmación y dice qué se cobra', () => {
  const app = fuente('app/agency/AgencyApp.tsx');
  assert.match(app, /onClick=\{\(\) => setPlanAConfirmar\(\{ ws: abierta\.ws,/);
  assert.match(app, /Con tarjeta se cobra hoy la diferencia de este mes/);
  assert.doesNotMatch(app, /30 días/, 'ya no hay «un cambio cada 30 días»');
});
