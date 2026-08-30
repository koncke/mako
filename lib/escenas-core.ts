// =============================================================================
// escenas-core — el reparto de escenarios y la red que atrapa las caras
// =============================================================================
// SIN `server-only`, y por el mismo motivo que `guion-estructurar-core`: acá
// está lo único que puede fallar en silencio —cuántas imágenes salen, qué tomas
// cubre cada una y si el prompt se puso a describir una cara— y eso hay que
// poder probarlo sin levantar un server ni gastar una llamada.
//
// El módulo de al lado (`escenas.ts`) es el que le habla al modelo.

/** Un escenario: una imagen, y las tomas del plan que se filman ahí. */
export type Escena = {
  /** 1-indexado, como las tomas. Es el número que el usuario nombra. */
  n: number;
  /** Primera toma que se filma en este escenario (1-indexado, inclusive). */
  desde: number;
  /** Última toma (1-indexado, inclusive). */
  hasta: number;
  /** Dónde es, en español y en una línea. Es lo que lee la persona. */
  lugar: string;
  /** El prompt para Flow: composición, luz, encuadre. En inglés. Nunca la cara. */
  prompt: string;
};

/**
 * Reparte N tomas en E escenarios, en bloques contiguos.
 *
 * Es ARITMÉTICA y por eso no la hace el modelo. La única parte de esto que es
 * juicio son los puntos de corte —«el cambio de escenario llega temprano»— y esa
 * sí se le pregunta; pero cuando la respuesta no valida, esto contesta igual. Un
 * paso de imágenes que se cae porque un modelo devolvió mal una lista de números
 * deja al usuario sin anuncio por una razón que no es suya.
 *
 * Los bloques de más se reparten adelante: con 9 tomas en 4 escenarios sale
 * 3-2-2-2 y no 2-2-2-3, porque el arranque es donde más pasa.
 */
export function repartirEscenas(tomas: number, escenarios: number): { desde: number; hasta: number }[] {
  const e = Math.max(1, Math.min(escenarios, Math.max(1, tomas)));
  const base = Math.floor(tomas / e);
  const sobran = tomas % e;
  const out: { desde: number; hasta: number }[] = [];
  let desde = 1;
  for (let i = 0; i < e; i++) {
    const largo = base + (i < sobran ? 1 : 0);
    out.push({ desde, hasta: desde + largo - 1 });
    desde += largo;
  }
  return out;
}

/**
 * Aplica los cortes que propuso el modelo, si son válidos.
 *
 * `cortes` son las tomas en las que EMPIEZA cada escenario. El primero es
 * siempre 1. Devuelve `null` cuando no sirven, y quien llama cae al reparto
 * parejo — nunca a un reparto a medias.
 */
export function escenasDeCortes(tomas: number, cortes: number[]): { desde: number; hasta: number }[] | null {
  if (!Array.isArray(cortes) || cortes.length === 0) return null;
  if (cortes[0] !== 1) return null;
  for (let i = 0; i < cortes.length; i++) {
    const c = cortes[i];
    if (!Number.isInteger(c) || c < 1 || c > tomas) return null;
    // Estrictamente crecientes: dos escenarios que arrancan en la misma toma son
    // un escenario, y uno de los dos se quedaría sin ninguna.
    if (i > 0 && c <= cortes[i - 1]) return null;
  }
  return cortes.map((c, i) => ({ desde: c, hasta: (cortes[i + 1] ?? tomas + 1) - 1 }));
}

// ── La red: un prompt de escena no describe una cara ────────────────────────
//
// El catálogo lo dice como regla del formato —«No se describe la cara. La
// identidad la resuelve la foto real, siempre la misma»— y una regla que solo
// vive en la prosa de un prompt se cumple casi siempre, que es otra cosa.
//
// Y acá «casi siempre» es caro de un modo particular: el fallo NO se ve al leer
// el prompt, se ve tres pasos después, cuando el clip sale con la cara de otro.
// Para entonces ya se pagaron los créditos del video.
//
// Las palabras van en inglés porque el prompt de escena va en inglés (español
// para el guion, inglés para la escena), más las castellanas que se cuelan.
//
// ⚠️ SE COMPARA POR PALABRA COMPLETA, NUNCA POR SUBSTRING. La primera versión
// hacía `t.includes(p)` y el resultado fue que el guard rechazaba casi todo:
//
//     'age'  ⊂ imAGE, vintAGE, stAGE, gorAGE, storAGE, footAGE, villAGE
//     'hair' ⊂ cHAIR, armcHAIR
//     'face' ⊂ surFACE, interFACE
//     'lips' ⊂ cLIPS · 'nose' ⊂ diagNOSE · 'cara' ⊂ CARAfe
//
// Y son justo las palabras que el propio prompt PIDE usar: «el lugar, la luz, el
// encuadre, la ropa, los objetos que hay alrededor». Medido sobre diez prompts
// escritos siguiendo esas instrucciones: NUEVE rechazados. El paso entero era
// inusable y el mensaje que salía culpaba a las API keys del cliente.
//
// Es la MISMA lección que AGENTS.md ya tiene escrita para el detector de voseo
// —los límites de palabra van por Unicode, no por `includes` ni por el `\b` de
// JavaScript, que es ASCII— aplicada a otro detector escrito seis semanas
// después. Una regla documentada en un lugar no protege al de al lado.
const PALABRAS_DE_CARA = [
  'face', 'facial', 'eyes', 'nose', 'mouth', 'lips', 'smile', 'smiling',
  'beard', 'moustache', 'mustache', 'hair', 'haircut', 'skin tone', 'complexion',
  'cheek', 'jaw', 'eyebrow', 'eyebrows', 'freckle', 'freckles', 'wrinkle', 'wrinkles',
  'years old', 'middle-aged', 'handsome', 'attractive', 'good-looking',
  'man with', 'woman with',
  'cara', 'rostro', 'ojos', 'barba', 'cabello', 'pelo', 'sonrisa', 'sonriendo',
];

/**
 * Términos de CÁMARA que contienen una palabra de la lista y son legítimos.
 *
 * «eye level» y «eye line» son encuadre, no anatomía, y son exactamente lo que
 * un prompt de composición tiene que poder decir. Se sacan del texto ANTES de
 * medir, en vez de sacarlos de la lista: quitar `eyes` de la lista abriría la
 * puerta a describir los ojos, que es lo que el guard existe para impedir.
 */
const TERMINOS_DE_CAMARA = /\b(eye[- ]?(level|line)|bird'?s[- ]eye|fish[- ]?eye)\b/gi;

/** Escapa lo que va adentro de la expresión. Hoy no hay metacaracteres, mañana sí. */
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * ⚠️ Los límites van por UNICODE, no con `\b`.
 *
 * El `\b` de JavaScript es ASCII incluso con el flag `u`, así que en «sonrisá»
 * o en cualquier palabra terminada en vocal acentuada no hay borde y la
 * coincidencia se pierde SIN dar error. El repo ya pagó esto una vez con los
 * imperativos del voseo (`tocá`, `andá`, `mirá`), que son justo la forma de todo
 * CTA.
 */
const CARAS = new RegExp(
  `(?<!\\p{L})(${PALABRAS_DE_CARA.map(escapar).join('|')})(?!\\p{L})`,
  'giu',
);

/**
 * Las menciones a la cara que trae un prompt. Vacío = limpio.
 *
 * Marca, no corrige: reemplazar palabras adentro de un prompt de imagen produce
 * frases rotas que el modelo interpreta peor que la original. Quien llama
 * decide, y hoy decide descartar y volver a pedir.
 */
export function mencionaCara(prompt: string): string[] {
  const limpio = (prompt || '').toLowerCase().replace(TERMINOS_DE_CAMARA, ' ');
  return [...new Set([...limpio.matchAll(CARAS)].map((m) => m[1]))];
}

/**
 * Valida la respuesta del modelo ANTES de generar una sola imagen.
 *
 * Cada chequeo tapa una forma real en la que esto se rompe: devolver otra
 * cantidad de escenarios que la que pide el formato, dejar un prompt vacío,
 * escribir el prompt en español —el modelo de imagen entiende inglés y el
 * catálogo lo dice— o ponerse a describir la cara.
 */
export function validarEscenas(
  crudo: string,
  escenarios: number,
  tomas: number,
  /** Se llena con el motivo del rechazo, cuando se sabe. Ver el ⚠️ de abajo. */
  motivos: string[] = [],
): { cortes: number[]; lugares: string[]; prompts: string[] } | null {
  let obj: unknown;
  try { obj = JSON.parse(crudo); } catch { return null; }
  const arr = (obj as { escenas?: unknown })?.escenas;
  if (!Array.isArray(arr)) return null;

  // EXACTAMENTE las que pide el formato. No «al menos»: la cantidad es un dato
  // del catálogo (`Puesta.escenarios`), no una sugerencia — y una imagen de más
  // es un escenario que el guion no tiene.
  if (arr.length !== escenarios) return null;

  const cortes: number[] = [];
  const lugares: string[] = [];
  const prompts: string[] = [];
  for (const it of arr) {
    const o = (it ?? {}) as Record<string, unknown>;
    const desde = Number(o.desdeToma ?? 0);
    const lugar = String(o.lugar ?? '').trim();
    const prompt = String(o.prompt ?? '').trim();
    if (!lugar || prompt.length < 30) return null;
    // ⚠️ El motivo se GUARDA, no se pierde. Sin esto, «el modelo contestó bien y
    // mi filtro lo tiró» y «el cliente no tiene API keys» salían por la misma
    // frase —«revisa tus API keys en /integraciones»— y mandaban a arreglar algo
    // que estaba perfecto. Es la regla de que un error dice DE QUIÉN fue la culpa.
    const caras = mencionaCara(prompt);
    if (caras.length > 0) { motivos.push(`describe a la persona: ${caras.join(', ')}`); return null; }
    if (!Number.isInteger(desde) || desde < 1 || desde > tomas) return null;
    cortes.push(desde);
    lugares.push(lugar);
    prompts.push(prompt);
  }
  return { cortes, lugares, prompts };
}

/** Arma las escenas finales: los cortes del modelo si valen, si no el reparto parejo. */
export function armarEscenas(
  tomas: number,
  escenarios: number,
  v: { cortes: number[]; lugares: string[]; prompts: string[] },
): Escena[] {
  const rangos = escenasDeCortes(tomas, v.cortes) ?? repartirEscenas(tomas, escenarios);
  return rangos.map((r, i) => ({
    n: i + 1,
    desde: r.desde,
    hasta: r.hasta,
    lugar: v.lugares[i] ?? `Escenario ${i + 1}`,
    prompt: v.prompts[i] ?? '',
  }));
}
