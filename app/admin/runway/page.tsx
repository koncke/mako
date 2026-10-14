// =============================================================================
// /admin/runway — el tablero donde Martín contesta las decisiones de todos los chats
// =============================================================================
// Pedido de Martín (14/10/2026): «quiero que rediseñes esa tab para que se lea muy simple.
// Quiero texto grande, menos texto, tarjetas, etc... Quiero leerlo simple.» Y la tab pasó a
// ser el tablero de decisiones: los chats juntan preguntas, «Estrategia 3 cuentas» las publica
// (scripts/decisiones.ts) y él contesta acá. En el teléfono abre /m/decisiones, que dibuja el
// MISMO tablero (lib/movil-rutas.ts).
//
// La foto del lanzamiento del 3/10 —capital, plazos y el veredicto de cada tarjeta— se mudó
// entera a /admin/runway/foto: nada se borró.
//
// ⚠️ EL GUARD ES EL ROL DE AGENCIA (getSesionAdmin), no `rol_ws`, que vale 'admin' para el
// dueño de cada workspace. Y el proxy ya cierra /admin/* (SOLO_ADMIN): son dos cerrojos.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { hoyAR } from '@/app/admin/estrategia/datos';
import { TableroDecisiones } from './Tablero';
import { responderDecision } from './acciones';
import './decisiones.css';

export const dynamic = 'force-dynamic';

export default async function RunwayPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  // ⚠️ «Hoy» en cada request y en hora de Argentina (a nivel módulo se congela, y en UTC
  // después de las 21 h ya es mañana).
  const hoy = hoyAR();
  const lectura = await leerDecisiones();
  return (
    <Pagina>
      <PageHeader titulo="Runway" />
      <TableroDecisiones lectura={lectura} hoy={hoy} responder={responderDecision} />
    </Pagina>
  );
}
