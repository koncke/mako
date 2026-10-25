// =============================================================================
// /planes con los tres bloques (24/10/2026): Martín, «quiero ver los 3 bloques de pricing típicos que tiene toda app»
// =============================================================================
// Lo que se fija acá:
//   · la tabla «Compara los planes» sale de los topes que el código HACE CUMPLIR (lib/topes-plan.ts), no de números
//     escritos a mano: la vitrina no puede prometer más de lo que el producto deja;
//   · el tercer bloque es el MaKo Acelerador (docs/ofertas-mako.md §3), que se vende por llamada y nunca por la pasarela;
//     la Continuidad (US$297) no se publica;
//   · el ANUAL no se muestra: el checkout cobra por mes, y la vitrina no dice un precio que no se puede comprar;
//   · la página lleva a MaKo Partners.
//
// Probado rompiéndolo (24/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPES, TABS_SOLO_PRO } from '../lib/topes-plan';
import { NOMBRE_TAB_PRO, filasDeComparacion } from '../lib/planes-comparacion';
import { PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import { avisoAltaAMano } from '../lib/plan-esencial-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const numero = (celda: unknown): number | null => {
  if (celda === 'Sin tope') return null;
  const m = /([\d.]+)$/.exec(String(celda));
  return m ? Number(m[1].replace(/\./g, '')) : NaN;
};

test('la comparación dice EXACTAMENTE los topes del código, en Esencial (completo) y en Pro y el Acelerador (agencia)', () => {
  const filas = filasDeComparacion();
  const porTope: Array<[string, keyof (typeof TOPES)['completo']]> = [
    ['Embudos de venta en tu CRM', 'crm.funnels'], ['Contactos en tu CRM', 'crm.leads'], ['Números de WhatsApp, más Instagram', 'chats.lineas_whatsapp'],
    ['Automatizaciones de mensajes activas', 'automations.activas'], ['Páginas de venta publicadas', 'web.landings_publicadas'], ['Personas de tu equipo', 'equipo.usuarios'],
  ];
  for (const [que, t] of porTope) {
    const f = filas.find((x) => x.que === que);
    assert.ok(f, `falta la fila «${que}»`);
    assert.equal(numero(f!.esencial), TOPES.completo[t], `${que} en Esencial`);
    assert.equal(numero(f!.pro), TOPES.agencia[t], `${que} en Pro`);
    assert.equal(numero(f!.acelerador), TOPES.agencia[t], `${que} en el Acelerador (trae Pro)`);
  }
});

test('lo que es sólo de Pro sale de TABS_SOLO_PRO: no en Esencial, sí en Pro y en el Acelerador', () => {
  const filas = filasDeComparacion();
  for (const t of TABS_SOLO_PRO) {
    const f = filas.find((x) => x.que === NOMBRE_TAB_PRO[t]);
    assert.ok(f, `falta ${t}`);
    assert.deepEqual([f!.esencial, f!.pro, f!.acelerador], [false, true, true], t);
  }
  const asesoria = filas.find((x) => /asesoría grupal/.test(x.que));
  assert.deepEqual([asesoria?.esencial, asesoria?.pro, asesoria?.acelerador], [false, false, true], 'la asesoría es sólo del programa');
});

test('el tercer bloque es el Acelerador: 1.500 en 3 cuotas de 500, y no es un plan de la pasarela', () => {
  assert.equal(PROGRAMA_ACELERADOR.precioUsd, 1500);
  assert.equal(PROGRAMA_ACELERADOR.cuotas, 3);
  assert.equal(PROGRAMA_ACELERADOR.precioUsd / PROGRAMA_ACELERADOR.cuotas, 500);
  assert.equal(PROGRAMA_ACELERADOR.despues.precioUsd, 297);
  assert.ok(!PLANES_MAKO_DEFAULT.some((p) => p.id === PROGRAMA_ACELERADOR.id), 'el programa no se compra por /planes/<id>');
  assert.equal(PLANES_MAKO_DEFAULT.find((p) => p.id === 'continuidad')?.activo, false, 'la Continuidad no va en la vitrina');
});

test('/planes: tres bloques, el programa se pide, la comparación, sin anual, y el link a MaKo Partners', () => {
  const p = fuente('app/planes/Vitrina.tsx');
  assert.match(fuente('app/planes/page.tsx'), /return <VitrinaPlanes ofertas=\{ofertas\} sufijo=\{sufijo\} \/>;/, 'la página lee y la vitrina dibuja');
  assert.match(p, /^\s*const programa = PROGRAMA_ACELERADOR;/m);
  const t = fuente('app/planes/Tarjetas.tsx');
  assert.match(p, /<TarjetasPlanes planes=\{planes\} sufijo=\{sufijo\} \/>/, 'los bloques son los de la landing');
  assert.match(t, /<a className="mkpl-btn" href=\{`\/planes\/\$\{pr\.id\}\$\{sufijo\}`\}>Quiero el Acelerador<\/a>/, 'el programa se pide en su página, con el origen y el partner');
  assert.match(t, /\{p\.destacado && <span className="mkpl-insignia">Recomendado<\/span>\}/);
  assert.match(p, /^\s*const filas = filasDeComparacion\(\);/m);
  assert.match(p, /<h2 id="planes-compara-titulo">Compara los planes<\/h2>/);
  for (const f of [p, t]) assert.doesNotMatch(f, /precioAnualUsd|por año|\/ año/, 'el anual no se muestra mientras el checkout cobre por mes');
  // La columna de cada plan sale de su CAPA (los topes son de la capa): un plan del setting con otro id no queda vacío.
  assert.match(p, /<CeldaPlan v=\{celdaDe\(f, p\.capa\)\} \/>/);
  assert.match(p, /return capa === 'completo' \? f\.esencial : capa === 'agencia' \? f\.pro : null;/);
  assert.match(p, /<Link href="\/mako-partners">MaKo Partners<\/Link>/, 'desde /planes se llega a MaKo Partners');
  // Los planes cobrables siguen saliendo de la regla de siempre (tests/planes-sin-pasarela.test.ts).
  assert.match(t, /botonDelPlan\(\{ id: p\.id, nombre: p\.nombre, cobrable: p\.cobrable, sufijo \}\)/);
});

test('quien da de alta a mano lee que ese negocio NO tiene los topes de la tabla (se cumplen sólo por la pasarela)', () => {
  assert.match(avisoAltaAMano('completo')!, /no tiene los topes de su plan[\s\S]*sólo a quien paga en línea/);
  assert.equal(avisoAltaAMano('agencia'), avisoAltaAMano('completo'), 'Pro también tiene topes (3 WhatsApp, 5 usuarios)');
  assert.equal(avisoAltaAMano('pm'), null, 'una capa sin topes no lleva el aviso');
  const alta = fuente('app/admin/AdminView.tsx');
  assert.match(alta, /\{avisoAltaAMano\(capa\) && <div [^>]*>\{avisoAltaAMano\(capa\)\}<\/div>\}/, 'el alta del super admin no lo muestra');
});

// ── Que VENDA (24/10/2026, noche) ───────────────────────────────────────────────────────────────────────────────────
// Martín: «Lo hiciste con lenguaje interno, las personas no saben que es "Ops Center" y muchas otras cosas... Tienes que
// VENDER... el acompañamiento debe tener mas beneficios y verse diferencial... El personalizado tiene que tener un factor de
// PROMESA de resultados».

/** Nombres que sólo conocemos nosotros: tabs, jerga del CRM y del producto. Ninguno en lo que lee quien no tiene MaKo. */
const INTERNO = /Ops Center|\bOffer\b|Closing Analyst|Ads Manager|Image Editor|Video Editor|AI Avatar|Web Generator|Automations|\bCalendar\b|\bfunnels?\b|\bleads?\b|\blandings?\b|\bcapa\b|\bDashboard\b/i;
/** Las tabs que también son una palabra común («tus cobros» sí): sólo con mayúscula. */
const TAB_CON_MAYUSCULA = /\bCobros\b|\bCalendar\b/;

const sinMarcas = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function vitrina(): Promise<string> {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VitrinaPlanes } = await import('../app/planes/Vitrina');
  const ofertas = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((plan) => ({ plan, cobrable: false }));
  return sinMarcas(renderToStaticMarkup(React.createElement(VitrinaPlanes, { ofertas, sufijo: '' })));
}

test('sin lenguaje interno: ni la vitrina, ni la landing, ni lo que incluye cada plan nombran una tab o la jerga', async () => {
  const v = await vitrina();
  assert.doesNotMatch(v, INTERNO, '/planes');
  assert.doesNotMatch(v, TAB_CON_MAYUSCULA, '/planes');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreciosLanding } = await import('../app/vsl/PreciosLanding');
  const planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => ({ id: x.id, nombre: x.nombre, precioUsd: x.precioUsd, resumen: x.resumen, incluye: x.incluye, destacado: !!x.destacado, cobrable: true }));
  assert.doesNotMatch(sinMarcas(renderToStaticMarkup(React.createElement(PreciosLanding, { planes, sufijo: '' }))), INTERNO, 'la landing de venta');
  for (const x of [...PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR]) {
    for (const r of [x.resumen, ...x.incluye]) assert.doesNotMatch(r, INTERNO, `${x.nombre}: «${r}»`);
  }
  for (const f of filasDeComparacion()) assert.doesNotMatch(`${f.grupo} ${f.que}`, INTERNO, f.que);
});

test('lo que incluye cada plan dice los topes del CÓDIGO, no números escritos a mano', () => {
  const es = PLANES_MAKO_DEFAULT.find((x) => x.id === 'esencial')!.incluye.join(' · ');
  const n = (v: number | null) => (v ?? 0).toLocaleString('es-AR');
  assert.ok(es.includes(`${n(TOPES.completo['crm.funnels'])} embudo de ventas y hasta ${n(TOPES.completo['crm.leads'])} contactos`), es);
  assert.ok(es.includes(`Hasta ${n(TOPES.completo['automations.activas'])} automatizaciones de mensajes y ${n(TOPES.completo['web.landings_publicadas'])} páginas de venta`), es);
  const pro = PLANES_MAKO_DEFAULT.find((x) => x.id === 'pro')!.incluye.join(' · ');
  assert.ok(pro.includes(`Hasta ${n(TOPES.agencia['chats.lineas_whatsapp'])} WhatsApp y ${n(TOPES.agencia['equipo.usuarios'])} personas de tu equipo`), pro);
  const lib = fuente('lib/planes-mako.ts');
  assert.doesNotMatch(lib.slice(lib.indexOf('PLANES_MAKO_DEFAULT'), lib.indexOf("id: 'continuidad'")), /[Hh]asta \d|\d+ WhatsApp|\d\.\d{3} contactos/, 'ningún tope a mano');
});

test('el acompañamiento se ve DISTINTO y con más: su bloque oscuro, su insignia, cómo se trabaja y todo lo del programa', async () => {
  const tj = fuente('app/planes/Tarjetas.tsx');
  assert.match(tj, /<section className="mkpl-card mkpl-programa">\s*<span className="mkpl-insignia">Con acompañamiento<\/span>\s*<div className="mkpl-ceja">\{CEJA_PROGRAMA\}<\/div>/);
  assert.match(tj, /\.mkpl-programa \{ background: radial-gradient/, 'un bloque oscuro, no una tarjeta blanca más');
  const masLargo = Math.max(...PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => x.incluye.length));
  assert.ok(PROGRAMA_ACELERADOR.incluye.length > masLargo, 'el programa trae más que cualquier plan de software');
  const t = await vitrina();
  assert.match(t, /Lo haces tú, con MaKo MaKo Esencial/);
  assert.match(t, /Con acompañamiento Lo armamos contigo MaKo Acelerador/);
  for (const r of PROGRAMA_ACELERADOR.incluye) assert.ok(t.includes(r), r);
});

test('la PROMESA del programa la escribe Martín: sin ella no se dibuja ninguna; con ella, arriba del botón', async () => {
  assert.equal(PROGRAMA_ACELERADOR.promesa, null, 'hasta que Martín la decida (se le preguntó el 24/10)');
  assert.doesNotMatch(await vitrina(), /Nuestra promesa|garant/i, 'ni una promesa ni una garantía inventadas');
  const antes = PROGRAMA_ACELERADOR.promesa;
  (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = 'una promesa de prueba';
  try {
    const t = await vitrina();
    assert.ok(t.indexOf('Nuestra promesa: una promesa de prueba') > 0 && t.indexOf('Nuestra promesa') < t.indexOf('Quiero el Acelerador'));
  } finally { (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = antes; }
});

// Roturas (24/10/2026; base 8 / 0 con planes-tres-bloques y partners-para-clientes juntos), cada una restaurada (pasan / fallan):
//   · la fila de automatizaciones escrita a mano con 5                                        -> 7 / 1
//   · Ads Manager también en Esencial                                                         -> 7 / 1
//   · el Acelerador con 2 cuotas                                                              -> 7 / 1
//   · el programa con el botón de «Empezar» de un plan                                        -> 7 / 1
//   · /planes muestra `precioAnualUsd`                                                        -> 7 / 1
//   · /planes sin el link a MaKo Partners                                                     -> 7 / 1
//   · la columna de cada plan elegida por su id y no por su capa (revisión del 24/10)              -> 7 / 1
//   · el alta del super admin sin el aviso de los topes (24/10, base 10 / 0 con los dos)      -> 9 / 1
//   · `avisoAltaAMano` sólo para Esencial (Pro también tiene topes)                            -> 9 / 1
// Roturas de «que VENDA» (24/10/2026, noche; base 18 / 0 con planes-sin-pasarela), cada una restaurada (pasan / fallan):
//   · Esencial vuelve a «Ops Center con MaKo y tu propia IA»                                  -> 17 / 1
//   · la comparación vuelve a «Ads Manager»                                                    -> 17 / 1
//   · «Hasta 3 automatizaciones» escrito a mano en lo que incluye                              -> 17 / 1
//   · el Acelerador sin su bloque oscuro                                                       -> 17 / 1
//   · el Acelerador con un beneficio menos (queda igual que Pro)                               -> 17 / 1
//   · una promesa inventada («Si no vendes en 90 días, te devolvemos el dinero»)               -> 17 / 1
//   · la landing con «Elige tu funnel»                                                         -> 17 / 1
//   · /planes sin los bloques compartidos                                                      -> 14 / 4
//   · la fila de automatizaciones escrita a mano con 5                                         -> 17 / 1
//   · el Acelerador sin la insignia «Con acompañamiento»                                       -> 17 / 1
