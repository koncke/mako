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
  // Pila de vistas, solo para no perder de dónde venís. Los «Volver» ya no la
  // consultan: cada uno navega explícitamente a su nivel de arriba (ver CursoPortal).
  // Acá el hub NO lleva Volver, a propósito: en un share de UN curso no hay «todos
  // los cursos» a dónde subir, y por eso `salir` va sin pasar.
  const [pila, setPila] = useState<Vista[]>([{}]);
  const vista = pila[pila.length - 1];

  const nav = (v: Vista, o?: { reemplazar?: boolean }) =>
    setPila((p) => (o?.reemplazar && p.length > 1 ? [...p.slice(0, -1), v] : [...p, v]));

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pila.length]);

  return (
    <PortalShell
      marca={
        <span className="al-brand">
          <span className="b">Cono<span>cimientos</span></span>
          <span className="sub">Formación</span>
        </span>
      }
      tag={<span className="al-toptag">{curso.titulo}</span>}
    >
      <CursoPortal curso={curso} vista={vista} nav={nav} />
      <p className="al-shared-ft">
        Enlace privado{invitado ? ` · compartido con ${invitado}` : ''}
      </p>
    </PortalShell>
  );
}
