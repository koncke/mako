// =============================================================================
// /mako — «Pregúntale a MaKo» ahora es el Second Brain
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md (16/10/2026): el chat con MaKo vive en /second-brain, con la cara del Centro
// de Operaciones (app/second-brain/ChatSecondBrain.tsx). Los chats de esta pantalla quedaron en la sección «Antes» de
// la barra, de sólo lectura.
//
// SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): la siguen links viejos de avisos, marcadores y otras
// pantallas. Va con `rutaConWs`, o el super admin mirando a un cliente terminaría en su propio workspace.
// ⚠️ /mako/pendientes y /mako/revisar (la bandeja) SE QUEDAN: los nombran decenas de archivos.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function Page() {
  redirect(await rutaConWs('/second-brain'));
}
