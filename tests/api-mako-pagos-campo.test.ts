// =============================================================================
// Pagos campo por campo en la API de MaKo (área `cobros`, 14/10/2026)
// =============================================================================
// AGENTS.md: toda capacidad nueva va a la API de MaKo. Lo que escriben los bloques de la tab Pagos
// (app/crm/[id]/pagos-campo-actions.ts) sale también por acá, con la MISMA escritura (lib/pagos.ts). Se fija:
//   1. la forma: nueve operaciones, las que escriben por chat (UNA entidad identificada, el valor en el resumen),
//      la moneda y el estado de una suscripción sólo para el admin, nada que cueste `dinero`, y el id de una cuota
//      se llama `cuotaId` (en esta área `pagoId` no existe: un modelo lo cruzaría con un cobroId);
//   2. su URL REST;
//   3. UNA implementación: los runners y las acciones de la ficha llaman a las mismas funciones de lib/pagos.ts,
//      y el runner no escribe `leads` ni `pagos` por su cuenta;
//   4. lo que protege a una cuota se revisa FAIL-CLOSED también en preparar();
//   5. `cobranza_lead` cuenta lo cobrado con `cobradoDelLead`, la función de la ficha.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte.
// Con el código como está: 6 pases, 0 fallos. Rota (pases / fallos):
//   · editar_cuota con confirmación 'pantalla'                                          → 5 / 1
//   · el parámetro `cuotaId` llamado `pagoId`                                           → 5 / 1
//   · estado_suscripcion_manual con `gating: G_TAB` (cualquiera de la ficha)            → 5 / 1
//   · el runner de editar_dato_deal con un `.from('leads').update(` propio              → 5 / 1
//   · preparar() de editar_cuota sin el `if (!protMapa) return` (fail-open)             → 5 / 1
//   · cobranza_lead sin leer los cobros (`Promise.resolve([])`)                         → 5 / 1
//   · guardarMonedaNegocioAction sin `esAdmin()`                                        → 5 / 1
// Correr: npx tsx --test tests/api-mako-pagos-campo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porArea, porId, visible, type Vista } from '../lib/api-mako/registro';
import { esAccion, esLectura, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ACCIONES = ['cambiar_moneda_negocio', 'editar_dato_deal', 'editar_obligacion_deal', 'editar_venta_lead', 'editar_cuota', 'crear_link_cuota', 'cortar_recordatorio_cuota', 'estado_suscripcion_manual'];
const accion = (id: string): AccionDef => {
  const d = porId(id);
  assert.ok(d && esAccion(d), `«${id}» no es una acción del registro`);
  return d;
};

test('la forma: por chat, sin `dinero`, el admin para la config y la suscripción, y `cuotaId` (nunca `pagoId`)', () => {
  const lectura = porId('ver_moneda_negocio');
  assert.ok(lectura && esLectura(lectura) && lectura.costo === 'gratis' && lectura.area === 'cobros');
  for (const id of ACCIONES) {
    const d = accion(id);
    assert.equal(d.area, 'cobros', id);
    assert.equal(d.confirmacion, 'chat', `${id}: es UNA entidad identificada y el resumen dice el valor exacto`);
    assert.notEqual(d.costo, 'dinero', `${id} no mueve plata del cliente`);
    assert.ok(!d.parametros.some((p) => p.nombre === 'pagoId'), `${id}: en cobros el id de una cuota es cuotaId`);
    for (const p of d.parametros) assert.ok(p.rotulo?.trim(), `${id}.${p.nombre} sin rótulo`);
  }
  assert.equal(accion('crear_link_cuota').costo, 'externo', 'crea un checkout en Stripe');
  for (const id of ['editar_cuota', 'crear_link_cuota', 'cortar_recordatorio_cuota']) {
    const c = accion(id).parametros.find((p) => p.nombre === 'cuotaId');
    assert.ok(c && c.obligatorio && c.rotulo === 'Cuota', `${id}: cuotaId obligatorio con su rótulo`);
  }
  // La config del negocio y el estado de una suscripción: sólo el admin. Lo demás, cualquiera de la ficha.
  const miembro: Vista = { canal: 'app', alcance: 'ejecutar', ws: 9, rol: 'miembro', tabs: null };
  for (const id of ['cambiar_moneda_negocio', 'estado_suscripcion_manual']) {
    assert.deepEqual(accion(id).gating, { tab: 'crm', rolMinimo: 'admin' }, id);
    assert.equal(visible(porId(id)!, miembro), false, `${id}: un closer no lo ve`);
  }
  for (const id of ['editar_dato_deal', 'editar_cuota', 'editar_venta_lead']) assert.equal(visible(porId(id)!, miembro), true, id);
  // Los datos del deal salen del mismo catálogo que la escritura (lib/pagos-campo.ts), no de una copia.
  const campo = accion('editar_dato_deal').parametros.find((p) => p.nombre === 'campo');
  for (const c of ['razon', 'correo', 'que_es', 'fecha_termino', 'garantia', 'fecha_inicio_servicio', 'facturado_por_id']) assert.ok(campo?.enum?.includes(c), `falta «${c}»`);
  assert.ok(!campo?.enum?.includes('doc_path'), 'el documento fiscal lo escribe la subida, no un campo');
  assert.equal(porArea('cobros').filter((d) => [...ACCIONES, 'ver_moneda_negocio'].includes(d.id)).length, 9);
});

test('cada una tiene su URL REST bajo /cobros', () => {
  assert.deepEqual(rutaRestDe('ver_moneda_negocio'), { metodo: 'GET', ruta: '/cobros/moneda' });
  assert.deepEqual(rutaRestDe('cambiar_moneda_negocio'), { metodo: 'PUT', ruta: '/cobros/moneda' });
  assert.deepEqual(rutaRestDe('editar_dato_deal'), { metodo: 'PATCH', ruta: '/cobros/deals/{leadId}' });
  assert.deepEqual(rutaRestDe('editar_cuota'), { metodo: 'PATCH', ruta: '/cobros/cuotas/{cuotaId}' });
  assert.deepEqual(rutaRestDe('crear_link_cuota'), { metodo: 'POST', ruta: '/cobros/cuotas/{cuotaId}/links-pago' });
  assert.deepEqual(rutaRestDe('cortar_recordatorio_cuota'), { metodo: 'DELETE', ruta: '/cobros/cuotas/{cuotaId}/recordatorios' });
});

test('⚠️ UNA implementación: el runner y la ficha llaman a la misma escritura de lib/pagos.ts', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const acc = leer('app/crm/[id]/pagos-campo-actions.ts');
  for (const fn of ['escribirCampoDeal(', 'escribirObligacion(', 'escribirVenta(', 'editarCuota(', 'cortarRecordatoriosDeCuota(', 'cambiarEstadoSuscripcionManual(', 'guardarMonedaDelNegocio(']) {
    assert.ok(run.includes(fn), `el runner no llama a ${fn}`);
    assert.ok(acc.includes(fn), `la ficha no llama a ${fn}`);
  }
  // El runner no escribe por su cuenta: ni leads ni cuotas (una segunda implementación saltea el merge y el CAS).
  assert.doesNotMatch(run, /from\('(leads|pagos)'\)\s*\.(update|insert|delete|upsert)\(/);
  // El link de una cuota es el de crearCobro, con la cuota que pidió la persona.
  assert.match(run, /crearCobro\(ctx\.ws, \{\s*leadId: Number\(payload\.leadId\),\s*pagoId: Number\(payload\.cuotaId\),/);
});

test('⚠️ preparar() de editar_cuota revisa la protección FAIL-CLOSED y la venta prueba los cambios en orden', () => {
  const run = leer('lib/api-mako/areas/cobros.run.ts');
  const ed = run.slice(run.indexOf('  editar_cuota: {'), run.indexOf('  crear_link_cuota: {'));
  assert.ok(ed.length > 300 && ed.length < 6000, `recorte de editar_cuota: ${ed.length}`);
  assert.match(ed, /const protMapa = await proteccionesDeCuotas\(lead\.id, \[q\.id\]\)\.catch\(\(\) => null\);\s*if \(!protMapa\) return \{ error:/);
  const ve = run.slice(run.indexOf('  editar_venta_lead: {'), run.indexOf('  editar_cuota: {'));
  assert.match(ve, /for \(const c of cambios\) \{\s*const p = patchDeVenta\(fila, c,/, 'el monto después de pasar a suscripción es la mensualidad: se prueba sobre la fila ya cambiada');
  assert.match(ve, /Object\.assign\(fila, p\.patch\)/);
  assert.match(ve, /tipoVisto = r\.ventaTipo;/, 'el compare-and-set del segundo cambio es el tipo que dejó el primero');
});

test('cobranza_lead cuenta lo cobrado con la función de la ficha', () => {
  const crm = leer('lib/api-mako/areas/crm.run.ts');
  const cl = crm.slice(crm.indexOf('  cobranza_lead: {'), crm.indexOf('  insight_lead: {'));
  assert.ok(cl.length > 300, `recorte de cobranza_lead: ${cl.length}`);
  assert.match(cl, /const cob = cobradoDelLead\(\{/);
  assert.match(cl, /listarCobros\(ctx\.ws, \{ leadId: lead\.id/, 'sin los cobros no ve una renovación rechazada');
  assert.match(cl, /cobrado: \{\s*texto: cob\.texto, estado: cob\.semaforo\.texto/);
});

test('la ficha corta la moneda y el estado de la suscripción al que no es admin', () => {
  const acc = leer('app/crm/[id]/pagos-campo-actions.ts');
  for (const fn of ['guardarMonedaNegocioAction', 'cambiarEstadoSuscripcionAction']) {
    const ini = acc.indexOf(`export async function ${fn}(`);
    const cuerpo = acc.slice(ini, acc.indexOf('\nexport ', ini + 10));
    assert.match(cuerpo, /if \(!\(await esAdmin\(\)\)\) return \{ ok: false, error: SOLO_ADMIN \}/, `${fn}: es config o estado de cobro, sólo el admin`);
  }
  // Y una suscripción que cobra la pasarela no se «cancela» en el CRM mientras la tarjeta se sigue cobrando.
  const est = acc.slice(acc.indexOf('export async function cambiarEstadoSuscripcionAction('));
  assert.match(est, /c\.tipo === 'suscripcion' && c\.estado === 'pagado' && c\.suscripcion_estado !== 'cancelada'/);
});
