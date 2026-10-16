// =============================================================================
// /video-editor/<id> — el editor de un proyecto
// =============================================================================
// Mismo guard que el inicio (../acceso.ts: hoy, sólo el super admin). El id es el
// del proyecto en el almacenamiento local del motor; si no existe, el
// EditorProvider crea uno nuevo y reemplaza la URL (ver
// _opencut/components/providers/editor-provider.tsx).
//
// `?desde=<ref>` es «Editar en el editor» de Video Generator
// (`/video-editor/nuevo?desde=montaje:12`). La ref se resuelve ACÁ, en el
// workspace de la sesión, y al cliente baja sólo `{ titulo, archivo, url }`: la
// url la arma el server, nunca viene del navegador (../desde/desde.ts).
//
// `?plantilla=<id>` es «Utilizar plantilla» con la línea de tiempo ocupada
// (`/video-editor/nuevo?plantilla=testimonio`, ../plantilla/ArmarPlantilla.tsx). El
// id se valida acá contra el catálogo: al cliente baja el id o `null` (no existe).
//
// Las señales del negocio (lib/plantillas-sugeridas-server.ts) se leen acá, en paralelo:
// la pestaña Plantillas abre con las sugeridas primero y no salta (../sugeridas.tsx).

import { getWorkspaceActual } from '@/lib/workspace';
import { plantillaPorId } from '@/lib/editor-video/plantillas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { VideoEditorCliente } from '../VideoEditorCliente';
import { Pagina } from '@/app/_ui';
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';
import { requireEditorVideo } from '../acceso';
import { resolverDesde } from '../desde/resolver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorProyectoPage({ params, searchParams }: {
  params: Promise<{ proyecto: string }>;
  searchParams: Promise<{ desde?: string | string[]; plantilla?: string | string[] }>;
}) {
  await requireEditorVideo();
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  const { proyecto } = await params;
  const { desde, plantilla } = await searchParams;
  const origen = typeof desde === 'string' && desde ? await resolverDesde(desde) : undefined;
  const idPlantilla = typeof plantilla === 'string' && plantilla ? (plantillaPorId(plantilla)?.id ?? null) : undefined;
  // Mismo marco que el inicio: la barra lateral y la de secciones se quedan (pedido
  // de Martín del 12/10), y el editor llena el alto que queda debajo de las secciones.
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px))', display: 'flex', flexDirection: 'column' }}>
      <TemaOscuroScript />
      <VideoEditorCliente vista="editor" proyectoId={proyecto} ws={ws} desde={origen} plantilla={idPlantilla} senales={senales} />
    </Pagina>
  );
}
