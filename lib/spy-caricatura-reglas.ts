// =============================================================================
// spy-caricatura-reglas — la caricatura de un competidor, sola y en segundo plano (4/11/2026)
// =============================================================================
// Martín, 4/11 (por el Cerebro): «En Competitors Spy me traje a @den.borgg y no me hizo la caricatura como habíamos
// quedado... Eso debe hacerse en segundo plano de manera automática».
//
// Lo puro, para que tenga test: en qué paso está la caricatura de cada competidor y qué toca hacer ahora. El motor que
// hace cada paso (describir la cara con la IA del negocio, subir la foto a Flow, pedir la imagen, guardarla) está en
// `lib/spy-caricatura-auto.ts`, y la pantalla le pide un paso por vez a /api/competitor-spy/caricatura.
//
// ⚠️ LOS PASOS, EN ORDEN (el prompt aprobado necesita «rasgos», y Flow necesita la foto adentro antes de usarla):
//   1. rasgos — la IA DEL NEGOCIO mira su foto y dice en una línea qué lo distingue (pelo, barba, lentes…). Sin rasgos
//      no se genera: dos caricaturas sin rasgos salen iguales (ya pasó con Marcos Razzetti y Víctor Heras).
//   2. cara   — la foto sube a Flow (`caraDelCompetidor`): la toma el puente del navegador.
//   3. pedido — `generar_imagen` con el prompt aprobado (`promptDeCaricatura`).
//   4. lista  — cuando Flow la devuelve, se guarda en el bucket de Spy y la tarjeta la usa en vez de la foto.
//
// ⚠️ NO SE HACE: para un referente (sus 22 caricaturas ya están dibujadas y aprobadas), sin foto, en la prueba gratis
// (una caricatura gastaría una de sus 3 imágenes sin que la haya pedido), ni sin el puente de Flow listo (el pedido
// quedaría en la cola para siempre).
// =============================================================================

/** Lo que se recuerda de la caricatura de UN competidor. Vive en `spy.caricaturas` (app_settings del negocio). */
export type EntradaCaricatura = {
  /** Los rasgos que dijo la IA, en inglés (van al prompt). */
  rasgos?: string;
  /** El trabajo de Flow que la está generando. */
  trabajo?: number;
  /** La caricatura ya guardada en nuestro bucket. */
  url?: string;
  /** Cuántas veces Flow falló generándola. */
  fallos?: number;
  /** Cuándo se pidió (ISO): un pedido que nadie toma se abandona. */
  pedidaEn?: string;
};

export type RegistroCaricaturas = Record<string, EntradaCaricatura>;

/** Clave del setting: una por negocio, con una entrada por competidor. */
export const CLAVE_CARICATURAS = 'spy.caricaturas';

/** Cuántas veces se reintenta una caricatura que Flow no pudo generar. Después se queda con su foto. */
export const FALLOS_HASTA_RENDIRSE = 2;

/** Cuánto se espera a que el puente tome un pedido antes de darlo por abandonado y volver a pedirlo. */
export const ABANDONO_MS = 15 * 60 * 1000;

/** Lee el registro guardado. Lo que no tiene la forma se descarta: un setting roto no rompe la lista. */
export function leerRegistro(crudo: string | null | undefined): RegistroCaricaturas {
  let v: unknown;
  try { v = JSON.parse(crudo ?? '{}'); } catch { return {}; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: RegistroCaricaturas = {};
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d+$/.test(k) || !e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const entrada: EntradaCaricatura = {};
    if (typeof o.rasgos === 'string' && o.rasgos.trim()) entrada.rasgos = o.rasgos.trim().slice(0, 240);
    if (Number.isInteger(o.trabajo) && (o.trabajo as number) > 0) entrada.trabajo = o.trabajo as number;
    if (typeof o.url === 'string' && /^https:\/\//.test(o.url)) entrada.url = o.url;
    if (Number.isInteger(o.fallos) && (o.fallos as number) > 0) entrada.fallos = o.fallos as number;
    if (typeof o.pedidaEn === 'string' && Number.isFinite(Date.parse(o.pedidaEn))) entrada.pedidaEn = o.pedidaEn;
    out[k] = entrada;
  }
  return out;
}

/** La caricatura lista de cada competidor, para dibujar la tarjeta. */
export function caricaturasListas(r: RegistroCaricaturas): Map<number, string> {
  return new Map(Object.entries(r).filter(([, e]) => e.url).map(([k, e]) => [Number(k), e.url as string]));
}

/**
 * Los rasgos que devolvió la IA, limpios, o null si no sirven. Se le pide una línea en inglés con lo que distingue a la
 * cara; «NONE» (no hay una cara) y lo que no parece una descripción (vacío, muy largo, una negativa) no sirven.
 */
export function rasgosDeRespuesta(texto: string | null | undefined): string | null {
  const t = (texto ?? '').replace(/```[a-z]*|```/gi, '').replace(/\s+/g, ' ').trim().replace(/^["'«]+|["'»]+$/g, '').replace(/\.$/, '');
  if (!t || /^none\b/i.test(t) || t.length < 12 || t.length > 240) return null;
  if (/\b(sorry|cannot|can't|unable|lo siento|no puedo)\b/i.test(t)) return null;
  return t;
}

/** Qué le toca a la caricatura de un competidor ahora. */
export type Paso =
  | { hacer: 'nada'; porque: 'lista' | 'referente' | 'sin-foto' | 'prueba' | 'sin-puente' | 'se-rindio' }
  | { hacer: 'rasgos' }
  | { hacer: 'pedir' }
  | { hacer: 'mirar-trabajo'; trabajo: number };

/**
 * El paso siguiente, con lo que se sabe del competidor y del negocio. El orden de las preguntas es el del costo: lo
 * gratis y seguro primero (¿ya está?, ¿es referente?), lo que gasta al final.
 */
export function pasoSiguiente(
  e: EntradaCaricatura | undefined,
  ctx: { referente: boolean; avatar: string | null; enPrueba: boolean; puenteListo: boolean },
): Paso {
  if (e?.url) return { hacer: 'nada', porque: 'lista' };
  if (ctx.referente) return { hacer: 'nada', porque: 'referente' };
  if (!ctx.avatar || !/^https:\/\//.test(ctx.avatar)) return { hacer: 'nada', porque: 'sin-foto' };
  if ((e?.fallos ?? 0) >= FALLOS_HASTA_RENDIRSE) return { hacer: 'nada', porque: 'se-rindio' };
  // Un trabajo ya pedido se mira aunque el puente esté apagado ahora: puede haber terminado antes.
  if (e?.trabajo) return { hacer: 'mirar-trabajo', trabajo: e.trabajo };
  if (ctx.enPrueba) return { hacer: 'nada', porque: 'prueba' };
  if (!ctx.puenteListo) return { hacer: 'nada', porque: 'sin-puente' };
  if (!e?.rasgos) return { hacer: 'rasgos' };
  return { hacer: 'pedir' };
}

/** ¿Vuelve a preguntar la pantalla? Sólo mientras hay algo en marcha que puede terminar solo. */
export const sigueEnMarcha = (p: Paso): boolean => p.hacer !== 'nada';
