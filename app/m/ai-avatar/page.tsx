// =============================================================================
// /m/ai-avatar — «AI Avatar › Create video» en el teléfono: elegir el avatar, escribir el guion, generar
// =============================================================================
// La tab de escritorio (app/ai-avatar, la copia de HeyGen) destilada. Sus cuatro secciones son cuatro pantallas
// (Create video · Avatars · Voices · Templates), con la barra de secciones arriba, como en escritorio. Ésta es la
// primera: el MISMO flujo (avatar → guion → «Generar video») con el MISMO motor (`crearVideoAction` arma el plan del
// Video Generator con el guion literal; cada toma se filma con `generarTomaAction`, por app/ai-avatar/filmar.ts).
//
// Referencia de app real: HeyGen en el teléfono (su flujo de «Avatar video»: elegir el avatar en una grilla de
// retratos, el guion a pantalla llena, «Generate» abajo). Copiado de su estructura, no de su marca.
//
// ⚠️ GASTAR CRÉDITOS DE FLOW DESDE EL TELÉFONO: sólo si la persona lo pide, con el botón que lo dice y la
//    consecuencia pegada arriba («Cada toma gasta créditos de tu cuenta de Flow»), como en escritorio. Nada se filma
//    solo, y el puente (la extensión de MaKo en la computadora) tiene que estar vivo: si no, el botón está apagado con
//    el motivo. Las tomas se filman mientras esta pantalla esté abierta (el lazo corre en el navegador, como allá).
// Quién: `requireMovil` con la key de la sección y la puerta de escritorio (sólo el super admin, ./puerta.ts).
// La query: `?avatar=` (el avatar elegido en Avatars) y `?plantilla=` (el guion de ejemplo de una plantilla), como
// app/ai-avatar/page.tsx.
// =============================================================================

import './ai-avatar.css';
import { requireMovil } from '@/lib/movil-guard';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { inicioAvatarAction } from '@/app/ai-avatar/actions';
import { plantillaPorId } from '@/lib/ai-avatar/plantillas';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../_creacion/secciones';
import { requireAiAvatarM } from './puerta';
import { CrearVideoM } from './CrearVideoM';

export const dynamic = 'force-dynamic';

type Sp = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 120) : undefined);

export default async function AiAvatarPagina({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await requireMovil({ navKey: 'ai-avatar-crear' });
  await requireAiAvatarM();
  const sp = await searchParams;
  const inicio = await inicioAvatarAction();
  const plantilla = plantillaPorId(uno(sp.plantilla) ?? '');
  return (
    <PantallaM>
      {/* Sin fila en SECCIONES_MAS (lib/movil-creacion.ts dice por qué): la cabecera la pone la page. */}
      <CabeceraM titulo="AI Avatar" padre={{ href: RUTA_MAS, label: 'More' }} />
      <SeccionesTabM tab="ai-avatar" activa="ai-avatar-crear" vista={vistaDe(ctx)} />
      {inicio.ok
        ? <CrearVideoM inicio={inicio} avatarInicial={uno(sp.avatar)} guionInicial={plantilla?.guion ?? ''} />
        : <ErrorM frase={inicio.error} />}
    </PantallaM>
  );
}
