// =============================================================================
// Las reglas puras para servir una prueba A/B de una landing (Landing AI, L2; 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md, L2, con la crítica (Anexo 2 §E) mandando. Lo que fija:
//   1. B con OTRA estructura que A se rechaza: config (Pixel), pagos, htmlLibre, título y descripción de cada página, y lo
//      que el HTML lleva (enlaces, formularios, iframes, scripts, precios). Cambiar el ORDEN o el TEXTO sí se puede;
//   2. sólo lo de MaKo va fijo a A (el lector y el User-Agent `MaKoPixel/`): ningún bot de terceros por su User-Agent;
//   3. la cookie de la rama es del servidor, HttpOnly, y una rama que ya no está activa no se respeta;
//   4. con prueba, la respuesta es privada y varía por cookie.
// Correr: node --import tsx --test tests/prueba-landing.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CABECERAS_CON_PRUEBA, MARCA_UA_MAKO, PARAM_LECTOR, cookieDePrueba, diferenciasDeEstructura, nombreCookiePrueba, piezasDeHtml,
  ramaDeCookie, vaFijoEnA, type FotoComparable,
} from '../lib/editor-landing/prueba-landing';

const RAIZ = join(import.meta.dirname, '..');
const HERO = '<section class="gm-tarjeta" id="t-hero"><h1>Vende más con MaKo</h1><a class="gm-boton" href="pago:7">Comprar</a><p>Desde <span data-mako-desde="">US$47</span></p></section>';
const CASO = '<section class="gm-tarjeta" id="t-caso"><h2>El caso</h2><iframe src="https://player.vimeo.com/video/1"></iframe></section>';
const FORM = '<section class="gm-tarjeta" id="t-form"><form action="#" method="post"><input name="email" type="email"><textarea name="mensaje"></textarea><button type="submit">Enviar</button></form><a href="https://wa.me/5491100000000">WhatsApp</a></section>';
const fotoA = (): FotoComparable => ({
  paginas: [{ ruta: '', titulo: 'MaKo', descripcion: 'Tu equipo de IA', html: HERO + CASO + FORM }],
  config: { sitio: { metaPixelId: '123', nombre: 'MaKo' }, tema: 'nord' },
  pagos: [{ producto: 7, precio: 47 }],
  htmlLibre: {},
});
const con = (cambio: Partial<FotoComparable>, html?: string): FotoComparable => {
  const a = fotoA();
  return { ...a, ...cambio, paginas: html === undefined ? a.paginas : [{ ...a.paginas[0], html }] };
};

test('B puede cambiar el texto y el ORDEN de las secciones, nada más', () => {
  assert.deepEqual(diferenciasDeEstructura(fotoA(), fotoA()), []);
  // Otro hook y la sección del caso subida arriba: misma estructura.
  const otroHook = HERO.replace('Vende más con MaKo', 'Tu negocio, sin contratar a nadie');
  assert.deepEqual(diferenciasDeEstructura(fotoA(), con({}, CASO + otroHook + FORM)), []);
  // Otro texto de botón con el mismo destino, también.
  assert.deepEqual(diferenciasDeEstructura(fotoA(), con({}, HERO.replace('>Comprar<', '>Empieza ya<') + CASO + FORM)), []);
});

test('B con otra estructura se rechaza, y el motivo dice qué cambió', () => {
  const casos: Array<[string, FotoComparable, RegExp]> = [
    ['otro destino de un botón', con({}, HERO.replace('pago:7', 'pago:8') + CASO + FORM), /enlaces, formularios, pagos.*sin «enlace pago:7»/],
    ['un link de WhatsApp menos', con({}, HERO + CASO + FORM.replace(/<a href="https:\/\/wa\.me[^>]*>WhatsApp<\/a>/, '')), /sin «enlace https:\/\/wa\.me/],
    ['un campo más en el formulario', con({}, HERO + CASO + FORM.replace('<textarea', '<input name="telefono" type="tel"><textarea')), /campo input telefono tel/],
    ['sin el video', con({}, HERO + CASO.replace(/<iframe[^>]*><\/iframe>/, '') + FORM), /iframe https:\/\/player\.vimeo\.com/],
    ['otro precio', con({}, HERO.replace('data-mako-desde=""', 'data-mako-precio="pro"') + CASO + FORM), /precio/],
    ['un script nuevo', con({}, HERO + CASO + FORM + '<script src="https://otro.com/x.js"></script>'), /script https:\/\/otro\.com/],
    ['otro Píxel de Meta', con({ config: { sitio: { metaPixelId: '999', nombre: 'MaKo' }, tema: 'nord' } }), /configuración/],
    ['otros productos de pago', con({ pagos: [{ producto: 7, precio: 97 }] }), /productos que cobran/],
    ['otro HTML personalizado', con({ htmlLibre: { b1: '<p>x</p>' } }), /HTML personalizado/],
    ['otro título para Google', { ...fotoA(), paginas: [{ ...fotoA().paginas[0], titulo: 'Otro' }] }, /título o la descripción/],
    ['otra página', { ...fotoA(), paginas: [...fotoA().paginas, { ruta: 'precios', html: '' }] }, /cambian las páginas/],
  ];
  for (const [nombre, b, motivo] of casos) {
    const d = diferenciasDeEstructura(fotoA(), b);
    assert.ok(d.length > 0, `${nombre}: tenía que rechazarse`);
    assert.match(d.join(' · '), motivo, `${nombre}: ${d.join(' · ')}`);
  }
});

test('las piezas de una página: lo que importa de cada etiqueta, sin el texto', () => {
  const p = piezasDeHtml(HERO + FORM);
  assert.ok(p.includes('enlace pago:7') && p.includes('formulario # post') && p.includes('campo input email email') && p.includes('campo textarea mensaje textarea'));
  assert.ok(p.includes('precio desde='), 'la marca del precio');
  assert.ok(!p.some((x) => /Vende|Comprar|WhatsApp/.test(x)), 'el texto no es estructura');
});

test('sólo lo de MaKo va fijo a A: ningún bot de terceros por su User-Agent', () => {
  const url = 'https://hola-mako.site/mi-landing';
  assert.equal(vaFijoEnA({ url, userAgent: 'Mozilla/5.0 (compatible; MaKoPixel/1.0; +https://hola-mako.com)' }), true);
  assert.equal(vaFijoEnA({ url, userAgent: 'MaKoPixel/1.0 (+https://hola-mako.com)' }), true);
  assert.equal(vaFijoEnA({ url: `${url}?mako_leer=abc`, userAgent: 'Mozilla/5.0' }), true);
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'facebookexternalhit/1.1', 'WhatsApp/2.23', 'AdsBot-Google', 'Mozilla/5.0 (iPhone)', null]) {
    assert.equal(vaFijoEnA({ url, userAgent: ua }), false, `${ua}: decidir la rama por el User-Agent de un tercero es cloaking`);
  }
  // Las marcas son las de verdad: el User-Agent del análisis y la vigilancia, y el parámetro del lector.
  const analisis = readFileSync(join(RAIZ, 'lib/landing-analisis.ts'), 'utf8');
  for (const m of analisis.matchAll(/const UA_(COMO_NAVEGADOR|BOT) = '([^']+)'/g)) assert.ok(m[2].includes(MARCA_UA_MAKO), `UA_${m[1]} sin «${MARCA_UA_MAKO}»`);
  assert.match(readFileSync(join(RAIZ, 'lib/editor-landing/lector.ts'), 'utf8'), new RegExp(`export const PARAM_LEER = '${PARAM_LECTOR}';`));
});

test('la cookie de la rama: del servidor, HttpOnly, y una rama que ya no está activa no se respeta', () => {
  assert.equal(nombreCookiePrueba(42), 'mko_ab_42');
  assert.equal(nombreCookiePrueba('a;b=c'), 'mko_ab_abc', 'nunca un ; ni un = en el nombre');
  const c = cookieDePrueba(42, 'B', true);
  assert.match(c, /^mko_ab_42=B; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure$/);
  assert.doesNotMatch(cookieDePrueba(42, 'B', false), /Secure/);
  assert.equal(ramaDeCookie('nqe_visitor_id=x; mko_ab_42=B; otra=1', 42, ['A', 'B']), 'B');
  assert.equal(ramaDeCookie('mko_ab_42=C', 42, ['A', 'B']), null, 'una rama que se apagó: se asigna de nuevo');
  assert.equal(ramaDeCookie('mko_ab_7=B', 42, ['A', 'B']), null, 'la de otra prueba no sirve');
  assert.equal(ramaDeCookie(null, 42, ['A', 'B']), null);
  assert.deepEqual(CABECERAS_CON_PRUEBA, { 'Cache-Control': 'private, no-cache', Vary: 'Cookie' });
});
