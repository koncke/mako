// =============================================================================
// Cómo se NOMBRA un enlace compartido
// =============================================================================
// Un share se guarda con `recurso` + `recurso_id` (la CLAVE) y con `etiqueta`, que es el
// título tal como estaba el día que se emitió. Esta función contesta «¿qué comparte esta
// fila?» con el nombre de HOY, y es la única que lo contesta.
//
// ⚠️ POR QUÉ NO ALCANZA `etiqueta`: se escribe UNA vez, en el insert, y ningún update la
//    vuelve a tocar (lib/shares.ts). Es la foto de cuando se guardó, y ya divergió en
//    producción: el share id=4 dice «Curso AVATARHYPE» y ese curso hoy se llama
//    «AvatarHype». El id es una clave, el título es un parecido — así que el nombre sale
//    del id, y la etiqueta queda de respaldo para lo que el id no sabe resolver.
//
// ⚠️ POR QUÉ RECIBE EL RESOLVEDOR POR PARÁMETRO en vez de importar el catálogo: el
//    catálogo de cursos son ~5 MB de fichas. Importándolo acá, este módulo deja de poder
//    testearse barato y cualquiera que lo importe desde un `'use client'` se lleva los 132
//    cursos al navegador. Quien llama ya tiene el resolvedor a mano (`buscarCurso`).
//
// ⚠️ Y SIN `server-only` A PROPÓSITO: si la condición vive adentro del que hace el trabajo
//    sucio, ningún test la puede importar. Es la misma razón que `exigirClienteDePrueba`.

/** Lo mínimo de una fila de `shares` para poder nombrarla. */
export type ShareParaNombrar = {
  recurso: string;
  recurso_id: string | null;
  etiqueta: string | null;
};

/** Lo que dice la fila cuando comparte la tab entera. Acá y no en cada pantalla: el mail
 *  y el modal tienen que decir lo MISMO de la misma fila. */
export const TODOS_LOS_CURSOS = 'Todos los cursos';

/** Último recurso, cuando no hay id ni etiqueta de dónde sacar un nombre. */
export const SIN_NOMBRE = 'Material de MaKo';

/**
 * El recurso del INFORME del Dashboard (11/10/2026, «Compartir» de la tab Dashboard). Vive acá, en el
 * módulo sin dependencias, para que lib/shares.ts, la ruta, la página pública y los tests nombren la
 * MISMA cadena: con dos copias, una se escribe «informe» un día y el share deja de servirse sin error.
 *
 * Su `recurso_id` es el `sub` de la persona dueña del informe (el informe es POR PERSONA:
 * `graficos.tablero.<sub>`, lib/graficos-tablero.ts), y por eso NUNCA se usa como nombre: un id de
 * usuario en la lista de «quién tiene acceso» no le dice nada a nadie.
 */
export const RECURSO_INFORME = 'dashboard';

/** El nombre de un informe que no trae ninguno: el mismo que el inicial (NOMBRE_INICIAL del catálogo). */
export const INFORME_SIN_NOMBRE = 'Dashboard';

/**
 * Qué comparte esta fila, con el nombre de HOY.
 *
 * `tituloDeCurso` resuelve un slug a su título actual — en este repo es `buscarCurso`,
 * que además salta los slugs REEMPLAZADOS, así que un share emitido con el nombre viejo
 * de un curso se sigue nombrando bien.
 *
 * `nombreDeInforme` es el nombre de HOY del informe del Dashboard al que apunta la fila (lo lee la
 * ruta del informe guardado de esa persona). Sólo cuenta para `recurso: 'dashboard'`.
 *
 * El orden es el de la confianza: la clave primero, la foto después, el id crudo al final.
 * Nunca devuelve cadena vacía — una fila sin nombre en una lista es una fila que no se
 * puede decidir si revocar.
 */
export function nombreDeShare(
  s: ShareParaNombrar,
  tituloDeCurso: (slug: string) => string | undefined,
  nombreDeInforme?: string | null,
): string {
  // El informe: su nombre de hoy, si no la foto del día que se emitió, si no el del inicial. NUNCA el
  // `recurso_id`, que es el id de una persona.
  if (s.recurso === RECURSO_INFORME) return nombreDeInforme?.trim() || s.etiqueta?.trim() || INFORME_SIN_NOMBRE;

  // La tab entera no apunta a ninguna cosa: su `recurso_id` es null en las 17 filas de
  // producción, así que no hay nada que resolver y el nombre es una constante. Se decide
  // por `recurso` y NO por `alcance: 'todo'`, que es lo que primero viene a la mano: el
  // POST acepta un `alcance` del body (app/api/compartir/route.ts), así que es un campo
  // que llega del request, y «todo» de otro recurso no sería «todos los CURSOS».
  if (s.recurso === 'conocimientos') return TODOS_LOS_CURSOS;

  if (s.recurso === 'curso' && s.recurso_id) {
    const t = tituloDeCurso(s.recurso_id)?.trim();
    if (t) return t;
  }

  // Branding comparte una sección o un grupo del material de marca, y ese id no lo
  // resuelve ningún catálogo importable desde acá: el mapa id→rótulo vive en
  // `BrandingMaKo.tsx`, que a su vez importa el botón de Compartir — importarlo de vuelta
  // es un ciclo. Ahí la etiqueta guardada es lo mejor que hay, y además es exactamente lo
  // que esa pantalla pública dibuja como título.
  return s.etiqueta?.trim() || s.recurso_id?.trim() || SIN_NOMBRE;
}
