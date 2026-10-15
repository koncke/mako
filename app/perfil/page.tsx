// =============================================================================
// /perfil — «Tu cuenta» › Información personal (15/10/2026)
// =============================================================================
// La primera sección de «Tu cuenta» (lib/ajustes-secciones.ts). Es de la PERSONA, sea cual sea su rol:
// el `requireRolWs([])` de antes echaba a closers y setters de su propio perfil, aunque el menú de la
// foto se lo ofrecía.

import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA, seccionesCuenta } from '@/lib/ajustes-secciones';
import { AjustesPagina } from '../_ui/Ajustes';
import { InformacionPersonal } from './InformacionPersonal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PerfilPage() {
  // Sin guard esta página se abría con la sesión sola: la veía un usuario suspendido con la cookie
  // viva, y también uno con el onboarding a medias.
  await requireRolWs(['closer', 'setter']);
  const { perfil, vista } = await leerPerfil();
  return (
    <AjustesPagina lugar={TITULO_CUENTA} secciones={seccionesCuenta(vista.deOtro, 'info')} activa="info">
      <InformacionPersonal inicial={perfil} vista={vista} />
    </AjustesPagina>
  );
}
