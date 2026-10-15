// =============================================================================
// /m/crm — el CRM en el teléfono (v3, 14/10/2026): el tablero de escritorio
// =============================================================================
// Martín aprobó el prototipo v3 (docs/prototipos/mako-mobile-tableros.html): el CRM del teléfono
// es el TABLERO del funnel, una columna por pantalla, con el selector de funnel arriba y la lupa
// en el encabezado (./TableroCrm.tsx). La lista de la v2 (Hoy · Por responder · Nuevos) se fue:
// «el CRM no lleva Hoy»; lo que espera respuesta está en la pestaña Chats.
//
// El funnel va por la URL (?funnel=), como en escritorio: las etapas se leen en el server.
// Closer y setter ven el CRM entero del workspace: no hay scoping por persona en el producto
// (leads.closer/setter son nombres en texto libre) y aquí no se inventa.
// =============================================================================

import './crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { tableroCrm } from './datos';
import { TableroCrm } from './TableroCrm';

export const dynamic = 'force-dynamic';

export default async function CrmMovil({ searchParams }: { searchParams: Promise<{ funnel?: string }> }) {
  await requireMovil({ navKey: 'crm' });
  const pedido = Number((await searchParams).funnel);
  const datos = await tableroCrm(Number.isInteger(pedido) && pedido > 0 ? pedido : null);
  return (
    <PantallaM>
      {datos ? <TableroCrm datos={datos} /> : <ErrorM frase="No pude leer el tablero." />}
    </PantallaM>
  );
}
