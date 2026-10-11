// =============================================================================
// /video-editor — el Video Editor (copia de CapCut): la pantalla de inicio
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: hoy, sólo el super admin; adentro,
// el de toda tab con la key exacta del nav). Todo lo demás corre
// en el navegador: el motor (portado de OpenCut classic, MIT, en `_opencut/`)
// guarda los proyectos en IndexedDB/OPFS y renderiza con WebGPU/WebCodecs, así
// que no hay nada que leer del server para dibujar la lista.
//
// Onboarding: la tab ES la herramienta, así que su onboarding es su estado
// vacío («Crear proyecto»), sin entrada en el catálogo (la regla del 05/10, como
// /api-mako y el Dashboard).

import { getWorkspaceActual } from '@/lib/workspace';
import { requireEditorVideo } from './acceso';
import { Pagina } from '@/app/_ui';
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';
import { VideoEditorCliente } from './VideoEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorPage() {
  await requireEditorVideo();
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const ws = await getWorkspaceActual();
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TemaOscuroScript />
      <VideoEditorCliente vista="inicio" ws={ws} />
    </Pagina>
  );
}
