// =============================================================================
// /m/configuraciones/fiscal — «Configuración del negocio» › Identidades fiscales en el teléfono (17/10/2026)
// =============================================================================
// En la URL, /configuraciones/fiscal. Referencia: «Datos de facturación» de la app de Mercado Pago y las direcciones de
// la app de Amazon en el celular. Es la lista de razones sociales, la predeterminada primero y marcada, y cada una abre
// una hoja con sus cuatro campos. «Agregar una identidad» va al final. Los mismos datos y las mismas acciones que la
// computadora (app/configuraciones/IdentidadesFiscalesPanel.tsx → `getIdentidadesFiscalesAction` y compañía). Lo que el
// teléfono no trae: leer los datos de un PDF o una foto (`/api/extract-fiscal`), que queda en la computadora.
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { getIdentidadesFiscalesAction } from '@/app/crm/[id]/deal-actions';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { FiscalM } from './FiscalM';

export const dynamic = 'force-dynamic';

export default async function FiscalMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  const identidades = await getIdentidadesFiscalesAction().catch(() => null);
  return (
    <PantallaM>
      <CabeceraM titulo="Identidades fiscales" />
      <FiscalM identidades={identidades} />
    </PantallaM>
  );
}
