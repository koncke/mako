// =============================================================================
// Los videos que MaKo ya generó, como creativos del Ads Manager (tarea #797)
// =============================================================================
// lib/creativo-mako.ts decide QUÉ se ofrece y QUÉ se acepta: la url de un video no se
// valida contra un prefijo, se DERIVA de datos del workspace (el id del montaje, el plan,
// la toma) con la misma ruta que la escribió, y lo guardado tiene que ser exactamente eso.
// El bucket es público y su ruta no lleva el workspace: un prefijo aceptaría el video de
// otro cliente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creativosDeMontajes, creativosDeTomas, leerRefCreativo, refDeCreativo, mismoOrigen, tomaPedida,
  rutaDelMontado, rutaDeToma, type FilaMontajeListo, type PlanConTomas,
} from '../lib/creativo-mako';

const BASE = 'https://abc123.supabase.co';
// La forma de getPublicUrl de supabase-js (medida: /storage/v1/object/public/<bucket>/<ruta>).
const urlDe = (ruta: string) => `${BASE}/storage/v1/object/public/video-clips/${ruta}`;
const PLAN_A = '93fa2a31-60b2-4f91-a063-39afaa512848';
const PLAN_B = 'b4b439da-2572-40a1-b7f3-9b8368f0fa36';
const OP = '237eda5c-9ce7-4d9b-9006-6c78d4ae39d0';

const fila = (o: Partial<FilaMontajeListo> & { id: number; plan_id: string }): FilaMontajeListo => ({
  url: urlDe(rutaDelMontado(o.plan_id, o.id)), titulo: 'Anuncio A', listo_at: '2026-10-01T10:00:00Z', ...o,
});

test('montajes: sólo los que dejaron el archivo EXACTAMENTE donde el server dijo', () => {
  const filas: FilaMontajeListo[] = [
    fila({ id: 10, plan_id: PLAN_A }),
    // La url de una TOMA del mismo plan, en el mismo bucket: un prefijo la aceptaría.
    fila({ id: 11, plan_id: PLAN_B, url: urlDe(rutaDeToma(PLAN_B, 1, OP)) }),
    // La url del montado de OTRO plan (un worker que reportó lo que no era).
    fila({ id: 12, plan_id: PLAN_B, url: urlDe(rutaDelMontado(PLAN_A, 10)) }),
    // Un 'listo' sin url no es un listo.
    fila({ id: 13, plan_id: PLAN_B, url: '' }),
    fila({ id: 14, plan_id: PLAN_B, url: null }),
    // Otro host con la misma ruta.
    fila({ id: 15, plan_id: PLAN_B, url: `https://otro.tld/storage/v1/object/public/video-clips/${rutaDelMontado(PLAN_B, 15)}` }),
    // Un plan con forma de ruta.
    fila({ id: 16, plan_id: '../x' }),
  ];
  const out = creativosDeMontajes(filas, urlDe);
  assert.deepEqual(out.map((c) => c.ref), ['montaje:10']);
  assert.equal(out[0].origen, 'montaje');
  assert.equal(out[0].toma, null);
  assert.equal(out[0].media_type, 'video');
  assert.equal(out[0].url, urlDe(`video-generator/${PLAN_A}/montado-10.mp4`), 'la misma ruta que el worker');
});

test('montajes: uno por anuncio (el último montaje) y el más nuevo primero', () => {
  const out = creativosDeMontajes([
    fila({ id: 3, plan_id: PLAN_A, listo_at: '2026-09-01T00:00:00Z', titulo: 'Viejo' }),
    fila({ id: 7, plan_id: PLAN_A, listo_at: '2026-09-02T00:00:00Z', titulo: 'Nuevo' }),
    fila({ id: 5, plan_id: PLAN_B, listo_at: '2026-10-05T00:00:00Z', titulo: 'Otro', }),
  ], urlDe);
  assert.deepEqual(out.map((c) => c.ref), ['montaje:5', 'montaje:7']);
  assert.equal(out[1].titulo, 'Nuevo');
  // El id llega como string desde algunos drivers: se acepta, sin cambiar el resultado.
  assert.deepEqual(creativosDeMontajes([fila({ id: 7, plan_id: PLAN_A }), { ...fila({ id: 7, plan_id: PLAN_A }), id: '7' }], urlDe).map((c) => c.ref), ['montaje:7']);
});

const plan = (o: Partial<PlanConTomas> & { id: string }): PlanConTomas => ({ at: '2026-09-01T00:00:00Z', plan: { titulo: 'El anuncio' }, video: {}, ...o });

test('tomas: la url se arma con la operación de la marca y tiene que coincidir', () => {
  const p = plan({
    id: PLAN_A,
    video: {
      '2': { url: urlDe(rutaDeToma(PLAN_A, 2, OP)), mediaId: OP },
      // Las viejas tienen sólo `operacion`.
      '1': { url: urlDe(rutaDeToma(PLAN_A, 1, 'op-1')), operacion: 'op-1' },
      // El enlace firmado de Google que estadoTomaAction guardaba tal cual: vence.
      '3': { url: 'https://storage.googleapis.com/x/y.mp4?sig=1', mediaId: OP },
      // La toma 4 del plan A apuntando al archivo del plan B.
      '4': { url: urlDe(rutaDeToma(PLAN_B, 4, OP)), mediaId: OP },
      // Una toma con la url de OTRA toma del mismo plan.
      '5': { url: urlDe(rutaDeToma(PLAN_A, 2, OP)), mediaId: OP },
      // Sin operación no hay ruta que armar.
      '6': { url: urlDe(rutaDeToma(PLAN_A, 6, OP)) },
      // Una operación con barra no arma ruta.
      '7': { url: urlDe(rutaDeToma(PLAN_A, 7, 'a/../b')), mediaId: 'a/../b' },
      // Sin url: no está filmada.
      '8': { mediaId: OP },
      'x': { url: urlDe(rutaDeToma(PLAN_A, 9, OP)), mediaId: OP },
      // Volviéndose a filmar: `operacion` ya es la nueva y url/mediaId siguen siendo del
      // clip anterior. La ref nombra el que ARMA la url, no el primero de la lista.
      '9': { url: urlDe(rutaDeToma(PLAN_A, 9, OP)), mediaId: OP, operacion: 'op-nueva' },
      // Y al revés: un mediaId con forma válida que no arma la url.
      '10': { url: urlDe(rutaDeToma(PLAN_A, 10, 'op-10')), mediaId: 'otro-id', operacion: 'op-10' },
    },
  });
  const out = creativosDeTomas([p], urlDe);
  assert.deepEqual(out.map((c) => c.ref), [
    `toma:${PLAN_A}:1:op-1`, `toma:${PLAN_A}:2:${OP}`, `toma:${PLAN_A}:9:${OP}`, `toma:${PLAN_A}:10:op-10`,
  ], 'en orden de toma, y cada ref con el clip que se ve');
  assert.deepEqual(out.map((c) => c.toma), [1, 2, 9, 10]);
  assert.equal(out[0].titulo, 'El anuncio');
});

test('tomas: el anuncio más nuevo primero, y el título cae al pedido', () => {
  const out = creativosDeTomas([
    plan({ id: PLAN_A, at: '2026-08-01T00:00:00Z', video: { '1': { url: urlDe(rutaDeToma(PLAN_A, 1, OP)), mediaId: OP } } }),
    plan({ id: PLAN_B, at: '2026-09-01T00:00:00Z', plan: {}, pedido: 'Tema pedido', video: { '1': { url: urlDe(rutaDeToma(PLAN_B, 1, OP)), mediaId: OP } } }),
    plan({ id: 'no válido', video: { '1': { url: urlDe(rutaDeToma('no válido', 1, OP)), mediaId: OP } } }),
  ], urlDe);
  assert.deepEqual(out.map((c) => c.plan_id), [PLAN_B, PLAN_A]);
  assert.equal(out[0].titulo, 'Tema pedido');
});

test('la referencia: lo único que vuelve del navegador, con forma cerrada', () => {
  assert.deepEqual(leerRefCreativo('montaje:42'), { origen: 'montaje', id: 42 });
  assert.deepEqual(leerRefCreativo(`toma:${PLAN_A}:3:${OP}`), { origen: 'toma', plan_id: PLAN_A, toma: 3, op: OP });
  for (const malo of [
    'montaje:0', 'montaje:-1', 'montaje:4x', `toma:${PLAN_A}:0:${OP}`, `toma:${PLAN_A}:1000:${OP}`, `toma:../x:1:${OP}`, `toma:a/b:1:${OP}`,
    // La forma vieja, sin el clip: es la que dejaba subir otro video que el que se vio.
    `toma:${PLAN_A}:3`,
    // Un clip con forma de ruta, vacío, con otro separador o más largo que una operación.
    `toma:${PLAN_A}:3:`, `toma:${PLAN_A}:3:a/../b`, `toma:${PLAN_A}:3:a.b`, `toma:${PLAN_A}:3:${OP}:x`, `toma:${PLAN_A}:3:${'x'.repeat(129)}`,
    `https://abc123.supabase.co/storage/v1/object/public/video-clips/${rutaDelMontado(PLAN_A, 1)}`,
    42, null, undefined, { origen: 'montaje', id: 1 }, '',
  ]) assert.equal(leerRefCreativo(malo), null, `aceptó ${JSON.stringify(malo)}`);
  // Ida y vuelta, incluida la toma más larga que se puede ofrecer (202 caracteres).
  for (const r of [
    { origen: 'montaje' as const, id: 9 },
    { origen: 'toma' as const, plan_id: PLAN_B, toma: 12, op: OP },
    { origen: 'toma' as const, plan_id: 'a'.repeat(64), toma: 999, op: 'b'.repeat(128) },
  ]) {
    assert.deepEqual(leerRefCreativo(refDeCreativo(r)), r);
  }
});

/** La ref que viaja, leída como la lee el server. */
function refToma(s: string) {
  const r = leerRefCreativo(s);
  if (!r || r.origen !== 'toma') throw new Error(`no es la ref de una toma: ${s}`);
  return r;
}

test('tomaPedida: sube el clip que se MOSTRÓ, nunca el que la toma guarde al hacer clic', () => {
  const OP_B = '5d0c3a8e-1f2b-4c6d-9e7f-0a1b2c3d4e5f';
  const tomaCon = (op: string, operacion = op) => plan({ id: PLAN_A, video: { '3': { url: urlDe(rutaDeToma(PLAN_A, 3, op)), mediaId: op, operacion } } });

  // Se abre «Mis creativos»: la lista trae la toma 3 con el clip A, y su ref nombra A.
  const [mostrada] = creativosDeTomas([tomaCon(OP)], urlDe);
  const ref = refToma(mostrada.ref);
  const hoy = (p: PlanConTomas) => tomaPedida(creativosDeTomas([p], urlDe), ref);

  // Nadie la tocó: resuelve al mismo archivo que se vio.
  const igual = hoy(tomaCon(OP));
  assert.ok(igual && igual !== 'cambio');
  assert.equal(igual.url, mostrada.url);

  // Mientras /video-generator la vuelve a filmar, lo guardado sigue siendo A.
  const filmando = hoy(tomaCon(OP, OP_B));
  assert.ok(filmando && filmando !== 'cambio');
  assert.equal(filmando.url, mostrada.url);

  // Se volvió a filmar (guardarClip sube toma-3-<B>.mp4 y guardarMarca mueve video['3']):
  // la ref de A NO sube B.
  assert.equal(hoy(tomaCon(OP_B)), 'cambio');

  // Con la lista pedida de nuevo, la ref nueva sí, y es B.
  const [nueva] = creativosDeTomas([tomaCon(OP_B)], urlDe);
  const deB = tomaPedida(creativosDeTomas([tomaCon(OP_B)], urlDe), refToma(nueva.ref));
  assert.ok(deB && deB !== 'cambio');
  assert.equal(deB.url, urlDe(rutaDeToma(PLAN_A, 3, OP_B)));

  // La toma que ya no se ofrece no es un «cambio»: no está (404, no 409).
  assert.equal(hoy(plan({ id: PLAN_A, video: {} })), null);
  assert.equal(hoy(plan({ id: PLAN_A, video: { '4': { url: urlDe(rutaDeToma(PLAN_A, 4, OP)), mediaId: OP } } })), null, 'otra toma del plan no la reemplaza');
});

test('mismoOrigen: con new URL, y los cuatro parecidos que un prefijo deja pasar', () => {
  assert.equal(mismoOrigen(urlDe('video-generator/x/montado-1.mp4'), BASE), true);
  assert.equal(mismoOrigen(urlDe('a.mp4'), `${BASE}/`), true, 'la barra final de la base no cambia el origen');
  for (const parecido of [
    'https://abc123.supabase.co.evil.tld/storage/v1/object/public/video-clips/a.mp4',
    'https://abc123.supabase.co@evil.tld/storage/v1/object/public/video-clips/a.mp4',
    'https://abc123.supabase.coevil.tld/a.mp4',
    'https://abc123.supabase.co:8443/a.mp4',
    'http://abc123.supabase.co/a.mp4',
    'https://user:pass@abc123.supabase.co/a.mp4',
    'no es una url',
  ]) assert.equal(mismoOrigen(parecido, BASE), false, parecido);
  assert.equal(mismoOrigen(urlDe('a.mp4'), undefined), false, 'sin base configurada no se acepta nada');
});

test('subidoDeRespuesta: el processing es lo que dijo el server, y sólo un video con id espera', async () => {
  const { subidoDeRespuesta } = await import('../app/ads-manager/creativeUpload');
  const v = subidoDeRespuesta({ ok: true, media_type: 'video', video_id: '123', thumbnail_url: null, processing: true, video_status: 'processing', path: null }, null);
  assert.equal(v.processing, true);
  assert.equal(v.path, null, 'un video de MaKo no tiene staging');
  assert.equal(v.thumbnail_url, null);
  assert.equal(subidoDeRespuesta({ media_type: 'video', video_id: null, processing: true }, null).processing, false, 'sin video_id no hay a quién esperar');
  assert.equal(subidoDeRespuesta({ media_type: 'image', image_hash: 'h', processing: true }, null).processing, false);
  assert.equal(subidoDeRespuesta({ media_type: 'video', video_id: '1', processing: false }, 'nueva/x.mp4').path, 'nueva/x.mp4', 'el staging de la subida sigue llegando');
});

test('usarCreativoMako manda SÓLO la referencia; listarCreativosMako no convierte un fallo en lista vacía', async () => {
  const { usarCreativoMako, listarCreativosMako } = await import('../app/ads-manager/creativeUpload');
  const original = globalThis.fetch;
  const enviados: Array<{ url: string; body: unknown }> = [];
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      enviados.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return { json: async () => ({ ok: true, media_type: 'video', video_id: '77', thumbnail_url: null, processing: true, video_status: 'processing', path: null }) } as unknown as Response;
    }) as typeof fetch;
    const r = await usarCreativoMako(`toma:${PLAN_A}:2:${OP}`);
    assert.equal(r.video_id, '77');
    assert.equal(r.processing, true);
    assert.equal(enviados[0].url, '/api/ads-manager/creative-upload');
    assert.deepEqual(enviados[0].body, { mako: `toma:${PLAN_A}:2:${OP}` }, 'ni url, ni file_url, ni path');

    globalThis.fetch = (async () => ({ json: async () => ({ ok: false, error: 'No pude leer tus videos de MaKo. Vuelve a intentar.' }) }) as unknown as Response) as typeof fetch;
    await assert.rejects(listarCreativosMako(), /No pude leer tus videos de MaKo/);
    globalThis.fetch = (async () => ({ json: async () => { throw new Error('html'); } }) as unknown as Response) as typeof fetch;
    await assert.rejects(listarCreativosMako(), /No pude leer/);
    globalThis.fetch = (async () => ({ json: async () => ({ ok: true, montados: [], tomas: [] }) }) as unknown as Response) as typeof fetch;
    assert.deepEqual(await listarCreativosMako(), { montados: [], tomas: [] });
  } finally {
    globalThis.fetch = original;
  }
});

//   ROTO A PROPÓSITO (07/10/2026), de a una y restaurando de memoria; cada una da
//   pass 7 / fail 1 en este archivo (que entonces tenía 8), y el que cae es el que la nombra:
//   · creativosDeMontajes sin el `url !== urlDe(...)` → «sólo los que dejaron…»;
//   · creativosDeTomas con `url.includes('/storage/v1/object/public/video-clips/')` (un
//     prefijo, la regla vieja de urlEsPropia) → «la url se arma con la operación…»;
//   · mismoOrigen con `url.startsWith(base)` → «los cuatro parecidos»;
//   · usarCreativoMako mandando también una url → «manda SÓLO la referencia»;
//   · la ref de toma aceptando cualquier plan (`[^:]`) → «la referencia…».
//   Y las de la revisión (07/10/2026, la ref de la toma con el clip), con 9 tests:
//   · tomaPedida devolviendo la toma de hoy sin comparar la ref → pass 8 / fail 1,
//     «tomaPedida: sube el clip que se MOSTRÓ…» (es el bug de la revisión);
//   · refDeCreativo sin el `:${r.op}` → pass 6 / fail 3 («tomas: la url se arma…», «la
//     referencia…» y «tomaPedida…»);
//   · el tope de largo de vuelta en 200 → pass 8 / fail 1, «la referencia…» (la toma más
//     larga posible mide 202);
//   · la primera op con forma en vez de la que ARMA la url → pass 8 / fail 1, «tomas: la
//     url se arma…» (la toma 10, con un mediaId que no es su archivo).
