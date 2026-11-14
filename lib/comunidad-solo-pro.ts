// =============================================================================
// comunidad-solo-pro — la comunidad de los alumnos es SÓLO de MaKo Pro (14/11/2026, puro)
// =============================================================================
// Martín (14/11/2026): «no pusiste nada de la parte de Classroom, la parte de comunidad… seas más limitado en el de 47».
// Es la función `'comunidad'` de `FUNCIONES_SOLO_PRO` (lib/topes-plan.ts). Lo decide SIEMPRE el plan del NEGOCIO dueño de
// la comunidad (`esEsencialDe(ws)`, lib/plan-esencial.ts), nunca la sesión de quien mira: el alumno entra sin sesión de
// MaKo (su token firma el negocio) y su plan no existe.
//
// DÓNDE SE HACE CUMPLIR:
//   · la pantalla del negocio (/classroom/community, calendar, leaderboards y about: app/customer-success/comunidad/
//     pantalla.tsx) muestra el candado en lugar de la comunidad;
//   · el portal del alumno (/compartido/curso/<token> y /mi-curso) no ofrece la entrada «Comunidad» (`ofreceComunidad`);
//   · CREAR un post (`publicarPost`) y CREAR un evento (`guardarEvento` sin id), en lib/: son las únicas escrituras que hacen
//     nacer algo en la comunidad, y por ahí pasan las cinco puertas (las acciones del equipo, la ruta del alumno, la tarea
//     «Publicar en la comunidad» y la API de MaKo).
// LO QUE NO SE CIERRA, a propósito: los COMENTARIOS DE UNA CLASE (mig 0227). Viven en `comunidad_posts` como un hilo, pero
// son del CURSO (se prenden en el «…» de cada clase) y no pasan por `publicarPost` (`abrirHiloDeLaClase`). Classroom es de
// los dos planes.
// =============================================================================

import { textoSoloPro } from './topes-plan';

/** Lo que lee el ALUMNO de un negocio Esencial si llega a escribir en la comunidad: el plan no es suyo, no se le vende. */
export const TEXTO_COMUNIDAD_CERRADA_ALUMNO = 'La comunidad de este programa no está abierta.';

/**
 * El candado en el TELÉFONO (/m/comunidad): el teléfono no vende (T5, docs/tiendas-play-appstore.md), así que dice de qué
 * plan es, sin «Pasa a Pro». Es el comienzo de `textoSoloPro('comunidad')` (lo fija tests/classroom-topes-esencial.test.ts).
 */
export const TEXTO_COMUNIDAD_SOLO_PRO_TELEFONO = 'La comunidad de tus alumnos es de MaKo Pro.';

/** El texto del candado para quien escribe: el equipo del negocio lee el de Pro; el alumno, que no está abierta. */
export const textoCandadoComunidad = (equipo: boolean): string => (equipo ? textoSoloPro('comunidad') : TEXTO_COMUNIDAD_CERRADA_ALUMNO);
