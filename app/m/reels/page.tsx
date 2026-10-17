// =============================================================================
// /m/reels — «Reels» (Video › Reels) en el teléfono: MaKo escribe el guion del reel
// =============================================================================
// La tab de escritorio (app/reels) destilada: el MISMO pedido (tema + qué tiene que lograr + duración, opciones
// cerradas de app/reels/reel-pedido.ts), el MISMO motor (`generarReelAction`, que escribe con lib/ig-writer.ts y
// guarda el historial del workspace), el MISMO guion legible para grabar con «Copiar el guion», y el ajuste con
// feedback. Lo que se recorta es texto: sin el párrafo de propósito ni la doctrina de hashtags al pie del caption.
//
// Referencia de app real: el compositor de Instagram al compartir un reel (la portada 9:16 a la izquierda y el pie
// de foto al lado, cortado en el «… más» de los 125 caracteres), y el pedido como la hoja que sube desde abajo en
// ese compositor. El guion entero se lee en una hoja alta, en una columna, como el lector de Ads Writer del
// teléfono (un teleprompter).
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'reels' })` (el `adminOnly` de nav.ts es
// cosmético: sólo esconde la fila de la sidebar). Arriba, la barra de secciones de Video (Editor · Create with AI ·
// Reels), con las que esa persona ve.
// ⚠️ SÓLO LEE al abrir: escritorio marca acá los pasos del onboarding de la tab con el perfil de AHORA; el teléfono
//    no escribe en un GET, y el primer guion los marca igual (`marcarOnboardingTrasGenerar`, app/reels/actions.ts).
// =============================================================================

import './reels.css';
import { requireMovil } from '@/lib/movil-guard';
import { estadoContextoReels, leerHistorial } from '@/app/reels/reels-datos';
import { PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../_creacion/secciones';
import { ReelsM } from './ReelsM';

export const dynamic = 'force-dynamic';

export default async function ReelsPagina() {
  const ctx = await requireMovil({ navKey: 'reels' });
  const [historial, contexto] = ctx.ws == null
    ? [[], null]
    : await Promise.all([leerHistorial(), estadoContextoReels().catch(() => null)]);
  return (
    <PantallaM>
      <SeccionesTabM tab="video" activa="reels" vista={vistaDe(ctx)} />
      <ReelsM historial={historial} perfilListo={contexto?.listo ?? true} />
    </PantallaM>
  );
}
