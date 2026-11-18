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
import { COMISION_PARTNER_DIRECTO, RUTA_ALTA_PARTNERS } from '../lib/partners-reglas';
import { porcentaje, usd } from '../app/mako-partners/numeros';
import { PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import { COMPARACION } from '../app/mako-partners/comparacion';
import { EN_PRO } from '../app/vsl/_sitio/competencia';

(globalThis as unknown as { React: typeof React }).React = React;
const RAIZ = join(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const fuente = (rel: string) => crudo(rel).replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const texto = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ');

/** Lo que la landing ya no puede decir: los meses, el crédito, el Accelerator y la devolución (25/10), ni el «100% del primer mes» (18/11). */
const VIEJO = /meses de tu plan|meses gratis|cr[eé]dito para|tu cr[eé]dito|Accelerator|1\.500|devoluci[oó]n|devuelvan|garant[ií]a|da de alta a mano|vale el primero|suma el suyo|C[oó]mo funciona|la palabra «MaKo»|100%|primer mes|primeros meses/i;

type Props = { modo?: 'publica' | 'app'; accion?: { href: string; texto: string } | null; rotulo?: React.ReactNode };
async function landing(p: Props = {}): Promise<{ html: string; t: string }> {
  const { LandingPartners } = await import('../app/mako-partners/LandingPartners');
  const html = renderToStaticMarkup(React.createElement(LandingPartners, p));
  return { html, t: texto(html) };
}

test('el TÍTULO dice el 30% (sin «de por vida»), y el subtítulo el ejemplo de 10 negocios en Pro, de la regla', async () => {
  const { html, t } = await landing();
  assert.match(html, /<h1>Recomienda MaKo y llévate el <em>30%<\/em><\/h1>/);
  // Martín, 18/11/2026: «Elimina esto del título: de por vida. Y mejora el copy del subtítulo». El subtítulo decidido, con los US$ 291
  // de la regla (10 × US$ 97 × 30%).
  assert.ok(t.includes('Cada negocio que traes te deja el 30% de lo que paga, todos los meses. Trae 10 y son US$ 291 extra por mes .'), 'el subtítulo');
  assert.match(html, /te deja <b>el 30%<\/b> de lo que paga[\s\S]*?<b class="mp-junto">US\$ 291 extra por mes<\/b>/, 'en negrita, y el monto en un renglón');
  assert.doesNotMatch(t, /de por vida|para siempre/, 'ni «de por vida» ni «para siempre» en la página');
  assert.doesNotMatch(html, /mp-chips/, 'sin los chips: lo dicen el subtítulo y los números');
  assert.doesNotMatch(t, VIEJO, 'nada del «100% del primer mes», ni meses, crédito, Accelerator, devolución, «Cómo funciona» ni el alta a mano');
  assert.ok(!t.includes(PROGRAMA_ACELERADOR.nombre), 'el Accelerator no está en Partners');
  assert.match(fuente('app/mako-partners/page.tsx'), /title: 'MaKo Partners: llévate el 30% de cada pago de cada negocio que traigas'/);
});

test('así de simple (3 pasos en tarjetas), y sin «según cómo pagan»: el partner cobra SIEMPRE el 30% (18/11/2026)', async () => {
  const { html, t } = await landing();
  // Martín: «Elimina "por qué conviene"… y simplemente pon "así de simple", pero con el diseño de las tarjetas».
  assert.doesNotMatch(t, /Por qué conviene|pago único|El 30% es tuyo/);
  assert.match(html, /<h2>Así de simple<\/h2><ol class="mp-pasos">/, 'los pasos, con su diseño');
  assert.equal((html.match(/class="mp-paso-ic"/g) ?? []).length, 3, 'un ícono por paso');
  // Los 3 pasos, en orden, con una línea de texto (Martín: «el texto de abajo es muy largo»).
  assert.match(t, /Así de simple 1 Compartes tu link En redes, grupos o anuncios\. 2 El negocio se suma a MaKo Paga con tu link o tu código\. 3 Cobras del 1 al 5 de cada mes En dólares por Binance o en pesos\./);
  // Martín dio vuelta el modelo (~18:50 UTC): el partner cobra SIEMPRE el 30%; si el negocio paga por pasarela, el recargo se le suma a
  // él en el checkout. Sale la sección «¿30% o 25%?» entera, y nada de la página habla de 25%, de pasarela ni de «según cómo pagan».
  assert.doesNotMatch(t, /25%|27%|pasarela|según cómo pagan|Depende de cómo pague/i, 'nada del 25% ni de la pasarela');
  assert.doesNotMatch(html, /mp-cobro/, 'sin las tarjetas de pago');
  assert.equal((t.match(/dólares por Binance/g) ?? []).length, 1, 'cómo cobras, UNA vez (en el paso 3)');
  // Martín: «elimina lo de "o cuando le cobras tú y nos mandas el resto"… no son agencias».
  assert.doesNotMatch(t, /cobras tú|nos mandas el resto|cualquier plan/i);
});

test('la CALCULADORA: el botón del plan que alterna, el deslizador, el precio en una línea y el botón (siempre al 30%)', async () => {
  const { html, t } = await landing();
  const hero = html.slice(html.indexOf('class="mp-hero-grilla"'), html.indexOf('class="s-tira'));
  assert.ok(hero.includes('class="mp-calc" id="calculadora"'), 'la calculadora está en el hero');
  assert.doesNotMatch(html, /Si se suscribe|mp-ficha/, 'la ficha «Si se suscribe» se fue');
  assert.equal(COMISION_PARTNER_DIRECTO, 0.3, 'el partner cobra el 30%');
  // Martín, 18/11/2026: «que sea mucho más claro», «No pongas textos innecesarios», y en la versión 55 «me faltan como los botones
  // para poder seleccionar… eliminaría el texto "Si pagan por pasarela de pago, te llevas"».)
  const calc = hero.slice(hero.indexOf('class="mp-calc"'));
  const calcT = texto(calc.slice(calc.indexOf('>') + 1, calc.lastIndexOf('</a>') + 4));
  assert.equal(calcT.trim(),
    // Cada botón muestra SÓLO la opción de ahora: el texto completo (computadora) y el corto (teléfono), el CSS muestra uno; el del
    // plan, con su precio debajo.
    'MaKo: US$ 97 MaKo: US$ 97 ¿Cuántos negocios traes? 5 US$ 145,50 al mes US$ 1.746 en un año Hacerme partner',
    'sin JavaScript: 5 negocios con el plan más caro, cobrando directo; y NADA más');
  assert.equal((calc.match(/<input/g) ?? []).length, 1, 'un solo deslizador');
  assert.match(calc, /<input id="mp-calc-n" class="mp-calc-barra" type="range" min="1" max="100"/, 'hasta 100 negocios');
  // Martín: «un único botón que si lo cliqueas cambia a la otra opción y que esté un botón al lado del otro».
  assert.equal((calc.match(/<button/g) ?? []).length, 1, 'un botón: el del plan (el de la forma de pago se fue: siempre es el 30%)');
  assert.ok(calc.includes('aria-label="Plan: MaKo Pro, US$ 97. Cambiar a MaKo Essential, US$ 47"'), 'dice cuál es y a cuál cambia, con el plan completo');
  // Martín: «el pequeño botoncito dentro del botón que se note que es switchable, pero no me convence el ícono».
  assert.equal((calc.match(/class="mp-calc-mini"/g) ?? []).length, 1, 'con su mini interruptor');
  assert.doesNotMatch(calc, /mp-calc-alt-ic|<svg/, 'sin el ícono ⇄');
  assert.doesNotMatch(calcT, /Essential|Pasarela|Transferencia/, 'el botón muestra sólo la opción de ahora, y no hay forma de pago');
  assert.doesNotMatch(calcT, /Binance|%/, 'sin «Binance» ni el porcentaje en los interruptores');
  assert.ok(calcT.indexOf('MaKo: US$ 97') < calcT.indexOf('¿Cuántos negocios traes?'), 'el botón, arriba del deslizador');
  // En el teléfono, los nombres cortos con letra de 14 px (el Cerebro: «13 px o más»).
  const cssCalc = fuente('app/mako-partners/LandingPartners.tsx');
  assert.match(cssCalc, /\.mp-calc-alt-largo, \.mp-calc-alt-corto \{ font-size: clamp\(15px, [^;]*, 18px\); font-weight: 600;/, 'grande y en semibold');
  assert.match(cssCalc, /\.mp-calc-alt:not\(\.tocado\) \.mp-calc-mini \{ animation: mp-late 2s ease-in-out \.6s infinite; \}/, 'late hasta que lo tocan');
  assert.doesNotMatch(calcT, /Si pagan por pasarela|negocios ×/, 'ni la línea de la pasarela ni la cuenta');
  assert.equal((calc.match(/<a /g) ?? []).length, 1, 'una sola llamada a la acción');
  const { gananciaPorMes, gananciaEnUnAnio } = await import('../app/mako-partners/numeros');
  assert.equal(gananciaPorMes(10, 97), 291);
  assert.equal(gananciaPorMes(1, 47), 14.1);
  assert.equal(gananciaPorMes(3.9, 47), 42.3, 'negocios enteros');
  assert.equal(gananciaPorMes(-2, 97), 0);
  assert.equal(gananciaEnUnAnio(5, 97), 1746);
  assert.equal(usd(1571.4), 'US$ 1.571,40', 'con centavos, los dos');
  assert.equal(usd(1746), 'US$ 1.746', 'sin centavos si no los hay');
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  assert.match(css, /\.mp-calc \{[^}]*linear-gradient\(140deg, var\(--mp-azul\) 0%, var\(--mp-azul-osc\) 100%\)/, 'todo el bloque es el azul');
  const fuenteCalc = fuente('app/mako-partners/Calculadora.tsx');
  assert.doesNotMatch(fuenteCalc, /mp-calc-entrada|tasa|conversi/i, 'sin la mitad blanca ni tasas inventadas');
  assert.doesNotMatch(fuenteCalc, /\b0\.[23]\d*\b|\b(2[57]|30) ?%/, 'los porcentajes salen de la regla, no escritos');
});

test('las PREGUNTAS: sólo las dudas que no están arriba, y «¿Cuándo cobro?» con el 1 al 5', async () => {
  const { html, t } = await landing();
  const faq = t.slice(t.indexOf('Preguntas frecuentes'), t.indexOf('Empieza a ganar con tu link'));
  const preguntas = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => texto(m[1]).trim());
  assert.deepEqual(preguntas, ['¿Cuándo cobro?', '¿Quién cuenta como mi referido?', '¿Dónde veo lo que gané?', '¿Qué necesito para ser partner?']);
  // Martín: «¿cuándo cobro? No responde que se paga del 1 al 5».
  assert.match(faq, /¿Cuándo cobro\? Del 1 al 5 de cada mes, por todo lo que ganaste el mes anterior\./);
  assert.match(faq, /Cualquier negocio que todavía no usa MaKo y entra con tu link o pone tu código al pagar\. Tu propio negocio no cuenta\./);
  assert.match(faq, /En tu panel de MaKo Partners: cada negocio que trajiste, lo que te deja y lo que tienes a cobrar\./);
  // Ser partner pide tener el plan de MaKo pago (Martín, 18/11/2026: «de hecho no es gratis»): ningún «gratis» en la landing.
  // Martín: «sí o sí necesitan el plan de 97, el de MaKo Pro» (el precio, de los planes).
  assert.match(faq, /Tener tu plan MaKo Pro activo \(US\$ 97 al mes\)\. Si tu plan se corta, lo que ganaste no se pierde: te lo pagamos cuando lo reactivas\./);
  assert.doesNotMatch(t, /gratis/i, 'ningún «gratis» sobre ser partner');
  assert.doesNotMatch(t, /segundo mes|2º pago|segundo pago|¿Siempre es el/, 'ya no se espera al 2º pago');
  assert.match(t, /Empieza a ganar con tu link/, 'el cierre');
  assert.doesNotMatch(t, /te está esperando|Hazte partner en un minuto/, 'el cierre, una frase y el botón');
});

test('UNA acción, un link: hacerse partner (al alta), volver al panel, o ninguna (el super admin)', async () => {
  const { html: pub } = await landing();
  const links = pub.match(/<a class="mp-btn" href="[^"]+">[^<]+<\/a>/g) ?? [];
  assert.equal(links.length, 3, 'arriba, en la calculadora y al final');
  for (const a of links) assert.ok(a.includes(`href="${RUTA_ALTA_PARTNERS}">Hacerme partner<`), a);
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
    assert.doesNotMatch(f, /meses gratis|meses de tu plan|como cr[eé]dito|(?<!tarjeta )de cr[eé]dito|PROGRAMA_ACELERADOR|comisionDelAcelerador|COMISION_HOY|CREDITO_HOY/i, rel);
  }
  // «Tu plan» y /planes dicen el 30% de por vida, del número de la regla (18/11/2026).
  assert.ok(fuente('app/configuraciones/plan/PlanPanel.tsx').includes(
    'detalle={`Con MaKo Partners te llevas el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que traigas, todos los meses.`} href="/partners"'));
  assert.ok(fuente('app/configuraciones/plan/PlanPanel.tsx').includes('de cada pago de cada negocio que entra por él, todos los meses, mientras el negocio siga en MaKo.'));
  // Se dice igual en todos lados (el Cerebro, 18/11): sin «de por vida» en «Tu plan», /planes ni la regla de la API.
  for (const rel of ['app/configuraciones/plan/PlanPanel.tsx', 'app/planes/Vitrina.tsx', 'app/mako-partners/numeros.ts', 'app/mako-partners/LandingPartners.tsx']) {
    assert.doesNotMatch(fuente(rel), /de por vida/, rel);
  }
  assert.ok(fuente('app/planes/Vitrina.tsx').includes(
    'llévate el {PORCENTAJE_DIRECTO} de cada pago de cada negocio que traigas, todos los meses, mientras siga en MaKo: <Link href="/mako-partners">MaKo Partners</Link>'));
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
    'app/mako-partners/page.tsx', 'app/configuraciones/plan/PlanPanel.tsx', 'app/planes/Vitrina.tsx',
    'lib/api-mako/areas/negocio.def.ts', 'lib/api-mako/areas/negocio.run.ts']) {
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

test('la API de MaKo (lo que lee MaKo para contestar) dice la regla nueva: el 30% de cada pago, todos los meses, del 1 al 5', async () => {
  const { REGLA_PARTNERS, REGLA_PARTNERS_CORTA, CUANDO_SE_PAGA_PARTNERS } = await import('../app/mako-partners/numeros');
  assert.ok(REGLA_PARTNERS.startsWith('el 30% de cada pago de cada negocio nuevo que entra con su link o su código, todos los meses, mientras el negocio siga en MaKo'), REGLA_PARTNERS);
  assert.ok(REGLA_PARTNERS.includes('(US$ 29,10 por mes por cada MaKo Pro y US$ 14,10 por mes por cada MaKo Essential)'), 'lo directo, escrito');
  assert.equal(REGLA_PARTNERS_CORTA, 'el 30% de cada pago de cada negocio que traiga, todos los meses, mientras siga en MaKo');
  // Siempre el 30% (18/11, ~18:50 UTC): ni 25% ni pasarela en lo que dice MaKo, ni en «Tu plan» ni en /planes.
  assert.doesNotMatch(REGLA_PARTNERS + REGLA_PARTNERS_CORTA, /25%|27%|pasarela/i);
  for (const rel of ['app/configuraciones/plan/PlanPanel.tsx', 'app/planes/Vitrina.tsx', 'app/mako-partners/numeros.ts', 'app/mako-partners/Calculadora.tsx']) {
    const f = fuente(rel);
    assert.doesNotMatch(f, /COMISION_PARTNER_PASARELA|PORCENTAJE_PASARELA|\b2[57] ?%/, `${rel}: sin el 25% de la pasarela`);
  }
  assert.match(CUANDO_SE_PAGA_PARTNERS, /^del 1 al 5 de cada mes/);
  const def = fuente('lib/api-mako/areas/negocio.def.ts');
  assert.ok(def.includes('MaKo Partners paga en DINERO ${REGLA_PARTNERS}. Se le paga ${CUANDO_SE_PAGA_PARTNERS}.'), 'la descripción de ver_mi_programa_partners');
  const run = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.ok(run.includes('gana: `${REGLA_PARTNERS}, en dinero`, se_le_paga: CUANDO_SE_PAGA_PARTNERS'), 'el que todavía no es partner');
  assert.ok(run.includes("gana: REGLA_PARTNERS, cuando_se_gana: 'cada vez que uno de sus negocios paga: su parte de ese pago', se_le_paga: CUANDO_SE_PAGA_PARTNERS"), 'el partner');
  assert.ok(run.includes('Gana ${REGLA_PARTNERS_CORTA}.'), 'el resumen de hacerme_partner');
  assert.doesNotMatch(run, /PAGOS_PARA_ACREDITAR|gananciaDelReferido/, 'ya no se espera al 2º pago ni se cuenta el primer mes');
});

test('los botones de llamada a la acción van en MAYÚSCULA por la clase (Martín, 18/11/2026: «Todos los botones de CTA»)', () => {
  const css = fuente('app/mako-partners/LandingPartners.tsx').match(/const CSS = `([\s\S]*?)`;/)![1];
  assert.match(css, /\.mp-btn \{[^}]*text-transform: uppercase; letter-spacing: \.04em;/, 'los tres «HACERME PARTNER»');
  assert.match(fuente('app/planes/Vitrina.tsx'), /\.cp-btn \{[^}]*text-transform: uppercase; letter-spacing: \.03em; \}/, 'los de la tabla de /planes');
});

test('/mako-partners lleva la barra del sitio arriba y el pie abajo, como /planes (Martín, 18/11/2026: «falta… la top bar»)', () => {
  const pagina = fuente('app/mako-partners/page.tsx');
  assert.match(pagina, /<BarraGlobal claro barraPropia=".mp-publica .mp-barra" \/>/, 'la barra del sitio, y la propia oculta');
  assert.match(pagina, /<PieGlobal claro \/>/, 'el pie del sitio');
});

test('el carrusel de Partners: entre el héroe y «Así de simple», con los rubros de Industrias y el mismo estilo que la portada', async () => {
  const { html } = await landing();
  const { INDUSTRIAS } = await import('../app/vsl/_sitio/datos');
  const i = html.indexOf('class="s-tira s-reemplaza-claro mp-tira"');
  assert.ok(i > html.indexOf('class="mp-hero-grilla"') && i < html.indexOf('<h2>Así de simple</h2>'), 'entre el héroe y «Así de simple»');
  const tira = html.slice(html.indexOf('>', i) + 1, html.indexOf('</section>', i));
  assert.match(texto(tira), /^\s*A quién le puedes recomendar MaKo/);
  for (const r of INDUSTRIAS) assert.ok(tira.includes(`</svg></span>${r.nombre}</li>`), `el rubro ${r.nombre}, con su ícono`);
  assert.equal((tira.match(/class="s-tira-l"/g) ?? []).length, 2, 'dos vueltas iguales, la segunda oculta para el lector, como la portada');
  assert.ok(fuente('app/mako-partners/LandingPartners.tsx').includes('CSS_REEMPLAZA + CSS'), 'el mismo CSS del carrusel de la portada');
});

test('el deslizador frena en 20, 50 y 100 (Martín: «una muy pequeña frenada»), sólo al arrastrar', async () => {
  const { iman, MARCAS_NEGOCIOS } = await import('../app/mako-partners/Calculadora');
  assert.deepEqual([...MARCAS_NEGOCIOS], [20, 50, 100]);
  for (const [v, sale] of [[17, 17], [18, 20], [22, 20], [23, 23], [48, 50], [52, 50], [98, 100], [5, 5]]) assert.equal(iman(v), sale, `${v} → ${sale}`);
  const c = fuente('app/mako-partners/Calculadora.tsx');
  assert.ok(c.includes('setN(arrastrando.current ? iman(v) : v)'), 'el imán sólo al arrastrar: con el teclado sigue de a 1');
});

test('«¿Por qué ser partner de MaKo te conviene?»: seis beneficios y «MaKo vs GoHighLevel» con el componente del sitio, cada fila con su fuente (18/11/2026)', async () => {
  const { html, t } = await landing();
  const h2 = '<h2>¿Por qué ser partner de MaKo <em class="mp-conviene">te conviene</em>?</h2>';
  assert.ok(html.includes(h2), '«te conviene» con el degradé de la marca');
  assert.ok(html.indexOf(h2) > html.indexOf('<h2>Así de simple</h2>') && html.indexOf(h2) < html.indexOf('<h2>Preguntas frecuentes</h2>'), 'entre «Así de simple» y las preguntas');
  assert.match(html, /<section class="mp-seccion mp-conviene-sec">/, 'la sección fuerte, con más aire');
  const pct = porcentaje(COMISION_PARTNER_DIRECTO);
  assert.ok(t.includes('Todo en una sola app CRM, WhatsApp, automatizaciones, anuncios e IA juntos. Dejan de pagar varias herramientas y no quieren volver atrás. '
    + `Ingresos que duran Un negocio que lo tiene todo en MaKo no se va. Y tu ${pct} sigue entrando, mes tras mes. `
    + 'Fácil de usar Lo aprenden solos con el onboarding y los tutoriales. Nadie te escribe para preguntarte cómo se usa. '
    + 'Soporte prioritario Si algo les pasa, les respondemos nosotros en su grupo de WhatsApp. Tú sólo cobras. '
    + 'Hecha para Latinoamérica Pensada para cómo se vende en Latinoamérica: por WhatsApp y en español. Y se paga por transferencia, Mercado Pago o Binance. '
    + 'Te ayudamos a vender Nunca vendes sin ayuda: material listo con tu link, te ayudamos con tus anuncios y respondemos las dudas de tus contactos antes de que compren.'),
    'las seis tarjetas, en orden (el 30%, de la constante)');
  assert.equal((html.match(/class="mp-ventaja-ic"/g) ?? []).length, 6, 'un ícono por tarjeta');
  assert.doesNotMatch(t, /Recomendar MaKo es fácil|Hace de todo|en vez de diez|cinco herramientas|rápido y en persona|No te dejamos solo|cobrando por/,
    'lo que se fue, los números inventados y lo que no se puede prometer');
  const recursos = fuente('lib/partners-recursos.ts');
  assert.ok(recursos.includes('export function pdfDeVenta') && recursos.includes('export function mensajesParaCopiar'), 'el material que la tarjeta promete existe');
  assert.doesNotMatch(t, /clases|videos|audios/i, 'nada de material que todavía no existe');

  // La comparación: el MISMO componente de las comparaciones del sitio (TarjetasVs), con UNA tarjeta, la de GoHighLevel.
  assert.ok(fuente('app/mako-partners/LandingPartners.tsx').includes('<TarjetasVs solo={[COMPARACION_CON]}'), 'el componente del sitio, no una copia');
  assert.equal((html.match(/<label class="s-vs">/g) ?? []).length, 1, 'una sola tarjeta');
  assert.ok(t.includes('MaKo vs GoHighLevel'));
  assert.ok(html.indexOf('<label class="s-vs">') > html.indexOf(h2) && html.indexOf('<label class="s-vs">') < html.indexOf('<h2>Preguntas frecuentes</h2>'));
  const panel = html.slice(html.indexOf('id="vs-gohighlevel"'), html.indexOf('<h2>Preguntas frecuentes</h2>'));
  const filas = [...panel.matchAll(/<th scope="row" class="s-mx-c0">([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(filas, ['Soporte por WhatsApp', 'Centro de ayuda en español', 'WhatsApp incluido en el plan', 'IA que contesta a tus clientes', 'Precio de entrada']);
  // ⚠️ Cada fila sobre GoHighLevel es verdad y tiene su fuente en su sitio oficial. Sin fuente, no entra.
  for (const f of COMPARACION) assert.match(f.otra.fuente ?? '', /^https:\/\/(www\.|help\.)?gohighlevel\.com\//, `${f.nombre}: la fuente es de GoHighLevel`);
  // Lo de MaKo, derivado: el setter con IA es de Pro, el precio es el de Essential.
  assert.equal(COMPARACION[3].mako.v, EN_PRO);
  assert.equal(COMPARACION[4].mako.v, `Desde ${usd(PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')!.precioUsd)} al mes`);
  assert.ok(texto(panel).includes('Precio de entrada Desde US$ 47 al mes Desde US$ 97 al mes'));
  assert.ok(texto(panel).includes('Datos de gohighlevel.com y de su centro de ayuda, noviembre de 2026.'), 'la comparación, con fecha');
  // Sin la comisión (ellos pagan 40% y juega en contra: Martín compite por valor).
  assert.doesNotMatch(texto(panel), /comisi[oó]n|40 ?%|recurrente/i);
});
