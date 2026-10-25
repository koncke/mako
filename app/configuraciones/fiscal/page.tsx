// =============================================================================
// /configuraciones/fiscal — «Configuración del negocio» › Identidades fiscales (15/10/2026)
// =============================================================================
// Los datos con los que factura el negocio. Antes era una pestaña de /configuraciones que vivía en el
// estado del navegador (un link no la abría); ahora es su ruta, como cada sección de lib/ajustes-secciones.ts.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina } from '../../_ui/Ajustes';
import { IdentidadesFiscalesPanel } from '../IdentidadesFiscalesPanel';
import { MonedaNegocioPanel } from '../MonedaNegocioPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FiscalPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} grupos={await gruposDeAjustes(undefined, 'fiscal')} activa="fiscal">
      {/* El título (con «Agregar»), la moneda en que cobra el negocio (17/10/2026: antes sólo se cambiaba pidiéndoselo a MaKo)
          y las razones sociales los pone el panel, en el molde de Linear (25/10/2026). */}
      <IdentidadesFiscalesPanel moneda={<MonedaNegocioPanel />} />
    </AjustesPagina>
  );
}
