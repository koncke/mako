// =============================================================================
// El catálogo de cursos — FUENTE ÚNICA
// =============================================================================
// Lo consumen los DOS lados de /conocimientos:
//   • el portal del admin (`Conocimientos.tsx`), que lista y abre;
//   • el link compartido (`app/compartido/[token]/page.tsx`), que resuelve el
//     slug de un share `recurso='curso'`.
//
// Vive acá porque cada uno tenía su propia lista y se desincronizaron: el
// compartido armaba `[...CURSOS, CURSO_VSL]` y el portal seis fuentes. Los dos
// cursos que faltaban ("Curso de Claude AI - Rodrigo Rojo" y "Construir la
// app") se podían compartir desde la UI y su link daba **404**, sin ningún
// síntoma del lado del admin: el share se creaba bien, la fila estaba viva, y
// el 404 salía del `notFound()` del final de la búsqueda. Cada curso nuevo
// entraba roto por default.
//
// ⚠️ Un curso nuevo se suma ACÁ y en ningún otro lado.

import { CURSOS, type Curso } from './curso';
import { CURSO_VSL } from './curso-vsl';
import { CURSO_PRODUCTO_APP } from './curso-producto-app';
import { CURSO_CLAUDE_AI_RODRIGO_ROJO } from './curso-claude-ai-rodrigo-rojo';
import { CURSO_ANALISIS } from './AnalisisNegocio';
import { CURSO_BRANDING } from './BrandingMaKo';

// curso.ts es AUTO-GENERADO desde transcripciones: los cursos escritos a mano
// viven en su propio archivo y se suman acá.
export const CURSOS_TODOS: Curso[] = [
  ...CURSOS, CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP, CURSO_CLAUDE_AI_RODRIGO_ROJO,
];

export const buscarCurso = (slug: string | null | undefined): Curso | undefined =>
  slug ? CURSOS_TODOS.find((c) => c.slug === slug) : undefined;

/**
 * Los dos cursos que NO se dibujan con `CursoPortal`: tienen vista propia.
 * Los slugs se nombran acá —y no sueltos en cada `if`— para que el portal y el
 * link compartido decidan por el MISMO dato.
 *
 *  • `analisis`: es un formulario interactivo con las 5 fases, no clases de
 *    video. Compartido, lo dibuja `AnalisisCompartido`.
 *  • `branding`: es una galería de archivos que viven en Storage. NO se
 *    comparte como curso: tiene su propio recurso de share (`recurso='branding'`,
 *    que resuelve por `Galeria`), porque el alcance puede ser una sección o una
 *    pieza suelta y no el curso entero.
 */
export const VISTA_PROPIA = {
  analisis: CURSO_ANALISIS.slug,
  branding: CURSO_BRANDING.slug,
} as const;
