// =============================================================================
// /image-editor — el Image Editor (copia de Canva sobre Doory): el inicio
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: la pregunta de toda tab). Todo lo
// demás corre en el navegador: el motor (Doory portado, fabric.js 7, en `_doory/`)
// y la lista de diseños, que pide /api/image-editor/disenos (la base, mig 0278).
//
// Onboarding: la tab ES la herramienta, así que su onboarding es su estado vacío
// («Crear un diseño»), sin entrada en el catálogo (la regla del 05/10, como el
// Video Editor).

import { getWorkspaceActual } from '@/lib/workspace';
import { Pagina } from '@/app/_ui';
import { requireEditorImagen } from './acceso';
import { ImageEditorCliente } from './ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorPage() {
  await requireEditorImagen();
  const ws = await getWorkspaceActual();
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px))', display: 'flex', flexDirection: 'column' }}>
      <ImageEditorCliente vista="inicio" ws={ws} />
    </Pagina>
  );
}
