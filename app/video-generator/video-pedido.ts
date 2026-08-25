// =============================================================================
// video-pedido — catálogos del pedido y el plan como texto (módulo PURO)
// =============================================================================
// SIN 'server-only' a propósito: lo importan la UI (los Select, «Copiar el
// guion») y las server actions. Solo tipos y funciones puras — el tipo del plan
// entra con `import type`, que se borra en compilación y no arrastra el
// server-only de lib/video-planner.ts al bundle del cliente.
//
// El catálogo de puestas viene de lib/puestas-data.ts, que ya es data pura y se
// puede importar de los dos lados. Acá van solo las opciones que son del PEDIDO
// (cuánto dura, cuántos clips) y no de la puesta.

import type { PlanVideo } from '@/lib/video-planner';
import { CATALOGO_PUESTAS, puestaPorId, type Puesta } from '@/lib/puestas-data';

export { CATALOGO_PUESTAS, puestaPorId };
export type { Puesta };

// ── Catálogo del pedido (opciones cerradas, nunca un campo libre de más) ─────

export const DURACIONES_VIDEO = [
  { value: '30', label: '30 segundos', hint: 'Una sola idea, sin desarrollo' },
  { value: '60', label: '60 segundos', hint: 'El estándar de un anuncio con historia' },
  { value: '90', label: '90 segundos', hint: 'Solo si cada segundo aporta' },
] as const;

export type DuracionVideo = (typeof DURACIONES_VIDEO)[number]['value'];

/**
 * El acento del guion. Es un CAMPO, no un default, porque no se puede adivinar y
 * equivocarlo cuesta caro: el corpus tiene seis versiones de guion escritas con
 * el acento equivocado —se pedía Ciudad de México y el cliente es norteño— y no
 * se nota al leer, se nota cuando alguien lo dice en voz alta.
 *
 * El texto de cada opción viaja LITERAL al prompt de video, así que dice la
 * variedad como la entiende el modelo, no como la diría un formulario.
 */
export const ACENTOS = [
  { value: 'mx-neutro', label: 'México — neutro', prompt: 'Mexican Spanish, neutral accent' },
  { value: 'mx-norte', label: 'México — norteño', prompt: 'Mexican Spanish with a northern (norteño) accent' },
  { value: 'mx-cdmx', label: 'México — Ciudad de México', prompt: 'Mexican Spanish with a Mexico City accent' },
  { value: 'es-neutro', label: 'Español neutro (Latinoamérica)', prompt: 'Neutral Latin American Spanish' },
  { value: 'co', label: 'Colombia', prompt: 'Colombian Spanish' },
  { value: 'ar', label: 'Argentina — rioplatense', prompt: 'Argentine (Rioplatense) Spanish' },
  { value: 'es', label: 'España', prompt: 'Spanish from Spain (Castilian)' },
] as const;

export type AcentoVideo = (typeof ACENTOS)[number]['value'];

/** El texto que viaja al prompt. Default México neutro: la audiencia es de México. */
export function acentoPrompt(value: string): string {
  return (ACENTOS.find((a) => a.value === value) ?? ACENTOS[0]).prompt;
}

/** Las variedades donde el voseo SÍ es correcto y no hay que marcarlo. */
export function acentoEsVoseante(value: string): boolean {
  return value === 'ar';
}

export type PedidoVideo = {
  puestaId: string;
  anguloId?: string;
  tema: string;
  duracion: string;
  acento: string;
  /** Feedback sobre el plan anterior (regenerar). */
  feedback?: string;
};

/**
 * Cuántos clips salen de una duración con esta puesta.
 *
 * Se calcula acá (y no en el motor) porque la UI tiene que mostrarlo ANTES de
 * generar: es el número que le dice al usuario cuánto va a costar. Prefiere
 * clips largos —menos saltos es menos deriva de identidad y menos créditos— y
 * queda siempre dentro del rango de la puesta.
 */
export function clipsParaDuracion(puesta: Puesta, totalSeg: number): number {
  const [minClips, maxClips] = puesta.clips;
  const [, maxSeg] = puesta.segundosClip;
  const ideal = Math.ceil(totalSeg / maxSeg);
  return Math.min(maxClips, Math.max(minClips, ideal));
}

/** Los segundos que pidió el usuario, saneados contra el catálogo. */
export function segundosDe(duracion: string): number {
  const d = DURACIONES_VIDEO.find((o) => o.value === duracion) ?? DURACIONES_VIDEO[1];
  return Number(d.value);
}

/**
 * Lo que REALMENTE va a durar el anuncio con esta puesta.
 *
 * No siempre coincide con lo pedido, y esconderlo sería mentir: Plano secuencia
 * tiene un piso de 7 clips de 8 s = 56 s, así que pedirle 30 segundos devuelve
 * 56 igual. La UI muestra este número, no el del selector, y avisa cuando la
 * diferencia pasa de 5 segundos.
 *
 * Es la misma aritmética que `repartirDuracion` del motor, en su forma mínima:
 * acá solo hace falta el total, no el reparto clip a clip.
 */
export function duracionReal(puesta: Puesta, totalSeg: number): { clips: number; segundos: number } {
  const clips = clipsParaDuracion(puesta, totalSeg);
  const [minSeg, maxSeg] = puesta.segundosClip;
  const base = Math.min(maxSeg, Math.max(minSeg, Math.floor(totalSeg / clips)));
  const sobra = Math.max(0, totalSeg - base * clips);
  // El reparto solo puede subir clips que no llegaron al techo, de a un segundo.
  const margen = Math.min(sobra, clips * (maxSeg - base));
  return { clips, segundos: base * clips + margen };
}

/**
 * Compone el texto del pedido que consume generarPlan(). Los topes por campo
 * existen porque el motor corta el tema en 4.000 caracteres: mejor recortar acá
 * cada parte que perder el final del feedback sin aviso.
 */
export function componerTema(input: PedidoVideo, anterior?: PlanVideo): string {
  const partes = [`TEMA / HISTORIA DEL ANUNCIO: ${input.tema.trim().slice(0, 3000)}`];
  const feedback = input.feedback?.trim();
  if (anterior && feedback) {
    partes.push([
      'YA HAY UN PLAN ANTERIOR DE ESTE ANUNCIO:',
      `- Título: «${anterior.titulo}»`,
      `- Ritmo: ${anterior.ritmo}`,
      `- De corrido: ${anterior.deCorrido.slice(0, 600)}`,
    ].join('\n'));
  }
  return partes.join('\n\n');
}

// ── El plan como texto plano ─────────────────────────────────────────────────
// Para LEER PRODUCIENDO: un bloque por clip, el prompt aparte y listo para
// copiar. Es el molde de los cuatro anuncios que se produjeron a mano — el que
// ya se sabe que funciona sentado frente al generador de video.

export function planATexto(plan: PlanVideo, nombrePuesta: string): string {
  const lineas: string[] = [
    `GUION · ${plan.titulo}`,
    '',
    `Puesta en escena: ${nombrePuesta}`,
    `${plan.clips.length} clips · ${plan.duracionTotalSeg} s`,
    `Ritmo: ${plan.ritmo}  (H = habla en cámara · O = voz en off)`,
    '',
    'La identidad sale SIEMPRE de la misma foto real. No describas la cara.',
    '',
  ];

  if (plan.imagenesNecesarias.length > 0) {
    lineas.push('IMÁGENES A GENERAR ANTES DE ANIMAR');
    plan.imagenesNecesarias.forEach((img, i) => lineas.push(`${i + 1}. ${img}`));
    lineas.push('');
  }

  plan.clips.forEach((c) => {
    lineas.push(
      '---',
      `CLIP ${c.n} · ${c.habla ? 'habla' : 'voz en off'} · ${c.segundos} s`,
      '',
      c.habla ? `Dice: ${c.voz}` : `Voz en off: ${c.voz}`,
      `Qué se ve: ${c.queSeVe}`,
      `Cámara: ${c.camara}`,
      c.imagenAdjunta ? `Adjuntar: ${c.imagenAdjunta}` : '',
      '',
      'PROMPT:',
      c.prompt,
      '',
    );
  });

  lineas.push('---', 'DE CORRIDO', '', plan.deCorrido);

  return lineas.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}
