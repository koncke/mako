'use client';

// =============================================================================
// El curso que ve alguien SIN LOGIN con un link compartido
// =============================================================================
// Es EXACTAMENTE el portal de /conocimientos (mismo componente, mismo diseño,
// mismos videos y recursos), no un resumen: la versión anterior mostraba solo
// texto y el invitado no podía ver un video ni abrir un prompt.
//
// Las dos únicas diferencias con el admin:
//   • no hay botón de Compartir (no se re-comparte lo que te compartieron);
//   • la navegación es por ESTADO, no por URL — el token va en la ruta y no
//     queremos que la clase abierta quede pegada en el link que se reenvía.
// El chrome de la app (sidebar y pollers) ya lo saca PublicRouteGate.

import { useEffect, useState } from 'react';
import type { Curso } from '@/app/conocimientos/curso';
import CursoPortal, { PortalShell, type Vista } from '@/app/conocimientos/CursoPortal';

export default function CursoCompartido({ curso, invitado }: { curso: Curso; invitado: string | null }) {
  // Pila de vistas para que "Volver" devuelva a donde estabas (hub → clase →
  // recurso → clase), igual que el Atrás del navegador en el admin.
  const [pila, setPila] = useState<Vista[]>([{}]);
  const vista = pila[pila.length - 1];

  const nav = (v: Vista) => setPila((p) => [...p, v]);
  const back = () => setPila((p) => (p.length > 1 ? p.slice(0, -1) : p));

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pila.length]);

  return (
    <PortalShell
      marca={
        <span className="al-brand">
          <span className="b">Cono<span>cimientos</span></span>
          <span className="sub">MaKo · formación</span>
        </span>
      }
      tag={<span className="al-toptag">{curso.titulo}</span>}
    >
      <CursoPortal curso={curso} vista={vista} nav={nav} back={back} />
      <p className="al-shared-ft">
        Material de MaKo · enlace privado{invitado ? ` · compartido con ${invitado}` : ''}
      </p>
    </PortalShell>
  );
}
