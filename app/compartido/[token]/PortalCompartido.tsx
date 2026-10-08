'use client';

// =============================================================================
// La TAB ENTERA de Conocimientos que ve alguien SIN LOGIN con un link compartido
// =============================================================================
// El hermano mayor de `CursoCompartido`: aquél comparte UN curso, éste comparte
// el portal completo — el selector con todos los cursos y la navegación a
// cualquiera de ellos.
//
// Las diferencias con el admin, las mismas de siempre:
//   • no hay botón de Compartir (no se re-comparte lo que te compartieron);
//   • no hay EDICIÓN: este archivo no la arma ni importa nada que la arme;
//   • la navegación la lleva `app/conocimientos/posicion.ts`, igual que en el
//     admin. (Antes decía «por ESTADO, no por URL», y esa decisión se revirtió el
//     2026-08-17: con la navegación solo en memoria, un F5 devolvía al selector y
//     el invitado perdía dónde estaba en un curso de 30 clases.);
//   • la lista de cursos es `CURSOS_COMPARTIBLES`, no `CURSOS_TODOS`: queda
//     afuera la sección de lo propio (método, marca, criterios de la casa). El
//     porqué de cada exclusión está en catalogo.ts.
//
// Y no lleva marca: un link que se reparte afuera muestra la formación, no de
// quién es la app. Por eso el rótulo dice «Conocimientos · Formación» y el pie
// «Enlace privado», sin nombre de la casa.
//
// ⚠️ La lista se resuelve EN CADA CARGA, no se congela al crear el link: un
// curso que se suma al portal aparece en los links ya repartidos. Es lo que se
// quiere de "compartí la tab" — es la tab, no una foto de la tab.
//
// ⚠️ LO QUE EL SUPER ADMIN CAMBIÓ (item 1, mig 0221) llega en `ajustes`, leído en el server, y se
//    aplica acá SIN lo oculto (`aplicarAjustes` sin `conOcultos`): un módulo o una clase ocultos no se
//    dibujan. Se aplica en el navegador porque el catálogo ya viaja entero a este bundle (los 126
//    cursos, desde antes de esto): mandarlos ya ajustados desde el server serían megas de props.
//    O sea que acá OCULTAR SACA DE LA VISTA, no del bundle — distinto del link de UN curso, donde lo
//    oculto ni viaja.
// ⚠️ POR ESO LA PÁGINA NO IMPORTA ESTE ARCHIVO: entra por ./PortalCompartidoPerezoso.tsx (`next/dynamic`).
//    Importado directo, Turbopack metía el catálogo en el chunk de TODA la ruta, y el link de un curso
//    (o la galería de marca de un cliente) bajaba los 132 cursos con lo oculto adentro.

import { useEffect, useMemo, useState } from 'react';
import { sembrar, usePosicion } from '@/app/conocimientos/posicion';
import { CURSOS_COMPARTIBLES, VISTA_PROPIA, buscarCompartible } from '@/app/conocimientos/catalogo';
import { ajustarFicha, aplicarAjustes, type FilaAjuste } from '@/lib/conocimiento-ajustes';
import AnalisisNegocio from '@/app/conocimientos/AnalisisNegocio';
import { PortalShell, Selector } from '@/app/conocimientos/CursoPortal';
import CursoConocimientos from '@/app/conocimientos/CursoConocimientos';

export default function PortalCompartido({ invitado, ajustes }: { invitado: string | null; ajustes: FilaAjuste[] }) {
  /**
   * TODA la navegacion sale de `usePosicion`. Aca vivia una PILA EN ESTADO DE REACT
   * que se escribia el hash por su cuenta, en paralelo con la que tenia CursoReplica:
   * dos dueños de la misma URL, y ninguno enterandose del otro porque `pushState` no
   * dispara ningun evento. El porque completo esta en app/conocimientos/posicion.ts.
   */
  const { pos, ir } = usePosicion();
  // `buscarCompartible` y no un `find` sobre la lista: salta los slugs REEMPLAZADOS, igual que el admin.
  const base = buscarCompartible(pos.curso);
  const cursos = useMemo(() => CURSOS_COMPARTIBLES.map((c) => ajustarFicha(c, ajustes)), [ajustes]);
  const curso = useMemo(() => (base ? aplicarAjustes(base, ajustes) : undefined), [base, ajustes]);

  /** De que curso venis, para que el selector traiga esa tarjeta a la vista. */
  const [foco, setFoco] = useState<string | undefined>();

  /**
   * ⚠️ ATERRIZAR EN UN CURSO NO DEJA CATALOGO DEBAJO, y el Atras se va del sitio.
   *
   * El link del share se comparte YA ADENTRO de un curso (`#curso=X`), asi que el
   * historial arranca ahi: no existe la entrada del catalogo. Se siembra, porque el
   * catalogo ES el nivel de arriba de un curso — el destino de «volver» es una
   * propiedad de la PANTALLA, no del camino.
   *
   * El techo de esta ruta es siempre el catalogo: un share de UN curso suelto lo
   * dibuja otro componente (`CursoCompartido`), donde arriba no hay nada.
   */
  useEffect(() => { sembrar({}); }, []);

  /** El «volver» de una vista propia: lo resuelve el historial, como el del navegador. */
  const back = () => { if (typeof window !== 'undefined') window.history.back(); };
  /** Volver al índice del curso actual: lo que hace el rotulo de arriba. */
  const alHub = () => ir({ curso: pos.curso });
  /** Volver a TODOS los cursos. Es la marca de arriba, igual que en el admin. */
  const aTodos = () => { setFoco(pos.curso); ir({}); };

  const pie = `Enlace privado${invitado ? ` · compartido con ${invitado}` : ''}`;
  return (
    <PortalShell
      marca={curso ? (
        <button type="button" className="al-brand-btn" onClick={aTodos} aria-label="Ir a todos los cursos">
          <span className="al-brand">
            <span className="b">Cono<span>cimientos</span></span>
            <span className="sub">Formación</span>
          </span>
        </button>
      ) : (
        <span className="al-brand">
          <span className="b">Cono<span>cimientos</span></span>
          <span className="sub">Formación</span>
        </span>
      )}
      tag={curso
        ? <button type="button" className="al-toptag al-toptag-btn" onClick={alHub}>{curso.titulo}</button>
        : undefined}
    >
      {!curso ? (
        <Selector cursos={cursos} enter={(slug) => ir({ curso: slug })} sinMarca foco={foco} />
      ) : curso.slug === VISTA_PROPIA.analisis ? (
        // El Análisis de Negocio es un formulario interactivo, no clases de
        // video: se dibuja aparte, sin Compartir y con su propio Volver.
        //
        // Hoy esta rama no se alcanza —el Análisis está en la sección propia y
        // por eso no entra en `CURSOS_COMPARTIBLES`— y se deja igual a propósito:
        // el día que salga de esa sección, sin esto se dibujaría con el portal
        // genérico y aparecería un curso de CERO clases, sin ningún error.
        <AnalisisNegocio back={back} compartible={false} />
      ) : (
        // `onSalir`: la salida de la barra («Volver a los cursos») y la marca llevan a TODOS los
        // cursos, que es el nivel de arriba de esta ruta.
        <CursoConocimientos key={curso.slug} curso={curso} onSalir={aTodos} pieBarra={pie} />
      )}
      <p className="al-shared-ft">{pie}</p>
    </PortalShell>
  );
}
