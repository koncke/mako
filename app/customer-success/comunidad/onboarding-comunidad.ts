// =============================================================================
// onboarding-comunidad — qué DATO cierra cada paso del onboarding de la tab Comunidad
// =============================================================================
// Regla de la casa: toda tab tiene onboarding y su estado alimenta a MaKo. Los pasos están
// declarados en lib/tab-onboarding-catalogo.ts (`cs-comunidad`); acá vive la regla de cuándo cada
// uno está hecho, y es PURA para que el test la ejecute (tests/comunidad-nav.test.ts).
//
// ⚠️ EL ESTADO SE DERIVA DE LOS DATOS, NO SE RECUERDA, como el del Curso: la página lo anota en cada
//    carga (./onboarding-sync.ts). Y NO TAPA LA TAB: es una línea arriba del feed mientras falte algo,
//    no un wizard. La comunidad se arma usándola.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY»: un hecho en `null` no marca nada.
//
// Sin 'use client' ni 'server-only': lo usan la página (server), la línea de la tab (navegador) y el test.

/** La key de la tab en el catálogo de onboardings (y en el nav). */
export const TAB_COMUNIDAD = 'cs-comunidad';

/**
 * Los pasos, EN EL ORDEN DEL CATÁLOGO (el test compara las dos listas: `marcarPasoTab` no marca un
 * paso con uno obligatorio anterior pendiente, así que el orden es una guarda).
 *   · comunidad_categorias → hay al menos una categoría. OPCIONAL: una comunidad sin categorías existe
 *     (Skool las ofrece, no las exige).
 *   · comunidad_post       → el ENSAYO: alguien publicó el primer post (el equipo, que es quien abre la
 *     conversación). Es el único obligatorio: sin un post, lo que ve un alumno es un feed vacío.
 *   · comunidad_alumnos    → un alumno ya participó (publicó o comentó). OPCIONAL y al final: depende
 *     de otros, y no puede trabar la tab.
 */
export const PASOS_COMUNIDAD = ['comunidad_categorias', 'comunidad_post', 'comunidad_alumnos'] as const;
export type PasoComunidad = (typeof PASOS_COMUNIDAD)[number];

/** Lo que se sabe de la comunidad de este workspace (todas sus comunidades). `null` = no se pudo leer. */
export type HechosComunidad = { categorias: number | null; posts: number | null; participacion: number | null };

const hay = (n: number | null): boolean | null => (n == null ? null : n > 0);

/** Qué dice el dato de cada paso: `true` hecho, `false` no hecho, `null` no se sabe. */
export function pasosDeLosDatos(h: HechosComunidad): Record<PasoComunidad, boolean | null> {
  return {
    comunidad_categorias: hay(h.categorias),
    comunidad_post: hay(h.posts),
    comunidad_alumnos: hay(h.participacion),
  };
}

/**
 * Lo que hay que escribir para que el estado guardado diga lo mismo que los datos, en el orden del
 * catálogo. ⚠️ SÓLO MARCA, NO DESMARCA: haber publicado el primer post o que un alumno haya
 * participado son hechos que ya pasaron — borrar ese post no des-hace que la comunidad arrancó, y
 * desmarcarlo le volvería a poner la línea del onboarding a quien ya la usa.
 */
export function cambiosDeOnboarding(
  steps: Readonly<Record<string, { done?: boolean } | undefined>>,
  h: HechosComunidad,
): Array<{ paso: PasoComunidad; done: true }> {
  const d = pasosDeLosDatos(h);
  return PASOS_COMUNIDAD.filter((p) => d[p] === true && !steps[p]?.done).map((paso) => ({ paso, done: true as const }));
}

/**
 * La línea del onboarding de la tab: `null` = no se dibuja (ya está, o no se pudo leer lo anotado).
 * Se va cuando está el post (el único obligatorio); los opcionales no la sostienen.
 */
export function lineaOnboarding(steps: Readonly<Record<string, { done?: boolean } | undefined>> | null): Record<PasoComunidad, boolean> | null {
  if (!steps || steps.comunidad_post?.done) return null;
  return {
    comunidad_categorias: !!steps.comunidad_categorias?.done,
    comunidad_post: false,
    comunidad_alumnos: !!steps.comunidad_alumnos?.done,
  };
}
