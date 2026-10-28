'use client';

// =============================================================================
// agregar-al-crm — «Agregar al CRM» de un chat, el mismo desde la cabecera y desde el «⋯» de la fila (27/10/2026)
// =============================================================================
// Martín (27/10/2026): «Los 3 puntitos del chat, no debería decir nada de "Cerrar" o posponer, ahí deberían haber otras
// opciones, entre esas, la de agregar al CRM». Hasta acá el alta vivía adentro de VentanaChat.tsx; ahora la llaman las dos
// puertas, así que la misma acción no se hace de dos formas según dónde se tocó.
//   · WhatsApp: `crearLeadDesdeWhatsappAction` (el server elige el NOMBRE: el de la agenda, nunca el teléfono).
//   · Instagram / Messenger: POST /api/chats/lead (une por `lead_id`, nunca por teléfono).
// Con 2+ funnels y ninguno elegido el server no crea: devuelve la lista (`elegir`) y la pantalla pregunta.
// =============================================================================

import type { ChatResumen } from '@/lib/chats-tipos';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import { esNombreDeTelefono } from '@/lib/contacto-lead';
import { crearLeadDesdeWhatsappAction } from '@/app/crm/actions';
import { postJson } from './ventana-piezas';

export type AltaDeChat =
  | { ok: true; leadId: number; aviso?: { titulo: string; detalle: string | null } }
  | { ok: false; elegir: ProductoParaAlta[] }
  | { ok: false; error: string | null };

/** ¿Este chat se puede agregar? Tiene que tener una identidad que dé de alta (un grupo no tiene teléfono de persona). */
export function sePuedeAgregar(chat: Pick<ChatResumen, 'leadId' | 'canales'>): boolean {
  if (chat.leadId != null) return false;
  return chat.canales.some((c) => (c.canal === 'whatsapp' && !!c.telefono) || c.canal === 'instagram' || c.canal === 'messenger');
}

/**
 * El nombre que la pantalla le propone al server: el que se ve, salvo que sea el teléfono (sin nombre, el server busca el
 * de la agenda; si tampoco hay, nace sin nombre). ⚠️ Antes mandaba `chat.nombre || telefono`.
 */
export function nombrePropuesto(chat: Pick<ChatResumen, 'nombre'>, telefono: string | null): string {
  const n = chat.nombre.trim();
  return !n || n === 'Sin nombre' || esNombreDeTelefono(n, telefono) ? '' : n;
}

export async function agregarChatAlCrm(chat: Pick<ChatResumen, 'nombre' | 'canales'>, funnelId: number | null): Promise<AltaDeChat> {
  const wa = chat.canales.find((c) => c.canal === 'whatsapp' && !!c.telefono) ?? null;
  const social = chat.canales.find((c) => c.canal === 'instagram' || c.canal === 'messenger') ?? null;
  if (wa?.telefono) {
    const r = await crearLeadDesdeWhatsappAction(nombrePropuesto(chat, wa.telefono), wa.telefono, funnelId);
    // Con `else` y no con un ternario: así la respuesta queda estrechada al choque y se le lee el motivo.
    if ('id' in r) return { ok: true, leadId: r.id };
    if (r.elegir) return { ok: false, elegir: r.elegir };
    // Ya estaba: con UN candidato ése ES el lead de este teléfono. Con varios no se elige el primero.
    if (r.coincidencias.length === 1) {
      return { ok: true, leadId: r.coincidencias[0].id, ...(r.errorAlAgregar ? { aviso: { titulo: 'No se pudo agregar', detalle: r.errorAlAgregar } } : {}) };
    }
    return { ok: false, error: r.error ?? null };
  }
  if (social) {
    const j = await postJson<{ ok: boolean; leadId?: number; error?: string; elegir?: ProductoParaAlta[] }>('/api/chats/lead', { convId: Number(social.ref), funnelId });
    if (j.ok && j.leadId) return { ok: true, leadId: j.leadId };
    if (j.elegir?.length) return { ok: false, elegir: j.elegir };
    return { ok: false, error: j.error ?? null };
  }
  return { ok: false, error: 'Este chat no tiene un teléfono ni una cuenta para darlo de alta.' };
}
