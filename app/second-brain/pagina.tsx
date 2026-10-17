// =============================================================================
// La pantalla del Second Brain y, para el super admin, la de Ops Center: UNA sola (17/10/2026)
// =============================================================================
// Martín, mirando producción (17/10/2026): «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin».
// Las dos rutas son PUERTAS, cada una con su guarda, y las dos dibujan esto:
//   · /second-brain (app/second-brain/page.tsx): la puerta de MaKo (closer y setter incluidos). Para quien `puedeOperar`
//     suma los chats de Claude Code, la Ticketera y el Uso: es Ops Center, abierto en el Second Brain.
//   · /admin/operaciones (app/admin/operaciones/page.tsx): la puerta del super admin (`puedeOperar`, antes de leer
//     nada). Es la misma pantalla, abierta en el Cerebro.
// La pantalla en sí es app/second-brain/ChatSecondBrain.tsx; el motor del Centro, app/admin/operaciones/useCentro.ts.
//
// ⚠️ EL MAPA SE CALCULA SÓLO CUANDO SE PIDE, y sólo para el admin de la tab: cada página llama a `mapaDelSecondBrain`
//    adentro de su `if (veMapa && pideElMapa(q))`. Construir el cerebro son 21 lecturas (tests/second-brain-chat.test.ts).
// ⚠️ `?chat=` dice dos cosas según la puerta de antes: un NÚMERO es una conversación con MaKo (/second-brain) y otra cosa
//    es la clave de un chat de Claude Code (los links de siempre del Centro, `/admin/operaciones?chat=<clave>`).

import type { ReactNode } from 'react';
import { Pagina } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { VistaCerebro } from './VistaCerebro';
import { ChatSecondBrain } from './ChatSecondBrain';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { tokenAgenteVisible } from '@/lib/agente-token';
import { getWorkspaceActual } from '@/lib/workspace';
import { APP_BASE_URL } from '@/lib/app-url';
import type { DatosCentro } from '@/app/admin/operaciones/useCentro';
// La Ticketera vive adentro de Ops Center (16/10/2026): sus hojas las importa la página (CambioVista.tsx lo explica).
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';
import '@/app/admin/runway/decisiones.css';

export type QuerySecondBrain = { chat?: string; panel?: string; area?: string; centro?: string; ticketera?: string };

/** ¿La URL pide el Mapa? `?panel=mapa`, o un `?area=` de los links de siempre. */
export const pideElMapa = (q: QuerySecondBrain): boolean => q.panel === 'mapa' || !!q.area;

/** El Mapa: el grafo del negocio, con el editor del funnel y la skill de Claude (VistaCerebro.tsx). Sólo adentro del `if`
 *  del Mapa de cada página. */
export async function mapaDelSecondBrain(): Promise<ReactNode> {
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
  return <VistaCerebro cerebro={cerebro} funnelPanel={funnelPanel} agenteActual={agenteActual} appUrl={APP_BASE_URL} />;
}

const enteroDe = (v: string | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function PantallaSecondBrain({ veMapa, mapa, centro, q, inicio }: {
  veMapa: boolean;
  mapa: ReactNode | null;
  /** El Centro, sólo para quien `puedeOperar` (app/admin/operaciones/datos.ts): con él, la pantalla es Ops Center. */
  centro: DatosCentro | null;
  q: QuerySecondBrain;
  inicio: 'second-brain' | 'centro';
}) {
  const chat = enteroDe(q.chat);
  const claveCentro = q.centro || (chat == null && q.chat ? q.chat : null);
  const ticketera = centro && (q.ticketera === 'lista' || q.ticketera === 'tarjetas') ? q.ticketera : null;
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* En modo CLARO desde el 16/10/2026 («pon en white mode la tab de Second Brain», Martín). */}
      <ChatSecondBrain veMapa={veMapa} mapa={mapa} chatInicial={chat} centro={centro}
        centroInicial={centro ? claveCentro : null} ticketeraInicial={ticketera} inicio={inicio} />
    </Pagina>
  );
}
