// =============================================================================
// /m/video — «Video Generator» en el teléfono: los anuncios en curso y los terminados
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Video Generator (reducido)», y el prototipo
// (docs/prototipos/mako-mobile-v2.html, la pantalla `video`). Muestra «En curso» (los planes del
// historial de escritorio, con su estado) y «Terminados» («Anuncios terminados» de escritorio).
// Un anuncio en curso abre su pantalla de trabajo (/m/video/<id>); uno terminado, un sheet para
// mirarlo y descargarlo.
//
// Quién: la regla del Sidebar para `video-generator` (sólo el admin del negocio), por
// `requireMovil`. Los datos, del workspace del request (getSetting por dentro), nunca de `?ws=`.
// ⚠️ SÓLO LEE (./datos.ts): crear, filmar y ajustar los cortes son de la computadora.
// =============================================================================

import './video.css';
import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, VacioM } from '@/app/m/_ui';
import { leerVideos } from './datos';
import { VideosM } from './VideosM';

export const dynamic = 'force-dynamic';

const COMPU = 'Crear anuncios y filmar tomas';

export default async function VideoPagina() {
  await requireMovil({ navKey: 'video-generator' });
  const { enCurso, terminados } = await leerVideos();

  if (!enCurso.length && !terminados.length) {
    return (
      <>
        <VacioM frase="Todavía no hay anuncios." />
        <ComputadoraM que={COMPU} />
      </>
    );
  }

  return (
    <>
      <VideosM enCurso={enCurso} terminados={terminados} />
      <ComputadoraM que={COMPU} />
    </>
  );
}
