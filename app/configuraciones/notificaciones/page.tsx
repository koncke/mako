// =============================================================================
// /configuraciones/notificaciones — «Configuración del negocio» › Notificaciones (15/10/2026)
// =============================================================================
// A quién le avisa MaKo lo del NEGOCIO (los reportes, los avisos por WhatsApp y por correo): la mitad
// `negocio` de NotificacionesPanel. Lo de la persona (el pop-up y el sonido de su navegador) vive en
// «Tu cuenta» › Notificaciones. Acá aterrizan los 49 avisos que dicen `/configuraciones?tab=notif`.

import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { seccionesNegocioActuales } from '@/lib/ajustes-negocio';
import { AjustesPagina, FilaAjustes, GrupoAjustes, TituloAjustes } from '../../_ui/Ajustes';
import { NotificacionesPanel } from '../../perfil/NotificacionesPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificacionesNegocioPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} secciones={await seccionesNegocioActuales()} activa="notificaciones">
      <TituloAjustes titulo="Notificaciones" bajada="A quién le avisa MaKo lo del negocio. Qué dice cada aviso se arma en Automations." />
      <div style={{ marginBottom: 20 }}>
        <NotificacionesPanel parte="negocio" />
      </div>
      <GrupoAjustes>
        <FilaAjustes icono="avisar" titulo="Tus avisos en la app" detalle="El pop-up y el sonido son tuyos: viven en Tu cuenta" href="/perfil/notificaciones" />
      </GrupoAjustes>
    </AjustesPagina>
  );
}
