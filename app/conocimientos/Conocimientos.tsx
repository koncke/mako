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
// El portal de un curso (hub/clase/recurso + todo el diseño) vive en
// ./CursoPortal porque lo comparte con /compartido/<token>: el invitado ve
// EXACTAMENTE esta pantalla, no un resumen. Acá queda lo que es solo del admin:
// el selector, la navegación por URL y los dos cursos que no son de texto.

import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CURSOS, type Curso } from './curso';
import { CURSO_VSL } from './curso-vsl';
import { CURSO_PRODUCTO_APP } from './curso-producto-app';
import AnalisisNegocio, { CURSO_ANALISIS } from './AnalisisNegocio';
import BrandingMaKo, { CURSO_BRANDING } from './BrandingMaKo';
import Compartir from './Compartir';
import CursoPortal, { Card, PortalShell } from './CursoPortal';

// curso.ts es AUTO-GENERADO desde transcripciones: los módulos escritos a mano
// viven en su propio archivo y se suman acá.
const TODOS: Curso[] = [...CURSOS, CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP];

// ── Selector de cursos (landing) ─────────────────────────────────────────────
function Selector({ enter }: { enter: (slug: string) => void }) {
  const cats = useMemo(() => {
    const m: Record<string, Curso[]> = {};
    for (const c of TODOS) (m[c.categoria] = m[c.categoria] || []).push(c);
    return m;
  }, []);
  return (
    <>
      <section className="al-hero">
        <span className="al-eyebrow"><span className="d" /> Conocimientos · MaKo</span>
        <h1 className="al-h1">Cursos</h1>
        <p className="al-sub">Formación interna. Elegí un curso para entrar. Cada categoría junta los cursos del mismo tema.</p>
      </section>
      {Object.entries(cats).map(([cat, list]) => (
        <section className="al-sec" key={cat}>
          <div className="al-seclabel"><span>{cat}</span><span className="al-vol">{list.length} curso{list.length > 1 ? 's' : ''}</span></div>
          <div className="al-grid">
            {list.map((c) => (
              <Card key={c.slug} badge="Curso" titulo={c.titulo} desc={c.cardDesc}
                ariaLabel={`Entrar a ${c.titulo}`} onClick={() => enter(c.slug)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export default function Conocimientos() {
  const router = useRouter();
  const params = useSearchParams();
  const cursoSlug = params.get('curso');
  const claseN = params.get('clase');
  const rSlug = params.get('r');
  const curso = cursoSlug ? TODOS.find((c) => c.slug === cursoSlug) : undefined;

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
  if (!curso) body = <Selector enter={(slug) => nav({ curso: slug })} />;
  // "Análisis de Negocio" es una vista INTERACTIVA (form + modales de fases), no
  // un curso de texto: se renderiza aparte del portal genérico.
  else if (curso.slug === 'analisis-negocio') body = <AnalisisNegocio back={() => nav({})} />;
  // "Branding MaKo" es una GALERÍA de archivos (no un curso de texto): el
  // material vive en Storage y se pide por API, así que también va aparte.
  else if (curso.slug === 'branding-mako') body = <BrandingMaKo back={() => nav({})} />;
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
