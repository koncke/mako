// =============================================================================
// A quién le firma Martín el pedido de un ticket: el chat «Cerebro», con la firma de Ops Center
// =============================================================================
// Martín (17/10/2026): «con cada decisión que yo tome debería mandarse al cerebro y que decida si abre un nuevo chat o se
// lo envía a algún jefe». El Cerebro es un chat de Ops Center más (se llama «Cerebro»: AGENTS.md, «El orquestador se
// llama Cerebro»), y se le escribe por el MISMO camino que la caja: `useFirma` → `mandar.ts`, firmado en este
// dispositivo. Nada de una segunda puerta a la PC.
//
// ⚠️ SIN 'use client' A PROPÓSITO (como mandar.ts): lo usan componentes de cliente; no tiene estado propio.

import type { Centro } from '@/app/admin/operaciones/useCentro';
import { normalizarTitulo } from '@/lib/decisiones-aviso';

export type CerebroParaTickets = {
  titulo: string;
  /** ¿Se le puede mandar ya? Si no, por qué (la bandeja lo dice en el botón). */
  listo: { ok: true } | { ok: false; motivo: string };
  mandar: (texto: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
};

export const NOMBRE_CEREBRO = 'cerebro';

/** El chat «Cerebro» de la lista de Ops Center, listo para firmarle. null = no hay ningún chat que se llame así. */
export function cerebroDelCentro(centro: Pick<Centro, 'chats' | 'destinoDeChat' | 'envioDe' | 'firma'>): CerebroParaTickets | null {
  const chat = centro.chats.find((c) => normalizarTitulo(c.titulo) === NOMBRE_CEREBRO) ?? null;
  if (!chat) return null;
  const envio = centro.envioDe(chat);
  const listo = envio.puede ? { ok: true as const }
    : { ok: false as const, motivo: envio.por === 'sin_clave' ? 'Crea tu Token para firmarle al Cerebro' : envio.por === 'leyendo_clave' ? 'Leyendo tu Token…' : envio.por === 'clave_no_aceptada' ? 'La PC no acepta el Token de este dispositivo' : 'El Cerebro no tiene una sesión a la que escribirle' };
  return {
    titulo: chat.titulo,
    listo,
    mandar: async (texto) => {
      const d = centro.destinoDeChat(chat);
      if (!d.sesion) return { ok: false, error: 'El Cerebro no tiene una sesión a la que escribirle' };
      const r = await centro.firma.mandar({ sesion: d.sesion, cuenta: d.cuenta, titulo: chat.titulo }, texto, 'solo_esto');
      return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
    },
  };
}
