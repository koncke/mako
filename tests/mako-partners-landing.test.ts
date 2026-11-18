// =============================================================================
// La landing de MaKo Partners: la que vende, con la calculadora azul, y que no promete lo que no pasa (24/10/2026; 25/10;
// el 30% de por vida, 18/11/2026)
// =============================================================================
// EL PROGRAMA NUEVO (18/11/2026, Martín por el Cerebro: «Me gusta la misma… solamente calculado a esto»): la misma página,
// recalculada. El partner se lleva el 30% de CADA pago de cada negocio que trae, todos los meses, para siempre, si la plata entra
// por Binance o transferencia, y menos si entra por una pasarela o un link de pago (el 27% del primer anuncio; Martín lo bajó al
// 25% el mismo 18/11). Los porcentajes y la cuenta son de lib/partners-reglas.ts (`COMISION_PARTNER_DIRECTO`,
// `COMISION_PARTNER_PASARELA`, `comisionDelPago`, del chat de Cobros). Lo directo se prueba ESCRITO (30%: Pro US$ 97 → US$ 29,10,
// Essential US$ 47 → US$ 14,10), para que un cambio en la regla se note acá; lo de la pasarela se prueba CONTRA la constante, que
// Cobros cambia por su lado (que el test no se rompa cuando la mueve, y que la landing la siga).
//
// LO DE ANTES QUE SIGUE (Martín, 25/10/2026): sólo dinero (nada de meses, crédito, Accelerator ni devolución); la calculadora es
// UN bloque azul en el hero; sin «Cómo funciona» ni el aviso del alta a mano; UNA acción (un link): hacerse partner
// (`RUTA_ALTA_PARTNERS`), volver al panel, o ninguna (el super admin mirando); adentro de la app, los colores del tema.
//
// Probado rompiéndolo: al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, DIAS_COOKIE_REF, PAGO_HOY, RUTA_ALTA_PARTNERS, comisionDelPago } from '../lib/partners-reglas';
import { porcentaje, usd } from '../app/mako-partners/numeros';
import { PROGRAMA_ACELERADOR } from '../lib/planes-mako';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const fuente = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** Lo de la pasarela, de la constante: «25%» y los montos por mes de Pro (US$ 97) y Essential (US$ 47). */
const PASARELA = porcentaje(COMISION_PARTNER_PASARELA);
const pasarelaPro = usd(comisionDelPago(97, 'pasarela')), pasarelaEssential = usd(comisionDelPago(47, 'pasarela'));
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

/** Lo que la landing ya no puede decir: los meses, el crédito, el Accelerator y la devolución (25/10), ni el «100% del primer mes» (18/11). */
const VIEJO = /meses de tu plan|meses gratis|cr[eé]dito para|tu cr[eé]dito|Accelerator|1\.500|devoluci[oó]n|devuelvan|garant[ií]a|da de alta a mano|vale el primero|suma el suyo|C[oó]mo funciona|la palabra «MaKo»|100%|primer mes|primeros meses/i;

type Props = { modo?: 'publica' | 'app'; accion?: { href: string; texto: string } | null; rotulo?: React.ReactNode };
async function landing(p: Props = {}): Promise<{ html: string; t: string }> {
  const { LandingPartners } = await import('../app/mako-partners/LandingPartners');
  const html = renderToStaticMarkup(React.createElement(LandingPartners, p));
  return { html, t: texto(html) };
}

test('el TÍTULO dice el 30% de por vida, y la bajada cuánto por mes y por plan, en dinero', async () => {
  const { html, t } = await landing();
  assert.match(html, /<h1>Recomienda MaKo y llévate el <em>30%<\/em> de por vida<\/h1>/);
  assert.ok(t.includes('el 30% de cada pago, todos los meses, para siempre : US$ 29,10 al mes por cada MaKo Pro y US$ 14,10 por cada MaKo Essential, en dinero. Negocios ilimitados.'), 'la bajada');
  assert.match(t, /Todos los meses/);
  assert.match(t, /Cobras en dinero/);
  assert.doesNotMatch(t, VIEJO, 'nada del «100% del primer mes», ni meses, crédito, Accelerator, devolución, «Cómo funciona» ni el alta a mano');
  assert.ok(!t.includes(PROGRAMA_ACELERADOR.nombre), 'el Accelerator no está en Partners');
  assert.match(fuente('app/mako-partners/page.tsx'), /title: 'MaKo Partners: llévate el 30% de cada pago de cada negocio que traigas, de por vida'/);
});

test('los TRES NÚMEROS grandes: el 30%, lo del mes con Pro, ilimitado', async () => {
  const { html } = await landing();
  const numeros = texto(html.slice(html.indexOf('class="mp-numeros"'), html.indexOf('</ul>', html.indexOf('class="mp-numeros"'))));
  assert.match(numeros, /30% de cada pago de cada negocio que traes, todos los meses\./);
  assert.match(numeros, /US\$ 29,10 al mes por cada negocio que elige MaKo Pro \./);
  assert.match(numeros, /Ilimitado Traes 10 negocios, cobras 10 veces cada mes\. Traes 100, cobras 100 \./);
  assert.match(texto(html), /El 30% es tuyo de por vida/);
});

test('la CALCULADORA: un bloque azul en el hero, con cómo te pagan, lo de cada mes y lo de 12 meses', async () => {
  const { html, t } = await landing();
  const hero = html.slice(html.indexOf('class="mp-hero-grilla"'), html.indexOf('class="mp-seccion"'));
  assert.ok(hero.includes('class="mp-calc" id="calculadora"'), 'la calculadora está en el hero');
  assert.doesNotMatch(html, /Si se suscribe|mp-ficha/, 'la ficha «Si se suscribe» se fue');
  assert.ok(t.includes(`Cómo te pagan los negocios Binance o transferencia (30%) Pasarela de pago (${PASARELA})`), 'el selector, con sus dos porcentajes');
  assert.ok(COMISION_PARTNER_DIRECTO === 0.3 && COMISION_PARTNER_PASARELA > 0 && COMISION_PARTNER_PASARELA < COMISION_PARTNER_DIRECTO,
    'directo 30%, y la pasarela, menos');
  assert.match(t, /Te llevas cada mes US\$ 145,50 En 12 meses: US\$ 1\.746 5 negocios × US\$ 29,10: el 30% de cada MaKo Pro, todos los meses/,
    'sin JavaScript: 5 negocios en el plan más caro, cobrando directo');
  const { gananciaPorMes, gananciaEnUnAnio, usd } = await import('../app/mako-partners/numeros');
  assert.equal(gananciaPorMes(10, 97, 'directo'), 291);
  assert.equal(gananciaPorMes(10, 97, 'pasarela'), Math.round(10 * comisionDelPago(97, 'pasarela') * 100) / 100);
  assert.equal(gananciaPorMes(1, 47, 'directo'), 14.1);
  assert.equal(usd(gananciaPorMes(1, 47, 'pasarela')), pasarelaEssential);
  assert.equal(gananciaPorMes(3.9, 47, 'directo'), 42.3, 'negocios enteros');
  assert.equal(gananciaPorMes(-2, 97, 'directo'), 0);
  assert.equal(gananciaEnUnAnio(5, 97, 'directo'), 1746);
  assert.equal(gananciaEnUnAnio(5, 97, 'pasarela'), Math.round(5 * comisionDelPago(97, 'pasarela') * 12 * 100) / 100);
  assert.equal(usd(1571.4), 'US$ 1.571,40', 'con centavos, los dos');
  assert.equal(usd(1746), 'US$ 1.746', 'sin centavos si no los hay');
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  assert.match(css, /\.mp-calc \{[^}]*linear-gradient\(140deg, var\(--mp-azul\) 0%, var\(--mp-azul-osc\) 100%\)/, 'todo el bloque es el azul');
  const calc = fuente('app/mako-partners/Calculadora.tsx');
  assert.doesNotMatch(calc, /mp-calc-entrada|tasa|conversi/i, 'sin la mitad blanca ni tasas inventadas');
  assert.doesNotMatch(calc, /\b0\.[23]\d*\b|\b(2[57]|30) ?%/, 'los porcentajes salen de la regla, no escritos');
});

test('las PREGUNTAS: cuánto, por qué 30% o 27%, cada pago, y lo de siempre', async () => {
  const { t } = await landing();
  const preguntas = ['¿Cuánto gano?', '¿Siempre es el 30%?', '¿Cuándo cobro?', '¿Hay un límite?', '¿Quién cuenta como mi referido?', '¿Y si no entra con mi link?',
    '¿Cuánto dura mi link?', '¿Puedo hacer anuncios con mi link?', '¿Cuesta algo ser partner?'];
  for (const q of preguntas) assert.ok(t.includes(q), q);
  assert.match(t, /El 30% de cada pago de cada negocio que entra con tu link, todos los meses, para siempre: US\$ 29,10 al mes por cada MaKo Pro y US\$ 14,10 por cada MaKo Essential\. Es dinero, no crédito ni descuentos\./);
  assert.match(t, /Binance o transferencia bancaria , o si le cobras tú y nos mandas el 70% por Binance o transferencia, te llevas el 30% \./);
  assert.ok(t.includes(`pasarela o un link de pago (Mercado Pago, tarjeta, Whop), el ${PASARELA} : ${pasarelaPro} al mes por cada MaKo Pro y ${pasarelaEssential} por cada MaKo Essential.`),
    'la pasarela, con su porcentaje y sus montos');
  // Cobros, 18/11: la acreditación es por cada pago; no se promete fecha, y el pago sigue siendo una transferencia de MaKo.
  assert.ok(t.includes(`Cada vez que el negocio paga, tu parte de ese pago pasa a «A cobrar» en tu panel. ${PAGO_HOY}`), 'cuándo cobro: cada pago');
  assert.doesNotMatch(t, /segundo mes|2º pago|segundo pago/, 'ya no se espera al 2º pago');
  assert.match(t, /Ninguno\. Traes 10 negocios, cobras 10 veces cada mes\. Traes 100, cobras 100\./);
  assert.match(t, /Sí\. Compártelo donde quieras: tus redes, tus grupos de WhatsApp, tu newsletter o tus anuncios\./);
  assert.ok(t.includes(`${DIAS_COOKIE_REF} días. Si alguien lo abre hoy`), 'cuánto dura, sin «vale el primero»');
  assert.match(t, /pone tu código al pagar/, 'el código del carrito');
  assert.doesNotMatch(t, /¿Y si soy agencia\?/, 'lo de agencia salió de Partners');
  assert.match(t, /Tu 30% de por vida te está esperando/, 'el cierre');
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
  assert.doesNotMatch(p.replace(/const CSS = `[\s\S]*?`;/, ''), /US\$ ?\d|\b(47|97|60) días|\b0\.[23]\d*\b|\b(2[57]|30|70) ?%/, 'ningún número a mano');
});

test('adentro de la app, la landing usa los colores de la app (cambia con el tema), no los fijos de la pública', () => {
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  const app = css.match(/\.mp-root\.mp-app \{([^}]*)\}/)![1];
  for (const v of ['--mp-ink: var(--ink)', '--mp-azul: var(--primary)', '--mp-sup: var(--surface)', '--mp-sobre-azul: var(--on-primary']) assert.ok(app.includes(v), v);
  assert.doesNotMatch(app, /var\(--accent\)/, 'el --accent de la app es el DORADO, no el azul');
  assert.match(css, /body:has\(\.mp-publica\) aside \{ display: none !important; \}/, 'sólo la pública esconde la barra');
  assert.doesNotMatch(css, /body:has\(\.mp-root\)/, 'la tab no esconde la barra de la app');
});

test('NINGUNA pantalla de Partners habla de meses, crédito ni del Accelerator (landing, panel, teléfono, «Tu plan», /planes, los mails)', () => {
  for (const rel of ['app/mako-partners/LandingPartners.tsx', 'app/mako-partners/Calculadora.tsx', 'app/partners/PanelPartner.tsx', 'app/partners/ProgramaPartners.tsx',
    'app/partners/AltaPartner.tsx', 'app/m/partners/ReferidosM.tsx', 'lib/partners-programa.ts']) {
    const f = fuente(rel);
    assert.doesNotMatch(f, /meses gratis|meses de tu plan|como cr[eé]dito|de cr[eé]dito|PROGRAMA_ACELERADOR|comisionDelAcelerador|COMISION_HOY|CREDITO_HOY/i, rel);
  }
  // «Tu plan» y /planes dicen el 30% de por vida, del número de la regla (18/11/2026).
  assert.ok(fuente('app/configuraciones/plan/PlanPanel.tsx').includes(
    'detalle={`Con MaKo Partners te llevas el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que traigas, todos los meses.`} href="/partners"'));
  assert.ok(fuente('app/planes/Vitrina.tsx').includes(
    'llévate el {PORCENTAJE_DIRECTO} de cada pago de cada negocio que traigas, de por vida: <Link href="/mako-partners">MaKo Partners</Link>'));
});

/**
 * «EL PRIMER MES ENTERO» NO VUELVE A NINGUNA PANTALLA (el Cerebro, 18/11/2026). Se busca en TODO app/ y lib/ (sin comentarios).
 * Hoy lo dicen todavía pantallas de otros chats, que se pasan al 30% por su lado: quedan anotadas con su dueño. La lista sólo
 * puede achicarse; un archivo nuevo que lo diga es rojo.
 */
const DICEN_EL_PRIMER_MES_TODAVIA: Readonly<Record<string, string>> = {
  'app/admin/dev/customer-success/bitacora.ts': 'la bitácora: es historia, cuenta lo que se hizo el 25/10',
  'app/partners/PanelPartner.tsx': 'Cobros',
  'app/partners/ProgramaPartners.tsx': 'Cobros',
  'app/m/partners/ReferidosM.tsx': 'Cobros',
  'lib/partners-programa.ts': 'Cobros',
  'lib/partners-reglas.ts': 'Cobros',
  'lib/api-mako/areas/negocio.def.ts': 'la API de MaKo (sin dueño el 18/11)',
  'lib/api-mako/areas/negocio.run.ts': 'la API de MaKo (sin dueño el 18/11)',
  'lib/tutoriales/partners.ts': 'los tutoriales',
};

test('«el primer mes entero» / «el 100% del primer mes» no aparece en ninguna pantalla nueva', () => {
  const archivos: string[] = [];
  const recorrer = (rel: string) => {
    for (const n of readdirSync(join(RAIZ, rel))) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const r = `${rel}/${n}`;
      if (statSync(join(RAIZ, r)).isDirectory()) recorrer(r);
      else if (/\.(tsx?|mts)$/.test(n)) archivos.push(r);
    }
  };
  recorrer('app');
  recorrer('lib');
  const dicen = archivos.filter((r) => /primer mes entero|100% del primer mes/i.test(fuente(r)));
  const nuevos = dicen.filter((r) => !(r in DICEN_EL_PRIMER_MES_TODAVIA));
  assert.deepEqual(nuevos, [], `vuelve «el primer mes entero» en: ${nuevos.join(', ')}`);
  for (const mio of ['app/mako-partners/LandingPartners.tsx', 'app/mako-partners/Calculadora.tsx', 'app/mako-partners/numeros.ts',
    'app/mako-partners/page.tsx', 'app/configuraciones/plan/PlanPanel.tsx', 'app/planes/Vitrina.tsx']) {
    assert.ok(!(mio in DICEN_EL_PRIMER_MES_TODAVIA) && !dicen.includes(mio), mio);
  }
});

// Roturas (18/11/2026), cada una restaurada; con las reglas de Cobros en su punta (TSX_TSCONFIG_PATH al tsconfig del artefacto):
//   · el título vuelve al «100% de lo que vendes»                               -> rojo
//   · la calculadora pierde el selector de cómo pagan                           -> rojo
//   · la calculadora vuelve a contar el primer mes (sin el porcentaje)          -> rojo
//   · «¿Cuándo cobro?» vuelve a esperar el 2º pago                              -> rojo
//   · un 30% escrito a mano en la landing                                       -> rojo
//   · PlanPanel vuelve a «el primer mes entero»                                 -> rojo
//   · una pantalla nueva dice «el 100% del primer mes»                          -> rojo
