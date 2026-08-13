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
import { CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE } from './curso-aumenta-tu-valor-y-atv-advantage';
import { CURSO_ANALISIS } from './AnalisisNegocio';
import { CURSO_BRANDING } from './BrandingMaKo';

/**
 * Cómo se agrupan los cursos en el selector, por slug.
 *
 * ⚠️ Vive ACÁ y no en cada curso porque cinco de ellos (`avatarhype`, `masteryhaus`,
 * `bluehacker`, `anuncio-ganador`, `100ads-analisis`) están dentro de `curso.ts`, que
 * es **auto-generado**: una categoría escrita ahí se pierde en la próxima
 * regeneración. Acá sobrevive, y de paso queda UN solo lugar donde se lee el mapa
 * completo de secciones en vez de nueve archivos.
 *
 * Un curso que no esté en el mapa conserva la categoría que trae — no se le inventa
 * una ni se lo manda a un cajón «Otros».
 */
const CATEGORIA: Record<string, string> = {
  // Cursos de terceros sobre el negocio digital
  masteryhaus: 'Negocios digitales',
  bluehacker: 'Negocios digitales',
  'aumenta-tu-valor-y-atv-advantage': 'Negocios digitales',
  'sell-your-knowledge': 'Negocios digitales',
  // IA y generación de piezas
  avatarhype: 'IA & Generación de Imágenes y Vídeo',
  'claude-ai-rodrigo-rojo': 'IA & Generación de Imágenes y Vídeo',
  // Lo propio: método, marca y criterios de la casa
  '100ads-analisis': 'MaKo',
  'vsl-landing': 'MaKo',
  'analisis-negocio': 'MaKo',
  'branding-mako': 'MaKo',
  'construir-app': 'MaKo',
};

/**
 * Miniatura de los cursos que NO la declaran en su propio archivo.
 *
 * Misma razón que `CATEGORIA`: estos cursos viven en `curso.ts`, que es auto-generado,
 * así que el dato se pierde si se escribe ahí. Los cursos del pipeline sí la declaran
 * solos (`curso-a-portal.mjs` la emite cuando el archivo existe).
 *
 * Las cuatro son las tapas REALES, que las pasó el dueño. Antes de eso hubo dos
 * intentos peores y conviene que quede escrito: la del catálogo de la plataforma
 * traía el logo del sitio en vez de la tapa, y para las que no existían en ningún
 * lado se generó una tipográfica con la marca de la casa — mejor que buscar en un
 * buscador una imagen que no se puede verificar, pero peor que la de verdad.
 *
 * ⚠️ La extensión importa y no es libre: sale de los BYTES del archivo, no del
 * nombre. `Bluehackers.webp` era webp de verdad, pero `AvatarHype.jpg` podría no
 * haberlo sido — un `.jpg` que en realidad es webp no lo pinta bien ningún navegador.
 *
 * Los cursos de la sección MaKo van a propósito SIN miniatura.
 */
const PORTADA: Record<string, string> = {
  bluehacker: '/cono-portadas/bluehacker.webp',
  masteryhaus: '/cono-portadas/masteryhaus.jpg',
  'anuncio-ganador': '/cono-portadas/anuncio-ganador.jpg',
  avatarhype: '/cono-portadas/avatarhype.jpg',
};

// curso.ts es AUTO-GENERADO desde transcripciones: los cursos escritos a mano
// viven en su propio archivo y se suman acá.
export const CURSOS_TODOS: Curso[] = [
  ...CURSOS, CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP,
  CURSO_CLAUDE_AI_RODRIGO_ROJO, CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE,
].map((c) => ({
  ...c,
  categoria: CATEGORIA[c.slug] ?? c.categoria,
  portada: c.portada ?? PORTADA[c.slug],
}));

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

/**
 * Los cursos que puede ver alguien SIN LOGIN cuando se comparte la tab entera.
 *
 * Es `CURSOS_TODOS` menos Branding, y la razón es que **no se puede servir**: su
 * material son bytes en un bucket privado que se piden a `/api/branding`, que
 * exige sesión de admin. Un invitado vería la galería vacía sin entender por
 * qué. Branding ya tiene su propio share (`recurso='branding'`), que además
 * comparte por sección o por pieza suelta — más fino que "todo".
 *
 * Se calcula sobre `CURSOS_TODOS`, así que un curso nuevo entra solo: la
 * exclusión se declara por slug, nunca la inclusión por lista (una lista de
 * incluidos deja afuera en silencio a todo lo que nadie se acordó de sumar).
 */
export const CURSOS_COMPARTIBLES: Curso[] = CURSOS_TODOS.filter((c) => c.slug !== VISTA_PROPIA.branding);
