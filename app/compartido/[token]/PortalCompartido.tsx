'use client';

// =============================================================================
// La TAB ENTERA de Conocimientos que ve alguien SIN LOGIN con un link compartido
// =============================================================================
// El hermano mayor de `CursoCompartido`: aquél comparte UN curso, éste comparte
// el portal completo — el selector con todos los cursos y la navegación a
// cualquiera de ellos.
//
// Las tres diferencias con el admin, las mismas de siempre:
//   • no hay botón de Compartir (no se re-comparte lo que te compartieron);
//   • la navegación es por ESTADO, no por URL — el token va en la ruta y no
//     queremos que la clase abierta quede pegada en el link que se reenvía;
//   • la lista de cursos es `CURSOS_COMPARTIBLES`, no `CURSOS_TODOS` (Branding
//     no se puede servir sin sesión; el porqué está en catalogo.ts).
//
// ⚠️ La lista se resuelve EN CADA CARGA, no se congela al crear el link: un
// curso que se suma al portal aparece en los links ya repartidos. Es lo que se
// quiere de "compartí la tab" — es la tab, no una foto de la tab.

import { useEffect, useState } from 'react';
import { CURSOS_COMPARTIBLES, VISTA_PROPIA } from '@/app/conocimientos/catalogo';
import AnalisisNegocio from '@/app/conocimientos/AnalisisNegocio';
import CursoPortal, { PortalShell, Selector, type Vista } from '@/app/conocimientos/CursoPortal';

/** Un punto de la pila: sin `curso` es el selector; con `curso`, su portal. */
type Paso = Vista & { curso?: string };

export default function PortalCompartido({ invitado }: { invitado: string | null }) {
  // Pila de vistas para que "Volver" devuelva a donde estabas (selector → curso
  // → clase → recurso), igual que el Atrás del navegador en el admin.
  const [pila, setPila] = useState<Paso[]>([{}]);
  const paso = pila[pila.length - 1];
  const curso = paso.curso ? CURSOS_COMPARTIBLES.find((c) => c.slug === paso.curso) : undefined;

  const nav = (p: Paso) => setPila((s) => [...s, p]);
  const back = () => setPila((s) => (s.length > 1 ? s.slice(0, -1) : s));
  /** Volver al hub del curso actual: lo que hace el rótulo de arriba. */
  const alHub = () => setPila((s) => (curso ? [...s, { curso: curso.slug }] : s));

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pila.length]);

  return (
    <PortalShell
      marca={
        <span className="al-brand">
          <span className="b">Cono<span>cimientos</span></span>
          <span className="sub">MaKo · formación</span>
        </span>
      }
      tag={curso
        ? <button type="button" className="al-toptag al-toptag-btn" onClick={alHub}>{curso.titulo}</button>
        : undefined}
    >
      {!curso ? (
        <Selector cursos={CURSOS_COMPARTIBLES} enter={(slug) => nav({ curso: slug })} />
      ) : curso.slug === VISTA_PROPIA.analisis ? (
        // El Análisis de Negocio es un formulario interactivo, no clases de
        // video: se dibuja aparte, sin Compartir y con su propio Volver.
        <AnalisisNegocio back={back} compartible={false} />
      ) : (
        <CursoPortal
          curso={curso}
          vista={{ clase: paso.clase, r: paso.r }}
          nav={(v) => nav({ curso: curso.slug, ...v })}
          back={back}
        />
      )}
      <p className="al-shared-ft">
        Material de MaKo · enlace privado{invitado ? ` · compartido con ${invitado}` : ''}
      </p>
    </PortalShell>
  );
}
