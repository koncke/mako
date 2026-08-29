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

import { useEffect, useRef, useState } from 'react';
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
  /**
   * Un cambio de pila que viene DE LA URL no es un paso hacia adelante: el historial ya
   * está donde tiene que estar. Sin esta marca, restaurar `#curso=X` al abrir el link
   * empujaba una entrada DUPLICADA y el primer Atrás no hacía nada visible — la
   * «entrada fantasma» exacta contra la que avisa el comentario de más abajo.
   */
  const desdeUrl = useRef(false);
  useEffect(() => {
    const leer = () => {
      desdeUrl.current = true;
      const h = new URLSearchParams(location.hash.replace(/^#/, ''));
      const c = h.get('curso');
      setLeido(true);
      // ⚠️ SIN CURSO EN EL HASH = EL CATALOGO, y hay que VOLVER ahí. Antes esta rama
      //    salía sin tocar nada, así que el Atrás del navegador dejaba la URL del
      //    catálogo con la pantalla del curso todavía puesta: la barra decía una cosa y
      //    la pantalla otra. Es la misma trampa que ya está documentada acá abajo.
      if (!c) { setPila((s) => (s.length > 1 ? [{}] : s)); return; }
      const n = Number(h.get('clase'));
      const p: Paso = { curso: c };
      if (Number.isFinite(n) && n > 0) p.clase = n;
      if (h.get('r')) p.r = h.get('r') ?? undefined;
      setPila((s) => (s[s.length - 1]?.curso === c ? s : [{}, p]));
    };
    /**
     * ⚠️ ATERRIZAR EN UN CURSO NO DEJA CATALOGO DEBAJO, y el Atrás se va del sitio.
     *
     * Abrir el link del share ya adentro de un curso (`#curso=X`) —que es como se
     * comparte— arranca el historial ahí: no existe la entrada del catálogo, así que el
     * navegador salta a lo que hubiera antes. Se siembra, porque el catálogo ES el nivel
     * de arriba de un curso y le corresponde estar debajo.
     *
     * Va acá y no en el efecto que escribe la URL porque es una sola vez, al montar: el
     * que escribe corre en cada paso y sembrar ahí dejaría una entrada por clase.
     */
    try {
      const h0 = new URLSearchParams(location.hash.replace(/^#/, ''));
      if (h0.get('curso')) {
        const actual = location.pathname + location.search + location.hash;
        history.replaceState(null, '', location.pathname + location.search);
        history.pushState(null, '', actual);
      }
    } catch { /* noop */ }

    leer();
    // ⚠️ También en `hashchange`, no solo al montar. Pegar un link a una clase en una
    // pestaña donde el portal YA está abierto no recarga la página: el navegador dispara
    // `hashchange` y nada más. Sin esto la URL cambiaba y la pantalla se quedaba donde
    // estaba — el link parecía roto justo cuando alguien lo comparte por segunda vez.
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
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
  /**
   * ⚠️ AVANZAR EMPUJA UNA ENTRADA; VOLVER LA REEMPLAZA.
   *
   * Esto escribía SIEMPRE con `replaceState`, o sea que abrir un curso no dejaba ninguna
   * entrada en el historial. Y como acá la navegación vive en una PILA DE REACT (`pila`),
   * el navegador nunca se enteraba de nada: tocar Atrás adentro de un curso se iba del
   * sitio, a lo que hubiera antes del portal.
   *
   * ⚠️ ES LA TERCERA CAUSA DISTINTA DEL MISMO SINTOMA, y las tres las reportó Martín con
   * la misma frase («le doy atrás y me lleva a otro sitio»):
   *   1. `CursoReplica.ir()` usaba `replaceState`   → arreglado, era real, no era esto
   *   2. aterrizar directo en `?curso=X` sin grilla debajo (admin) → arreglado, tampoco era
   *   3. ESTA: el portal COMPARTIDO, que es por donde entra él
   * Los dos primeros arreglos eran correctos y no alcanzaban. La lección ya está escrita
   * en AGENTS.md para este mismo botón — «se reportó roto tres veces, con tres causas
   * distintas» — y aun así volví a cerrarlo dos veces sin probar el camino del usuario.
   * Antes de dar por cerrado un arreglo de navegación: enumerá TODAS las formas de llegar
   * a la pantalla y probá cada una, no la que te resulta cómoda de reproducir.
   *
   * Qué decide empujar o reemplazar: la PROFUNDIDAD de la pila. Si creció, es un paso
   * nuevo y merece su entrada. Si se achicó o quedó igual —un «Volver» de la app, o el
   * propio Atrás del navegador que ya movió el historial— se reemplaza, porque empujar ahí
   * dejaría entradas fantasma que hacen que Atrás «no haga nada» N veces.
   */
  const hondo = useRef(pila.length);
  useEffect(() => {
    if (!leido) return;
    const h = new URLSearchParams();
    if (paso.curso) h.set('curso', paso.curso);
    if (paso.clase != null) h.set('clase', String(paso.clase));
    if (paso.r) h.set('r', paso.r);
    const s = h.toString();
    const destino = s ? `#${s}` : location.pathname + location.search;
    const avanza = pila.length > hondo.current && !desdeUrl.current;
    hondo.current = pila.length;
    desdeUrl.current = false;
    if (avanza) history.pushState(null, '', destino);
    else history.replaceState(null, '', destino);
  }, [leido, pila.length, paso.curso, paso.clase, paso.r]);

  const nav = (p: Paso) => setPila((s) => [...s, p]);
  const back = () => setPila((s) => (s.length > 1 ? s.slice(0, -1) : s));
  /** Volver al hub del curso actual: lo que hace el rótulo de arriba. */
  const alHub = () => setPila((s) => (curso ? [...s, { curso: curso.slug }] : s));
  /** Volver a TODOS los cursos. Es la marca de arriba, igual que en el admin.
   *  Sin esto, entrar a un curso era un viaje de ida: el hub no tiene «Volver»
   *  (en un share de UN curso no habría a dónde ir) y el rótulo lleva al mismo
   *  hub. Compartida la tab entera, el selector SÍ es un destino. */
  const aTodos = () => { setFoco(curso?.slug); setPila([{}]); };
  /** De qué curso venís, para que el selector traiga esa tarjeta a la vista. */
  const [foco, setFoco] = useState<string | undefined>();

  /**
   * Arriba de todo al cambiar de pantalla — SALVO cuando se vuelve a la lista de cursos,
   * que tiene su propio lugar: ahí manda el `foco` del `Selector`.
   *
   * ⚠️ Sin la excepción este efecto GANA. Los efectos del hijo corren antes que los del
   * padre, así que el `scrollIntoView` del selector se ejecutaba primero y este lo
   * deshacía un instante después: la lista quedaba arriba igual y parecía que el foco no
   * estaba implementado.
   */
  useEffect(() => {
    if (!paso.curso && foco) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pila.length, paso.curso, foco]);

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
        <Selector cursos={CURSOS_COMPARTIBLES} enter={(slug) => nav({ curso: slug })} sinMarca foco={foco} />
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
