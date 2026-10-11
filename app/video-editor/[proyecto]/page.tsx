// =============================================================================
// /video-editor/<id> — el editor de un proyecto
// =============================================================================
// Mismo guard que el inicio. El id es el del proyecto en el almacenamiento
// local del motor; si no existe, el EditorProvider crea uno nuevo y reemplaza
// la URL (ver _opencut/components/providers/editor-provider.tsx).

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { VideoEditorCliente } from '../VideoEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorProyectoPage({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRolWs([], { nav: 'video-editor' });
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const ws = await getWorkspaceActual();
  const { proyecto } = await params;
  return <VideoEditorCliente vista="editor" proyectoId={proyecto} ws={ws} />;
}
