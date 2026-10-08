'use client';

// =============================================================================
// El curso que ve alguien SIN LOGIN con un link compartido
// =============================================================================
// Es EXACTAMENTE el curso de /conocimientos (el mismo dibujo, app/conocimientos/CursoConocimientos.tsx:
// mismos videos, recursos, prompts y transcripción), no un resumen: la versión anterior mostraba solo
// texto y el invitado no podía ver un video ni abrir un prompt.
//
// Las diferencias con el super admin:
//   • no hay botón de Compartir (no se re-comparte lo que te compartieron);
//   • no hay EDICIÓN: este archivo no la arma ni importa nada que la arme, así que ese código no llega
//     a este navegador;
//   • el curso llega YA AJUSTADO desde el server (app/compartido/[token]/page.tsx): con lo que el super
//     admin le cambió y SIN lo que ocultó, que no viaja.
//   • arriba no hay nada: en un share de UN curso no existe «todos los cursos», así que no hay salida
//     (un botón que no lleva a ningún lado es peor que no tenerlo).
// El chrome de la app (sidebar y pollers) ya lo saca PublicRouteGate.

import { useEffect } from 'react';
import type { CursoConAjustes } from '@/lib/conocimiento-ajustes';
import { sembrar } from '@/app/conocimientos/posicion';
import { PortalShell } from '@/app/conocimientos/CursoPortal';
import CursoConocimientos from '@/app/conocimientos/CursoConocimientos';

export default function CursoCompartido({ curso, invitado }: { curso: CursoConAjustes; invitado: string | null }) {
  /**
   * ⚠️ SE SIEMBRA, y no es sólo por el Atrás: es lo que hace que el curso LEA la URL al cargar. El
   *    dueño de la posición (app/conocimientos/posicion.ts) arranca vacío y se entera del hash cuando
   *    alguien escribe o siembra; sin esto, un F5 (o un link pegado con `#clase=12`) abría el índice.
   *    Lo encontró el relevo del 08/10/2026 leyendo el código: las otras tres pantallas que montan el
   *    curso ya sembraban. El techo de un share de UN curso es su índice (una posición vacía): arriba
   *    no hay nada.
   */
  useEffect(() => { sembrar({}); }, []);

  const pie = `Enlace privado${invitado ? ` · compartido con ${invitado}` : ''}`;
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
      <CursoConocimientos curso={curso} pieBarra={pie} />
      <p className="al-shared-ft">{pie}</p>
    </PortalShell>
  );
}
