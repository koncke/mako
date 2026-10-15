// =============================================================================
// /equipo — «Configuración del negocio» › Equipo
// =============================================================================
// El admin-del-cliente arma su equipo: invita Closers y Setters, cambia roles y da de baja.
// requireRolWs([]) bloquea a closer/setter (solo el admin-cliente y la agencia lo ven); el enforcement
// fino por-acción está en /api/equipo. Desde el 15/10/2026 es una sección de «Configuración del
// negocio» (lib/ajustes-secciones.ts), con su índice a la izquierda.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../_ui/Ajustes';
import { EquipoView } from './EquipoView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EquipoPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="equipo">
      <TituloAjustes titulo="Equipo" bajada={<>Suma a tu equipo y decide qué ve cada uno. El <b>Closer</b> ve CRM, WhatsApp y la hoja Closing del Dashboard; el <b>Setter</b> ve CRM, WhatsApp, Email, Automations y la hoja Chat Analyst del Dashboard; el <b>Admin</b> ve todo tu negocio.</>} />
      <EquipoView />
    </AjustesPagina>
  );
}
