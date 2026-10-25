// =============================================================================
// La landing de MaKo Partners: la que vende, con la calculadora, y que no promete lo que no pasa (24/10/2026)
// =============================================================================
// Martín (24/10, tarde): «mejora completamente el diseño de "Partners", eso debe verse de ventas, como una landing». Y a la
// noche: «hazla mas marketinera... No me da claridad en lo que ganan, esta todo muy amontonado, no se sabe si se ganan
// meses o dinero... Falta algo como "Calculadora"». El Cerebro, el mismo día: «la página de Partners no promete nada que
// no vayamos a cumplir». Lo que se cuida acá:
//   · QUÉ se gana se dice en una mirada: crédito para tu plan, no dinero; cuánto por plan, cuándo y sin tope. Los números
//     salen de los planes y las reglas (si cambia el precio de Pro, cambia la página);
//   · la calculadora hace la cuenta del libro (n veces el primer mes del plan), nada más;
//   · NINGUNA pantalla de Partners promete lo que no pasa: el crédito es un renglón del libro y nada lo consume (ni la
//     cuota, ni un pago en efectivo, ni la comisión del Acelerador, que no se registra). Se dice lo que pasa hoy
//     (`CREDITO_HOY`) y, sin cobro en línea, por qué un referido no aparece solo;
//   · una sola acción: en la pública, a la tab; adentro, el botón «Unirme».
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
const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);
const tope = planes[0];
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');
const EMAIL = 'equipo@hola-mako.com';
const mes = PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : '';

/** Lo que una pantalla de Partners NO puede decir mientras nada consuma el crédito. «Todavía no se descuenta» sí. */
const PROMESA = /meses? gratis|(?<!no )se descuenta|descuenta de tus|en plata|a cobrar|transferencia|comisi[oó]n|20 ?%|un mes de MaKo|meses de MaKo|Disponible/i;

type Props = { cobraEnLinea: boolean; emailMako: string; modo?: 'publica' | 'app'; unirme?: (d: FormData) => Promise<void>; volver?: string; error?: boolean };
async function landing(p: Partial<Props> = {}): Promise<{ html: string; t: string }> {
  const { LandingPartners } = await import('../app/mako-partners/LandingPartners');
  const html = renderToStaticMarkup(React.createElement(LandingPartners, { cobraEnLinea: true, emailMako: EMAIL, ...p }));
  return { html, t: texto(html) };
}

test('QUÉ se gana, en una mirada: crédito para tu plan, no dinero; cuánto por plan, cuándo y sin tope', async () => {
  const { t } = await landing();
  assert.ok(t.includes(`Gana hasta ${usd(tope.precioUsd)} de crédito por cada negocio que traigas a MaKo`), 'el número grande es el plan más caro');
  assert.match(t, /Lo que ganas Crédito para tu plan No es dinero en efectivo: es saldo a tu favor en MaKo\./);
  for (const p of planes) assert.ok(t.includes(`Por un negocio en ${p.nombre} ${usd(p.precioUsd)}`), p.nombre);
  assert.ok(t.includes(`Se suma al pagar su ${mes} mes`));
  assert.ok(t.includes(`Tu link dura ${DIAS_COOKIE_REF} días`));
  // La pregunta de Martín, contestada primero y abierta.
  assert.match(t, /¿Gano dinero o meses\? Crédito para tu plan de MaKo, no dinero en efectivo\./);
  assert.ok(t.includes(`${DIAS_COOKIE_REF} días en el navegador de quien lo abre`));
});

test('la calculadora: la cuenta del libro (n veces el primer mes), y se lee sin JavaScript', async () => {
  const { creditoPorNegocios, NEGOCIOS_DE_ARRANQUE, MAX_NEGOCIOS } = await import('../app/mako-partners/Calculadora');
  assert.equal(creditoPorNegocios(1, 97), 97);
  assert.equal(creditoPorNegocios(10, 47), 470);
  assert.equal(creditoPorNegocios(3.7, 97), 291, 'negocios enteros');
  assert.equal(creditoPorNegocios(-2, 97), 0);
  assert.ok(MAX_NEGOCIOS >= 20 && NEGOCIOS_DE_ARRANQUE <= MAX_NEGOCIOS);
  const { html, t } = await landing();
  assert.match(html, /<input id="mp-calc-n" class="mp-calc-barra" type="range" min="1" max="50"/);
  // Sin JavaScript se ve la cuenta de arranque, con el plan más caro.
  assert.ok(t.includes(`Tu crédito ${usd(NEGOCIOS_DE_ARRANQUE * tope.precioUsd)} ${NEGOCIOS_DE_ARRANQUE} negocios × ${usd(tope.precioUsd)}, el primer mes de ${tope.nombre}`));
  assert.ok(t.includes(`A precio de lista. Cada negocio suma cuando paga su ${mes} mes. ${CREDITO_HOY}`), 'debajo, lo que pasa hoy');
  const c = fuente('app/mako-partners/Calculadora.tsx');
  assert.match(c, /creditoDelReferido\(precioUsd\)/, 'el mismo valor que acredita el libro');
  assert.doesNotMatch(c, /conversi[oó]n|clics|visitas/i, 'ni una tasa de conversión inventada');
});

test('la landing dice lo que pasa HOY con el crédito, y sin cobro en línea, por qué el referido no aparece solo', async () => {
  const { t: con } = await landing();
  assert.ok(con.includes(CREDITO_HOY), 'que el crédito todavía no se descuenta');
  assert.doesNotMatch(con, PROMESA, 'ni meses gratis, ni plata, ni comisión');
  assert.doesNotMatch(con, /Growth|testimonio/i, 'ni un plan que no existe, ni prueba inventada');
  assert.doesNotMatch(con, /da de alta a mano/, 'con pasarela, sin el aviso');
  const { t: sin } = await landing({ cobraEnLinea: false });
  assert.match(sin, /Por ahora MaKo da de alta a mano/);
  assert.ok(sin.includes(`escríbenos a ${EMAIL}`));
  // La página averigua si cobra con la MISMA cuenta que /planes y el panel; «no pude leer» no afirma que no cobra.
  const pagina = fuente('app/mako-partners/page.tsx');
  assert.match(pagina, /ofertasDeLosPlanes\(\)\.then\(\(o\) => o\.some\(\(x\) => x\.cobrable\)\)\.catch\(\(\) => true\)/);
  assert.match(pagina, /<LandingPartners cobraEnLinea=\{cobraEnLinea\} emailMako=\{EMAIL_MAKO\} \/>/);
  assert.match(pagina, /export const dynamic = 'force-dynamic';/, 'que no se congele en el build');
});

test('NINGUNA pantalla de Partners promete lo que no pasa (landing, panel, teléfono, «Tu plan», /planes, el mail)', () => {
  for (const rel of ['app/mako-partners/LandingPartners.tsx', 'app/mako-partners/Calculadora.tsx', 'app/partners/referidos/Referidos.tsx',
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

test('UNA acción: en la pública lleva a la tab; adentro es «Unirme»; el super admin, sin botón; y nada escrito a mano', async () => {
  const { html: pub } = await landing();
  const links = pub.match(/<a class="mp-btn" href="[^"]+">[^<]+<\/a>/g) ?? [];
  assert.equal(links.length, 3, 'arriba, en la calculadora y al final');
  for (const a of links) assert.match(a, /href="\/partners\/referidos">Unirme gratis</);
  assert.doesNotMatch(pub, /<form/, 'la pública no une a nadie');
  const unirme = async () => {};
  const { html: app } = await landing({ modo: 'app', unirme, volver: '/partners' });
  assert.equal((app.match(/<button class="mp-btn" type="submit">Unirme a MaKo Partners<\/button>/g) ?? []).length, 3);
  assert.equal((app.match(/<input type="hidden" name="volver" value="\/partners"\/>/g) ?? []).length, 3);
  assert.doesNotMatch(app.replace(/<style[\s\S]*?<\/style>/, ''), /mp-publica|mp-barra/, 'adentro, sin la barra de la página pública (la de la app queda)');
  assert.match(app, /^<div class="mp-root mp-app">/, 'adentro no es otro <main>');
  const { html: sa, t: saT } = await landing({ modo: 'app' });
  assert.doesNotMatch(sa, /class="mp-btn"|<form/, 'el super admin mira: no se une');
  assert.doesNotMatch(saT, /Empieza a sumar hoy/);
  const { t: mal } = await landing({ modo: 'app', unirme, error: true });
  assert.match(mal, /No pudimos unirte\. Prueba otra vez en un minuto\./);
  const p = fuente('app/mako-partners/LandingPartners.tsx');
  assert.doesNotMatch(p.replace(/const CSS = `[\s\S]*?`;/, ''), /US\$ ?\d|\b(47|97|60) días/, 'ningún número a mano');
});

test('adentro de la app, la landing usa los colores de la app (cambia con el tema), no los fijos de la pública', () => {
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  const app = css.match(/\.mp-root\.mp-app \{([^}]*)\}/)![1];
  for (const v of ['--mp-ink: var(--ink)', '--mp-azul: var(--primary)', '--mp-sup: var(--surface)', '--mp-sobre-azul: var(--on-primary']) assert.ok(app.includes(v), v);
  assert.doesNotMatch(app, /var\(--accent\)/, 'el --accent de la app es el DORADO, no el azul');
  assert.match(css, /body:has\(\.mp-publica\) aside \{ display: none !important; \}/, 'sólo la pública esconde la barra');
  assert.doesNotMatch(css, /body:has\(\.mp-root\)/, 'la tab no esconde la barra de la app');
});

// Roturas (24/10/2026, noche; base 6 / 0), cada una restaurada (pasan / fallan):
//   · el número grande escrito a mano («US$ 97» en vez del plan más caro)                    -> 5 / 1
//   · la ficha sin «No es dinero en efectivo»                                                -> 5 / 1
//   · la calculadora con una «tasa de conversión» de 30%                                     -> 5 / 1
//   · la calculadora multiplica por diez el precio (el anual)                                -> 5 / 1
//   · la landing vuelve a prometer «= 5 meses de MaKo Pro»                                    -> 3 / 3
//   · la landing sin la frase de lo que pasa hoy (`CREDITO_HOY`)                              -> 5 / 1
//   · la landing sin el aviso de las altas a mano                                             -> 5 / 1
//   · el panel vuelve a mostrar «Meses gratis ganados»                                        -> 5 / 1
//   · adentro de la app, el botón vuelve a ser un link (no une a nadie)                       -> 5 / 1
//   · el super admin con el botón de unirse                                                   -> 5 / 1
//   · la tab vuelve a esconder la barra de la app (`body:has(.mp-root) aside`)                -> 5 / 1
//   · el modo app con el dorado de --accent                                                   -> 5 / 1
