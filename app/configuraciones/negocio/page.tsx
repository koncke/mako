// =============================================================================
// /configuraciones/negocio — «Configuración del negocio» › Tu negocio (21/10/2026)
// =============================================================================
// El nombre del negocio, editable por su admin (NombreNegocioPanel → negocio-actions.ts). Florencia (ws21) no podía
// cambiarlo en ningún lado: General (/configuraciones) es sólo del super admin. Ésta la ve todo el negocio.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { NombreNegocioPanel } from '../NombreNegocioPanel';

export const dynamic = 'force-dynamic';

export default async function NegocioPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="negocio">
      <TituloAjustes titulo="Tu negocio" bajada="El nombre de tu negocio." />
      <NombreNegocioPanel />
    </AjustesPagina>
  );
}
