// La tab «Thumbnails» del explorador de Image (lib/thumbnails/explorar.ts, 6/11/2026). Martín: «También quisiera una tab que sea
// "Thumbnails", para traer de la misma manera miniaturas top en el mercado». Corre el código con filas con la forma de las de la
// mig 0409 (lo que guarda scripts/thumbnails-biblioteca.mts desde la YouTube Data API).
//
// Probado rompiéndolo (6/11/2026), base 8/0, restaurando desde memoria:
//   · `vigente` siempre true (lo leído hace más de 30 días se mostraría) → 2 rojos;
//   · `thumbnailsDe` dejando pasar un Short → 1 rojo;
//   · `filtrarThumbnails` filtrando por múltiplo sin la enmienda → 1 rojo;
//   · `filtrarThumbnails` sin repartir por canal → 1 rojo;
//   · la query sin `que=thumbnails` → 1 rojo.
// Que no haya múltiplo de YouTube sin la enmienda lo cuida tests/multiplo-rendimiento.test.ts; acá se mira que llegue a la tarjeta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_VIGENTE, FILTROS_THUMBNAIL, ORDEN_INICIAL_THUMBNAIL, canalesDe, duracionLegible, esCorto, esIdDeVideo, filtrarThumbnails,
  filtrosThumbnailDeQuery, imagenDeVideo, ordenesDisponibles, queryDeThumbnails, sinFiltrosThumbnail, thumbnailsDe, urlDeVideo, vigente,
  type FilaCanal, type FilaVideo, type Thumbnail,
} from '../lib/thumbnails/explorar';
import { ENMIENDA_III_L } from '../lib/spy-reglas';
import { QUE_VER_CARRUSEL } from '../lib/carruseles/opciones';

const AHORA = Date.parse('2026-11-06T12:00:00Z');
const hace = (d: number) => new Date(AHORA - d * 86_400_000).toISOString();

const canal = (o: Partial<FilaCanal> = {}): FilaCanal => ({
  id: 1, canal_id: 'UC' + 'a'.repeat(22), nombre: 'Ventas Claras', handle: '@ventasclaras', foto: null, nicho: 'ventas', idioma: 'es', estado: 'activo', ...o,
});
let n = 0;
const video = (o: Partial<FilaVideo> = {}): FilaVideo => {
  n += 1;
  return {
    id: n, video_id: `vid${String(n).padStart(8, '0')}`, canal_id: 1, titulo: `Cómo vender ${n}`, publicado_en: hace(60 + n),
    duracion: 'PT12M3S', vistas: 1000 * n, megusta: 10 * n, comentarios: n, leido_en: hace(2), oculto: false, ...o,
  };
};

test('la biblioteca: sólo videos largos, de canales activos, leídos hace menos de 30 días, no escondidos', () => {
  const canales = [canal(), canal({ id: 2, canal_id: 'UC' + 'b'.repeat(22), estado: 'excluido' })];
  const xs = thumbnailsDe([
    video({ id: 100 }),
    video({ id: 101, leido_en: hace(DIAS_VIGENTE + 1) }),
    video({ id: 102, duracion: 'PT59S' }),
    video({ id: 103, oculto: true }),
    video({ id: 104, canal_id: 2 }),
    video({ id: 105, video_id: 'malo' }),
    video({ id: 106, canal_id: 99 }),
  ], canales, AHORA);
  assert.deepEqual(xs.map((x) => x.id), [100]);
  assert.equal(xs[0].nicho, 'ventas');
  assert.equal(xs[0].canal.nombre, 'Ventas Claras');
});

test('sin la enmienda III.L no hay múltiplo de YouTube: se dice por qué, y no se ofrece', () => {
  assert.equal(ENMIENDA_III_L, false, 'si esto cambia, este test tiene que medir el número');
  const vids = Array.from({ length: 12 }, (_, i) => video({ id: 200 + i, vistas: 1000 + i, publicado_en: hace(40 + i * 3) }));
  const xs = thumbnailsDe(vids, [canal()], AHORA);
  assert.ok(xs.length > 0);
  for (const t of xs) {
    assert.equal(t.outlier, null);
    assert.equal(t.multiplo && t.multiplo.veces === null ? t.multiplo.motivo : null, 'falta-enmienda');
  }
  assert.equal(ORDEN_INICIAL_THUMBNAIL, 'vistas');
  assert.equal(ordenesDisponibles(false).some((o) => o.value === 'outlier'), false);
  assert.equal(ordenesDisponibles(true).some((o) => o.value === 'outlier'), true, 'el día que se firme, aparece');
});

const t = (o: Partial<Thumbnail>): Thumbnail => ({
  id: 1, video: 'abcdefghijk', canalId: 1, canal: { nombre: 'Uno', handle: '@uno', foto: null }, titulo: 'Cómo vender más',
  publicado: hace(10), duracion: 'PT10M', vistas: 1000, megusta: 10, comentarios: 1, nicho: 'ventas', idioma: 'es', outlier: null, ...o,
});

test('los filtros: rubro, idioma, período, guardados, canal y búsqueda', () => {
  const xs = [
    t({ id: 1, nicho: 'ventas', idioma: 'es', vistas: 900 }),
    t({ id: 2, nicho: 'marketing', idioma: 'en', vistas: 800, canalId: 2, canal: { nombre: 'Dos', handle: '@dos', foto: null }, titulo: 'Marketing plan' }),
    t({ id: 3, nicho: 'ventas', idioma: 'pt', vistas: 700, publicado: hace(200), canalId: 3, canal: { nombre: 'Três', handle: '@tres', foto: null } }),
  ];
  const ids = (f: Partial<typeof FILTROS_THUMBNAIL>, guardados = new Set<number>()) => filtrarThumbnails(xs, { ...FILTROS_THUMBNAIL, ...f }, guardados, AHORA).map((x) => x.id);
  assert.deepEqual(ids({}), [1, 2, 3], 'por vistas, de más a menos');
  assert.deepEqual(ids({ nicho: 'ventas' }), [1, 3]);
  assert.deepEqual(ids({ idioma: 'en' }), [2]);
  assert.deepEqual(ids({ periodo: '30' }), [1, 2]);
  assert.deepEqual(ids({ vista: 'guardados' }, new Set([3])), [3]);
  assert.deepEqual(ids({ canales: [2] }), [2]);
  assert.deepEqual(ids({ q: 'marketing' }), [2]);
  assert.deepEqual(ids({ q: '@tres' }), [3]);
  assert.deepEqual(ids({ orden: 'nuevos' }), [1, 2, 3]);
  assert.deepEqual(ids({ orden: 'viejos' }), [3, 1, 2]);
});

test('el múltiplo filtra sólo con la enmienda; sin ella, «Mayor múltiplo» ordena por vistas', () => {
  const xs = [t({ id: 1, outlier: 2, vistas: 100 }), t({ id: 2, outlier: 9, vistas: 50, canalId: 2 }), t({ id: 3, outlier: null, vistas: 900, canalId: 3 })];
  const sin = filtrarThumbnails(xs, { ...FILTROS_THUMBNAIL, outlierMin: 4, orden: 'outlier' }, new Set(), AHORA, false);
  assert.deepEqual(sin.map((x) => x.id), [3, 1, 2], 'sin la enmienda el deslizador no cuenta y se ordena por vistas');
  const con = filtrarThumbnails(xs, { ...FILTROS_THUMBNAIL, outlierMin: 4, orden: 'outlier' }, new Set(), AHORA, true);
  assert.deepEqual(con.map((x) => x.id), [2]);
});

test('que un canal no llene la pantalla, salvo que se pida ver a ese canal', () => {
  const xs = [
    ...Array.from({ length: 8 }, (_, i) => t({ id: i + 1, vistas: 10_000 - i, canalId: 1 })),
    t({ id: 20, vistas: 50, canalId: 2 }), t({ id: 21, vistas: 40, canalId: 3 }),
  ];
  const vistos = filtrarThumbnails(xs, FILTROS_THUMBNAIL, new Set(), AHORA);
  assert.ok(vistos.slice(0, 4).filter((x) => x.canalId === 1).length <= 2);
  assert.equal(vistos[0].id, 1);
  const suyo = filtrarThumbnails(xs, { ...FILTROS_THUMBNAIL, canales: [1] }, new Set(), AHORA);
  assert.deepEqual(suyo.map((x) => x.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('los filtros viajan en la URL con `que=thumbnails`; lo que no se entiende vuelve al inicial', () => {
  assert.ok(QUE_VER_CARRUSEL.some((q) => q.value === 'thumbnails'), 'Carruseles · Anuncios · Thumbnails');
  const f = { ...FILTROS_THUMBNAIL, q: 'cerrar ventas', nicho: 'ventas' as const, idioma: 'es' as const, periodo: '90' as const, orden: 'nuevos' as const, canales: [3, 4], vista: 'guardados' as const };
  const q = queryDeThumbnails(f);
  assert.match(q, /^que=thumbnails&/);
  assert.deepEqual(filtrosThumbnailDeQuery(new URLSearchParams(q)), f);
  assert.equal(queryDeThumbnails(FILTROS_THUMBNAIL), 'que=thumbnails');
  assert.equal(sinFiltrosThumbnail(FILTROS_THUMBNAIL), true);
  // ⚠️ Las claves de Thumbnails llevan prefijo `t` desde el 8/11/2026 (`CLAVE` en lib/thumbnails/
  // explorar.ts): antes eran las MISMAS que las de carruseles y un link de acá dejaba filtrada la
  // otra pestaña. Los nombres sin prefijo ya no se leen, que es justo lo que se quería.
  assert.deepEqual(filtrosThumbnailDeQuery(new URLSearchParams('tnicho=musica&tidioma=fr&tperiodo=2&torden=x&tde=a,-1,0,7&tmin=7')), { ...FILTROS_THUMBNAIL, canales: [7] });
  // Y las viejas, sin prefijo, NO contaminan: es la mitad que protege a la otra pestaña.
  assert.deepEqual(filtrosThumbnailDeQuery(new URLSearchParams('periodo=90&vista=guardados&de=3,4')), FILTROS_THUMBNAIL);
});

test('la imagen es la de YouTube, el link abre en YouTube, y la duración se lee como allá', () => {
  assert.equal(esIdDeVideo('dQw4w9WgXcQ'), true);
  assert.equal(esIdDeVideo('../etc/pass'), false);
  assert.equal(imagenDeVideo('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(imagenDeVideo('dQw4w9WgXcQ', 'max'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  assert.equal(imagenDeVideo('a/b?c'), 'https://i.ytimg.com/vi/a%2Fb%3Fc/hqdefault.jpg');
  assert.equal(urlDeVideo('dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(duracionLegible('PT12M3S'), '12:03');
  assert.equal(duracionLegible('PT1H2M33S'), '1:02:33');
  assert.equal(duracionLegible('PT0S'), null);
  assert.equal(duracionLegible(null), null);
  assert.equal(esCorto('PT59S'), true);
  assert.equal(esCorto('PT3M'), true);
  assert.equal(esCorto('PT3M1S'), false);
  assert.equal(esCorto(null), false, 'sin duración no se esconde');
  assert.equal(vigente(hace(DIAS_VIGENTE - 1), AHORA), true);
  assert.equal(vigente(hace(DIAS_VIGENTE + 1), AHORA), false);
  assert.equal(vigente(null, AHORA), false);
});

test('el filtro «Cuentas»: los canales con cuántas miniaturas, de más a menos', () => {
  const xs = [t({ id: 1, canalId: 1 }), t({ id: 2, canalId: 2, canal: { nombre: 'Dos', handle: null, foto: null } }), t({ id: 3, canalId: 2, canal: { nombre: 'Dos', handle: null, foto: null } })];
  assert.deepEqual(canalesDe(xs).map((c) => [c.id, c.n]), [[2, 2], [1, 1]]);
});
