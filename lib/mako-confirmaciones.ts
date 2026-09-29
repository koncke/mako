// =============================================================================
// mako_confirmaciones — cambios automáticos de MaKo pendientes de confirmar
// =============================================================================
// El CRM automático aplica un cambio y, en los "fuertes", deja una fila acá. El
// modal bloqueante (MakoConfirmGate) las lista y el humano:
//   · Confirmar  → deja el cambio de MaKo.
//   · Rechazar   → revierte (aplica el patch `revert` a la fila del lead).
//   · Opción     → aplica una alternativa (mueve a opcion.stage por setPipelineStage).
// =============================================================================

import 'server-only';

import { getTenantDb } from './workspace';
import { setPipelineStage, logLeadEvent } from './leads';

export type CambioCampo = { campo: string; antes: string | null; despues: string | null };
export type ConfOpcion = { key: string; label: string; stage?: string | null; motivo?: string | null; tone?: 'primary' | 'danger' | 'neutral' };

export type MakoConfirmacion = {
  id: number;
  lead_id: number;
  lead_nombre: string | null;
  regla: string;
  tipo: string;
  clave: string;
  titulo: string;
  detalle: string | null;
  aplicado: boolean;
  cambios: CambioCampo[];
  revert: Record<string, unknown> | null;
  opciones: ConfOpcion[] | null;
  estado: 'pendiente' | 'confirmado' | 'rechazado';
  created_at: string;
};

export type CrearConfirmacionInput = {
  leadId: number;
  leadNombre?: string | null;
  regla: string;
  tipo: string;
  clave: string;
  titulo: string;
  detalle?: string | null;
  aplicado: boolean;
  cambios?: CambioCampo[];
  revert?: Record<string, unknown> | null;
  opciones?: ConfOpcion[] | null;
};

const COLS = 'id, lead_id, lead_nombre, regla, tipo, clave, titulo, detalle, aplicado, cambios, revert, opciones, estado, created_at';

/**
 * ¿Ya hay una confirmación (en CUALQUIER estado) para este lead + clave? Anti-loop:
 * evita re-proponer/re-aplicar algo que ya está pendiente o que el humano resolvió
 * (ej. rechazó un No Show y la reunión sigue en el pasado → no volver a marcarla).
 */
export async function existeConfirmacion(leadId: number, clave: string): Promise<boolean> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('mako_confirmaciones')
    .select('id')
    .eq('lead_id', leadId)
    .eq('clave', clave)
    .limit(1);
  return !!(data && data.length);
}

/** Crea una confirmación pendiente. No duplica: si ya hay una del mismo lead+clave, no hace nada. */
export async function crearConfirmacion(input: CrearConfirmacionInput): Promise<boolean> {
  const supabase = await getTenantDb();
  const { data: ya } = await supabase
    .from('mako_confirmaciones')
    .select('id')
    .eq('lead_id', input.leadId)
    .eq('clave', input.clave)
    .eq('estado', 'pendiente')
    .limit(1);
  if (ya && ya.length) return false;

  const { error } = await supabase.from('mako_confirmaciones').insert({
    lead_id: input.leadId,
    lead_nombre: input.leadNombre ?? null,
    regla: input.regla,
    tipo: input.tipo,
    clave: input.clave,
    titulo: input.titulo,
    detalle: input.detalle ?? null,
    aplicado: input.aplicado,
    cambios: input.cambios ?? [],
    revert: input.revert ?? null,
    opciones: input.opciones ?? null,
    estado: 'pendiente',
  });
  if (error) {
    // Violación del índice único (carrera con otra corrida) = ya existe: no es fatal.
    console.error(`[mako-conf] crear falló: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * El PRODUCTO que se está mirando, para acotar la lista a lo suyo.
 *
 * ⚠️ `mako_confirmaciones` no sabe de funnels: sus columnas (mig 0068) son
 * workspace + lead + la regla, y `lead_id` no tiene FK a `leads`, así que el funnel
 * NO se puede traer con un embed de PostgREST («could not find a relationship»). Se
 * resuelve con una segunda consulta a `leads` y se cruza en memoria.
 */
export type ProductoALaVista = {
  /**
   * `null` = el embudo del NEGOCIO. Es la MISMA asimetría que `listLeadsDeFunnel`
   * (`lib/leads.ts:313`): el tablero por defecto pide los leads con
   * `funnel_id IS NULL` —que hoy son los 1.530 de los 6 workspaces— y con un id pide
   * sólo los suyos. Filtrar por «el id de la fila es_default» dejaría la tarjeta
   * VACÍA para todo el mundo, porque nadie escribe ese id en un lead.
   */
  funnelId: number | null;
  /**
   * Los embudos SECUNDARIOS que hoy se pueden mirar (los `activo` y no `es_default`).
   *
   * ⚠️ EL DEFAULT SE DEJA AFUERA A PROPÓSITO, y no es un descuido de nombre: un lead con
   * `funnel_id = <id del default>` no matchearía ni `funnelId = null` ni ningún secundario,
   * y su confirmación quedaría invisible en TODOS los tableros. Con el default fuera de
   * esta lista cae en la misma rama que un embudo archivado y se muestra en el tablero del
   * negocio, que es donde alguien la va a ver.
   *
   * ⚠️ Y NO ES HIPOTÉTICO DESDE EL 30/09/2026. Las dos escrituras del alta guardan
   * `?? null` (`app/crm/actions.ts:636` y `lib/leads.ts:601`), pero `moverLeadDeFunnel`
   * (`lib/leads.ts:554`) escribe el id CRUDO, y el desplegable de producto de la ficha
   * (`app/crm/lead-view/ProductoDelLead.tsx`) manda a propósito el del default cuando se
   * mueve un lead «al del negocio». Ese lead deja de aparecer en cualquier tablero
   * (`listLeadsDeFunnel(null)` filtra con `.is('funnel_id', null)`) y su confirmación,
   * gracias a esta línea, sigue saliendo en el del negocio — visible antes que perdido.
   * Es la misma divergencia que el comentario de la mig 0181 describe al revés.
   */
  secundarios: readonly number[];
};

/**
 * Confirmaciones pendientes del workspace actual (más viejas primero).
 *
 * ⚠️ SIN ARGUMENTO NO FILTRA, y eso NO es pereza: tiene tres llamadores y dos son de
 * la API de MaKo (`lib/api-mako/areas/crm.run.ts:305` y `:612`), que no está parada en
 * ningún producto. El segundo además VALIDA el id antes de resolver, así que un filtro
 * por default le haría contestar «La confirmación #N no está pendiente» sobre una que sí
 * lo está — un falso negativo en un camino que ESCRIBE.
 */
export async function listPendientes(deProducto?: ProductoALaVista): Promise<MakoConfirmacion[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('mako_confirmaciones')
    .select(COLS)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return [];
  const filas = (data ?? []) as MakoConfirmacion[];
  if (!deProducto || filas.length === 0) return filas;
  return acotarAlProducto(supabase, filas, deProducto);
}

/**
 * Deja sólo las confirmaciones del producto que se está mirando.
 *
 * ⚠️ EL CORTE VA ACÁ Y NO EN EL CLIENTE. Bajar las 100 y esconder las ajenas es contar
 * lo de otro producto por la puerta de atrás, y además el contador de la tarjeta diría
 * un número que no se corresponde con la lista.
 *
 * ⚠️ `SIN_PRODUCTO`: una confirmación cuyo lead ya no existe —`mako_confirmaciones.lead_id`
 * no tiene FK y `deleteLead` borra de verdad (`lib/leads.ts:780`), así que las huérfanas son
 * posibles— o que apunta a un embudo archivado, NO se puede atribuir a nadie. Y no puede
 * desaparecer en silencio, porque es un cambio que MaKo ya aplicó y que alguien tiene que
 * revisar. Se muestra en el tablero del NEGOCIO (el que se abre sin `?funnel=`, o sea el que
 * nadie puede evitar), nunca en un producto secundario: ahí volvería a ser el bug que esto
 * cierra. Es además lo que la mig 0181 declara querer para esos leads («se comporta igual
 * que un NULL», `:41-44`) — el tablero todavía no lo cumple, y esta tarjeta sí.
 */
async function acotarAlProducto(
  supabase: Awaited<ReturnType<typeof getTenantDb>>,
  filas: MakoConfirmacion[],
  { funnelId, secundarios }: ProductoALaVista,
): Promise<MakoConfirmacion[]> {
  // `Number(...)` en las dos puntas: son columnas `bigint` y el día que un driver las
  // devuelva como texto («13») el `===` sería false SIEMPRE — un filtro que no encuentra
  // nada se lee como que la tarjeta dejó de funcionar.
  const ids = [...new Set(filas.map((c) => Number(c.lead_id)))];
  const { data, error } = await supabase.from('leads').select('id, funnel_id').in('id', ids);
  if (error) {
    // No poder leer el embudo de un lead no es «no es de este producto»: se abstiene y
    // muestra todo. Esconder un cambio de MaKo por una lectura caída es la dirección
    // equivocada del error, y sin esta línea no quedaría rastro de por qué.
    console.error(`[mako-conf] no se pudo resolver el embudo de ${ids.length} leads: ${error.message}`);
    return filas;
  }
  const deLead = new Map<number, number | null>();
  for (const l of (data ?? []) as Array<{ id: number; funnel_id: number | null }>) {
    deLead.set(Number(l.id), l.funnel_id == null ? null : Number(l.funnel_id));
  }
  const mirables = new Set(secundarios);
  const delNegocio = funnelId == null;
  return filas.filter((c) => {
    const lead = Number(c.lead_id);
    if (!deLead.has(lead)) return delNegocio;               // el lead ya no está → SIN_PRODUCTO
    const suyo = deLead.get(lead) ?? null;
    if (suyo == null) return delNegocio;                    // sin embudo = del negocio
    if (!mirables.has(suyo)) return delNegocio;             // archivado o el default → SIN_PRODUCTO
    return suyo === funnelId;
  });
}

/**
 * Cantidad de confirmaciones pendientes del workspace actual.
 *
 * ⚠️ HOY TIENE CERO CALL SITES, y si alguien la cablea a una pantalla que muestra UN
 * producto tiene que recibir `ProductoALaVista` igual que `listPendientes` — un contador
 * del workspace al lado de una lista de un producto es exactamente el bug del 30/09/2026
 * («me sigue apareciendo "MaKo movió 3 leads" parado en otro funnel»).
 */
export async function contarPendientes(): Promise<number> {
  try {
    const supabase = await getTenantDb();
    const { count } = await supabase
      .from('mako_confirmaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    return count ?? 0;
  } catch {
    return 0;
  }
}

// estado_lead → cerro (misma tabla que updateLead). Al revertir con .update()
// directo bypassamos updateLead, así que derivamos cerro acá para no romper la
// invariante estado_lead ↔ cerro que leen las queries de Revenue/embudo.
const CERRO_POR_ESTADO: Record<string, boolean | null> = {
  ganado: true, perdido: false, descalificado: false, no_responde: false, abierto: null,
};

/**
 * Resuelve una confirmación:
 *  - 'confirmar' → deja el cambio de MaKo como está.
 *  - 'rechazar'  → revierte (aplica el patch `revert` a la fila del lead).
 *  - 'op:<key>'  → aplica la opción (mueve a opcion.stage por setPipelineStage).
 */
export async function resolverConfirmacion(id: number, decision: string, autor: string): Promise<void> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('mako_confirmaciones').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Confirmación no encontrada');
  const c = data as MakoConfirmacion;
  if (c.estado !== 'pendiente') return;

  let nuevoEstado: 'confirmado' | 'rechazado' = 'confirmado';
  let nota: string;

  if (decision === 'rechazar') {
    nuevoEstado = 'rechazado';
    if (c.aplicado && c.revert && Object.keys(c.revert).length) {
      const patch: Record<string, unknown> = { ...c.revert };
      // Sentinela: quitar SOLO el link que agregó MaKo (no pisar los que sumaron
      // otros flujos entre el apply y el rechazo).
      const removeUrl = typeof patch.fathom_remove_url === 'string' ? patch.fathom_remove_url : null;
      delete patch.fathom_remove_url;
      // Mantener la invariante estado_lead ↔ cerro.
      if (typeof patch.estado_lead === 'string') patch.cerro = CERRO_POR_ESTADO[patch.estado_lead] ?? null;
      if (Object.keys(patch).length) {
        const { error: e2 } = await supabase.from('leads').update(patch).eq('id', c.lead_id);
        if (e2) throw new Error(`No se pudo revertir: ${e2.message}`);
      }
      if (removeUrl) {
        const { data: row } = await supabase.from('leads').select('fathom_links').eq('id', c.lead_id).maybeSingle();
        const rawLinks = row?.fathom_links;
        const links = Array.isArray(rawLinks) ? (rawLinks as Array<{ url?: string }>) : [];
        const filtrados = links.filter((l) => l?.url !== removeUrl);
        if (filtrados.length !== links.length) await supabase.from('leads').update({ fathom_links: filtrados }).eq('id', c.lead_id);
      }
    }
    nota = `MaKo (${c.regla}): rechazado por ${autor}`;
  } else if (decision.startsWith('op:')) {
    const key = decision.slice(3);
    const op = (c.opciones ?? []).find((o) => o.key === key);
    if (!op) throw new Error('Opción inválida');
    if (op.stage) {
      // El botón del modal no abre ningún formulario: si la opción no trae motivo
      // (las de "Marcar Perdido" no lo traen), el lead terminaba en una salida con
      // el motivo de una pérdida ANTERIOR o sin motivo, algo que el wizard del CRM
      // jamás habría dejado pasar. El motivo lo pone la propuesta que el humano
      // acaba de aceptar: la regla + su título es exactamente el porqué.
      const motivo = op.motivo?.trim() || `${c.regla}: ${c.titulo}`;
      // Y se valida con la misma fuente que el CRM: si aun así falta un dato, el
      // movimiento no se hace y la confirmación queda pendiente (el modal muestra
      // el error y el humano puede resolverlo desde la ficha).
      await setPipelineStage(c.lead_id, op.stage, { motivo, requisitos: 'validar' });
    }
    nota = `MaKo (${c.regla}): "${op.label}" por ${autor}`;
  } else {
    nota = `MaKo (${c.regla}): confirmado por ${autor}`;
  }

  const { error: e3 } = await supabase
    .from('mako_confirmaciones')
    .update({ estado: nuevoEstado, resolved_at: new Date().toISOString(), resolved_by: autor })
    .eq('id', id);
  if (e3) throw new Error(`No se pudo cerrar la confirmación: ${e3.message}`);
  try { await logLeadEvent(c.lead_id, 'CRM automático', nota, 'MaKo'); } catch { /* no fatal */ }
}
