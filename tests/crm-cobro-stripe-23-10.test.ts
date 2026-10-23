// =============================================================================
// «Vincular cobro» con los productos de Stripe (23/10/2026, la llamada con Mauricio)
// =============================================================================
// Medido por Cobros en el ws1 (sólo leyendo): su «Sprint 3 días» está en Stripe a US$270, pago único, y en el catálogo de
// MaKo sin precio; el pop-up listaba sólo el catálogo y decía «Este producto no tiene precio», y «Volver a leer» volvía a
// pedir lo mismo. El servidor es de Cobros (lib/stripe-catalogo.ts y app/crm/cobro-etapa-actions.ts); acá, lo que ofrece
// «+ Producto» (app/crm/cobro-ganado.ts, puro: se EJECUTA) y el pop-up (se lee como fuente).
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el de MaKo y el de Stripe en DOS filas (sin juntar por `enMako`)                      → 3 / 1
//   · ofrecer un precio de Stripe cuyo producto ya cobra en esta etapa                      → 3 / 1
//   · los que no se pueden traer, escondidos (sin las filas apagadas)                       → 3 / 1
//   · `leer` que espera a Stripe antes de mostrar la foto                                   → 3 / 1
//   · un error de Stripe que no se muestra                                                  → 3 / 1
//   · traer sin poner el producto cuando no se pudo vincular                                → 3 / 1
// Correr: node --import tsx --test tests/crm-cobro-stripe-23-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { opcionesDeCobro, precioDeStripeTexto } from '../app/crm/cobro-ganado';
import type { FotoCobroEtapa, ProductoCobro } from '../lib/cobro-etapa';
import type { PrecioDeStripe } from '../lib/stripe-catalogo-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const producto = (id: number, nombre: string, montoUsd: number | null): ProductoCobro =>
  ({ id, nombre, tipo: 'unico', montoUsd, activo: true, suscripcionMeses: null, cuotas: null } as unknown as ProductoCobro);
const precio = (p: Partial<PrecioDeStripe> & { precio: string; nombre: string }): PrecioDeStripe => ({
  cuenta: 'stripe:principal', cuentaNombre: 'Stripe', monto: 270, moneda: 'USD', montoUsd: 270, tipo: 'unico', noSe: null, enMako: null, ...p,
});
const foto = (productos: ProductoCobro[], vinculados: number[] = []): FotoCobroEtapa =>
  ({ productos, vinculos: vinculados.map((productoId, i) => ({ id: 100 + i, funnelId: 1, etapa: 'ganado', productoId, cuentas: ['stripe:principal'] })), cuentas: [], puedeEditar: true } as unknown as FotoCobroEtapa);

test('el caso de Mauricio: su «Sprint 3 días» sin precio en MaKo sale en UNA fila, con el precio de Stripe', () => {
  const sprint = producto(54, 'Sprint 3 días', null);
  const ops = opcionesDeCobro(foto([sprint]), [precio({ precio: 'price_sprint', nombre: 'sprint 3 días', enMako: 54 })]);
  assert.equal(ops.length, 1, 'el de MaKo y el de Stripe son el mismo producto: una fila');
  assert.equal(ops[0].tipo, 'stripe');
  assert.equal(ops[0].tipo === 'stripe' && ops[0].producto?.id, 54, 'con el nombre de MaKo');
  assert.equal(precioDeStripeTexto({ monto: 270, moneda: 'USD', tipo: 'unico' }).endsWith(' · pago único'), true);
  assert.match(precioDeStripeTexto({ monto: 270, moneda: 'USD', tipo: 'unico' }), /270/);
  assert.match(precioDeStripeTexto({ monto: 97, moneda: 'USD', tipo: 'suscripcion' }), /97 al mes$/);
});

test('el orden: MaKo, después lo de Stripe que no está en MaKo, y al final, apagado, lo que no se puede traer; lo que ya cobra aquí no se ofrece', () => {
  const mentoria = producto(7, 'Mentoría', 100);
  const yaAqui = producto(8, 'Curso', 50);
  const ops = opcionesDeCobro(foto([mentoria, yaAqui], [8]), [
    precio({ precio: 'price_curso', nombre: 'Curso', enMako: 8 }),
    precio({ precio: 'price_nuevo', nombre: 'Asesoría' }),
    precio({ precio: 'price_mxn', nombre: 'Taller', moneda: 'MXN', montoUsd: null, noSe: 'Está en MXN: el catálogo de MaKo va en dólares.' }),
  ]);
  assert.deepEqual(ops.map((o) => (o.tipo === 'mako' ? `mako:${o.producto.nombre}` : `${o.tipo}:${o.precio.nombre}`)),
    ['mako:Mentoría', 'stripe:Asesoría', 'no:Taller']);
});

test('el pop-up: Stripe en paralelo sin frenar la foto, sus errores dichos, y traer va por la acción de Cobros', () => {
  const m = sinComentarios(leer('app/crm/CobroDeEtapaModal.tsx'));
  const i = m.indexOf('const leer = useCallback(');
  const l = m.slice(i, m.indexOf('}, [funnelId, etapa]);', i));
  assert.ok(l.indexOf('void leerCobroDeEtapaAction(') < l.indexOf('void preciosDeStripeAction()'), 'la foto primero');
  assert.doesNotMatch(l, /await /, 'leer no espera a nadie: cada una llega cuando llega');
  assert.match(m, /No pude leer los productos de \{e\.cuentaNombre\}: \{e\.error\}/, 'un fallo se dice, nunca «no hay»');
  // Traer: del navegador sale sólo QUÉ precio (el monto lo vuelve a leer el server en Stripe).
  assert.match(m, /await vincularPrecioDeStripeAction\(\{ funnelId, etapa, cuenta: precio\.cuenta, precio: precio\.precio \}\)/);
  assert.match(m, /if \('producto' in r && r\.producto\) ponerProducto\(r\.producto\);\s*if \(!r\.ok\)/, 'traído y no vinculado: el producto igual se pone');
  // Los que no se pueden traer: apagados, sin botón, con su porqué.
  const j = m.indexOf("if (o.tipo === 'no') {");
  const no = m.slice(j, m.indexOf('return (', m.indexOf(');', j) + 2));
  assert.doesNotMatch(no, /<button/);
  assert.match(no, /\{p\.noSe\}/);
});

test('«Volver a leer» y conectar Stripe traen los precios de nuevo (los dos llaman a `leer`)', () => {
  const m = sinComentarios(leer('app/crm/CobroDeEtapaModal.tsx'));
  assert.match(m, /aria-label="Volver a leer" title="Volver a leer" onClick=\{leer\}/);
  assert.match(m, /<BotonIntegracion key=\{prov\} servicio=\{prov\} onConectado=\{\(\) => leer\(\)\}/);
  assert.match(m, /setStripe\(null\);\s*void preciosDeStripeAction\(\)/, 'al volver a leer, la lista vieja no queda como si fuera la nueva');
});
