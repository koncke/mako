// =============================================================================
// /m/configuraciones/notificaciones — «Configuración del negocio» › Notificaciones en el teléfono (17/10/2026)
// =============================================================================
// En la URL, /configuraciones/notificaciones. Acá aterrizan los 49 avisos que dicen `/configuraciones?tab=notif`
// («apagar este reporte»), como en la computadora. Contesta A QUIÉN le avisa MaKo lo del negocio: los números de
// WhatsApp (que entran al grupo de MaKo) y los emails. Qué dice cada aviso se arma en Automations.
//
// Referencia: la lista de destinatarios de las alertas de Slack y la de «Agregar teléfono» de Contactos de iOS. Cada
// canal es su caja, con una fila por destinatario y «Agregar…» al final. El país del número sale de un selector nativo
// (la rueda de iOS), como el selector de lada de la computadora: un número sin código de país no existe en WhatsApp.
// La MISMA API que la computadora (/api/perfil/destinatarios, sólo el admin), guardando las DOS listas en cada alta o
// baja, como `DestinatariosCanal`.
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { NotificacionesNegocioM } from './NotificacionesNegocioM';

export const dynamic = 'force-dynamic';

export default async function NotificacionesNegocioMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  return (
    <PantallaM>
      <CabeceraM titulo="Notificaciones" />
      <NotificacionesNegocioM leido={Date.now()} />
    </PantallaM>
  );
}
