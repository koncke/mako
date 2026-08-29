// =============================================================================
// El tema del rebrand y el modo claro/oscuro
// =============================================================================
// Son DOS cosas distintas y conviene no confundirlas:
//
//   · EL MODO (claro / oscuro) es del PRODUCTO. Lo elige cualquier usuario desde
//     su perfil en la barra, se guarda en su navegador y ya funciona hoy: los
//     tokens de `[data-tema="oscuro"]` viven en globals.css desde antes.
//   · EL TEMA CANDIDATO es de OBRA. Es el rebrand en evaluación, se prende solo
//     dentro del Cliente de Diseño y por eso no le cambia el color a nadie.
//
// Los hexes no están acá: viven una sola vez en `app/globals.css`, adentro de
// `[data-tema-candidato="…"]`. El tema tiene que estar aplicado ANTES del primer
// pintado o la app parpadea en cada navegación, y eso solo lo puede hacer una
// regla CSS + un atributo en <html>. Duplicarlos en un módulo TS sería un
// segundo lugar que se queda viejo — la regla «Una cosa, un lugar».
//
// Sin `server-only` a propósito: lo importan client components.
// =============================================================================

export type TemaCandidato = {
  id: string;
  nombre: string;
  idea: string;
  falla: string;
};

/**
 * El candidato. Es UNO: Nord (que resolvió los dos modos) con el azul de
 * «Modern Minimal», que es el de Meta bajado hasta pasar contraste.
 *
 * Hubo tres. Los otros dos —Nord Hardline y Ember North— se descartaron: tener
 * tres paletas es no haber elegido, y las dos que sobraban perdían justo lo que
 * hacía valer a Nord (una borraba Frost, la otra el sesgo azul de los neutros).
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
  },
];

/** Los tokens que la tab muestra, en el orden en que se leen. */
export const TOKENS_MOSTRADOS: { grupo: string; tokens: string[] }[] = [
  { grupo: 'Superficies', tokens: ['--bg', '--surface', '--surface-2', '--border', '--border-strong'] },
  { grupo: 'Tinta', tokens: ['--ink', '--on-ink', '--dim', '--faint'] },
  { grupo: 'Barra', tokens: ['--sidebar', '--sidebar-2', '--sidebar-line', '--sidebar-text', '--on-sidebar'] },
  { grupo: 'Tú actúas (Meta)', tokens: ['--primary', '--primary-strong', '--primary-bg', '--primary-weak'] },
  { grupo: 'MaKo intervino', tokens: ['--mako', '--mako-lite', '--mako-ink', '--mako-bg', '--mako-border'] },
  { grupo: 'Semáforo', tokens: ['--good', '--warn', '--bad'] },
];

/** Dónde vive cada elección en el navegador. */
export const LS_TEMA = 'mako.tema-candidato';
export const LS_MODO = 'mako.modo';

/** Los atributos que las prenden en <html>. */
export const ATTR_TEMA = 'data-tema-candidato';
export const ATTR_MODO = 'data-tema';

export const esTemaValido = (v: string | null | undefined): v is string =>
  !!v && TEMAS.some((t) => t.id === v);
