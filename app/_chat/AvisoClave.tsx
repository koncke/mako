'use client';

// =============================================================================
// «Eso parece una clave» — el aviso de una clave pegada en el Ops Center del super admin (22/10/2026)
// =============================================================================
// Lo dicen la caja (Conversacion.tsx) y el «Otra» de una pregunta (PreguntasDelChat.tsx) apenas aparece una clave, con el botón a
// /integraciones, donde se guarda cifrada. Lo que se escribe ahí no sale mientras la tenga (mandar.ts). La regla de qué es una
// clave es la del chat del negocio (lib/claves-en-el-chat.ts → taparClaves).

import { AVISO_CLAVE_EN_EL_CENTRO, RUTA_INTEGRACIONES } from '@/lib/claves-en-el-chat';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

export function AvisoClave() {
  return (
    <p className="co-nota co-nota--mal" role="alert">
      {AVISO_CLAVE_EN_EL_CENTRO} <a className="ch-enlace" href={RUTA_INTEGRACIONES}>Abrir Integraciones</a>
      <ReportarASoporte />
    </p>
  );
}
