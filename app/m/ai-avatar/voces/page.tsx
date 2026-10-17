// =============================================================================
// /m/ai-avatar/voces — «AI Avatar › Voices» en el teléfono: escuchar y elegir cómo suena tu avatar
// =============================================================================
// La sección de escritorio (Voces en app/ai-avatar/AiAvatarCliente.tsx) destilada: la galería de voces con sus
// filtros (acento y género), escuchar cada una, «Agregar a mi cuenta» (`sumarVozAction`, con la key de ElevenLabs
// del cliente) y «Tus voces» (las de su cuenta, `vocesCuentaAction`). Escuchar no gasta nada.
//
// Referencia de app real: la biblioteca de voces de HeyGen en el teléfono (filtros como chips arriba, una fila por
// voz con el botón redondo de escuchar a la derecha). Conectar ElevenLabs queda en la computadora: su conexión se
// abre en el modal de Integraciones, que es de escritorio.
// Quién: `requireMovil` con la key de la sección y la puerta de escritorio (sólo el super admin, ../puerta.ts).
// =============================================================================

import '../ai-avatar.css';
import { requireMovil } from '@/lib/movil-guard';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { vocesCuentaAction } from '@/app/ai-avatar/actions';
import { CabeceraM, PantallaM, SeccionesTabM } from '@/app/m/_ui';
import { nombreTab, seccionesTabM, vistaDe } from '../../_creacion/secciones';
import { requireAiAvatarM } from '../puerta';
import { VocesM } from './VocesM';

export const dynamic = 'force-dynamic';

export default async function VocesPagina() {
  const ctx = await requireMovil({ navKey: 'ai-avatar-voces' });
  await requireAiAvatarM();
  const secciones = seccionesTabM('ai-avatar', vistaDe(ctx));
  const r = await vocesCuentaAction();
  const cuenta = r.ok ? { voces: r.voces } : { sinKey: r.sinKey, error: r.error };
  return (
    <PantallaM>
      {/* Sin fila en SECCIONES_MAS (lib/movil-creacion.ts dice por qué): la cabecera la pone la page. */}
      <CabeceraM titulo="AI Avatar" padre={{ href: RUTA_MAS, label: 'More' }} />
      <SeccionesTabM etiqueta={nombreTab('ai-avatar')} secciones={secciones} activa="ai-avatar-voces" />
      <VocesM cuenta={cuenta} />
    </PantallaM>
  );
}
