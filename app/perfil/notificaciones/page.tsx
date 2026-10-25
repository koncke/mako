// =============================================================================
// /perfil/notificaciones — Settings › Notificaciones (15/10/2026; UNA SOLA desde el 25/10/2026)
// =============================================================================
// Los avisos de la PERSONA (el pop-up y el sonido de MaKo en su navegador, la mitad `persona` de NotificacionesPanel) y dónde
// se prenden los del celular. Y para quien administra el negocio, en la MISMA página, a quién le llegan los avisos del NEGOCIO
// (WhatsApp y correo, la mitad `negocio`).
// ⚠️ ERAN DOS ENTRADAS DEL ÍNDICE con el mismo nombre (25/10/2026, Martín: «"Perfil, Notificaciones, Instalar App, Equipo,
//    Notificaciones..."»: «Notificaciones» aparecía DOS veces, una en «Tu cuenta» y otra en «Tu negocio», y las dos se marcaban
//    a la vez). Ahora es una, en «Tu cuenta», y /configuraciones/notificaciones (donde caen los avisos viejos con `?tab=notif`)
//    redirige acá, a la parte del negocio (`#negocio`).

import { requireRolWs } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';
import { leerPerfil } from '@/lib/perfil';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina, ApartadoAjustes, FilaAjustes, GrupoAjustes, TituloAjustes } from '../../_ui/Ajustes';
import { NotificacionesPanel } from '../NotificacionesPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificacionesCuentaPage() {
  await requireRolWs(['closer', 'setter']);
  const [rol, deOtro] = await Promise.all([
    getRolWsEfectivo(),
    leerPerfil().then((p) => p.vista.deOtro, () => false),
  ]);
  // Lo del negocio, para quien lo administra (la misma regla que tenía el link a la otra página).
  const admin = rol === 'admin';
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'notificaciones')} activa="notificaciones">
      <TituloAjustes titulo="Notificaciones" bajada={admin ? 'Los avisos que te llegan a ti, y a quién le avisa MaKo lo del negocio.' : 'Los avisos que te llegan a ti.'} />
      <NotificacionesPanel parte="persona" />
      <GrupoAjustes titulo="En tu celular" descripcion="Los avisos al celular se prenden desde MaKo instalada en el teléfono.">
        <FilaAjustes icono="celular" titulo="Instalar la app" detalle="MaKo en tu celular, con los avisos al instante" href="/perfil/instalar" />
      </GrupoAjustes>
      {admin && (
        <ApartadoAjustes id="negocio" titulo="Los avisos del negocio" bajada="A quién le avisa MaKo lo del negocio. Qué dice cada aviso se arma en Automations.">
          <NotificacionesPanel parte="negocio" />
        </ApartadoAjustes>
      )}
    </AjustesPagina>
  );
}
