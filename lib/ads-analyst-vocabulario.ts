// =============================================================================
// Los vocabularios del Ads Analyst, en un módulo PURO para que se puedan compartir
// =============================================================================
// Estas cuatro listas vivían dentro de `lib/ads-analyst.ts`, que lleva `import 'server-only'`
// porque llama a Claude. Eso las volvía IMPOSIBLES de reusar desde cualquier lugar que no sea
// el servidor: una pantalla de cliente, o la definición de un área de la API de MaKo
// (`lib/api-mako/areas/*.def.ts`), que no puede importar un VALOR de un módulo con
// `server-only` — lo exige `tests/api-mako-registro.test.ts`.
//
// Se descubrió el 31/10/2026 construyendo Competitors Spy, que tiene que clasificar el gancho
// de un anuncio ajeno con el MISMO vocabulario con que clasificamos los nuestros. La salida
// barata era copiar la lista; eso deja dos vocabularios que se separan solos. La salida correcta
// es la de siempre: una cosa, un lugar, y el lugar no puede ser un módulo de servidor.
//
// `lib/ads-analyst.ts` las vuelve a exportar, así que ningún importador de antes cambia.
//
// SIN `server-only`, a propósito, y SIN imports: son listas de texto. Todo lo que agregue una
// dependencia acá le quita a este archivo lo único que lo hace útil.
// =============================================================================

/**
 * Los ángulos SEMILLA de un guion. Es sólo la semilla: la lista viva de cada negocio se edita y
 * se lee con `getAngles()` (lib/script-angles.ts), por eso `ScriptAngle` es `string` libre.
 */
export const ANGLES = ['visionario', 'capataz', 'dolor', 'testimonio', 'oferta'] as const;
export type ScriptAngle = string;

/** Con qué abre una pieza. Cerrado: lo usa el analista para clasificar, no el negocio para editar. */
export const HOOK_TYPES = ['promesa', 'testimonio', 'pregunta', 'dolor', 'resultado', 'recordatorio'] as const;
export type HookType = (typeof HOOK_TYPES)[number];

/** Los bloques en que se parte un guion, en el orden en que se leen. */
export const BEAT_KINDS = ['gancho', 'contexto', 'problema', 'mecanismo', 'prueba', 'objecion', 'recordatorio', 'oferta', 'cta'] as const;
export type BeatKind = (typeof BEAT_KINDS)[number];

/** Las etiquetas con que se agrupa una pieza para buscarla después. */
export const TAG_VOCAB = [
  'sistema', 'sin-frio', 'caso-exito', 'dashboard', 'testimonio',
  'pregunta-hook', 'cifra-hook', 'dolor', 'cupos', 'recordatorio', 'implementacion',
] as const;
export type ScriptTag = (typeof TAG_VOCAB)[number];
