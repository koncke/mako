// =============================================================================
// /image-editor/<id> — el editor de un diseño
// =============================================================================
// Mismo guard que el inicio (../acceso.ts: la pregunta de toda tab). El id es el
// del diseño en la base (image_disenos, mig 0278); si no existe, la pantalla lo
// dice y vuelve al inicio.
//
// Mismo marco que el Video Editor: la barra lateral y la de secciones se quedan
// (pedido de Martín del 12/10 para el Video Editor) y el editor llena el alto que
// queda debajo de las secciones.

import { getWorkspaceActual } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { requireEditorImagen } from '../acceso';
import { ImageEditorCliente } from '../ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorDisenoPage({ params }: { params: Promise<{ diseno: string }> }) {
  await requireEditorImagen();
  const ws = await getWorkspaceActual();
  const { diseno } = await params;
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px))', display: 'flex', flexDirection: 'column' }}>
      <ImageEditorCliente vista="editor" disenoId={diseno} ws={ws} />
    </Pagina>
  );
}
