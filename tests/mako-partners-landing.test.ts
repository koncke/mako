// =============================================================================
// /mako-partners como una landing de VENTAS, y el panel del partner de la misma familia (24/10/2026)
// =============================================================================
// Martín: «mejora completamente el diseño de "Partners", eso debe verse de ventas, como una landing». Lo que se cuida acá:
// el número grande y la cuenta hecha salen de los planes y las reglas (no a mano: si cambia el precio de Pro, cambia la
// página), una sola acción («Quiero mi link» → el link del partner), y ni una promesa más de las que ya había (el
// descuento en la cuota no se aplica todavía: docs/hallazgos-partners.md).
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMISION_GRUPAL, DIAS_COOKIE_REF, PAGOS_PARA_ACREDITAR } from '../lib/partners-reglas';
import { PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR } from '../lib/planes-mako';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
const pro = planes.find((p) => p.id === 'pro')!;
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

test('la landing: el número grande, la cuenta hecha y las reglas salen de los planes y de las reglas', async () => {
  const { default: Pagina } = await import('../app/mako-partners/page');
  const t = texto(renderToStaticMarkup(React.createElement(Pagina)));
  assert.ok(t.includes(`Por cada negocio que traes ${usd(pro.precioUsd)} de crédito, si entra a ${pro.nombre}`), 'el número grande es el precio de Pro');
  for (const p of planes) assert.ok(t.includes(`Referido de ${p.nombre} ${usd(p.precioUsd)}`), p.nombre);
  for (const n of [1, 5, 10]) assert.ok(t.includes(`${usd(n * pro.precioUsd)} = ${n} ${n === 1 ? 'mes' : 'meses'} de ${pro.nombre}`), `la cuenta con ${n}`);
  const comision = Math.round(PROGRAMA_ACELERADOR.precioUsd * COMISION_GRUPAL);
  assert.ok(t.includes(`${usd(comision)} en plata`), 'la comisión del Acelerador, de la regla');
  assert.ok(t.includes(`el link dura ${DIAS_COOKIE_REF} días`));
  assert.ok(t.includes(`paga su ${PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : ''} mes`));
  assert.doesNotMatch(t, /descuent|Growth|testimonio/i, 'ni una promesa más, ni un plan que no existe, ni prueba inventada');
});

test('la landing tiene UNA acción: «Quiero mi link», al link del partner; y nada escrito a mano', () => {
  const p = fuente('app/mako-partners/page.tsx');
  const acciones = p.match(/<Link className="mp-btn" href="([^"]+)">([^<]+)<\/Link>/g) ?? [];
  assert.equal(acciones.length, 2, 'arriba y al final');
  for (const a of acciones) assert.match(a, /href="\/partners\/referidos">Quiero mi link</);
  assert.doesNotMatch(p, /US\$ ?\d|\b(47|97|300|60) (días|en plata)/, 'ningún número a mano');
});

test('el panel de adentro es de la MISMA familia: el número grande, el azul de la app y el botón a su link', async () => {
  const p = fuente('app/partners/PresentacionPartners.tsx');
  assert.match(p, /PLANES_MAKO_DEFAULT\.filter\(\(p\) => p\.activo\)/);
  assert.match(p, /var\(--primary\)/, 'el azul de la landing con el token de la app (cambia con el tema)');
  assert.doesNotMatch(p, /var\(--accent\)|#2F6FED/i, 'ni el dorado de --accent ni el azul fijo');
  assert.match(p, /\{vista === 'cliente' && <a className="pp-btn" href="#pr-link">Copiar mi link<\/a>\}/);
  assert.match(fuente('app/partners/referidos/Referidos.tsx'), /<div className="pr-link" id="pr-link">/, 'el botón llega al link');
  const { PresentacionPartners } = await import('../app/partners/PresentacionPartners');
  const t = texto(renderToStaticMarkup(React.createElement(PresentacionPartners, { vista: 'cliente' })));
  assert.ok(t.includes(`Por cada negocio que traes ${usd(pro.precioUsd)} de crédito, si entra a ${pro.nombre}`));
  const sa = texto(renderToStaticMarkup(React.createElement(PresentacionPartners, { vista: 'plataforma' })));
  assert.doesNotMatch(sa, /Copiar mi link|aquí abajo/, 'el super admin no tiene un link propio que copiar');
  assert.match(sa, /Así lo ven tus clientes/);
});

// Roturas (24/10/2026; base 3 / 0), cada una restaurada (pasan / fallan):
//   · el número grande escrito a mano («US$ 97» en vez del precio de Pro)                    -> 2 / 1
//   · la cuenta hecha con el precio de Esencial                                               -> 2 / 1
//   · «60 días» a mano en vez de DIAS_COOKIE_REF                                              -> 2 / 1
//   · la landing vuelve a prometer que el crédito «se descuenta»                              -> 2 / 1
//   · el botón del panel sin el id del link (no llega)                                        -> 2 / 1
//   · el panel vuelve al dorado de --accent                                                   -> 2 / 1
