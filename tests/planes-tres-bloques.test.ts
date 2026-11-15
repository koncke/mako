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
import { FUNCIONES_SOLO_PRO, TOPES, TABS_SOLO_PRO } from '../lib/topes-plan';
import { AI_AVATAR_SE_VENDE, GRUPOS_COMPARACION, NOMBRE_AI_AVATAR, NOMBRE_FUNCION_PRO, NOMBRE_TAB_PRO, TABS_TODAVIA_CERRADAS, filasDeComparacion } from '../lib/planes-comparacion';
import { HORAS_SEMANA_1, MESES_GRATIS_ANUAL, PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, precioEnPesos, textoDespuesDeLaPrueba } from '../lib/planes-mako';
import { botonAnualDelPlan, leerPedidoCompra, TEXTO_ANUAL_SE_PIDE } from '../lib/compra-plan-reglas';
import { avisoAltaAMano } from '../lib/plan-esencial-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const numero = (celda: unknown): number | null => {
  if (celda === 'Sin tope') return null;
  if (celda === false) return 0; // un tope en 0 es la celda vacía («no lo trae»: Esencial sin dominio propio, 14/11/2026)
  const m = /([\d.]+)$/.exec(String(celda));
  return m ? Number(m[1].replace(/\./g, '')) : NaN;
};

test('la comparación dice EXACTAMENTE los topes del código, en Esencial (completo) y en Pro y el Acelerador (agencia)', () => {
  const filas = filasDeComparacion();
  const porTope: Array<[string, keyof (typeof TOPES)['completo']]> = [
    ['Pipelines de venta en tu CRM, con sus etapas', 'crm.funnels'], ['Leads y clientes guardados en tu CRM', 'crm.leads'],
    ['Números de WhatsApp conectados', 'chats.lineas_whatsapp'], ['Automatizaciones activas a la vez', 'automations.activas'],
    ['Landings y presentaciones armadas con IA, publicadas', 'web.landings_publicadas'], ['Personas de tu equipo, cada una con su acceso', 'equipo.usuarios'],
    ['Dominio propio para tus landings (tunegocio.com)', 'web.dominios'], ['Cuentas de cobro conectadas: Mercado Pago o Stripe', 'cobros.cuentas'],
    ['Recomendaciones por día para tus campañas de Meta', 'ads.recomendaciones_dia'],
    // 14/11/2026 (Martín): los competidores de Competitor Spy y los cursos del Classroom, topados en Esencial.
    ['Competidores que MaKo scrapea: web, redes y anuncios', 'spy.competidores'], ['Cursos con módulos y clases para tus alumnos', 'classroom.cursos'],
  ];
  for (const [que, t] of porTope) {
    const f = filas.find((x) => x.que === que);
    assert.ok(f, `falta la fila «${que}»`);
    assert.equal(numero(f!.esencial), TOPES.completo[t], `${que} en Esencial`);
    assert.equal(numero(f!.pro), TOPES.agencia[t], `${que} en Pro`);
    assert.equal(numero(f!.acelerador), TOPES.agencia[t], `${que} en el Acelerador (trae Pro)`);
  }
});

// Lo que Martín le prometió a Teo (C:/dev/revisiones/2810-promesas-teo.md): la tabla le prometía a Pro «videos con una persona
// hecha con IA», y la tab AI Avatar la abre sólo el super admin (app/ai-avatar/acceso.ts). Una tab cerrada no se vende.
test('una tab que todavía no se abrió no se promete; AI Avatar está abierta en los TRES planes pero no se vende todavía', () => {
  const filas = filasDeComparacion();
  assert.deepEqual([...TABS_TODAVIA_CERRADAS], []);
  // Martín, 29/10/2026: «haz que AI-Avatar esté disponible para todos». No es de Pro: la tab, en Esencial, Pro y Acelerador.
  assert.ok(!(TABS_SOLO_PRO as readonly string[]).includes('ai-avatar'), 'AI Avatar volvió a ser de Pro');
  // El Cerebro, 29/10/2026: abrirla no es venderla. Hasta un look real en el ws3 y la extensión 0.69 en la tienda, ni la fila
  // ni un renglón de un plan prometen el avatar (el mismo criterio que sacó los videos del Video Generator).
  const avatar = filas.find((x) => x.que === NOMBRE_AI_AVATAR);
  if (AI_AVATAR_SE_VENDE) {
    assert.deepEqual([avatar?.esencial, avatar?.pro, avatar?.acelerador], [true, true, true], 'AI Avatar se vende y no está en los tres planes');
    assert.match(NOMBRE_AI_AVATAR, /Google Flow/, 'la fila del avatar no dice que se paga con los créditos de Google Flow');
  } else {
    assert.equal(avatar, undefined, 'la tabla vende AI Avatar antes de que ande de punta a punta');
    assert.ok(!filas.some((x) => /avatar|persona hecha con IA/i.test(x.que)), 'otra fila de la tabla promete el avatar');
    for (const p of PLANES_MAKO_DEFAULT) for (const r of p.incluye) assert.doesNotMatch(r, /avatar/i, `${p.id} promete el avatar: «${r}»`);
  }
  for (const t of TABS_TODAVIA_CERRADAS) assert.ok(!filas.some((x) => x.que === NOMBRE_TAB_PRO[t]), `${t} está cerrada y la tabla la promete`);
  // MaKo Partners salió de la tabla el 14/11/2026 (Martín: «elimina cuentas de clientes y MaKo Partner. Eso no hace falta que
  // esté»): sigue siendo de todos los planes (tests/scraper-partners-solo-pro.test.ts) y /planes lleva a su página.
  assert.ok(!filasDeComparacion().some((x) => /primer mes|Partners/.test(x.que)), 'MaKo Partners volvió a la tabla');
  // Atado a la puerta de verdad: la tab está abierta (la puerta de toda tab, no «sólo el super admin»); venderla es aparte.
  assert.ok(fuente('app/ai-avatar/acceso.ts').includes("await requireRolWs([], { nav: 'ai-avatar' });"), 'AI Avatar volvió a tener la puerta cerrada');
});

test('lo que es sólo de Pro sale de TABS_SOLO_PRO: no en Esencial, sí en Pro y en el Acelerador', () => {
  const filas = filasDeComparacion();
  for (const t of TABS_SOLO_PRO.filter((x) => !(TABS_TODAVIA_CERRADAS as readonly string[]).includes(x))) {
    const f = filas.find((x) => x.que === NOMBRE_TAB_PRO[t]);
    assert.ok(f, `falta ${t}`);
    assert.deepEqual([f!.esencial, f!.pro, f!.acelerador], [false, true, true], t);
  }
  const asesoria = filas.find((x) => /asesoría grupal/.test(x.que));
  assert.deepEqual([asesoria?.esencial, asesoria?.pro, asesoria?.acelerador], [false, false, true], 'la asesoría es sólo del programa');
  // Y lo que es de Pro sin ser una tab (27/10/2026): el scraper de WhatsApp y MaKo Partners, que el candado hace cumplir.
  for (const fn of FUNCIONES_SOLO_PRO) {
    const f = filas.find((x) => x.que === NOMBRE_FUNCION_PRO[fn]);
    assert.ok(f, `falta ${fn}`);
    assert.deepEqual([f!.esencial, f!.pro, f!.acelerador], [false, true, true], fn);
  }
});

// 14/11/2026, Martín: «no tengas problema en utilizar el lenguaje técnico de marketing… No tengas miedo en utilizar lenguaje técnico de
// marketing, solo de marketing». Landing, leads, CRM, pipelines, setter y scrapear SÍ (lo que sabe quien vende por internet); lo
// interno de MaKo, NO: «topes», «capa», el nombre de una tab, «scraper» (la herramienta, no lo que hace).
test('la tabla habla de marketing, no de MaKo por dentro: ni lo interno, ni filas largas, y todos los grupos', () => {
  const filas = filasDeComparacion();
  const JERGA = /\btopes?\b|scraper\b|\bcapa\b|workspace/i;
  for (const f of filas.filter((x) => x.esencial !== false || x.pro !== false)) assert.doesNotMatch(f.que, JERGA, f.que);
  for (const f of filas) assert.ok(f.que.length <= 62, `«${f.que}» es largo: una línea en el teléfono`);
  assert.deepEqual([...new Set(filas.map((f) => f.grupo))], [...GRUPOS_COMPARACION], 'cada grupo con sus filas, en orden y seguidas');
});

test('el tercer bloque es el Acelerador: 1.500 en 3 cuotas de 500, y no es un plan de la pasarela', () => {
  assert.equal(PROGRAMA_ACELERADOR.precioUsd, 1500);
  assert.equal(PROGRAMA_ACELERADOR.cuotas, 3);
  assert.equal(PROGRAMA_ACELERADOR.precioUsd / PROGRAMA_ACELERADOR.cuotas, 500);
  assert.equal(PROGRAMA_ACELERADOR.despues.precioUsd, 297);
  assert.ok(!PLANES_MAKO_DEFAULT.some((p) => p.id === PROGRAMA_ACELERADOR.id), 'el programa no se compra por /planes/<id>');
  assert.equal(PLANES_MAKO_DEFAULT.find((p) => p.id === 'continuidad')?.activo, false, 'la Continuidad no va en la vitrina');
});

test('/planes: tres bloques, el programa se pide, la comparación, y el link a MaKo Partners', () => {
  const p = fuente('app/planes/Vitrina.tsx');
  // Desde el 12/11/2026 con la barra del sitio arriba (BarraGlobal): la página lee, la barra navega y la vitrina dibuja.
  assert.match(fuente('app/planes/page.tsx'), /<BarraGlobal claro \/>\s*<VitrinaPlanes ofertas=\{ofertas\} sufijo=\{sufijo\} promoVigente=/, 'la página lee y la vitrina dibuja');
  assert.match(p, /^\s*const programa = PROGRAMA_ACELERADOR;/m);
  const t = fuente('app/planes/Tarjetas.tsx');
  assert.match(p, /<TarjetasPlanes planes=\{planes\} sufijo=\{sufijo\} promoVigente=/, 'los bloques son los de la landing');
  assert.match(t, /<a className="mkpl-btn" href=\{`\/planes\/\$\{pr\.id\}\$\{sufijo\}`\}>Quiero el Acelerador<\/a>/, 'el programa se pide en su página, con el origen y el partner');
  assert.match(t, /\{p\.destacado && <span className="mkpl-insignia">Recomendado<\/span>\}/);
  assert.match(p, /^\s*const filas = filasDeComparacion\(\);/m);
  // La tabla como Attio (14/11/2026): ver app/planes/Vitrina.tsx, `CompararPlanes`.
  assert.match(p, /<h2 id="cp-titulo" className="cp-titulo">Compara los planes<\/h2>/);
  // La columna de cada plan sale de su CAPA (los topes son de la capa): un plan del setting con otro id no queda vacío.
  // (29/10/2026: la celda por capa pasó a lib/planes-comparacion.ts, `celdaDeCapa`: la usan también los ✗ de cada tarjeta.)
  assert.match(p, /celda: \(f: FilaComparacion\) => celdaDeCapa\(f, p\.capa\)/);
  assert.match(fuente('lib/planes-comparacion.ts'), /return capa === 'completo' \? f\.esencial : capa === 'agencia' \? f\.pro : null;/);
  assert.match(p, /<Link href="\/mako-partners">MaKo Partners<\/Link>/, 'desde /planes se llega a MaKo Partners');
  // Los planes cobrables siguen saliendo de la regla de siempre (tests/planes-sin-pasarela.test.ts).
  assert.match(t, /botonDelPlan\(\{ id: p\.id, nombre: p\.nombre, cobrable: p\.cobrable, sufijo \}\)/);
});

test('quien da de alta a mano lee que ese negocio NO tiene los topes de la tabla (se cumplen sólo por la pasarela)', () => {
  assert.match(avisoAltaAMano('completo')!, /no tiene los topes de su plan[\s\S]*sólo a quien paga en línea/);
  assert.equal(avisoAltaAMano('agencia'), avisoAltaAMano('completo'), 'Pro también tiene topes (3 WhatsApp, 5 usuarios)');
  assert.equal(avisoAltaAMano('pm'), null, 'una capa sin topes no lleva el aviso');
  // El alta del super admin: desde el 6/11/2026 es «New Customer» de Admin › Customers (la copia de Polar; antes, la grilla
  // vieja de AdminView). El server arma cada plan con su aviso y el formulario lo dibuja debajo del plan elegido.
  assert.match(fuente('app/admin/_polar/datos/clientes-server.ts'), /aviso: avisoAltaAMano\(c\.id\)/, 'los planes del alta sin su aviso');
  assert.match(fuente('app/admin/_polar/web/Customer/CreateCustomerModal.tsx'), /\{planElegido\?\.aviso && <FormDescription [^>]*>\{planElegido\.aviso\}<\/FormDescription>\}/, 'el alta del super admin no lo muestra');
});

// ── Que VENDA (24/10/2026, noche) ───────────────────────────────────────────────────────────────────────────────────
// Martín: «Lo hiciste con lenguaje interno, las personas no saben que es "Ops Center" y muchas otras cosas... Tienes que
// VENDER... el acompañamiento debe tener mas beneficios y verse diferencial... El personalizado tiene que tener un factor de
// PROMESA de resultados».

/** Nombres que sólo conocemos nosotros: tabs, jerga del CRM y del producto. Ninguno en lo que lee quien no tiene MaKo. */
// 14/11/2026: «landing», «lead» y «funnel» salieron de acá: son marketing (Martín: «utilizar el lenguaje técnico de marketing»).
const INTERNO = /Ops Center|\bOffer\b|Closing Analyst|Ads Manager|Image Editor|Video Editor|AI Avatar|Web Generator|Automations|\bCalendar\b|\bcapa\b|\bDashboard\b/i;
/** Las tabs que también son una palabra común («tus cobros» sí): sólo con mayúscula. */
const TAB_CON_MAYUSCULA = /\bCobros\b|\bCalendar\b/;

const sinMarcas = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function vitrinaHtml(planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo), sufijo = ''): Promise<string> {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VitrinaPlanes } = await import('../app/planes/Vitrina');
  const ofertas = planes.map((plan) => ({ plan, cobrable: false }));
  return renderToStaticMarkup(React.createElement(VitrinaPlanes, { ofertas, sufijo }));
}
const vitrina = async (): Promise<string> => sinMarcas(await vitrinaHtml());

test('sin lenguaje interno: ni la vitrina, ni la landing, ni lo que incluye cada plan nombran una tab o la jerga', async () => {
  const v = await vitrina();
  assert.doesNotMatch(v, INTERNO, '/planes');
  assert.doesNotMatch(v, TAB_CON_MAYUSCULA, '/planes');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreciosLanding } = await import('../app/vsl/PreciosLanding');
  const planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => ({ id: x.id, nombre: x.nombre, capa: x.capa, precioUsd: x.precioUsd, resumen: x.resumen, incluye: x.incluye, destacado: !!x.destacado, precioAnualUsd: x.precioAnualUsd, preciosLocales: x.preciosLocales, cobrable: true }));
  assert.doesNotMatch(sinMarcas(renderToStaticMarkup(React.createElement(PreciosLanding, { planes, sufijo: '' }))), INTERNO, 'la landing de venta');
  for (const x of [...PLANES_MAKO_DEFAULT, PROGRAMA_ACELERADOR]) {
    for (const r of [x.resumen, ...x.incluye]) assert.doesNotMatch(r, INTERNO, `${x.nombre}: «${r}»`);
  }
  for (const f of filasDeComparacion()) assert.doesNotMatch(`${f.grupo} ${f.que}`, INTERNO, f.que);
});

// Lo que quedaba (30/10/2026): Leila la sacó de la tabla el 27/10, y las TARJETAS, lo primero que se lee, seguían con «embudo»,
// «CRM», «media buyer», «setter» y «cohorte». Ahora se mira la pantalla entera, no sólo las filas.
// 14/11/2026: la jerga de marketing ya no es un rojo (Martín); lo que sigue prohibido es lo de NUESTRA cocina.
test('la pantalla entera no habla de MaKo por dentro: tarjetas, promesa, garantía, comparación y preguntas', async () => {
  const JERGA = /scraper\b|cohorte|workspace|barredora/i; // («Sin tope» es una celda: «topes» se mira en las filas)
  assert.doesNotMatch(await vitrina(), JERGA, '/planes');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Reembolsos } = await import('../app/reembolsos/page');
  assert.doesNotMatch(sinMarcas(renderToStaticMarkup(React.createElement(Reembolsos))), /\bembudos?\b|\bCRM\b/, '/reembolsos dice «armado» con las mismas palabras');
  // Y lo que se arma la primera semana es lo mismo en la tabla, en la tarjeta y en /reembolsos: sin «anuncios».
  const semana = filasDeComparacion().find((f) => /primera semana/.test(f.que));
  assert.ok(semana && !/anuncios/.test(semana.que), semana?.que);
});

test('lo que incluye cada plan dice los topes del CÓDIGO, no números escritos a mano', () => {
  const es = PLANES_MAKO_DEFAULT.find((x) => x.id === 'esencial')!.incluye.join(' · ');
  const n = (v: number | null) => (v ?? 0).toLocaleString('es-AR');
  assert.ok(es.includes(`Hasta ${n(TOPES.completo['crm.leads'])} leads en tu CRM y ${n(TOPES.completo['crm.funnels'])} pipeline`), es);
  assert.ok(es.includes(`${n(TOPES.completo['automations.activas'])} automatizaciones activas y ${n(TOPES.completo['web.landings_publicadas'])} landing`), es);
  assert.ok(es.includes(`${n(TOPES.completo['spy.competidores'])} competidor`), es);
  const pro = PLANES_MAKO_DEFAULT.find((x) => x.id === 'pro')!.incluye.join(' · ');
  assert.ok(pro.includes(`Hasta ${n(TOPES.agencia['chats.lineas_whatsapp'])} WhatsApp y ${n(TOPES.agencia['equipo.usuarios'])} personas de tu equipo`), pro);
  const lib = fuente('lib/planes-mako.ts');
  assert.doesNotMatch(lib.slice(lib.indexOf('PLANES_MAKO_DEFAULT'), lib.indexOf("id: 'continuidad'")), /[Hh]asta \d|\d+ WhatsApp|\d\.\d{3} contactos/, 'ningún tope a mano');
});

// 12/11/2026, noche (Martín: «no pongas tanto texto… me gustaban los colores de las tarjetas anteriores, el Acelerador estaba
// negro»): el Acelerador vuelve a ser el bloque OSCURO, de color fijo (el sol y la luna no lo toca), con su insignia, y su lista es
// la corta: «Todo lo de MaKo Pro, más:» y lo suyo (el detalle de cada entregable, en /reembolsos §2).
test('el acompañamiento se ve DISTINTO: su bloque oscuro de color fijo, su insignia, todo lo de Pro y lo del programa', async () => {
  const tj = fuente('app/planes/Tarjetas.tsx');
  assert.match(tj, /<section className="mkpl-card mkpl-programa" data-tema-fijo="" aria-label=\{CEJA_PROGRAMA\}>\s*<span className="mkpl-insignia">Con acompañamiento<\/span>/);
  assert.match(tj, /\.mkpl-programa \{ background: radial-gradient/, 'un bloque oscuro, no una tarjeta blanca más');
  const { LISTA_PROGRAMA } = await import('../app/planes/Tarjetas');
  const t = await vitrina();
  assert.match(t, /Todo lo de MaKo Pro, más:/, 'el programa trae Pro entero');
  for (const r of LISTA_PROGRAMA) assert.ok(t.includes(r), r);
  assert.ok(LISTA_PROGRAMA.every((r) => r.split(' ').length <= 7), 'renglones cortos, como los de beehiiv');
});

test('la PROMESA del programa (25/10): un resultado con plazo, arriba del botón, y que no promete plata', async () => {
  const { promesa } = PROGRAMA_ACELERADOR;
  assert.ok(promesa, 'el personalizado lleva promesa (Martín, 24/10)');
  assert.match(promesa!, /^En \d+ días,/, 'con plazo');
  // Martín, 14/11/2026: atada a un resultado de plata («como mínimo, rentabilizar la inversión… garantizado por contrato»), con
  // quién la cumple (él) y a la medida de la oferta. Lo que se DEVUELVE sigue en `garantia`, no acá.
  assert.doesNotMatch(promesa!, /devolv|reembols/i, 'lo que se devuelve va en `garantia`');
  assert.match(promesa!, /recuper\w* la inversión|ventas|llamadas|factur/i, 'la promesa es un resultado de plata o del funnel');
  assert.match(promesa!, /Martín Koncke/, 'con quién la cumple');
  assert.match(promesa!, /tu (oferta|negocio)/i, 'se nota que es a la medida');
  const t = await vitrina();
  assert.ok(t.indexOf(`Nuestra promesa: ${promesa}`) > 0 && t.indexOf('Nuestra promesa') < t.indexOf('Quiero el Acelerador'));
  const antes = PROGRAMA_ACELERADOR.promesa;
  (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = null;
  try {
    assert.doesNotMatch(await vitrina(), /Nuestra promesa/, 'sin promesa, no se inventa una');
  } finally { (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = antes; }
});

test('la GARANTÍA del programa es sobre los entregables de la semana 1, abajo del botón, y /reembolsos dice la misma', async () => {
  const { garantia } = PROGRAMA_ACELERADOR;
  assert.ok(garantia);
  assert.match(garantia!, /primera semana/);
  assert.match(garantia!, /sistema de ventas no está armado/);
  assert.doesNotMatch(garantia!, /vend|factur|llamadas|clientes/i, 'no es una garantía de resultado (§6c: recién con datos)');
  assert.ok(PROGRAMA_ACELERADOR.incluye.some((x) => x.includes(`hasta ${HORAS_SEMANA_1} horas`)), 'el entregable, escrito con su tope de horas');
  // En la tarjeta, sólo el link («Con garantía de entrega», 12/11 noche: menos texto); la garantía entera, en /reembolsos §2.
  const t = await vitrina();
  const boton = t.indexOf('Quiero el Acelerador');
  assert.ok(t.indexOf('Con garantía de entrega') > boton, 'la garantía, abajo del botón');
  assert.match(fuente('app/planes/Tarjetas.tsx'), /<a className="mkpl-garantia" href="\/reembolsos#grupal">Con garantía de entrega<\/a>/);
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Reembolsos } = await import('../app/reembolsos/page');
  const reembolsos = sinMarcas(renderToStaticMarkup(React.createElement(Reembolsos)));
  assert.ok(reembolsos.includes(`Garantía de entrega: ${garantia}`), '/reembolsos con la frase de la tarjeta');
  assert.ok(reembolsos.includes(`hasta ${HORAS_SEMANA_1} horas`));
  assert.doesNotMatch(reembolsos, /acordamos contigo en la llamada/, 'la garantía ya no se acuerda en la llamada');
});

// ── Lo decidido el 25/10/2026 (el Cerebro, memoria decisiones-venta-25-10) ─────────────────────────────────────────

test('el ANUAL: 2 meses gratis, se elige arriba, y SIEMPRE se pide (el checkout cobra por mes)', async () => {
  for (const pl of PLANES_MAKO_DEFAULT.filter((x) => x.activo)) {
    assert.equal(pl.precioAnualUsd, pl.precioUsd * (12 - MESES_GRATIS_ANUAL), `${pl.nombre}: el año son 10 meses`);
  }
  const t = await vitrina();
  assert.ok(t.includes(`Mensual Anual ${MESES_GRATIS_ANUAL} meses gratis`), 'el selector, arriba');
  assert.ok(t.includes('US$ 970 / año') && t.includes('Quiero el anual'), 'el anual, con su precio y su pedido');
  const html = await vitrinaHtml();
  assert.match(html, /<input type="radio" id="mkpl-p-mes" name="mkpl-periodo" checked=""\/>/, 'arranca en mensual');
  assert.ok(html.includes('href="/planes/pro?periodo=anual"'));
  assert.equal(botonAnualDelPlan({ id: 'pro', sufijo: '?ref=estudio-sol' }).href, '/planes/pro?ref=estudio-sol&periodo=anual', 'con el origen y el partner');
  const tj = fuente('app/planes/Tarjetas.tsx');
  assert.match(tj, /\.mkpl-bloques:has\(#mkpl-p-mes:checked\) \.mkpl-anual \{ display: none; \}/);
  assert.match(tj, /\.mkpl-bloques:has\(#mkpl-p-anual:checked\) \.mkpl-mes \{ display: none; \}/);
  // Un plan sin anual: no hay selector (al elegir «Anual», esa tarjeta quedaría sin precio).
  const sinAnual = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x, i) => (i === 0 ? { ...x, precioAnualUsd: null } : x));
  assert.doesNotMatch(sinMarcas(await vitrinaHtml(sinAnual)), /Mensual Anual|\/ año/);
  // Se pide: sin «quiero» no hay checkout anual, y la página del plan lo manda al pedido antes que al pago.
  const base = { plan: 'pro', nombre: 'Ana', email: 'a@x.com', whatsapp: '+54 9 11 1234 5678', periodo: 'anual' };
  assert.deepEqual(leerPedidoCompra(base), { ok: false, error: TEXTO_ANUAL_SE_PIDE });
  const pedido = leerPedidoCompra({ ...base, quiero: true });
  assert.ok(pedido.ok && pedido.pedido.periodo === 'anual');
  const pagina = fuente('app/planes/[plan]/page.tsx');
  assert.ok(pagina.indexOf("uno('periodo') === 'anual' && plan.precioAnualUsd") > 0);
  assert.ok(pagina.indexOf("uno('periodo') === 'anual'") < pagina.indexOf('<CompraPlan'), 'el anual nunca llega al checkout mensual');
  assert.match(pagina, /<QuieroPlan plan=\{plan\.id\} nombrePlan=\{`\$\{plan\.nombre\} anual`\} origen=\{origen\} refCodigo=\{ref\} periodo="anual" \/>/);
  assert.match(fuente('lib/compra-plan.ts'), /const nombrePlan = anual \? `\$\{nombre\} anual \(US\$ \$\{anual\.toLocaleString\('es-AR'\)\} por año\)` : nombre;/, 'el pedido dice que es el anual');
});

// La prueba gratis se apagó el 30/10/2026 (docs/estrategia-lanzamiento-low-to-high.md §4, `PRUEBA_GRATIS_PRENDIDA`): ninguna pantalla pública
// la promete. Prendida vuelve a decir lo de antes (tests/primer-mes.test.ts); lo que se fija acá es lo que se ve hoy.
// La prueba se apagó el 30/10/2026 y se prendió de nuevo el 12/11/2026 (Martín: «Sí, préndela»): /planes y /reembolsos dicen lo
// mismo que el cobro, con el interruptor como esté.
test('la prueba gratis sigue al interruptor: /planes y /reembolsos dicen lo mismo que el cobro', async () => {
  assert.equal(PRUEBA_DIAS, 7, 'no se borró');
  assert.equal(textoDespuesDeLaPrueba(97, 'mes', true), 'Después US$ 97/mes. Cancela cuando quieras antes del día 8.');
  // LA PRUEBA EN LOS DOS PLANES (14/11/2026, Martín: «habilita nuevamente la prueba gratuita en el del 47»; del 12/11 al 14/11 fue
  // sólo de Pro).
  assert.equal(planConPrueba('pro'), PRUEBA_GRATIS_PRENDIDA, 'Pro trae la prueba');
  assert.equal(planConPrueba('esencial'), PRUEBA_GRATIS_PRENDIDA, 'Esencial también');
  // Debajo del precio, una sola cosa (12/11 noche, menos texto): los días gratis.
  const { bajoElPrecio } = await import('../app/planes/Tarjetas');
  if (PRUEBA_GRATIS_PRENDIDA) for (const id of ['pro', 'esencial']) assert.equal(bajoElPrecio({ id }), `${PRUEBA_DIAS} días gratis`);
  // «Y evidentemente no la aclares por otro lado»: ningún texto dice cuál plan no la trae.
  for (const f of ['app/planes/Tarjetas.tsx', 'app/planes/Vitrina.tsx', 'app/terminos/page.tsx', 'app/reembolsos/page.tsx', 'lib/partners-recursos.ts'])
    assert.doesNotMatch(fuente(f), /Esencial (no tiene prueba|se paga al empezar)/, f);
  assert.match(fuente('lib/compra-plan.ts'), /const conPrueba = planConPrueba\(plan\.id\) && !p\.sinPrueba;/, 'el cobro abre la prueba sólo en el plan que la trae');
  assert.match(fuente('app/planes/[plan]/page.tsx'), /const conPrueba = planConPrueba\(plan\.id\) && uno\('sinPrueba'\) !== '1';/, 'y el checkout la dice sólo ahí');
  const t = await vitrina();
  assert.ok(t.includes('MaKo Pro ¿Ya vendes?'), 'la tarjeta de Pro');
  if (PRUEBA_GRATIS_PRENDIDA) assert.match(t, new RegExp(`${PRUEBA_DIAS} días gratis`), '/planes dice la prueba');
  else assert.doesNotMatch(t, /días gratis|prueba gratis/i, '/planes no promete una prueba que ya no existe');
  assert.ok(t.includes('Recomendado MaKo Pro'), 'Pro, el recomendado');
  // La vitrina del test no tiene pasarela (`cobrable: false`): cada botón es un pedido, y su nota lo dice.
  assert.ok(t.includes('Quiero MaKo Pro') && t.includes('Quiero MaKo Esencial') && t.includes('Quiero el anual'), 'los botones, mensual y anual');
  assert.ok(t.includes(PRUEBA_GRATIS_PRENDIDA ? '¿Cómo es la prueba gratis?' : '¿Cuándo pago y cuándo entro?'), 'la pregunta de cómo se paga');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Reembolsos } = await import('../app/reembolsos/page');
  const r = sinMarcas(renderToStaticMarkup(React.createElement(Reembolsos)));
  if (PRUEBA_GRATIS_PRENDIDA) {
    assert.ok(r.includes(`${PRUEBA_DIAS} días gratis.`), '/reembolsos dice la prueba');
    assert.ok(r.includes('una prueba por negocio'), 'y que es una sola');
    assert.doesNotMatch(r, /Se paga al empezar\./, 'no dice las dos cosas');
  } else {
    assert.ok(r.includes('Se paga al empezar.'), '/reembolsos dice lo mismo');
    assert.ok(r.includes('se aplica sólo a ese primer cobro'), 'el 50% del primer mes, dicho');
    assert.ok(r.includes('Si empezaste con una prueba gratis, sigue con las condiciones con las que la empezaste'), 'a quien ya está en prueba no se le toca nada');
    assert.doesNotMatch(r, /7 días gratis/);
  }
  assert.ok(r.includes('Después del primer cobro, lo ya pagado no se reembolsa'), 'después, no hay devolución');
  for (const [que, txt] of [['la vitrina', t], ['/reembolsos', r]] as const) {
    assert.doesNotMatch(txt, /días de garantía|Garantía de 14|te devolvemos tu pago/, `${que}: sin la garantía de los planes`);
  }
  assert.ok(r.includes('Garantía de entrega:'), 'la del Acelerador queda: es otra (sobre los entregables)');
  for (const rel of ['lib/planes-mako.ts', 'app/planes/Tarjetas.tsx', 'app/planes/Vitrina.tsx', 'app/reembolsos/page.tsx', 'app/planes/[plan]/page.tsx']) {
    assert.doesNotMatch(fuente(rel), /GARANTIA_DIAS/, rel);
  }
  // Desde el 14/11/2026 los dos planes traen la prueba: /reembolsos ya no nombra un plan, dice los días de la constante.
  assert.match(fuente('app/reembolsos/page.tsx'), /<strong>\{PRUEBA_DIAS\} días gratis\.<\/strong>/, 'prendida vuelve, con los días de la constante');
});

test('PESOS y Mercado Pago a la vista, y un precio en pesos sólo si el plan lo tiene (nunca con una tasa)', async () => {
  const { TEXTO_PAGOS } = await import('../app/planes/Tarjetas');
  assert.match(TEXTO_PAGOS, /en pesos, con Mercado Pago/);
  assert.ok((await vitrina()).includes(TEXTO_PAGOS), '/planes lo dice en sus preguntas');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PreciosLanding } = await import('../app/vsl/PreciosLanding');
  const planes = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => ({ ...x, cobrable: false }));
  // Las tarjetas ya no repiten la línea de pagos (Martín, 12/11 noche: «desde Argentina pagás en pesos con Mercado Pago… todo eso
  // es información innecesaria»): queda en la pregunta de /planes.
  assert.doesNotMatch(sinMarcas(renderToStaticMarkup(React.createElement(PreciosLanding, { planes, sufijo: '' }))), /TEXTO_PAGOS_NO_VA/, 'la landing de venta');
  assert.doesNotMatch(await vitrina(), /\$ [\d.]+ ARS/, 'sin precio en pesos cargado, ningún número en pesos');
  assert.equal(precioEnPesos({ preciosLocales: {} }), null);
  const conPesos = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => (x.id === 'pro' ? { ...x, preciosLocales: { ARS: 97000 } } : x));
  assert.ok(sinMarcas(await vitrinaHtml(conPesos)).includes('US$ 97 / mes o $ 97.000 ARS por mes'), 'con el precio del plan en pesos, se dice');
});

test('el MEDIA BUYER en Esencial: propone, 2 recomendaciones por día, del tope del plan', () => {
  assert.equal(TOPES.completo['ads.recomendaciones_dia'], 2);
  assert.equal(TOPES.agencia['ads.recomendaciones_dia'], null);
  // Dicha sin «media buyer» desde el 27/10/2026 (Leila: «Una persona que no sabe no entiende…»).
  const f = filasDeComparacion().find((x) => x.que === 'Recomendaciones por día para tus campañas de Meta');
  assert.ok(f, 'la fila en la comparación');
  // 14/11/2026: los anuncios van con el contenido (Martín: «eso podrías agruparlo en contenido»).
  assert.deepEqual([f!.grupo, f!.esencial, f!.pro, f!.acelerador], ['Contenido y anuncios', '2', 'Sin tope', 'Sin tope']);
  const esencial = PLANES_MAKO_DEFAULT.find((x) => x.id === 'esencial')!;
  assert.ok(esencial.incluye.some((x) => x.includes(`${TOPES.completo['ads.recomendaciones_dia']} recomendaciones por día`) && /tú decides si las aplicas/.test(x)),
    'en lo que incluye Esencial, y que no aplica solo');
});

test('sin plan Agencia aparte (10/10): la agencia maneja a sus clientes desde Pro', async () => {
  assert.ok(!PLANES_MAKO_DEFAULT.some((x) => x.activo && /agencia/i.test(`${x.id} ${x.nombre}`)));
  assert.doesNotMatch(await vitrina(), /Plan Agencia|MaKo Agencia/);
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
// Roturas del 25/10/2026 (el anual, la garantía 14/30, los pesos y el media buyer; base 40 / 0 con planes-sin-pasarela,
// compra-plan y topes-plan), cada una restaurada (pasan / fallan):
//   · el anual con 1 mes gratis (US$ 1.067)                                                 -> 39 / 1
//   · el anual sale con el botón del checkout mensual                                       -> 38 / 2
//   · el anual pierde el origen y el partner                                                -> 39 / 1
//   · se puede comprar el anual sin pedirlo                                                 -> 39 / 1
//   · la página del plan manda el anual al checkout                                         -> 39 / 1
//   · el selector arranca en anual                                                          -> 39 / 1
//   · el selector aunque un plan no tenga anual                                             -> 39 / 1
//   · la garantía del mensual a 7 días                                                      -> 39 / 1
//   · /reembolsos con los días a mano                                                       -> 39 / 1
//   · /reembolsos vuelve a «El mes ya pagado no se reembolsa»                               -> 39 / 1
//   · la tarjeta sin la garantía abajo del botón                                            -> 39 / 1
//   · un precio en pesos inventado con una tasa                                             -> 39 / 1
//   · sin la línea de Mercado Pago                                                          -> 39 / 1
//   · el media buyer de Esencial con 5 por día                                              -> 38 / 2
//   · la fila del media buyer escrita a mano                                                -> 39 / 1
//   · el media buyer de Esencial aplica solo                                                -> 39 / 1
//   · el pedido no dice que es anual                                                        -> 39 / 1
// Roturas de la PRUEBA GRATIS (25/10/2026, ~11:00; base 25 / 0 con planes-sin-pasarela), cada una restaurada (pasan / fallan):
//   · la prueba de 14 días                                                                  -> 24 / 1
//   · debajo del botón, el monto de Pro para todos los planes                               -> 24 / 1
//   · sin «7 días gratis» junto al precio                                                   -> 24 / 1
//   · /reembolsos vuelve a la garantía de 14 días                                           -> 24 / 1
//   · /reembolsos con los días escritos a mano                                              -> 24 / 1
//   · la pregunta vuelve a «te devolvemos tu pago»                                          -> 24 / 1
//   · vuelve `GARANTIA_DIAS`                                                                -> 24 / 1
//   · /reembolsos sin «después del primer cobro, no se reembolsa»                            -> 24 / 1

// ── La calculadora de MaKo Tokens (14/11/2026, Martín: arriba de las columnas, arranca en los tokens del plan) ─────────
test('la calculadora va ARRIBA de las tarjetas, arranca en los MaKo Tokens del plan y cada tarjeta dice los suyos', async () => {
  const { CUPO_MENSUAL } = await import('../lib/mako-tokens-reglas');
  const { datosDelPlan, COSTO_POR_ACCION } = await import('../app/planes/CalculadoraTokens');
  const t = await vitrina();
  assert.ok(t.indexOf('Calcula cuántos MaKo Tokens necesitas') < t.indexOf('Recomendado MaKo Pro'), 'arriba de las tres columnas');
  // Las claves de agosto: `pro` es Esencial (US$47) y `growth` es Pro (US$97).
  const mil = (n: number) => n.toLocaleString('es-AR');
  assert.ok(t.includes(`${mil(CUPO_MENSUAL.pro)} MaKo Tokens al mes`) && t.includes(`${mil(CUPO_MENSUAL.growth)} MaKo Tokens al mes`), 'cada tarjeta, sus tokens');
  const pro = datosDelPlan({ id: 'pro', nombre: 'MaKo Pro', capa: 'agencia', precioUsd: 97, cobrable: true })!;
  const esencial = datosDelPlan({ id: 'esencial', nombre: 'MaKo Esencial', capa: 'completo', precioUsd: 47, cobrable: true })!;
  assert.equal(pro.pasos[0].mt, mil(CUPO_MENSUAL.growth), 'Pro arranca en sus tokens');
  assert.equal(pro.pasos[0].usd, 'US$ 97', 'y en su precio, sin nada sumado');
  assert.equal(esencial.pasos[0].mt, mil(CUPO_MENSUAL.pro));
  // El video del plan respeta su tope de clips (6 en Esencial, 36 en Pro), no lo que pagarían sus tokens (23 y 48).
  assert.equal(esencial.pasos[0].video, 'Hasta 1 minuto de video');
  assert.equal(pro.pasos[0].video, 'Hasta 6 minutos de video');
  // Sumar un minuto: 3.000 tokens y US$12 (el clip a US$2), una compra suelta, no el abono.
  assert.equal(pro.pasos[1].mt, mil(CUPO_MENSUAL.growth + 3000));
  assert.equal(pro.pasos[1].usd, 'US$ 109');
  assert.equal(pro.pasos[1].periodo, 'este mes');
  assert.equal(pro.pasos[1].video, 'Hasta 7 minutos de video');
  // Sólo los medios gastan MaKo Tokens: lo demás va con la IA del negocio o es un tope del plan.
  assert.deepEqual(COSTO_POR_ACCION.filter((x) => x.mt != null).map((x) => x.mt), [500, 12]);
  assert.equal(datosDelPlan({ id: 'x', nombre: 'X', capa: 'pm', precioUsd: 1, cobrable: false }), null, 'una capa sin cupo no se dibuja');
});
