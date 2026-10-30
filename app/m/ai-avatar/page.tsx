// =============================================================================
// /m/ai-avatar — AI Avatar en el teléfono: el estudio de Higgsfield, destilado
// =============================================================================
// La tab de escritorio (app/ai-avatar: el estudio de Higgsfield desde el 29/10/2026) en UNA pantalla, como allá: los
// proyectos en una tira con «Nueva» primero, «Nueva» con «¿Qué vas a crear hoy?» y los presets, y cada proyecto con su
// look, sus videos y «Generar video». Sin la barra de secciones: las cuatro de HeyGen se fueron (sus rutas redirigen
// acá). La pantalla y lo que copia: ./EstudioM.tsx; el motor es el de escritorio (app/ai-avatar/actions.ts).
// Quién: `requireMovil` con la key de la sección y la puerta de escritorio (sólo el super admin, ./puerta.ts).
// La query, como escritorio: `?plantilla=` (el preset de «Nueva») y `?avatar=` (un proyecto).
// =============================================================================

import './ai-avatar.css';
import { requireMovil } from '@/lib/movil-guard';
import { inicioAvatarAction } from '@/app/ai-avatar/actions';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { requireAiAvatarM } from './puerta';
import { EstudioM } from './EstudioM';

export const dynamic = 'force-dynamic';

type Sp = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v.slice(0, 120) : undefined);

export default async function AiAvatarPagina({ searchParams }: { searchParams: Promise<Sp> }) {
  await requireMovil({ navKey: 'ai-avatar' });
  await requireAiAvatarM();
  const sp = await searchParams;
  const inicio = await inicioAvatarAction();
  return (
    <PantallaM>
      {inicio.ok
        ? <EstudioM inicio={inicio} plantillaInicial={uno(sp.plantilla)} avatarInicial={uno(sp.avatar)} ahora={Date.now()} />
        : <ErrorM frase={inicio.error} />}
    </PantallaM>
  );
}
