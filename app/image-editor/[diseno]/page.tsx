// =============================================================================
// /image-editor/<id> — el editor de un diseño
// =============================================================================
// Mismo guard que el inicio (../acceso.ts: la pregunta de toda tab). El id es el
// del diseño en la base (image_disenos, mig 0278); si no existe, la pantalla lo
// dice y vuelve al inicio.
//
// La pantalla de Create (app/_crear/PantallaCrear.tsx, 29/10/2026): el chat de MaKo del editor a la izquierda, siempre
// abierto, y el editor en el centro, del alto de la ventana (`ESTILO_PAGINA_CREAR`, el de toda tab de Create).
//
// Las señales del negocio (lib/plantillas-sugeridas-server.ts) se leen acá, en paralelo:
// el panel de plantillas abre con las sugeridas primero y no salta (../mako/plantillas.ts).

import { getWorkspaceActual } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { nombreDelNegocio } from '@/lib/carruseles/marca';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { requireEditorImagen } from '../acceso';
import { ImageEditorCliente } from '../ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorDisenoPage({ params }: { params: Promise<{ diseno: string }> }) {
  await requireEditorImagen();
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  const { diseno } = await params;
  const negocio = await nombreDelNegocio(ws);
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <ImageEditorCliente vista="editor" disenoId={diseno} ws={ws} negocio={negocio} senales={senales} />
    </Pagina>
  );
}
