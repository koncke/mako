// =============================================================================
// api-equipo — el camino al server de la comunidad, para el EQUIPO (server actions con su sesión)
// =============================================================================
// Vivía adentro de ./ComunidadEquipo.tsx. Se mudó acá el 08/10/2026 porque desde ese día lo usa una
// SEGUNDA pantalla: los comentarios de una clase en la lección del editor del curso (item 13 del audio,
// app/_cursos/ComentariosClase.tsx, que monta app/customer-success/curso/CursoApp.tsx). Importarlo de
// ComunidadEquipo.tsx habría metido la comunidad entera (el feed, el calendario, los miembros) en el
// paquete del curso por una función de diez líneas.
//
// Sin 'use client' ni 'server-only': son referencias a server actions envueltas con `seguro`, y lo
// importan sólo componentes de cliente.

import { seguro, type ApiComunidad } from '@/app/_comunidad/api';
import {
  inicioComunidadAction, feedComunidadAction, detallePostAction, publicarPostAction, editarPostAction, borrarPostAction,
  fijarPostAction, comentarAction, editarComentarioAction, borrarComentarioAction, likeAction, votarAction, rankingAction,
  miembrosAction, perfilAction, guardarPerfilAction, subidaAdjuntoAction, descartarAdjuntoAction, guardarCategoriaAction,
  borrarCategoriaAction, moverCategoriaAction, guardarNombresNivelAction, calendarioAction, icsAction, opcionesEventoAction,
  guardarEventoAction, borrarEventoAction, campanaAction, leerCampanaAction, seguirPostAction, aboutAction, guardarAboutAction,
  guardarAjustesAction, buscarAction, sacarAlumnoAction, admitirAlumnoAction, sacadosAction, cerrarComentariosAction,
  hiloDeClaseAction, comentarEnClaseAction,
} from './actions';

/** La API del equipo: cada pedido es una server action con el producto elegido. */
export function apiDelEquipo(p: number): ApiComunidad {
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
    // Los comentarios de una clase (mig 0227): los dibuja la lección del editor del curso.
    hiloClase: seguro((claseId) => hiloDeClaseAction(p, claseId)),
    comentarClase: seguro((claseId, e) => comentarEnClaseAction(p, claseId, e)),
  };
}
