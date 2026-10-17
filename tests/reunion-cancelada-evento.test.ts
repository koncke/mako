// =============================================================================
// «Nada por detrás», lote 2: «Se canceló la R1…» pasa a ser una automatización de SuperAdmin, y con freno (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 2: `reunion-cancelada` lo mandaba el webhook de Calendly con su texto escrito
// en el código (editarlo en /mensajes no cambiaba lo que salía) y SIN NINGÚN FRENO: una reentrega de Calendly lo
// repetía. Ahora es el evento de la plataforma `reunion_cancelada`: el webhook pasa el lead y los datos de la reunión
// (`datosCancelada`), la fila de SuperAdmin tiene el texto literal, y el reclamo frena una reentrega (`claveCancelada`).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-cancelada.json`; base 4 / 0). Pasan / fallan:
//   X1 la plantilla sin la firma «— MaKo» (el cliente la recibiría sin firma)                  → 3 / 1
//   X2 el webhook sin el freno (`dedupTtlMin`)                                                   → 3 / 1
//   X3 el evento sin la reunión cancelada en lo que trae (los datos no se ofrecen ni validan)   → 3 / 1
//   X4 el webhook vuelve a pasar el texto escrito en el código                                  → 3 / 1
//
// Correr: node --import tsx --test tests/reunion-cancelada-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitirPorEvento, datosDelEvento, type DepsEvento, type FilaEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO, eventosOfrecidos } from '../lib/disparadores';
import { datosCancelada, claveCancelada, DEDUP_CANCELADA_MIN } from '../lib/reunion-cancelada';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { variablesPara } from '../lib/variables-aviso';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = (): string => {
  const p = pasosDePlantilla(plantillaPorId('mako-reunion-cancelada')!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};

test('el texto de la fila ES el que mandaba el webhook, letra por letra (firma incluida)', () => {
  const lead = { nombre_completo: 'Mariela Gómez', link_lead: 'https://hola-mako.com/crm/482/resumen' };
  const sale = textoConDatos(tarjeta(), { ...lead, ...datosCancelada({ reunion: 'R1', cuando: 'jueves 16 a las 11:00' }) });
  // El de siempre (app/api/webhooks/calendly/route.ts hasta el 17/10), con los mismos valores.
  const antes = `🔄 *Se canceló* la R1 con Mariela Gómez (era el jueves 16 a las 11:00) y todavía no reagendó.\n\n👉 Mira el resumen del lead:\nhttps://hola-mako.com/crm/482/resumen\n\nSi consigues otro horario, dime *«reagéndale la R1 a Mariela Gómez»*.\n\n— MaKo`;
  assert.equal(sale, antes);
});

test('el evento es de la plataforma, trae el lead y la reunión cancelada, y sus datos se ofrecen sólo ahí', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'reunion_cancelada');
  assert.ok(ev, 'falta el evento');
  assert.equal(ev!.aviso, 'reunion-cancelada');
  assert.equal(ev!.plataforma, true);
  assert.deepEqual([...ev!.trae], ['lead', 'cancelada']);
  assert.ok(!eventosOfrecidos('mako', null, {}).some((e) => e.subtipo === 'reunion_cancelada'), 'un negocio no lo ve');
  const ctx = datosDelEvento('reunion_cancelada');
  assert.equal(ctx.conCancelada, true);
  const claves = variablesPara(ctx).map((v) => v.key);
  for (const k of ['cancelada_reunion', 'cancelada_cuando', 'nombre_completo', 'link_lead']) assert.ok(claves.includes(k), `falta ${k}`);
  assert.ok(!variablesPara(datosDelEvento('reunion_grabada')).some((v) => v.key === 'cancelada_reunion'), 'se ofrece en otro evento');
});

test('lo corre la fila de la plataforma con el lead, y el reclamo frena una reentrega de Calendly', async () => {
  const reclamos: Array<{ ttl: number; key?: string }> = [];
  const corridas: Array<{ ws: number; leadId?: number; negocioWs?: number }> = [];
  const fila: FilaEvento = {
    id: 400, nombre: 'Un Lead Canceló su Reunión', activa: true, trigger_tipo: TRIGGER_AVISO_MAKO,
    disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'reunion_cancelada' }],
    pasos: pasosDePlantilla(plantillaPorId('mako-reunion-cancelada')!),
  };
  let primera = true;
  const d: DepsEvento = {
    leerFilas: async () => [fila],
    emitirAviso: async () => ({ ok: true, feedId: 1, wa: false, deduped: false }),
    reclamar: async (_ws, _id, ttl, key) => { reclamos.push({ ttl, key }); const ok = primera; primera = false; return ok; },
    correr: async (_id, _p, ws, ctx) => { corridas.push({ ws, leadId: ctx.leadId, negocioWs: ctx.negocioWs }); },
    wsPlataforma: async () => 9,
    log: () => {},
  };
  const clave = claveCancelada('https://api.calendly.com/scheduled_events/ABC', 482, '2026-10-16T17:00:00Z');
  const opts = { lead: { id: 482, nombre: 'Mariela Gómez' }, datos: datosCancelada({ reunion: 'R1', cuando: 'jueves 16 a las 11:00' }), dedupKey: clave, dedupTtlMin: DEDUP_CANCELADA_MIN };
  const cat = { id: 'reunion-cancelada', titulo: 'Reunión cancelada', categoria: 'accion' as const, semaforo: 'na' as const };
  await emitirPorEvento(cat, 13, opts, d);
  await emitirPorEvento(cat, 13, opts, d); // la reentrega
  assert.deepEqual(corridas, [{ ws: 9, leadId: 482, negocioWs: 13 }], 'la reentrega volvió a mandar');
  assert.deepEqual(reclamos.map((r) => r.key), [clave, clave]);
});

test('el webhook pasa sólo los datos, con el freno, y ya no escribe el texto', () => {
  const w = leer('app/api/webhooks/calendly/route.ts');
  const i = w.indexOf("await emitirDelCatalogo('reunion-cancelada', {");
  assert.ok(i > 0);
  const llamada = w.slice(i, w.indexOf('});', i));
  assert.match(llamada, /lead: \{ id: lead\.id, nombre: lead\.nombre \},/);
  assert.match(llamada, /datos: datosCancelada\(\{ reunion: tipoCancelada, cuando: fmtFechaHoraLocal\(startTimeIso, tzWs\) \}\),/);
  assert.match(llamada, /dedupKey: claveCancelada\(payload\.scheduled_event\?\.uri, lead\.id, startTimeIso\), dedupTtlMin: DEDUP_CANCELADA_MIN,/);
  assert.doesNotMatch(llamada, /texto:/, 'volvió el texto escrito en el código');
  assert.match(leer('scripts/mudanza-avisos-plataforma.mts'), /\{ plantilla: 'mako-reunion-cancelada', evento: 'reunion_cancelada' \}/);
});
