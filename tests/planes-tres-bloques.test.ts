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
import { AI_AVATAR_SE_VENDE, FUNCIONES_TODAVIA_NO_VENDIDAS, GRUPOS_COMPARACION, NOMBRE_AI_AVATAR, NOMBRE_FUNCION_PRO, NOMBRE_TAB_PRO, TABS_TODAVIA_CERRADAS, filasDeComparacion } from '../lib/planes-comparacion';
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
test('una tab que todavía no se abrió no se promete; el avatar de IA es de Pro pero no se vende todavía', () => {
  const filas = filasDeComparacion();
  assert.deepEqual([...TABS_TODAVIA_CERRADAS], []);
  // 14/11/2026 (Martín, sobre /planes: «el de 97 ya podés generar avatares de IA»): el avatar volvió a ser de Pro, y se cierra
  // con el candado de siempre (`FUNCIONES_SOLO_PRO`, 'ai-avatar') y NO con una tab escondida: la tab se abre igual en los dos
  // planes y adentro va el cartel, como la comunidad del Classroom. Si vuelve a `TABS_SOLO_PRO`, el Esencial no entra a la
  // pantalla y pierde los looks que ya generó: son dos cosas distintas.
  assert.ok(!(TABS_SOLO_PRO as readonly string[]).includes('ai-avatar'), 'AI Avatar volvió a ser una tab escondida');
  assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes('ai-avatar'), 'el avatar de IA volvió a estar abierto en Esencial');
  // El Cerebro, 29/10/2026: cerrarla no es venderla. Hasta un look real en el ws3 y la extensión 0.69 en la tienda, ni la fila
  // ni un renglón de un plan prometen el avatar (el mismo criterio que sacó los videos del Video Generator).
  assert.equal(AI_AVATAR_SE_VENDE, FUNCIONES_TODAVIA_NO_VENDIDAS.length === 0, 'lo que no se vende tiene que estar en FUNCIONES_TODAVIA_NO_VENDIDAS');
  const avatar = filas.find((x) => x.que === NOMBRE_AI_AVATAR);
  if (AI_AVATAR_SE_VENDE) {
    // El día que se venda, NACE EN PRO: nunca otra vez en los tres (§4.3 del relevo, el criterio del Video Generator).
    assert.deepEqual([avatar?.esencial, avatar?.pro, avatar?.acelerador], [false, true, true], 'el avatar se vende y no es de Pro');
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
  // Y el candado de Pro es el de `FUNCIONES_SOLO_PRO`, en las DOS puertas: la pantalla (el cartel en lugar del estudio) y cada
  // server action, que es donde se genera de verdad. Sin el de las actions, un Esencial generaba desde una pestaña ya abierta.
  const acceso = fuente('app/ai-avatar/acceso.ts');
  assert.match(acceso, /export async function candadoDeAiAvatar\(\): Promise<string \| null> \{\n\s*return \(await esEsencialDeLaSesion\(\)\) \? textoSoloPro\('ai-avatar'\) : null;/);
  assert.match(fuente('app/ai-avatar/actions.ts'), /const pro = await candadoDeAiAvatar\(\);\n\s*if \(pro\) return \{ ok: false, error: pro \};/, 'las actions sin el candado');
  for (const rel of ['app/ai-avatar/page.tsx', 'app/m/ai-avatar/page.tsx']) {
    const p = fuente(rel);
    assert.match(p, /const pro = await candadoDeAiAvatar\(\);/, `${rel} no pregunta por el candado`);
    assert.match(p, /if \(pro\) return <\w+[^>]*><CartelSoloPro texto=\{pro\} \/><\/\w+>;/, `${rel} sin el cartel en lugar del estudio`);
  }
});

test('lo que es sólo de Pro sale de TABS_SOLO_PRO: no en Esencial, sí en Pro y en el Acelerador', () => {
  const filas = filasDeComparacion();
  for (const t of TABS_SOLO_PRO.filter((x) => !(TABS_TODAVIA_CERRADAS as readonly string[]).includes(x))) {
    const f = filas.find((x) => x.que === NOMBRE_TAB_PRO[t]);
    assert.ok(f, `falta ${t}`);
    assert.deepEqual([f!.esencial, f!.pro, f!.acelerador], [false, true, true], t);
  }
  // 15/11/2026: la fila dice «Una asesoría en vivo con Martín, cada semana» (copy de Martín); que es grupal lo dice el checkout.
  const asesoria = filas.find((x) => /asesoría en vivo/.test(x.que));
  assert.deepEqual([asesoria?.esencial, asesoria?.pro, asesoria?.acelerador], [false, false, true], 'la asesoría es sólo del programa');
  // Y lo que es de Pro sin ser una tab (27/10/2026): el scraper de WhatsApp y MaKo Partners, que el candado hace cumplir.
  // 14/11/2026: lo que está cerrado en Esencial pero TODAVÍA no se vende (hoy el avatar) no tiene fila, igual que una tab que
  // no se abrió (`TABS_TODAVIA_CERRADAS`). Cerrarlo en Esencial y venderlo en Pro son dos decisiones distintas.
  for (const fn of FUNCIONES_SOLO_PRO) {
    const f = filas.find((x) => x.que === NOMBRE_FUNCION_PRO[fn]);
    if (FUNCIONES_TODAVIA_NO_VENDIDAS.includes(fn)) {
      assert.equal(f, undefined, `${fn} no se vende todavía y la tabla la promete`);
      continue;
    }
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
  // AGENDAR LA LLAMADA, SÓLO EN EL ACELERADOR (14/11/2026, Martín: «lo de agendar llamadas sí debería estar todavía para el tema
  // de Accelerator… Pero en ningún otro lado debería estar»). Antes el botón llevaba a /planes/acelerador, el pedido que cae al
  // CRM con el origen y el código de partner; ahora lleva a la agenda de Martín, fuera del sitio y en otra pestaña.
  assert.match(t, /<a className="mkpl-btn" href=\{AGENDA_ACELERADOR\} target="_blank" rel="noopener noreferrer">\{TEXTO_AGENDA_ACELERADOR\}<\/a>/, 'el Acelerador no ofrece agendar la llamada');
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
  const { CEJA_LISTA, LISTA_PROGRAMA } = await import('../app/planes/Tarjetas');
  const t = await vitrina();
  // 14/11/2026 (Martín: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la idea es que cada
  // uno se sienta único»): MaKo Pro ya no está en el título de la lista, es el PRIMER check. La columna se lee sola.
  assert.doesNotMatch(t, /Todo lo de MaKo Pro, más:/, 'volvió la fórmula «todo lo de X» al Acelerador');
  // 15/11/2026, a la noche (Martín): «el primer ítem debería ser justamente 3 meses de acompañamiento personalizado». El
  // software va al final: si la columna empieza por MaKo Pro, se lee como «MaKo, más algo» y no como acompañamiento.
  assert.equal(LISTA_PROGRAMA[0].fuerte, '3 meses de acompañamiento personalizado', 'el programa no abre con el acompañamiento');
  assert.ok(LISTA_PROGRAMA.some((x) => x.fuerte === 'MaKo Pro completo'), 'el programa no dice que trae Pro entero');
  for (const que of ['WhatsApp personal de Martín', 'comunidad de empresarios', 'encuentro presencial en Buenos Aires', '1 a 1 con Martín']) {
    assert.ok(LISTA_PROGRAMA.some((x) => `${x.fuerte ?? ''}${x.texto}`.toLowerCase().includes(que.toLowerCase())), `al Acelerador le falta «${que}»`);
  }
  assert.ok(!LISTA_PROGRAMA.some((x) => /grupo de WhatsApp/i.test(`${x.fuerte ?? ''}${x.texto}`)), 'volvió el grupo de WhatsApp: ahora es la comunidad');
  // 15/11/2026: la ceja de las TRES listas es «Incluye» (`CEJA_LISTA`). Las de antes decían cómo se trabaja («Lo armamos
  // contigo», «Lo haces tú, con MaKo al lado»), que es el «lenguaje nuestro» que Martín pidió sacar de las columnas.
  const cejas = (await vitrinaHtml()).split(`<p class="mkpl-lista-t">${CEJA_LISTA}</p>`).length - 1;
  assert.equal(cejas, 3, `la ceja «${CEJA_LISTA}» tiene que estar arriba de los checks de las tres columnas (hay ${cejas})`);
  for (const vieja of ['Lo haces tú, con MaKo al lado', 'MaKo lo hace, tú apruebas']) {
    assert.ok(!t.includes(vieja), `volvió la ceja «${vieja}», que Martín pidió cambiar`);
  }
  for (const r of LISTA_PROGRAMA) assert.ok(t.includes(r.fuerte ?? r.texto), r.fuerte ?? r.texto);
  // Cortas, como las de beehiiv, son las CABEZAS en negrita: es lo que se lee de un vistazo; el detalle va después.
  assert.ok(LISTA_PROGRAMA.every((r) => (r.fuerte ?? r.texto).split(' ').length <= 7), 'cabezas cortas, como las de beehiiv');
});

// ── CADA COLUMNA ÚNICA Y AUTOSUFICIENTE (14/11/2026) ───────────────────────────────────────────────────────────────
// Martín, textual: «no es la idea de que diga todo lo de Essential más tal, todo lo de MaKo Pro más… la idea es que cada uno se
// sienta único y tiene que pensarse como usuario… el de 47 debería estar bien limitado y restrictivo; el de 97 ya podés generar
// avatares de IA, editar videos, replicar landing… La idea es que compren el de 97, no el de 47.»
// El molde, el porqué de cada decisión y las siete páginas de precios que se relevaron: docs/relevo/planes-que-incluye-cada-columna.md §4.
// ⚠️ Esto se fija sobre `listaCorta`, que es lo que la tarjeta DIBUJA. `PLANES_MAKO_DEFAULT[].incluye` no lo lee nadie desde el
//    12/11 (§1.4 del relevo): un test sobre `incluye` daría verde con la pantalla sin cambiar.

test('ninguna columna dice «todo lo de X»: las dos se leen solas, y Pro no tiene menos renglones que Esencial', async () => {
  const { listaCorta } = await import('../app/planes/Tarjetas');
  const es = listaCorta('completo'), pro = listaCorta('agencia');
  for (const [que, l] of [['Esencial', es], ['Pro', pro]] as const) {
    assert.doesNotMatch(l.titulo, /todo lo de/i, `${que}: la ceja vuelve a la fórmula «todo lo de X»`);
    for (const it of l.items) assert.doesNotMatch(`${it.fuerte ?? ''}${it.texto}`, /todo lo de/i, `${que}: «${it.texto}»`);
  }
  // La recomendada nunca tiene menos bullets que la barata (Kajabi 5/6/4, beehiiv 6/6/8/7: la del medio tiene MÁS).
  assert.ok(pro.items.length >= es.items.length, `Pro tiene ${pro.items.length} renglones y Esencial ${es.items.length}`);
  // Y la pantalla entera tampoco: ni en las tarjetas, ni en la comparación, ni en las preguntas.
  assert.doesNotMatch(await vitrina(), /[Tt]odo lo de (Esencial|MaKo Pro)/, '/planes');
});

// ⚠️ ESTE TEST DECÍA LO CONTRARIO HASTA EL 15/11/2026, y el cambio es de Martín, no una concesión.
// La regla del 14/11 era «ningún número adentro de un bullet» (el molde de Kajabi: los topes en una línea sola, arriba),
// y tenía su razón — con 5 de 7 renglones en cifras, la columna barata se leía como una lista de lo que no te alcanza.
// El 15/11 Martín miró el resultado y pidió lo inverso, textual: «en la columna de los planes, sí está bien que tenga la
// cantidad de MaKo Tokens al mes, pero todo lo que está abajo debería ir como checks. No debería ir ahí arriba. Todo al
// lado de otro, 2000 leads, un pipeline, una página. O de última no debería ir directamente». Esa línea de cifras pegadas,
// en el cuerpo más chico de la tarjeta, no la lee nadie.
// LO QUE ESTE TEST SIGUE FIJANDO, QUE ES LO QUE DE VERDAD IMPORTA: que los números de los checks SALGAN DEL CÓDIGO y no de
// la mano de nadie. Es la guarda contra prometer 3 automatizaciones donde el producto frena en 2, y no depende de si el
// número va arriba o adentro del bullet.
test('los números de los checks salen del CÓDIGO, y arriba queda sólo la línea de MaKo Tokens', async () => {
  const { listaCorta } = await import('../app/planes/Tarjetas');
  const { cupoDeCapa } = await import('../lib/mako-tokens-reglas');
  const { IMAGENES_POR_MES, minutosDelPlan } = await import('../lib/mako-tokens-paquetes');
  const { PLAN_DE_CAPA } = await import('../lib/mako-tokens-reglas');
  for (const capa of ['completo', 'agencia'] as const) {
    const l = listaCorta(capa);
    // Los topes dejaron de ser un campo: si vuelve a aparecer una fila aparte de cifras, esto se pone rojo.
    assert.equal((l as { topes?: unknown }).topes, undefined, `${capa}: volvió la fila de topes`);
    const todo = l.items.map((it) => `${it.fuerte ?? ''}${it.texto}`).join(' | ');
    // Cada cifra que aparece en un check tiene que ser un tope del código, el cupo, o un tope de generación.
    const permitidos = new Set<string>();
    for (const t of Object.values(TOPES[capa === 'completo' ? 'completo' : 'agencia'])) if (t != null) permitidos.add(t.toLocaleString('es-AR'));
    permitidos.add(IMAGENES_POR_MES[PLAN_DE_CAPA[capa]].toLocaleString('es-AR'));
    permitidos.add(String(minutosDelPlan(PLAN_DE_CAPA[capa])));
    // Los referentes del chat (15/11/2026, copy aprobado: «Chat con 32 referentes del marketing»): la cifra es `ASESORES.length`.
    permitidos.add(String((await import('../lib/asesores/catalogo')).ASESORES.length));
    for (const cifra of todo.match(/\d[\d.]*/g) ?? []) {
      assert.ok(permitidos.has(cifra), `${capa}: la cifra ${cifra} de un check no sale de ningún tope del código — «${todo}»`);
    }
    // Los MaKo Tokens de ESE plan, del cupo del código (lib/mako-tokens-reglas.ts), y siguen ARRIBA de los checks.
    const mt = cupoDeCapa(capa);
    assert.ok(mt != null && l.tokens?.startsWith(mt.toLocaleString('es-AR')), `${capa}: los tokens no salen del cupo (${l.tokens})`);
  }
  // LA DIFERENCIACIÓN, EN EL PRIMER CHECK DE CADA COLUMNA (15/11/2026, Martín: «debería haber una diferenciación clara de
  // lo que hace el plan de 97 y lo que hace el plan de 47»). Leídos en paralelo, los dos primeros renglones tienen que
  // decir la diferencia que más pesa — el video — sin que haya que bajar a la tabla.
  // ⚠️ SÓLO CUANDO LA GENERACIÓN SE VENDA. `GENERACION_SE_VENDE` (lib/planes-comparacion.ts) hoy es false, y el porqué está
  // medido allá: generar imágenes con IA no existe en MaKo (`USD_POR_IMAGEN` lo usan DOS archivos, su definición y la vitrina
  // de precios: ningún generador) y el video lo paga el cliente con sus créditos de Google Flow — ninguna ruta de app/api/
  // llama a ApiMart, que es el camino que nos costaría. Prometer un tope nuestro de minutos sobre los créditos de ÉL es
  // prometer algo que no podemos cumplir. Mientras sea false, los primeros checks NO hablan de generación; el día que se
  // venda, este test exige que la diferencia esté arriba, que es donde Martín la pidió.
  const { GENERACION_SE_VENDE } = await import('../lib/planes-comparacion');
  const esMtAntes = cupoDeCapa('completo')!, proMtAntes = cupoDeCapa('agencia')!;
  const primeroEs = listaCorta('completo').items[0];
  const primeroPro = listaCorta('agencia').items[0];
  if (GENERACION_SE_VENDE) {
    // ⚠️ DESDE EL 15/11/2026 A LA NOCHE LA DIFERENCIA LA DICE EL «TE ALCANZA PARA» DE CADA COLUMNA, no el primer check: Martín
    // pidió que lo que alcanza se mueva con la barra («cuando voy desplazando a más MaKo Tokens, debería ahí justamente
    // cambiar la cantidad de clips o de imágenes que me alcanzan»), y un check fijo diciendo el mismo número se desfasa el
    // primer día que la barra se mueve. Los checks NO repiten la generación; la frase de arriba sí la dice.
    const { alcanzaPara } = await import('../app/planes/CalculadoraTokens');
    assert.ok(alcanzaPara(esMtAntes, false).every((x) => x.clave !== 'clip'), 'al de US$47 no le promete ni un clip');
    assert.ok(alcanzaPara(proMtAntes, true).some((x) => x.clave === 'clip'), 'al de US$97 le dice sus clips');
    // Que el de US$47 NO genera video lo dice su «No incluye», con una ✗ (copy aprobado el 15/11 a la noche): el primer renglón.
    assert.match(listaCorta('completo').noIncluye?.[0]?.texto ?? '', /Generar videos con IA/, 'la columna del de US$47 no dice que no genera video');
    for (const it of [primeroEs, primeroPro]) {
      assert.doesNotMatch(`${it.fuerte ?? ''}${it.texto}`, /imágenes con IA|clips de video|minutos de video/i,
        `un check repite la generación que ya dice la frase de arriba: «${it.texto}»`);
    }
  } else {
    for (const it of [...listaCorta('completo').items, ...listaCorta('agencia').items]) {
      assert.doesNotMatch(`${it.fuerte ?? ''}${it.texto}`, /generación de (video|imágenes)|imágenes con IA|minutos de video/i,
        `una columna promete generación con IA y todavía no se vende: «${it.texto}»`);
    }
  }
  // El de US$47 es el nivel `pro` del medidor y el de US$97 es `growth`: el nombre engaña, el precio no (PLAN_DE_CAPA).
  // Leerlos por el nombre pone 11.750 MT donde van 24.250, y al revés. Esto es la guarda de ese cruce.
  const esMt = cupoDeCapa('completo'), proMt = cupoDeCapa('agencia');
  assert.ok(esMt != null && proMt != null && proMt > esMt, `el mapeo está cruzado: Esencial ${esMt}, Pro ${proMt}`);
  // Una capa sin cupo decidido (el Acelerador no tiene) no inventa un número: su columna no habla de tokens.
  assert.equal(cupoDeCapa('pm'), null);
  const t = await vitrina();
  assert.ok(t.includes(`${esMt.toLocaleString('es-AR')} MaKo Tokens al mes`), '/planes no dice los tokens de Esencial');
  assert.ok(t.includes(`${proMt.toLocaleString('es-AR')} MaKo Tokens al mes`), '/planes no dice los tokens de Pro');
});

test('la negrita es de Pro y de nadie más: la columna barata queda plana sin que le falte un renglón', async () => {
  const { listaCorta } = await import('../app/planes/Tarjetas');
  // ClickFunnels (3.3 del relevo): en Launch, el barato, no hay NI UN bullet en negrita; en Scale van en negrita los que
  // mejoran. Así la columna de Esencial no engancha el ojo y aun así no se le puede acusar de esconder nada.
  for (const it of listaCorta('completo').items) assert.equal(it.fuerte, undefined, `Esencial con negrita: «${it.texto}»`);
  for (const it of listaCorta('agencia').items) assert.ok(it.fuerte, `Pro sin negrita: «${it.texto}»`);
});

test('lo que alcanza cada columna sale de los costos que se COBRAN, no de un número a mano', async () => {
  // 15/11/2026, a la noche: la tabla de costos (`COSTO_POR_ACCION`) se fue y en su lugar cada columna dice para cuánto le
  // alcanzan sus MaKo Tokens (Martín: «también sería bueno de que ya se calcule el resto de cosas, como por ejemplo el
  // análisis de los competidores, las transcripciones… en cada una de las columnas»). Lo que este test fija es lo mismo que
  // fijaba la tabla, que es lo que importa: **ningún costo escrito a ojo en la vitrina**. Un costo inventado es un cobro
  // inventado.
  const { LO_QUE_ALCANZA } = await import('../app/planes/CalculadoraTokens');
  const { MT_POR_CLIP } = await import('../lib/mako-tokens-paquetes');
  const { mtDeImagenes, CUPO_MENSUAL } = await import('../lib/mako-tokens-reglas');
  const { costoDeFeature, mtReservaDeFeature, COSTO_POR_DEFECTO } = await import('../lib/mako-tokens-costos');
  for (const c of LO_QUE_ALCANZA) {
    if (c.clave === 'clip') assert.equal(c.mt, MT_POR_CLIP, 'el clip, a lo que se cobra el clip');
    else if (c.clave === 'imagen') assert.equal(c.mt, mtDeImagenes(1), 'la imagen, a lo que se cobra la imagen');
    else {
      assert.ok(c.feature, `«${c.varios}» no dice de qué feature del medidor sale su costo`);
      // ⚠️ Un `feature` mal escrito NO tira: el medidor le pone su costo por defecto en silencio. Por eso se exige que exista.
      assert.notEqual(costoDeFeature(c.feature), COSTO_POR_DEFECTO, `el medidor no conoce «${c.feature}»: su costo sería el de por defecto`);
      assert.equal(c.mt, mtReservaDeFeature(c.feature), `«${c.varios}» tiene que costar lo que descuenta el medidor`);
    }
    assert.ok(c.mt > 0, `«${c.varios}» no puede costar cero`);
  }
  // Y lo que Martín nombró está: competidores y transcripciones.
  const claves = LO_QUE_ALCANZA.map((c) => c.clave);
  for (const k of ['competidor', 'transcripcion']) assert.ok(claves.includes(k), `falta «${k}» en lo que alcanza`);
  // Sin «guiones de reels» (Martín, 15/11: «lo que no queda claro es guiones con IA. Creo que quisiste poner transcripciones»).
  assert.ok(!claves.includes('guion'), 'volvió «guiones de reels» a lo que alcanza');
  // LA PANTALLA: los números en MaKo Tokens que /planes PUEDE decir, y de dónde sale cada uno. Cualquier otro es inventado.
  const t = await vitrina();
  assert.doesNotMatch(t, /Lo que gasta cada cosa/, 'la tabla de costos se fue de la pantalla');
  assert.doesNotMatch(t, /No gasta: usa tu IA/, 'y con ella la frase de «cada negocio paga su IA», que Martín dio vuelta el 15/11');
  const { PAQUETES } = await import('../lib/mako-tokens-paquetes');
  const { pasosDeLaBarra } = await import('../app/planes/CalculadoraTokens');
  const legitimos = new Set<string>([
    CUPO_MENSUAL.pro.toLocaleString('es-AR'), CUPO_MENSUAL.growth.toLocaleString('es-AR'),
    ...PAQUETES.map((p) => p.mt.toLocaleString('es-AR')),
    // los extra de la barra, desde «+0 MaKo Tokens extras al mes» (15/11/2026: siempre a la vista, también en cero)
    ...pasosDeLaBarra().map((p) => p.mt.toLocaleString('es-AR')),
  ]);
  for (const cifra of t.match(/[\d.]+(?= MaKo Tokens)/g) ?? []) {
    // Los montos de la barra son el cupo más lo que se suma: por arriba del cupo del plan chico, salen de ahí.
    const esDeLaBarra = Number(cifra.replace(/\./g, '')) >= CUPO_MENSUAL.pro;
    assert.ok(legitimos.has(cifra) || esDeLaBarra,
      `/planes dice «${cifra} MaKo Tokens» y ese número no es un cupo, ni un paquete de la tarifa, ni un paso de la barra`);
  }
});

test('AGENDAR LA LLAMADA, sólo en el Acelerador: ni las dos columnas de software ni el resto de la vitrina la ofrecen', async () => {
  // Martín, 14/11/2026: «lo de agendar llamadas sí debería estar todavía para el tema de Accelerator. Ahí debería haber la
  // agenda de llamada. Pero en ningún otro lado debería estar». La regla del 12/11 («ningún lado») queda con esta excepción.
  const { AGENDA_ACELERADOR, TEXTO_AGENDA_ACELERADOR } = await import('../app/planes/Tarjetas');
  assert.equal(AGENDA_ACELERADOR, 'https://calendly.com/koncke/asesoria', 'la agenda es la de Martín, no la de un cliente');
  const html = await vitrinaHtml();
  // UNA sola, y en otra pestaña: es un link de afuera del sitio.
  assert.equal((html.match(/calendly\.com/g) ?? []).length, 1, 'la agenda aparece más de una vez en /planes');
  assert.match(html, new RegExp(`href="${AGENDA_ACELERADOR.replace(/[./]/g, '\\$&')}" target="_blank" rel="noopener noreferrer"`));
  // Los botones de Esencial y de Pro no agendan nada: se compran (o se piden) en /planes/<id>.
  for (const id of ['esencial', 'pro']) assert.ok(html.includes(`/planes/${id}`), `el botón de ${id} dejó de llevar a su checkout`);
  assert.equal((html.match(new RegExp(TEXTO_AGENDA_ACELERADOR, 'g')) ?? []).length, 1, 'otra pantalla de /planes ofrece agendar');
  // Y el CTA del sitio sigue siendo la prueba, no la llamada (app/vsl/_competencia/cta.ts).
  const { RUTA_CTA, TEXTO_CTA } = await import('../app/vsl/_competencia/cta');
  assert.equal(RUTA_CTA, '/planes');
  assert.doesNotMatch(TEXTO_CTA, /agend|llamada/i, 'el CTA del sitio volvió a ser agendar una llamada');
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
  const { TEXTO_AGENDA_ACELERADOR } = await import('../app/planes/Tarjetas');
  const t = await vitrina();
  // ⚠️ DEBAJO DEL BOTÓN DESDE EL 15/11/2026, no arriba. El 25/10 se puso arriba a propósito (la promesa vende antes de
  // que se apriete), y hoy Martín pidió el orden de las tres columnas al revés: «primero el precio y abajo todas las
  // frases. O sea, primero el precio y el botón, por supuesto». La promesa es una de esas frases, así que baja con ellas.
  // Lo que NO cambió y se sigue exigiendo: que esté en la pantalla y que diga exactamente `promesa`.
  assert.ok(t.indexOf(`Nuestra promesa: ${promesa}`) > 0, 'la promesa, en la columna del Acelerador');
  assert.ok(t.indexOf('Nuestra promesa') > t.indexOf(TEXTO_AGENDA_ACELERADOR), 'y debajo del botón (el orden del 15/11)');
  const antes = PROGRAMA_ACELERADOR.promesa;
  (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = null;
  try {
    assert.doesNotMatch(await vitrina(), /Nuestra promesa/, 'sin promesa, no se inventa una');
  } finally { (PROGRAMA_ACELERADOR as { promesa: string | null }).promesa = antes; }
});

test('la GARANTÍA del programa es sobre los entregables de la semana 1, vive en /reembolsos, y la tarjeta ya no la linkea', async () => {
  const { garantia } = PROGRAMA_ACELERADOR;
  assert.ok(garantia);
  assert.match(garantia!, /primera semana/);
  assert.match(garantia!, /sistema de ventas no está armado/);
  assert.doesNotMatch(garantia!, /vend|factur|llamadas|clientes/i, 'no es una garantía de resultado (§6c: recién con datos)');
  assert.ok(PROGRAMA_ACELERADOR.incluye.some((x) => x.includes(`hasta ${HORAS_SEMANA_1} horas`)), 'el entregable, escrito con su tope de horas');
  // ⚠️ LA TARJETA YA NO LLEVA EL LINK «Con garantía de entrega» (15/11/2026, a la noche; Martín: «en MaKo Accelerator
  // eliminaría esa parte de con garantía de entrega. Eso elimínalo»). Era un renglón suelto debajo del botón que, además, como la
  // fila del botón es compartida entre las tres columnas (subgrid), le dejaba un hueco blanco a Esencial y a Pro. La promesa
  // del Acelerador sigue diciendo «garantizado por contrato», y la garantía entera vive en /reembolsos §2, que es lo que se
  // vigila acá abajo.
  const t = await vitrina();
  assert.ok(!t.includes('Con garantía de entrega'), 'volvió el link de la garantía a la tarjeta del Acelerador');
  assert.doesNotMatch(fuente('app/planes/Tarjetas.tsx'), /className="mkpl-garantia"/, 'quedó el link de la garantía en la tarjeta');
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
  // 15/11/2026, a la noche: LA FRASE DE «PARA QUIÉN ES» SE FUE DE LAS TRES COLUMNAS. Martín: «tampoco me gusta el texto de
  // para quién vende solo o para quién ya vende y tiene equipo. Ese texto elimínalo». El `resumen` sigue en el plan porque lo
  // leen el bot de WhatsApp y el checkout; lo que se fija acá es que la columna no lo dibuje.
  for (const plan of PLANES_MAKO_DEFAULT.filter((x) => x.activo)) {
    assert.ok(!t.includes(plan.resumen), `volvió la frase «${plan.resumen}» a la columna de ${plan.nombre}`);
  }
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
  // ⚠️ LA TARJETA YA NO MUESTRA EL PRECIO EN PESOS, NI CUANDO EL PLAN LO TIENE CARGADO (15/11/2026). Martín, textual: «No
  // pongas la conversión en pesos argentinos. Eso ya cada uno luego lo ve». Hasta hoy este test exigía lo contrario
  // («con el precio del plan en pesos, se dice»), y la medición en producción del 15/11 mostraba «o $ 73.555 ARS por
  // mes» y «o $ 151.805 ARS por mes» compitiendo con el precio en dólares, que es el que ancla.
  // El precio en pesos NO se borró del producto: sigue donde se COBRA (el checkout lo muestra con la pasarela elegida) y
  // `precioEnPesos` sigue siendo la única fuente — nunca una tasa de cambio. Lo que se fue es el renglón de la vitrina.
  const conPesos = PLANES_MAKO_DEFAULT.filter((x) => x.activo).map((x) => (x.id === 'pro' ? { ...x, preciosLocales: { ARS: 97000 } } : x));
  assert.doesNotMatch(sinMarcas(await vitrinaHtml(conPesos)), /ARS/, 'con el precio del plan en pesos cargado, la tarjeta tampoco lo muestra');
  assert.equal(precioEnPesos({ preciosLocales: { ARS: 97000 } }), 97000, 'y el dato sigue existiendo para el checkout');
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
// LA CALCULADORA, REDISEÑADA EL 15/11/2026. Martín, textual: «Está horrible la sección de calcula cuántos MaKo Tokens
// necesitas. Prefiero algo simple como lo que teníamos antes, que sea el deslizable y listo»; «pusiste MaKo Pro al lado
// cuando ya tenemos una columna de MaKo Pro abajo. No tiene sentido»; «la idea justamente es que cuando yo haga el
// desplazable, se me modifica el precio de las columnas».
// Lo que este test vigila ahora: que la barra MUEVA el precio de las columnas (que es para lo que existe), que no vuelva a
// dibujar una tarjeta de plan propia, y que nunca prometa video donde no hay.
test('la barra dice cuánto sale sumar MaKo Tokens, arranca en «tu plan», y NO mueve los precios de las columnas', async () => {
  const { MT_POR_DOLAR, PAQUETES, CLIPS_POR_MES } = await import('../lib/mako-tokens-paquetes');
  const { CUPO_MENSUAL } = await import('../lib/mako-tokens-reglas');
  const { pasosDeLaBarra, PASOS_USD, usdDeLaDiferencia, alcanzaPara, redondoParaLeer } = await import('../app/planes/CalculadoraTokens');
  const { GENERACION_SE_VENDE } = await import('../lib/planes-comparacion');
  const mil = (n: number) => n.toLocaleString('es-AR');
  const t = await vitrina();
  const html = await vitrinaHtml();

  // LA CUARTA VUELTA (15/11/2026, a la noche). Martín, textual:
  //   «la idea no es que el precio de abajo se modifique, sino que la idea es que la barra deslizable diga el precio en dólares.
  //    Y de última que en otro lado se muestren los tokens que estarías comprando»
  //   «siempre tiene que empezar como en un punto, que es el punto donde ya te trae los tokens de tu propio plan, y menos de eso
  //    que no se pueda bajar»
  //   «eliminaría el texto de calcula cuántos MaKo Tokens necesitas, pondría la barra directamente abajo de mensual o anual»
  //   «Me gustaba el que teníamos antes… una barrita más simple» (la de la primera calculadora: un range, riel y botón).
  assert.doesNotMatch(t, /Calcula cuántos MaKo Tokens necesitas/, 'volvió el título de la barra');
  // Se busca el MARCADO (`class="…"`), no el nombre suelto: los nombres aparecen antes en la hoja de estilos de la página.
  const iSel = html.indexOf('class="mkpl-periodo"'), iBarra = html.indexOf('data-tk=""'), iCols = html.indexOf('class="mkpl-grilla"');
  assert.ok(iSel > 0 && iSel < iBarra && iBarra < iCols,
    'la barra va debajo del selector mensual / anual y arriba de las columnas');
  for (const pieza of ['tk-riel', 'tk-relleno', 'tk-burbuja', 'tk-plan', 'type="range"']) assert.ok(html.includes(pieza), `a la barra le falta ${pieza}`);
  for (const vieja of ['tk-incluido', 'tk-valor', 'tk-lleno']) assert.ok(!html.includes(vieja), `volvió el bloque de 46 px (${vieja})`);
  assert.doesNotMatch(t, /Si te faltan/, 'volvió el «si te faltan, sumas más cuando quieras»');
  // LOS PRECIOS DE LAS COLUMNAS NO LOS MUEVE NADIE: no llevan marca para que un script los cambie.
  // EL PRECIO DE LAS COLUMNAS NO LO MUEVE NADIE («la idea no es que el precio de abajo se modifique»)…
  assert.doesNotMatch(html, /data-tk-(precio|nota)/, 'una columna volvió a tener un precio que la barra mueve');
  // …PERO SUS MaKo TOKENS Y LO QUE ALCANZAN, SÍ («cuando voy ajustando la barra, cambie también la cantidad de cosas que me
  // alcanzan y tokens abajo en los planes»): las dos columnas con cupo llevan las dos marcas.
  for (const id of ['esencial', 'pro']) {
    assert.ok(html.includes(`data-tk-mt="${id}"`) && html.includes(`data-tk-alcanza="${id}"`), `${id}: la barra no puede mover sus tokens`);
  }
  // Y lo de abajo de la barra está SIEMPRE, también en cero, y dice «extras al mes» («no pondría este mes, sino extras al mes»).
  assert.match(t, /\+0 MaKo Tokens extras al mes/, 'la línea de abajo de la barra no está en el arranque');
  assert.doesNotMatch(t, /MaKo Tokens este mes/, 'volvió el «este mes»');
  assert.match(html, /class="tk-burbuja"[^>]*>\+US\$ 0\/mes</, 'la burbuja del precio no está en el arranque');

  // LOS PASOS: en dólares redondos, desde CERO DE MÁS (lo que trae tu plan) — nunca por debajo.
  const pasos = pasosDeLaBarra();
  assert.deepEqual(pasos.map((p) => p.usd), [...PASOS_USD]);
  assert.equal(pasos[0].usd, 0, 'arranca en lo que trae tu plan: cero dólares de más');
  assert.ok(pasos.every((p, i) => i === 0 || p.usd > pasos[i - 1].usd), 'sólo se sube');
  for (const p of pasos) {
    assert.equal(p.mt, p.usd * MT_POR_DOLAR, 'los tokens de cada paso son la tarifa, no un número a mano');
    assert.equal(p.mt % 500, 0, `el paso de US$${p.usd} da ${p.mt} MaKo Tokens, que no es redondo`);
  }
  // Los paquetes que se venden son pasos de la barra: la barra no puede ofrecer un monto que no se vende.
  for (const paq of PAQUETES) assert.ok(PASOS_USD.includes(paq.usd), `el paquete de US$${paq.usd} no está en la barra`);
  // El input arranca en el primer paso y no tiene un mínimo más bajo.
  const rango = /<input[^>]*class="tk-rango"[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(rango.includes('min="0"') && rango.includes('value="0"'), `el deslizable no arranca en «tu plan»: ${rango}`);

  // CADA PASO MUEVE LAS COLUMNAS: sus MaKo Tokens son los del plan MÁS los extra, y sus renglones salen de esa suma.
  {
    const { htmlAlcanza } = await import('../app/planes/CalculadoraTokens');
    const conPlanes = pasosDeLaBarra([{ id: 'esencial', capa: 'completo' }, { id: 'pro', capa: 'agencia' }]);
    for (const paso of conPlanes) {
      for (const [id, cupo, video] of [['esencial', CUPO_MENSUAL.pro, false], ['pro', CUPO_MENSUAL.growth, true]] as const) {
        const col = paso.columnas.find((x) => x.id === id)!;
        assert.equal(col.mt, mil(cupo + paso.mt), `${id}, +US$${paso.usd}: los tokens de la columna no son los del plan más los extra`);
        assert.equal(col.alcanza, htmlAlcanza(cupo + paso.mt, video), `${id}, +US$${paso.usd}: los renglones no salen de esa suma`);
      }
    }
    const ultimoPro = conPlanes[conPlanes.length - 1].columnas.find((x) => x.id === 'pro')!;
    assert.notEqual(ultimoPro.alcanza, conPlanes[0].columnas.find((x) => x.id === 'pro')!.alcanza, 'mover la barra no cambió lo que alcanza');
  }
  // LO QUE ALCANZA CADA COLUMNA: los renglones de su primer ítem de «Incluye», con los números del cupo y de lo que cuesta cada cosa.
  for (const [capa, cupo, conVideo] of [['completo', CUPO_MENSUAL.pro, false], ['agencia', CUPO_MENSUAL.growth, true]] as const) {
    // El texto sin marcas deja un espacio donde termina la negrita («al mes , que»): se busca con espacio opcional.
    const escapar = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // «24.000 MaKo Tokens al mes:» y directo los renglones (Martín: «elimina la parte de que te alcanzan para»).
    const reMt = new RegExp(`${escapar(mil(cupo))} MaKo Tokens al mes:`);
    assert.doesNotMatch(t, /que te alcanzan para/, 'volvió el «que te alcanzan para»');
    assert.match(t, reMt, `${capa}: no dice sus MaKo Tokens como ítem de «Incluye»`);
    const items = alcanzaPara(cupo, conVideo);
    assert.ok(items.length >= 4, `${capa}: dice muy poco de para qué le alcanza`);
    for (const x of items) {
      assert.ok(x.n > 0, `${capa}: un renglón dice cero («${x.que}»)`);
      assert.match(t, new RegExp(`${escapar(mil(x.n))}\\s+${escapar(x.que)}`), `${capa}: falta «${mil(x.n)} ${x.que}» en la columna`);
    }
  }
  // Redondo para leer, y HACIA ABAJO, que es una promesa: 2.666 → 2.600 (2.700 prometería 34 que no entran).
  assert.deepEqual([2666, 545, 26, 0.4].map(redondoParaLeer), [2600, 540, 26, 0]);
  // El de US$47 no genera video, y el video se dice en CLIPS, nunca en minutos.
  assert.equal(CLIPS_POR_MES.pro, 0, 'el plan de US$47 no genera video');
  assert.doesNotMatch(t, /minutos? de video/, '/planes vuelve a hablar de minutos de video');
  if (GENERACION_SE_VENDE) assert.ok(alcanzaPara(CUPO_MENSUAL.growth, true).some((x) => x.clave === 'clip'), 'la columna del de US$97 no dice sus clips');

  // Lo que sale sumar: la TARIFA al dólar entero, hacia arriba (la usan el checkout y el ledger).
  assert.equal(usdDeLaDiferencia(0), 0);
  assert.equal(usdDeLaDiferencia(1), 1, 'un token de más cuesta el dólar mínimo, no un clip entero');
  assert.equal(usdDeLaDiferencia(MT_POR_DOLAR), 1, 'un dólar compra exactamente la tarifa');
  assert.equal(usdDeLaDiferencia(MT_POR_DOLAR + 1), 2, 'y pasarse por un token cuesta el dólar siguiente');

  // NO VUELVE A DIBUJAR UNA TARJETA DE PLAN: «ya tenemos una columna de MaKo Pro abajo. No tiene sentido».
  const fuenteCalc = fuente('app/planes/CalculadoraTokens.tsx');
  assert.doesNotMatch(fuenteCalc, /tk-cta|tk-card|tk-lista/, 'la tarjeta de la calculadora se fue entera');
  assert.doesNotMatch(fuenteCalc, /<a /, 'la barra no tiene botón propio: el botón vive en la columna');
});

// =============================================================================
// LA DIFERENCIA ENTRE EL DE US$47 Y EL DE US$97, LEÍDA DE UN VISTAZO (15/11/2026, a la noche)
// =============================================================================
// Martín: «para una persona que lo mira no entiende mucho la diferencia entre el de 47 y el de 97… en el de 47 hay un montón de
// cosas que no se pueden hacer directamente, que en el de 97 sí»; y aprobó el copy con un bloque «No incluye» con ✗ ROJAS en
// el de 47, en el MISMO orden que los primeros checks del de 97. Este test fija ese orden: cada ✗ tiene su ✓ enfrente.
test('cada ✗ de Esencial queda frente a su ✓ de Pro, en el mismo orden, y la tabla marca ✓ verde y ✗ roja', async () => {
  const { listaCorta, CEJA_NO_INCLUYE } = await import('../app/planes/Tarjetas');
  const es = listaCorta('completo'), pro = listaCorta('agencia');
  assert.ok(es.noIncluye && es.noIncluye.length >= 6, 'el de US$47 no dice lo que no hace');
  // LOS RENGLONES DE LOS MaKo TOKENS, ALINEADOS ENTRE LAS DOS COLUMNAS (Martín, 15/11, a la noche: «que sigan como un mismo
  // lineamiento… en el de 47, 0 clips de videos con IA o algo en rojo tipo tachado»), con «o» desde el segundo («me gustaba que
  // antes decía o») y sin la nota del reparto («elimina el texto de los repartes como quieras»).
  const { htmlAlcanza } = await import('../app/planes/CalculadoraTokens');
  const { CUPO_MENSUAL } = await import('../lib/mako-tokens-reglas');
  const { GENERACION_SE_VENDE } = await import('../lib/planes-comparacion');
  const filasEs = htmlAlcanza(CUPO_MENSUAL.pro, false).split('</li>').filter(Boolean);
  const filasPro = htmlAlcanza(CUPO_MENSUAL.growth, true).split('</li>').filter(Boolean);
  if (GENERACION_SE_VENDE) {
    assert.equal(filasEs.length, filasPro.length, 'las dos columnas no tienen los mismos renglones de MaKo Tokens');
    assert.match(filasEs[0], /class="mkpl-alcanza-sin"><b>0<\/b> clips de video con IA/, 'el de US$47 no abre con «0 clips», tachado');
    assert.match(filasPro[0], /<li><b>\d+<\/b> clips de video con IA/, 'el de US$97 no abre con sus clips');
  }
  for (const f of [...filasEs.slice(1), ...filasPro.slice(1)]) assert.match(f, /^<li>o <b>/, `un renglón sin «o»: ${f}`);
  assert.equal([...filasEs, ...filasPro].filter((f) => f.includes('<b>0</b>')).length, GENERACION_SE_VENDE ? 1 : 0, 'un cero que no es el de los clips del de US$47');
  const textoPlanes = await vitrina();
  assert.doesNotMatch(textoPlanes, /Los repartes como quieras/, 'volvió la nota del reparto');
  // Y el Acelerador sin «Con garantía de entrega» (Martín: «eso elimínalo»).
  assert.doesNotMatch(textoPlanes, /Con garantía de entrega/, 'volvió «Con garantía de entrega» al Acelerador');
  assert.equal(pro.noIncluye, undefined, 'el de US$97 no tiene «No incluye»');
  // La misma cosa, con las palabras de cada lado. Si alguien reordena una de las dos listas, esto se pone rojo.
  const PARES: Array<[RegExp, RegExp]> = [
    [/videos con IA/i, /Videos con IA/],
    [/página de venta de un competidor/i, /página de venta de cualquier competidor/i],
    [/Edición automática/i, /Edición automática/i],
    [/asistente con IA/i, /asistente con IA/i],
    [/Piloto automático/i, /Piloto automático/i],
    [/llamadas de venta/i, /llamada de venta/i],
    [/referentes del marketing/i, /referentes del marketing/i],
    [/Comunidad para tus alumnos/i, /Comunidad para tus alumnos/i],
  ];
  PARES.forEach(([deEs, dePro], i) => {
    assert.match(es.noIncluye![i].texto, deEs, `la ✗ #${i + 1} de Esencial no es la que va ahí: «${es.noIncluye![i].texto}»`);
    const p = pro.items[i];
    assert.match(`${p.fuerte ?? ''}${p.texto}`, dePro, `el ✓ #${i + 1} de Pro no está frente a su ✗: «${p.fuerte ?? ''}${p.texto}»`);
  });
  // Lo dibuja la columna: el título y una ✗ por renglón, en rojo («evidentemente las X las pondría en rojo»).
  const html = await vitrinaHtml();
  assert.ok(html.includes(`>${CEJA_NO_INCLUYE}</p>`), 'la columna no dibuja «No incluye»');
  assert.equal(html.split('<ul class="mkpl-lista mkpl-lista-no">').length - 1, 1, 'el «No incluye» va en una sola columna');
  const css = fuente('app/planes/Tarjetas.tsx');
  assert.match(css, /\.mkpl-lista\.mkpl-lista-no li::before \{ content: "✕";[^}]*color: #D92D20/, 'la ✗ de la columna no es roja');
  // Y en la comparación de abajo: ✓ verde, ✗ roja («abajo también en la comparación las tildes las pondría en verde»).
  const estilo = fuente('app/planes/estilo.ts');
  assert.match(estilo, /\.planes-si \{[^}]*background: #16A34A/, 'la ✓ de la tabla no es verde');
  assert.match(estilo, /\.planes-no \{[^}]*color: #D92D20/, 'la ✗ de la tabla no es roja');
  assert.doesNotMatch(estilo, /td\[data-destacado\] \.planes-si \{ background: #2F6FED/, 'volvió la ✓ azul de la columna recomendada');
});
