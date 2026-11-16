// =============================================================================
// El sitio, lo que pidió Martín el 16/11/2026: el WhatsApp de MaKo (flotando y en el contacto del pie), el pie más bajo y en TODAS
// las landings, y «lo que ya pagas» con la tira arriba del título
// =============================================================================
// Martín, textual: «me gustaría que esté flotando el loguito de WhatsApp al costado por si alguien quiere escribir algo y que
// evidentemente lleve al WhatsApp de MaKo. También en la bottom bar y en el tema del contacto, que no solamente esté el email, sino
// que también esté el WhatsApp de MaKo… También fíjate que la bottom bar esté en todas las landings nuevamente»; «la bottom bar
// quedó demasiado alta, entonces hay que ver cómo reducir eso»; y «me gustaría que el carrusel de MaKo reemplaza las apps que ya
// estás pagando, esté arriba de el título, lo que probablemente ya pagas de tu negocio».
//
// Se fija lo DIBUJADO (renderToStaticMarkup de las páginas de verdad). Lo que se midió en un navegador (Chromium, la portada dibujada
// con estos componentes, 16/11/2026), y por qué no está acá: el alto del pie, de 697 a 551 px a 1440 y de 1.409 a 727 a 390 (con los
// ocho renglones cerrados; abiertos, ningún link se pisa ni se sale de la pantalla y todos miden 36 px o más).
// PROBADO ROMPIÉNDOLO (16/11/2026; base 6 / 0): al pie.
// Correr: node --import tsx --test tests/sitio-whatsapp-y-pie.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PieGlobal } from '../app/vsl/_sitio/Barra';
import { Pie } from '../app/vsl/_sitio/Pie';
import { PortadaSitio } from '../app/vsl/_sitio/Portada';
import { SeccionReemplaza } from '../app/vsl/_sitio/LoQuePagas';
import { ComparacionesSitio, ComparacionVs } from '../app/vsl/_sitio/Comparaciones';
import { COMPETIDORES } from '../app/vsl/_sitio/competencia';
import { CSS_PIE } from '../app/vsl/_sitio/estilos';
import { LEGALES, columnasDelPie } from '../app/vsl/_sitio/datos';
import { FUNNELS_SITIO } from '../app/vsl/_sitio/funnels-datos';
import { CSS_WHATSAPP_FLOTANTE } from '../app/vsl/_sitio/WhatsappFlotante';
import { MENSAJE_WHATSAPP_SITIO, WHATSAPP_MAKO, linkWhatsappMako } from '../app/vsl/_sitio/contacto';
import LandingCompetencia from '../app/vsl/_competencia/LandingCompetencia';
import { LANDINGS_COMPETENCIA } from '../app/vsl/_competencia/registro';
import FeatureDetail from '../app/vsl/_detalle/FeatureDetail';
import AceleradorPage from '../app/accelerator/page';
import FunnelPage from '../app/vsl/funnels/[funnel]/page';
import { Ficha } from '../app/planes/[plan]/Checkout';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { EMAIL_MAKO } from '../lib/app-url';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const html = (el: ReactElement) => renderToStaticMarkup(el);
const sinHojas = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, '');
const cuantas = (h: string, s: string) => sinHojas(h).split(s).length - 1;
const ACTIVOS = PLANES_MAKO_DEFAULT.filter((p) => p.activo);
const PLANES = ACTIVOS.map((p) => ({ id: p.id, nombre: p.nombre, capa: p.capa, precioUsd: p.precioUsd, resumen: p.resumen, incluye: p.incluye, destacado: !!p.destacado, precioAnualUsd: p.precioAnualUsd ?? null, preciosLocales: p.preciosLocales, cobrable: true }));
const LINK = linkWhatsappMako().replace(/&/g, '&amp;');

test('1. el WhatsApp de MaKo vive en UN lugar, y es la línea de MaKo (…2605), nunca el personal de Martín', () => {
  assert.deepEqual(WHATSAPP_MAKO, { numero: '5491125052605', visible: '+54 9 11 2505-2605' });
  assert.equal(linkWhatsappMako(), `https://wa.me/5491125052605?text=${encodeURIComponent(MENSAJE_WHATSAPP_SITIO)}`);
  // Nadie más en el sitio escribe el número: el pie, el botón y el contacto lo leen de ./contacto.ts.
  const fuentes = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'app/vsl', 'app/planes', 'app/accelerator'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'app/vsl/_sitio/contacto.ts');
  for (const f of fuentes) {
    const s = leer(f);
    assert.doesNotMatch(s, /5491125052605|2505[- ]?2605/, `${f} escribe el WhatsApp de MaKo a mano: va por app/vsl/_sitio/contacto.ts`);
    assert.doesNotMatch(s, /3764\s?67-?3479|5493764673479/, `${f}: el WhatsApp PERSONAL de Martín no va en el sitio`);
  }
});

test('2. el pie: el contacto con el email Y el WhatsApp, a la vista; y las mismas columnas en la computadora y en el teléfono', () => {
  for (const claro of [false, true]) {
    const h = html(createElement(Pie, { claro }));
    const contacto = /<ul class="s-pie-contacto" aria-label="Contacto">([\s\S]*?)<\/ul>/.exec(h)?.[1] ?? '';
    assert.ok(contacto.includes(`href="mailto:${EMAIL_MAKO}"`), 'el contacto sin el email');
    assert.ok(contacto.includes(`href="${LINK}" target="_blank" rel="noopener noreferrer"`), 'el contacto sin el WhatsApp de MaKo');
    assert.ok(contacto.includes(WHATSAPP_MAKO.visible), 'el número no se lee');
    // El email se mudó al contacto: no queda repetido al final de Legal.
    assert.deepEqual(columnasDelPie().find((c) => c.titulo === 'Legal')!.links, [...LEGALES]);
    // NADA SE PERDIÓ: el teléfono (renglones que se despliegan) tiene los mismos links que la computadora, en el mismo orden.
    const cols = /<div class="s-pie-cols">([\s\S]*?)<div class="s-pie-pliegues">/.exec(h)?.[1] ?? '';
    const pliegues = /<div class="s-pie-pliegues">([\s\S]*?)<div class="s-pie-base">/.exec(h)?.[1] ?? '';
    // El contacto (el email y el WhatsApp) va debajo de Legal y, en el teléfono, aparte: no son links de las columnas.
    const hrefs = (s: string) => [...s.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('mailto:') && !u.startsWith('https://wa.me/'));
    const todos = columnasDelPie().flatMap((c) => [...c.links, ...(c.sub?.links ?? [])].map((l) => l.href.replace(/&/g, '&amp;')));
    assert.deepEqual(hrefs(cols), todos, 'las columnas de la computadora no son las del pie');
    assert.deepEqual(hrefs(pliegues), todos, 'los renglones del teléfono perdieron (o cambiaron) links');
    assert.equal((pliegues.match(/<details class="s-pie-pliegue"><summary>/g) ?? []).length, columnasDelPie().length);
    // En la computadora, el segundo rótulo de una columna (los Funnels) va en SU columna: era la más alta y le daba el alto al pie.
    const columnasPc = (cols.match(/<div class="s-pie-col">/g) ?? []).length;
    assert.equal(columnasPc, columnasDelPie().length + columnasDelPie().filter((c) => c.sub).length, 'los Funnels volvieron abajo de Industrias');
    assert.ok(!cols.includes('s-pie-h2'), 'en la computadora quedó un segundo rótulo adentro de una columna');
  }
  // La hoja: los renglones sólo en el teléfono, las columnas sólo en la computadora, y el pie más bajo.
  assert.match(CSS_PIE, /\.s-pie-pliegues\{display:none\}/);
  const telefono = CSS_PIE.slice(CSS_PIE.indexOf('@media (max-width:767px){'));
  assert.match(telefono, /\.s-pie-cols\{display:none\}/);
  assert.match(telefono, /\.s-pie-pliegues\{display:block;/);
  // Más bajo otra vez (16/11, a la tarde: «sigo viendo la bottom bar muy alta»): 36 arriba y 24 abajo, los links cada 24 px.
  assert.match(CSS_PIE, /\.s-pie\{background:[^;]+;border-top:[^;]+;padding:30px 0 20px\}/, 'volvió el aire de antes arriba y abajo');
  assert.match(CSS_PIE, /\.s-pie-col li\{font-size:13px;line-height:18px;font-weight:500;padding-bottom:4px\}/, 'los links volvieron a ir más separados');
  // Sin el lema arriba (Martín, 16/11/2026, ~17:50 UTC: «podríamos eliminar el mejor software para ventas high ticket… y que el logo
  // de MaKo esté abajo a la derecha, en donde hoy está la estrellita… y equipo y WhatsApp en ese espacio en blanco al lado de legal»).
  const pie = html(createElement(Pie, {}));
  assert.ok(!pie.includes('s-pie-marca') && !pie.includes('El mejor software para vender High Ticket'), 'volvió el lema arriba del pie');
  assert.match(pie, /<div class="s-pie-base"><p class="s-pie-c">[^<]*<\/p><a href="\/" class="s-pie-logo" aria-label="MaKo — volver a la landing"/, 'el logo no está abajo a la derecha, en el renglón del ©');
  assert.match(pie, /<p class="s-pie-h s-pie-h-contacto">Contacto<\/p><ul class="s-pie-contacto" aria-label="Contacto">/, 'el contacto no está debajo de Legal');
});

test('3. el WhatsApp flotante: uno por página que lleva el pie, al chat de MaKo con el mensaje escrito, y ninguno en el checkout', async () => {
  const portada = html(createElement(PortadaSitio, { planes: PLANES }));
  const paginas: Array<[string, string]> = [
    ['la portada', portada],
    ['/planes (PieGlobal)', html(createElement(PieGlobal, { claro: true }))],
    ['Comparaciones', html(createElement(ComparacionesSitio))],
    ['MaKo vs.', html(createElement(ComparacionVs, { c: COMPETIDORES[0] }))],
    // La página del programa lee la campaña de la URL (`searchParams`): se dibuja con una vacía.
    ['/accelerator', html(await AceleradorPage({ searchParams: Promise.resolve({}) }))],
  ];
  for (const [que, h] of paginas) {
    assert.equal(cuantas(h, 'class="mk-wa-flota"'), 1, `${que}: el botón flotante no está una vez`);
    assert.ok(sinHojas(h).includes(`<a class="mk-wa-flota" href="${LINK}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp"`), `${que}: el botón no lleva al chat de MaKo`);
  }
  // El checkout va sin barra ni pie («que no haya scroll», Martín 14/11): tampoco lleva el botón.
  const ficha = html(createElement(Ficha, { resumen: { etiqueta: 'x', nombre: 'x', precio: 'x', incluye: [] }, children: 'formulario' }));
  assert.equal(cuantas(ficha, 'mk-wa-flota'), 0, 'el checkout lleva el botón flotante');
});

test('4. el botón no tapa lo que va pegado abajo: cada regla nombra una clase que SE DIBUJA en su página', async () => {
  // Si una landing cambia el nombre de su barra pegada, la regla queda muerta y el botón vuelve a taparla: esto lo pesca. Se mira lo
  // DIBUJADO y no el fuente: la hoja de Seguimiento se escribe `.s-fija` y sale `.d-seguimiento-fija` (le cambia el prefijo), y una
  // regla sobre `.s-fija` pasaba un test sobre el fuente sin esquivar nada (medido con Chromium a 390: tapaba «PRUÉBALO GRATIS AHORA»).
  const landing = (slug: string) => html(createElement(LandingCompetencia, { landing: LANDINGS_COMPETENCIA.find((l) => l.slug === slug)! }));
  const acelerador = html(await AceleradorPage({ searchParams: Promise.resolve({}) }));
  const DE: Array<[RegExp, string, string, RegExp]> = [
    [/body:has\(\.acl-pegado\)/, '/accelerator', acelerador, /class="acl-pegado"[\s\S]*\.acl-pegado \{ display: block; position: sticky; bottom: 0;|\.acl-pegado \{ display: block; position: sticky; bottom: 0;[\s\S]*class="acl-pegado"/],
    [/body:has\(\.d-seguimiento-fija\.d-seguimiento-fija-vis\)/, 'la landing de Seguimiento', landing('seguimiento'), /\.d-seguimiento-fija\.d-seguimiento-fija-vis\{[\s\S]*class="d-seguimiento-fija"/],
    [/body:has\(\.d-video-fijo\.d-video-ver\)/, 'la landing de Video', landing('video'), /\.d-video-fijo\.d-video-ver \{[\s\S]*class="d-video-fijo"/],
    [/body:has\(\.d-funnel-float\.is-on\)/, 'la landing de Funnel', landing('funnel'), /\.d-funnel-float\.is-on\{[\s\S]*class="d-funnel-float"/],
    [/body:has\(\.d-offer-video\.d-offer-flota\)/, 'la landing de Offer', landing('offer'), /\.d-offer-video\.d-offer-flota video \{ position: fixed;[\s\S]*class="d-offer-video"/],
  ];
  for (const [regla, que, h, existe] of DE) {
    assert.match(CSS_WHATSAPP_FLOTANTE, regla, `falta la regla ${regla}`);
    assert.match(h, existe, `${que} ya no dibuja lo que la regla ${regla} esquiva`);
  }
  // Las capas de /accelerator. En la computadora, DEBAJO de la barra. Hasta 880 px, ARRIBA de lo que tapa la barra (el precio y la
  // sección final, 91): con 80 desaparecía detrás de ellos (revisión del 16/11, hallazgo 3: en 19 de 216 posiciones a 390 px).
  const zBarra = Number(/\.acl-pegado \{ display: block; position: sticky; bottom: 0; z-index: (\d+);/.exec(acelerador)?.[1]);
  const zBoton = Number(/body:has\(\.acl-pegado\) \.mk-wa-flota\{z-index:(\d+)\}/.exec(CSS_WHATSAPP_FLOTANTE)?.[1]);
  assert.ok(zBarra > 0 && zBoton > 0 && zBoton < zBarra, `en la computadora el botón (z-index ${zBoton}) queda arriba de la barra (${zBarra})`);
  const zTelefono = Number(/@media \(max-width:880px\)\{body:has\(\.acl-pegado\) \.mk-wa-flota\{z-index:(\d+)\}\}/.exec(CSS_WHATSAPP_FLOTANTE)?.[1]);
  // Todo lo que esa hoja levanta para tapar la barra (`position: relative` con su z-index: hoy la sección final y la de la inversión).
  const tapan = [...leer('app/accelerator/estilo.ts').matchAll(/\{ position: relative; z-index: (\d+);/g)].map((m) => Number(m[1]));
  assert.ok(tapan.length >= 1, '¿cambiaron las capas de /accelerator? Este test ya no encuentra lo que tapa la barra');
  assert.ok(zTelefono > Math.max(...tapan), `hasta 880 px el botón (z-index ${zTelefono}) desaparece detrás de lo que tapa la barra (${tapan.join(', ')})`);
  // La voz: en /accelerator habla Martín («Escríbeme», con su mensaje); en el resto, MaKo. La hoja deja ver uno.
  assert.ok(sinHojas(acelerador).includes('<a class="mk-wa-flota mk-wa-martin" href="https://wa.me/'), 'en /accelerator no está el botón en la voz de Martín');
  assert.match(acelerador, /aria-label="Escríbeme por WhatsApp"/);
  assert.match(CSS_WHATSAPP_FLOTANTE, /body:has\(\.acl-root\) \.mk-wa-flota:not\(\.mk-wa-martin\)\{display:none\}/);
  assert.match(CSS_WHATSAPP_FLOTANTE, /body:has\(\.acl-root\) \.mk-wa-flota\.mk-wa-martin\{display:flex\}/);
  assert.match(CSS_WHATSAPP_FLOTANTE, /(?:^|\n)\.mk-wa-flota\.mk-wa-martin\{display:none\}/, 'el de Martín se ve en todas las páginas');
  assert.match(acelerador, /class="acl-root"/, '¿cambió la clase de la página del programa? La voz de Martín no se enciende');
  // El sol y la luna cuando flota (una página sin barra) y el menú del teléfono: se dibujan desde su componente.
  assert.match(CSS_WHATSAPP_FLOTANTE, /body:has\(\.mk-tema-sitio-flota\)/);
  assert.match(leer('app/vsl/_competencia/TemaSitio.tsx'), /\.mk-tema-sitio-flota \{ position: fixed;/);
  assert.match(CSS_WHATSAPP_FLOTANTE, /body:has\(details\.s-mv\[open\]\) \.mk-wa-flota\{display:none\}/);
  assert.match(html(createElement(PortadaSitio, { planes: PLANES })), /<details class="s-mv">/);
  // Y en el teléfono, la base del pie le deja su lugar (al final de la página tapaba la estrella).
  assert.match(CSS_PIE.slice(CSS_PIE.indexOf('@media (max-width:767px){')), /\.s-pie-base\{order:4;padding-top:16px;padding-right:60px\}/);
});

test('5. el pie (y el botón) en TODAS las landings, DIBUJADAS: las 19 nuevas, las viejas, los funnels y las comparaciones', async () => {
  const una = (que: string, h: string) => {
    assert.equal(cuantas(h, '<footer class="s-pie">'), 1, `${que}: el pie del sitio no está una vez`);
    assert.equal(cuantas(h, 'class="mk-wa-flota"'), 1, `${que}: el WhatsApp flotante no está una vez`);
  };
  for (const l of LANDINGS_COMPETENCIA) una(`la landing ${l.slug}`, html(createElement(LandingCompetencia, { landing: l })));
  // Las viejas: cada slug que una página de app/vsl le pasa a FeatureDetail.
  const viejas = new Set<string>();
  for (const f of execFileSync('git', ['ls-files', 'app/vsl'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((x) => /page\.tsx$/.test(x))) {
    for (const m of leer(f).matchAll(/<FeatureDetail slug="([a-z-]+)"/g)) viejas.add(m[1]);
  }
  assert.ok(viejas.size >= 10, `encontré ${viejas.size} landings viejas: ¿cambió cómo se montan?`);
  for (const s of viejas) una(`la landing vieja ${s}`, html(createElement(FeatureDetail, { slug: s })));
  for (const f of FUNNELS_SITIO) una(`el funnel ${f.id}`, html(await FunnelPage({ params: Promise.resolve({ funnel: f.id }) })));
});

test('6. «lo que ya pagas»: la tira de las apps que MaKo reemplaza va ARRIBA del titular, en la portada y en Comparaciones', () => {
  for (const [que, props] of [['la portada', { ver: '/vsl/comparaciones' }], ['Comparaciones', { claro: true, principal: true }]] as const) {
    const h = html(createElement(SeccionReemplaza, props));
    const rotulo = h.indexOf('<p class="s-tira-r">MaKo reemplaza las apps que ya estás pagando</p>');
    const tira = h.indexOf('<div class="s-tira-v">');
    const titular = h.search(/<h[12] class="s-ah-h" id="lo-que-pagas">Lo que probablemente ya pagas en tu negocio<\/h[12]>/);
    const ticket = h.indexOf('<div class="s-ah-afuera">');
    assert.ok(rotulo >= 0 && tira > rotulo && titular > tira && ticket > titular, `${que}: el orden no es rótulo → tira → titular → ticket (${rotulo}, ${tira}, ${titular}, ${ticket})`);
  }
});

// ── Probado rompiéndolo (16/11/2026) ───────────────────────────────────────────────────────────────────────────────────
// Base: 6 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · el pie escribe el número a mano («+54 9 11 2505-2605»)          -> 5 / 1 (el 1)
//   · el contacto sin el WhatsApp                                     -> 5 / 1 (el 2)
//   · los renglones del teléfono pierden la primera columna           -> 5 / 1 (el 2)
//   · el pie vuelve a 64 de aire arriba y abajo                       -> 5 / 1 (el 2)
//   · el pie sin el botón flotante                                    -> 4 / 2 (el 3 y el 5)
//   · el botón deja de esquivar la barra del teléfono de /accelerator -> 5 / 1 (el 4)
//   · el botón queda ARRIBA de esa barra (sin su z-index de 80)       -> 5 / 1 (el 4)
//   · la regla de Seguimiento vuelve a la clase del fuente (.s-fija)  -> 5 / 1 (el 4)
//   · el titular vuelve arriba de la tira                             -> 5 / 1 (el 6)
// 16/11/2026, la segunda tanda (base 6 / 0; restaurado, 6 / 0):
//   · hasta 880 px el botón vuelve a z-index 80                 -> 5 / 1
//   · el botón de Martín se ve en todas las páginas             -> 5 / 1

// Martín, 16/11/2026: «el botón de WhatsApp está bien, pero también debería saltar como un mensajito tipo de chatea por WhatsApp
// o algo así, o haz una pregunta».
test('7. el globito del WhatsApp: a la vista desde que entra, con una X que lo cierra; cerrado, sólo al pasar el mouse', () => {
  // Martín, 16/11/2026, ~17:50 UTC: «¿tienes una pregunta? Escríbenos, pero no solamente cuando le paso el cursor, sino que esté
  // directamente ahí eso y que se pueda cerrar con una X arriba, y ahí después si le paso el cursor ahí aparezca».
  const portada = html(createElement(PortadaSitio, { planes: PLANES }));
  assert.ok(sinHojas(portada).includes('<span class="mk-wa-globo" aria-hidden="true"><span class="mk-wa-globo-x" data-wa-cerrar="" title="Cerrar">×</span>¿Tienes una pregunta? <b>Escríbenos</b></span></a>'), 'el botón de MaKo sin su globito con la X');
  assert.ok(sinHojas(portada).includes('<span class="mk-wa-globo" aria-hidden="true"><span class="mk-wa-globo-x" data-wa-cerrar="" title="Cerrar">×</span>¿Tienes una pregunta? <b>Escríbeme</b></span></a>'), 'el botón de Martín sin su globito con la X');
  assert.match(CSS_WHATSAPP_FLOTANTE, /\.mk-wa-globo\{position:absolute;[^}]*opacity:1;[^}]*animation:mk-wa-globo-entra \.4s 1s both\}/, 'el globito no queda a la vista');
  assert.match(CSS_WHATSAPP_FLOTANTE, /html\.mk-wa-cerrado \.mk-wa-globo\{opacity:0;pointer-events:none;animation:none\}/);
  assert.match(CSS_WHATSAPP_FLOTANTE, /html\.mk-wa-cerrado \.mk-wa-flota:hover \.mk-wa-globo,html\.mk-wa-cerrado \.mk-wa-flota:focus-visible \.mk-wa-globo\{opacity:1\}/, 'cerrado, no vuelve al pasar el mouse');
  assert.ok(portada.includes("localStorage.setItem(K,'cerrado')") && portada.includes('e.preventDefault()'), 'la X no cierra (o abre el WhatsApp)');
  assert.match(CSS_WHATSAPP_FLOTANTE, /@media \(prefers-reduced-motion:reduce\)\{\.mk-wa-flota\{transition:none\}\.mk-wa-globo\{animation:none\}\}/);
});
