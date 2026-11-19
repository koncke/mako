// =============================================================================
// La puerta del personaje en cubos: la usan las server actions (./actions.ts) y la ruta del audio subido
// (app/api/ai-avatar/cubos/alinear/route.ts), para que quién pasa se decida en UN lugar.
//   · la de AI Avatar (admin y capa, app/ai-avatar/acceso.ts) y un workspace elegido;
//   · el INTERRUPTOR de la revisión de Martín (lib/ai-avatar/cubos-interruptor.ts);
//   · en lo que GENERA, el candado de MaKo Pro, como el resto del estudio (`candadoDeAiAvatar`).
// =============================================================================

import 'server-only';
import { candadoDeAiAvatar, veAiAvatar } from '../acceso';
import { getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { veAvatarCubos } from '@/lib/ai-avatar/cubos-interruptor';
import { nombreDelNegocioActual } from '@/lib/mako-context';

export type Falla = { ok: false; error: string };

export async function puertaCubos(genera = false): Promise<{ ok: true; ws: number } | Falla> {
  if (!(await veAiAvatar())) return { ok: false, error: 'Todavía no tienes acceso a AI Avatar.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige un workspace arriba para usar AI Avatar.' };
  const s = await getUsuarioActual().catch(() => null);
  if (!s || !veAvatarCubos({ email: s.email, ws })) return { ok: false, error: 'Esto todavía no está disponible.' };
  if (genera) {
    const pro = await candadoDeAiAvatar();
    if (pro) return { ok: false, error: pro };
  }
  return { ok: true, ws };
}

/** El nombre del negocio, para la marca del video (≤ 24 letras). Sin nombre, «MaKo». */
export const marcaDelNegocio = async (): Promise<string> => ((await nombreDelNegocioActual().catch(() => null)) ?? '').trim().slice(0, 24) || 'MaKo';
