import 'server-only';

// =============================================================================
// /m/ai-avatar — la segunda puerta de las cuatro pantallas: hoy, sólo el super admin
// =============================================================================
// Escritorio cierra AI Avatar con `requireAiAvatar` (app/ai-avatar/acceso.ts: `getSesionAdmin`), y NO con la pregunta
// de toda tab, porque `requireRolWs([], { nav })` deja pasar al admin de CADA workspace. El teléfono hace las dos:
// `requireMovil({ navKey })` en cada page (la sesión, el onboarding, la capa) y después ésta, con el MISMO
// `veAiAvatar`. El día que Martín la abra, cambia app/ai-avatar/acceso.ts y el teléfono la sigue solo.
// Se va a General del teléfono, no a /inicio: un redirect de /m que sale a escritorio saca a la persona de la app.
// =============================================================================

import { redirect } from 'next/navigation';
import { veAiAvatar } from '@/app/ai-avatar/acceso';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';

export async function requireAiAvatarM(): Promise<void> {
  if (!(await veAiAvatar())) redirect(await rutaConWs(HOME_MOVIL));
}
