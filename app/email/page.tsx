// =============================================================================
// Email Marketing — secuencias por etapa (motor de nutrición) + broadcasts.
// Data-driven: lee/escribe vía /api/email/*. Las secuencias de email viven en
// nutricion_secuencias (pasos canal='email'); el envío real sale por Resend
// detrás de EMAIL_SEND_ENABLED. Los broadcasts son envíos puntuales a un segmento.
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { EmailApp } from './EmailApp';

export default async function Page() {
  await requireRolWs(['setter']);
  return <EmailApp />;
}
