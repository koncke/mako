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

import { useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { CURSOS_TODOS as TODOS, CURSOS_COMPARTIBLES, buscarCurso, VISTA_PROPIA } from './catalogo';
import AnalisisNegocio from './AnalisisNegocio';
import BrandingMaKo from './BrandingMaKo';
import Compartir from './Compartir';
import CursoPortal, { PortalShell, Selector } from './CursoPortal';

// La letra chica del link de la TAB: cuántos cursos entran y qué queda afuera.
// «Compartir "Conocimientos"» no dice ninguna de las dos cosas, y sin decirlas
// el que comparte no sabe qué está repartiendo.
const NOTA_TAB = `El link abre el portal completo: ${CURSOS_COMPARTIBLES.length} cursos con sus clases, videos y recursos. `
  + 'Los cursos que se sumen después también aparecen. Branding MaKo no entra — se comparte desde adentro, por sección o pieza.';

export default function Conocimientos() {
  const router = useRouter();
  const params = useSearchParams();
  const cursoSlug = params.get('curso');
  const claseN = params.get('clase');
  const rSlug = params.get('r');
  const curso = buscarCurso(cursoSlug);

  const viewKey = params.toString();
  const scrollKey = (k: string) => 'cono-scroll:' + k;

  const nav = (q: Record<string, string>) => {
    // Guardo el scroll de la vista actual para poder restaurarlo si vuelvo acá.
    try { sessionStorage.setItem(scrollKey(viewKey), String(window.scrollY)); } catch { /* noop */ }
    const qs = new URLSearchParams(q).toString();
    router.push('/conocimientos' + (qs ? '?' + qs : ''), { scroll: false });
  };
  const back = () => router.back();

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
      vista={{ clase: claseN ? Number(claseN) : null, r: rSlug }}
      nav={(v) => nav(v.clase != null ? { curso: curso.slug, clase: String(v.clase) } : v.r ? { curso: curso.slug, r: v.r } : { curso: curso.slug })}
      back={back}
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
