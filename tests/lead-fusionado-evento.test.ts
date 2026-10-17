// =============================================================================
// «Nada por detrás», lote 2: «Entró un contacto… y lo sumé a…» es una automatización de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 2: `lead-fusionado` lo mandaba lib/leads.ts (`avisarFusion`) con su texto en
// el código y con el freno AL REVÉS: 60 min SIN clave, así que la fusión de OTRO lead dentro de esa hora no se avisaba
// (y este aviso es lo único que hace visible un match equivocado). Ahora es el evento de la plataforma `lead_fusionado`:
// la ingesta pasa el lead y los datos (`datosFusion`), la fila tiene el texto literal, y el freno es POR LEAD.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-fusion.json`; base 3 / 0). Pasan / fallan:
//   F1 el freno vuelve a ser sin clave (una fusión de otro lead en la hora se pierde)            → 2 / 1
//   F2 la plantilla con el link del resumen en vez del de la tarjeta (no es el texto de siempre) → 2 / 1
//   F3 la ingesta vuelve a pasar el texto escrito en el código                                   → 2 / 1
//
// Correr: node --import tsx --test tests/lead-fusionado-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitirPorEvento, datosDelEvento, type DepsEvento, type FilaEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { datosFusion, claveFusion, DEDUP_FUSION_MIN } from '../lib/lead-fusionado';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { variablesPara } from '../lib/variables-aviso';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = (): string => {
  const p = pasosDePlantilla(plantillaPorId('mako-lead-fusionado')!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};

test('el texto de la fila ES el que mandaba la ingesta, letra por letra (sin firma: no la tenía)', () => {
  const sale = textoConDatos(tarjeta(), { nombre_completo: 'Marina Olvera', ...datosFusion({ canal: 'Calendly', porQue: 'mismo teléfono', link: 'https://hola-mako.com/crm/1842' }) });
  assert.equal(sale, 'Entró un contacto por *Calendly* y lo sumé a *Marina Olvera*, que ya tenías (mismo teléfono). Si no era la misma persona, avísame y lo separo 👉 https://hola-mako.com/crm/1842');
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'lead_fusionado');
  assert.ok(ev && ev.plataforma === true && ev.aviso === 'lead-fusionado');
  const claves = variablesPara(datosDelEvento('lead_fusionado')).map((v) => v.key);
  for (const k of ['fusion_canal', 'fusion_porque', 'fusion_link', 'nombre_completo']) assert.ok(claves.includes(k), `falta ${k}`);
});

test('el freno es POR LEAD: dos leads distintos en la misma hora avisan los dos; el mismo dos veces, una', async () => {
  const tomadas = new Set<string>();
  const corridas: number[] = [];
  const fila: FilaEvento = {
    id: 401, nombre: 'Se Juntó un Contacto con un Lead', activa: true, trigger_tipo: TRIGGER_AVISO_MAKO,
    disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'lead_fusionado' }],
    pasos: pasosDePlantilla(plantillaPorId('mako-lead-fusionado')!),
  };
  const d: DepsEvento = {
    leerFilas: async () => [fila],
    emitirAviso: async () => ({ ok: true, feedId: 1, wa: false, deduped: false }),
    // El reclamo de verdad es por (ws, aviso, clave): sin clave, una sola por aviso.
    reclamar: async (ws, id, _ttl, key) => { const k = `${ws}|${id}|${key ?? ''}`; if (tomadas.has(k)) return false; tomadas.add(k); return true; },
    correr: async (_id, _p, _ws, ctx) => { corridas.push(ctx.leadId ?? 0); },
    wsPlataforma: async () => 9,
    log: () => {},
  };
  const cat = { id: 'lead-fusionado', titulo: 'Junté un contacto', categoria: 'aviso' as const, semaforo: 'amarillo' as const };
  const opts = (id: number) => ({ lead: { id, nombre: `Lead ${id}` }, datos: datosFusion({ canal: 'Meta', porQue: 'mismo teléfono', link: `https://hola-mako.com/crm/${id}` }), dedupKey: claveFusion(id), dedupTtlMin: DEDUP_FUSION_MIN });
  await emitirPorEvento(cat, 13, opts(10), d);
  await emitirPorEvento(cat, 13, opts(11), d); // otro lead, la misma hora
  await emitirPorEvento(cat, 13, opts(10), d); // el mismo, otra vez
  assert.deepEqual(corridas, [10, 11]);
});

test('la ingesta pasa sólo el lead y los datos, con el freno por lead', () => {
  const src = leer('lib/leads.ts');
  const i = src.indexOf("await emitirDelCatalogo('lead-fusionado', {");
  assert.ok(i > 0);
  const llamada = src.slice(i, src.indexOf('});', i));
  assert.match(llamada, /lead: \{ id: lead\.id, nombre: lead\.nombre \},/);
  assert.match(llamada, /datos: datosFusion\(\{ canal, porQue, link: linkApp\(`\/crm\/\$\{lead\.id\}`, ws\) \}\),/);
  assert.match(llamada, /dedupKey: claveFusion\(lead\.id\), dedupTtlMin: DEDUP_FUSION_MIN,/);
  assert.doesNotMatch(llamada, /texto:/, 'volvió el texto escrito en el código');
});
