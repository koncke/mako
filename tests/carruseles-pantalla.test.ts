// La pantalla de ejemplos de carruseles (app/image-editor/carruseles/ExplorarCarruseles.tsx, 6/11/2026), DIBUJADA: lo que
// pidió Martín se mira en el HTML que sale, no en el fuente. «Lo principal al entrar son los ejemplos… Copiá la interfaz de Top
// Carousels: el encabezado "Encuentra tu siguiente OUTLIER"… poder pasar a la siguiente slide dentro de la tarjeta» y «Sacá el
// texto "De las cuentas que sigues en Competitors Spy…", el botón "compacta" y las pestañas "Esta semana" y "Cuentas"».
//
// Probado rompiéndolo (6/11/2026), base 4/0:
//   · volver a poner la bajada «De las cuentas que sigues en…» → 1 rojo;
//   · una tarjeta sin «Editar» → 2 rojos;
//   · la tarjeta con sólo la portada aunque tenga sus láminas → 1 rojo;
//   · el anuncio sin sus días al aire → 1 rojo.
// Y del 6/11/2026 (Martín: sin CTA, sin Biblioteca, sin «Tamaño de la tarjeta», con Thumbnails), base 8/0:
//   · volver a dibujar el chip «CTA» → 1 rojo;
//   · sacar «Crear desde cero» → 1 rojo;
//   · dibujar la tarjeta de miniatura sin «Ver en YouTube» → 1 rojo;
//   · el múltiplo de una miniatura a la vista sin la enmienda III.L → 1 rojo.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Carrusel } from '@/lib/carruseles/explorar';

// Node no carga CSS ni deja importar `server-only`, y las acciones del servidor no corren acá: se reemplazan ANTES de importar la
// pantalla (como tests/crear-qa-pantallas.test.ts).
type Hook = (url: string, ctx: { parentURL?: string }, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve?: Hook; load?: Hook }) => void };
const DE_MENTIRA = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '_carruseles-acciones-de-mentira.ts')).href;
registerHooks({
  resolve: (url, ctx, next) => {
    if (url === './actions' && (ctx.parentURL ?? '').includes('/app/image-editor/carruseles/')) return { url: DE_MENTIRA, shortCircuit: true };
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
  clase: 'carrusel', laminasImagenes: [], cta: null, ...o,
});

const datos = (carruseles: Carrusel[]) => ({
  carruseles, guardados: [], busquedas: [], paso: 'sin-cuentas' as const, frase: 'Sigue a las cuentas de tu rubro en Competitors Spy.',
  accion: { texto: 'Seguir una cuenta', ruta: '/competitor-spy' }, ejemplos: carruseles.filter((c) => c.origen === 'biblioteca').length, avisoBiblioteca: null,
  anuncios: carruseles.filter((c) => c.clase === 'anuncio').length,
});

const cuantas = (html: string, aguja: string) => html.split(aguja).length - 1;

test('el encabezado de Top Carousels, sin la bajada ni las pestañas que se fueron', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([carrusel({})]) }));
  assert.match(html, /<h1>Encuentra tu siguiente <mark>OUTLIER<\/mark><\/h1>/);
  assert.match(html, /placeholder="Busca carruseles, temas o @creadores, o pega un link de Instagram"/);
  assert.doesNotMatch(html, /De las cuentas que sigues en/, 'la bajada se fue');
  assert.doesNotMatch(html, /Tamaño de la grilla|compacta/i, 'el botón «compacta» se fue');
  assert.doesNotMatch(html, /role="tab"/, 'las pestañas («Esta semana», «Cuentas») se fueron: son filtros');
  assert.doesNotMatch(html, /Esta semana/);
  assert.match(html, /role="radio"[^>]*>Carruseles</, 'carruseles o anuncios es un filtro');
  // 6/11/2026, Martín: «elimina el filtro de "CTA"…», «elimina lo de "biblioteca"» y «Thumbnails» como tercera pestaña.
  assert.doesNotMatch(html, />CTA</, 'el filtro CTA se fue');
  assert.doesNotMatch(html, /Biblioteca/, 'la pastilla «Biblioteca» y su modal se fueron');
  assert.match(html, /role="radio"[^>]*>Thumbnails</, 'Carruseles · Anuncios · Thumbnails');
  assert.match(html, /href="\/image-editor\?ver=crear"[^>]*>.*Crear desde cero</, 'las plantillas, a un toque');
  assert.match(html, / Guardados</);
  assert.match(html, />\+ Seguir cuentas</);
});

test('cada tarjeta trae «Editar», sus láminas para pasar adentro y el CTA que pide', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([
    carrusel({ id: -1, laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'], cta: { palabra: 'GUÍA', via: 'comentario' } }),
    carrusel({ id: -2, laminas: 5 }),
  ]) }));
  assert.equal(cuantas(html, '>Editar</button>'), 4, 'dos por tarjeta: el de pasar el mouse (computadora) y el liviano que queda a la vista (celular)');
  assert.equal(cuantas(html, 'aria-label="Ver parecidos"'), 2, 'parecidos, en cada tarjeta');
  assert.equal(cuantas(html, 'src="https://a/'), 3, 'las tres láminas, en la tarjeta');
  assert.match(html, />1\/3</, 'en qué lámina está');
  assert.match(html, /aria-label="Lámina siguiente"/);
  assert.match(html, /Comenta «GUÍA»/);
  assert.match(html, />5 láminas</, 'sin sus láminas guardadas, dice cuántas tiene');
});

test('los anuncios: con sus días al aire y su propia lista', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const { FILTROS_INICIALES } = await import('@/lib/carruseles/explorar');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, {
    datos: datos([carrusel({}), carrusel({ id: 9, clase: 'anuncio', origen: 'cuentas', competidorId: 7, medio: 'imagen', laminas: null, outlier: null, diasAlAire: 46, activo: true })]),
    filtrosIniciales: { ...FILTROS_INICIALES, que: 'anuncios', orden: 'aire' },
  }));
  assert.match(html, /46 días al aire/);
  assert.equal(cuantas(html, '>Editar</button>'), 2, 'sólo el anuncio (sus dos botones): no se mezclan');
  assert.match(html, /aria-label="Anuncios"/);
});

test('sin nada que mirar, la frase y la acción (no una grilla vacía)', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([]) }));
  assert.match(html, /Sigue a las cuentas de tu rubro/);
  assert.match(html, />Seguir una cuenta</);
  assert.doesNotMatch(html, /Editar<\/button>/);
});

test('el carrusel abierto (modal en dos partes) y el modal de filtros: lo que pidió Martín, dibujado', async () => {
  const { CarruselAbierto } = await import('@/app/image-editor/carruseles/CarruselAbierto');
  const { FiltrosCarruselModal } = await import('@/app/image-editor/carruseles/FiltrosCarruselModal');
  const { FILTROS_INICIALES } = await import('@/lib/carruseles/explorar');
  const c = carrusel({
    id: -5, gancho: 'Mi primer cliente de 1.000 dólares', laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'], outlier: 4.6,
    multiplo: { veces: 4.6, formato: 'imagenes', metrica: 'interaccion', canal: 'instagram', valor: 4600, mediana: 1000, comparadas: 12 },
    cta: { palabra: 'GUÍA', via: 'comentario' },
  });
  const abierto = renderToStaticMarkup(createElement(CarruselAbierto, {
    c, guardado: false, nParecidos: 3, creadoresParecidos: [{ id: -9, nombre: 'Bruno', usuario: 'bruno', foto: null, n: 4 }], telefono: false,
    onGuardar: () => {}, onEditar: () => {}, onParecidos: () => {}, onCreador: () => {}, onCerrar: () => {},
  }));
  assert.match(abierto, /@ana\.ventas/, 'el @creador');
  assert.match(abierto, /Lista o tips · Publicado/, 'el tipo y la fecha');
  assert.match(abierto, /Mi primer cliente de 1\.000 dólares/, 'el título');
  assert.match(abierto, /4,6×/, 'el múltiplo');
  assert.match(abierto, /Lo usual de este creador: 1k me gusta y comentarios/, 'con lo usual de su cuenta');
  assert.match(abierto, /1 \/ 3/, 'el contador de láminas');
  assert.match(abierto, /aria-label="Lámina siguiente"/);
  assert.match(abierto, /<strong>Editar<\/strong>/, 'Editar es la acción principal');
  assert.match(abierto, />Guardar</);
  assert.match(abierto, /Ver original/);
  assert.match(abierto, /Parecidos · 3/);
  assert.match(abierto, /Creadores parecidos/);
  assert.match(abierto, /data-completa/, 'a pantalla completa en el celular');
  // Sin dato de «lo usual», no se inventa.
  const sinDato = renderToStaticMarkup(createElement(CarruselAbierto, {
    c: { ...c, multiplo: undefined }, guardado: true, nParecidos: 0, creadoresParecidos: [], telefono: false,
    onGuardar: () => {}, onEditar: () => {}, onParecidos: () => {}, onCreador: () => {}, onCerrar: () => {},
  }));
  assert.doesNotMatch(sinDato, /Lo usual de este creador/);
  assert.doesNotMatch(sinDato, /Parecidos ·/);
  assert.match(sinDato, />Guardado</);

  const filtros = renderToStaticMarkup(createElement(FiltrosCarruselModal, {
    // Los dos tienen que ser contenidos DISTINTOS: con el mismo pie, las mismas láminas y el mismo día serían el mismo
    // carrusel dos veces y la grilla deja uno (lib/carruseles/duplicados.ts), así que el botón diría «Ver 1 carrusel».
    filtros: FILTROS_INICIALES, carruseles: [c, carrusel({ id: -6, formato: 'tutorial', texto: 'cómo cobrar tu primera consulta sin descuentos' })], formatos: [{ value: 'lista', label: 'Lista o tips', n: 1 }, { value: 'tutorial', label: 'Tutorial', n: 1 }],
    dosOrigenes: true, onAplicar: () => {}, onCerrar: () => {},
  }));
  for (const t of ['Múltiplo', 'Interacciones', 'Láminas', 'Publicado', 'Tipo', 'Ocultar tipos', 'Ordenar por', 'Colores del múltiplo', 'Quitar filtros', 'Cancelar']) assert.ok(filtros.includes(t), `falta «${t}»`);
  assert.doesNotMatch(filtros, /Tamaño de la tarjeta|Compacta/, 'la tarjeta es siempre grande (6/11/2026)');
  assert.equal(cuantas(filtros, 'type="range"'), 6, 'tres deslizadores de dos puntas');
  assert.equal(cuantas(filtros, 'data-nivel='), 5, 'la leyenda de colores: cinco niveles');
  assert.match(filtros, /Ver 2 carruseles/, 'el botón dice cuántos quedan');
});

const miniatura = (o: Record<string, unknown> = {}) => ({
  id: 41, video: 'dQw4w9WgXcQ', canalId: 5, canal: { nombre: 'Ventas Claras', handle: '@ventasclaras', foto: null },
  titulo: 'Cómo cerrar una venta por WhatsApp', publicado: dia(20), duracion: 'PT12M3S', vistas: 184_000, megusta: 5200, comentarios: 300,
  nicho: 'ventas', idioma: 'es', outlier: null, ...o,
});

test('Thumbnails: la tarjeta 16:9 de YouTube, con «Editar», «Ver en YouTube» y sin un múltiplo sin la enmienda', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const { FILTROS_INICIALES } = await import('@/lib/carruseles/explorar');
  const { FILTROS_THUMBNAIL } = await import('@/lib/thumbnails/explorar');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, {
    datos: { ...datos([carrusel({})]), thumbnails: { ok: true, lista: [miniatura(), miniatura({ id: 42, video: 'abcdefghijk', canalId: 6 })], guardados: [], sinTablas: false } as never },
    filtrosIniciales: { ...FILTROS_INICIALES, que: 'thumbnails' as never }, thumbnailsIniciales: { ...FILTROS_THUMBNAIL, orden: 'vistas' },
  }));
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Thumbnails</);
  assert.match(html, /aria-label="Miniaturas de YouTube"/);
  assert.equal(cuantas(html, 'src="https://i.ytimg.com/vi/'), 2, 'la miniatura sale del CDN de YouTube, sin copiarla');
  assert.equal(cuantas(html, '>Ver en YouTube</a>'), 2, 'cada una abre en YouTube');
  assert.equal(cuantas(html, '>Editar</button>'), 4);
  assert.match(html, /12:03/, 'la duración del video');
  assert.doesNotMatch(html, /\d+(,\d)?×/, 'sin la enmienda III.L no se dibuja un múltiplo');
  assert.doesNotMatch(html, /aria-label="Carruseles"/, 'la grilla de carruseles no se mezcla');
});

test('Thumbnails sin la biblioteca cargada: lo dice, no dibuja una grilla vacía', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const { FILTROS_INICIALES } = await import('@/lib/carruseles/explorar');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, {
    datos: { ...datos([carrusel({})]), thumbnails: { ok: true, lista: [], guardados: [], sinTablas: true } as never },
    filtrosIniciales: { ...FILTROS_INICIALES, que: 'thumbnails' as never },
  }));
  assert.doesNotMatch(html, /aria-label="Miniaturas de YouTube"/);
  assert.doesNotMatch(html, />Editar<\/button>/);
});

test('el teléfono también ve las flechas para pasar las láminas (sin pasar el mouse)', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { telefono: true, rutaCrear: '/m/image-editor?ver=crear', datos: datos([
    carrusel({ id: -1, laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg'] }),
    carrusel({ id: -2, laminasImagenes: [] }),
  ]) }));
  assert.match(html, /data-telefono="si"/, 'la regla de CSS que muestra las flechas en el teléfono cuelga de esto');
  assert.equal(cuantas(html, 'aria-label="Lámina siguiente"'), 1, 'flechas sólo en la que tiene sus láminas; sin láminas, ninguna');
  // En el teléfono el link se escribe con la ruta de /m y `Link` lo saca con la de la computadora (LAS MISMAS RUTAS): el proxy
  // sirve ahí la página del teléfono.
  assert.match(html, /href="\/image-editor\?ver=crear"[^>]*>.*Crear desde cero</, 'en el teléfono también, a un toque');
});

// «Traer tu outlier», lo que dejó la prueba en producción del 11/11/2026 (docs/pruebas/image-11-11.md): con el link de un REEL la
// pantalla ofrecía «Traer este carrusel», pagaba una lectura de Apify para terminar en «es un reel» y después del error SEGUÍA
// ofreciendo el botón; y con cualquier link pegado ofrecía «Guardar búsqueda», que no tiene sentido para un link.
test('un link pegado: el de un carrusel ofrece «Traer»; el de un reel lo dice sin botón; ninguno ofrece «Guardar búsqueda»', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const { FILTROS_INICIALES } = await import('@/lib/carruseles/explorar');
  const con = (q: string) => renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([carrusel({})]), filtrosIniciales: { ...FILTROS_INICIALES, q } }));
  const post = con('https://www.instagram.com/p/DflDIt_nyzx/?igsh=x');
  assert.match(post, /Ese link no está entre tus outliers\./);
  assert.match(post, />Traer este carrusel</);
  assert.doesNotMatch(post, /Guardar búsqueda/, 'un link no es una búsqueda para guardar');
  const reel = con('https://www.instagram.com/reel/DfmhoO8Srf1/');
  assert.match(reel, /Ese link es de un reel: aquí se traen carruseles y publicaciones con imagen\./);
  assert.doesNotMatch(reel, /Traer este carrusel/, 'un reel no se ofrece traer: la lectura se paga y termina en «es un reel»');
  assert.doesNotMatch(reel, /Guardar búsqueda/);
  // Una búsqueda de texto sin resultados sigue ofreciendo guardarla y quitar el filtro, como siempre.
  const texto = con('algo que no está en ningún carrusel');
  assert.match(texto, /Guardar búsqueda/);
  assert.doesNotMatch(texto, /Traer este carrusel/);
});
