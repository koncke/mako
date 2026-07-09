// =============================================================================
// Email Marketing — secuencias por etapa (motor de nutrición) + broadcasts.
// Data-driven: lee/escribe vía /api/email/*. Las secuencias de email viven en
// nutricion_secuencias (pasos canal='email'); el envío real sale por Resend y
// se habilita POR WORKSPACE (toggle "Envío real" → setting envio_email_enabled,
// lib/envio-flags.ts). El dominio se configura en la misma tab (DominioSetup).
// =============================================================================

import { requireRolWs } from '@/lib/tab-access';
import { EmailApp } from './EmailApp';

export default async function Page() {
  await requireRolWs(['setter']);
  return <EmailApp />;
}
