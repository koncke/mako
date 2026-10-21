// =============================================================================
// /m/configuraciones/negocio — «Configuración del negocio» › Tu negocio en el teléfono (21/10/2026)
// =============================================================================
// En la URL, /configuraciones/negocio. El nombre del negocio, con la MISMA lectura y el MISMO guardado que la computadora
// (app/configuraciones/negocio-actions.ts): lo cambia el admin del negocio; el resto del equipo lo ve.
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { nombreDelNegocioAction } from '@/app/configuraciones/negocio-actions';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { NegocioM } from './NegocioM';

export const dynamic = 'force-dynamic';

export default async function NegocioMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  const leido = await nombreDelNegocioAction().catch(() => null);
  return (
    <PantallaM>
      <CabeceraM titulo="Tu negocio" />
      <NegocioM leido={leido} />
    </PantallaM>
  );
}
