// =============================================================================
// La landing de MaKo Partners: la que vende, con la calculadora azul, y que no promete lo que no pasa (24/10/2026; 25/10)
// =============================================================================
// Martín (25/10/2026, ~15:40): «Elimina lo de "gana meses de tu plan", que solo ganen direro y listo... No pongas al
// programa de 1500 en el programa de referidos... Hazlo más marketinero la landing, literalmente se llevan el 100% de lo
// que venden... La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul... Elimina la sección de "Cómo
// funciona" y "Por ahora MaKo da de alta a mano"... Revisa las preguntas frecuentes... Ya no hay "meses" ni "devolución"...
// Si pueden hacer ads que digan "mako", no aclares eso... Elimina lo de "Si llegó con varios links, vale el primero."... No
// se entiende "No. Cada negocio nuevo que traes suma el suyo."». Lo que se cuida acá:
//   · el título dice el 100% y la bajada cuánto por plan, en dinero; nada de meses, crédito, Acelerador ni devolución;
//   · la calculadora es UN bloque azul, en el hero, donde estaba «Si se suscribe», y cuenta n veces el primer mes entero;
//   · sin «Cómo funciona» ni el aviso del alta a mano; las preguntas nuevas, claras;
//   · UNA acción (un link): hacerse partner (`RUTA_ALTA_PARTNERS`), volver al panel, o ninguna (el super admin mirando);
//   · adentro de la app, los colores del tema.
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIAS_COOKIE_REF, PAGO_HOY, RUTA_ALTA_PARTNERS } from '../lib/partners-reglas';
import { PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR } from '../lib/planes-mako';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const fuente = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

/** Lo que la landing ya no puede decir: los meses, el crédito, el Acelerador y la devolución (Martín, 25/10). */
const VIEJO = /meses de tu plan|meses gratis|cr[eé]dito para|tu cr[eé]dito|Acelerador|1\.500|devoluci[oó]n|devuelvan|garant[ií]a|da de alta a mano|vale el primero|suma el suyo|C[oó]mo funciona|la palabra «MaKo»/i;

type Props = { modo?: 'publica' | 'app'; accion?: { href: string; texto: string } | null; rotulo?: React.ReactNode };
async function landing(p: Props = {}): Promise<{ html: string; t: string }> {
  const { LandingPartners } = await import('../app/mako-partners/LandingPartners');
  const html = renderToStaticMarkup(React.createElement(LandingPartners, p));
  return { html, t: texto(html) };
}

test('el TÍTULO dice el 100%, y la bajada cuánto por plan, en dinero (los números salen de los planes)', async () => {
  const { html, t } = await landing();
  assert.match(html, /<h1>Recomienda MaKo y llévate el <em>100%<\/em> de lo que vendes<\/h1>/);
  for (const p of planes) assert.ok(t.includes(`${usd(p.precioUsd)} por cada ${p.nombre}`), `la bajada dice ${p.nombre}`);
  assert.match(t, /En dinero y sin tope\./);
  assert.match(t, /Cobras en dinero/);
  assert.doesNotMatch(t, VIEJO, 'nada de meses, crédito, Acelerador, devolución, «Cómo funciona» ni el alta a mano');
  assert.ok(!t.includes(PROGRAMA_ACELERADOR.nombre), 'el Acelerador no está en Partners');
});

test('la CALCULADORA: un bloque azul en el hero (donde estaba «Si se suscribe»), n veces el primer mes entero', async () => {
  const { html, t } = await landing();
  const hero = html.slice(html.indexOf('class="mp-hero-grilla"'), html.indexOf('class="mp-seccion"'));
  assert.ok(hero.includes('class="mp-calc" id="calculadora"'), 'la calculadora está en el hero');
  assert.doesNotMatch(html, /Si se suscribe|mp-ficha/, 'la ficha «Si se suscribe» se fue');
  assert.match(t, /Te llevas US\$ 485 5 negocios × US\$ 97: el primer mes entero de cada MaKo Pro/, 'sin JavaScript: 5 negocios en el plan más caro');
  const { gananciaPorNegocios } = await import('../app/mako-partners/Calculadora');
  assert.equal(gananciaPorNegocios(10, 97), 970);
  assert.equal(gananciaPorNegocios(3.9, 47), 141, 'negocios enteros');
  assert.equal(gananciaPorNegocios(-2, 97), 0);
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  assert.match(css, /\.mp-calc \{[^}]*linear-gradient\(140deg, var\(--mp-azul\) 0%, var\(--mp-azul-osc\) 100%\)/, 'todo el bloque es el azul');
  assert.doesNotMatch(fuente('app/mako-partners/Calculadora.tsx'), /mp-calc-entrada|tasa|conversi/i, 'sin la mitad blanca ni tasas inventadas');
});

test('las PREGUNTAS nuevas: claras, sin meses ni devolución, anuncios sin vueltas, y el tope que se entiende', async () => {
  const { t } = await landing();
  const preguntas = ['¿Cuánto gano?', '¿Cuándo cobro?', '¿Hay un límite?', '¿Quién cuenta como mi referido?', '¿Y si no entra con mi link?',
    '¿Cuánto dura mi link?', '¿Puedo hacer anuncios con mi link?', '¿Cuesta algo ser partner?'];
  for (const q of preguntas) assert.ok(t.includes(q), q);
  assert.match(t, /Es dinero, no crédito ni descuentos\./);
  assert.ok(t.includes(PAGO_HOY), 'cuándo y cómo se cobra: lo que pasa hoy');
  assert.match(t, /Ninguno\. Traes 10 negocios, ganas 10 primeros meses\. Traes 100, ganas 100\./);
  assert.match(t, /Sí\. Compártelo donde quieras: tus redes, tus grupos de WhatsApp, tu newsletter o tus anuncios\./);
  assert.ok(t.includes(`${DIAS_COOKIE_REF} días. Si alguien lo abre hoy`), 'cuánto dura, sin «vale el primero»');
  assert.match(t, /pone tu código al pagar/, 'el código del carrito');
  assert.doesNotMatch(t, /¿Y si soy agencia\?/, 'lo de agencia salió de Partners');
});

test('UNA acción, un link: hacerse partner (al alta), volver al panel, o ninguna (el super admin)', async () => {
  const { html: pub } = await landing();
  const links = pub.match(/<a class="mp-btn" href="[^"]+">[^<]+<\/a>/g) ?? [];
  assert.equal(links.length, 3, 'arriba, en la calculadora y al final');
  for (const a of links) assert.ok(a.includes(`href="${RUTA_ALTA_PARTNERS}">Hacerme partner gratis<`), a);
  assert.doesNotMatch(pub, /<form/);
  const { html: app } = await landing({ modo: 'app', accion: { href: '/partners', texto: 'Ir a mi panel' } });
  assert.equal((app.match(/<a class="mp-btn" href="\/partners">Ir a mi panel<\/a>/g) ?? []).length, 3);
  assert.match(app, /^<div class="mp-root mp-app">/, 'adentro no es otro <main>');
  assert.doesNotMatch(app.replace(/<style[\s\S]*?<\/style>/, ''), /mp-publica|mp-barra/);
  const { html: sa, t: saT } = await landing({ modo: 'app', accion: null });
  assert.doesNotMatch(sa, /class="mp-btn"/, 'el super admin mira: sin botón');
  assert.doesNotMatch(saT, /te está esperando/);
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

test('NINGUNA pantalla de Partners habla de meses, crédito ni del Acelerador (landing, panel, teléfono, «Tu plan», /planes, los mails)', () => {
  for (const rel of ['app/mako-partners/LandingPartners.tsx', 'app/mako-partners/Calculadora.tsx', 'app/partners/PanelPartner.tsx', 'app/partners/ProgramaPartners.tsx',
    'app/partners/AltaPartner.tsx', 'app/m/partners/ReferidosM.tsx', 'lib/partners-programa.ts']) {
    const f = fuente(rel);
    assert.doesNotMatch(f, /meses gratis|meses de tu plan|como cr[eé]dito|de cr[eé]dito|PROGRAMA_ACELERADOR|comisionDelAcelerador|COMISION_HOY|CREDITO_HOY/i, rel);
  }
  assert.match(fuente('app/configuraciones/plan/PlanPanel.tsx'), /detalle="Con MaKo Partners te llevas el primer mes entero de cada negocio que traigas\." href="\/partners"/);
  assert.match(fuente('app/planes/Vitrina.tsx'), /llévate el primer mes entero de cada negocio que traigas: <Link href="\/mako-partners">MaKo Partners<\/Link>/);
});

// Roturas (25/10/2026; base 27 / 0 con partners-solo-plata, mako-partners-landing, partners-para-clientes y partners-referidos
// juntos), cada una restaurada (pasan / fallan):
//   · el título vuelve a «Gana meses de tu plan»                                -> 25 / 2
//   · la calculadora sale del hero                                              -> 25 / 2
//   · vuelve «Cómo funciona»                                                    -> 26 / 1
//   · la FAQ vuelve a «No. Cada negocio nuevo que traes suma el suyo.»          -> 25 / 2
