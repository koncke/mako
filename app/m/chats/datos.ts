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
//
// ⚠️ ACOTADA, NO EL ESPEJO ENTERO (medido el 14/10/2026). La bandeja de escritorio barre hasta
// 20 páginas de wa_mensajes EN SERIE: en el ws1 son 19 páginas y 5,5-7,8 s de servidor (los
// mismos que hacían tardar 8-12 s al CRM viejo del teléfono). Acá se leen las últimas
// `PAGINAS_RECIENTES` páginas (los mensajes más nuevos) sin la agenda de contactos, y el nombre
// sale de los leads de ESAS filas (una consulta con `.in`), no de la cartera entera (1,45 MB).
// Lo que cambia: una conversación cuyo último mensaje quedó más atrás de esos 3000 no aparece,
// y «Sin responder» cuenta sobre las recientes.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { rotuloSinTexto } from '@/lib/crm-movil';
import { getConversacionesNoOficial } from '@/lib/evolution-mensajes';
import { haceCuanto } from '@/app/m/crm/reglas';

/** Cuántos chats viajan al teléfono. Lo demás, en la bandeja de la computadora. */
const TOPE = 40;
/** Cuántas páginas de 1000 mensajes (los más nuevos) se leen. Ver la cabecera. */
const PAGINAS_RECIENTES = 3;

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
    const [tz, hoy, convs] = await Promise.all([
      ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : Promise.resolve(TZ_DEFAULT),
      hoyEnWorkspace(),
      getConversacionesNoOficial(600, false, null, { paginas: PAGINAS_RECIENTES, conAgenda: false }),
    ]);
    const ahora = Date.now();
    const vistos = new Set<number>();
    const elegidas: typeof convs = [];
    let sinLead = 0;
    let sinResponder = 0;
    // Vienen de la más reciente a la más vieja. Las de `total: 0` son los leads en Nutrición-Manual
    // que la bandeja de escritorio suma SIN mensajes (para poder escribirles): acá no son un chat.
    for (const c of convs) {
      if (c.bloqueado || c.total === 0) continue;
      if (c.leadId == null) { sinLead++; continue; }
      if (vistos.has(c.leadId)) continue;
      vistos.add(c.leadId);
      if (c.ultimoEntrante) sinResponder++;
      if (elegidas.length < TOPE) elegidas.push(c);
    }
    // El nombre del CRM de las que se dibujan, en UNA consulta chica.
    const ids = elegidas.map((c) => c.leadId as number);
    const nombres = new Map<number, string>();
    if (ids.length) {
      const db = await getTenantDb();
      const { data } = await db.from('leads').select('id, nombre').in('id', ids);
      for (const l of (data ?? []) as Array<{ id: number; nombre: string | null }>) {
        const n = l.nombre?.trim();
        if (n) nombres.set(l.id, n);
      }
    }
    const filas = elegidas.map((c): FilaChatM => {
      const texto = c.ultimoTexto?.trim() || rotuloSinTexto(c.ultimoTipo);
      return {
        leadId: c.leadId as number,
        nombre: nombres.get(c.leadId as number) || c.nombre || 'Sin nombre',
        ultimo: c.ultimoEntrante ? texto : `Tú: ${texto}`,
        riel: haceCuanto(c.ultimaFecha, ahora, tz, hoy),
        sinResponder: c.ultimoEntrante,
      };
    });
    return { filas, sinResponder, sinLead };
  } catch (e) {
    console.error('[m/chats] no se pudo leer:', e instanceof Error ? e.message : e);
    return null;
  }
}
