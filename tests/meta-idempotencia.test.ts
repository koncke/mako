// =============================================================================
// Un reintento no publica dos veces (tarea #59)
// =============================================================================
// lib/meta-idempotencia.ts tiene DOS reglas, no una, y el test las fija por separado: la
// misma fila significa cosas distintas según la escribió campaign-create (su campaña, con
// rollback) o un lote de ad-add/adset-add (la campaña que ya existía, sin rollback). Con
// la regla de la campaña, un lote que falló sin crear nada quedaba «a medias» para siempre.
//
// Y la clave: misma clave para el mismo payload, otra para uno distinto. Con la misma
// clave después de un parcial conocido, el cliente recortaría anuncios que nunca se crearon.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  abrirRegistro, claveAMandar, claveIdemDe, claveIdemGuardada, claveParaPayload, decidirReintentoCampana, decidirReintentoLote,
  ESPERA_CREANDO_MS, faltaColumnaIdem, salidaEsperar, trasRespuesta, type Decision, type FilaPublicacion, type Salida,
} from '../lib/meta-idempotencia';

const AHORA = Date.parse('2026-10-07T20:00:00Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const fila = (p: Partial<FilaPublicacion> = {}): FilaPublicacion => ({
  id: 7, status: 'error', updated_at: hace(60_000), error: null, meta_campaign_id: null,
  meta_adset_ids: [], meta_ad_ids: [], meta_creative_ids: [], ...p,
});

// ── la regla de la CAMPAÑA ──────────────────────────────────────────────────

test('campaña: publicada se devuelve, en curso se espera, muerta en el medio queda a medias', () => {
  assert.deepEqual(decidirReintentoCampana(fila({ status: 'publicada', meta_campaign_id: '1' }), AHORA), { tipo: 'devolver' });
  assert.deepEqual(decidirReintentoCampana(fila({ status: 'creando', updated_at: hace(30_000) }), AHORA), { tipo: 'esperar' });
  // Más de 6 minutos sin tocarse con maxDuration 300: ese pedido ya no existe.
  assert.deepEqual(decidirReintentoCampana(fila({ status: 'creando', updated_at: hace(ESPERA_CREANDO_MS + 1000), meta_campaign_id: '1', meta_ad_ids: ['a'] }), AHORA), { tipo: 'a-medias', creados: 1 });
});

test('campaña: un error SIN revertir no se reintenta; revertido, o sin crear nada, sí', () => {
  // Quedó una campaña en Meta: crear otra es duplicarla.
  assert.equal(decidirReintentoCampana(fila({ meta_campaign_id: '123', error: 'Meta rechazó el anuncio' }), AHORA).tipo, 'a-medias');
  assert.equal(decidirReintentoCampana(fila({ meta_campaign_id: '123', error: 'Meta rechazó el anuncio (revertido)' }), AHORA).tipo, 'reintentar');
  assert.equal(decidirReintentoCampana(fila({ meta_campaign_id: null, error: 'Permisos' }), AHORA).tipo, 'reintentar');
  //   ROTO A PROPÓSITO (07/10/2026): con `case 'error': return { tipo: 'reintentar' }` (sin
  //   mirar el revertido), pass 11 / fail 2 — éste y el del lote (que compara contra
  //   la regla de la campaña): el error sin revertir se reintentaba.
});

// ── la regla del LOTE ───────────────────────────────────────────────────────

test('lote: en error con 0 creados se reintenta, AUNQUE la fila traiga la campaña', () => {
  // ad-add escribe al insertar el meta_campaign_id de la campaña que YA existía, y su error
  // termina en «(creados N/M)», nunca en «(revertido)». Con la regla de la campaña, esta
  // fila quedaba a medias para siempre.
  const f = fila({ meta_campaign_id: '999', meta_adset_ids: ['55'], error: 'Meta rechazó (creados 0/3)' });
  assert.equal(decidirReintentoLote(f, AHORA).tipo, 'reintentar');
  assert.equal(decidirReintentoCampana(f, AHORA).tipo, 'a-medias', 'la regla de la campaña sobre la misma fila');
  //   ROTO A PROPÓSITO (07/10/2026): con decidirReintentoLote = decidirReintentoCampana,
  //   pass 11 / fail 2 — éste y el de abajo.
});

test('lote: con creados se queda a medias y dice cuántos; publicado se devuelve', () => {
  assert.deepEqual(decidirReintentoLote(fila({ meta_campaign_id: '999', meta_ad_ids: ['a', 'b'], error: 'x (creados 2/5)' }), AHORA), { tipo: 'a-medias', creados: 2 });
  assert.deepEqual(decidirReintentoLote(fila({ status: 'publicada', meta_ad_ids: ['a'] }), AHORA), { tipo: 'devolver' });
  assert.deepEqual(decidirReintentoLote(fila({ status: 'creando', updated_at: hace(10_000) }), AHORA), { tipo: 'esperar' });
  // adset-add cuenta CONJUNTOS: el conjunto existe en Meta aunque no tenga anuncios.
  assert.deepEqual(decidirReintentoLote(fila({ meta_adset_ids: ['77'] }), AHORA, 'meta_adset_ids'), { tipo: 'a-medias', creados: 1 });
  assert.deepEqual(decidirReintentoLote(fila({ meta_adset_ids: [] }), AHORA, 'meta_adset_ids'), { tipo: 'reintentar' });
});

// ── la clave ────────────────────────────────────────────────────────────────

test('la clave: misma para el mismo payload, OTRA cuando el payload cambia', () => {
  let n = 0;
  const nueva = () => `clave-${++n}-xxxxxxxx`;
  const lote = { adset_id: '1', ads: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] };
  const k1 = claveParaPayload(null, lote, nueva);
  // Un reintento ciego (504) manda lo mismo: la misma clave, el server deduplica.
  assert.equal(claveParaPayload(k1, { adset_id: '1', ads: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }, nueva).clave, k1.clave);
  // Después de un parcial conocido el cliente RECORTA: es otra publicación.
  const k2 = claveParaPayload(k1, { adset_id: '1', ads: lote.ads.slice(2) }, nueva);
  assert.notEqual(k2.clave, k1.clave, 'con la misma clave el server contestaría «creados 2» otra vez y se perderían anuncios');
  //   ROTO A PROPÓSITO (07/10/2026): devolviendo siempre `previa` si existe (sin comparar
  //   la firma), pass 12 / fail 1 — éste.
});

// ── la clave ABIERTA (revisión de la #59) ───────────────────────────────────
// El caso de la revisión: «Publicar», la plataforma corta a los 300 s con la campaña ya
// creada, la pantalla vuelve a «revisión» diciendo «Reintentar es seguro», la persona
// corrige una palabra del título y vuelve a publicar. Con la firma sola salía otra clave y
// el server creaba una SEGUNDA campaña.

test('una respuesta perdida deja la clave ABIERTA, y el próximo clic la manda aunque se haya editado', () => {
  let n = 0;
  const nueva = () => `clave-${++n}-xxxxxxxx`;
  const antes = { spec: { name: 'Campaña de prueba' } };
  const editado = { spec: { name: 'Campaña de prueba corregida' } };
  const p1 = claveAMandar(null, null, antes, nueva);
  const t1 = trasRespuesta(null, p1.mandada, p1.firma); // el 504
  assert.deepEqual(t1.abierta, p1.mandada);
  const p2 = claveAMandar(t1.abierta, t1.previa, editado, nueva);
  assert.equal(p2.mandada.clave, p1.mandada.clave, 'con la firma sola salía otra clave y el server creaba otra campaña');
  // El server contesta desde la fila: la de antes sí entró. No es el éxito de lo editado.
  const t2 = trasRespuesta({ ok: true, repetida: true }, p2.mandada, p2.firma);
  assert.equal(t2.deAntes, true);
  assert.equal(t2.abierta, null, 'el server ya contestó por esa clave');
  // Avisado eso, lo editado es otra publicación (otra clave), y lo de antes, la misma.
  assert.notEqual(claveAMandar(t2.abierta, t2.previa, editado, nueva).mandada.clave, p1.mandada.clave);
  assert.equal(claveAMandar(null, t2.previa, antes, nueva).mandada.clave, p1.mandada.clave);
  //   ROTO A PROPÓSITO (07/10/2026): con claveAMandar ignorando la abierta (siempre
  //   claveParaPayload), pass 15 / fail 3 — éste (el clic editado salía con otra clave), el
  //   de «publica lo NUEVO» y el del lote, que también mandan una abierta.
});

test('si antes no se creó nada, el server publica lo NUEVO con la clave abierta: eso sí es el éxito de esto', () => {
  const p = claveAMandar({ clave: 'clave-abierta-0001', firma: 'firma-de-antes' }, null, { spec: { name: 'X' } });
  assert.equal(p.mandada.clave, 'clave-abierta-0001');
  // 'nueva' o una fila en 'error' reclamada: el server crea con lo que llega ahora (sin `repetida`).
  const t = trasRespuesta({ ok: true }, p.mandada, p.firma);
  assert.deepEqual([t.deAntes, t.abierta], [false, null]);
});

test('lote: un «a medias» sobre la clave abierta habla del lote de ANTES y no se recorta; con el mismo lote, sí', () => {
  const abierta = { clave: 'clave-abierta-0002', firma: 'firma-del-lote-viejo' };
  const otro = claveAMandar(abierta, null, { adset_id: '1', ads: [{ name: 'nuevo' }] });
  assert.equal(trasRespuesta({ ok: false, estado: 'a-medias', created: 2 }, otro.mandada, otro.firma).deAntes, true,
    'recortar 2 de ESTE lote borraba anuncios que nunca se crearon');
  const mismo = claveAMandar(null, null, { adset_id: '1', ads: [{ name: 'a' }] });
  assert.equal(trasRespuesta({ ok: false, estado: 'a-medias', created: 2 }, mismo.mandada, mismo.firma).deAntes, false);
  // Un parcial FRESCO (sin estado: el server acaba de crear con este lote) es de éste, y cierra la clave.
  const parcial = { ok: false, error: 'Meta rechazó', created: 2 };
  const fresco = trasRespuesta(parcial, otro.mandada, otro.firma);
  assert.deepEqual([fresco.deAntes, fresco.abierta], [false, null]);
  //   ROTO A PROPÓSITO (07/10/2026): con `deAntes` sin comparar la firma (sólo repetida /
  //   a-medias), pass 17 / fail 1 — éste: el «a medias» del mismo lote dejaba de recortarse.
});

test('la clave sigue abierta con esperar, con un chequeo previo y con cualquier error que no cierre', () => {
  const p = claveAMandar(null, null, { spec: { name: 'X' } }, () => 'clave-fresca-0003');
  for (const j of [
    { ok: false, estado: 'esperar' },
    { ok: false, estado: 'videos', error: 'Un video sigue procesándose' }, // 409 ANTES de abrir el registro
    { ok: false, estado: 'sin-base' },                                      // 503: la base no contestó
    { ok: false, error: 'no autenticado' },                                 // 401 del guard
    { ok: false, error: 'Meta rechazó', created: 0 },                       // lote sin crear nada
  ]) {
    assert.deepEqual(trasRespuesta(j, p.mandada, p.firma).abierta, p.mandada, JSON.stringify(j));
  }
  //   ROTO A PROPÓSITO (07/10/2026): con `cerro = !!j` (cualquier respuesta cierra),
  //   pass 17 / fail 1 — éste: un 409 de videos soltaba la clave de un pedido perdido.
});

test('campaña: una fila publicada SIN campaña no se devuelve: queda a medias', () => {
  // El persist que anota la campaña traga su error; la respuesta repetida decía `campaign_id: null`.
  assert.equal(decidirReintentoCampana(fila({ status: 'publicada', meta_campaign_id: null, meta_ad_ids: ['a'] }), AHORA).tipo, 'a-medias');
  assert.equal(decidirReintentoCampana(fila({ status: 'publicada', meta_campaign_id: '9' }), AHORA).tipo, 'devolver');
  //   ROTO A PROPÓSITO (07/10/2026): con `case 'publicada': return { tipo: 'devolver' }`,
  //   pass 17 / fail 1 — éste.
});

test('la clave sobrevive al viaje por localStorage (los undefined se caen en las dos puntas)', () => {
  const spec = { name: 'X', adsets: [{ ads: [{ creative: { video_id: '1', image_hash: undefined } }] }] };
  const k = claveParaPayload(null, { spec }, () => 'clave-unica-1234');
  const vuelta = claveIdemGuardada(JSON.parse(JSON.stringify(k)));
  assert.deepEqual(vuelta, k);
  assert.equal(claveParaPayload(vuelta, JSON.parse(JSON.stringify({ spec })), () => 'otra-clave-5678').clave, 'clave-unica-1234');
  assert.equal(claveIdemGuardada({ clave: 'x', firma: 'f' }), null, 'una clave que el server rechazaría no se restaura');
  assert.equal(claveIdemGuardada(undefined), null, 'un borrador viejo no la trae');
});

test('el server valida la clave: ausente = camino viejo; mal formada = 400', () => {
  assert.deepEqual(claveIdemDe(undefined), { ok: true, clave: null });
  assert.deepEqual(claveIdemDe('3f2c9a1e-7b4d-4e7a-9c1a-2b3c4d5e6f70'), { ok: true, clave: '3f2c9a1e-7b4d-4e7a-9c1a-2b3c4d5e6f70' });
  assert.deepEqual(claveIdemDe('corta'), { ok: false });
  assert.deepEqual(claveIdemDe('a/../b-xxxxxxxx'), { ok: false });
  assert.deepEqual(claveIdemDe(12345678), { ok: false });
});

test('falta la columna = 42703 o PGRST204; un choque de clave NO es eso', () => {
  assert.equal(faltaColumnaIdem({ code: '42703', message: 'column meta_campaign_drafts.idem_key does not exist' }), true);
  assert.equal(faltaColumnaIdem({ code: 'PGRST204', message: "Could not find the 'idem_key' column" }), true);
  assert.equal(faltaColumnaIdem({ code: '23505', message: 'duplicate key value violates unique constraint "uq_meta_campaign_drafts_idem"' }), false);
  assert.equal(faltaColumnaIdem(null), false);
});

// ── abrirRegistro contra una base de mentira ────────────────────────────────

type Fila = Record<string, unknown> | null;
function base(o: { filas?: Fila[]; errorSelect?: { code: string; message: string }; errorInsert?: { code: string; message: string }; reclamadas?: number }) {
  const log: string[] = [];
  const filas = [...(o.filas ?? [])];
  const db = {
    from() {
      const q = {
        select() { return q; },
        eq() { return q; },
        maybeSingle() { log.push('select'); return Promise.resolve({ data: o.errorSelect ? null : filas.shift() ?? null, error: o.errorSelect ?? null }); },
        insert(row: Record<string, unknown>) { log.push('idem_key' in row ? 'insert:con-clave' : 'insert:sin-clave'); return q; },
        single() { return Promise.resolve(o.errorInsert ? { data: null, error: o.errorInsert } : { data: { id: 99 }, error: null }); },
        update() { log.push('update'); return q; },
        // update(...).eq(...).select('id') se espera directo.
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
          return Promise.resolve({ data: Array.from({ length: o.reclamadas ?? 1 }, () => ({ id: 7 })), error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, log };
}
const responder = (d: Decision, f: FilaPublicacion): Salida => (d.tipo === 'devolver' ? { status: 200, cuerpo: { ok: true, campaign_id: f.meta_campaign_id } } : d.tipo === 'a-medias' ? { status: 409, cuerpo: { estado: 'a-medias' } } : salidaEsperar());
const abrir = (db: SupabaseClient | null, clave: string | null) => abrirRegistro({
  db, ws: 3, clave, decidir: decidirReintentoCampana, responder, ahoraMs: AHORA, reclamo: {},
  insertar: (b, conClave) => b.from('meta_campaign_drafts').insert({ workspace_id: 3, ...(conClave ? { idem_key: clave } : {}) }).select('id').single(),
});
const CLAVE = 'clave-de-prueba-0001';

test('sin clave: el camino de siempre, y sin base igual se publica', async () => {
  const b = base({});
  assert.deepEqual(await abrir(b.db, null), { registro: { draftId: 99, conClave: false } });
  assert.deepEqual(b.log, ['insert:sin-clave']);
  assert.deepEqual(await abrir(null, null), { registro: { draftId: null, conClave: false } });
});

test('con clave: una clave nueva inserta CON la clave; una publicada se devuelve sin crear nada', async () => {
  const b1 = base({ filas: [null] });
  assert.deepEqual(await abrir(b1.db, CLAVE), { registro: { draftId: 99, conClave: true } });
  assert.deepEqual(b1.log, ['select', 'insert:con-clave']);
  const b2 = base({ filas: [{ id: 7, status: 'publicada', meta_campaign_id: '555', updated_at: hace(1000) }] });
  const r = await abrir(b2.db, CLAVE);
  assert.deepEqual(r, { salida: { status: 200, cuerpo: { ok: true, campaign_id: '555' } } });
  assert.deepEqual(b2.log, ['select'], 'no se inserta ni se crea nada');
  //   ROTO A PROPÓSITO (07/10/2026): con `if (c.paso === 'responder')` comentado en
  //   abrirRegistro, pass 12 / fail 1 — éste (el del 23505 decide con su propia
  //   relectura, que esa rotura no toca).
});

test('con clave y la base caída: 503 y NO se crea; con la columna faltando, camino viejo', async () => {
  const caida = base({ errorSelect: { code: '08006', message: 'connection failure' } });
  const r = await abrir(caida.db, CLAVE);
  assert.ok('salida' in r && r.salida.status === 503, 'sin registro no se puede deduplicar: no se publica');
  assert.deepEqual(caida.log, ['select']);
  assert.ok('salida' in (await abrir(null, CLAVE)), 'sin cliente de base, tampoco');
  // La migración 0215 sin aplicar: se publica igual, sin clave (y se loguea).
  const sinCol = base({ errorSelect: { code: '42703', message: 'column idem_key does not exist' } });
  assert.deepEqual(await abrir(sinCol.db, CLAVE), { registro: { draftId: 99, conClave: false } });
  assert.deepEqual(sinCol.log, ['select', 'insert:sin-clave']);
});

test('dos clics con la misma clave: el que llega segundo choca (23505) y espera', async () => {
  const b = base({ filas: [null, { id: 7, status: 'creando', updated_at: hace(2000) }], errorInsert: { code: '23505', message: 'duplicate key' } });
  const r = await abrir(b.db, CLAVE);
  assert.ok('salida' in r && r.salida.status === 409 && r.salida.cuerpo.estado === 'esperar');
  assert.deepEqual(b.log, ['select', 'insert:con-clave', 'select']);
});

test('reintentar una fila revertida la RECLAMA; si otro la reclamó primero, espera', async () => {
  const revertida = { id: 7, status: 'error', meta_campaign_id: '1', error: 'x (revertido)', updated_at: hace(60_000) };
  const b1 = base({ filas: [revertida], reclamadas: 1 });
  assert.deepEqual(await abrir(b1.db, CLAVE), { registro: { draftId: 7, conClave: true } });
  assert.deepEqual(b1.log, ['select', 'update'], 'la misma fila, sin insertar otra');
  const b2 = base({ filas: [revertida], reclamadas: 0 });
  const r = await abrir(b2.db, CLAVE);
  assert.ok('salida' in r && r.salida.status === 409, 'el compare-and-set no tocó ninguna fila: hay otro pedido');
  //   ROTO A PROPÓSITO (07/10/2026): devolviendo 'ok' en reclamarFila sin mirar cuántas
  //   filas tocó, pass 12 / fail 1 — éste.
});
