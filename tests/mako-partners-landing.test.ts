// =============================================================================
// /mako-partners como una landing de VENTAS, y el panel del partner de la misma familia (24/10/2026)
// =============================================================================
// Martín: «mejora completamente el diseño de "Partners", eso debe verse de ventas, como una landing». El Cerebro, el mismo
// día: «la página de Partners no promete nada que no vayamos a cumplir». Lo que se cuida acá:
//   · el número grande y la cuenta hecha salen de los planes y las reglas (no a mano: si cambia el precio de Pro, cambia la
//     página), y hay una sola acción («Quiero mi link» → el link del partner);
//   · NINGUNA pantalla de Partners promete lo que no pasa: el crédito es un renglón del libro y nada lo consume (ni la
//     cuota, ni un pago en plata, ni la comisión del Acelerador, que no se registra). Se dice lo que pasa hoy (`CREDITO_HOY`)
//     y, sin cobro en línea, por qué un referido no aparece solo.
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CREDITO_HOY, DIAS_COOKIE_REF, PAGOS_PARA_ACREDITAR } from '../lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const fuente = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
const pro = planes.find((p) => p.id === 'pro')!;
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');
const EMAIL = 'equipo@hola-mako.com';

/** Lo que una pantalla de Partners NO puede decir mientras nada consuma el crédito. «Todavía no se descuenta» sí. */
const PROMESA = /meses? gratis|(?<!no )se descuenta|descuenta de tus|en plata|a cobrar|transferencia|comisi[oó]n|20 ?%|un mes de MaKo|meses de MaKo|Disponible/i;

async function landing(cobraEnLinea: boolean): Promise<string> {
  const { LandingPartners } = await import('../app/mako-partners/LandingPartners');
  return texto(renderToStaticMarkup(React.createElement(LandingPartners, { cobraEnLinea, emailMako: EMAIL })));
}

test('la landing: el número grande, la cuenta hecha y las reglas salen de los planes y de las reglas', async () => {
  const t = await landing(true);
  assert.ok(t.includes(`Por cada negocio que traes ${usd(pro.precioUsd)} de crédito, si entra a ${pro.nombre}`), 'el número grande es el precio de Pro');
  for (const p of planes) assert.ok(t.includes(`Referido de ${p.nombre} ${usd(p.precioUsd)}`), p.nombre);
  for (const n of [1, 5, 10]) assert.ok(t.includes(`${usd(n * pro.precioUsd)} de crédito a tu favor`), `la cuenta con ${n}`);
  assert.ok(t.includes(`el link dura ${DIAS_COOKIE_REF} días`));
  assert.ok(t.includes(`paga su ${PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : ''} mes`));
});

test('la landing dice lo que pasa HOY con el crédito, y sin cobro en línea, por qué el referido no aparece solo', async () => {
  const con = await landing(true);
  assert.ok(con.includes(CREDITO_HOY), 'que el crédito todavía no se descuenta');
  assert.match(fuente('app/mako-partners/LandingPartners.tsx'), /<li>\{CREDITO_HOY\}<\/li>/, 'en las reglas, sin letra chica (no sólo en una nota)');
  assert.doesNotMatch(con, PROMESA, 'ni meses gratis, ni plata, ni comisión');
  assert.doesNotMatch(con, /Growth|testimonio/i, 'ni un plan que no existe, ni prueba inventada');
  assert.doesNotMatch(con, /da de alta a mano/, 'con pasarela, sin el aviso');
  const sin = await landing(false);
  assert.match(sin, /Por ahora MaKo da de alta a mano/);
  assert.ok(sin.includes(`escríbenos a ${EMAIL}`));
  // La página averigua si cobra con la MISMA cuenta que /planes y el panel; «no pude leer» no afirma que no cobra.
  const pagina = fuente('app/mako-partners/page.tsx');
  assert.match(pagina, /ofertasDeLosPlanes\(\)\.then\(\(o\) => o\.some\(\(x\) => x\.cobrable\)\)\.catch\(\(\) => true\)/);
  assert.match(pagina, /<LandingPartners cobraEnLinea=\{cobraEnLinea\} emailMako=\{EMAIL_MAKO\} \/>/);
  assert.match(pagina, /export const dynamic = 'force-dynamic';/, 'que no se congele en el build');
});

test('NINGUNA pantalla de Partners promete lo que no pasa (landing, panel, teléfono, «Tu plan», /planes, el mail)', () => {
  for (const rel of ['app/mako-partners/LandingPartners.tsx', 'app/partners/PresentacionPartners.tsx', 'app/partners/referidos/Referidos.tsx',
    'app/m/partners/ReferidosM.tsx', 'app/configuraciones/plan/PlanPanel.tsx', 'app/planes/Vitrina.tsx']) {
    assert.doesNotMatch(fuente(rel), PROMESA, rel);
  }
  const lib = fuente('lib/partners-programa.ts');
  const mails = lib.slice(lib.indexOf('async function bienvenidas'), lib.indexOf('async function avisarCredito') + 900);
  assert.doesNotMatch(mails, PROMESA, 'los mails de bienvenida y del crédito');
  for (const rel of ['app/partners/referidos/Referidos.tsx', 'app/m/partners/ReferidosM.tsx']) {
    assert.match(fuente(rel), /\{CREDITO_HOY\}/, `${rel}: dice lo que pasa hoy`);
    assert.doesNotMatch(fuente(rel), /r\.(saldoUsd|mesesGratis|aCobrarUsd)/, `${rel}: no muestra lo que nada consume`);
  }
});

test('la landing tiene UNA acción: «Quiero mi link», al link del partner; y nada escrito a mano', () => {
  const p = fuente('app/mako-partners/LandingPartners.tsx');
  const acciones = p.match(/<Link className="mp-btn" href="([^"]+)">([^<]+)<\/Link>/g) ?? [];
  assert.equal(acciones.length, 2, 'arriba y al final');
  for (const a of acciones) assert.match(a, /href="\/partners\/referidos">Quiero mi link</);
  assert.doesNotMatch(p, /US\$ ?\d|\b(47|97|60) días/, 'ningún número a mano');
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

// Roturas (24/10/2026; base 5 / 0), cada una restaurada (pasan / fallan):
//   · el número grande escrito a mano («US$ 97» en vez del precio de Pro)                    -> 4 / 1
//   · la cuenta hecha con el precio de Esencial                                               -> 4 / 1
//   · «60 días» a mano en vez de DIAS_COOKIE_REF                                              -> 4 / 1
//   · la landing vuelve a prometer «= 5 meses de MaKo Pro»                                    -> 3 / 2
//   · la landing sin la frase de lo que pasa hoy (`CREDITO_HOY`)                              -> 4 / 1
//   · la landing sin el aviso de las altas a mano                                             -> 4 / 1
//   · el panel vuelve a mostrar «Meses gratis ganados»                                        -> 4 / 1
//   · el mail del crédito vuelve a decir «y tus meses gratis»                                 -> 4 / 1
//   · /planes vuelve a «gana meses gratis»                                                    -> 4 / 1
//   · el botón del panel sin el id del link (no llega)                                        -> 4 / 1
//   · el panel vuelve al dorado de --accent                                                   -> 4 / 1
