// =============================================================================
// /m/mensajes — «MaKo Messages» en el teléfono (17/10/2026). En la URL, /mensajes. Sólo el super admin.
// =============================================================================
// Todo lo que MaKo le puede escribir al dueño por WhatsApp: cómo llega, y prenderlo o apagarlo de a uno. Referencia:
// Ajustes › Notificaciones de iOS (una fila por app con su interruptor a la derecha, y el detalle al tocar) y los
// «Mensajes automáticos» de WhatsApp Business (el mensaje se ve como burbuja). Es la lista de la computadora
// (app/agencia/PlantillasView.tsx) destilada: las MISMAS categorías y en el mismo orden, por la MISMA ruta
// (/api/admin/plantillas, que en el workspace de la plataforma edita la BASE que heredan todos). Editar el texto y el
// flujo es el editor de escritorio, y se abre desde la hoja.
//
// En escritorio es una SECCIÓN de Automations (nav.ts → HERRAMIENTAS.mensajes): arriba va la misma barra de secciones.
// ⚠️ LA PUERTA ES LA DE ESCRITORIO: `getSesionAdmin()`, antes de leer nada. La ruta también la pide.
// =============================================================================

import './mensajes.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { enElStoreDeLaPestana, listarPlantillas } from '@/lib/plantillas';
import { PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { MensajesM } from './MensajesM';

export const dynamic = 'force-dynamic';

export default async function MensajesMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  const ctx = await requireMovil();
  // La MISMA lectura que GET /api/admin/plantillas (en la plataforma, la base que heredan todos).
  const iniciales = await enElStoreDeLaPestana(() => listarPlantillas({ vista: 'agencia' })).catch(() => null);
  return (
    <PantallaM>
      <SeccionesTabM tab="automatizaciones" activa="mensajes"
        vista={{ adminShell: ctx.sesion.rol === 'admin' && !ctx.impersonando, rolWs: ctx.rol ?? '', capa: ctx.capa ?? '' }} />
      <MensajesM key={Date.now()} iniciales={iniciales} />
    </PantallaM>
  );
}
