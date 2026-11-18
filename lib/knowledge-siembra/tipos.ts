// =============================================================================
// knowledge-siembra/tipos — la forma de una ficha de Knowledge destilada de los cursos (18/11/2026)
// =============================================================================
// Martín (21/07/2026): el conocimiento de los cursos va a MaKo «no directamente, exacto como está la info cargada: debemos
// pasar por un proceso de razonamiento», clasificado por tema y curado AFUERA de la app (consume créditos de IA). Esto es esa
// curación, versionada: cada módulo de lib/knowledge-modulos.ts tiene su archivo con sus fichas, escritas con palabras propias.
//
// La siembra (scripts/sembrar-knowledge.mts) las carga en `mako_knowledge` del workspace de la PLATAFORMA con
// `fuente: 'mako'`, que es lo único que se presta a los demás negocios (lib/rag-prestamo.ts). Lo que entra al prompt es
// `titulo` + `cuerpo` (formatKnowledge, lib/mako-knowledge.ts); `de` es sólo para auditar de dónde salió y NO se carga.
//
// PURO y sin `server-only`: lo leen la siembra y su test.
// =============================================================================

/** Una ficha de método. Una idea aplicable por ficha, no un resumen de un curso. */
export type FichaKnowledge = {
  /** El `key` del módulo de lib/knowledge-modulos.ts (de ahí sale su `area`). */
  modulo: string;
  /** Corto y en palabras de producto: lo que se aprende. Es la clave de la siembra (no se repite en un módulo). */
  titulo: string;
  /** El subtema, para agrupar en Classroom › Methodology. */
  categoria: string;
  /**
   * El método, con palabras propias: qué es, cuándo se usa y la regla práctica. Sin nombres de personas (ni autores ni
   * clientes), sin tácticas que MaKo no aconseja (escasez inventada, reseñas falsas, promesas de ingresos) y de tú.
   */
  cuerpo: string;
  /** De qué cursos o documentos del repo salió (slugs de app/conocimientos o rutas de docs/). No viaja a la base. */
  de: readonly string[];
};

/** Con qué `curso` se agrupan en la base las fichas de un módulo (lo que apaga o prende todo junto `setCursoActivo`). */
export const cursoDeModulo = (nombreDelModulo: string): string => `Knowledge · ${nombreDelModulo}`;

/** El `autor` de toda ficha destilada: el método es de MaKo, no de un referente (no se atribuye a quien no se eligió). */
export const AUTOR_KNOWLEDGE = 'MaKo';

/** Tope de un cuerpo: una ficha que no entra en esto son dos fichas. */
export const TOPE_CUERPO = 1_600;

/**
 * Tope de lo que suma un módulo. `metodoDeTab` (lib/knowledge.ts) le da a cada área 12.000 / nº de áreas de la tab (mínimo
 * 1.500) y `metodologiaDeArea` manda TODO si entra; si no, sólo las 3 primeras + el top-k semántico. Con este tope el módulo
 * entero entra en la tab que más áreas junta hoy (dos), y el área `mensajes`, que ya tiene el método de copywriting cargado,
 * cae a top-k: por eso el ORDEN de cada archivo importa (las tres primeras son las bases).
 */
export const TOPE_MODULO = 11_000;
