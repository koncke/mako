// =============================================================================
// La API lee y cambia los textos de un «Diseño editable» (las páginas de MaKo), sin tocar el diseño (25/10/2026)
// =============================================================================
// Martín (25/10): «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API». Ese día se
// arregló que en la PANTALLA se pudiera escribir en las secciones de las landings de MaKo («no puedo ni cambiar un
// título»). Por la API pasaba lo mismo, medido sobre la #32 (la principal de MaKo): ver_landing_creada devolvía 0
// secciones con texto y cambiar_texto_landing contestaba «No encontré…». El texto de un «Diseño editable» vive en el
// HTML de un atributo, no en hijos, y ni `textoVisible` (diagnostico.ts) ni `planCambiarTexto` lo miraban.
//
// Lo que fija:
//   1. LEER: las secciones de diseño salen con su texto (sin el de un <style>), y las entidades decodificadas;
//   2. CAMBIAR: la frase se cambia y el ESQUELETO del HTML (etiquetas, clases, estilos) queda igual byte por byte;
//      una sección que no se toca vuelve idéntica;
//   3. lo que ya valía para el resto: una frase que cruza un formato distinto se avisa, más de una aparición pide
//      `seccion` o `todas`, y lo que se escribe se escapa (un texto nunca abre una etiqueta).
// Correr: node --import tsx --test tests/api-mako-landing-diseno-editable.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { planCambiarTexto } from '../lib/api-mako/areas/landing-contenido.helpers';
import { paginasEnTexto } from '../lib/api-mako/areas/landing-editor.helpers';

const HERO = '<section class="hero"><p class="badge">Solo 5 cupos</p><h1 class="t">El mejor software para vender <span class="hl">High Ticket</span> con VSL</h1><p>Del primer clic al cliente &amp; más.</p><style>.t{color:red}</style></section>';
const PARA = '<section class="para"><h2 style="margin:0">¿Para quién es esto?</h2><p>Solo 5 cupos</p></section>';

const seccion = (id: string, html: string): JsonNodo => ({ type: NODO.tarjeta, attrs: { id }, content: [{ type: NODO.htmlEditable, attrs: { id: `e-${id}`, html } }] });
const contenido = (): LandingContenido => ({ v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [seccion('tHero', HERO), seccion('tPara', PARA)] } }] } as LandingContenido);
const htmlDe = (c: LandingContenido, i: number): string => String(c.paginas[0].doc.content![i].content![0].attrs!.html);
/** El HTML sin sus textos: lo que no se puede mover al cambiar una frase. */
const esqueleto = (html: string) => html.replace(/>[^<]*</g, '><');

type Plan = ReturnType<typeof planCambiarTexto>;
const ok = (r: Plan) => { if ('error' in r) assert.fail(`falló: ${r.error}`); return r; };
const falla = (r: Plan) => { assert.ok('error' in r, 'tenía que fallar'); return r as Extract<Plan, { error: string }>; };

test('leer: las secciones de diseño salen con su texto (ver_landing_creada)', () => {
  const [hero, para] = paginasEnTexto(contenido()).paginas[0].secciones;
  assert.equal(hero?.id, 'tHero');
  assert.match(hero.texto ?? '', /El mejor software para vender High Ticket con VSL/);
  assert.match(hero.texto ?? '', /Del primer clic al cliente & más\./, 'las entidades, decodificadas');
  assert.doesNotMatch(hero.texto ?? '', /color:red/, 'lo de un <style> no es texto');
  assert.match(para?.texto ?? '', /¿Para quién es esto\?/);
});

test('cambiar: la frase cambia y el diseño queda igual, byte por byte', () => {
  const c = contenido();
  const r = ok(planCambiarTexto(c, { buscar: 'El mejor software para vender', reemplazar: 'El software para vender' }));
  const nuevo = htmlDe(r.contenido, 0);
  assert.ok(nuevo.includes('<h1 class="t">El software para vender <span class="hl">High Ticket</span> con VSL</h1>'), nuevo);
  assert.equal(esqueleto(nuevo), esqueleto(HERO), 'se movió una etiqueta, una clase o un estilo');
  assert.ok(nuevo.includes('<style>.t{color:red}</style>') && nuevo.includes('cliente &amp; más.'), 'lo que no se cambió quedó como estaba');
  assert.equal(htmlDe(r.contenido, 1), PARA, 'la otra sección vuelve idéntica');
  assert.deepEqual(r.datos?.secciones, ['tHero']);
  // Una frase con entidades se busca como la lee el visitante.
  assert.ok(htmlDe(ok(planCambiarTexto(c, { buscar: 'cliente & más', reemplazar: 'cliente que paga' })).contenido, 0).includes('<p>Del primer clic al cliente que paga.</p>'));
});

test('cambiar: lo que ya valía para el resto de los bloques vale para el diseño', () => {
  const c = contenido();
  // Cruza un formato distinto (el <span>): se dice, no se adivina.
  assert.match(falla(planCambiarTexto(c, { buscar: 'vender High Ticket', reemplazar: 'x' })).error, /formatos distintos/);
  // Dos apariciones: pide la sección o todas.
  assert.match(falla(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos' })).error, /aparece 2 veces/);
  const todas = ok(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos', todas: true })).contenido;
  assert.ok(htmlDe(todas, 0).includes('>Cupos<') && htmlDe(todas, 1).includes('>Cupos<'));
  const una = ok(planCambiarTexto(c, { buscar: 'Solo 5 cupos', reemplazar: 'Cupos', seccion: 'tPara' })).contenido;
  assert.equal(htmlDe(una, 0), HERO);
  assert.ok(htmlDe(una, 1).includes('<p>Cupos</p>'));
  // Lo que se escribe se escapa: un texto nunca abre una etiqueta.
  const esc = htmlDe(ok(planCambiarTexto(c, { buscar: '¿Para quién es esto?', reemplazar: '<b>Para ti</b> & tu equipo' })).contenido, 1);
  assert.ok(esc.includes('<h2 style="margin:0">&lt;b&gt;Para ti&lt;/b&gt; &amp; tu equipo</h2>'), esc);
  assert.doesNotMatch(esc, /<b>/);
  // Lo que no está, no está.
  assert.match(falla(planCambiarTexto(c, { buscar: 'no existe', reemplazar: 'x' })).error, /No encontré/);
});

// ── Los botones, las imágenes y los videos de un diseño, por la API (25/10/2026) ───────────────────────────────────────
// Martín: «quiero que TODO sea editable, cada botón, cada video, cada cosa» y «todo MaKo se debe poder utilizar por API».
const BUCKET = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/';
const VSL = '<section class="vsl"><a class="btn" href="#beta">Agenda tu llamada</a><iframe src="https://player-vz-1.tv.pandavideo.com/embed/?v=abc"></iframe>'
  + '<img src="https://hola-mako.com/vsl-assets/caso-martin.jpg" alt="Martín"><img src="https://hola-mako.com/vsl-assets/caso-equipo.jpg">'
  + '<video controls><source src="https://hola-mako.com/vsl-assets/testi.mp4"></video><a class="btn" href="#beta">Agenda tu llamada</a></section>';
const conVsl = (): LandingContenido => ({ v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [seccion('tHero', HERO), seccion('tVsl', VSL)] } }] } as LandingContenido);

test('configurar_boton_landing: un botón de diseño por su texto; varios iguales, con todos o la sección', async () => {
  const { planConfigurarBoton } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const c = conVsl();
  // Dos «Agenda tu llamada»: pide la sección o todos.
  assert.match(falla(planConfigurarBoton(c, { boton: 'Agenda tu llamada', destino: 'https://wa.me/549110000' }) as Plan).error, /Hay 2 botones/);
  const todos = ok(planConfigurarBoton(c, { boton: 'agenda tu llamada', destino: 'https://wa.me/549110000', nuevaPestana: true, todos: true }) as Plan);
  const html = htmlDe(todos.contenido, 1);
  assert.equal((html.match(/href="https:\/\/wa\.me\/549110000" target="_blank" rel="noopener noreferrer"/g) ?? []).length, 2);
  assert.equal(esqueleto(html).replace(/<a [^>]*>/g, '<a>'), esqueleto(VSL).replace(/<a [^>]*>/g, '<a>'), 'el resto del diseño, igual');
  // Un ancla del diseño (#beta) también es un destino; un cobro, no; el estilo es parte del diseño.
  assert.equal(typeof ok(planConfigurarBoton(c, { boton: 'Agenda tu llamada', destino: '#otra', todos: true }) as Plan).contenido, 'object');
  assert.match(falla(planConfigurarBoton(c, { boton: 'Agenda tu llamada', destino: 'pago:3', todos: true }) as Plan).error, /no cobra/);
  assert.match(falla(planConfigurarBoton(c, { boton: 'Agenda tu llamada', estilo: 'primario', todos: true }) as Plan).error, /parte del diseño/);
  // El texto, con la sección.
  const uno = ok(planConfigurarBoton(c, { boton: 'Agenda tu llamada', texto: 'Habla con nosotros', todos: true }) as Plan);
  assert.equal((htmlDe(uno.contenido, 1).match(/>Habla con nosotros</g) ?? []).length, 2);
  // Un botón que no existe dice cuáles hay, también los de los diseños.
  const no = falla(planConfigurarBoton(c, { boton: 'No existe', destino: '#x' }) as Plan) as { disponibles?: string[] };
  assert.ok(no.disponibles?.includes('Agenda tu llamada'), JSON.stringify(no));
});

test('poner_enlace_landing: el reproductor del diseño con otro enlace, y su video de archivo con otro archivo', async () => {
  const { planPonerEnlace } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const c = conVsl();
  const yt = ok(planPonerEnlace(c, { enlace: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }) as Plan);
  assert.match(htmlDe(yt.contenido, 1), /<iframe src="https:\/\/www\.youtube(-nocookie)?\.com\/embed\/dQw4w9WgXcQ[^"]*"><\/iframe>/);
  const mp4 = ok(planPonerEnlace(c, { enlace: 'https://cdn.x.com/nuevo.mp4' }) as Plan);
  assert.match(htmlDe(mp4.contenido, 1), /<video controls src="https:\/\/cdn\.x\.com\/nuevo\.mp4"><\/video>/);
  assert.match(falla(planPonerEnlace(c, { enlace: 'https://ejemplo.com/pagina' }) as Plan).error, /no es de un sitio/);
});

test('cambiar_imagen_landing: una imagen por un pedazo de su dirección o su alt, con la copia a la biblioteca al confirmar', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';
  const { planCambiarImagen } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const c = conVsl();
  const nueva = `${BUCKET}9/nueva.jpg`;
  const r = ok(planCambiarImagen(c, { actual: 'caso-martin.jpg', imagen: nueva }) as Plan);
  assert.match(htmlDe(r.contenido, 1), new RegExp(`<img src="${nueva.replace(/[./]/g, '\$&')}" alt="Martín">`));
  assert.ok(htmlDe(r.contenido, 1).includes('caso-equipo.jpg'), 'la otra, igual');
  assert.equal(typeof ok(planCambiarImagen(c, { actual: 'Martín', imagen: nueva }) as Plan).contenido, 'object', 'por su alt');
  // De afuera: preparar no la copia todavía, y dice que se copia al confirmar.
  assert.match(ok(planCambiarImagen(c, { actual: 'caso-martin', imagen: 'https://unsplash.com/x.jpg' }, { imagenPendiente: true }) as Plan).resumen, /se copia a la biblioteca/);
  assert.match(falla(planCambiarImagen(c, { actual: 'caso-martin', imagen: 'https://unsplash.com/x.jpg' }) as Plan).error, /biblioteca/);
  assert.match(falla(planCambiarImagen(c, { actual: 'vsl-assets', imagen: nueva }) as Plan).error, /Hay 2 imágenes/);
  assert.match(falla(planCambiarImagen(c, { actual: 'no-esta.png', imagen: nueva }) as Plan).error, /No encontré/);
});

test('ver_secciones_landing: un diseño trae sus botones, imágenes y videos', async () => {
  const { estructuraParaApi } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const e = estructuraParaApi(7, conVsl()) as { paginas: Array<{ secciones: Array<{ bloques: Array<{ tipo: string; elementos?: { botones: unknown[]; imagenes: unknown[]; videos: unknown[] } }> }> }> };
  const b = e.paginas[0].secciones[1].bloques[0];
  assert.equal(b.tipo, 'diseño editable');
  assert.deepEqual(b.elementos?.botones, [{ texto: 'Agenda tu llamada', destino: '#beta' }, { texto: 'Agenda tu llamada', destino: '#beta' }]);
  assert.equal(b.elementos?.imagenes.length, 2);
  assert.deepEqual(b.elementos?.videos, [{ video: 'https://player-vz-1.tv.pandavideo.com/embed/?v=abc', tipo: 'reproductor' }, { video: 'https://hola-mako.com/vsl-assets/testi.mp4', tipo: 'archivo' }]);
});

test('configurar_seccion_landing: el fondo de una sección de diseño, en su HTML; lo demás del estilo se dice que no aplica', async () => {
  // Martín (25/10): «tampoco puedo editar el color del bg de cada sección». El estilo de la sección (attrs de la tarjeta)
  // no llega a lo publicado de una sección de diseño: el fondo va al HTML (lib/editor-landing/fondo-de-diseno.ts).
  const { planConfigurarSeccion, estructuraParaApi } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const css = '.para { background: #F5F7FA; }';
  const c = contenido();
  const r = ok(planConfigurarSeccion(c, { seccion: 'tPara', color: '#112233' }, { css }) as Plan);
  assert.equal(htmlDe(r.contenido, 1), '<div data-gm-fondo="#112233" data-gm-envoltura="" style="background:#112233;display:flow-root">'
    + PARA.replace('<section class="para">', '<section class="para" style="background:transparent !important" data-gm-fondo="transparent">') + '</div>');
  assert.match(r.resumen, /#F5F7FA → #112233/);
  assert.deepEqual(r.contenido.paginas[0].doc.content![1].attrs, { id: 'tPara' }, 'la tarjeta no se toca: lo publicado es el HTML');
  // Leer: el fondo que se ve, y que lo cambió MaKo.
  const e = estructuraParaApi(7, r.contenido, null, css) as { paginas: Array<{ secciones: Array<{ fondo?: string | null; fondo_cambiado?: boolean }> }> };
  assert.equal(e.paginas[0].secciones[1].fondo, '#112233');
  assert.equal(e.paginas[0].secciones[1].fondo_cambiado, true);
  assert.equal((estructuraParaApi(7, c, null, css) as typeof e).paginas[0].secciones[1].fondo, '#F5F7FA');
  // Un degradado, y «tema» o restablecer vuelven EXACTO al del diseño.
  assert.match(htmlDe(ok(planConfigurarSeccion(r.contenido, { seccion: 'tPara', degradado: 'noche' }, { css }) as Plan).contenido, 1), /data-gm-fondo="linear-gradient\(160deg/);
  assert.equal(htmlDe(ok(planConfigurarSeccion(r.contenido, { seccion: 'tPara', fondo: 'tema' }, { css }) as Plan).contenido, 1), PARA);
  assert.equal(htmlDe(ok(planConfigurarSeccion(r.contenido, { seccion: 'tPara', restablecer: true }, { css }) as Plan).contenido, 1), PARA);
  assert.equal((falla(planConfigurarSeccion(c, { seccion: 'tPara', fondo: 'tema' }, { css }) as Plan) as { yaEstaba?: boolean }).yaEstaba, true);
  // Lo que no llega a lo publicado se dice, no se guarda en vano.
  assert.match(falla(planConfigurarSeccion(c, { seccion: 'tPara', ancho: 'amplio', color: '#112233' }, { css }) as Plan).error, /sólo se cambia el fondo; ancho/);
  assert.match(falla(planConfigurarSeccion(c, { seccion: 'tPara', fondo: 'acento' }, { css }) as Plan).error, /acento/);
  assert.match(falla(planConfigurarSeccion(c, { seccion: 'tPara', color: 'rojo' }, { css }) as Plan).error, /#rrggbb/);
});

test('cambiar_icono_landing y ver_secciones_landing: los íconos de un diseño y los de un «Diseño optimizado», por número o por el texto junto', async () => {
  // Martín (25/10): «Los íconos también por la API». En la #32 hay 75 `<svg>` (de otra familia: sin nombre) y ninguno se
  // leía ni se cambiaba por la API.
  const { planCambiarIcono, estructuraParaApi, iconosDeBibliotecaParaApi } = await import('../lib/api-mako/areas/landing-contenido.helpers');
  const svg = (color: string) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:${color}"><path d="M20 6 9 17l-5-5"/></svg>`;
  const DISENO = `<section><div>${svg('#1E9E57')}<h3>Trato preferencial</h3></div><div>${svg('#2F6FED')}<h3>Precio de fundador</h3></div></section>`;
  const item = (icono: string | null, texto: string): JsonNodo => ({ type: NODO.optimizadoItem, attrs: { icono }, content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] });
  const optimizado = (mostrarIconos: boolean, variante: string): JsonNodo => ({ type: NODO.optimizado, attrs: { variante, mostrarIconos }, content: [item('check', 'Rápido'), item(null, 'Barato')] });
  const c = { v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [
    seccion('tBeta', DISENO),
    { type: NODO.tarjeta, attrs: { id: 'tLista' }, content: [optimizado(true, 'vinetas-grandes'), optimizado(false, 'vinetas-grandes')] },
  ] } }] } as LandingContenido;
  // Leer: cada sección con sus íconos; los de un optimizado con los íconos apagados no se ofrecen (no se verían).
  const e = estructuraParaApi(7, c) as { paginas: Array<{ secciones: Array<{ iconos?: Array<{ n: number; icono: string | null; junto_a?: string }> }> }> };
  assert.deepEqual(e.paginas[0].secciones[0].iconos, [{ n: 1, icono: null, junto_a: 'Trato preferencial' }, { n: 2, icono: null, junto_a: 'Precio de fundador' }]);
  assert.deepEqual(e.paginas[0].secciones[1].iconos, [{ n: 1, icono: 'check', junto_a: 'Rápido' }, { n: 2, icono: null, junto_a: 'Barato' }]);
  // Cambiar en el diseño: por el texto junto, con su tamaño y su color.
  const r = ok(planCambiarIcono(c, { seccion: 'tBeta', actual: 'precio de fundador', icono: 'cohete' }) as Plan);
  const html = htmlDe(r.contenido, 0);
  assert.match(html, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false" style="color:#2F6FED">/);
  assert.equal(html.split('<svg').length, 3, 'el otro ícono no se toca');
  assert.match(r.resumen, /ícono 2 .*junto a «Precio de fundador».*el del diseño → cohete/);
  assert.equal((estructuraParaApi(7, r.contenido) as typeof e).paginas[0].secciones[0].iconos![1].icono, 'cohete', 'se lee de vuelta por su nombre');
  // Cambiar en un optimizado: por número; el atributo del ítem.
  const r2 = ok(planCambiarIcono(c, { seccion: 'tLista', n: 2, icono: 'dinero' }) as Plan);
  assert.equal(r2.contenido.paginas[0].doc.content![1].content![0].content![1].attrs!.icono, 'dinero');
  // Lo que no se puede, con por qué.
  assert.match(falla(planCambiarIcono(c, { seccion: 'tBeta', n: 1, icono: 'inventado' }) as Plan).error, /No hay un ícono «inventado»/);
  assert.match(falla(planCambiarIcono(c, { seccion: 'tBeta', n: 3, icono: 'cohete' }) as Plan).error, /n va de 1 a 2/);
  assert.match(falla(planCambiarIcono(c, { seccion: 'tBeta', icono: 'cohete' }) as Plan).error, /Falta cuál ícono/);
  assert.equal((falla(planCambiarIcono(c, { seccion: 'tLista', actual: 'rápido', icono: 'check' }) as Plan) as { yaEstaba?: boolean }).yaEstaba, true);
  // La biblioteca: por nombre o etiqueta, sin acentos.
  assert.ok(iconosDeBibliotecaParaApi('cohete').iconos.some((x) => x.nombre === 'cohete'));
  assert.ok(iconosDeBibliotecaParaApi('dinero').iconos.length >= 2);
  assert.match(String(iconosDeBibliotecaParaApi('zzzz').nota), /Ningún ícono/);
});
