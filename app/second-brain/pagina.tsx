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
import { chatsMakoDeQuienMira } from '@/lib/cerebro-chats';
import { cerebroQueSeDibuja, quienOpera } from '@/lib/second-brain-opera';
import { resumenDelRecolector } from '@/lib/recolector';
import { estaImpersonando } from '@/lib/workspace';
import { AprendeSolo } from './AprendeSolo';
import { OPCION_ARMAR } from '@/lib/offer-reglas';
import type { DatosCentro } from '@/app/admin/operaciones/useCentro';
import { esVistaTicketera } from '@/app/tickets/decisiones/reglas';
// La Ticketera vive adentro de Ops Center (16/10/2026): sus hojas las importa la página (CambioVista.tsx lo explica).
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';
import '@/app/admin/runway/decisiones.css';
import '@/app/tickets/bandeja/bandeja.css';

/** `?offer=` y `?antes=` (21/10/2026): la conversación de Offer o el chat de antes abierto, que se siguen en el Ops Center. */
export type QuerySecondBrain = { coach?: string; grupo?: string; chat?: string; offer?: string; antes?: string; panel?: string; area?: string; centro?: string; ticketera?: string; recorrido?: string };

/** ¿La URL pide el Mapa? `?panel=mapa`, o un `?area=` de los links de siempre. */
export const pideElMapa = (q: QuerySecondBrain): boolean => q.panel === 'mapa' || !!q.area;

/** El Mapa: el grafo del negocio, con el editor de cada área (VistaCerebro.tsx). Sólo adentro del `if` del Mapa de cada
 *  página. Sin la skill de Claude desde el 17/10/2026 (Martín: «fuera el botón Conectar a Claude, el Centro ya lo hace por
 *  defecto»): el token se sigue acuñando en /integraciones. */
export async function mapaDelSecondBrain(): Promise<ReactNode> {
  // El embudo se configura ENTERO en el pop-up del CRM (29/09/2026): el área se nombra y se linkea, no se dibuja.
  const funnelPanel = (
    <p style={{ fontSize: 14, color: 'var(--dim)', margin: 0, lineHeight: 1.6 }}>
      Tu embudo se configura en el{' '}
      <Link href="/crm?embudo=1" style={{ color: 'var(--primary)', fontWeight: 600 }}>CRM</Link>:
      las etapas, la nutrición y cómo entra tu gente.
    </p>
  );
  // Con los chats con MaKo de quien mira: son suyos, así que sólo los suma la pantalla (lib/cerebro-chats.ts). Y para
  // quien OPERA (el super admin, con la misma guarda del Centro), UN cerebro con la construcción de MaKo colgada de la
  // raíz, acomodado entero en el servidor (20/10/2026: nunca dos). A los demás no se les arma ni se les manda.
  // «Aprende solo» (25/10/2026, el recolector: lib/recolector.ts): de qué fuentes aprende el negocio y cuánto entró. El super
  // admin mirando un negocio ve cuánto, no qué (docs/diseno-second-brain-recolector.md §4); el que opera (su propio grafo,
  // el de la plataforma) también lo ve, con lo suyo.
  const [chatsMako, opera, recolector, mirando] = await Promise.all([
    chatsMakoDeQuienMira(), quienOpera(), resumenDelRecolector(), estaImpersonando().catch(() => true),
  ]);
  const cerebro = await cerebroQueSeDibuja(await construirCerebro({ chatsMako }), opera);
  return <VistaCerebro cerebro={cerebro} funnelPanel={funnelPanel} aprendeSolo={<AprendeSolo resumen={recolector} soloCuentas={mirando} />} />;
}

/** La guarda vive en lib/second-brain-opera.ts (la usa también la ruta del grafo vivo, que no puede importar esta página). */
export { quienOpera };

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
  // `tarjetas` y `lista` (las preguntas de los chats) ya no se dibujan: los links de antes abren los tickets. Para el super admin
  // es su Ticketera; para el cliente, la suya (23/10/2026: también vive en la URL, lib/ops-center-navegar.ts).
  const ticketera = esVistaTicketera(q.ticketera) ? 'tickets' : null;
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* En modo CLARO desde el 16/10/2026 («pon en white mode la tab de Second Brain», Martín). */}
      <ChatSecondBrain veMapa={veMapa} mapa={mapa} chatInicial={chat} offerInicial={enteroDe(q.offer)} antesInicial={enteroDe(q.antes)} funnelInicial={q.coach === 'funnel'}
        opcionArmar={OPCION_ARMAR} centro={centro}
        centroInicial={centro ? claveCentro : null} ticketeraInicial={ticketera} inicio={inicio} />
    </Pagina>
  );
}
