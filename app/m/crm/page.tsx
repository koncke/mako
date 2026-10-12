// =============================================================================
// /m/crm — el CRM en el teléfono (v2): buscador y tres grupos
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="crm". Diseño: docs/diseno-mako-mobile-v2.md
// («CRM»). Arriba el buscador; debajo Hoy (las reuniones de hoy con su hora), Por responder (el
// último mensaje y hace cuánto) y Nuevos (los que siguen en la etapa de entrada). El filtro por
// etapa es la acción de la derecha de la barra y abre un sheet.
//
// Closer y setter ven el CRM entero del workspace: no hay scoping por persona en el producto
// (leads.closer/setter son nombres en texto libre) y aquí no se inventa. El kanban, la tabla,
// las acciones en lote y la importación quedan en la computadora.
// =============================================================================

import './crm.css';
import { requireMovil } from '@/lib/movil-guard';
import { PantallaM } from '@/app/m/_ui';
import { listaCrm } from './datos';
import { ListaCrm } from './ListaCrm';

export const dynamic = 'force-dynamic';

export default async function CrmMovil() {
  await requireMovil({ navKey: 'crm' });
  const datos = await listaCrm();
  return (
    <PantallaM refrescable>
      <ListaCrm datos={datos} />
    </PantallaM>
  );
}
