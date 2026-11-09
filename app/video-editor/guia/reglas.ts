// =============================================================================
// El estado de un proyecto de plantilla guiada: la forma y sus cambios (PURO; 9/11/2026)
// =============================================================================
// Lo guarda ./estado.ts en el navegador; acá se sanea lo leído (el `localStorage` lo puede escribir cualquier versión de la
// pantalla, o nadie) y se arman los cambios, para que se puedan probar sin DOM. docs/relevo/nube-tab-video.md §4 y §5.
// =============================================================================

import { plantillaGuiada } from '@/lib/video-plantillas';
import { BLOQUES_HABLADOS, guionCompleto, problemasDelGuion, type GuionMensajePara } from '@/lib/video-plantillas/mensaje-para';
import { PASO, VALOR, type HechosVideoGuia } from '@/lib/aperturas/video-guia';

export const VERSION_ESTADO_GUIA = 1;
/** Lo más largo que se guarda de un bloque del guion (una frase de un clip de 10 s son ~30 palabras). */
export const TOPE_TEXTO_BLOQUE = 400;

export type EstadoGuiaVideo = {
  v: typeof VERSION_ESTADO_GUIA;
  plantilla: string;
  creado: number;
  /** Lo contestado en cada paso de MaKo (`video-guia:<paso>` → valor). */
  elecciones: Record<string, string>;
  guion: GuionMensajePara;
  /** El editor en modo simple (la plantilla lo abre así; «Todas las herramientas» lo apaga). */
  simple: boolean;
};

export function estadoNuevo(plantilla: string, ahora: number): EstadoGuiaVideo {
  return { v: VERSION_ESTADO_GUIA, plantilla, creado: ahora, elecciones: {}, guion: {}, simple: true };
}

const CLAVES_GUION = [...BLOQUES_HABLADOS.map((b) => b.id), 'cta', 'oferta'] as const;
const ELECCION = /^video-guia:[a-z0-9-]+$/;

/** Lo leído del navegador, sano; o null si no es un estado de una plantilla que existe. */
export function sanearEstadoGuia(x: unknown): EstadoGuiaVideo | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== VERSION_ESTADO_GUIA || typeof o.plantilla !== 'string' || !plantillaGuiada(o.plantilla)) return null;
  const elecciones: Record<string, string> = {};
  if (o.elecciones && typeof o.elecciones === 'object' && !Array.isArray(o.elecciones)) {
    for (const [k, v] of Object.entries(o.elecciones as Record<string, unknown>)) {
      if (ELECCION.test(k) && typeof v === 'string' && v.length <= 200) elecciones[k] = v;
    }
  }
  const guion: GuionMensajePara = {};
  if (o.guion && typeof o.guion === 'object' && !Array.isArray(o.guion)) {
    const g = o.guion as Record<string, unknown>;
    for (const k of CLAVES_GUION) if (typeof g[k] === 'string') (guion as Record<string, string>)[k] = (g[k] as string).slice(0, TOPE_TEXTO_BLOQUE);
  }
  return {
    v: VERSION_ESTADO_GUIA, plantilla: o.plantilla, creado: typeof o.creado === 'number' && Number.isFinite(o.creado) ? o.creado : 0,
    elecciones, guion, simple: o.simple !== false,
  };
}

/** Lo contestado en un paso. */
export const conEleccion = (e: EstadoGuiaVideo, paso: string, valor: string): EstadoGuiaVideo =>
  ELECCION.test(paso) ? { ...e, elecciones: { ...e.elecciones, [paso]: valor.slice(0, 200) } } : e;

/** «Retomar» un paso: se borra lo contestado (o el `saltado`) y MaKo lo vuelve a preguntar. */
export const sinEleccion = (e: EstadoGuiaVideo, paso: string): EstadoGuiaVideo => {
  if (!(paso in e.elecciones)) return e;
  const resto = { ...e.elecciones };
  delete resto[paso];
  return { ...e, elecciones: resto };
};

export const conGuion = (e: EstadoGuiaVideo, guion: GuionMensajePara): EstadoGuiaVideo => {
  const s = sanearEstadoGuia({ ...e, guion });
  return s ?? e;
};

export const conSimple = (e: EstadoGuiaVideo, simple: boolean): EstadoGuiaVideo => ({ ...e, simple });

/** Lo que el proyecto ya tiene, como lo lee la apertura (lo que no es del proyecto llega aparte: fotos, voz, ocupado). */
export type HechosDelProyecto = Pick<HechosVideoGuia, 'plantilla' | 'vioReferencia' | 'guion' | 'guionListo' | 'personaje' | 'voz' | 'fondo' | 'clips' | 'saltados'>;

export function hechosDelProyecto(e: EstadoGuiaVideo | null): HechosDelProyecto {
  if (!e) return { plantilla: null, vioReferencia: false, guion: null, guionListo: false, personaje: null, voz: null, fondo: null, clips: null, saltados: [] };
  // Un `saltado` NO es un valor del paso: el paso sigue sin hacerse (la lista lo muestra para retomarlo).
  const valor = (paso: string): string | null => {
    const v = e.elecciones[paso];
    return v && v !== VALOR.saltado ? v : null;
  };
  return {
    plantilla: e.plantilla,
    vioReferencia: valor(PASO.referencia) === VALOR.vista,
    guion: e.guion,
    // Listo = completo Y filmable: un bloque que no entra en 10 s (`partir`) deja el guion sin cerrar, y los clips no se suman.
    guionListo: guionCompleto(e.guion) && problemasDelGuion(e.guion).length === 0,
    personaje: valor(PASO.personaje),
    voz: valor(PASO.voz),
    fondo: valor(PASO.fondo),
    clips: valor(PASO.clips),
    saltados: Object.entries(e.elecciones).filter(([, v]) => v === VALOR.saltado).map(([k]) => k),
  };
}
