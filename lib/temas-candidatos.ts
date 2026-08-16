// =============================================================================
// Los temas candidatos del rebrand — el catálogo, NO los valores
// =============================================================================
// Acá viven el id, el nombre y el porqué de cada candidato. **Los hexes no**:
// esos están una sola vez, en `app/globals.css`, adentro de
// `[data-tema-candidato="…"]`.
//
// POR QUÉ SEPARADO ASÍ, y no un objeto con los colores adentro: el tema tiene
// que aplicarse ANTES del primer pintado (si no, la app parpadea del tema viejo
// al nuevo en cada navegación), y eso solo lo puede hacer una regla CSS + un
// atributo en <html>. Si además los hexes vivieran en un módulo TS, habría dos
// fuentes para el mismo dato y la segunda se quedaría vieja — que es la regla
// «Una cosa, un lugar» de AGENTS.md.
//
// La tab /admin/ui?tab=temas los LEE de la hoja de estilo con getComputedStyle,
// así que lo que muestra es lo que de verdad está aplicado. Un token que se
// agregue al CSS y no acá simplemente no se lista; uno que se liste y no exista
// en el CSS se muestra vacío. Las dos fallas son visibles, que es el punto.
//
// Sin `server-only` a propósito: lo importan un client component y la tab.
// =============================================================================

export type TemaCandidato = {
  id: string;
  nombre: string;
  /** De dónde sale y qué mezcla. Una frase. */
  idea: string;
  /** Lo que le falla. Sale del jurado, y se escribe aunque duela. */
  falla: string;
  /** Puntaje del jurado de diseño, para no reordenarlos por gusto del día. */
  puntaje: number;
};

/**
 * Los tres mixes de Nord + el azul de Meta.
 *
 * El orden es el del jurado (dos lentes: carácter y uso diario), no el de
 * preferencia de quien escribe.
 */
export const TEMAS: TemaCandidato[] = [
  {
    id: 'true-north',
    nombre: 'True North',
    idea:
      'Los 7 grises de Nord entran hex por hex y solo se toca lo que Nord nunca resolvió: los acentos en modo claro. ' +
      'El azul de Meta ocupa la silla que deja libre nord10, que queda RETIRADO — dos azules compitiendo es la regla que el rebrand vino a arreglar.',
    falla:
      'El azul solo se lee como «el de Meta» en modo claro. En oscuro es #8AB4FA, un celeste: la identidad Meta existe en un modo y no en el otro.',
    puntaje: 7.2,
  },
  {
    id: 'nord-hardline',
    nombre: 'Nord Hardline',
    idea:
      'Nord entero con los mismos tonos reconocibles, pero cada color empujado por la escalera de luminancia hasta que el número cierra en los dos modos. ' +
      'Es el que mejor aguanta una tabla de 40 filas.',
    falla:
      'Frost desaparece entero: los cuatro azules árticos quedan reemplazados por un solo azul saturado, y con eso se va buena parte de lo que hacía reconocible a Nord.',
    puntaje: 7.0,
  },
  {
    id: 'ember-north',
    nombre: 'Ember North',
    idea:
      'Da vuelta la temperatura de los neutros —papel cálido en claro, tinta cálida en oscuro— para que el azul de Meta sea lo único frío del sistema y por eso corte.',
    falla:
      'Al sacarle el sesgo azul a los 7 neutros deja de ser Nord. El juez de fidelidad le puso 3 sobre 10, y eligiste Nord justamente por Nord.',
    puntaje: 6.0,
  },
];

/** Los tokens que la tab muestra, en el orden en que se leen. */
export const TOKENS_MOSTRADOS: { grupo: string; tokens: string[] }[] = [
  { grupo: 'Superficies', tokens: ['--bg', '--surface', '--surface-2', '--border', '--border-strong'] },
  { grupo: 'Tinta', tokens: ['--ink', '--dim', '--faint'] },
  { grupo: 'Barra', tokens: ['--sidebar', '--sidebar-2', '--sidebar-line', '--sidebar-text', '--on-sidebar'] },
  { grupo: 'Vos actuás (Meta)', tokens: ['--primary', '--primary-strong', '--primary-bg', '--primary-weak'] },
  { grupo: 'MaKo intervino', tokens: ['--mako', '--mako-lite', '--mako-ink', '--mako-bg', '--mako-border'] },
  { grupo: 'Semáforo', tokens: ['--good', '--warn', '--bad'] },
];

/** La clave del navegador donde vive la elección. Una sola, y exportada: */
export const LS_TEMA = 'mako.tema-candidato';
export const LS_MODO = 'mako.tema-modo';

/** El atributo que prende el tema en <html>. */
export const ATTR_TEMA = 'data-tema-candidato';

export const esTemaValido = (v: string | null | undefined): v is string =>
  !!v && TEMAS.some((t) => t.id === v);
