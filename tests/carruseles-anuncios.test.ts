// Los anuncios de la competencia en el explorador de carruseles (lib/carruseles/anuncios.ts, 6/11/2026), las láminas que
// la tarjeta pasa de a una y que sólo entren imágenes: corre el código con piezas con la forma de las de Spy y de la biblioteca.
//
// «Quitar filtros» en un Anuncios recién abierto (10/11/2026, el recorrido de Image): los anuncios arrancan por días al aire, y
// comparados con los de Carruseles «tenían filtros». `sinFiltrosDe` compara con los de su lado. Rompiéndolo (comparar contra
// FILTROS_INICIALES) → 1 rojo; `filtrosInicialesDe` sin el orden de los anuncios → 1 rojo.
//
// Probado rompiéndolo (6/11/2026), base 6/0:
//   · `anunciosDe` sin mirar el canal (entraba una publicación de Instagram como anuncio) → 1 rojo;
//   · `diasAlAire` contando hasta hoy un anuncio que ya terminó → 1 rojo;
//   · `filtrarCarruseles` mezclando anuncios con carruseles → 1 rojo;
//   · el orden de los anuncios por outlier (todos null) en vez de los días al aire → 1 rojo;
//   · `imagenesValidas` dejando pasar un http o un repetido → 1 rojo;
//   · `anunciosDe` dejando pasar un video (sin `esAnuncioEnVideo`) → 1 rojo;
//   · `carruselesDeBiblioteca` sin las láminas ni el CTA guardados → 1 rojo.
//
// Probado rompiéndolo otra vez (6/11/2026, tarde — que un «no sé» no se cuente como imagen), base 9/0:
//   · `medioGuardadoDeAnuncio` sin la pista `/t39.` → 1 rojo; sin la del `/t15.` → 2 rojos;
//   · `medioGuardadoDeAnuncio` devolviendo «imagen» cuando no se sabe → 1 rojo;
//   · `anunciosDe` con `medio: 'imagen'` fijo (el bug que tenía) → 1 rojo;
//   · `anunciosSinSaber` contando también los carruseles → 1 rojo;
//   · `filtrarCarruseles` sin el filtro `soloConfirmados` → 1 rojo;
//   · `queryDeFiltros` sin escribir `conf` en el link → 1 rojo, y `filtrosDeQuery` sin leerlo → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anunciosDe, anunciosSinSaber, diasAlAire, esAnuncioEnVideo, medioGuardadoDeAnuncio, rotuloAire, type PiezaAnuncio } from '../lib/carruseles/anuncios';
import { FILTROS_INICIALES, carruselesDe, filtrarCarruseles, filtrosDeQuery, filtrosInicialesDe, imagenesDe, imagenesValidas, queryDeFiltros, sinFiltrosDe, type PiezaParaCarrusel } from '../lib/carruseles/explorar';
import { carruselesDeBiblioteca, filasDeLectura, reclasificacion, type CuentaBiblioteca, type PiezaBiblioteca } from '../lib/carruseles/biblioteca';
import { imagenesDeLaminas } from '../lib/instagram-perfil';

const AHORA = Date.parse('2026-11-06T12:00:00Z');
const dia = (d: number) => new Date(AHORA - d * 86_400_000).toISOString();
const competidores = [{ id: 7, nombre: 'Clínica Norte', instagram: 'clinicanorte', avatar: null }];

const anuncio = (o: Partial<PiezaAnuncio>): PiezaAnuncio => ({
  id: 100, competidor_id: 7, canal: 'anuncios', tipo: 'anuncio', url: 'https://www.facebook.com/ads/library/?id=1', texto: 'Agenda tu limpieza',
  titulo: 'Limpieza a mitad de precio', publicada_en: dia(45), dejo_de_verse_en: null, visto_primera_vez: dia(2), miniatura: 'https://x.supabase.co/a.jpg', ...o,
});

test('los días al aire: de cuando empezó a hoy (o a cuando terminó); sin fecha, null', () => {
  assert.equal(diasAlAire(dia(45), null, AHORA), 46);
  assert.equal(diasAlAire(dia(30), dia(20), AHORA), 11, 'uno que terminó cuenta hasta que terminó');
  assert.equal(diasAlAire(null, null, AHORA), null);
  assert.equal(diasAlAire(dia(1), dia(5), AHORA), null, 'fechas al revés: no se afirma nada');
  assert.equal(rotuloAire({ diasAlAire: 46, activo: true }), '46 días al aire');
  assert.equal(rotuloAire({ diasAlAire: 1, activo: false }), 'Estuvo 1 día');
  assert.equal(rotuloAire({ diasAlAire: null, activo: true }), null);
});

test('un anuncio de Spy es una tarjeta «anuncio» de su competidor; lo que no es un anuncio no entra', () => {
  const xs = anunciosDe([
    anuncio({}),
    anuncio({ id: 101, canal: 'instagram', tipo: 'publicacion' }),
    anuncio({ id: 102, competidor_id: 99 }),
    anuncio({ id: 103, dejo_de_verse_en: dia(3), texto: 'Comenta CITA y te paso el horario' }),
  ], competidores, AHORA);
  assert.deepEqual(xs.map((x) => x.id), [100, 103]);
  assert.equal(xs[0].clase, 'anuncio');
  assert.equal(xs[0].creador.nombre, 'Clínica Norte');
  assert.equal(xs[0].activo, true);
  assert.equal(xs[1].activo, false);
  assert.equal(xs[0].outlier, null, 'un anuncio no tiene outlier: no se inventa');
  assert.equal(xs[1].cta?.palabra, 'CITA');
});

test('en Anuncios sólo entran imágenes: un video no se ve, ni cuenta (6/11/2026)', () => {
  // Martín: «en anuncios trajiste un montón de videos, cuando estamos viendo solo imágenes».
  const T15 = 'https://scontent.xx.fbcdn.net/v/t15.5256-10/123_n.jpg';
  const xs = anunciosDe([
    anuncio({ id: 1, medio: 'imagen' }),
    anuncio({ id: 2, medio: 'video' }),
    anuncio({ id: 3, medio: 'carrusel' }),
    anuncio({ id: 4, medio: null, miniatura: T15 }),
    anuncio({ id: 5, medio: null, miniatura: 'https://scontent.xx.fbcdn.net/v/t39.35426-6/9_n.jpg' }),
    anuncio({ id: 6, medio: 'imagen', miniatura: T15 }),
  ], competidores, AHORA);
  assert.deepEqual(xs.map((x) => x.id), [1, 3, 5, 6], 'el video declarado y la miniatura de cuadro de video (t15) no entran');
  assert.equal(esAnuncioEnVideo({ medio: null, miniatura: null }), false, 'sin señal no se esconde: no se sabe');
  assert.equal(esAnuncioEnVideo({ medio: null, miniatura: 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/t15.jpg' }), false, 'nuestro bucket no es el CDN de Meta');
  assert.equal(esAnuncioEnVideo({ medio: null, miniatura: 'https://evil.tld/fbcdn.net/v/t15.x.jpg' }), false);
});

test('un anuncio que no dice si es video NO se cuenta como imagen (6/11/2026)', () => {
  // Medido contra producción el 6/11/2026: de los 300 anuncios guardados, 298 no tienen ninguna señal (297 con la miniatura
  // ya copiada a nuestro bucket, 1 sin miniatura) y 2 quedaron en `/t39.`. La regla del `/t15.` acierta en CERO. Antes todas
  // esas tarjetas salían con `medio: 'imagen'`: ésa era la mentira del contador.
  const T15 = 'https://scontent.xx.fbcdn.net/v/t15.5256-10/123_n.jpg';
  const T39 = 'https://scontent.xx.fbcdn.net/v/t39.35426-6/9_n.jpg';
  const NUESTRA = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/anuncios/944000681777058.jpg';
  assert.equal(medioGuardadoDeAnuncio({ medio: null, miniatura: NUESTRA }), null, 'la copia en nuestro bucket perdió la pista');
  assert.equal(medioGuardadoDeAnuncio({ medio: null, miniatura: null }), null);
  assert.equal(medioGuardadoDeAnuncio({ medio: null, miniatura: T15 }), 'video');
  assert.equal(medioGuardadoDeAnuncio({ medio: null, miniatura: T39 }), 'imagen');
  assert.equal(medioGuardadoDeAnuncio({ medio: 'carrusel', miniatura: T15 }), 'carrusel', 'lo que guardó la lectura gana sobre la pista');

  const xs = anunciosDe([anuncio({ id: 1, medio: null, miniatura: NUESTRA }), anuncio({ id: 2, medio: 'imagen' }), anuncio({ id: 3, medio: null, miniatura: T39 })], competidores, AHORA);
  assert.deepEqual(xs.map((x) => x.medio), [null, 'imagen', 'imagen'], 'la tarjeta lleva el medio que SE SABE, null incluido');
  assert.equal(anunciosSinSaber(xs), 1);
  assert.equal(anunciosSinSaber([{ clase: 'carrusel', medio: null }]), 0, 'un carrusel sin medio no es un anuncio sin saber');

  // El filtro: por defecto se ven (sin dato no es «es video»); quien mira puede pedir sólo los que dicen su formato.
  const f = { ...FILTROS_INICIALES, que: 'anuncios' as const };
  assert.deepEqual(filtrarCarruseles(xs, f, new Set(), AHORA).map((x) => x.id).sort(), [1, 2, 3]);
  assert.deepEqual(filtrarCarruseles(xs, { ...f, soloConfirmados: true }, new Set(), AHORA).map((x) => x.id).sort(), [2, 3]);
  // Y viaja en el link, como todos los demás.
  assert.match(queryDeFiltros({ ...f, soloConfirmados: true }), /(^|&)conf=1(&|$)/);
  assert.equal(queryDeFiltros(f).includes('conf='), false);
  assert.equal(filtrosDeQuery(new URLSearchParams('que=anuncios&conf=1')).soloConfirmados, true);
  assert.equal(filtrosDeQuery(new URLSearchParams('que=anuncios')).soloConfirmados, false);
});

test('los filtros: carruseles y anuncios no se mezclan; los anuncios se ordenan por días al aire', () => {
  const carr = carruselesDe([{ id: 1, competidor_id: 7, canal: 'instagram', tipo: 'publicacion', url: null, texto: 'x', vistas: null, megusta: 9, comentarios: 1, publicada_en: dia(3), visto_primera_vez: dia(3), dejo_de_verse_en: null, miniatura: null, medio: 'carrusel', laminas: 5 } as PiezaParaCarrusel], competidores, AHORA);
  const ans = anunciosDe([anuncio({ id: 200, publicada_en: dia(5) }), anuncio({ id: 201, publicada_en: dia(80) }), anuncio({ id: 202, publicada_en: null })], competidores, AHORA);
  const todos = [...carr, ...ans];
  assert.deepEqual(filtrarCarruseles(todos, FILTROS_INICIALES, new Set(), AHORA).map((x) => x.id), [1], 'por defecto, sólo carruseles');
  assert.deepEqual(filtrarCarruseles(todos, { ...FILTROS_INICIALES, que: 'anuncios' }, new Set(), AHORA).map((x) => x.id), [201, 200, 202],
    'el que más lleva al aire primero; el que no se sabe, al final');
});

test('el CTA queda en la tarjeta, y ya no hay filtro que deje afuera al que no lo pide (6/11/2026)', () => {
  const xs = carruselesDe([
    { id: 1, competidor_id: 7, canal: 'instagram', tipo: 'publicacion', url: null, texto: '5 tips. Comenta GUÍA y te la mando', vistas: null, megusta: 1, comentarios: 1, publicada_en: dia(3), visto_primera_vez: dia(3), dejo_de_verse_en: null, miniatura: null, medio: 'carrusel', laminas: 5 },
    { id: 2, competidor_id: 7, canal: 'instagram', tipo: 'publicacion', url: null, texto: 'Comenta tu opinión', vistas: null, megusta: 1, comentarios: 1, publicada_en: dia(3), visto_primera_vez: dia(3), dejo_de_verse_en: null, miniatura: null, medio: 'carrusel', laminas: 5 },
  ] as PiezaParaCarrusel[], competidores, AHORA);
  assert.equal(xs[0].cta?.palabra, 'GUÍA');
  assert.equal(xs[1].cta, null);
  // Martín: «elimina el filtro de "CTA" porque todos le van a servir a dueños… hay algunos que sí sirven, reflexiones».
  assert.deepEqual(filtrarCarruseles(xs, FILTROS_INICIALES, new Set(), AHORA).map((x) => x.id).sort(), [1, 2]);
  assert.equal('cta' in FILTROS_INICIALES, false, 'el filtro CTA se fue');
});

test('las láminas de la tarjeta: sólo https, sin repetidas, y sin ellas la portada sola', () => {
  assert.deepEqual(imagenesValidas(['https://a/1.jpg', 'http://a/2.jpg', 'https://a/1.jpg', 7, 'https://a/3.jpg']), ['https://a/1.jpg', 'https://a/3.jpg']);
  assert.deepEqual(imagenesValidas('no'), []);
  assert.deepEqual(imagenesDe({ laminasImagenes: [], miniatura: 'https://a/p.jpg' }), ['https://a/p.jpg']);
  assert.deepEqual(imagenesDe({ laminasImagenes: ['https://a/1.jpg', 'https://a/2.jpg'], miniatura: 'https://a/p.jpg' }), ['https://a/1.jpg', 'https://a/2.jpg']);
  assert.deepEqual(imagenesDe({ miniatura: null }), []);
  // Lo que manda el actor de Apify: `childPosts` con su `displayUrl` o, si no vino, `images`.
  assert.deepEqual(imagenesDeLaminas([{ displayUrl: 'https://cdn/1.jpg' }, { displayUrl: 'https://cdn/2.jpg' }, {}], ['https://cdn/x.jpg']), ['https://cdn/1.jpg', 'https://cdn/2.jpg']);
  assert.deepEqual(imagenesDeLaminas(null, ['https://cdn/x.jpg', 'https://cdn/y.jpg']), ['https://cdn/x.jpg', 'https://cdn/y.jpg']);
});

test('la biblioteca: las láminas y el CTA guardados (0404) llegan a la tarjeta; al leer, se calculan; al reclasificar, se llenan', () => {
  const cuentas: CuentaBiblioteca[] = [{ id: 3, instagram: 'ana.ventas', nombre: 'Ana', fuente: 'lista', referente: null, estado: 'activa', motivo: null, foto: null, leida_en: null }];
  const pieza: PiezaBiblioteca = {
    id: 9, ref: 'ABC', cuenta_id: 3, tema_id: null, url: 'https://www.instagram.com/p/ABC/', miniatura: 'https://x/p.jpg', texto: null, formato: null, cierre: null,
    medio: 'carrusel', laminas: 3, megusta: 10, comentarios: 2, vistas: null, publicada_en: dia(10), visto_primera_vez: dia(10), dejo_de_verse_en: null,
    laminas_imagenes: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'], cta: 'PLAN', cta_via: 'comentario',
  };
  const [c] = carruselesDeBiblioteca([pieza], cuentas, AHORA);
  assert.deepEqual(c.laminasImagenes, pieza.laminas_imagenes);
  assert.deepEqual(c.cta, { palabra: 'PLAN', via: 'comentario' }, 'el guardado gana: el texto ya venció');
  const [fila] = filasDeLectura([{
    ref: 'XYZ', fecha: '2026-11-01', tipo: 'Sidecar', formato: 'FEED', audio: null, texto: '7 ideas. Comenta IDEAS y te mando el resto', permalink: 'https://www.instagram.com/p/XYZ/',
    miniatura: 'https://cdn/p.jpg', vistas: null, megusta: 5, comentarios: 1, laminas: 2, imagenes: ['https://cdn/1.jpg', 'https://cdn/2.jpg'], creador: 'ana.ventas',
  }], { tema: null });
  assert.equal(fila.cta, 'IDEAS');
  assert.equal(fila.cta_via, 'comentario');
  assert.deepEqual(fila.laminas_imagenes, ['https://cdn/1.jpg', 'https://cdn/2.jpg']);
  assert.deepEqual(reclasificacion({ texto: 'Comment "AI" below', formato: 'lista', cierre: 'comentar', parece_contenido: true, cta: null }), { cta: 'AI', cta_via: 'comentario' });
  assert.equal(reclasificacion({ texto: 'Comment "AI" below', formato: 'lista', cierre: 'comentar', parece_contenido: true }), null, 'sin la columna (0404 sin aplicar), no se pide');
});

test('un Anuncios recién abierto no tiene filtros que quitar, y «Quitar filtros» lo deja ordenado por días al aire', () => {
  const anuncios = filtrosInicialesDe('anuncios');
  assert.equal(anuncios.orden, 'aire', 'los anuncios arrancan por días al aire, como al entrar con la pestaña');
  assert.equal(sinFiltrosDe(anuncios), true, 'recién abierto: ni «Quitar filtros» ni «Guardar búsqueda»');
  assert.equal(sinFiltrosDe({ ...anuncios, orden: 'outlier' }), false, 'cambiar el orden sí es un filtro');
  assert.equal(sinFiltrosDe({ ...anuncios, q: 'nike' }), false);
  assert.equal(sinFiltrosDe(FILTROS_INICIALES), true, 'Carruseles, igual que siempre');
  assert.equal(sinFiltrosDe({ ...FILTROS_INICIALES, orden: 'aire' }), false);
  assert.equal(sinFiltrosDe({ ...FILTROS_INICIALES, vista: 'guardados' }), false, 'Guardados es una vista: la barra ofrece salir');
});
