// =============================================================================
// Qué etapas de nutrición NO tienen secuencia de mensajes
// =============================================================================
// Este archivo reemplaza al seed de secuencias por defecto, y el cambio de fondo
// vale la pena explicarlo: antes, al crear un workspace —y en CADA corrida del
// cron— se creaban ~23 secuencias de relleno con copy tipo [placeholder]. La
// intención era buena (que nadie arranque con la pantalla vacía), pero el efecto
// era el contrario: el dueño entraba a su Chatbot y encontraba dos docenas de
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
import { getFunnelDefault } from './funnels';
import { ETAPAS_SIN_SECUENCIA } from './pipeline';
import { etapasCubiertas, type FilaCobertura } from './secuencias-cobertura';

// ⚠️ SE MUDÓ A `lib/pipeline.ts` (30/09/2026). El mismo catálogo lo necesita la pantalla
// que lista las nutriciones del embudo, y este módulo tiene `server-only`: con la copia
// acá, el pop-up dibujaba «Nutrición - No Paga → Reunión excepcional» como si fuera una
// nutrición más.
const SIN_SECUENCIA = new Set(ETAPAS_SIN_SECUENCIA);

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
  // El residuo con reunión (#790): es una reactivación, pasados los 45 días.
  residuo_sin_cierre: ['reactivacion'],
};

export type HuecoSecuencia = {
  /** Clave de la etapa del funnel (stage key). */
  etapa: string;
  /** Cómo se llama esa etapa en la UI del funnel. */
  label: string;
};

/**
 * Las etapas de nutrición del funnel de ESTE workspace que no tienen ninguna
 * automatización que las cubra. La lee la API de MaKo (`huecos_secuencias`); la
 * pantalla ya no (el pie «N etapas sin secuencia» de /automations salió el 10/10/2026).
 *
 * Cuenta como cubierta si alguno de los CRON de una automatización arranca en esa
 * etapa, o con un trigger legacy que la cubra (`etapasCubiertas`). Una PAUSADA
 * cuenta igual: existe y está escrita, solo hace falta prenderla — decir que
 * falta armarla sería mentir.
 */
export async function huecosDeSecuencias(): Promise<HuecoSecuencia[]> {
  const supabase = await getTenantDb();
  // DEFAULT: el aviso es del NEGOCIO, no de un lead. Con varios funnels hay que
  // recorrerlos todos y ROTULAR cada hueco con el nombre de su funnel — sin el
  // rótulo, «falta la secuencia de No Show R1» aparecería repetido y sin decir
  // de cuál de los dos embudos habla.
  const funnel = await getFunnelDefault();
  const etapasNutri = funnel.stages.filter((s) => s.band === 'nutricion' && !SIN_SECUENCIA.has(s.key));
  if (!etapasNutri.length) return [];

  // ⚠️ TODOS LOS CRON, NO SÓLO EL PRIMERO (10/10/2026): `etapas` (0230) y `disparadores` (0241) viajan,
  // y la cuenta la hace `etapasCubiertas` (lib/secuencias-cobertura.ts, con test).
  // ⚠️ Y UNA LECTURA QUE FALLA TIRA: con `data` en null, todas las etapas salían como huecos —«no pude
  // leer» dicho como «no tienes ninguna»—.
  const { data, error } = await supabase.from('nutricion_secuencias').select('etapa, etapas, trigger_tipo, disparadores, archivada_at');
  if (error) throw new Error(`huecosDeSecuencias: ${error.message}`);
  const cubiertas = etapasCubiertas((data ?? []) as FilaCobertura[], LEGACY_TRIGGER_CUBRE);

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
    // ⚠️ Pausada además de archivada (auditoría de seguridad, 14/10/2026): una archivada que quedaba
    // `activa` volvía a mandar en cuanto algo la desarchivara.
    .update({ archivada_at: ahora, activa: false })
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

/** Devuelve una secuencia archivada al listado, PAUSADA: prenderla es una decisión aparte. Sin el
 *  `activa: false`, una que se archivó prendida volvía a inscribir su cohorte al desarchivarla. */
export async function desarchivarSecuencia(id: number): Promise<void> {
  const supabase = await getTenantDb();
  const { error } = await supabase.from('nutricion_secuencias')
    .update({ archivada_at: null, activa: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`desarchivarSecuencia: ${error.message}`);
}
