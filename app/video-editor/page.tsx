// =============================================================================
// /video-editor — la tab Video sin un proyecto abierto: los OUTLIERS primero, y «¿Qué vas a crear hoy?» detrás
// =============================================================================
// 9/11/2026, Martín: «Tal como en imágenes, que se llame Video… vas a ver tus outliers primero». Como Image (./vista.ts):
//   · `/video-editor` → «Encuentra tu siguiente OUTLIER» (./OutliersVideo.tsx), a pantalla completa y sin el chat: los videos que
//     funcionan, de las fuentes enchufadas (lib/video-outliers-servidor.ts), con «Replicar» si MaKo tiene su plantilla guiada;
//   · `?ver=crear` → lo de abajo, la pantalla de Create con «Nuevo video»; `&replicar=<plantilla>` arma ese proyecto al toque.
// Lo de abajo, tal cual, es `?ver=crear`:
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
import { leerOutliersVideo } from '@/lib/video-outliers-servidor';
import { OutliersVideo } from './OutliersVideo';
import { abreElEditor, desarmePedido, familiaDe, recetaPedida, replicarDe, vistaDeVideo } from './vista';
import { desarmadoParaElEditor } from '@/lib/video-desarmar-servidor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VideoEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditorVideo();
  const q = await searchParams;
  if (vistaDeVideo(q) === 'outliers') {
    return (
      <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
        <OutliersVideo portada={await leerOutliersVideo()} familia={familiaDe(q)} />
      </Pagina>
    );
  }
  // El workspace de la pestaña, validado por el proxy: separa el almacenamiento
  // local del motor por cliente (ver espacio.ts).
  const [ws, senales] = await Promise.all([getWorkspaceActual(), senalesDelNegocio().catch(() => null)]);
  // «Abrir en el editor» de un video desarmado (ticket 97, `?desarme=`): la plantilla y la receta se arman ACÁ con lo que guardó
  // este negocio; al cliente no baja la clave, y un video que no está desarmado baja `null`.
  const desarme = desarmePedido(q);
  const desarmado = desarme ? await desarmadoParaElEditor(desarme) : undefined;
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <VideoEditorCliente vista="inicio" ws={ws} senales={senales} desarmado={desarmado} replicar={replicarDe(q)} receta={recetaPedida(q)} alEntrar={abreElEditor(q) ? 'editor' : 'crear'} />
    </Pagina>
  );
}
