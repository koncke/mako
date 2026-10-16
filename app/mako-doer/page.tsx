// =============================================================================
// /mako-doer — el chat de lectura de MaKo ahora es el Second Brain
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md (16/10/2026): el chat con MaKo vive en /second-brain, y ése sí tiene
// herramientas y acciones (el turno del teléfono). SE REDIRIGE, NO SE BORRA: lo explica app/mako/page.tsx.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/second-brain'));
}
