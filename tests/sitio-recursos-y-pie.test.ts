// =============================================================================
// El sitio de MaKo, lo que pidió Martín el 15/11/2026 (~21:40-23:00): «Recursos» en la barra, el pie en todas las rutas, «lo que
// ya pagas» sin Opus Clip y con «Te ahorras», los logos con su color, las columnas de la portada IGUALES a las de /planes y los
// signos centrados
// =============================================================================
// Martín, textual:
//   · «en lugar de poner comparaciones en la top bar, pondría recursos o algo así… la parte de MaKo Partners, la parte de agencia,
//     las comparaciones. Pondría ahí también la documentación de API»;
//   · «la bottom bar… debería estar en todas las landing, todas las rutas. Incluso en la de precios también, en todas. Y también el
//     tema de la razón social se me hace que quedó como muy alejado, hay mucha separación»;
//   · «yo quitaría Opus Clip… en el ticket de lo que probablemente ya pagas. Fíjate que el logo de MaKo, si estoy en White Mode,
//     quede justamente negro… falta justamente la palabra te ahorras… el logo de Claude está tipo en negro»;
//   · «en la landing principal se tiene que repetir exactamente lo mismo que en precios… las columnas de los tres planes»;
//   · «la información en muchos lados… no estás centrado en el círculo… céntralo bien todo».
// Lo que se fija acá, en lo DIBUJADO (renderToStaticMarkup) cuando se puede, y en el fuente cuando la página lee la base o la URL.
//
// PROBADO ROMPIÉNDOLO (15-16/11/2026; base 9 / 0), cada rotura restaurada (pasan / fallan):
//   · «Comparaciones» vuelve a ser un link suelto de la barra (sin el menú)                        -> 8 / 1 (el 1)
//   · un renglón de Recursos con una ruta que no existe ('/blog')                                  -> 8 / 1 (el 2)
//   · /agency sin `conCuenta`, como si fuera pública                                                -> 8 / 1 (el 2)
//   · /accelerator sin <PieGlobal />                                                                 -> 8 / 1 (el 4)
//   · la razón social vuelve a «© {año} MaKo · Razón social: {X}» (tres nodos)                       -> 8 / 1 (el 3; con
//     renderToStaticMarkup daba verde: ése no escribe los <!-- --> entre nodos, renderToString sí)
//   · el © vuelve a tener margin-top:16px                                                            -> 8 / 1 (el 3)
//   · OpusClip vuelve al ticket · el ícono de MaKo del ticket sin data-tema-fijo · se va «Te ahorras» -> 8 / 1 cada una (el 5)
//   · ClickFunnels sale de LOGOS_SOBRE_BLANCO · el cuadro de Claude vuelve a #181818                  -> 8 / 1 cada una (el 6)
//   · las columnas de la portada sin la barra de MaKo Tokens · en la letra del sitio                  -> 8 / 1 cada una (el 7)
//   · la ✕ del caso vuelve a ser la letra · el tilde de la tabla vuelve a x = 5                      -> 8 / 1 cada una (el 8)
//   · la portada sin el JSON-LD                                                                      -> 8 / 1 (el 9)
// Y en la revisión del 16/11/2026 (base 10 / 0):
//   · el pie del sitio vuelve a esconder TODO <footer> (también el de las tarjetas de Copywriting)    -> 9 / 1 (el 4)
//   · sin la regla del modo oscuro para lo que la barra de MaKo Tokens reescribe                     -> 9 / 1 (el 7)
//   · las secciones con ancla sin scroll-margin-top en el teléfono                                   -> 9 / 1 (el 2)
// Correr: node --import tsx --test tests/sitio-recursos-y-pie.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { Barra, CSS_SOLO_PIE, PieGlobal } from '../app/vsl/_sitio/Barra';
import { Portada as PortadaVieja } from '../app/vsl/Portada';
import { Pie, lineaDelCopyright } from '../app/vsl/_sitio/Pie';
import { PortadaSitio } from '../app/vsl/_sitio/Portada';
import { SeccionReemplaza } from '../app/vsl/_sitio/LoQuePagas';
import { ComparacionesSitio } from '../app/vsl/_sitio/Comparaciones';
import { CSS_BASE, CSS_PIE, CSS_PORTADA } from '../app/vsl/_sitio/estilos';
import { HISTORIA, RECURSOS, RUTA_ACCELERATOR_SITIO, RUTA_COMPARACIONES, RUTA_INTEGRACIONES, RUTA_PREGUNTAS, columnasDelPie, recursosDelPie } from '../app/vsl/_sitio/datos';
import { esSeccionDeEstaPagina } from '../app/vsl/_sitio/CerrarMenuMovil';
import { COMPETIDORES, rutaVs } from '../app/vsl/_sitio/competencia';
import { LOGOS_SOBRE_BLANCO, STACK_QUE_REEMPLAZA, STACK_TIPICO, appsDeLaTira } from '../app/vsl/_sitio/reemplaza';
import { CSS_TARJETAS, RUTA_ACCELERATOR } from '../app/planes/Tarjetas';
import { CSS_TOKENS } from '../app/planes/CalculadoraTokens';
import { CSS_PLANES } from '../app/planes/estilo';
import { VitrinaPlanes } from '../app/planes/Vitrina';
import { ICON } from '../app/_components/ServicioVisual';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { esPublica } from '../lib/rutas-publicas';
import { EXTENSION_URL_TIENDA } from '../lib/extension-tienda';
import { RAZON_SOCIAL_MAKO } from '../lib/titular-mako';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const ACTIVOS = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
const PLANES = ACTIVOS.map((p) => ({
  id: p.id, nombre: p.nombre, capa: p.capa, precioUsd: p.precioUsd, resumen: p.resumen, incluye: p.incluye, destacado: !!p.destacado,
  precioAnualUsd: p.precioAnualUsd ?? null, preciosLocales: p.preciosLocales, cobrable: true,
}));
const OFERTAS = ACTIVOS.map((plan) => ({ plan, cobrable: true }));
const portada = (sufijo = '', promoVigente = false) => html(createElement(PortadaSitio, { planes: PLANES, sufijo, promoVigente }));

/** El bloque que empieza en `inicio` (un `<div …>`), cerrado por profundidad. */
function bloqueDiv(h: string, inicio: string): string {
  const ini = h.indexOf(inicio);
  if (ini < 0) return '';
  const re = /<div\b|<\/div>/g;
  re.lastIndex = ini;
  let prof = 0;
  for (let m = re.exec(h); m; m = re.exec(h)) {
    prof += m[0] === '</div>' ? -1 : 1;
    if (prof === 0) return h.slice(ini, m.index + 6);
  }
  return '';
}
/** Las declaraciones de la PRIMERA regla de una hoja con ese selector exacto. */
const regla = (css: string, sel: string) => css.match(new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

/** La página de app/ que sirve una ruta del sitio, o null. `/#ancla` es la portada. */
function paginaDe(href: string): string | null {
  const ruta = href.split(/[?#]/)[0] || '/';
  if (ruta === '/') return 'app/page.tsx';
  const directa = join('app', ruta, 'page.tsx');
  if (existsSync(join(RAIZ, directa))) return directa;
  // Una ruta con parámetro (/vsl/comparaciones/<app>): la carpeta [slug] del padre.
  const padre = ruta.split('/').slice(0, -1).join('/');
  for (const p of ['[slug]', '[funnel]', '[plan]']) if (existsSync(join(RAIZ, 'app', padre, p, 'page.tsx'))) return join('app', padre, p, 'page.tsx');
  return null;
}

test('1. «Recursos» en lugar de «Comparaciones»: un menú como Producto e Industrias, en la computadora y en el teléfono', () => {
  const h = html(createElement(Barra, { claro: false }));
  // El orden de la barra: Producto · Industrias · Recursos · Precios. «Comparaciones» ya no es un link suelto de la barra.
  const nav = h.slice(h.indexOf('class="s-nav"'), h.indexOf('</ul>', h.lastIndexOf('s-nav-it')));
  const rotulos = [...nav.matchAll(/class="s-nav-a"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(rotulos, ['Producto', 'Industrias', 'Recursos', 'Precios'], `la barra: ${rotulos.join(' · ')}`);
  assert.doesNotMatch(h, /class="s-nav-a" href="\/vsl\/comparaciones"/, '«Comparaciones» volvió a la barra como link suelto');
  assert.match(nav, /<span class="s-nav-a" tabindex="0" aria-haspopup="true">Recursos<\/span><div class="s-mega">/, 'Recursos no abre su menú como Producto');
  // En el teléfono, un renglón que se despliega, como Producto e Industrias (y sin la fila suelta «Comparaciones»).
  assert.match(h, /<details class="s-mv-sub"><summary class="s-mv-fila">Recursos /, 'el menú del teléfono sin Recursos');
  assert.doesNotMatch(h, /<a class="s-mv-fila" href="\/vsl\/comparaciones">/, 'la fila «Comparaciones» sigue en el teléfono');
  // Cada renglón, en los dos menús, con su ruta.
  for (const g of RECURSOS) for (const i of g.items) {
    const n = h.split(`href="${i.href.replace(/&/g, '&amp;')}"`).length - 1;
    assert.ok(n >= 2, `«${i.nombre}» está ${n} veces en la barra (la computadora y el teléfono)`);
  }
  // Lo que Martín nombró está.
  const todos = RECURSOS.flatMap((g) => g.items);
  for (const [que, href] of [['MaKo Partners', '/mako-partners'], ['agencias', '/agency'], ['las comparaciones', RUTA_COMPARACIONES], ['la documentación de la API', '/api-mako']] as const) {
    assert.ok(todos.some((i) => i.href === href), `falta ${que} (${href})`);
  }
  // Las «MaKo vs.» son las primeras de la comparación, no escritas a mano.
  const vs = RECURSOS.find((g) => g.rotulo === 'Comparar')!.items.filter((i) => i.href !== RUTA_COMPARACIONES);
  assert.deepEqual(vs.map((i) => i.href), COMPETIDORES.slice(0, vs.length).map(rutaVs));
  // El Accelerator del menú es la página a la que lleva /planes.
  assert.equal(RUTA_ACCELERATOR_SITIO, RUTA_ACCELERATOR, 'la ruta del Accelerator del sitio no es la de /planes');
});

test('2. cada renglón de Recursos lleva a algo que EXISTE, y lo que pide iniciar sesión lo dice', () => {
  const h = portada();
  for (const g of RECURSOS) for (const i of g.items) {
    if (i.externo) {
      assert.equal(i.href, EXTENSION_URL_TIENDA, `${i.nombre}: el único externo es la extensión en la Chrome Web Store`);
      continue;
    }
    const pagina = paginaDe(i.href);
    assert.ok(pagina, `${i.nombre}: ${i.href} no es una página de app/`);
    const ancla = i.href.split('#')[1];
    if (ancla) {
      assert.match(h, new RegExp(`id="${ancla}"`), `${i.nombre}: la portada no tiene la sección #${ancla}`);
      // Y en el teléfono la sección queda DEBAJO de la barra fija (57 px), no con el título cortado (medido a 390 el 16/11/2026).
      assert.match(h, new RegExp(`<section class="s-sec[^"]*" id="${ancla}"`), `#${ancla} ya no es una .s-sec: revisar su scroll-margin-top`);
      assert.match(CSS_PORTADA, /\.s-sec\[id\]\{scroll-margin-top:57px\}/, `#${ancla}: en el teléfono el título queda debajo de la barra`);
    }
    const ruta = i.href.split(/[?#]/)[0] || '/';
    // Pública o marcada: un visitante sin cuenta que toca un renglón «conCuenta» termina en /login, y eso tiene que estar dicho.
    const publica = ruta === '/' || esPublica(ruta);
    assert.equal(publica, !i.conCuenta, i.conCuenta ? `${i.nombre}: dice que pide sesión y ${ruta} ya es pública (sacar \`conCuenta\`)` : `${i.nombre}: ${ruta} pide iniciar sesión y no está marcada \`conCuenta\``);
  }
});

test('3. el pie: «Recursos» como la barra, Reembolsos en Legal, y la razón social en UN nodo y pegada a lo de arriba', () => {
  const cols = columnasDelPie();
  const recursos = cols.find((c) => c.titulo === 'Recursos');
  assert.ok(recursos, 'el pie sin «Recursos»');
  assert.deepEqual(recursos.links, recursosDelPie());
  // Ningún link dos veces en el pie (lo que ya está en otra columna no se repite en Recursos).
  const hrefs = cols.flatMap((c) => [...c.links, ...(c.sub?.links ?? [])].map((l) => l.href));
  assert.equal(new Set(hrefs).size, hrefs.length, `un link repetido en el pie: ${hrefs.filter((x, i) => hrefs.indexOf(x) !== i).join(', ')}`);
  const legal = cols.find((c) => c.titulo === 'Legal')!.links.map((l) => l.href);
  for (const r of ['/terminos', '/privacidad', '/reembolsos', '/aup', '/soporte']) assert.ok(legal.includes(r), `Legal sin ${r}`);
  for (const claro of [false, true]) {
    const h = html(createElement(Pie, { claro }));
    // UN nodo de texto: React no mete <!-- --> entre «Razón social:» y el nombre (Meta busca la frase entera). Se mira con
    // renderToString, que es el que escribe esos separadores (renderToStaticMarkup no los pone y daría verde igual).
    const conSeparadores = renderToString(createElement(Pie, { claro }));
    assert.ok(conSeparadores.includes(`<p class="s-pie-c">${lineaDelCopyright(new Date().getFullYear())}</p>`), 'la línea del © no es un solo nodo de texto');
    assert.ok(h.includes(`Razón social: ${RAZON_SOCIAL_MAKO}`));
    // El logo del pie claro va oscuro desde el server (en /mako-partners y /accelerator no está el sol y la luna para darlo vuelta).
    assert.match(h, claro ? /aria-label="MaKo — volver a la landing" style="[^"]*color:#12151B/ : /aria-label="MaKo — volver a la landing" style="[^"]*color:#fff/);
  }
  // PEGADA: sin el margen huérfano del ©, centrado con la estrella, y el aire entre el último link y el © de 64 px o menos.
  assert.doesNotMatch(regla(CSS_PIE, '.s-pie-c'), /margin-top/, 'volvió el margen de arriba del ©');
  assert.match(regla(CSS_PIE, '.s-pie-base'), /align-items:center/);
  const px = (decl: string, prop: string) => Number(decl.match(new RegExp(`${prop}:(\\d+)px`))?.[1] ?? NaN);
  const aire = px(regla(CSS_PIE, '.s-pie-col li'), 'padding-bottom') + px(regla(CSS_PIE, '.s-pie-in'), 'padding-bottom') + px(regla(CSS_PIE, '.s-pie-base'), 'padding-top');
  assert.ok(aire <= 64, `entre el último link y la base hay ${aire} px (eran 108 con el filete: Martín, «hay mucha separación»)`);
});

test('4. el pie en TODAS las páginas públicas que ve el visitante, una sola vez, y el porqué de las que no lo llevan', () => {
  // Lo que dibuja el pie del sitio por dentro (cada uno, comprobado abajo dibujándolo).
  const DIBUJAN_EL_PIE = /<PieGlobal\b|<Pie\b|<PortadaSitio\b|<ComparacionesSitio\b|<ComparacionVs\b|<LandingCompetencia\b|<FeatureDetail\b|pie=\{<PieGlobal/;
  // Las públicas SIN el pie del sitio, a propósito.
  const SIN_PIE: Record<string, string> = {
    '/planes/[plan]': 'el checkout: Martín, 14/11, sin la barra y «que no haya scroll» (app/planes/[plan]/Checkout.tsx)',
    '/login': 'entrar a la app', '/login/2fa': 'entrar a la app', '/login/restablecer': 'entrar a la app',
    '/app': 'instalar MaKo en el teléfono: la abre el QR del onboarding, una sola tarea a pantalla completa',
    '/pagar/[token]/listo': 'el comprador del link de pago de UN CLIENTE: no es el sitio de MaKo',
    '/compartido/[token]': 'el informe compartido de un cliente', '/compartido/curso/[token]': 'el curso de un cliente',
    '/vsl': 'redirige a la raíz', '/vsl/sitio': 'redirige a la raíz', '/vsl/estrategia': 'redirige al panel', '/vsl/costos': 'sólo super admin',
    // Las legales se abren ADENTRO de la app de iPhone, y ahí Apple no deja enlazar a comprar (lib/tienda.ts, `RUTAS_DE_VENTA`):
    // el pie del sitio lleva Precios, el Accelerator, MaKo Partners y las landings de /vsl. Llevan el suyo (`PieLegales`).
    '/terminos': 'legal (app de iPhone)', '/privacidad': 'legal (app de iPhone)', '/privacidad/extension': 'legal (app de iPhone)',
    '/reembolsos': 'legal (app de iPhone)', '/aup': 'legal (app de iPhone)', '/soporte': 'legal (app de iPhone)', '/eliminar-cuenta': 'legal (app de iPhone)',
  };
  const paginas = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /(^|\/)page\.tsx$/.test(f));
  const vistas: string[] = [];
  for (const f of paginas) {
    const ruta = (`/${f.replace(/^app\//, '').split('/').slice(0, -1).filter((p) => !/^\(.*\)$/.test(p)).join('/')}`).replace(/\/$/, '') || '/';
    if (ruta !== '/' && !esPublica(ruta.replace(/\[[^\]]+\]/g, 'x'))) continue;
    vistas.push(ruta);
    if (SIN_PIE[ruta]) continue;
    assert.match(leer(f), DIBUJAN_EL_PIE, `${ruta} (${f}) es pública y no dibuja el pie del sitio: súmalo (PieGlobal) o anota en SIN_PIE por qué no`);
  }
  for (const r of Object.keys(SIN_PIE)) assert.ok(vistas.includes(r), `SIN_PIE nombra ${r} y ya no es una página pública: sacala`);
  // Las piezas que lo traen adentro, dibujadas: el pie UNA vez (nunca dos, Martín: «sin que salga dos veces»).
  const una = (que: string, h: string) => assert.equal(h.split('<footer class="s-pie">').length - 1, 1, `${que}: el pie del sitio no está una sola vez`);
  una('la portada', portada());
  for (const f of ['app/planes/page.tsx', 'app/accelerator/page.tsx', 'app/mako-partners/page.tsx']) {
    assert.equal(leer(f).split('<PieGlobal').length - 1, 1, `${f}: el pie del sitio tiene que ir una vez`);
  }
  // /mako-partners traía su pie chico («Planes de MaKo · Términos», un <p>, no un <footer>: PieGlobal no lo oculta solo).
  assert.match(leer('app/mako-partners/LandingPartners.tsx'), /className="mp-pie"/, '¿se fue el pie chico de /mako-partners? Entonces sobra su regla');
  assert.match(leer('app/mako-partners/page.tsx'), /\.mp-publica \.mp-pie\{display:none\}/, '/mako-partners: dos pies, el chico encima del del sitio');
  assert.match(leer('app/vsl/_detalle/FeatureDetail.tsx'), /export function Pie\(\) \{\s*return <PieGlobal claro \/>;/, 'las 14 landings viejas sin el pie del sitio');
  // Las de Web Generator: ADENTRO de su caja fija (afuera no se alcanza), y sin los links legales sueltos que el pie ya trae.
  // Dibujada con un documento de prueba (la de verdad sale de la base).
  assert.match(leer('app/vsl/[slug]/page.tsx'), /pie=\{<PieGlobal claro \/>\}/);
  const wg = renderToStaticMarkup(createElement(PortadaVieja, {
    diseno: { html: '<header>la barra del documento</header><main>la landing</main><footer>el pie del documento</footer>', css: '' },
    conSuspense: false, pie: createElement(PieGlobal, { claro: true }),
  }));
  const caja = wg.slice(wg.indexOf('class="vsl-root"'));
  assert.ok(wg.indexOf('class="vsl-root"') > 0 && caja.includes('<footer class="s-pie">'), 'el pie del sitio no va adentro de la caja de la landing');
  una('una landing de Web Generator', wg);
  assert.doesNotMatch(caja, />Planes y precios</, 'quedaron los links legales sueltos además del pie del sitio');
  // Sin el pie (la landing de siempre), los links legales sueltos siguen (tests/creem-revision-sitio.test.ts los pide).
  assert.match(renderToStaticMarkup(createElement(PortadaVieja, { diseno: null, conSuspense: false })), />Planes y precios</);
  // Y el pie de una página que nace con el suyo (la de una referencia, el del Accelerator) queda oculto; el de una TARJETA no (16/11:
  // el renglón de abajo de las tarjetas de la comparación de Copywriting, «El original» / «Su versión», es un <footer> en un <article>).
  assert.match(CSS_SOLO_PIE, /footer:not\(\.s-pie\):not\(article footer\)\{display:none!important\}/, 'el pie del sitio vuelve a esconder también el pie de las tarjetas');
  assert.match(leer('app/vsl/_competencia/disenos/copywriting.tsx'), /<\/header>[\s\S]*?<footer><span>/, '¿la comparación de Copywriting ya no lleva su <footer>? Entonces sobra la excepción');
});

test('5. «lo que ya pagas»: sin Opus Clip en el ticket, la cuenta sale sola y dice «Te ahorras», y el ícono de MaKo es fijo', () => {
  assert.ok(!STACK_TIPICO.some((x) => /opus/i.test(x.app.nombre)), 'OpusClip volvió al ticket');
  // Sólo del ticket: sigue en la tira y en la comparación.
  assert.ok(appsDeLaTira().some((a) => a.nombre === 'OpusClip'), 'OpusClip salió también de la tira (Martín sólo lo sacó del ticket)');
  assert.ok(STACK_QUE_REEMPLAZA.some((t) => t.apps.some((a) => a.nombre === 'OpusClip')), 'OpusClip salió de la comparación');
  const h = html(createElement(SeccionReemplaza, { ver: RUTA_COMPARACIONES }));
  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro')!;
  const usd = (n: number) => `US$${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
  const total = Math.round(STACK_TIPICO.reduce((s, x) => s + x.precioUsd, 0) * 100) / 100;
  const ahorro = Math.round((total - pro.precioUsd) * 100) / 100;
  assert.ok(h.includes(`<span class="s-ah-p">${usd(total)}</span>`), `el total no es la suma del ticket (${usd(total)})`);
  // Que se lea que es lo que te AHORRAS, con el número de la cuenta (Martín: «falta justamente la palabra te ahorras»).
  assert.ok(h.includes(`<p class="s-ah-gana-n">Te ahorras <strong>${usd(ahorro)}</strong> por mes</p>`), `sin «Te ahorras ${usd(ahorro)} por mes»`);
  // Los dos íconos de MaKo, fijos para el sol y la luna: negro en el claro, blanco en el oscuro (CSS_BASE). El del ticket no lo era.
  const iconos = [...h.matchAll(/<span class="s-mk-ico s-ah-ico"([^>]*)>/g)].map((m) => m[1]);
  assert.equal(iconos.length, 2);
  for (const a of iconos) assert.match(a, /data-tema-fijo=""/, 'un ícono de MaKo de «lo que pagas» sin data-tema-fijo: en el modo claro sale blanco');
  assert.match(CSS_BASE, /\.s-mk-ico\{background:#1A1712\}\nhtml\[data-sitio-modo="oscuro"\] \.s-mk-ico\{background:#fff\}/);
});

test('6. los logos con su color en los dos modos: ClickFunnels y Skool sobre blanco en el oscuro, y Claude sobre claro', () => {
  // Los dos que se perdían sobre el fondo oscuro (medido el 15/11/2026: el cursor #080436 de ClickFunnels, la «s» #282F97 de Skool).
  // Y ManyChat (16/11/2026): su ícono es un cuadro blanco con la M tocando el borde, y en el oscuro las esquinas le cortaban la M.
  for (const a of ['clickfunnels', 'skool', 'manychat']) assert.ok(LOGOS_SOBRE_BLANCO.includes(a), `${a} dejó de ir sobre blanco en el modo oscuro`);
  for (const a of LOGOS_SOBRE_BLANCO) {
    assert.ok(existsSync(join(RAIZ, 'public/vsl-assets/logos/apps', `${a}.png`)), `${a}.png no existe`);
    assert.ok(CSS_BASE.includes(`[src$="/${a}.png"]`), `${a}: sin su cuadro blanco en el modo oscuro`);
  }
  assert.match(CSS_BASE, /html\[data-sitio-modo="oscuro"\] \.s-sitio img:is\([^)]*\)\{background:#fff/);
  assert.match(CSS_BASE, /html\[data-sitio-modo="claro"\] \.s-sitio img:is\([^)]*\)\{background:none/);
  // Claude: la ráfaga naranja sobre claro, como el ícono de su app (iba sobre un cuadro #181818).
  const bg = ICON.agente.bg;
  const [r, g, b] = (bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i) ?? []).slice(1).map((x) => parseInt(x, 16));
  assert.ok(r + g + b > 3 * 200, `el cuadro de Claude es oscuro (${bg})`);
});

test('7. las columnas de precios de la portada son LAS de /planes: el mismo bloque, letra por letra, con la barra de MaKo Tokens', () => {
  for (const [sufijo, promo] of [['', false], ['?utm_source=fb&ref=abc', true]] as const) {
    const enPortada = bloqueDiv(portada(sufijo, promo), '<div class="mkpl-bloques">');
    const enPlanes = bloqueDiv(html(createElement(VitrinaPlanes, { ofertas: OFERTAS, sufijo, promoVigente: promo })), '<div class="mkpl-bloques">');
    assert.ok(enPlanes.includes('data-tk=""'), '/planes sin la barra de MaKo Tokens: ¿cambió /planes?');
    assert.equal(enPortada, enPlanes, `las columnas de la portada no son las de /planes (sufijo «${sufijo}», promo ${promo}): si cambió una prop en app/planes/Vitrina.tsx, súmala en app/vsl/_sitio/ColumnasPlanes.tsx`);
  }
  // La hoja de las columnas y de su barra, y la letra y el ancho de /planes.
  const h = portada();
  assert.ok(h.includes(CSS_TARJETAS) && h.includes(CSS_TOKENS), 'la portada sin la hoja de las columnas o de la barra');
  const raiz = regla(CSS_PLANES, '.planes-root');
  const fuente = raiz.match(/font:\s*([^;]+)/)?.[1].trim();
  const bloque = regla(CSS_PORTADA, '.s-precios-bloques');
  assert.ok(fuente && bloque.replace(/\s+/g, ' ').includes(`font:${fuente.replace(/\s*,\s*/g, ',')}`), `la letra de las columnas no es la de /planes (${fuente})`);
  const ancho = regla(CSS_PLANES, '.planes-wrap.planes-ancho').match(/max-width:\s*(\d+px)/)?.[1];
  assert.ok(ancho && bloque.includes(`max-width:${ancho}`), `el ancho de las columnas no es el de /planes (${ancho})`);
  assert.match(regla(CSS_PORTADA, '.s-precios .s-cont'), /padding-left:16px;padding-right:16px/, 'los costados no son los 16 px de /planes');
  // La portada nace OSCURA y la barra reescribe con innerHTML el «+N» y lo que alcanza: los <b> nuevos nacen sin el color del sol y la
  // luna (#12151B sobre la columna oscura, medido con Playwright el 16/11/2026). Mientras CalculadoraTokens no lo traiga, va acá.
  const reescritos = /html\[data-sitio-modo="oscuro"\] \.s-precios \.tk-extra b,html\[data-sitio-modo="oscuro"\] \.s-precios \.mkpl-alcanza li:not\(\.mkpl-alcanza-sin\) b\{color:rgb\(228,231,237\)\}/;
  assert.ok(reescritos.test(CSS_PORTADA) || /data-sitio-modo="oscuro"[^{]*\.tk-extra b/.test(CSS_TOKENS), 'lo que la barra reescribe queda negro sobre negro en el modo oscuro de la portada');
});

test('8. los signos de los círculos son dibujos centrados, no letras', () => {
  // En el sitio no queda una ✓, ✕, × o ✗ escrita como letra dentro de un círculo (se centra su caja, no su tinta). Los círculos con
  // signo: los del caso (portada), el tilde de la tabla y de «Elige MaKo si» (Comparaciones) y las flechas de la tabla.
  const CIRCULOS = /<(span|button) class="(s-caso-x|s-caso-ok|s-mx-si|s-tilde-c)"[^>]*>(?:(?!<\/\1>)[\s\S])*?[✓✕×✗✔‹›]/;
  const comparaciones = renderToStaticMarkup(createElement(ComparacionesSitio));
  for (const [que, h] of [['la portada', portada()], ['Comparaciones', comparaciones]] as const) {
    assert.doesNotMatch(h, CIRCULOS, `${que}: un signo escrito como letra dentro de su círculo`);
  }
  // Las flechas de la tabla, dibujadas (eran «‹» y «›» en un círculo de 40).
  const flechas = comparaciones.match(/<span class="s-mx-flechas">([\s\S]*?)<\/span>/)?.[1] ?? '';
  assert.equal((flechas.match(/<svg\b/g) ?? []).length, 2, 'las flechas de la tabla no son dos dibujos');
  assert.doesNotMatch(flechas, /[‹›]\s*<\/button>/, 'una flecha de la tabla es una letra');
  assert.doesNotMatch(leer('app/vsl/_sitio/estilos.ts'), /content:\s*['"][✓✕×✗✔]['"]/, 'un signo como letra en un ::before del sitio');
  // La ✕ y la ✓ del caso: el dibujo de app/planes/signos.ts, de lado par en un círculo par.
  assert.match(CSS_PORTADA, /\.s-caso-x\{[^}]*background:url\("data:image\/svg\+xml[^}]*background-size:12px 12px/);
  assert.match(CSS_PORTADA, /\.s-caso-ok\{[^}]*background:url\("data:image\/svg\+xml[^}]*background-size:14px 14px/);
  // El tilde de la tabla de comparaciones, centrado en su lienzo de 24: la tinta (con su trazo) va de 3 a 21 y de 5,5 a 18,5.
  const d = leer('app/vsl/_sitio/Piezas.tsx').match(/export function Tilde[\s\S]*?<path d="M([\d.]+) ([\d.]+)l([\d.]+) ([\d.]+)l([\d.]+) (-?[\d.]+)"/);
  assert.ok(d, 'el tilde cambió de forma: revisar su centro');
  const [x0, y0, dx1, dy1, dx2, dy2] = d.slice(1).map(Number);
  const xs = [x0, x0 + dx1, x0 + dx1 + dx2], ys = [y0, y0 + dy1, y0 + dy1 + dy2];
  assert.equal((Math.min(...xs) + Math.max(...xs)) / 2, 12, 'el tilde no está centrado a lo ancho');
  assert.equal((Math.min(...ys) + Math.max(...ys)) / 2, 12, 'el tilde no está centrado a lo alto');
});

test('9. la portada: datos estructurados con la razón social, como la portada vieja (Meta)', () => {
  const h = portada();
  const ld = h.indexOf('application/ld+json');
  assert.ok(ld >= 0 && ld < h.indexOf('<main>'), 'sin JSON-LD antes del contenido');
  const datos = JSON.parse(h.slice(h.indexOf('>', ld) + 1, h.indexOf('</script>', ld)));
  assert.equal(datos.legalName, RAZON_SOCIAL_MAKO);
});

test('10. el menú del teléfono se cierra al tocar una sección de la MISMA página (/#preguntas estando en la portada)', () => {
  // Medido con Playwright a 390 (16/11/2026): en la portada, «Recursos → Preguntas frecuentes» bajaba la página DETRÁS del menú, que
  // seguía abierto a pantalla completa (un <details> sólo lo cierra su <summary>): se tocaba y no pasaba nada a la vista.
  const BASE = 'https://hola-mako.com/';
  const link = (href: string) => { const u = new URL(href, BASE); return { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash }; };
  const portadaAqui = { origin: 'https://hola-mako.com', pathname: '/', search: '' };
  for (const href of [RUTA_PREGUNTAS, RUTA_INTEGRACIONES, HISTORIA.href]) {
    assert.equal(esSeccionDeEstaPagina(link(href), portadaAqui), true, `${href} desde la portada: el menú tiene que cerrarse`);
  }
  // Desde otra página, o con otra consulta, es navegar: el menú se va con la página y no hace falta cerrarlo.
  assert.equal(esSeccionDeEstaPagina(link(RUTA_PREGUNTAS), { ...portadaAqui, pathname: '/planes' }), false);
  assert.equal(esSeccionDeEstaPagina(link(RUTA_PREGUNTAS), { ...portadaAqui, search: '?utm_source=fb' }), false);
  for (const href of ['/planes', '/mako-partners', '/#', 'https://chromewebstore.google.com/#x']) {
    assert.equal(esSeccionDeEstaPagina(link(href), portadaAqui), false, href);
  }
  // Y va ADENTRO del menú del teléfono: el <details> que cierra es el que encuentra subiendo desde su marca.
  const h = html(createElement(Barra, { claro: false }));
  assert.match(h, /<details class="s-mv">(?:(?!<\/details>)[\s\S])*?<div class="s-mv-panel"><span hidden="">/, 'el menú del teléfono sin CerrarMenuMovil');
});
