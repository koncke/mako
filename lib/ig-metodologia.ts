// =============================================================================
// ig-metodologia — la metodología de Instagram EDITABLE desde /configuraciones
// =============================================================================
// `metodologiaDe` (lib/ig-formatos.ts) es el DEFAULT: el texto destilado de los cursos,
// tal como está en el código. Acá se resuelve lo VIGENTE, que es lo que de verdad le
// llega al modelo: el override guardado en /configuraciones si alguien lo editó, y el
// default si no.
//
// Por qué un módulo aparte y no en lib/ig-formatos.ts: ese archivo lo importa la UI
// (client) para los límites técnicos y no puede llevar `server-only`; `renderPrompt` sí
// lo es (lee app_settings). Así que el default vive allá —una cosa, un lugar— y la
// resolución editable, acá.
//
// ⚠️ Lo usan DOS caminos vivos, y los dos tienen que pasar por acá:
//   · lib/ig-writer.ts (`generarPieza`) — el escritor de reels/carruseles/stories;
//   · lib/copywriter/ia.ts (`editar`) — el Copywriter, cuando el guion es de tipo
//     `reel` o `story` (ésa es HOY la pantalla que el cliente usa: /reels, /carousels
//     y /stories de escritorio redirigen ahí desde el 29/10/2026).
// Un call site que llame a `metodologiaDe` directo queda MUDO a la edición: el usuario
// edita en /configuraciones y esa pantalla sigue escribiendo con el texto viejo.
// `tests/ig-writer-prompts.test.ts` fija que no quede ninguno.
// =============================================================================

import 'server-only';
import { getPromptText } from './prompt-render';
import {
  componerMetodologia,
  METODOLOGIA_POR_FORMATO, METODOLOGIA_TRANSVERSAL,
  type FormatoIg,
} from './ig-formatos';

/**
 * Las claves del registro (lib/prompt-registry.ts) pegadas a su default: la key y el
 * texto se declaran JUNTOS para que no puedan driftear (el bug clásico del registro es
 * una key que la UI edita y nadie lee).
 */
export const PROMPTS_METODOLOGIA_IG = {
  transversal: { key: 'ig.metodologia.transversal', tpl: METODOLOGIA_TRANSVERSAL },
  reel: { key: 'ig.metodologia.reel', tpl: METODOLOGIA_POR_FORMATO.reel },
  carrusel: { key: 'ig.metodologia.carrusel', tpl: METODOLOGIA_POR_FORMATO.carrusel },
  story: { key: 'ig.metodologia.story', tpl: METODOLOGIA_POR_FORMATO.story },
} as const;

/**
 * El bloque del formato, con lo editado en /configuraciones si alguien lo editó.
 *
 * ⚠️ Los tres accesos van ESCRITOS, no `PROMPTS_METODOLOGIA_IG[formato]`: la guarda del push
 * (`scripts/prompts-registro-sincronizado.mjs`) sigue la key por una tabla sólo con el campo
 * LITERAL (`PROMPTS_X.campo.key`), y con el campo calculado no sabe a qué key resuelve —
 * «por ahí entra una huérfana sin que nada la vea», así que frena. El `switch` exhaustivo es
 * además lo que hace que un formato nuevo NO compile hasta tener su entrada en el registro.
 */
function bloqueDelFormato(formato: FormatoIg): Promise<string> {
  switch (formato) {
    case 'reel': return getPromptText(PROMPTS_METODOLOGIA_IG.reel.key, PROMPTS_METODOLOGIA_IG.reel.tpl);
    case 'carrusel': return getPromptText(PROMPTS_METODOLOGIA_IG.carrusel.key, PROMPTS_METODOLOGIA_IG.carrusel.tpl);
    case 'story': return getPromptText(PROMPTS_METODOLOGIA_IG.story.key, PROMPTS_METODOLOGIA_IG.story.tpl);
  }
}

/**
 * La metodología que le llega al modelo para `formato`: lo editado en /configuraciones
 * (bloque transversal y bloque del formato, cada uno por su lado) o el default.
 *
 * Sin nada editado devuelve EXACTAMENTE `metodologiaDe(formato)` — mismo orden, mismo
 * separador: el cambio no mueve una coma de lo que ya salía.
 */
export async function metodologiaIgVigente(formato: FormatoIg): Promise<string> {
  const [propia, transversal] = await Promise.all([
    bloqueDelFormato(formato),
    getPromptText(PROMPTS_METODOLOGIA_IG.transversal.key, PROMPTS_METODOLOGIA_IG.transversal.tpl),
  ]);
  return componerMetodologia(propia, transversal);
}
