// =============================================================================
// notificaciones — CRUD del feed in-app (tabla notificaciones, mig. 0048)
// =============================================================================
// Nunca rompe al caller: si Supabase no está configurado o falla, loguea y
// devuelve un fallback vacío (igual que el resto de las lecturas del repo). Así
// un fallo del feed jamás tumba un cron ni una página.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type NotifSeveridad = 'info' | 'ok' | 'warn' | 'urgente';
export type CanalWa = 'no' | 'pendiente' | 'enviado';

export type Notificacion = {
  id: number;
  tipo: string;
  severidad: NotifSeveridad;
  titulo: string;
  descripcion: string | null;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  leido: boolean;
  canalWa: CanalWa;
  createdAt: string;
};

type Row = {
  id: number;
  tipo: string;
  severidad: string;
  titulo: string;
  descripcion: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: unknown;
  leido: boolean;
  canal_wa: string;
  created_at: string;
};

function rowToNotif(r: Row): Notificacion {
  return {
    id: r.id,
    tipo: r.tipo,
    severidad: (['info', 'ok', 'warn', 'urgente'].includes(r.severidad) ? r.severidad : 'info') as NotifSeveridad,
    titulo: r.titulo,
    descripcion: r.descripcion,
    link: r.link,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {},
    leido: !!r.leido,
    canalWa: (['no', 'pendiente', 'enviado'].includes(r.canal_wa) ? r.canal_wa : 'no') as CanalWa,
    createdAt: r.created_at,
  };
}

export type NuevaNotificacion = {
  tipo: string;
  severidad?: NotifSeveridad;
  titulo: string;
  descripcion?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  canalWa?: CanalWa;
  origen?: string;
};

/** Inserta una notificación. Devuelve el id, o null si falló (no lanza). */
export async function crearNotificacion(n: NuevaNotificacion): Promise<number | null> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('notificaciones')
      .insert({
        tipo: n.tipo,
        severidad: n.severidad ?? 'info',
        titulo: n.titulo,
        descripcion: n.descripcion ?? null,
        link: n.link ?? null,
        entity_type: n.entityType ?? null,
        entity_id: n.entityId ?? null,
        payload: n.payload ?? {},
        canal_wa: n.canalWa ?? 'no',
        origen: n.origen ?? 'sistema',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: number }).id;
  } catch (err) {
    console.error(`[notificaciones] crear falló: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function listNotificaciones(opts: { limit?: number; soloNoLeidas?: boolean } = {}): Promise<Notificacion[]> {
  try {
    const supabase = getSupabaseServer();
    let q = supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 30);
    if (opts.soloNoLeidas) q = q.eq('leido', false);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(rowToNotif);
  } catch (err) {
    console.error(`[notificaciones] list falló: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function contarNoLeidas(): Promise<number> {
  try {
    const supabase = getSupabaseServer();
    const { count, error } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('leido', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch (err) {
    console.error(`[notificaciones] contar falló: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

export async function marcarLeida(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('notificaciones')
    .update({ leido: true, leido_at: new Date().toISOString() })
    .eq('id', id);
}

export async function marcarTodasLeidas(): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('notificaciones')
    .update({ leido: true, leido_at: new Date().toISOString() })
    .eq('leido', false);
}

// ── Cola de reintento de WhatsApp (fuera de la ventana de 24h) ────────────────
export async function pendientesWhatsapp(): Promise<Notificacion[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('canal_wa', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(rowToNotif);
  } catch (err) {
    console.error(`[notificaciones] pendientesWhatsapp falló: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function setCanalWa(id: number, estado: CanalWa): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from('notificaciones').update({ canal_wa: estado }).eq('id', id);
}
