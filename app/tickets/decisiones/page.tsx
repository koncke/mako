// =============================================================================
// /tickets/decisiones — la Ticketera: las decisiones de a una, para deslizar (sólo el super admin)
// =============================================================================
// Martín, 14/10/2026: «quiero que diseñes esto como si fuera "tinder" en donde hay tarjetas y yo
// puedo ir desplazando a la derecha o la izquierda para aprobar o ignorar. Y que en el medio
// cargue mi respuesta... Y claro pueda ver el detalle. Hazlo y ponlo en una nueva ruta de la
// Ticketera de MaKo». Y después: se llama «Ticketera», y el mazo es LA vista —al entrar ya está
// deslizando—; la lista (./lista) es la secundaria. /admin/runway redirige acá.
//
// La misma tabla (lib/admin-decisiones.ts) y la misma acción (app/admin/runway/acciones.ts) que la
// lista. Nace en el teléfono: ahí la misma URL la sirve app/m/tickets/decisiones (lib/movil-rutas.ts),
// con el MISMO mazo (./Mazo.tsx).
//
// ⚠️ /tickets es la tab «Reportar problema» de los clientes (closer y setter), y el proxy no la
// cierra: el guard va acá. A quien no es super admin, esta pantalla no existe (404, no 403).

import { notFound } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { leerDecisiones } from '@/lib/admin-decisiones';
import { Pagina, PageHeader } from '@/app/_ui';
import { deshacerDecision, responderDecision } from '@/app/admin/runway/acciones';
import { MazoDecisiones } from './Mazo';
import './mazo.css';
import '@/app/tickets/decisiones/vistas.css';

export const dynamic = 'force-dynamic';

export default async function Ticketera() {
  const admin = await getSesionAdmin();
  if (!admin) notFound();
  const lectura = await leerDecisiones();
  return (
    <Pagina>
      <PageHeader titulo="Ticketera" />
      <MazoDecisiones lectura={lectura} responder={responderDecision} deshacer={deshacerDecision} />
    </Pagina>
  );
}
