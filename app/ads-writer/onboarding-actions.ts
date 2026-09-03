'use server';

// =============================================================================
// Las actions del onboarding del Copy Generator (/ads-writer)
// =============================================================================
// Molde: `app/video-generator/onboarding-actions.ts`. El estado vive en
// `app_settings` vía lib/tab-onboarding-state.ts, con keys `cg_*` para no
// colisionar con los pasos compartidos de otras tabs (el gotcha de
// KEY_PASOS_COMPARTIDOS, documentado tres veces en el catálogo).
//
// ⚠️ ESTOS CINCO PASOS VIENEN DEL ONBOARDING GLOBAL. Eran parte del wizard de alta
// —se le pedían a todo cliente nuevo antes de dejarlo entrar a nada— y se mudaron
// acá, que es la tab donde se usan. El detalle del porqué está en lib/capas.ts.
//
// Cada paso lo persiste su PROPIA vista contra su propio endpoint (EntregableView
// contra /api/onboarding/entregable, AvataresView contra /api/onboarding/avatares,
// y así): estas actions solo anotan que el paso se completó. Por eso no reciben
// datos — el dato ya se guardó, y duplicar el guardado acá sería tener dos fuentes
// de verdad para lo mismo.

import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

/**
 * El mismo piso que el resto de la tab: admin del workspace.
 *
 * ⚠️ Escrito acá y no importado de otro `use server`: exportar un guard desde un
 * archivo 'use server' lo convierte en una server action llamable desde el
 * navegador, o sea publicar el chequeo de permisos como endpoint. Es la misma nota
 * que ya está escrita en el gemelo del Video Generator.
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede configurar esta tab.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TAB = 'ads-writer';

export type PasoCopyGen = 'cg_entregable' | 'cg_avatares' | 'cg_persona' | 'cg_personalidad' | 'cg_angulos';

/**
 * Marca un paso como hecho.
 *
 * Idempotente: se relee el estado antes de escribir, así volver atrás y avanzar
 * otra vez no reescribe la fecha del paso. Mismo criterio que Carousels y el
 * Video Generator.
 *
 * El orden lo hace valer `marcarPasoTab` contra el catálogo, en el SERVER: no se
 * puede cerrar el último paso sin haber pasado por los anteriores. Ese guard no es
 * teórico — se llegó a él con una clienta delante, con el botón deshabilitado en
 * pantalla y la tab quedando `done` igual.
 */
export async function marcarPasoCopyAction(
  paso: PasoCopyGen,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const tab = await getEstadoTab(TAB);
    if (!tab.steps[paso]?.done) await marcarPasoTab(TAB, paso);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
