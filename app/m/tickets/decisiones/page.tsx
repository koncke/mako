// =============================================================================
// /m/tickets/decisiones — la Ticketera en el teléfono (en la URL: /tickets/decisiones)
// =============================================================================
// Es la pantalla para la que se pensó el mazo (deslizar con el dedo): el MISMO componente que la
// computadora (app/tickets/decisiones/Mazo.tsx), dentro del shell del teléfono. Se entra desde
// More («Ticketera») y es LA vista; la lista (/m/decisiones) es la secundaria, con el selector de
// arriba. Pantalla de TRABAJO: sin la barra de abajo (✕, Resuelta y ✓ viven en la franja del
// pulgar), y «‹ More» vuelve a donde se entró.
//
// ⚠️ SÓLO EL SUPER ADMIN, y antes de requireMovil: el admin global sin cliente en la pestaña iría
// a Today (lib/movil-guard.ts), así que se lo trae acá con el workspace de la plataforma.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_MAS } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
import { MazoDecisiones } from '@/app/tickets/decisiones/Mazo';
import '@/app/tickets/decisiones/mazo.css';
import '@/app/tickets/decisiones/vistas.css';

export const dynamic = 'force-dynamic';

export default async function TicketeraMovil() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs('/m/tickets/decisiones', await wsSuperAdmin()));
  await requireMovil({ onboarding: false });
  const lectura = await leerDecisiones();
  return (
    <PantallaM>
      <CabeceraM titulo="Ticketera" trabajo padre={{ href: RUTA_MAS, label: 'More' }} />
      <MazoDecisiones lectura={lectura} responder={responderDecision} deshacer={deshacerDecision} />
    </PantallaM>
  );
}
