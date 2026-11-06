// =============================================================================
// Los PROYECTOS de AI Avatar: un look y los videos que se hicieron con él
// =============================================================================
// El estudio (app/ai-avatar/Estudio.tsx) copia el «History» de Higgsfield: cada cosa generada es una tarjeta que se
// abre y se sigue usando. En MaKo la unidad es el LOOK (la persona en la escena de un preset); sus videos no viven en
// el look sino en el historial del Video Generator (`crearVideoAction` guarda el plan con `conAvatar`), y se cruzan
// por el `mediaId` de la imagen: `conAvatar` lo escribe en `imagenes['1'].elegidaId`.
//
// SIN `server-only`: es un cruce de datos y necesita test. Lo usan el server (inicio) y las dos pantallas (el orden y
// los rótulos).

import type { PlanGuardado } from '@/app/video-generator/video-datos';

export type VideoDeLook = {
  planId: string;
  /** Lo que dice el avatar (el `pedido` del plan: el guion, recortado). */
  guion: string;
  at: string;
  /** Cuántas tomas tiene el plan y cuántas ya tienen archivo. */
  tomas: number;
  listas: number;
  /** La primera toma con archivo, para mirarla en la tarjeta. '' si todavía no hay. */
  url: string;
  /**
   * El número de esa toma (null sin archivo). Con un video de UNA toma (un hook, una frase), es el video entero: «Usar en un
   * anuncio» lo lleva por su plan y su toma, y /anuncio/nuevo lo resuelve al clip de hoy.
   */
  primeraToma: number | null;
};

/** Los videos de un look, del más nuevo al más viejo. Sin `mediaId` (el look todavía se genera) no hay ninguno. */
export function videosDelLook(historial: readonly PlanGuardado[], mediaId: string): VideoDeLook[] {
  if (!mediaId) return [];
  const out: VideoDeLook[] = [];
  for (const item of historial) {
    if (item.imagenes?.['1']?.elegidaId !== mediaId) continue;
    const clips = item.plan?.clips ?? [];
    const conArchivo = clips.map((c) => ({ n: c.n, url: item.video?.[String(c.n)]?.url ?? '' })).filter((c) => c.url);
    out.push({
      planId: item.id,
      guion: item.pedido ?? '',
      at: item.at ?? '',
      tomas: clips.length,
      listas: conArchivo.length,
      url: conArchivo[0]?.url ?? '',
      primeraToma: conArchivo[0]?.n ?? null,
    });
  }
  return out.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
}

/** «hace 5 min», «hace 3 h», «hace 2 días»: el rótulo de cada proyecto en la columna. */
export function haceCuanto(iso: string, ahora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((ahora - t) / 60_000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/**
 * Lo que dura un guion hablado, para decirlo en la barra antes de generar: las 3 palabras por segundo de quien habla
 * quieto a cámara (la regla del catálogo, memoria «mako-generador-avatar-catalogo»). Es un aviso, no un tope.
 */
export function segundosDeGuion(guion: string): number {
  const palabras = guion.trim() ? guion.trim().split(/\s+/).length : 0;
  return Math.ceil(palabras / 3);
}

/**
 * Lo que llegó del server (al refrescar) sobre lo que la pantalla ya tenía: el server gana en cada id y manda el orden;
 * lo que la pantalla creó y el server todavía no lista queda ARRIBA (AGENTS.md: un componente que copia sus props a un
 * estado no puede tirar lo nuevo al refrescar, ni tragarse lo recién creado).
 */
export function mezclarPorId<T extends { id: string }>(locales: readonly T[], delServer: readonly T[]): T[] {
  const enServer = new Set(delServer.map((x) => x.id));
  return [...locales.filter((x) => !enServer.has(x.id)), ...delServer];
}
