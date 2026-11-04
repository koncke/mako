// =============================================================================
// /perfil/notificaciones — Settings › Notificaciones (15/10/2026; copiada de Linear desde el 25/10/2026)
// =============================================================================
// La lista de canales (En la app · Celular · WhatsApp · Email) y «No molestar»; `?canal=` abre el detalle de uno, como
// Settings › Notifications de Linear (NotificacionesPanel.tsx). WhatsApp y Email son a quién le avisa MaKo lo del NEGOCIO:
// sólo para quien lo administra.
// ⚠️ ERAN DOS ENTRADAS DEL ÍNDICE con el mismo nombre (25/10/2026, Martín: «"Perfil, Notificaciones, Instalar App, Equipo,
//    Notificaciones..."»). Es una, en «Tu cuenta», y /configuraciones/notificaciones (donde caen los avisos viejos con
//    `?tab=notif`) redirige acá.
// El `?canal=` lo lee el SERVER: un link copiado abre el mismo canal, y el estado leído sobrevive al ir y volver (el
// componente es el mismo y sólo cambia la prop).

import { requireRolWs } from '@/lib/tab-access';
import { getRolWsEfectivo } from '@/lib/workspace';
import { leerPerfil, zonaPropia } from '@/lib/perfil';
import { TITULO_CUENTA } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { AjustesPagina } from '../../_ui/Ajustes';
import { NotificacionesPanel } from '../NotificacionesPanel';
import { canalDeUrl } from '../notificaciones-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificacionesCuentaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs(['closer', 'setter']);
  const [rol, deOtro, zona, sp] = await Promise.all([
    getRolWsEfectivo(),
    leerPerfil().then((p) => p.vista.deOtro, () => false),
    zonaPropia(),
    searchParams,
  ]);
  // Lo del negocio, para quien lo administra (la misma regla que el guard de Configuración).
  const admin = rol === 'admin';
  return (
    <AjustesPagina lugar={TITULO_CUENTA} grupos={await gruposDeAjustes(deOtro, 'notificaciones')} activa="notificaciones">
      <NotificacionesPanel canal={canalDeUrl(sp.canal)} admin={admin} zona={zona} deOtro={deOtro} />
    </AjustesPagina>
  );
}
