// =============================================================================
// /m/ai-avatar/avatares — «AI Avatar › Avatars» en el teléfono: tus avatares y crear un look
// =============================================================================
// La sección de escritorio (app/ai-avatar/avatares, Avatares en AiAvatarCliente.tsx) destilada: «Tus avatares» (los
// looks hechos y los avatares de tus anuncios, con los que están en camino) y «Crear un look» (tu foto + un tema de
// la galería → `crearLookAction`, una imagen de Flow con tu cara). Tocar un avatar abre Create video con él elegido.
//
// Referencia de app real: HeyGen en el teléfono («My Avatars» como una grilla de retratos 9:16, y crear un look
// eligiendo foto y tema en una hoja que sube). Las imágenes no gastan créditos de Flow (lo dice escritorio); igual
// se generan sólo con el botón, y con el puente vivo.
// Quién: `requireMovil` con la key de la sección y la puerta de escritorio (sólo el super admin, ../puerta.ts).
// La query: `?plantilla=` abre la hoja con ese tema elegido (el «Usar» de Templates), como escritorio.
// =============================================================================

import '../ai-avatar.css';
import { requireMovil } from '@/lib/movil-guard';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { inicioAvatarAction } from '@/app/ai-avatar/actions';
import { plantillaPorId } from '@/lib/ai-avatar/plantillas';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../../_creacion/secciones';
import { requireAiAvatarM } from '../puerta';
import { AvataresM } from './AvataresM';

export const dynamic = 'force-dynamic';

type Sp = Record<string, string | string[] | undefined>;

export default async function AvataresPagina({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await requireMovil({ navKey: 'ai-avatar-avatares' });
  await requireAiAvatarM();
  const sp = await searchParams;
  const inicio = await inicioAvatarAction();
  const plantilla = typeof sp.plantilla === 'string' ? plantillaPorId(sp.plantilla.slice(0, 80))?.id : undefined;
  return (
    <PantallaM>
      {/* Sin fila en SECCIONES_MAS (lib/movil-creacion.ts dice por qué): la cabecera la pone la page. */}
      <CabeceraM titulo="AI Avatar" padre={{ href: RUTA_MAS, label: 'More' }} />
      <SeccionesTabM tab="ai-avatar" activa="ai-avatar-avatares" vista={vistaDe(ctx)} />
      {inicio.ok ? <AvataresM inicio={inicio} plantillaInicial={plantilla} /> : <ErrorM frase={inicio.error} />}
    </PantallaM>
  );
}
