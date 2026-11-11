// «Traer tu outlier» de YouTube: la miniatura que un negocio trae por su link la ve SÓLO ese negocio (11/11/2026, mig 0414).
//
// Martín, 11/11/2026: traer un outlier propio pegando el link «de Instagram, YouTube o la biblioteca de anuncios de Meta». Lo de
// YouTube vive en las tablas de la biblioteca de miniaturas con `workspace_id` (lib/thumbnails/traer-servidor.ts). La tabla es
// global, así que quién ve qué lo decide una regla pura (`seVeThumbnail`) que corre DENTRO de `thumbnailsDe`, que usan la
// grilla, el «Editar» y la API de MaKo (lib/thumbnails/servidor.ts). Esto la corre y fija:
//   1. `videoDeYoutube` lee los links que se pegan de verdad (watch, youtu.be, m., con más parámetros, live), marca un Short, y
//      no confunde un canal ni un id suelto con un video;
//   2. lo traído lo ve SÓLO su negocio, y nunca otro ni quien no dice qué negocio es (un script);
//   3. `thumbnailsDe` saca lo de otro negocio ANTES de calcular nada y marca lo propio como `traida`;
//   4. el link pegado en el buscador encuentra ESE video (si ya está, no hace falta traerlo);
//   5. `traidaPor` es UNA para las dos bibliotecas: la de carruseles la sigue exportando igual.
//
// Verificado rompiéndolo (11/11/2026, base 5/0): `seVeThumbnail` mostrando lo traído a cualquier negocio → cae 2 y 3;
// `thumbnailsDe` sin el filtro del negocio → cae 3; `coincideThumbnail` sin mirar el link → cae 4.
//
// Correr: node --import tsx --test tests/thumbnails-traidas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coincideThumbnail, seVeThumbnail, thumbnailsDe, videoDeYoutube, type FilaCanal, type FilaVideo } from '../lib/thumbnails/explorar';
import { traidaPor } from '../lib/traida-por';
import { traidaPor as desdeLaBiblioteca } from '../lib/carruseles/biblioteca';

const ID = 'dQw4w9WgXcQ';

test('1 · `videoDeYoutube` lee los links que se pegan de verdad, y marca un Short', () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `https://m.youtube.com/watch?feature=share&v=${ID}&t=10`,
    `youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `mira esto: https://youtu.be/${ID}`,
  ]) assert.deepEqual(videoDeYoutube(link), { video: ID, corto: false }, link);
  assert.deepEqual(videoDeYoutube(`https://youtube.com/shorts/${ID}`), { video: ID, corto: true }, 'un Short se reconoce para decirlo');
  assert.equal(videoDeYoutube('https://www.youtube.com/@alexhormozi'), null, 'un canal no es un video');
  assert.equal(videoDeYoutube(ID), null, 'un id suelto no es un link (podría ser una búsqueda)');
  assert.equal(videoDeYoutube('cómo vender por WhatsApp'), null);
  assert.equal(videoDeYoutube(`https://www.youtube.com/watch?v=${ID}xx`), null, 'un id de 13 caracteres no es un video');
});

test('2 · lo traído lo ve SÓLO su negocio, y nunca otro ni quien no dice qué negocio es', () => {
  assert.equal(seVeThumbnail({}, 3), true, 'sin la columna (la 0414 sin aplicar): de la plataforma, como siempre');
  assert.equal(seVeThumbnail({ workspace_id: null }, null), true, 'lo de la plataforma lo ve hasta un script');
  assert.equal(seVeThumbnail({ workspace_id: 3 }, 3), true);
  assert.equal(seVeThumbnail({ workspace_id: '3' }, 3), true, 'el bigint de la base llega como texto');
  assert.equal(seVeThumbnail({ workspace_id: 3 }, 5), false, 'otro negocio NO la ve');
  assert.equal(seVeThumbnail({ workspace_id: 3 }, null), false, 'sin saber quién mira, no se muestra');
});

const ahora = Date.parse('2026-11-11T12:00:00Z');
const hoy = new Date(ahora - 3_600_000).toISOString();
const canal: FilaCanal = { id: 1, canal_id: 'UC' + 'x'.repeat(22), nombre: 'Un canal', handle: '@uncanal', foto: null, nicho: null, idioma: null, estado: 'activo' };
const video = (id: number, video_id: string, workspace_id: number | null): FilaVideo => ({
  id, video_id, canal_id: 1, titulo: `Video ${id}`, publicado_en: hoy, duracion: 'PT12M', vistas: 1000 * id, megusta: 1, comentarios: 1, leido_en: hoy, workspace_id,
});

test('3 · `thumbnailsDe` saca lo de otro negocio y marca lo propio como traído', () => {
  const filas = [video(1, 'aaaaaaaaaaa', null), video(2, 'bbbbbbbbbbb', 3), video(3, 'ccccccccccc', 5)];
  const de3 = thumbnailsDe(filas, [canal], ahora, 3);
  assert.deepEqual(de3.map((t) => t.id).sort(), [1, 2], 'el 3 ve lo de la plataforma y lo suyo, no lo del 5');
  assert.equal(de3.find((t) => t.id === 2)?.traida, true, 'lo suyo va marcado');
  assert.equal(de3.find((t) => t.id === 1)?.traida, undefined, 'lo de la plataforma, no');
  assert.deepEqual(thumbnailsDe(filas, [canal], ahora).map((t) => t.id), [1], 'sin decir quién mira: sólo la plataforma');
  assert.deepEqual(thumbnailsDe(filas, [canal], ahora, 5).map((t) => t.id).sort(), [1, 3]);
  // Un canal con el rubro y el idioma vacíos (el que entró por un link: no se saben y no se inventan) se dibuja igual.
  assert.equal(de3[0].nicho, null);
});

test('4 · el link pegado en el buscador encuentra ESE video', () => {
  const [t] = thumbnailsDe([video(1, ID, null)], [canal], ahora, 3);
  assert.equal(coincideThumbnail(t, `https://youtu.be/${ID}?si=x`), true);
  assert.equal(coincideThumbnail(t, 'https://youtu.be/zzzzzzzzzzz'), false, 'otro link no la encuentra: queda el botón de traer');
  assert.equal(coincideThumbnail(t, 'video 1'), true, 'la búsqueda por texto sigue igual');
});

test('5 · `traidaPor` es una sola para las dos bibliotecas', () => {
  assert.equal(desdeLaBiblioteca, traidaPor);
  for (const raro of [null, undefined, '', 0, -1, 'abc', 1.5]) assert.equal(traidaPor({ workspace_id: raro }), null, `«${String(raro)}» no es un negocio`);
  assert.equal(traidaPor({ workspace_id: '12' }), 12);
});
