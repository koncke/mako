'use client';

// =============================================================================
// /conocimientos — Portal de formación interna (admin). RAG-source de MaKo.
// =============================================================================
// Hub MULTI-CURSO. La navegación la lleva `./posicion.ts`, que es el ÚNICO dueño
// de la URL en las dos rutas del portal. Acá vivía un esquema propio de query
// params (?curso=…&clase=N) que se sigue LEYENDO para no romper links viejos,
// pero ya no se escribe. Sin tapar el sidebar de admin. Contenido en ./curso.
//
// Vistas: selector de cursos → hub del curso → detalle de clase / de recurso.
//
// El portal de un curso (hub/clase/recurso + todo el diseño) y el SELECTOR viven
// en ./CursoPortal porque los comparte con /compartido/<token>: el invitado ve
// EXACTAMENTE esta pantalla, no un resumen. Acá queda lo que es solo del admin:
// la navegación por URL, los dos cursos que no son de texto, y los botones de
// Compartir (que se inyectan por prop, así ese código no llega al invitado).

import { useEffect, type ReactNode } from 'react';
import { navegar, sembrar, usePosicion } from './posicion';
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
  /**
   * TODA la navegacion sale de `usePosicion`, igual que el portal compartido.
   *
   * Aca vivia el TERCER dueño de la URL: el router de Next con `?curso=&clase=&r=&de=`,
   * mas su propia memoria de scroll y su propia siembra del historial. Tres dueños de
   * la misma direccion, y ninguno enterandose de lo que escribian los otros porque
   * `pushState` no dispara ningun evento. El porque completo esta en posicion.ts.
   */
  const { pos, ir } = usePosicion();
  const curso = buscarCurso(pos.curso);

  /**
   * ⚠️ LOS LINKS VIEJOS SIGUEN ANDANDO. Esta pantalla vivio meses en `?curso=X&clase=N`,
   * y eso esta pegado en marcadores, en mails y en mensajes. Se traduce UNA vez al
   * montar, REEMPLAZANDO la entrada: el link viejo aterriza donde debe y no deja una
   * entrada fantasma que haga que el primer Atras no haga nada.
   *
   * ⚠️ Y se sacan SOLO las claves viejas. `?ws=` NO se toca: decide que cliente estas
   *    mirando, y perderlo no se ve como un error — te deja mirando otra cuenta.
   */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('curso');
    if (c) {
      const n = Number(q.get('clase'));
      const r = q.get('r');
      for (const k of ['curso', 'clase', 'r', 'de']) q.delete(k);
      const qs = q.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : ''));
      navegar({ curso: c, clase: Number.isFinite(n) && n > 0 ? n : undefined, r: r ?? undefined }, 'reemplazar');
    }
    // El catalogo es el nivel de arriba de un curso: si se aterrizo adentro, se siembra.
    sembrar({});
  }, []);

  let body: ReactNode;
  if (!curso) body = (
    <Selector
      cursos={TODOS}
      enter={(slug) => ir({ curso: slug })}
      compartir={<Compartir recurso="conocimientos" etiqueta="Conocimientos — todos los cursos" nota={NOTA_TAB} />}
    />
  );
  // "Análisis de Negocio" es una vista INTERACTIVA (form + modales de fases), no
  // un curso de texto: se renderiza aparte del portal genérico.
  else if (curso.slug === VISTA_PROPIA.analisis) body = <AnalisisNegocio back={() => ir({})} />;
  // "Branding MaKo" es una GALERÍA de archivos (no un curso de texto): el
  // material vive en Storage y se pide por API, así que también va aparte.
  else if (curso.slug === VISTA_PROPIA.branding) body = <BrandingMaKo back={() => ir({})} />;
  else body = (
    <CursoPortal
      curso={curso}
      vista={{ clase: pos.clase ?? null, r: pos.r ?? null, de: null }}
      nav={(v, o) => ir(
        { curso: curso.slug, clase: v.clase ?? undefined, r: v.r ?? undefined },
        o?.reemplazar ? 'reemplazar' : 'empujar',
      )}
      salir={() => ir({})}
      compartir={<Compartir recurso="curso" recursoId={curso.slug} etiqueta={curso.titulo} />}
    />
  );

  return (
    <PortalShell
      marca={
        <button type="button" className="al-brand-btn" onClick={() => ir({})} aria-label="Ir a los cursos">
          <span className="al-brand"><span className="b">Cono<span>cimientos</span></span><span className="sub">MaKo · formación</span></span>
        </button>
      }
      tag={curso ? <button type="button" className="al-toptag al-toptag-btn" onClick={() => ir({ curso: curso.slug })}>{curso.titulo}</button> : undefined}
    >
      {body}
    </PortalShell>
  );
}
