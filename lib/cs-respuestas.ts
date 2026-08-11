// =============================================================================
// cs-respuestas — la tarea de cada bloque del programa, por cliente
// =============================================================================
// El objeto sobre el que gira el bucle de entrega. Tres manos escriben sobre el
// mismo renglón y NINGUNA pisa a la anterior:
//
//   1. el cliente contesta        → `respuesta`      (antes de la junta)
//   2. la IA reescribe con lo hablado → `respuesta_ia`  (después de la junta)
//   3. el cliente aprueba         → `respuesta` = lo aprobado, y queda cerrado
//
// El paso 3 es el único que toca `respuesta`, y solo con lo que el cliente
// confirmó. Si la IA escribiera directo sobre `respuesta`, el cliente perdería
// lo que escribió a mano sin poder compararlo — que es exactamente lo que la
// pantalla de aprobación existe para evitar.
//
// Scopeado por getTenantDb (`cs_respuestas` está en TENANT_TABLES, mig 0125).

import 'server-only';
import { getTenantDb } from './workspace';
import { claseDe } from './programa-catalogo';

export type EstadoBloque = 'pendiente' | 'contestada' | 'revisada_ia' | 'aprobada';

export type Bloque = {
  id: number;
  lead_id: number;
  clase_id: string;
  area: string;
  respuesta: string | null;
  respuesta_ia: string | null;
  fuente_reunion: string | null;
  estado: EstadoBloque;
  /** Cuándo completó la clase en Whop. NO es haber contestado la tarea: «la vio y
   *  no la contestó» es justo el estado que dispara el recordatorio, y sin esta
   *  columna se confunde con «ni la abrió». */
  visto_at: string | null;
  contestada_at: string | null;
  revisada_at: string | null;
  aprobada_at: string | null;
  updated_at: string;
};

const COLS = 'id, lead_id, clase_id, area, respuesta, respuesta_ia, fuente_reunion, estado, visto_at, contestada_at, revisada_at, aprobada_at, updated_at';

/** Normaliza el área a lo que guarda la base. `area` es NOT NULL DEFAULT '' para
 *  que el índice único sea sobre columnas exactas; null y '' son el mismo bloque
 *  y confundirlos crearía una fila duplicada que el ON CONFLICT no ve. */
const areaDe = (area?: string | null) => (area ?? '').trim();

export async function getBloque(leadId: number, claseId: string, area?: string | null): Promise<Bloque | null> {
  const db = await getTenantDb();
  const { data } = await db
    .from('cs_respuestas').select(COLS)
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', areaDe(area))
    .maybeSingle();
  return (data as Bloque | null) ?? null;
}

export async function bloquesDeCliente(leadId: number): Promise<Bloque[]> {
  const db = await getTenantDb();
  const { data } = await db
    .from('cs_respuestas').select(COLS)
    .eq('lead_id', leadId).order('clase_id', { ascending: true });
  return (data as Bloque[] | null) ?? [];
}

/** Lo que escribe el CLIENTE. Guardado parcial: se llama en cada autosave.
 *
 *  ⚠️ Nunca toca `respuesta_ia` ni baja el estado desde 'aprobada': si el bloque
 *  ya se cerró, volver a escribir lo reabre a 'contestada' a propósito (el
 *  cliente cambió de opinión), pero la propuesta de la IA se conserva para que
 *  se pueda comparar. */
export async function guardarRespuesta(leadId: number, claseId: string, texto: string, area?: string | null): Promise<Bloque | null> {
  if (!claseDe(claseId)) return null; // un id que no está en el programa no se guarda: sería una fila huérfana
  const db = await getTenantDb();
  const vacio = !texto.trim();
  const { data } = await db
    .from('cs_respuestas')
    .upsert({
      lead_id: leadId, clase_id: claseId, area: areaDe(area),
      respuesta: texto,
      estado: vacio ? 'pendiente' : 'contestada',
      contestada_at: vacio ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,lead_id,clase_id,area' })
    .select(COLS).maybeSingle();
  return (data as Bloque | null) ?? null;
}

/** Lo que propone la IA después de la junta. Va a su propia columna. */
export async function proponerReescritura(
  leadId: number, claseId: string, propuesta: string,
  opts?: { area?: string | null; fuenteReunion?: string | null },
): Promise<Bloque | null> {
  const db = await getTenantDb();
  const { data } = await db
    .from('cs_respuestas')
    .upsert({
      lead_id: leadId, clase_id: claseId, area: areaDe(opts?.area),
      respuesta_ia: propuesta,
      fuente_reunion: opts?.fuenteReunion ?? null,
      estado: 'revisada_ia',
      revisada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,lead_id,clase_id,area' })
    .select(COLS).maybeSingle();
  return (data as Bloque | null) ?? null;
}

/** El cliente aprueba. `texto` es lo que quedó en pantalla —puede haberlo
 *  editado— y ESO es lo que se guarda como respuesta final. */
export async function aprobarBloque(leadId: number, claseId: string, texto: string, area?: string | null): Promise<Bloque | null> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const { data } = await db
    .from('cs_respuestas')
    .update({ respuesta: texto, estado: 'aprobada', aprobada_at: ahora, updated_at: ahora })
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', areaDe(area))
    .select(COLS).maybeSingle();
  return (data as Bloque | null) ?? null;
}

export type AvanceCliente = {
  contestados: number;
  aprobados: number;
  esperandoAprobacion: number;
  /** Vio la clase en Whop y NO contestó la tarea. Es el estado que dispara el
   *  recordatorio: el que ni la abrió necesita otro mensaje distinto. */
  vistosSinContestar: number;
  /** El último bloque que el cliente tocó. Es lo que se mira antes de la junta. */
  ultimo: Bloque | null;
};

export async function avanceDeCliente(leadId: number): Promise<AvanceCliente> {
  const filas = await bloquesDeCliente(leadId);
  const porFecha = [...filas].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return {
    contestados: filas.filter(f => f.estado !== 'pendiente').length,
    vistosSinContestar: filas.filter(f => f.visto_at && f.estado === 'pendiente').length,
    aprobados: filas.filter(f => f.estado === 'aprobada').length,
    esperandoAprobacion: filas.filter(f => f.estado === 'revisada_ia').length,
    ultimo: porFecha[0] ?? null,
  };
}
