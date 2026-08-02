// =============================================================================
// Qué etapas de nutrición NO tienen secuencia de mensajes
// =============================================================================
// Este archivo reemplaza al seed de secuencias por defecto, y el cambio de fondo
// vale la pena explicarlo: antes, al crear un workspace —y en CADA corrida del
// cron— se creaban ~23 secuencias de relleno con copy tipo [placeholder]. La
// intención era buena (que nadie arranque con la pantalla vacía), pero el efecto
// era el contrario: el dueño entraba a su Chat Agent y encontraba dos docenas de
// secuencias que no escribió, no reconocía y no sabía si estaban enviando algo.
// Lo primero que hacía era desconfiar de todas, incluidas las suyas.
//
// Y como el cron las re-sembraba, borrarlas a mano no servía de nada: volvían
// solas en la siguiente corrida.
//
// Ahora no se crea nada. Se CALCULA qué etapas de nutrición del funnel quedaron
// sin secuencia y se avisa, que es lo que el dueño necesita saber. La pantalla
// arranca con lo que él armó y con una lista honesta de lo que falta.

import 'server-only';

import { getTenantDb } from './workspace';
import { getFunnel } from './leads';

// Etapas derivadas que NO cuentan como hueco: la nutrición manual es del setter
// por definición y la reunión excepcional es un estacionamiento, no una etapa
// que haya que nutrir.
const ETAPAS_SIN_SECUENCIA = new Set(['manual', 'reunion_excepcional']);

// Qué etapas del funnel cubre cada trigger legacy. La cobertura se decide por
// TRIGGER y no por la columna `etapa`: sus valores viejos divergen entre
// workspaces (por ejemplo 'noshow' o 'postagenda' ya no existen como stage key),
// así que mirar la columna daría huecos falsos.
const LEGACY_TRIGGER_CUBRE: Record<string, string[]> = {
  instant_form_sin_agenda: ['nutri'],
  vio_vsl_sin_agendar: ['nutri'],
  vio_poco_vsl: ['nutri'],
  no_show_j1: ['noshow_r1'],
  no_show_j2: ['noshow_r2'],
  confirmado_sin_pago: ['nopaga'],
  post_j2_sin_cerrar: ['nocompro'],
  reactivacion_viejo: ['reactivacion'],
  ultimo_intento_antes_noresp: ['reactivacion'],
};

export type HuecoSecuencia = {
  /** Clave de la etapa del funnel (stage key). */
  etapa: string;
  /** Cómo se llama esa etapa en la UI del funnel. */
  label: string;
};

/**
 * Las etapas de nutrición del funnel de ESTE workspace que no tienen ninguna
 * secuencia que las cubra. Es lo que alimenta el aviso de la pantalla.
 *
 * Cuenta como cubierta si hay una secuencia con esa `etapa`, o con un trigger
 * legacy que la cubra. Una secuencia PAUSADA cuenta igual: existe y está
 * escrita, solo hace falta prenderla — decir que falta armarla sería mentir.
 */
export async function huecosDeSecuencias(): Promise<HuecoSecuencia[]> {
  const supabase = await getTenantDb();
  const funnel = await getFunnel();
  const etapasNutri = funnel.stages.filter((s) => s.band === 'nutricion' && !ETAPAS_SIN_SECUENCIA.has(s.key));
  if (!etapasNutri.length) return [];

  const { data } = await supabase.from('nutricion_secuencias').select('etapa, trigger_tipo, archivada_at');
  const rows = (data ?? []) as Array<{ etapa: string | null; trigger_tipo: string; archivada_at: string | null }>;

  const cubiertas = new Set<string>();
  for (const r of rows) {
    if (r.archivada_at) continue; // archivada = el dueño la sacó de en medio; su etapa vuelve a ser un hueco
    if (r.etapa) cubiertas.add(r.etapa);
    for (const k of LEGACY_TRIGGER_CUBRE[r.trigger_tipo] ?? []) cubiertas.add(k);
  }

  return etapasNutri
    .filter((s) => !cubiertas.has(s.key))
    .map((s) => ({ etapa: s.key, label: s.label }));
}

/**
 * Archiva secuencias: dejan de listarse, de enrolar y de enviar, pero no se
 * borran. Cancela además las inscripciones vivas y les deja constancia de POR
 * QUÉ se cortaron — si quedaran como "activas" colgando de una secuencia que ya
 * no corre, cualquier evaluador posterior las leería como leads abandonados.
 *
 * `ids` vacío = todas las vigentes del workspace ("empezar de cero").
 * Devuelve cuántas archivó.
 */
export async function archivarSecuencias(ids?: number[]): Promise<{ archivadas: number; inscripcionesCanceladas: number }> {
  const supabase = await getTenantDb();
  const ahora = new Date().toISOString();

  let q = supabase.from('nutricion_secuencias').select('id').is('archivada_at', null);
  if (ids?.length) q = q.in('id', ids);
  const { data } = await q;
  const objetivo = ((data ?? []) as Array<{ id: number }>).map((r) => r.id);
  if (!objetivo.length) return { archivadas: 0, inscripcionesCanceladas: 0 };

  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ archivada_at: ahora })
    .in('id', objetivo);
  if (error) throw new Error(`archivarSecuencias: ${error.message}`);

  // Las inscripciones vivas se cancelan explícitamente. Se hace DESPUÉS de
  // archivar: si fallara acá, la secuencia ya no envía igual.
  const { data: canc } = await supabase
    .from('nutricion_inscripciones')
    .update({ estado: 'cancelada', updated_at: ahora })
    .in('secuencia_id', objetivo)
    .in('estado', ['activa', 'pendiente'])
    .select('id');

  return { archivadas: objetivo.length, inscripcionesCanceladas: (canc ?? []).length };
}

/** Devuelve una secuencia archivada al listado. */
export async function desarchivarSecuencia(id: number): Promise<void> {
  const supabase = await getTenantDb();
  const { error } = await supabase.from('nutricion_secuencias').update({ archivada_at: null }).eq('id', id);
  if (error) throw new Error(`desarchivarSecuencia: ${error.message}`);
}
