// =============================================================================
// /m/mako — el chat con MaKo del teléfono ahora es el Second Brain
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 3 (16/10/2026): el chat vive en /m/second-brain (el mismo
// ChatMako.tsx, con el Mapa para el admin). SE REDIRIGE, NO SE BORRA: lo siguen links viejos, avisos y la vuelta del
// escritorio. Con `rutaConWs`, o el super admin mirando a un cliente terminaría en su propio workspace.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/m/second-brain'));
}
