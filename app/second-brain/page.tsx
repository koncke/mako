// =============================================================================
// /second-brain — el chat con MaKo, y el Mapa del negocio (Analyze)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md (16/10/2026; Martín, por el coordinador: «Termina con todo, faltan mis
// pedidos del Second Brain»): el Second Brain es la casa de todo, y su puerta es un CHAT. A la izquierda la barra de
// chats (el jefe «Second Brain» y sus sub-chats), en el centro la conversación con MaKo, con la cara del Centro de
// Operaciones (ChatSecondBrain.tsx). El grafo de antes es «Mapa»: un acceso arriba de la lista que lo abre en el
// panel, como la Ticketera en el Centro (copiado del botón del grafo de Obsidian).
//
// ⚠️ DOS PUERTAS, Y LAS DOS EN EL SERVIDOR:
//   · el CHAT es de todos los que tienen MaKo (closer y setter incluidos): la clave `mako` de la barra, la misma del
//     chat del teléfono (lib/mako-turno-app.ts → personaDelRequest);
//   · el MAPA (el grafo, las áreas, la skill de Claude con su token) es del admin con la tab en su capa: el mismo corte
//     que las rutas de app/api/second-brain (`soloAdminDeTab`). A quien no le toca, no se le CALCULA: lo que no se
//     ve no viaja (tests/second-brain-chat.test.ts).
// ⚠️ EL MAPA SE CALCULA SÓLO CUANDO SE PIDE (`?panel=mapa`, o un `?area=` de los links de siempre): construir el
//    cerebro son 21 lecturas, y el chat no lo necesita para el primer dibujo.
//
// Lo que se decía acá del grafo, del editor del funnel y de la skill sigue valiendo y vive en VistaCerebro.tsx.

import type { ReactNode } from 'react';
import { Pagina } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { VistaCerebro } from './VistaCerebro';
import { ChatSecondBrain } from './ChatSecondBrain';
import { requireRolWs } from '@/lib/tab-access';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { tokenAgenteVisible } from '@/lib/agente-token';
import { getWorkspaceActual } from '@/lib/workspace';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const enteroDe = (v: string | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export default async function SecondBrainPage({ searchParams }: { searchParams: Promise<{ chat?: string; panel?: string; area?: string }> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'mako' });
  const veMapa = await esAdminDeTab('second-brain');
  const { chat, panel, area } = await searchParams;

  let mapa: ReactNode = null;
  if (veMapa && (panel === 'mapa' || !!area)) {
    // El embudo se configura ENTERO en el pop-up del CRM (29/09/2026): el área se nombra y se linkea, no se dibuja.
    const funnelPanel = (
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: 0, lineHeight: 1.6 }}>
        Tu embudo se configura en el{' '}
        <Link href="/crm?embudo=1" style={{ color: 'var(--primary)', fontWeight: 600 }}>CRM</Link>:
        las etapas, la nutrición y cómo entra tu gente.
      </p>
    );
    const ws = await getWorkspaceActual();
    const [cerebro, agenteActual] = await Promise.all([
      construirCerebro(),
      // Sólo la pista y el alcance: el token se muestra una vez, al acuñarlo (09/10/2026).
      ws == null ? Promise.resolve(null) : tokenAgenteVisible(ws).catch(() => null),
    ]);
    // `APP_BASE_URL` y no una variable de entorno a mano: la skill salía con `BASE=` vacío (lib/app-url.ts).
    mapa = <VistaCerebro cerebro={cerebro} funnelPanel={funnelPanel} agenteActual={agenteActual} appUrl={APP_BASE_URL} />;
  }

  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* En modo CLARO desde el 16/10/2026 («pon en white mode la tab de Second Brain», Martín): se fueron TemaOscuro y
          TemaOscuroScript, que la pintaban oscura. */}
      <ChatSecondBrain veMapa={veMapa} mapa={mapa} chatInicial={enteroDe(chat)} />
    </Pagina>
  );
}
