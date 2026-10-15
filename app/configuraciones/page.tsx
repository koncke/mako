// =============================================================================
// /configuraciones — «Configuración del negocio» › General (15/10/2026)
// =============================================================================
// La primera sección de «Configuración del negocio» (lib/ajustes-secciones.ts): a qué hora escribe MaKo
// y qué entra al tablero. Las demás son sus propias rutas: /equipo, /integraciones,
// /configuraciones/notificaciones, /configuraciones/fiscal y /metodo.
//
// ⚠️ EL `?tab=` VIEJO SIGUE VIVO EN LOS LINKS YA MANDADOS: los 49 avisos apuntan a
// `/configuraciones?tab=notif` para apagar un reporte. Cada valor va a su sección, con el resto de la
// query (el `?ws=`).
//
// El Archivero, el Funnel y los Ángulos y avatares viven en Onboarding (menú de la foto de perfil).

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO, conLaQuery, rutaDeTabVieja, seccionesNegocio } from '@/lib/ajustes-secciones';
import { disponiblesNegocio } from '@/lib/ajustes-negocio';
import { AjustesPagina, SubtituloAjustes, TituloAjustes } from '../_ui/Ajustes';
import { CriterioPanel } from './CriterioPanel';
import { HorarioEnvioPanel } from './HorarioEnvioPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfiguracionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'configuraciones' });
  // (Acá se preguntaba si el negocio tiene /automations, para el link de cada mensaje de Notificaciones.
  // Se fue el 11/10/2026: esa lista no existe más; los mensajes de MaKo son automatizaciones.)
  const sp = await searchParams;
  const vieja = rutaDeTabVieja(typeof sp.tab === 'string' ? sp.tab : null);
  if (vieja && vieja !== '/configuraciones') redirect(conLaQuery(vieja, sp, ['tab']));

  const disponibles = await disponiblesNegocio();
  const secciones = seccionesNegocio(disponibles);
  // Sin General (hoy, quien no es el super admin), la entrada es la primera sección que sí ve.
  if (!disponibles.general) redirect(conLaQuery(secciones[0]?.href ?? '/equipo', sp, ['tab']));

  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={secciones} activa="general">
      <TituloAjustes titulo="General" bajada="A qué hora escribe MaKo y qué entra al tablero." />
      {/* El horario en que las automatizaciones le escriben a alguien (sexta tanda, 09/10/2026): por
          defecto, cualquier hora. Lo cambia sólo un admin (horario-actions.ts); lib/horario-envio.ts
          tiene el porqué. */}
      <SubtituloAjustes titulo="Horario" />
      <div style={{ marginBottom: 34 }}><HorarioEnvioPanel /></div>
      {/* El criterio gobierna QUÉ ENTRA al tablero de todo el workspace: un closer que lo cambie decide
          qué compromisos existen para su jefe (criterio-actions.ts). */}
      <SubtituloAjustes titulo="Criterio de reuniones" />
      <CriterioPanel />
    </AjustesPagina>
  );
}
