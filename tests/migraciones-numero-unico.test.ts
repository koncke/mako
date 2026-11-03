// =============================================================================
// Un número por migración: ningún prefijo NNNN_ se repite en supabase/migrations/ (29/10/2026)
// =============================================================================
// Ninguna guarda veía dos migraciones con el mismo número. El 0340 doble (`leads_papelera` en main y `image_editor_propuestas`
// en motion-imagen-2610) lo vio el chat de Video recién al leerlo, y lo renumeró a 0344. Con dos ramas que eligen «el próximo
// libre» el mismo día, el choque es seguro: el número es la única forma de saber qué se aplicó antes, y quien aplica una
// migración por número aplica la equivocada.
//   · Corre sobre el árbol del TREN (main + las ramas mergeadas), así que ve el choque entre una rama que llega y main, o
//     entre dos ramas del mismo tren. Lee la carpeta, no git: una migración sin commitear también cuenta.
//   · Los repetidos VIEJOS (de la 0024 a la 0223) ya están aplicados en producción con esos nombres y no se renumeran: van
//     congelados en HISTORICOS. Uno nuevo no entra ahí: se renumera al próximo libre que dice el error.
//
// PROBADO ROMPIÉNDOLO (29/10/2026, Integración): una `0350_otra.sql` al lado de `0350_media_buyer_donde_hasta.sql` → rojo con
// los dos nombres y el próximo libre; un `0024_tercero.sql` (un tercero en un número histórico) → rojo; sacar un histórico de
// la carpeta → rojo (la lista congelada se actualiza a mano); un `sin_numero.sql` → rojo. Cada una 2 / 1; restaurado: 3 / 0.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const CARPETA = join(__dirname, '..', 'supabase', 'migrations');

/** Los números que ya estaban repetidos en producción antes de esta guarda. Congelados: nada se suma acá. */
const HISTORICOS: Readonly<Record<string, readonly string[]>> = {
  '0024': ['0024_agendas_meta.sql', '0024_funnel_transitions_reunion.sql'],
  '0025': ['0025_ad_transcripts.sql', '0025_funnel_config.sql'],
  '0026': ['0026_lead_audit.sql', '0026_transcript_secciones.sql'],
  '0039': ['0039_closing_edit_history.sql', '0039_script_analyses.sql'],
  '0060': ['0060_deal_details.sql', '0060_onboarding_state.sql'],
  '0061': ['0061_leads_perf_indexes.sql', '0061_tracking_granular.sql'],
  '0069': ['0069_seed_nutricion_templates.sql', '0069_solucionar_una_pasada.sql'],
  '0072': ['0072_evolution_instancias.sql', '0072_leads_ws_indexes.sql'],
  '0128': ['0128_cs_valores.sql', '0128_propuestas.sql'],
  '0129': ['0129_cs_clientes.sql', '0129_propuesta_revision.sql'],
  '0136': ['0136_instagram_zernio.sql', '0136_vsl_events_auto.sql'],
  '0177': ['0177_capa_agencia.sql', '0177_lead_fbclid.sql'],
  '0223': ['0223_curso_papelera.sql', '0223_flujo_grafo.sql'],
};

const sqls = readdirSync(CARPETA).filter((f) => f.endsWith('.sql')).sort();

test('toda migración empieza con un número de cuatro cifras y un guion bajo', () => {
  const sinNumero = sqls.filter((f) => !/^\d{4}_/.test(f));
  assert.deepEqual(sinNumero, [], `sin el prefijo NNNN_: ${sinNumero.join(', ')}`);
});

test('ningún número se repite, salvo los históricos congelados (y ésos, sin un tercero)', () => {
  const porNumero = new Map<string, string[]>();
  for (const f of sqls) {
    const n = f.slice(0, 4);
    porNumero.set(n, [...(porNumero.get(n) ?? []), f]);
  }
  const proximo = String(Math.max(...[...porNumero.keys()].map(Number)) + 1).padStart(4, '0');
  const choques: string[] = [];
  for (const [n, archivos] of porNumero) {
    if (archivos.length < 2) continue;
    const viejo = HISTORICOS[n];
    if (viejo && archivos.length === viejo.length && archivos.every((a) => viejo.includes(a))) continue;
    choques.push(`${n}: ${archivos.join(' y ')}`);
  }
  assert.deepEqual(choques, [], `dos migraciones con el mismo número (${choques.join(' · ')}). La nueva se renumera al próximo libre, ${proximo}, en su archivo y en lo que la nombre (el código, los tests y los docs).`);
});

test('los históricos congelados siguen en la carpeta, con sus nombres (si uno se renombra, se actualiza la lista)', () => {
  for (const [n, archivos] of Object.entries(HISTORICOS)) {
    for (const a of archivos) assert.ok(sqls.includes(a), `${n}: ya no está ${a}`);
  }
});
