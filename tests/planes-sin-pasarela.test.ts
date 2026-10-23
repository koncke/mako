// =============================================================================
// Los planes de MaKo SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Pedido del Cerebro para el lanzamiento del 25/10: la pasarela de MaKo todavía no está conectada (la conecta Martín en
// /integraciones?ws=9), y cada pantalla de compra tiene que tener una salida de verdad mientras tanto. Lo que se fija acá:
//   · /planes no dice «Empezar con…» de un plan que no se puede pagar: lleva a la agenda, con las UTM de la campaña.
//   · /planes/<plan> sin pasarela no es un callejón: la agenda, no un «Escríbenos» sin a dónde.
//   · «Tu plan» ofrece pasar a Pro por llamada a quien está en Esencial sin la subida en el acto (los carteles de tope
//     llevan ahí con «Pasar a Pro»).
//   · /mako-partners no nombra un plan que ya no existe (Growth).
//
// Probado rompiéndolo (23/10/2026; base 7 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · `botonDelPlan` devuelve «Empezar con…» aunque no sea cobrable                    -> 6 / 1
//   · `agendaConOrigen` pasa también `fbclid`                                          -> 6 / 1
//   · `bajadaDePlanes` dice «entras en el acto» siempre                                -> 6 / 1
//   · `proPorLlamada` también para la capa `agencia`                                   -> 6 / 1
//   · /planes vuelve a armar el botón a mano con `/planes/${p.id}`                     -> 6 / 1
//   · /planes/<plan> sin pasarela sin el link a la agenda                              -> 6 / 1
//   · «Tu plan» sin pasar `porLlamada` al panel                                        -> 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENDA_MAKO, agendaConOrigen, bajadaDePlanes, botonDelPlan } from '../lib/compra-plan-reglas';
import { proPorLlamada } from '../lib/subir-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('la agenda lleva las UTM de la campaña, y nada más (ni el fbclid ni el slug de la landing)', () => {
  assert.equal(agendaConOrigen(null), AGENDA_MAKO);
  assert.equal(agendaConOrigen({ landing: 'inmobiliarias', fbclid: 'abc' }), AGENDA_MAKO);
  const url = new URL(agendaConOrigen({ utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'lanzamiento 25/10', utm_content: 'video-1', fbclid: 'abc', landing: 'x' }));
  assert.equal(`${url.origin}${url.pathname}`, AGENDA_MAKO);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
  assert.equal(url.searchParams.get('utm_campaign'), 'lanzamiento 25/10');
});

test('el botón del plan: «Empezar» sólo si se puede pagar; si no, «Agendar una llamada» hacia afuera', () => {
  const cobrable = botonDelPlan({ id: 'pro', nombre: 'MaKo Pro', cobrable: true, sufijo: '?ref=ana', origen: null });
  assert.deepEqual(cobrable, { href: '/planes/pro?ref=ana', texto: 'Empezar con MaKo Pro', afuera: false });
  const sinPasarela = botonDelPlan({ id: 'pro', nombre: 'MaKo Pro', cobrable: false, sufijo: '?ref=ana', origen: { utm_source: 'ig' } });
  assert.equal(sinPasarela.texto, 'Agendar una llamada');
  assert.equal(sinPasarela.afuera, true);
  assert.equal(sinPasarela.href, `${AGENDA_MAKO}?utm_source=ig`);
});

test('la bajada de /planes: «entras en el acto» sólo si algún plan se puede pagar en línea', () => {
  assert.match(bajadaDePlanes(true), /entras en el acto/);
  assert.doesNotMatch(bajadaDePlanes(false), /en el acto/);
  assert.match(bajadaDePlanes(false), /Agenda una llamada/);
});

test('«Pasar a Pro» por llamada: sólo desde Esencial y sólo sin la subida en el acto', () => {
  assert.equal(proPorLlamada({ capa: 'completo', subidaEnLinea: false }), true);
  assert.equal(proPorLlamada({ capa: 'completo', subidaEnLinea: true }), false, 'con pasarela, la subida en el acto');
  assert.equal(proPorLlamada({ capa: 'agencia', subidaEnLinea: false }), false, 'Pro no sube a nada');
  assert.equal(proPorLlamada({ capa: null, subidaEnLinea: false }), false);
});

test('/planes arma el botón con la regla y decide por plan con la misma cuenta que el checkout', () => {
  const pagina = fuente('app/planes/page.tsx');
  assert.match(pagina, /botonDelPlan\(/);
  assert.match(pagina, /ofertasDeLosPlanes\(\)/);
  assert.doesNotMatch(pagina, /`\/planes\/\$\{p\.id\}/, 'el href del plan sale de botonDelPlan, no a mano');
  const lib = fuente('lib/compra-plan.ts');
  const ofertas = lib.slice(lib.indexOf('export async function ofertasDeLosPlanes'), lib.indexOf('export async function ofertasDeLosPlanes') + 700);
  assert.match(ofertas, /precioEn\(plan, m\.moneda\) != null/);
  assert.match(ofertas, /catch/, 'sin poder leer las pasarelas, ninguno es cobrable (no se rompe la página)');
});

test('/planes/<plan> sin pasarela lleva a la agenda, con el origen', () => {
  const pagina = fuente('app/planes/[plan]/page.tsx');
  assert.match(pagina, /pasarelas\.length\s*\?\s*<CompraPlan/);
  assert.match(pagina, /href=\{agendaConOrigen\(origen\)\}/);
});

test('«Tu plan» ofrece Pro por llamada, y /mako-partners no nombra un plan que no existe', () => {
  const pagina = fuente('app/configuraciones/plan/page.tsx');
  assert.match(pagina, /proPorLlamada\(\{ capa, subidaEnLinea: subir != null \}\)/);
  assert.match(pagina, /href: AGENDA_MAKO/);
  assert.match(pagina, /porLlamada=\{porLlamada\}/);
  assert.match(fuente('app/configuraciones/plan/PlanPanel.tsx'), /porLlamada && <FilaAjustes[^>]*href=\{porLlamada\.href\}/);
  assert.doesNotMatch(fuente('app/mako-partners/page.tsx'), /Growth/);
});
