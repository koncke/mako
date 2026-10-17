// =============================================================================
// /m/ai-avatar/plantillas — «AI Avatar › Templates» en el teléfono: la galería de temas
// =============================================================================
// La sección de escritorio (Plantillas en app/ai-avatar/AiAvatarCliente.tsx) destilada: los temas por categoría
// (lib/ai-avatar/plantillas.ts), cada uno con su ejemplo en video si lo hay, escuchar la voz que le queda y «Usar»,
// que lleva a Avatars con ese tema elegido para crear el look (como escritorio). No escribe nada: es un catálogo.
//
// Referencia de app real: la galería de Templates de HeyGen en el teléfono (categorías como chips arriba y una
// grilla de dos columnas de portadas 9:16 que se mueven; tocar una abre su detalle con «Use template»).
// Quién: `requireMovil` con la key de la sección y la puerta de escritorio (sólo el super admin, ../puerta.ts).
// =============================================================================

import '../ai-avatar.css';
import { requireMovil } from '@/lib/movil-guard';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { nombreTab, seccionesTabM, vistaDe } from '../../_creacion/secciones';
import { requireAiAvatarM } from '../puerta';
import { PlantillasM } from './PlantillasM';

export const dynamic = 'force-dynamic';

export default async function PlantillasPagina() {
  const ctx = await requireMovil({ navKey: 'ai-avatar-plantillas' });
  await requireAiAvatarM();
  const secciones = seccionesTabM('ai-avatar', vistaDe(ctx));
  return (
    <PantallaM>
      {/* Sin fila en SECCIONES_MAS (lib/movil-creacion.ts dice por qué): la cabecera la pone la page. */}
      <CabeceraM titulo="AI Avatar" padre={{ href: RUTA_MAS, label: 'More' }} />
      <SeccionesTabM etiqueta={nombreTab('ai-avatar')} secciones={secciones} activa="ai-avatar-plantillas" />
      <PlantillasM />
    </PantallaM>
  );
}
