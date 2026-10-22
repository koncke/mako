// =============================================================================
// «Vincular cobro» en el ⋯ de Ganado (22/10/2026, mig 0326): un producto vinculado a la etapa Ganado de un CRM; quien
// lo paga pasa a Ganado EN ESE CRM, con el pago en ese trato y su plan si va en cuotas.
// =============================================================================
// Las reglas se EJECUTAN (lib/cobro-etapa.ts); el camino del pago y las puertas se leen del fuente (lib/cobros.ts,
// lib/pagos.ts, lib/cobro-etapa-server.ts, app/crm/cobro-etapa-actions.ts).
// Probado ROMPIÉNDOLO (22/10/2026): cada test dice su rotura y cuántos fallos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  congelarPlan, cuentaDelCobro, cuentasDePasarelas, cuentasValidas, patchDeEdicion, planCongeladoDe, planDelCobro, planDelProducto, productoDeFila,
  productoValido, proveedorDeCuenta, vinculoDelPago,
  type PlanCongelado, type VinculoCobro,
} from '../lib/cobro-etapa';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Roturas: redondear la cuota para ARRIBA (Math.ceil): 1 fallo. El inicial igual a la cuota (sin el resto): 1 fallo.
test('un producto en cuotas: el link cobra el inicial y la suma da EXACTO el precio', () => {
  const p = planDelProducto({ tipo: 'unico', montoUsd: 1000, cuotas: 3 }, 22);
  assert.deepEqual(p, { primerPagoUsd: 333.34, plan: { cobro_inicial_usd: 333.34, monto_cuota_usd: 333.33, total_cuotas: 2, dia_de_pago: 22 } });
  for (const [monto, n] of [[1000, 3], [997, 7], [0.05, 2], [12345.67, 6], [100, 2]] as const) {
    const { plan } = planDelProducto({ tipo: 'unico', montoUsd: monto, cuotas: n }, 1);
    assert.ok(plan);
    const suma = Math.round((plan.cobro_inicial_usd + plan.monto_cuota_usd * plan.total_cuotas) * 100);
    assert.equal(suma, Math.round(monto * 100), `${monto} en ${n}: suma ${suma / 100}`);
    assert.ok(plan.cobro_inicial_usd >= plan.monto_cuota_usd, 'el inicial se lleva el resto, nunca menos que una cuota');
    assert.ok(plan.total_cuotas >= 1 && plan.total_cuotas <= 6, 'el CHECK de la 0014');
  }
  assert.deepEqual(planDelProducto({ tipo: 'unico', montoUsd: 500, cuotas: null }, 5), { primerPagoUsd: 500, plan: null }, 'sin cuotas: el precio');
  assert.deepEqual(planDelProducto({ tipo: 'suscripcion', montoUsd: 50, cuotas: 3 }, 5), { primerPagoUsd: 50, plan: null }, 'una suscripción no va en cuotas');
  assert.equal(planDelProducto({ tipo: 'unico', montoUsd: 1000, cuotas: 3 }, 31).plan?.dia_de_pago, 28, 'las cuotas vencen hasta el 28');
  assert.deepEqual(planDelProducto({ tipo: 'unico', montoUsd: null, cuotas: 3 }, 5), { primerPagoUsd: null, plan: null });
});

// Roturas: `vinculoDelPago` sin mirar la cuenta: 1 fallo. Sin cortar la renovación: 1 fallo.
test('un pago va al CRM del vínculo sólo si su producto está vinculado POR ESA cuenta, y sólo el primero', () => {
  const v: VinculoCobro = { id: 1, funnelId: 29, etapa: 'ganado', productoId: 7, cuentas: ['mercadopago:principal'] };
  const cobro = { producto_id: 7, pago_id: null, proveedor: 'mercadopago' as const };
  assert.equal(vinculoDelPago(cobro, [v], { renovacion: false }), v);
  assert.equal(vinculoDelPago({ ...cobro, proveedor: 'stripe' }, [v], { renovacion: false }), null, 'por Stripe no está vinculado');
  assert.equal(vinculoDelPago(cobro, [v], { renovacion: true }), null, 'una renovación es plata de un trato que ya existe');
  assert.equal(vinculoDelPago({ ...cobro, pago_id: 55 }, [v], { renovacion: false }), null, 'el link de una cuota ya sabe su trato');
  assert.equal(vinculoDelPago({ ...cobro, producto_id: 8 }, [v], { renovacion: false }), null);
  assert.equal(cuentaDelCobro({ proveedor: 'stripe' }), 'stripe:principal');
});

// Roturas: `cuentasValidas` sin filtrar por las conectadas: 1 fallo.
test('las cuentas: sólo ids con forma y de las conectadas, sin repetir', () => {
  const conectadas = cuentasDePasarelas(['stripe']);
  assert.deepEqual(conectadas, [{ id: 'stripe:principal', proveedor: 'stripe', nombre: 'Stripe', principal: true }]);
  assert.deepEqual(cuentasValidas(['stripe:principal', 'stripe:principal', 'mercadopago:principal', 'x', 3, 'stripe:../a'], conectadas), ['stripe:principal']);
  assert.equal(proveedorDeCuenta('mercadopago:principal'), 'mercadopago');
  assert.equal(proveedorDeCuenta('paypal:principal'), null);
  assert.equal(proveedorDeCuenta('stripe:'), null);
});

// Roturas: aceptar cuotas en una suscripción: 1 fallo. Aceptar 8 cuotas: 1 fallo.
test('un producto del modal: precio con dos decimales, cuotas de 1 a 7 sólo en un pago único', () => {
  assert.deepEqual(productoValido({ nombre: '  Mentoría   6 meses ', tipo: 'unico', montoUsd: 1000, cuotas: 3 }),
    { ok: true, fila: { nombre: 'Mentoría 6 meses', tipo: 'unico', monto_usd: 1000, suscripcion_meses: null, cuotas: 3 } });
  assert.deepEqual(productoValido({ nombre: 'X', tipo: 'unico', montoUsd: 10, cuotas: 1 }), { ok: true, fila: { nombre: 'X', tipo: 'unico', monto_usd: 10, suscripcion_meses: null, cuotas: null } }, 'una cuota es un pago');
  assert.equal(productoValido({ nombre: 'X', tipo: 'suscripcion', montoUsd: 10, cuotas: 3 }).ok, false);
  assert.equal(productoValido({ nombre: 'X', tipo: 'unico', montoUsd: 10, cuotas: 8 }).ok, false);
  assert.equal(productoValido({ nombre: 'X', tipo: 'unico', montoUsd: 10.005 }).ok, false);
  assert.equal(productoValido({ nombre: 'X', tipo: 'unico', montoUsd: 0 }).ok, false);
  assert.equal(productoValido({ nombre: '   ', tipo: 'unico', montoUsd: 10 }).ok, false);
  assert.deepEqual(productoValido({ nombre: 'S', tipo: 'suscripcion', montoUsd: 50, suscripcionMeses: 6 }), { ok: true, fila: { nombre: 'S', tipo: 'suscripcion', monto_usd: 50, suscripcion_meses: 6, cuotas: null } });
  assert.equal(productoDeFila({ id: '3', nombre: 'P', tipo: 'unico', monto_usd: '99.5', cuotas: 1 }).cuotas, null, 'sin la 0326 o con 1: un pago');
});

// Roturas: registrar el pago SIN `crm: trato?.pagoEn`: 1 fallo. Ganar la casa aunque el vínculo sea de otro CRM: 1 fallo.
// Preparar el trato DESPUÉS de asentar el pago: 1 fallo.
test('el pago de un producto vinculado entra en el trato de ESE CRM y gana ahí', () => {
  const c = sinComentarios(leer('lib/cobros.ts'));
  const prep = c.indexOf('trato = await prepararTratoDelPago(actual, { renovacion, fecha });');
  const asiento = c.indexOf('const r = await registrarCobroDeProveedor({');
  assert.ok(prep > 0 && asiento > prep, 'el trato se prepara ANTES de asentar el pago (la cuota 0 tiene que existir)');
  assert.match(c, /pagoId: renovacion \? null : \(actual\.pago_id \?\? trato\?\.pagoId \?\? null\), crm: trato\?\.pagoEn \?\? null,/);
  assert.match(c, /if \(actual\.lead_id && \(!trato \|\| trato\.ganaEnCasa\)\) await ganarLead\(actual, autor, plazo, trato\?\.montoVenta \?\? null\);/);
  assert.match(c, /if \(actual\.lead_id && trato\?\.ganaEnCrm\) await ganarEnSuCrm\(actual, trato\.ganaEnCrm, autor\);/);
  assert.match(c, /monto: c\.tipo === 'unico' \? \(montoVenta \?\? c\.monto_usd\) : null,/, 'en cuotas gana por el PRECIO, no por el primer pago');
  assert.match(c, /const cp = prod\.tipo === 'suscripcion' \? null : await cobroDelProducto\(prod\.id\);\s*primero = cp\?\.primerPagoUsd \?\? null;\s*congelado = cp\?\.congelado \?\? null;/, 'el link cobra el primer pago y congela el plan');
  assert.match(c, /\.\.\.\(congelado \? \{ plan_producto: congelado \} : \{\}\),/, 'el plan congelado va en el cobro');
});

// Roturas: casar por monto contra la casa también con `crm`: 1 fallo. Insertar el pago nuevo sin el `crm`: 1 fallo.
test('asentar un pago de otro CRM: no salda una cuota de la casa, y nace en ese CRM', () => {
  const p = sinComentarios(leer('lib/pagos.ts'));
  assert.match(p, /let crmDeLaCuota: number \| null = p\.crm \?\? null;/);
  assert.match(p, /if \(!p\.pagoId && p\.crm == null\) \{/);
  assert.match(p, /\.\.\.\(crmDeLaCuota != null \? \{ funnel_id: crmDeLaCuota \} : \{\}\),/);
});

// Roturas: escribir la venta sin `.is('monto_cierre_usd', null)`: 1 fallo. Armar el plan sin preguntar si la venta es la de
// ESTE pago (`nuestra`): 1 fallo. Armar el plan aunque algo de ese trato ya esté cobrado: 1 fallo.
test('el trato de un pago nunca pisa una venta, y el reintento completa el MISMO plan y salda la MISMA cuota 0', () => {
  const s = sinComentarios(leer('lib/cobro-etapa-server.ts'));
  assert.match(s, /\.eq\('id', fila\.id\)\.is\('monto_cierre_usd', null\)\.select\('id'\);/);
  assert.match(s, /if \(plan && nuestra && !\(await getPagosByLead\(leadId, crm\)\)\.some\(\(q\) => q\.pagado\)\) \{\s*await ajustarPlanPagos\(leadId, plan, fecha, \{ crm \}\);/);
  // `nuestra`: la venta que dejó un intento anterior de este mismo pago (su precio y su fecha) cuenta como de este pago.
  assert.match(s, /Math\.abs\(fila\.monto_cierre_usd - montoVenta\) < 0\.01 && fila\.fecha_cierre === fecha;/);
  assert.match(s, /x\.numero === 0 && !x\.pagado && !x\.proveedor_pago_id && Math\.abs\(Number\(x\.monto_usd\) - montoUsd\) < 0\.01/);
  assert.match(s, /if \(c\.tipo === 'suscripcion'\) \{[\s\S]{0,200}return \{ \.\.\.base, pagoEn: null, pagoId: null, ganaEnCasa: true,/, 'una suscripción (la del COBRO) se queda en la casa');
});

// ── La revisión adversarial (22/10/2026) ──────────────────────────────────────────────────────────────────────────────

// Alta 1 · Roturas: `planDelCobro` con el plan de hoy en vez del congelado (ignorar `congelado`): 1 fallo. Sin pedir que
// el primer pago coincida con lo cobrado: 1 fallo.
test('alta 1: el plan sale de lo que COBRÓ el link (el congelado), no del producto de hoy', () => {
  const t = (monto: number, congelado: PlanCongelado | null) => planDelCobro({ tipo: 'unico', monto_usd: monto }, congelado, 22);
  // El link se creó con 3 cuotas y cobró el inicial; después le sacaron las cuotas al producto: el plan es el del link.
  assert.deepEqual(t(333.34, { precio: 1000, cuotas: 3 }), { plan: { cobro_inicial_usd: 333.34, monto_cuota_usd: 333.33, total_cuotas: 2, dia_de_pago: 22 }, montoVenta: 1000 });
  // El link se creó SIN cuotas (US$1.000 enteros) y después le pusieron 3: sin plan, la venta es lo cobrado.
  assert.deepEqual(t(1000, { precio: 1000, cuotas: null }), { plan: null, montoVenta: 1000 });
  // Un cobro de antes de la 0326 (sin congelar): lo que cobró, sin plan.
  assert.deepEqual(t(1000, null), { plan: null, montoVenta: 1000 });
  // Lo congelado no coincide con lo cobrado (otro monto a mano): sin plan, la venta es lo cobrado.
  assert.deepEqual(t(500, { precio: 1000, cuotas: 3 }), { plan: null, montoVenta: 500 });
  // El tipo es el del COBRO: una suscripción no arma plan aunque el producto hoy sea un pago único.
  assert.deepEqual(planDelCobro({ tipo: 'suscripcion', monto_usd: 50 }, { precio: 1000, cuotas: 3 }, 22), { plan: null, montoVenta: null });
  assert.deepEqual(congelarPlan({ montoUsd: 1000, cuotas: 3 }), { precio: 1000, cuotas: 3 });
  assert.deepEqual(planCongeladoDe({ precio: '1000.00', cuotas: 1 }), { precio: 1000, cuotas: null });
  assert.equal(planCongeladoDe('x'), null);
  const s = sinComentarios(leer('lib/cobro-etapa-server.ts'));
  assert.match(s, /planDelCobro\(\{ tipo: c\.tipo, monto_usd: c\.monto_usd \}, marca\.congelado,/, 'el trato usa el plan congelado del cobro');
});

// Alta 2 · Rotura: sin `ganadoDelCrm` (un CRM archivado vuelve a `agregarAProducto`): 1 fallo.
test('alta 2: un vínculo a un CRM archivado (o sin Ganado) no deja el pago afuera: entra en la casa y lo dice', () => {
  const s = sinComentarios(leer('lib/cobro-etapa-server.ts'));
  assert.match(s, /const g = await ganadoDelCrm\(v\.funnelId\);\s*if \(g\) ganaEnCrm = \{ crm: v\.funnelId, etapa: g\.etapa \};\s*else aviso = /);
  assert.match(s, /if \(ganaEnCrm\) \{\s*const crm = ganaEnCrm\.crm;\s*await agregarAProducto/, 'sólo un CRM usable se agrega');
  assert.match(sinComentarios(leer('lib/cobros.ts')), /if \(trato\?\.aviso && trato\.nuevo\) await logLeadEvent\(actual\.lead_id, 'Pago registrado', trato\.aviso, autor\);/);
});

// Medias 3 y 4 · Roturas: sin el reclamo (`trato_estado` compare-and-set): 1 fallo. El que pierde asienta igual en vez de
// tirar: 1 fallo.
test('medias 3 y 4: el trato se reclama antes de armarse; el que pierde relee o tira, y queda escrito al terminar', () => {
  const s = sinComentarios(leer('lib/cobro-etapa-server.ts'));
  assert.match(s, /\.update\(\{ trato_estado: 'armando', trato_at: ahora\.toISOString\(\) \}\)\s*\.eq\('id', c\.id\)\.or\(`trato_estado\.is\.null,and\(trato_estado\.eq\.armando,trato_at\.lt\.\$\{vencido\}\)`\)/);
  assert.match(s, /if \(!reclamo\) \{[\s\S]{0,240}throw new Error\('Otro aviso está armando el trato de este pago/);
  assert.match(s, /if \(marca\.estado === 'listo' && marca\.trato\) return tratoGuardado\(marca\.trato\);/, 'un trato listo no se vuelve a armar');
  assert.match(s, /update\(\{ trato_estado: 'listo', trato: guardar \}\)/);
  const m = leer('supabase/migrations/0326_cobro_en_ganado.sql');
  assert.match(m, /add column if not exists plan_producto jsonb,/);
  assert.match(m, /check \(trato_estado is null or trato_estado in \('armando', 'listo'\)\)/);
});

// Media 5 · Rotura: el reembolso sin dar de baja el plan que armó: 1 fallo.
test('media 5: devuelto el primer pago, las cuotas del plan que armó dejan de ser deuda', () => {
  const c = sinComentarios(leer('lib/cobros.ts'));
  assert.match(c, /const armado = await planArmadoPorElCobro\(c\.id\);\s*if \(armado\) \{\s*const \{ darDeBajaCliente \} = await import\('\.\/pagos-baja'\);\s*await darDeBajaCliente\(c\.lead_id, NOMBRE_PASARELA\[c\.proveedor\], armado\.pagoEn\);/);
});

// Media 6 · Rotura: editar con la fila entera de `productoValido` (sin `patchDeEdicion`): 1 fallo. Pisar el plazo sin que venga: 1 fallo.
test('media 6: editar un producto sin mandar el plazo o las cuotas no los borra', () => {
  const sus = { nombre: 'S', tipo: 'suscripcion' as const, montoUsd: 50 };
  const v = productoValido(sus);
  assert.ok(v.ok);
  assert.deepEqual(patchDeEdicion(sus, v.fila), { nombre: 'S', tipo: 'suscripcion', monto_usd: 50, cuotas: null }, 'sin `suscripcion_meses`: el plazo de 6 meses queda');
  const uni = { nombre: 'U', tipo: 'unico' as const, montoUsd: 900 };
  const u = productoValido(uni);
  assert.ok(u.ok);
  assert.deepEqual(patchDeEdicion(uni, u.fila), { nombre: 'U', tipo: 'unico', monto_usd: 900, suscripcion_meses: null }, 'sin `cuotas`: las 3 cuotas quedan');
  const con = { ...uni, cuotas: 3 };
  const w = productoValido(con);
  assert.ok(w.ok);
  assert.equal(patchDeEdicion(con, w.fila).cuotas, 3);
  assert.match(sinComentarios(leer('lib/cobro-etapa-server.ts')), /\.update\(patchDeEdicion\(input, v\.fila\)\)/);
});

// Media 7 y baja 8 · Roturas: la API con `prod.monto_usd`: 1 fallo. La landing buscando el pendiente por el precio: 1 fallo.
test('media 7 y baja 8: la API aprueba lo que se cobra, y la landing reusa el pendiente por el primer pago', () => {
  assert.match(sinComentarios(leer('lib/api-mako/areas/cobros.run.ts')), /productoMontoUsd: enCuotas\?\.primerPagoUsd \?\? prod\.monto_usd,/);
  assert.match(sinComentarios(leer('lib/editor-landing/pago-pedido.ts')), /monto: producto!\.primerPagoUsd \?\? producto!\.montoUsd!,/);
});

// Roturas: sin `cobro_etapa_vinculos` en TENANT_TABLES: 1 fallo. Una escritura sin `esAdmin`: 1 fallo.
test('las puertas: el negocio en curso, sesión siempre y admin para escribir; un producto, un CRM', () => {
  assert.match(leer('lib/workspace.ts'), /^\s*'cobro_etapa_vinculos',$/m);
  const a = sinComentarios(leer('app/crm/cobro-etapa-actions.ts'));
  const escrituras = ['vincularProductoAEtapaAction', 'cambiarCuentasDelVinculoAction', 'desvincularProductoAction', 'guardarProductoCobroAction'];
  for (const f of escrituras) {
    // La firma va en UNA línea y termina en la llave del cuerpo (los tipos de los parámetros también llevan llaves).
    assert.match(a, new RegExp(`export async function ${f}\\([^\\n]*\\{\\n\\s*await exigirSesion\\(\\);\\n\\s*if \\(!\\(await esAdmin\\(\\)\\)\\) return \\{ ok: false, error: SOLO_ADMIN \\};`), f);
  }
  assert.match(a, /export async function leerCobroDeEtapaAction\([^\n]*\{\n\s*await exigirSesion\(\);/);
  const m = leer('supabase/migrations/0326_cobro_en_ganado.sql');
  assert.match(m, /create unique index if not exists cobro_etapa_vinculos_un_crm_por_producto on cobro_etapa_vinculos \(workspace_id, producto_id\);/);
  assert.match(m, /revoke all on cobro_etapa_vinculos from anon, authenticated;/);
});
