'use client';

// =============================================================================
// ComunidadEquipo — la comunidad del EQUIPO, adentro de Clients (/clients/community, /calendar, /members…)
// =============================================================================
// La misma comunidad que ve el alumno (app/_comunidad/Comunidad.tsx), con la piel del CURSO (17/10/2026) y las
// server actions de ./actions.ts como camino al server. El equipo escribe con su nombre y es admin de
// la comunidad: fija, borra lo ajeno y —si administra el workspace— arma las categorías y los nombres
// de los niveles.
//
// El PROGRAMA lo elige la cabecera de Clients (app/clients/ClientsShell.tsx): es un `?producto=` en la URL,
// leído en el server, así la página llega con su comunidad ya armada (sin estado de carga). La PESTAÑA también
// sale de la URL (la sub-tab de Clients): las cinco son una página, y cambiar entre ellas es `pushState` (D5 de
// docs/diseno-clients.md). Las vueltas de adentro (la campana abre un post, «Ver ranking») escriben la URL igual.

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { EmptyState, Pagina } from '@/app/_ui';
import { Comunidad, type Pestana } from '@/app/_comunidad/Comunidad';
import { PESTANA_DE_SECCION, esSeccionComunidad, hrefSeccion, seccionDeRuta, seccionDePestana } from '@/lib/clients-rutas';
import type { ComunidadVista, FeedVista } from '@/lib/comunidad-tipos';
import type { PasoComunidad } from './onboarding-comunidad';
// La API del equipo vive en ./api-equipo.ts desde el 08/10/2026: la usa también la lección del editor
// del curso (los comentarios de una clase), y desde acá habría arrastrado la comunidad entera.
import { apiDelEquipo } from './api-equipo';

const ROTULO_PASO: Record<PasoComunidad, string> = {
  comunidad_categorias: 'Tus categorías',
  comunidad_post: 'Tu primer post',
  comunidad_alumnos: 'Un alumno participa',
};

export function ComunidadEquipo({ productos, productoId, inicial, error, onboarding, postInicial = null }: {
  productos: Array<{ id: number; nombre: string }>;
  productoId: number | null;
  inicial: { comunidad: ComunidadVista; feed: FeedVista } | null;
  error: string | null;
  /** La línea del onboarding de la tab (`null` = ya está). */
  onboarding: Record<PasoComunidad, boolean> | null;
  /** El post que se abre al entrar (`?post=`: el link de la ficha a lo que publicó un alumno). */
  postInicial?: number | null;
}) {
  const pathname = usePathname() ?? '';
  const seccion = seccionDeRuta(pathname);
  const pestana: Pestana = esSeccionComunidad(seccion) ? PESTANA_DE_SECCION[seccion] : 'comunidad';
  // Estable mientras no cambie la pestaña: entra al contexto de la comunidad (sus vueltas internas la usan).
  const irA = useCallback((p: Pestana) => {
    if (p === pestana) return;
    try { window.history.pushState(null, '', hrefSeccion(seccionDePestana(p), window.location.search)); } catch { /* sin URL no se pierde nada */ }
  }, [pestana]);
  const api = useMemo(() => (productoId ? apiDelEquipo(productoId) : null), [productoId]);

  if (!productos.length || !productoId || !api) {
    return (
      <Pagina>
        <EmptyState titulo="Sin productos" detalle="La comunidad es de un producto. Crea uno en el CRM." />
      </Pagina>
    );
  }

  const linea = onboarding ? (
    <div className="cmu-onb" style={{ marginBottom: 14 }}>
      <b>Arma tu comunidad</b>
      {(Object.keys(ROTULO_PASO) as PasoComunidad[]).map((k) => (
        <span key={k} className="cmu-onb-paso" data-hecho={onboarding[k]}>{onboarding[k] ? '✓' : '○'} {ROTULO_PASO[k]}</span>
      ))}
    </div>
  ) : null;

  return (
    <Pagina>
      {error && !inicial ? (
        <EmptyState titulo="No pude cargar la comunidad" detalle={error} />
      ) : (
        <Comunidad key={productoId} api={api} tema="equipo" inicial={inicial} aviso={linea} postInicial={postInicial}
          pestana={pestana} onPestana={irA} sinPestanas />
      )}
    </Pagina>
  );
}
