// =============================================================================
// /m/chats — lo que LEE la pestaña Chats (server), tanda 1 (14/10/2026)
// =============================================================================
// La pestaña Chats del teléfono (v3, aprobada por Martín) junta TODOS los chats integrados. Los
// chats unificados de escritorio (WhatsApp + Instagram + Messenger en una bandeja) todavía no están
// en main, así que esta tanda lee lo que sí está: las conversaciones de WhatsApp, con la MISMA
// lectura de la bandeja de escritorio (`getConversacionesNoOficial`, lib/evolution-mensajes.ts) y
// el mismo criterio de «sin responder» que el CRM del teléfono (el último mensaje es del lead).
// Cuando lleguen los chats unificados, la lectura cambia acá y la pantalla no.
//
// Sólo las conversaciones con lead: el hilo del teléfono es el del lead (/m/crm/<id>/chat). Las
// otras se cuentan y van «en la computadora».
// =============================================================================

import 'server-only';
import { getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { rotuloSinTexto } from '@/lib/crm-movil';
import { getConversacionesNoOficial } from '@/lib/evolution-mensajes';
import { listLeads, type Lead } from '@/lib/leads';
import { haceCuanto } from '@/app/m/crm/reglas';

/** Cuántos chats viajan al teléfono. Lo demás, en la bandeja de la computadora. */
const TOPE = 40;

export type FilaChatM = {
  leadId: number;
  nombre: string;
  /** El último mensaje, con «Tú: » si fue nuestro. */
  ultimo: string;
  riel: string;
  sinResponder: boolean;
};

export type ListaChatsM = { filas: FilaChatM[]; sinResponder: number; sinLead: number };

/** null = no se pudo leer (distinto de «no hay chats»). */
export async function listaChats(): Promise<ListaChatsM | null> {
  try {
    const ws = await getWorkspaceActual();
    const [tz, hoy, convs, leads] = await Promise.all([
      ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
      hoyEnWorkspace(),
      getConversacionesNoOficial(600, false),
      listLeads().catch(() => [] as Lead[]),
    ]);
    const ahora = Date.now();
    const nombres = new Map(leads.map((l) => [l.id, l.nombre?.trim() || null]));
    const vistos = new Set<number>();
    const filas: FilaChatM[] = [];
    let sinLead = 0;
    let sinResponder = 0;
    // Vienen de la más reciente a la más vieja.
    for (const c of convs) {
      if (c.bloqueado) continue;
      if (c.leadId == null) { sinLead++; continue; }
      if (vistos.has(c.leadId)) continue;
      vistos.add(c.leadId);
      const espera = c.ultimoEntrante;
      if (espera) sinResponder++;
      if (filas.length >= TOPE) continue;
      const texto = c.ultimoTexto?.trim() || rotuloSinTexto(c.ultimoTipo);
      filas.push({
        leadId: c.leadId,
        nombre: nombres.get(c.leadId) || c.nombre || 'Sin nombre',
        ultimo: espera ? texto : `Tú: ${texto}`,
        riel: haceCuanto(c.ultimaFecha, ahora, tz, hoy),
        sinResponder: espera,
      });
    }
    return { filas, sinResponder, sinLead };
  } catch (e) {
    console.error('[m/chats] no se pudo leer:', e instanceof Error ? e.message : e);
    return null;
  }
}
