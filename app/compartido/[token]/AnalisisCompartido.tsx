'use client';

// =============================================================================
// El "Análisis de Negocio — Las 5 Fases" que ve alguien SIN LOGIN (compartido)
// =============================================================================
// Mismo componente interactivo que el admin en /conocimientos (pestañas, quiz,
// las 5 fases con el detalle del onboarding) — sin el botón de Volver (no hay a
// dónde) y sin Compartir (no se re-comparte lo que te compartieron).

import AnalisisNegocio from '@/app/conocimientos/AnalisisNegocio';
import { PortalShell } from '@/app/conocimientos/CursoPortal';

export default function AnalisisCompartido({ invitado }: { invitado: string | null }) {
  return (
    <PortalShell
      marca={
        <span className="al-brand">
          <span className="b">Cono<span>cimientos</span></span>
          <span className="sub">Formación</span>
        </span>
      }
      tag={<span className="al-toptag">Análisis de Negocio — Las 5 Fases</span>}
    >
      <AnalisisNegocio back={null} compartible={false} />
      <p className="al-shared-ft">
        Enlace privado{invitado ? ` · compartido con ${invitado}` : ''}
      </p>
    </PortalShell>
  );
}
