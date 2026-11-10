// =============================================================================
// La lámina fiel con su texto editable: los pasos de la IA de imagen y la capa de lettering (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «hay muchos carruseles que también tienen imágenes… replicarlo con la generación de imágenes que ya tenemos
// conectada», «copiarle el carrusel de una competencia, pero sacar el avatar de la competencia y reemplazarlo por el mismo» y,
// sobre la tipografía, que las letras sean fieles Y editables. Lo recomendado (docs/relevo/nube-carruseles-guiado.md §3 y §4):
//
//   1. LA PLANCHA: la lámina original con UN cambio, sin el texto (la IA de imagen conectada: Flow). Encima van las capas de texto
//      editables con la tipografía medida (./tipografia-medida.ts), así que en la plancha no puede quedar ni una letra: si queda,
//      cada palabra se ve dos veces (lo advierte ./clon-fiel.ts).
//   2. LA PERSONA, si el negocio eligió una foto: desde la PLANCHA (base) y con UNA referencia (su cara), UN cambio. Nunca las dos
//      cosas en un pedido («ONE change only», medido el 7/11) ni una tercera edición encima: dos seguidas es el techo de la casa
//      (AGENTS.md, «No se genera encima de una generación»).
//   3. EL LETTERING (3D, nubes, lo que ninguna fuente imita): una capa de IMAGEN que guarda su texto. Al cambiar la palabra se
//      regenera SÓLO esa caja, con el recorte de la capa como base y una frase.
//
// El prompt es el de ./clon-reglas.ts (lo que se conserva PRIMERO, en inglés, como se midió), con la lista de lo que se conserva
// SIN lo que el paso cambia. ⚠️ SIN MEDIR: «sacar el texto» y «poner a esta persona» no se probaron con la IA real; el caso de
// prueba es el de @growithalex (instagram.com/p/DYfVqEmk_to), que Martín está haciendo a mano. Cuando su paso a paso esté en
// docs/plantillas-carrusel/, las frases que funcionaron reemplazan a las de acá.
//
// Puro: la orquestación con Flow (subir la lámina, pedir, esperar, guardar) es la parte 7 del relevo, sin hacer.
// =============================================================================

import { CONSERVA_TODO, TOPE_PROMPT_CON_REFERENCIA, porQueNoSirveElClon, promptDeClon } from './clon-reglas';
import type { AvatarRespuesta } from './guiado';
import type { Caja } from './tipografia-medida';

/** Cuántas ediciones seguidas se le piden a la IA de imagen sobre una lámina (AGENTS.md: «dos o tres es el techo»; acá, dos). */
export const TECHO_DE_EDICIONES = 2;

export type IdPaso = 'sin-texto' | 'persona' | 'sin-persona';

export type PasoDeLamina = {
  id: IdPaso;
  /** Lo único que cambia, en una frase humana (va al final del prompt). */
  pedido: string;
  /** El prompt entero que va a la IA de imagen. */
  prompt: string;
  /** La base: la lámina ORIGINAL (el primer paso) o la plancha que dejó el paso anterior. */
  base: 'original' | 'anterior';
  /** La referencia adjunta: la foto que eligió el negocio (su cara de marca o su último look), o ninguna. UNA sola
   *  (clon-reglas.ts → REFERENCIAS_RECOMENDADAS). */
  referencia: 'foto' | null;
};

/** Lo que se lee de una lámina (la IA del negocio la mira antes): si tiene texto y si tiene una persona. */
export type LoQueTieneLaLamina = { texto: boolean; persona: boolean };

const PEDIDO: Record<IdPaso, string> = {
  'sin-texto': 'Remove all the text and lettering. Where the text was, continue the background as it is.',
  persona: 'Put the person from the attached photo in place of the person in this image, with the same pose, size and light.',
  'sin-persona': 'Take the person out and continue the background where they were.',
};

/** Lo que se conserva en cada paso: todo MENOS lo que ese paso cambia. */
const CONSERVA: Record<IdPaso, readonly string[]> = {
  'sin-texto': CONSERVA_TODO.filter((x) => x !== 'the typography' && x !== 'the text'),
  persona: CONSERVA_TODO.filter((x) => x !== 'the people'),
  'sin-persona': CONSERVA_TODO.filter((x) => x !== 'the people'),
};

/** El prompt de un paso. Público para los tests y para mostrarlo en el contexto de la generación (AGENTS.md: cada pieza lleva su contexto). */
export const promptDePaso = (id: IdPaso): string => promptDeClon('carrusel', PEDIDO[id], CONSERVA[id]);

/**
 * Los pasos de una lámina, en orden. Una lámina sin texto y sin persona no pide nada: va tal cual (no se le pide a la IA lo que no
 * cambia: cada pasada redibuja la imagen entera y pierde detalle).
 *   · con texto → `sin-texto` desde el original;
 *   · con persona y una foto elegida → `persona`, desde lo anterior, con la cara adjunta;
 *   · con persona y «Sin persona» → `sin-persona`;
 *   · con persona y sin decidir (`null`) → nada sobre la persona: no se toca sin que el negocio lo elija (la pantalla no deja
 *     generar sin contestar, y la API dice que falta).
 */
export function pasosDeLamina(l: LoQueTieneLaLamina, avatar: AvatarRespuesta | null): PasoDeLamina[] {
  const ids: IdPaso[] = [];
  if (l.texto) ids.push('sin-texto');
  if (l.persona && (avatar === 'cara' || avatar === 'look')) ids.push('persona');
  else if (l.persona && avatar === 'ninguno') ids.push('sin-persona');
  return ids.slice(0, TECHO_DE_EDICIONES).map((id, i) => ({
    id, pedido: PEDIDO[id], prompt: promptDePaso(id), base: i === 0 ? 'original' : 'anterior', referencia: id === 'persona' ? 'foto' : null,
  }));
}

// ── El lettering: una capa de imagen que guarda su texto ──────────────────────────────────────────────────────────────

/** Lo que guarda una capa de lettering (viaja en el objeto del editor, en `lettering`: app/image-editor/_doory/.../serialization.ts). */
export type Lettering = {
  /** Lo que dice. Es lo que se edita. */
  texto: string;
  /** Cómo se ve, en pocas palabras de la lectura («letras de nubes blancas», «3D dorado»): va en el nombre de la capa. */
  estilo: string;
};

/** Lo más largo que puede decir un lettering (es un titular: con más, el pedido pasa el tope del prompt con referencia). */
export const TOPE_TEXTO_LETTERING = 60;

/** El pedido para regenerar la caja con otra palabra: la base es el recorte de la capa, y no se describe el estilo (lo muestra). */
export function pedidoDeLettering(texto: string): string {
  const t = Array.from(texto.replace(/\s+/g, ' ').trim().replace(/"/g, '”')).slice(0, TOPE_TEXTO_LETTERING).join('');
  return `Same lettering, same style, colours and size. It now says "${t}".`;
}

/** El prompt entero para regenerar una capa de lettering: lo que se conserva primero, sin «the text» (es lo que cambia). */
export const promptDeLettering = (texto: string): string =>
  promptDeClon('carrusel', pedidoDeLettering(texto), CONSERVA_TODO.filter((x) => x !== 'the text'));

/** Por qué no se puede regenerar con ese texto, o `null`: vacío, o tan largo que el pedido pasa el tope con referencia. */
export function porQueNoSirveElLettering(texto: string): string | null {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (!t) return 'Escribe qué tiene que decir.';
  if (Array.from(t).length > TOPE_TEXTO_LETTERING) return `Un lettering dice como mucho ${TOPE_TEXTO_LETTERING} letras: para más, usa una capa de texto.`;
  return porQueNoSirveElClon(pedidoDeLettering(t), 1);
}

/**
 * El objeto del editor para una capa de lettering: una imagen en su caja, con su texto guardado en `lettering` (round-trip: está
 * en EXTRA_PROPS del motor) y el nombre que se lee en la lista de capas. `src` es la imagen del recorte (la del original
 * regenerada con la palabra del negocio, o el recorte mismo mientras tanto).
 */
export function objetoDeLettering(id: string, l: Lettering, caja: Caja, src: { url: string; ancho: number; alto: number; assetId?: string }): Record<string, unknown> {
  const escala = Math.min(caja.ancho / src.ancho, caja.alto / src.alto);
  return {
    type: 'image', id, name: `Lettering: ${Array.from(l.texto).slice(0, 40).join('')}`, src: src.url, ...(src.assetId ? { assetId: src.assetId } : {}),
    crossOrigin: 'anonymous', originX: 'left', originY: 'top',
    left: Math.round(caja.x + (caja.ancho - src.ancho * escala) / 2), top: Math.round(caja.y + (caja.alto - src.alto * escala) / 2),
    width: src.ancho, height: src.alto, scaleX: escala, scaleY: escala, angle: 0, opacity: 1, visible: true,
    lettering: { texto: l.texto, estilo: l.estilo.slice(0, 80) },
  };
}

/** El lettering de un objeto del editor, si lo es (lo que se lee al tocar «Cambiar la palabra»). */
export function letteringDe(o: Record<string, unknown>): Lettering | null {
  const l = o.lettering;
  if (o.type !== 'image' || !l || typeof l !== 'object') return null;
  const x = l as Record<string, unknown>;
  return typeof x.texto === 'string' && x.texto.trim() ? { texto: x.texto, estilo: typeof x.estilo === 'string' ? x.estilo : '' } : null;
}

/** Sólo para los tests: el tope que vigila `porQueNoSirveElLettering`. */
export const TOPE_PEDIDO_LETTERING = TOPE_PROMPT_CON_REFERENCIA;
