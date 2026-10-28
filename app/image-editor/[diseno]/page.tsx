// =============================================================================
// /image-editor/<id> — el editor de un diseño
// =============================================================================
// Mismo guard que el inicio (../acceso.ts: la pregunta de toda tab). El id es el
// del diseño en la base (image_disenos, mig 0278); si no existe, la pantalla lo
// dice y ofrece tus diseños.
//
// Desde el 27/10/2026 es el MISMO estudio que /image-editor (../editor/Estudio.tsx), arrancando en este diseño: abrir
// otro o crear uno se hace ahí adentro, sin navegar, y la URL se reescribe con `replaceState` (un F5 vuelve acá).
//
// Mismo marco que el Video Editor: la barra lateral y la de secciones se quedan
// (pedido de Martín del 12/10 para el Video Editor) y el editor llena el alto que
// queda debajo de las secciones.
//
// Las señales del negocio (lib/plantillas-sugeridas-server.ts) se leen acá, en paralelo:
// el panel de plantillas abre con las sugeridas primero y no salta (../mako/plantillas.ts).

import { getWorkspaceActual } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { Pagina } from '@/app/_ui';
import { requireEditorImagen } from '../acceso';
import { ImageEditorCliente } from '../ImageEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageEditorDisenoPage({ params }: { params: Promise<{ diseno: string }> }) {
  await requireEditorImagen();
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  const { diseno } = await params;
  return (
    // Menos la barra de arriba (`--barra-agencia`: la de «Estás viendo el dashboard de…» o la alerta de la voz caída): la regla
    // global sólo corrige un alto que EMPIEZA con `height: 100vh`, y éste es un `calc(` (docs/hallazgos-ui.md, 22/10/2026).
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px) - var(--barra-agencia, 0px))', display: 'flex', flexDirection: 'column' }}>
      <ImageEditorCliente disenoId={diseno} ws={ws} senales={senales} />
    </Pagina>
  );
}
