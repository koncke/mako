// =============================================================================
// aviso-ritmo-descartar — «descartarlos ahí mismo», desde el aviso al activar (lib/ritmo-al-activar.ts)
// =============================================================================
// Lo usan el cartel de la computadora (AvisoRitmoConfirm) y la hoja del teléfono. Nunca prende nada: vuelve con el aviso de
// nuevo, ya sin esos borradores, y la persona decide si activa. Nunca tira.
// =============================================================================

import type { AvisoDeRitmo } from '@/lib/ritmo-al-activar';

export type ResultadoDescarte = { ok: true; aviso: AvisoDeRitmo } | { ok: false; error: string };

export async function descartarViejosDelAviso(id: number, ids: readonly number[], incluirExistentes = false): Promise<ResultadoDescarte> {
  try {
    const r = await fetch('/api/whatsapp/secuencias', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, descartarViejosIds: ids, ...(incluirExistentes ? { incluirExistentes: true } : {}) }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; descartados?: number; ritmo?: AvisoDeRitmo | null } | null;
    if (!j?.ok) return { ok: false, error: j?.error || 'No se pudieron descartar. Prueba de nuevo.' };
    const n = Number(j.descartados) || 0;
    const hecho = n === 1 ? 'Descarté 1 borrador.' : `Descarté ${n} borradores.`;
    const resto = j.ritmo ?? { texto: '', sinGoteo: false, sinHorario: false, poner: null, rotulo: null, viejos: null };
    return { ok: true, aviso: { ...resto, texto: [hecho, resto.texto].filter(Boolean).join(' ') } };
  } catch {
    return { ok: false, error: 'Sin conexión. Prueba de nuevo.' };
  }
}
