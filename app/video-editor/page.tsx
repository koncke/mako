// =============================================================================
// /video-editor — el Video Editor (copia de CapCut), sin proyecto en la ruta
// =============================================================================
// La page sólo aplica el guard (./acceso.ts: hoy, sólo el super admin; adentro,
// el de toda tab con la key exacta del nav). Todo lo demás corre
// en el navegador: el motor (portado de OpenCut classic, MIT, en `_opencut/`)
// guarda los proyectos en IndexedDB/OPFS y renderiza con WebGPU/WebCodecs, así
// que no hay nada que leer del server para dibujar la lista.
//
// Desde el 27/10/2026 esta ruta YA NO ES la grilla de proyectos: abre el editor
// con el ÚLTIMO proyecto que se tocó, con el chat de MaKo y la lista de proyectos
// en la tarjeta de la izquierda (_opencut/marco.tsx), y deja en la barra la URL
// de ese proyecto (`history.replaceState`, sin navegar). Sin ningún proyecto, en
// lugar del editor va «Crear proyecto». Martín: «que los "proyectos" se vean en
// la barra del costado, y que no cambie de ruta».
//
// Onboarding: la tab ES la herramienta, así que su onboarding es su estado
// vacío («Crear proyecto»), sin entrada en el catálogo (la regla del 05/10, como
// /api-mako y el Dashboard).

import { getWorkspaceActual } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { requireEditorVideo } from './acceso';
import { Pagina } from '@/app/_ui';
import { VideoEditorCliente } from './VideoEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorPage() {
  await requireEditorVideo();
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts). Y las señales del negocio, como
  // la page de un proyecto: acá también se abre el editor, con su pestaña Plantillas.
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  return (
    // Menos la barra de arriba (`--barra-agencia`: la de «Estás viendo el dashboard de…» o la alerta de la voz caída): la regla
    // global sólo corrige un alto que EMPIEZA con `height: 100vh`, y éste es un `calc(` (docs/hallazgos-ui.md, 22/10/2026).
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px) - var(--barra-agencia, 0px))', display: 'flex', flexDirection: 'column' }}>
      <VideoEditorCliente vista="inicio" ws={ws} senales={senales} />
    </Pagina>
  );
}
