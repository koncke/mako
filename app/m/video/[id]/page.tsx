// =============================================================================
// /m/video/<id> — un anuncio, en su pantalla de trabajo (sin título grande ni barra de abajo)
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="editor". El id es el del plan en el
// historial de escritorio (`/video-generator?plan=<id>`), y se busca en el historial del
// workspace del request: un id de otro negocio simplemente no está.
//
// ⚠️ SÓLO LEE (../datos.ts). Ver el anuncio y descargarlo, sí; filmar de nuevo, cambiar lo que
// dice una toma, ajustar los cortes y montar, en la computadora.
// =============================================================================

import '../video.css';
import { requireMovil } from '@/lib/movil-guard';
import { CabeceraM, ComputadoraM, VacioM } from '@/app/m/_ui';
import { leerVideo } from '../datos';
import { EditorVideoM } from './EditorVideoM';

export const dynamic = 'force-dynamic';

export default async function VideoAnuncioPagina({ params }: { params: Promise<{ id: string }> }) {
  await requireMovil({ navKey: 'video-generator' });
  const { id } = await params;
  // Los ids son `crypto.randomUUID()` (app/video-generator/actions.ts): no llevan nada que
  // decodificar, y un `decodeURIComponent` sobre un `%` suelto tiraría la página entera.
  const video = await leerVideo(id);

  if (!video) {
    return (
      <>
        <CabeceraM titulo="Video Generator" />
        <VacioM frase="Este anuncio ya no está." />
        <ComputadoraM que="Crear anuncios y filmar tomas" />
      </>
    );
  }

  return <EditorVideoM titulo={video.titulo} plan={video.plan} montaje={video.montaje} />;
}
