// =============================================================================
// Los pagos son de un CRM (22/10/2026, mig 0324): el plan de una renovación arranca de cero en su CRM
// =============================================================================
// Llamada con un cliente del 22/10/2026 (Fathom 195129619, 05:00-12:39):
//   · P2: en el CRM de renovaciones, la tab Pagos mostraba el plan del PRIMER servicio («cuota 1, cobrada el 01/04»);
//   · P1: el dashboard de Cobros tiene que poder elegir qué CRM o CRMs lee (la venta, las renovaciones, el low ticket);
//   · P3: «01/04» no se entendía: «4 de octubre».
// El modelo: lib/pagos-crm.ts. La ficha: app/crm/lead-view/ficha/pagos/trato.ts. El server: lib/pagos.ts.
//
// Lo puro se EJECUTA; lo que vive en el server (las lecturas por CRM, la migración, las acciones) se lee del fuente.
// Probado ROMPIÉNDOLO (22/10/2026, base 11 / 0): cada test dice la rotura que se le hizo y cuántos fallos dio, medido.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esDelTrato, leadConTrato, pagosDelTrato, camposDeFila, cobrosDelTrato, faltaIndicePorCrm, type CamposTrato } from '../lib/pagos-crm';
import { crmEnVista, ctxDelTrato } from '../app/crm/lead-view/ficha/pagos/trato';
import { fechaEnPalabras } from '../lib/date-utils';
import { renglonDeCuota, estadoDeCuenta } from '../lib/pagos-vistazo';
import { cobradoDelLead, ddmm } from '../lib/cobrado-lead';
import { armarCobranza } from '../lib/datos-comercial';
import { cobroDeFila } from '../app/m/dashboard/modelo';
import { funnelsDeLaHoja } from '../lib/graficos-controles-texto';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';
import type { Hoja } from '../lib/graficos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// El caso de la llamada (medido en el ws1, sólo lectura): el lead 28 está en su casa (funnel 1, la venta del VSL, tres
// cuotas cobradas, la primera el 01/04) y agregado a «Renovación» (funnel 29), ganado ahí.
const CASA = 1;
const RENOVACION = 29;
const cuota = (id: number, numero: number, funnel: number | null, extra: Record<string, unknown> = {}) => ({
  id, lead_id: 28, numero, monto_usd: 2500, fecha_esperada: '2026-07-09', pagado: true, fecha_pago: '2026-04-01', funnel_id: funnel, created_at: '2026-06-18', ...extra,
});
const DEL_VSL = [cuota(43, 1, CASA), cuota(44, 2, CASA), cuota(45, 3, CASA)];

// Rotura: la casa con `f == null` solo (sin «no es de un agregado»): 10 / 1.
test('cada pago es de UN trato: la renovación no ve la venta del VSL, y la casa no ve la renovación', () => {
  const ren = cuota(90, 1, RENOVACION, { pagado: false, fecha_pago: null, fecha_esperada: '2026-11-04' });
  const todos = [...DEL_VSL, ren];
  assert.deepEqual(pagosDelTrato(todos, RENOVACION, [RENOVACION]).map((p) => p.id), [90], 'la renovación arranca de cero: sólo su cuota');
  assert.deepEqual(pagosDelTrato(todos, null, [RENOVACION]).map((p) => p.id), [43, 44, 45], 'la casa: la venta del VSL');
  // Un pago de un CRM del que ya se quitó al lead vuelve a la casa: ninguna plata queda sin pantalla.
  assert.equal(esDelTrato(44, null, [RENOVACION]), true);
  assert.equal(esDelTrato(null, null, [RENOVACION]), true, 'sin funnel, la casa');
  assert.equal(esDelTrato('29', RENOVACION, [RENOVACION]), true, 'el id que viene como texto de la base también');
  assert.equal(esDelTrato(RENOVACION, null, [RENOVACION]), false);
});

// Rotura: `leadConTrato` que deja el monto de la casa (`monto_cierre_usd: lead.monto_cierre_usd`): 9 / 2 (éste y el de abajo).
test('mirando la renovación, la venta y el plan son los de ESE CRM, nunca los de la casa', () => {
  const lead = { id: 28, nombre: 'Cliente', estado_lead: 'ganado', venta_tipo: 'unico', monto_cierre_usd: 7500, fecha_cierre: '2026-06-03', cobro_inicial_usd: null, monto_cuota_usd: 2500, total_cuotas: 3, dia_de_pago: 9, suscripcion_monto_usd: null, suscripcion_meses: null, total_cobrado_usd: 7500 };
  const vacio = leadConTrato(lead, { ...camposDeFila(null), etapa: 'lead' });
  assert.equal(vacio.monto_cierre_usd, null, 'sin venta cargada en la renovación');
  assert.equal(vacio.total_cuotas, null, 'sin plan: arranca de cero');
  assert.equal(vacio.estado_lead, null, 'no está ganado en ese CRM');
  assert.equal(vacio.nombre, 'Cliente', 'la persona es la misma');
  const t: CamposTrato & { etapa: string } = { ...camposDeFila({ venta_tipo: 'unico', monto_cierre_usd: '7000.00', fecha_cierre: '2026-10-22', total_cuotas: 3, monto_cuota_usd: '2333.33', dia_de_pago: 4 }), etapa: 'ganado' };
  const ganado = leadConTrato(lead, t);
  assert.deepEqual([ganado.monto_cierre_usd, ganado.total_cuotas, ganado.monto_cuota_usd, ganado.dia_de_pago, ganado.estado_lead], [7000, 3, 2333.33, 4, 'ganado']);
  assert.equal(leadConTrato(lead, null).monto_cierre_usd, null, 'sin trato leído, nunca la venta de la casa');
});

// Rotura: `cobrosDelTrato` que devuelve todos los cobros: 11 / 1 (con este test, la base es 12 / 0).
test('los movimientos de una renovación sólo traen los cobros de la pasarela de SUS cuotas', () => {
  const cobros = [{ id: 7, pago_id: 43 }, { id: 8, pago_id: 90 }, { id: 9, pago_id: null }, { id: 10, pago_id: null }];
  const deLaRenovacion = [{ id: 90, cobro_id: null }, { id: 91, cobro_id: 10 }];
  assert.deepEqual(cobrosDelTrato(cobros, deLaRenovacion).map((c) => c.id), [8, 10], 'el link de su cuota y el que quedó asentado en otra');
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx')), /const deEste = ctx\.crm \? cobrosDelTrato\(cobros \?\? \[\], ctx\.data\.pagos\) : cobrosSinLosDe\(cobros \?\? \[\], \(ctx\.data\.tratos \?\? \[\]\)\.flatMap\(\(t\) => t\.pagos\)\);/);
});

// Roturas: `ctxDelTrato` que deja `data.pagos` (las de la casa): 10 / 1. `crmEnVista` sin mirar la casa ni los tratos: 10 / 1.
test('la ficha mirando la renovación: sus pagos, su etapa, y releer en vez de parchear el lead', () => {
  const ren = cuota(90, 1, RENOVACION, { pagado: false, fecha_pago: null });
  const releidas: string[] = [];
  const base = {
    lead: { id: 28, estado_lead: 'ganado', monto_cierre_usd: 7500 }, etapa: 'ganado', hoy: '2026-10-22',
    data: { pagos: DEL_VSL, tratos: [{ ...camposDeFila(null), funnelId: RENOVACION, etapa: 'lead', pagos: [ren] }] },
    releer: () => releidas.push('releer'), parchear: () => releidas.push('parchear'), crm: null,
  } as unknown as CtxFicha;
  assert.equal(ctxDelTrato(base), base, 'mirando la casa, nada cambia');
  const enRen = ctxDelTrato({ ...base, crm: { id: RENOVACION, nombre: 'Renovación' } });
  assert.deepEqual(enRen.data.pagos.map((p) => p.id), [90]);
  assert.equal(enRen.etapa, 'lead');
  assert.equal(enRen.lead.monto_cierre_usd, null);
  enRen.parchear({ monto_cierre_usd: 1 });
  assert.deepEqual(releidas, ['releer'], 'un parche iría a la fila del lead: se relee');

  const foto = [{ id: CASA, nombre: 'Negocio que ESCALA' }, { id: RENOVACION, nombre: 'Renovación' }, { id: 44, nombre: 'Sprint 3 días' }];
  const vista = (id: number, esCasa: boolean, esta: boolean) => ({ id, nombre: foto.find((f) => f.id === id)!.nombre, esCasa, esta });
  assert.deepEqual(crmEnVista({ vista: vista(RENOVACION, false, true), idEnVista: RENOVACION, casaId: CASA, foto }, base.data), { id: RENOVACION, nombre: 'Renovación' });
  assert.equal(crmEnVista({ vista: vista(CASA, true, true), idEnVista: CASA, casaId: CASA, foto }, base.data), null, 'la casa');
  assert.equal(crmEnVista({ vista: vista(44, false, false), idEnVista: 44, casaId: CASA, foto }, base.data), null, 'un CRM donde no está');
  assert.equal(crmEnVista({ vista: null, idEnVista: null, casaId: CASA, foto }, base.data), null);
});

// Roturas: `fechaEnPalabras` con el mes base 0 (`MESES_LARGOS[Number(m[2])]`): 10 / 1. `ddmm` de vuelta a «01/04»: 10 / 1.
test('P3: las fechas de las cuotas dicen «1 de abril», con el año sólo si no es el de hoy', () => {
  assert.equal(fechaEnPalabras('2026-10-04', '2026-10-22'), '4 de octubre');
  assert.equal(fechaEnPalabras('2025-12-31', '2026-01-02'), '31 de diciembre de 2025');
  assert.equal(fechaEnPalabras('2026-04-01'), '1 de abril de 2026', 'sin hoy, con el año');
  assert.equal(fechaEnPalabras(null), '—');
  assert.equal(ddmm('2026-04-01'), '1 de abril');
  const r = renglonDeCuota({ ...DEL_VSL[0], proveedor: null, metodo: 'transferencia' } as Parameters<typeof renglonDeCuota>[0], '2026-10-22');
  assert.equal(r.cuando, 'cobrada el 1 de abril · transferencia');
  const vence = renglonDeCuota({ ...DEL_VSL[0], pagado: false, fecha_pago: null, fecha_esperada: '2026-11-04' } as Parameters<typeof renglonDeCuota>[0], '2026-10-22');
  assert.equal(vence.cuando, 'vence el 4 de noviembre · en 13 días');
});

// La renovación vacía: el estado de cuenta no dice nada que no sea suyo (el «Pagó todo» del VSL era del primer servicio).
test('el estado de cuenta de una renovación sin plan no muestra lo cobrado del primer servicio', () => {
  const l = leadConTrato({ id: 28, estado_lead: 'ganado', monto_cierre_usd: 7500, venta_tipo: 'unico' }, { ...camposDeFila(null), etapa: 'ganado' });
  const c = cobradoDelLead({ ventaTipo: l.venta_tipo as 'unico', montoCierreUsd: l.monto_cierre_usd ?? null, suscripcionMontoUsd: null, suscripcionMeses: null, fechaCierre: null, pagos: [], cobros: [], hoy: '2026-10-22' });
  const e = estadoDeCuenta({ cobrado: c, pagos: [], ganado: true, hoy: '2026-10-22' });
  assert.notEqual(e?.titular, 'Pagó todo');
});

// Roturas: `armarCobranza` sin `funnelId`: 10 / 1. El bloque de General filtrando por pertenencia (`deQuien`) aunque la
// fila traiga su CRM: 10 / 1.
test('P1: «A quién cobrarle» va por CRM: una fila por trato, y el bloque filtra por el CRM de la fila', () => {
  const item = (lead: number, funnel: number, pagoId: number) => ({ lead_id: lead, lead_nombre: `L${lead}`, vendido_usd: 7000, cobrado_usd: 0, pendiente_usd: 2333, proxima_cuota: { pago_id: pagoId, numero: 1, monto_usd: 2333, fecha_esperada: '2026-11-04' }, dias_desde_cierre: 0, fecha_cierre: null, crm: funnel === CASA ? null : funnel, funnel_id: funnel });
  const { filas } = armarCobranza([item(28, CASA, 1), item(28, RENOVACION, 2)], '2026-10-22');
  assert.deepEqual(filas.map((f) => f.funnelId).sort(), [CASA, RENOVACION]);
  const m = filas.map((f) => cobroDeFila(f, (n) => `$${n}`));
  assert.deepEqual(m.map((x) => x?.funnelId).sort(), [CASA, RENOVACION], 'el renglón del teléfono y de General lo lleva');
  const bloque = sinComentarios(leer('app/general/bloques/Negocio.tsx'));
  assert.match(bloque, /c\.funnelId != null \? elegidos\.includes\(c\.funnelId\)/);
});

// Rotura: `funnelsDeLaHoja` sin `conVista` (ignora lo elegido mirando): 10 / 1.
test('P1: el «Funnel» de arriba de la hoja llega a «A quién cobrarle», y la plantilla «Cobranza» nace con él', () => {
  const hoja = { controles: [{ id: 'p', tipo: 'periodo' }, { id: 'f', tipo: 'lista', campo: 'producto', valores: null, texto: '' }] } as unknown as Hoja;
  assert.equal(funnelsDeLaHoja(hoja, {}), null, 'en «Todos», nada');
  assert.deepEqual(funnelsDeLaHoja(hoja, { f: { valores: ['Renovación', 'Sprint 3 días'] } }), ['Renovación', 'Sprint 3 días']);
  const prov = sinComentarios(leer('app/general/ProveedorGeneral.tsx'));
  assert.match(prov, /case 'cobranza': return <BloqueCobranza d=\{d\.cobranza\} elegidos=\{funnelsDeCobranza\(g, d, hoja\)\}/);
  assert.match(prov, /const propios = funnelsDeBloque\(g\);\s*if \(propios\.length \|\| !hoja\?\.funnels\?\.length \|\| !d\.funnels\.ok\) return propios;/, 'los propios del bloque mandan; si no, los de la hoja');
  assert.match(sinComentarios(leer('app/dashboard/Elemento.tsx')), /<ElementoGeneral e=\{e\} hoja=\{ctx\?\.hoja \?\? null\} vista=\{ctx\?\.vista \?\? null\} \/>/);
  const plantillas = sinComentarios(leer('lib/graficos-plantillas-generales.ts'));
  const cobros = plantillas.slice(plantillas.indexOf("id: 'cobranza'"), plantillas.indexOf("id: 'automatizaciones'"));
  assert.match(cobros, /controles: \[\{ tipo: 'lista', campo: 'producto', valores: null \}\]/);
  // Y el desplegable ofrece TODOS los CRMs, también los que todavía no tienen pagos (la renovación antes de su primer cobro).
  assert.match(sinComentarios(leer('lib/graficos-datos.ts')), /if \(campo\.id === 'producto'\) \{\s*const prods = await productosCrm\(\)/);
  // El conjunto «Clientes por cobrar» del Dashboard también se filtra por Funnel.
  assert.match(sinComentarios(leer('lib/graficos-catalogo.ts')), /\{ id: 'producto', nombre: 'Funnel', en: \{[^}]*cobranza: 'producto' \} \}/);
});

// Roturas: `getPagosByLead` sin la exclusión de los agregados en la casa (`if (agregados.length < 0)`): 10 / 1. La cuota
// nueva de un CRM agregado sin su `funnel_id`: 10 / 1.
test('el server lee y escribe POR CRM: la casa sin los agregados, y lo nuevo de un agregado lleva su CRM', () => {
  const pagos = sinComentarios(leer('lib/pagos.ts'));
  assert.match(pagos, /export async function getPagosByLead\(leadId: number, crm: Crm \| 'todos' = null\)/);
  assert.match(pagos, /const agregados = await crmsAgregadosDelLead\(leadId\);\s*if \(agregados\.length\) q = q\.or\(`funnel_id\.is\.null,funnel_id\.not\.in\.\(\$\{agregados\.join\(','\)\}\)`\)/);
  assert.match(pagos, /fecha_esperada: i\.fecha_esperada, \.\.\.\(crm != null \? \{ funnel_id: crm \} : \{\}\) \}\)\);/);
  assert.match(pagos, /lead_id: leadId, numero: base \+ 1, \.\.\.\(crm != null \? \{ funnel_id: crm \} : \{\}\),/);
  // El plan de un CRM agregado va a su fila de lead_funnel, no a `leads`.
  assert.match(pagos, /from\('lead_funnel'\)\.update\(\{ \.\.\.columnas, updated_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('id', t\.id\)/);
  // Lo cobrado del lead (`total_cobrado_usd`) es lo de TODOS sus CRMs, como antes (revisión del 22/10/2026).
  assert.match(pagos, /const \[todos, agregados\] = await Promise\.all\(\[getPagosByLead\(leadId, 'todos'\), crmsAgregadosDelLead\(leadId\)\]\);\s*const pagados = todos\.filter\(\(p\) => p\.pagado\);/);
});

// Rotura: `agregarCuotaAction` con el `crm` del navegador sin `crmDelTrato`: 10 / 1.
test('cada acción de la tab valida el CRM contra el lead antes de escribir', () => {
  const campo = sinComentarios(leer('app/crm/[id]/pagos-campo-actions.ts'));
  assert.match(campo, /crm: await crmDelTrato\(leadId, opts\.crm\)/, 'la venta');
  // Entre los dos, desde el 29/10, sólo la lectura de lo de antes para el Deshacer del plan por tramos (`loDeAntes`, con el trato).
  assert.match(campo, /const trato = await crmDelTrato\(leadId, crm\);\s*(?:\/\/[^\n]*\n\s*)*(?:const antes = como\?\.conDeshacer \? await loDeAntes\(leadId, trato\) : null;\s*)?const cambios = await guardarCuotasPorId/, 'las cuotas');
  assert.match(campo, /const trato = await crmDelTrato\(leadId, crm\);\s*const delCrm/, 'el plan');
  const cuotas = sinComentarios(leer('app/crm/lead-view/ficha/pagos/cuotas-actions.ts'));
  assert.equal((cuotas.match(/crmDelTrato\(leadId, crm\)/g) ?? []).length, 3, 'quitar, la baja y agregar');
  assert.match(sinComentarios(leer('app/crm/[id]/deal-actions.ts')), /registrarPagoSuelto\(leadId, \{ \.\.\.datos, crm: await crmDelTrato\(leadId, datos\.crm\) \}\)/);
});

// Rotura: las cuotas sin `delTrato` en el registro: 10 / 1.
test('los bloques de plata de Pagos dibujan y escriben el trato del CRM que se mira', () => {
  const reg = sinComentarios(leer('app/crm/lead-view/ficha/registro-pagos.tsx'));
  for (const b of ['venta: delTrato(Venta', 'cobrado: delTrato(EstadoDeCuenta', 'cuotas: delTrato(Cuotas', 'movimientos: delTrato(Movimientos', 'suscripcion: delTrato(Suscripcion']) {
    assert.ok(reg.includes(b), b);
  }
  const bloques = sinComentarios(leer('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'));
  assert.match(bloques, /quitarCuotaAction\(lead\.id, q\.id, crm\)/);
  assert.match(bloques, /bajaDelClienteAction\(lead\.id, deshacer, crm\)/);
  // El plan (por tramos desde el 29/10) se guarda en el trato que se mira.
  assert.match(bloques, /function ArmarPlan\([^\n]*\n\s+const l = ctx\.lead;\n\s+const crm = ctx\.crm\?\.id \?\? null;/);
  assert.match(bloques, /guardarCuotasAction\(l\.id, \[\.\.\.cuotas, \.\.\.aparte\], columnas, vistos, crm, /);
  assert.match(bloques, /guardarVentaAction\(lead\.id, c, \{ tipoVisto: tipo, crm \}\)/);
  const cobrar = sinComentarios(leer('app/crm/lead-view/ficha/pagos/cobrar.tsx'));
  assert.match(cobrar, /agregarCuotaAction\(ctx\.lead\.id, \{ monto: m, fecha \}, ctx\.crm\?\.id \?\? null\)/);
  assert.match(cobrar, /<RegistrarPago leadId=\{lead\.id\} crm=\{crm\}/);
  // Las dos puertas de la ficha le pasan el CRM que se mira.
  assert.match(sinComentarios(leer('app/crm/LeadSheet.tsx')), /crm=\{crmEnVista\(fichaProd, vigente\)\}/);
  assert.match(sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx')), /crm=\{crmEnVista\(fichaProd, data\)\}/);
});

// Rotura: la 0324 con el índice nuevo sin `unique`: 10 / 1.
test('la migración 0324: cuotas numeradas por CRM, lo que nace sin CRM va a la casa, y nada cambia de CRM', () => {
  const sql = leer('supabase/migrations/0324_pagos_por_crm.sql');
  assert.match(sql, /create unique index if not exists idx_pagos_lead_crm_numero on pagos \(lead_id, coalesce\(funnel_id, 0\), numero\);/);
  assert.match(sql, /drop index if exists idx_pagos_lead_numero;/);
  const trigger = sql.slice(sql.indexOf('create or replace function pagos_funnel_del_momento'));
  assert.doesNotMatch(trigger, /lead_funnel/, 'sin CRM dicho no se adivina el último agregado');
  assert.match(trigger, /select p\.funnel_id into new\.funnel_id from pagos p where p\.id = new\.resto_de;/);
  assert.doesNotMatch(sql, /update pagos/i, 'ningún pago cambia de CRM');
  assert.equal(faltaIndicePorCrm({ code: '23505', message: 'duplicate key value violates unique constraint "idx_pagos_lead_numero"' }), true);
  assert.equal(faltaIndicePorCrm({ code: '23505', message: 'duplicate key value violates unique constraint "idx_pagos_lead_crm_numero"' }), false);
});
