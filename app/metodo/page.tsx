// =============================================================================
// /metodo — conexión guiada de integraciones: tokens + tutorial por servicio
// =============================================================================
// Solo admin: gestiona las credenciales del workspace (tokens globales). El
// proxy ya bloquea la ruta, este guard es defensa en profundidad + redirect
// limpio.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { MetodoWizard } from './MetodoWizard';
import { rutaConWs, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { serviciosPara } from '@/lib/metodo-catalogo';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { AjustesPagina, TituloAjustes } from '../_ui/Ajustes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MetodoPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs('/inicio'));
  // El catálogo se resuelve ACÁ (server) y viaja por props, ya filtrado: un cliente
  // no tiene por qué recibir las credenciales de la plataforma ni siquiera en el
  // JSON. Ver el comentario en MetodoWizard.
  //
  // La pregunta es por el WORKSPACE, no por el usuario: el super admin sigue siendo
  // admin dentro del workspace de un cliente, y ahí `soloPlataforma` no le
  // corresponde — es la misma regla que en lib/integraciones.ts.
  const ws = await getWorkspaceActual().catch(() => null);
  const esPlataforma = ws != null && ws === (await wsSuperAdmin().catch(() => -1));
  // Desde el 15/10/2026 es la última sección de «Configuración del negocio» (sólo para la agencia).
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="metodo" amplio>
      <TituloAjustes titulo="Método" bajada="Las credenciales de la plataforma, servicio por servicio." />
      <MetodoWizard servicios={serviciosPara(esPlataforma)} embebido />
    </AjustesPagina>
  );
}
