// =============================================================================
// /configuraciones — ya no es una pantalla: redirige (26/10/2026)
// =============================================================================
// Era «General» (horario de envío y criterio de reuniones). Salió el 26/10/2026, Martín: «Elimina la tab "General" de
// configuraciones... El huso horario ya se configura en cada Automatización. La zona horaria, para el resto, ponlo dentro de
// "Perfil". y "Criterio de reuniones" eliminalo, no lo necesitamos». Lo que quedó:
//   · la zona del negocio: una fila de /perfil (`ZonaDelNegocio`, para quien administra);
//   · el horario de oficina: la tuerca de cada automatización (el del negocio sigue valiendo para las que lo usan);
//   · el criterio: sin pantalla. Quien lo tenía (medido: un solo negocio) lo sigue usando con su valor.
//
// ⚠️ EL `?tab=` VIEJO SIGUE VIVO EN LOS LINKS YA MANDADOS: los 49 avisos apuntan a `/configuraciones?tab=notif` para apagar
// un reporte. Cada valor va a su sección, con el resto de la query (el `?ws=`). Sin `?tab=`, la primera sección que ve.

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { conLaQuery, rutaDeTabVieja, seccionesNegocio } from '@/lib/ajustes-secciones';
import { disponiblesNegocio } from '@/lib/ajustes-negocio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfiguracionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'configuraciones' });
  const sp = await searchParams;
  const vieja = rutaDeTabVieja(typeof sp.tab === 'string' ? sp.tab : null);
  if (vieja) redirect(conLaQuery(vieja, sp, ['tab']));
  const secciones = seccionesNegocio(await disponiblesNegocio());
  redirect(conLaQuery(secciones[0]?.href ?? '/equipo', sp, ['tab']));
}
