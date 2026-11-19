// =============================================================================
// EL INTERRUPTOR DEL PERSONAJE EN CUBOS DE AI AVATAR (19/11/2026)
// =============================================================================
// Martín, 19/11: que los usuarios de MaKo creen el video animado por código (el personaje en cubos con su voz) dentro de
// AI Avatar. Hasta que él lo apruebe lo ve SÓLO su revisión, la MISMA del onboarding V2 (sus cuentas y el Cliente de
// Prueba, ws 3): un solo grupo de revisión, no dos listas que se separan. Prenderlo para todos es UN cambio,
// `PARA_TODOS = true`. El diseño: docs/editor-video/ai-avatar-por-codigo.md.
//
// Lo preguntan la pantalla (app/ai-avatar/page.tsx) y CADA action de app/ai-avatar/cubos/actions.ts, siempre del lado del
// servidor: el navegador no decide quién lo ve.
// =============================================================================

import { EMAILS_REVISION, WS_REVISION_V2 } from '@/lib/onboarding-v2/revision';

/** Un solo cambio lo prende para todos (cuando Martín lo apruebe). */
export const PARA_TODOS = false;

/** ¿Esta persona, en este negocio, ve el personaje en cubos? */
export function veAvatarCubos(q: { email?: string | null; ws?: number | null }): boolean {
  if (PARA_TODOS) return true;
  const email = (q.email ?? '').trim().toLowerCase();
  if (email && EMAILS_REVISION.includes(email)) return true;
  return q.ws != null && WS_REVISION_V2.includes(q.ws);
}
