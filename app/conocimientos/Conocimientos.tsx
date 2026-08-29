'use client';

// =============================================================================
// /conocimientos — Portal de formación interna (admin). RAG-source de MaKo.
// =============================================================================
// Hub MULTI-CURSO. Navegación por URL (?curso=…&clase=N / ?r=slug) para que el
// botón Atrás funcione y volver desde un recurso te devuelva a donde viniste.
// Sin tapar el sidebar de admin. Contenido en ./curso (CURSOS).
//
// Vistas: selector de cursos → hub del curso → detalle de clase / de recurso.
//
// El portal de un curso (hub/clase/recurso + todo el diseño) y el SELECTOR viven
// en ./CursoPortal porque los comparte con /compartido/<token>: el invitado ve
// EXACTAMENTE esta pantalla, no un resumen. Acá queda lo que es solo del admin:
// la navegación por URL, los dos cursos que no son de texto, y los botones de
// Compartir (que se inyectan por prop, así ese código no llega al invitado).

import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { CURSOS_TODOS as TODOS, CURSOS_COMPARTIBLES, CATEGORIA_PROPIA, buscarCurso, VISTA_PROPIA } from './catalogo';
import AnalisisNegocio from './AnalisisNegocio';
import BrandingMaKo from './BrandingMaKo';
import Compartir from './Compartir';
import CursoPortal, { PortalShell, Selector } from './CursoPortal';

// La letra chica del link de la TAB: cuántos cursos entran y qué queda afuera.
// «Compartir "Conocimientos"» no dice ninguna de las dos cosas, y sin decirlas
// el que comparte no sabe qué está repartiendo.
const NOTA_TAB = `El link abre el portal con ${CURSOS_COMPARTIBLES.length} cursos —sus clases, videos y recursos— y sin la marca de la casa. `
  + `Los cursos que se sumen después también aparecen. La sección «${CATEGORIA_PROPIA}» NO entra: `
  + 'para compartir uno de ésos, se comparte ese curso desde adentro.';

export default function Conocimientos() {
  const router = useRouter();
  const params = useSearchParams();
  const cursoSlug = params.get('curso');
  const claseN = params.get('clase');
  const rSlug = params.get('r');
  // De qué clase se abrió el recurso: viaja en la URL para que «Volver» devuelva ahí
  // aunque la pestaña se recargue o el link se copie. Ver el comentario de CursoPortal.
  const deN = params.get('de');
  const curso = buscarCurso(cursoSlug);

  const viewKey = params.toString();
  const scrollKey = (k: string) => 'cono-scroll:' + k;

  // `reemplazar` usa replace en vez de push: la entrada del historial se PISA. Sirve
  // para que leer 40 clases seguidas no deje 40 entradas y el Atrás del navegador siga
  // siendo útil. Los botones «Volver» NO dependen de esto: navegan explícitamente al
  // nivel de arriba (ver el comentario largo en CursoPortal).
  const nav = (q: Record<string, string>, o?: { reemplazar?: boolean }) => {
    // Guardo el scroll de la vista actual para poder restaurarlo si vuelvo acá.
    try { sessionStorage.setItem(scrollKey(viewKey), String(window.scrollY)); } catch { /* noop */ }
    const qs = new URLSearchParams(q).toString();
    const destino = '/conocimientos' + (qs ? '?' + qs : '');
    if (o?.reemplazar) router.replace(destino, { scroll: false });
    else router.push(destino, { scroll: false });
  };

  /**
   * ⚠️ AL ENTRAR DIRECTO A UN CURSO NO HAY GRILLA DEBAJO, Y EL ATRÁS SE VA DEL SITIO.
   *
   * Navegando desde la grilla, `nav()` hace `router.push` y el Atrás funciona: clase →
   * curso → grilla. Pero cuando se ATERRIZA en `?curso=X` —un link compartido, un
   * marcador, o simplemente recargar la página estando adentro— esa entrada nunca
   * existió, así que el Atrás salta a lo que hubiera antes: otro sitio.
   *
   * Martín lo reportó dos veces (29/08/2026): «al entrar a un curso, si le doy atrás me
   * sigue redirigiendo fuera, no me lleva a todos los cursos». La primera vez lo busqué
   * en el camino equivocado —arreglé el `replaceState` de la vista de curso, que era un
   * bug REAL pero otro— y lo di por cerrado porque el recorrido que probé (grilla →
   * curso → atrás) andaba. **El recorrido que falla es el que no pasa por la grilla.**
   *
   * Se siembra la entrada que falta: la grilla ES el nivel de arriba de un curso, así
   * que le corresponde estar debajo en el historial. Es la misma regla que ya rige a los
   * botones «Volver» acá — el destino es una propiedad de la PANTALLA, no del camino.
   *
   * Solo en el primer render de la pestaña y solo si se llegó con un curso puesto: si el
   * usuario ya navegó por adentro, su historial es suyo y no se toca.
   */
  const sembrado = useRef(false);
  useEffect(() => {
    if (sembrado.current) return;
    sembrado.current = true;
    if (!cursoSlug) return;
    try {
      const actual = window.location.pathname + window.location.search + window.location.hash;
      // Se conserva el `state` del router en las dos entradas: es su contabilidad interna
      // y pisarlo con `null` le rompe el Atrás de una forma mucho peor que el bug.
      window.history.replaceState(window.history.state, '', '/conocimientos');
      window.history.pushState(window.history.state, '', actual);
    } catch { /* noop */ }
  }, [cursoSlug]);

  // Al cambiar de vista (incluye Atrás del navegador y "Volver"): restaurar el
  // scroll guardado de esa vista, o ir arriba si es una vista nueva.
  useEffect(() => {
    let saved = 0;
    try { saved = parseInt(sessionStorage.getItem(scrollKey(viewKey)) || '0', 10) || 0; } catch { /* noop */ }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior })); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [viewKey]);

  let body: ReactNode;
  if (!curso) body = (
    <Selector
      cursos={TODOS}
      enter={(slug) => nav({ curso: slug })}
      compartir={<Compartir recurso="conocimientos" etiqueta="Conocimientos — todos los cursos" nota={NOTA_TAB} />}
    />
  );
  // "Análisis de Negocio" es una vista INTERACTIVA (form + modales de fases), no
  // un curso de texto: se renderiza aparte del portal genérico.
  else if (curso.slug === VISTA_PROPIA.analisis) body = <AnalisisNegocio back={() => nav({})} />;
  // "Branding MaKo" es una GALERÍA de archivos (no un curso de texto): el
  // material vive en Storage y se pide por API, así que también va aparte.
  else if (curso.slug === VISTA_PROPIA.branding) body = <BrandingMaKo back={() => nav({})} />;
  else body = (
    <CursoPortal
      curso={curso}
      vista={{ clase: claseN ? Number(claseN) : null, r: rSlug, de: deN ? Number(deN) : null }}
      nav={(v, o) => nav(
        v.clase != null ? { curso: curso.slug, clase: String(v.clase) }
          : v.r ? { curso: curso.slug, r: v.r, ...(v.de != null ? { de: String(v.de) } : {}) }
            : { curso: curso.slug },
        o,
      )}
      salir={() => nav({})}
      compartir={<Compartir recurso="curso" recursoId={curso.slug} etiqueta={curso.titulo} />}
    />
  );

  return (
    <PortalShell
      marca={
        <button type="button" className="al-brand-btn" onClick={() => nav({})} aria-label="Ir a los cursos">
          <span className="al-brand"><span className="b">Cono<span>cimientos</span></span><span className="sub">MaKo · formación</span></span>
        </button>
      }
      tag={curso ? <button type="button" className="al-toptag al-toptag-btn" onClick={() => nav({ curso: curso.slug })}>{curso.titulo}</button> : undefined}
    >
      {body}
    </PortalShell>
  );
}
