// =============================================================================
// «Vincular cobro» en Ganado (22/10/2026): el producto que cobra ahí, por Stripe y Mercado Pago a la vez
// =============================================================================
// Martín: «Si conectamos la integración de Stripe y Mercado Pago, deberíamos poder vincular a la etapa GANADO en los 3
// puntos, poder elegir el producto, tal como lo hacemos en "Asignar evento"... que pueda tener de MP y de Stripe al mismo
// tiempo... Y que pueda crear o editar los productos desde allí mismo... E incluso que pueda tener varias cuentas».
// El modelo y las acciones son de Cobros; el ⋯ de la columna y el modal, de acá (app/crm/CobroDeEtapaModal.tsx).
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el precio de una suscripción sin «al mes»                                                        → 3 / 1
//   · el nombre de la cuenta con su alias aunque sea la única de su proveedor                          → 3 / 1
//   · un producto nuevo con precio 0                                                                  → 3 / 1
//   · «Vincular cobro» en el ⋯ de TODAS las columnas, no sólo Ganado                                  → 3 / 1
//   · desmarcar la última cuenta de un producto (queda sin cobrar por ningún lado, sin decirlo)       → 3 / 1
//   · «Quitar» sin Deshacer                                                                           → 3 / 1
// Correr: node --import tsx --test tests/crm-cobro-ganado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nombreDeCuenta, precioDeProducto, productoDeLoEscrito, productosParaVincular } from '../app/crm/cobro-ganado';
import { opcionesCrm, OPCION_CRM, type ContextoCrm } from '../app/crm/menu-contextual-crm';
import type { CuentaPago, FotoCobroEtapa, ProductoCobro } from '../lib/cobro-etapa';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const SPRINT: ProductoCobro = { id: 7, nombre: 'Sprint 3 días', tipo: 'unico', montoUsd: 1500, suscripcionMeses: null, cuotas: 3, activo: true };

test('lo que dice: el precio, la cuenta y qué productos se pueden sumar', () => {
  assert.equal(precioDeProducto(SPRINT), 'USD 1,500 en 3 cuotas');
  assert.equal(precioDeProducto({ ...SPRINT, cuotas: null }), 'USD 1,500');
  assert.equal(precioDeProducto({ ...SPRINT, tipo: 'suscripcion', montoUsd: 97, suscripcionMeses: 12, cuotas: null }), 'USD 97 al mes · 12 meses');
  assert.equal(precioDeProducto({ ...SPRINT, tipo: 'suscripcion', montoUsd: 97, suscripcionMeses: null }), 'USD 97 al mes');
  assert.equal(precioDeProducto({ ...SPRINT, montoUsd: null }), 'Sin precio');
  const stripe: CuentaPago = { id: 'stripe:principal', proveedor: 'stripe', nombre: 'Principal', principal: true };
  const mp: CuentaPago = { id: 'mercadopago:principal', proveedor: 'mercadopago', nombre: 'Principal', principal: true };
  const stripeUsa: CuentaPago = { id: 'stripe:usa', proveedor: 'stripe', nombre: 'Cuenta USA', principal: false };
  assert.equal(nombreDeCuenta(stripe, [stripe, mp]), 'Stripe', 'una sola de su proveedor: sin alias');
  assert.equal(nombreDeCuenta(mp, [stripe, mp]), 'Mercado Pago');
  assert.equal(nombreDeCuenta(stripeUsa, [stripe, stripeUsa, mp]), 'Stripe · Cuenta USA', 'con varias, el alias las distingue');
  const foto: FotoCobroEtapa = { cuentas: [stripe, mp], productos: [SPRINT, { ...SPRINT, id: 8, nombre: 'Mentoría' }, { ...SPRINT, id: 9, activo: false }], vinculos: [{ id: 1, funnelId: 44, etapa: 'ganado', productoId: 7, cuentas: ['stripe:principal'] }], puedeEditar: true };
  assert.deepEqual(productosParaVincular(foto).map((p) => p.id), [8], 'ni el ya vinculado ni el inactivo');
});

test('crear o editar un producto: lo escrito se valida antes de mandarlo', () => {
  const base = { nombre: 'Sprint', tipo: 'unico' as const, monto: '1500', meses: '', cuotas: '3' };
  assert.deepEqual(productoDeLoEscrito(base), { ok: true, input: { nombre: 'Sprint', tipo: 'unico', montoUsd: 1500, suscripcionMeses: null, cuotas: 3 } });
  assert.deepEqual(productoDeLoEscrito({ ...base, tipo: 'suscripcion', monto: '97,5', meses: '12' }), { ok: true, input: { nombre: 'Sprint', tipo: 'suscripcion', montoUsd: 97.5, suscripcionMeses: 12, cuotas: null } });
  assert.equal(productoDeLoEscrito({ ...base, nombre: '  ' }).ok, false);
  assert.equal(productoDeLoEscrito({ ...base, monto: '0' }).ok, false, 'un producto sin precio no cobra');
  assert.equal(productoDeLoEscrito({ ...base, monto: 'mil' }).ok, false);
  assert.equal(productoDeLoEscrito({ ...base, cuotas: '8' }).ok, false, 'un pago único va en 1 a 7 cuotas (Cobros)');
  assert.equal(productoDeLoEscrito({ ...base, cuotas: '7' }).ok, true);
});

test('el ⋯ y el clic derecho de Ganado (y sólo de Ganado) abren «Vincular cobro»', () => {
  const col: ContextoCrm = { sobre: 'columna', mover: true, entrada: false, curso: null, borrable: false };
  assert.ok(!opcionesCrm(col).includes('col_cobro'));
  assert.ok(opcionesCrm({ ...col, ganado: true }).includes('col_cobro'));
  assert.deepEqual(OPCION_CRM.col_cobro, { texto: 'Vincular cobro', icono: 'dinero' });
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  // El MISMO rótulo e ícono en el «⋯» de la cabecera (tests/crm-menu-contextual.test.ts cruza los de la columna).
  assert.match(b, /\.\.\.\(c\.key === 'ganado' \? \[\{ value: 'cobro', label: 'Vincular cobro', icono: 'dinero' as const \}\] : \[\]\),/);
  assert.match(b, /if \(v === 'cobro'\) \{ setCobroDe\(\{ etapa: c\.key, nombre: c\.label \}\); return; \}/);
  assert.match(b, /ganado: c\.key === 'ganado',/);
  assert.match(b, /case 'col_cobro': if \(c\) setCobroDe\(\{ etapa: c\.key, nombre: c\.label \}\); return;/);
  assert.match(b, /<CobroDeEtapaModal funnelId=\{\(funnelActivo \?\? funnels\.find\(\(f\) => f\.esDefault\)\?\.id\) as number\}\s*etapa=\{cobroDe\.etapa\} etapaNombre=\{cobroDe\.nombre\} onCerrar=\{cerrarCobro\} \/>/);
});

test('el modal: una casilla por cuenta (Stripe y MP a la vez), conectar ahí mismo, crear y vincular, y «Quitar» con Deshacer', () => {
  const m = sinComentarios(leer('app/crm/CobroDeEtapaModal.tsx'));
  assert.match(m, /\{TEXTO_AL_PAGAR\}/, 'la línea de Cobros');
  assert.doesNotMatch(m, /Copiar link|linkDelVinculoAction/, 'el link todavía no existe sin un lead: no se dibuja');
  assert.match(m, /\{foto\.cuentas\.map\(\(c\) => \{\s*const marcada = v\.cuentas\.includes\(c\.id\);/, 'una casilla por cuenta');
  assert.match(m, /if \(!cuentas\.length\) \{ show\('Deja al menos una cuenta, o quita el producto\.', undefined, 'bad'\); return false; \}/);
  assert.match(m, /\(\['stripe', 'mercadopago'\] as const\)\.map\(\(prov\) => \(\s*<BotonIntegracion key=\{prov\} servicio=\{prov\} onConectado=\{\(\) => leer\(\)\}/, 'sin cuentas no se conecta ahí mismo');
  // Lo creado nace cobrando por todas las cuentas; lo quitado se deshace con lo que devuelve Cobros.
  assert.match(m, /const v = await vincularProductoAEtapaAction\(\{ funnelId, etapa, productoId: r\.producto\.id, cuentas: todasLasCuentas \}\);/);
  assert.match(m, /show\(`«\$\{nombre\}» ya no cobra aquí`, \(\) => \{\s*void vincularProductoAEtapaAction\(d\)/);
  assert.match(m, /const r = await guardarProductoCobroAction\(p\.input, id\);/);
});
