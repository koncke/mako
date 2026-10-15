// =============================================================================
// /perfil/notificaciones — «Tu cuenta» › Notificaciones (15/10/2026)
// =============================================================================
// Los avisos de la PERSONA: el pop-up y el sonido de MaKo en su navegador (la mitad `persona` de
// NotificacionesPanel), y dónde se prenden los del celular. A quién le llegan los avisos del NEGOCIO
// (reportes, WhatsApp, correo) es de «Configuración del negocio» › Notificaciones.

import { requireRolWs } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA, seccionesCuenta } from '@/lib/ajustes-secciones';
import { AjustesPagina, FilaAjustes, GrupoAjustes, TituloAjustes } from '../../_ui/Ajustes';
import { NotificacionesPanel } from '../NotificacionesPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificacionesCuentaPage() {
  await requireRolWs(['closer', 'setter']);
  const [rol, deOtro] = await Promise.all([
    getRolWsEfectivo(),
    leerPerfil().then((p) => p.vista.deOtro, () => false),
  ]);
  return (
    <AjustesPagina lugar={TITULO_CUENTA} secciones={seccionesCuenta(deOtro, 'notificaciones')} activa="notificaciones">
      <TituloAjustes titulo="Notificaciones" bajada="Los avisos que te llegan a ti." />
      <div style={{ marginBottom: 20 }}>
        <NotificacionesPanel parte="persona" />
      </div>
      <GrupoAjustes titulo="En tu celular" descripcion="Los avisos al celular se prenden desde MaKo instalada en el teléfono.">
        <FilaAjustes icono="celular" titulo="Instalar la app" detalle="MaKo en tu celular, con los avisos al instante" href="/perfil/instalar" />
      </GrupoAjustes>
      {rol === 'admin' && (
        <GrupoAjustes titulo="Los avisos del negocio" descripcion="Los reportes y los avisos de MaKo por WhatsApp y correo: a quién le llegan.">
          <FilaAjustes icono="configurar" titulo="Configuración del negocio" detalle="Notificaciones" href="/configuraciones/notificaciones" />
        </GrupoAjustes>
      )}
    </AjustesPagina>
  );
}
