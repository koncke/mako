'use client';

// =============================================================================
// ComunidadEquipo — la tab Comunidad del EQUIPO (/customer-success/comunidad)
// =============================================================================
// La misma comunidad que ve el alumno (app/_comunidad/Comunidad.tsx), con la piel de la app y las
// server actions de ./actions.ts como camino al server. El equipo escribe con su nombre y es admin de
// la comunidad: fija, borra lo ajeno y —si administra el workspace— arma las categorías y los nombres
// de los niveles.
//
// El producto se elige arriba, como en el Curso: es un `?producto=` en la URL, leído en el server, así
// la página llega con su comunidad ya armada (sin estado de carga) y el link que se copia es la
// comunidad que se está mirando.

import { useMemo } from 'react';
import { EmptyState, Pagina, Select } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { Comunidad } from '@/app/_comunidad/Comunidad';
import { seguro, type ApiComunidad } from '@/app/_comunidad/api';
import type { ComunidadVista, FeedVista } from '@/lib/comunidad-tipos';
import type { PasoComunidad } from './onboarding-comunidad';
import {
  inicioComunidadAction, feedComunidadAction, detallePostAction, publicarPostAction, editarPostAction, borrarPostAction,
  fijarPostAction, comentarAction, editarComentarioAction, borrarComentarioAction, likeAction, votarAction, rankingAction,
  miembrosAction, perfilAction, guardarPerfilAction, subidaAdjuntoAction, descartarAdjuntoAction, guardarCategoriaAction,
  borrarCategoriaAction, moverCategoriaAction, guardarNombresNivelAction, calendarioAction, icsAction, opcionesEventoAction,
  guardarEventoAction, borrarEventoAction, campanaAction, leerCampanaAction, seguirPostAction, aboutAction, guardarAboutAction,
  guardarAjustesAction, buscarAction, sacarAlumnoAction, admitirAlumnoAction, sacadosAction, cerrarComentariosAction,
} from './actions';

/** La API del equipo: cada pedido es una server action con el producto elegido. */
function apiDelEquipo(p: number): ApiComunidad {
  return {
    inicio: seguro(() => inicioComunidadAction(p)),
    feed: seguro((q) => feedComunidadAction(p, q)),
    post: seguro((id) => detallePostAction(p, id)),
    publicar: seguro((e) => publicarPostAction(p, e)),
    editarPost: seguro((id, e) => editarPostAction(p, id, e)),
    borrarPost: seguro((id) => borrarPostAction(p, id)),
    fijarPost: seguro((id, si) => fijarPostAction(p, id, si)),
    comentar: seguro((postId, e) => comentarAction(p, postId, e)),
    editarComentario: seguro((id, e) => editarComentarioAction(p, id, e)),
    borrarComentario: seguro((id) => borrarComentarioAction(p, id)),
    like: seguro((objetivo, si) => likeAction(p, objetivo, si)),
    votar: seguro((postId, opcion) => votarAction(p, postId, opcion)),
    ranking: seguro(() => rankingAction(p)),
    miembros: seguro((q) => miembrosAction(p, q)),
    perfil: seguro((clave) => perfilAction(p, clave)),
    guardarPerfil: seguro((e) => guardarPerfilAction(p, e)),
    subida: seguro((mime, bytes) => subidaAdjuntoAction(p, mime, bytes)),
    descartar: seguro((path) => descartarAdjuntoAction(p, path)),
    guardarCategoria: seguro((c) => guardarCategoriaAction(p, c)),
    borrarCategoria: seguro((id) => borrarCategoriaAction(p, id)),
    moverCategoria: seguro((id, dir) => moverCategoriaAction(p, id, dir)),
    guardarNombresNivel: seguro((n) => guardarNombresNivelAction(p, n)),
    // La segunda mitad: el calendario, la campana, el About, la búsqueda y la moderación.
    calendario: seguro((q) => calendarioAction(p, q)),
    ics: seguro((q) => icsAction(p, q)),
    campana: seguro(() => campanaAction(p)),
    leerCampana: seguro((ids) => leerCampanaAction(p, ids)),
    seguirPost: seguro((id, si) => seguirPostAction(p, id, si)),
    about: seguro(() => aboutAction(p)),
    buscar: seguro((q) => buscarAction(p, q)),
    opcionesEvento: seguro(() => opcionesEventoAction(p)),
    guardarEvento: seguro((e) => guardarEventoAction(p, e)),
    borrarEvento: seguro((q) => borrarEventoAction(p, q)),
    guardarAbout: seguro((e) => guardarAboutAction(p, e)),
    guardarAjustes: seguro((e) => guardarAjustesAction(p, e)),
    sacar: seguro((clave, opts) => sacarAlumnoAction(p, clave, opts)),
    admitir: seguro((clave) => admitirAlumnoAction(p, clave)),
    sacados: seguro(() => sacadosAction(p)),
    cerrarComentarios: seguro((id, si) => cerrarComentariosAction(p, id, si)),
  };
}

const ROTULO_PASO: Record<PasoComunidad, string> = {
  comunidad_categorias: 'Tus categorías',
  comunidad_post: 'Tu primer post',
  comunidad_alumnos: 'Un alumno participa',
};

export function ComunidadEquipo({ productos, productoId, inicial, error, onboarding }: {
  productos: Array<{ id: number; nombre: string }>;
  productoId: number | null;
  inicial: { comunidad: ComunidadVista; feed: FeedVista } | null;
  error: string | null;
  /** La línea del onboarding de la tab (`null` = ya está). */
  onboarding: Record<PasoComunidad, boolean> | null;
}) {
  const router = useRouter();
  const api = useMemo(() => (productoId ? apiDelEquipo(productoId) : null), [productoId]);

  if (!productos.length || !productoId || !api) {
    return (
      <Pagina>
        <EmptyState titulo="Sin productos" detalle="La comunidad es de un producto. Crea uno en el CRM." />
      </Pagina>
    );
  }

  const selector = productos.length > 1 ? (
    <div style={{ minWidth: 220 }}>
      <Select ariaLabel="Producto" value={String(productoId)}
        onChange={(v) => router.replace(`/customer-success/comunidad?producto=${encodeURIComponent(v)}`, { scroll: false })}
        options={productos.map((p) => ({ value: String(p.id), label: p.nombre }))} />
    </div>
  ) : <span className="cmu-dim cmu-chico">{productos[0].nombre}</span>;

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
        <Comunidad key={productoId} api={api} tema="equipo" inicial={inicial} cabecera={selector} aviso={linea} />
      )}
    </Pagina>
  );
}
