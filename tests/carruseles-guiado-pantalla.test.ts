// =============================================================================
// Replicar un carrusel, GUIADO, DIBUJADO (9/11/2026): la pantalla que pidió Martín, mirada en el HTML que sale
// =============================================================================
// Martín, 9/11/2026: «Le acabo de dar a crear un carrusel, me llevó directamente al editor y no está bueno eso… ni siquiera me
// pregunta qué oferta», «con el tutorial que se opaca la pantalla, que le vaya señalando la pregunta», «"Nuevo carrusel" muestra
// los OUTLIERS… se elimina "¿Qué vas a crear hoy?"» y «La barra del chat de MaKo nunca desaparece». El diseño:
// docs/relevo/nube-carruseles-guiado.md. Las reglas puras (qué se pregunta y cuándo) las prueba tests/carruseles-guiado.test.ts;
// esto mira que la pantalla las DIBUJE:
//   1. los ejemplos llevan las marcas de la guía de Image (la grilla y cada tarjeta), las que el velo señala;
//   2. la tarjeta de MaKo pregunta la oferta, con sus botones, ADENTRO del ancla que el velo opaca alrededor;
//   3. un carrusel sin persona no pregunta el avatar: después de la oferta va «qué cambiar»;
//   4. el centro es el original con su salida («← Elegir otro»), y nada se arma antes de «Generar»;
//   5. `PantallaCrear` con `nueva` dibuja eso EN LUGAR de «¿Qué vas a crear hoy?», y sin `nueva` se ve como siempre.
//
// PROBADO ROMPIÉNDOLO (9/11/2026, node --test con tsx, base 5/0):
//   · sacar `{...ancla('image-editor-outliers')}` de la grilla                            → 1 rojo (1);
//   · sacar el `<div {...ancla('image-editor-pregunta')}>` que envuelve la pregunta        → 1 rojo (2);
//   · `preguntaAvatar` que contesta siempre que sí (lib/carruseles/guiado.ts)              → 1 rojo (3);
//   · `armando = g.r.listo || g.pedido` en ReplicarGuiado (arma sin «Generar»)             → 1 rojo (4);
//   · `{centro === 'nueva' && (<NuevaCrear …/>)}` sin mirar `p.nueva`                      → 1 rojo (5).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Carrusel } from '@/lib/carruseles/explorar';
import type { HechosGuiado, RespuestasGuiado } from '@/lib/carruseles/guiado';

// Node no carga CSS y las acciones del servidor no corren acá: se reemplazan ANTES de importar la pantalla (como
// tests/carruseles-pantalla.test.ts). Por eso las piezas se importan adentro de cada test, con un import dinámico.
type Hook = (url: string, ctx: { parentURL?: string }, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve?: Hook; load?: Hook }) => void };
const AQUI = dirname(fileURLToPath(import.meta.url));
const DE_MENTIRA = pathToFileURL(join(AQUI, '_carruseles-acciones-de-mentira.ts')).href;
// `PantallaCrear` llega a un módulo con `server-only` por una acción del servidor (en Next es una referencia; acá se ejecuta):
// se le da la versión vacía, la que el propio paquete usa en el server.
const SERVER_ONLY_VACIO = pathToFileURL(join(AQUI, '..', 'node_modules', 'server-only', 'empty.js')).href;
registerHooks({
  resolve: (url, ctx, next) => {
    if (url === './actions' && (ctx.parentURL ?? '').includes('/app/image-editor/carruseles/')) return { url: DE_MENTIRA, shortCircuit: true };
    if (url === 'server-only') return { url: SERVER_ONLY_VACIO, shortCircuit: true };
    return next(url, ctx);
  },
  load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)),
});

const AHORA = Date.now();
const dia = (d: number) => new Date(AHORA - d * 86_400_000).toISOString();
const carrusel = (o: Partial<Carrusel>): Carrusel => ({
  id: 1, competidorId: -3, origen: 'biblioteca', creador: { nombre: 'Ana', usuario: 'ana.ventas', foto: null }, url: 'https://www.instagram.com/p/X/',
  miniatura: 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/instagram/X.jpg', texto: '5 errores al cobrar', gancho: null, tipoGancho: null,
  cierre: null, formato: 'lista', medio: 'carrusel', laminas: 3, megusta: 1200, comentarios: 80, publicada: dia(3), traida: dia(2), outlier: 4.2,
  clase: 'carrusel', laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'], cta: null, ...o,
});
const datos = (carruseles: Carrusel[]) => ({
  carruseles, guardados: [], busquedas: [], paso: 'listo' as const, frase: '', accion: null,
  ejemplos: carruseles.length, avisoBiblioteca: null, anuncios: 0,
});
const cuantas = (html: string, aguja: string) => html.split(aguja).length - 1;

const hechos = (o: Partial<HechosGuiado> = {}): HechosGuiado => ({
  laminas: 3, creador: '@ana.ventas',
  ofertas: [{ id: 21, nombre: 'Mentoría', principal: true }, { id: 22, nombre: 'Taller', principal: false }],
  persona: null, leyendo: true, fotos: { cara: true, look: false }, kit: true, ...o,
});
const nada = () => {};
async function guiado(h: HechosGuiado, r: RespuestasGuiado = {}) {
  const { pedidoDelGuiado } = await import('@/lib/carruseles/guiado');
  return { c: carrusel({}), hechos: h, r, elegir: nada, escribir: nada, seguir: nada, pedido: pedidoDelGuiado(h, r), volverDelArmado: nada };
}
/** Lo que el HTML trae de un texto (React escapa las comillas y los `&`). */
const enHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

test('1. los ejemplos llevan las marcas de la guía de Image: la grilla y cada tarjeta', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const { GUIA_IMAGE } = await import('@/app/image-editor/guia-image');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([
    carrusel({ id: 1 }),
    carrusel({ id: 2, url: 'https://www.instagram.com/p/Y/', texto: 'Cómo cobrar sin regatear', miniatura: 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/instagram/Y.jpg', laminasImagenes: ['https://b/1.jpg'] }),
  ]), onReplicar: nada }));
  assert.equal(cuantas(html, 'data-recorrido="image-editor-outliers"'), 1, 'la grilla: el velo señala de dónde copiar');
  assert.equal(cuantas(html, 'data-recorrido="image-editor-replicar"'), 2, 'cada tarjeta: el velo señala la primera que se ve');
  const ids = GUIA_IMAGE.anclas.map((a) => a.id);
  assert.ok(ids.includes('image-editor-outliers') && ids.includes('image-editor-replicar'), 'las marcas son del catálogo de Image');
});

test('2. la tarjeta de MaKo pregunta la oferta, con sus botones, ADENTRO del ancla que el velo deja a la vista', async () => {
  const { ChatReplica } = await import('@/app/image-editor/carruseles/ReplicarGuiado');
  const { preguntaDe } = await import('@/lib/carruseles/guiado');
  const h = hechos();
  const pregunta = preguntaDe(h, {});
  assert.ok(pregunta, 'sin contestar nada, MaKo pregunta');
  const html = renderToStaticMarkup(createElement(ChatReplica, { g: await guiado(h), volver: null }));
  assert.match(html, /Vamos a hacer tu versión del carrusel de @ana\.ventas \(3 láminas\)/, 'el saludo dice de quién es y cuántas láminas');
  const ancla = html.indexOf('data-recorrido="image-editor-pregunta"');
  assert.ok(ancla > 0, 'la pregunta está marcada para el velo');
  const texto = html.indexOf(enHtml(pregunta!.texto), ancla);
  assert.ok(texto > ancla, `la pregunta («${pregunta!.texto}») va adentro del ancla`);
  for (const rotulo of ['Mentoría', 'Taller']) assert.ok(html.indexOf(`>${rotulo}<`, ancla) > ancla, `«${rotulo}» se toca ahí mismo`);
});

test('3. un carrusel sin persona no pregunta el avatar: después de la oferta, qué cambiar', async () => {
  const { ChatReplica } = await import('@/app/image-editor/carruseles/ReplicarGuiado');
  const { VALOR, preguntaDe, responder } = await import('@/lib/carruseles/guiado');
  const h = hechos({ persona: false, leyendo: false });
  const r = responder(h, {}, { tipo: 'respuesta', rotulo: 'Mentoría', valor: VALOR.oferta(21) });
  const siguiente = preguntaDe(h, r);
  assert.ok(siguiente);
  const html = renderToStaticMarkup(createElement(ChatReplica, { g: await guiado(h, r), volver: null }));
  assert.ok(html.includes(enHtml(siguiente!.texto)), 'la pregunta siguiente se dibuja');
  assert.doesNotMatch(html, /Mi cara de marca|¿Quién va en su lugar\?/, 'sin persona no hay a quién cambiar');
  // Y con persona, sí: el mismo paso pregunta por la foto.
  const conPersona = hechos({ persona: true, leyendo: false });
  const r2 = responder(conPersona, {}, { tipo: 'respuesta', rotulo: 'Mentoría', valor: VALOR.oferta(21) });
  const html2 = renderToStaticMarkup(createElement(ChatReplica, { g: await guiado(conPersona, r2), volver: null }));
  assert.match(html2, />Mi cara de marca</);
});

test('4. el centro es el original con su salida, y nada se arma antes de «Generar»', async () => {
  const { ReplicarGuiado } = await import('@/app/image-editor/carruseles/ReplicarGuiado');
  const { VALOR, responder } = await import('@/lib/carruseles/guiado');
  const h = hechos({ persona: false, leyendo: false });
  // Con la oferta elegida el pedido ya existe, y todavía no se tocó «Generar»: no se arma nada.
  const r = responder(h, {}, { tipo: 'respuesta', rotulo: 'Mentoría', valor: VALOR.oferta(21) });
  const g = await guiado(h, r);
  assert.ok(g.pedido, 'con la oferta, el pedido ya se puede armar');
  const html = renderToStaticMarkup(createElement(ReplicarGuiado, { g, onSalir: nada }));
  assert.match(html, /Tu versión del carrusel de @ana\.ventas/);
  assert.equal(cuantas(html, 'alt="Lámina '), 3, 'las tres láminas del original');
  assert.match(html, />← Elegir otro</, 'la salida a los ejemplos');
  assert.match(html, /href="https:\/\/www\.instagram\.com\/p\/X\/"[^>]*>Ver el original ↗</);
  assert.doesNotMatch(html, /Armando tu versión|Láminas de tu versión/, 'sin «Generar», el armado no arranca');
});

test('5. PantallaCrear con `nueva`: los ejemplos EN LUGAR de «¿Qué vas a crear hoy?»; sin `nueva`, como siempre', async () => {
  const { PantallaCrear } = await import('@/app/_crear/PantallaCrear');
  const { TITULO_CAJA } = await import('@/app/web-generator/CajaPedido');
  const base = { tab: 'Image', nuevo: 'Nuevo carrusel', proyectos: [], plantillas: [], onPlantilla: () => null, ejemplos: ['Un carrusel con 5 errores al cobrar'] };
  const con = renderToStaticMarkup(createElement(PantallaCrear, { ...base, nueva: createElement('p', { id: 'los-outliers' }, 'Encuentra tu siguiente OUTLIER') }));
  assert.match(con, /id="los-outliers"/, 'el centro de «Nuevo carrusel» son los ejemplos');
  assert.ok(!con.includes(TITULO_CAJA), '«¿Qué vas a crear hoy?» no se dibuja');
  assert.match(con, /className="cr-tarjeta"|class="cr-tarjeta"/, 'la tarjeta de MaKo sigue a la izquierda');
  const sin = renderToStaticMarkup(createElement(PantallaCrear, base));
  assert.ok(sin.includes(TITULO_CAJA), 'las demás tabs se ven igual');
});
