// =============================================================================
// /configuraciones/fiscal — «Configuración del negocio» › Identidades fiscales (15/10/2026)
// =============================================================================
// Los datos con los que factura el negocio. Antes era una pestaña de /configuraciones que vivía en el
// estado del navegador (un link no la abría); ahora es su ruta, como cada sección de lib/ajustes-secciones.ts.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { IdentidadesFiscalesPanel } from '../IdentidadesFiscalesPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FiscalPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="fiscal">
      <TituloAjustes titulo="Identidades fiscales" bajada="Los datos con los que facturas." />
      <IdentidadesFiscalesPanel />
    </AjustesPagina>
  );
}
