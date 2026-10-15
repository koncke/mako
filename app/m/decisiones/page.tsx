// =============================================================================
// /m/decisiones — la Ticketera en lista, en el teléfono (en la URL: /tickets/decisiones/lista)
// =============================================================================
// La vista SECUNDARIA de la Ticketera: la de entrada es el mazo (/m/tickets/decisiones). Con LAS
// MISMAS RUTAS el teléfono abre /tickets/decisiones/lista y el proxy le sirve esta página
// (lib/movil-rutas.ts: rutaMovil y rutaEscritorio). Dibuja la MISMA lista que la computadora
// (app/admin/runway/Tablero.tsx): no hay una copia para el teléfono.
//
// ⚠️ SÓLO EL SUPER ADMIN (getSesionAdmin), como en la computadora. Y antes de requireMovil:
// el admin global sin cliente en la pestaña iría a Today (lib/movil-guard.ts), así que se lo
// trae acá mismo con el workspace de la plataforma.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_MAS } from '@/lib/movil-rutas';
import { rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { CabeceraM } from '@/app/m/_ui';
import { TableroDecisiones } from '@/app/admin/runway/Tablero';
import { responderDecision } from '@/app/admin/runway/acciones';
import '@/app/admin/runway/decisiones.css';
import '@/app/tickets/decisiones/vistas.css';

export const dynamic = 'force-dynamic';

export default async function TicketeraListaMovil() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs(HOME_MOVIL));
  const ctx = await contextoMovil();
  if (ctx && ctx.ws == null) redirect(conWs('/m/decisiones', await wsSuperAdmin()));
  await requireMovil({ onboarding: false });
  const lectura = await leerDecisiones();
  return (
    <>
      <CabeceraM titulo="Ticketera" padre={{ href: RUTA_MAS, label: 'More' }} />
      <TableroDecisiones lectura={lectura} responder={responderDecision} />
    </>
  );
}
