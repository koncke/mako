// =============================================================================
// /m/tickets/decisiones — el mazo de decisiones en el teléfono (en la URL: /tickets/decisiones)
// =============================================================================
// Es la pantalla para la que se pensó el mazo (deslizar con el dedo): el MISMO componente que la
// computadora (app/tickets/decisiones/Mazo.tsx), dentro del shell del teléfono. Pantalla de
// TRABAJO: sin la barra de abajo (✕ y ✓ viven en la franja del pulgar) y con «‹ Tablero», que
// vuelve a la lista entera (/admin/runway).
//
// ⚠️ SÓLO EL SUPER ADMIN, y antes de requireMovil: el admin global sin cliente en la pestaña iría
// a Today (lib/movil-guard.ts), así que se lo trae acá con el workspace de la plataforma. Igual
// que app/m/decisiones/page.tsx.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { CabeceraM } from '@/app/m/_ui';
import { responderDecision } from '@/app/admin/runway/acciones';
import { MazoDecisiones } from '@/app/tickets/decisiones/Mazo';
import '@/app/tickets/decisiones/mazo.css';

export const dynamic = 'force-dynamic';

export default async function DecisionesDeAUnaMovil() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs('/m/tickets/decisiones', await wsSuperAdmin()));
  await requireMovil({ onboarding: false });
  const lectura = await leerDecisiones();
  return (
    <>
      <CabeceraM titulo="Decisiones" trabajo padre={{ href: '/m/decisiones', label: 'Tablero' }} />
      <MazoDecisiones lectura={lectura} responder={responderDecision} tablero="/m/decisiones" />
    </>
  );
}
