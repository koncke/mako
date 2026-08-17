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

  /**
   * ⚠️ EL LUGAR SOBREVIVE AL REFRESH, y eso REVIERTE la decisión que estaba escrita
   * arriba («la navegación es por ESTADO, no por URL»).
   *
   * El porqué original era razonable: que reenviar el link no mandara a una clase
   * suelta. Lo que costaba era peor — con la navegación solo en memoria, un F5 (o
   * volver a la pestaña más tarde) devolvía al selector de TODOS los cursos, y el
   * invitado perdía dónde estaba en un curso de 30 clases. Decisión del dueño el
   * 2026-08-17: que funcione igual que en el admin.
   *
   * Va en el HASH y no en la ruta porque la ruta la ocupa el token del share.
   */
  const [leido, setLeido] = useState(false);
  useEffect(() => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const c = h.get('curso');
    setLeido(true);
    if (!c) return;
    const n = Number(h.get('clase'));
    const p: Paso = { curso: c };
    if (Number.isFinite(n) && n > 0) p.clase = n;
    if (h.get('r')) p.r = h.get('r') ?? undefined;
    setPila([{}, p]);
  }, []);

  /**
   * ⚠️ EL `leido` NO SOBRA: sin el, este efecto BORRABA el hash antes de restaurarlo.
   *
   * En el mismo commit los dos efectos corren seguidos, y el de abajo lo hace con el
   * `paso` del render VIEJO —todavia vacio—, asi que escribia la URL pelada. Recien en
   * el render siguiente ponia `#curso=…&clase=15`. En el medio monta el hijo, y sus
   * efectos corren ANTES que los del padre: la replica leia el hash justo en la ventana
   * en que estaba vacio.
   *
   * El sintoma no se parecia a esto: refrescar sobre una clase dejaba el hash correcto en
   * la barra de direcciones —el padre lo restauraba— pero la pantalla mostraba el indice
   * del curso. La URL decia una cosa y la pantalla otra, y las dos eran consistentes con
   * su propia lectura.
   */
  useEffect(() => {
    if (!leido) return;
    const h = new URLSearchParams();
    if (paso.curso) h.set('curso', paso.curso);
    if (paso.clase != null) h.set('clase', String(paso.clase));
    if (paso.r) h.set('r', paso.r);
    const s = h.toString();
    history.replaceState(null, '', s ? `#${s}` : location.pathname + location.search);
  }, [leido, paso.curso, paso.clase, paso.r]);

  const nav = (p: Paso) => setPila((s) => [...s, p]);
  const back = () => setPila((s) => (s.length > 1 ? s.slice(0, -1) : s));
  /** Volver al hub del curso actual: lo que hace el rótulo de arriba. */
  const alHub = () => setPila((s) => (curso ? [...s, { curso: curso.slug }] : s));
  /** Volver a TODOS los cursos. Es la marca de arriba, igual que en el admin.
   *  Sin esto, entrar a un curso era un viaje de ida: el hub no tiene «Volver»
   *  (en un share de UN curso no habría a dónde ir) y el rótulo lleva al mismo
   *  hub. Compartida la tab entera, el selector SÍ es un destino. */
  const aTodos = () => setPila([{}]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pila.length]);

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
        <Selector cursos={CURSOS_COMPARTIBLES} enter={(slug) => nav({ curso: slug })} sinMarca />
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
        // `backLabel`: el hub ya tenía un «← Volver» y el dueño igual leyó la
        // pantalla como sin salida. El botón no faltaba: faltaba que dijera a
        // dónde iba. Un segundo botón habría sido dos salidas al mismo lugar.
        <CursoPortal
          curso={curso}
          vista={{ clase: paso.clase, r: paso.r, de: paso.de }}
          nav={(v) => nav({ curso: curso.slug, ...v })}
          salir={aTodos}
          backLabel="Todos los cursos"
        />
      )}
      <p className="al-shared-ft">
        Enlace privado{invitado ? ` · compartido con ${invitado}` : ''}
      </p>
    </PortalShell>
  );
}
