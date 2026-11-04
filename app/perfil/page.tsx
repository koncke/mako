// =============================================================================
// /perfil — «Tu cuenta» › Información personal (15/10/2026)
// =============================================================================
// La primera sección de «Tu cuenta» (lib/ajustes-secciones.ts). Es de la PERSONA, sea cual sea su rol:
// el `requireRolWs([])` de antes echaba a closers y setters de su propio perfil, aunque el menú de la
// foto se lo ofrecía.

import { requireRolWs } from '@/lib/tab-access';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina } from '../_ui/Ajustes';
import { InformacionPersonal } from './InformacionPersonal';
import { EliminarCuenta } from './EliminarCuenta';
import { nombreDelNegocioAction } from '@/app/configuraciones/negocio-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PerfilPage() {
  // Sin guard esta página se abría con la sesión sola: la veía un usuario suspendido con la cookie
  // viva, y también uno con el onboarding a medias.
  await requireRolWs(['closer', 'setter']);
  // El nombre del negocio, con la MISMA lectura que «Tu negocio»: lo ve en su perfil quien lo puede cambiar (21/10/2026).
  const [{ perfil, vista }, negocio] = await Promise.all([leerPerfil(), nombreDelNegocioAction().catch(() => null)]);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(vista.deOtro, 'info')} activa="info">
      <InformacionPersonal inicial={perfil} vista={vista} negocio={negocio} />
      {!vista.deOtro && <EliminarCuenta />}
    </AjustesPagina>
  );
}
