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
  assert.match(html, /placeholder="Busca carruseles, temas o @creadores"/);
  assert.doesNotMatch(html, /De las cuentas que sigues en/, 'la bajada se fue');
  assert.doesNotMatch(html, /Tamaño de la grilla|compacta/i, 'el botón «compacta» se fue');
  assert.doesNotMatch(html, /role="tab"/, 'las pestañas («Esta semana», «Cuentas») se fueron: son filtros');
  assert.doesNotMatch(html, /Esta semana/);
  assert.match(html, /role="radio"[^>]*>Carruseles</, 'carruseles o anuncios es un filtro');
  assert.match(html, />CTA</, 'el filtro CTA');
});

test('cada tarjeta trae «Editar», sus láminas para pasar adentro y el CTA que pide', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([
    carrusel({ id: -1, laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'], cta: { palabra: 'GUÍA', via: 'comentario' } }),
    carrusel({ id: -2, laminas: 5 }),
  ]) }));
  assert.equal(cuantas(html, '>Editar</button>'), 2, 'una por tarjeta');
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
  assert.equal(cuantas(html, '>Editar</button>'), 1, 'sólo el anuncio: no se mezclan');
  assert.match(html, /aria-label="Anuncios"/);
});

test('sin nada que mirar, la frase y la acción (no una grilla vacía)', async () => {
  const { ExplorarCarruseles } = await import('@/app/image-editor/carruseles/ExplorarCarruseles');
  const html = renderToStaticMarkup(createElement(ExplorarCarruseles, { datos: datos([]) }));
  assert.match(html, /Sigue a las cuentas de tu rubro/);
  assert.match(html, />Seguir una cuenta</);
  assert.doesNotMatch(html, /Editar<\/button>/);
});
