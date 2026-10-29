// =============================================================================
// /video-editor — la tab Video de Create sin un proyecto abierto: «¿Qué vas a crear hoy?»
// =============================================================================
// La pantalla de Create (app/_crear/PantallaCrear.tsx, 29/10/2026): el chat de MaKo a la izquierda (su «←» da la lista de
// proyectos) y al centro la caja con las plantillas de «Nuevo video» (./plantillas-crear.ts). La page aplica el guard
// (./acceso.ts: hoy, sólo el super admin; adentro, el de toda tab con la key exacta del nav) y lee las señales del negocio
// para poner primero las plantillas sugeridas. Lo demás corre en el navegador: el motor (portado de OpenCut classic, MIT,
// en `_opencut/`) guarda los proyectos en IndexedDB/OPFS, así que no hay nada que leer del server para la lista.
//
// Sin onboarding: la plantilla es el arranque (29/10/2026, «Nuevo …» con plantillas en todas las tabs de Create).

import { getWorkspaceActual } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { requireEditorVideo } from './acceso';
import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { VideoEditorCliente } from './VideoEditorCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorPage() {
  await requireEditorVideo();
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <VideoEditorCliente vista="inicio" ws={ws} senales={senales} />
    </Pagina>
  );
}
