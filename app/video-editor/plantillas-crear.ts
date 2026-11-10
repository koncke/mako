// =============================================================================
// «Nuevo video»: las plantillas de «¿Qué vas a crear hoy?», las MISMAS en la computadora y en el teléfono
// =============================================================================
// Martín, 29/10/2026: «En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear
// hoy?» y «para todas las secciones de "create" no quiero otras tabs». La tarjeta «Nuevo video» de la pantalla de Create
// (app/_crear/PantallaCrear.tsx) y la del teléfono (app/m/video-editor/InicioVideoM.tsx) muestran ESTA lista, en este
// orden:
//   0. (9/11/2026, la tab Video) «Replicar un outlier»: las plantillas GUIADAS (lib/video-plantillas/: hoy «Mensaje para…»),
//      que copian un video que funciona y MaKo lleva paso a paso en el chat del editor (app/video-editor/guia/); y «Tu personaje
//      con IA», el estudio que era la tab AI Avatar (docs/relevo/nube-tab-video.md §1). En el teléfono las guiadas no se ofrecen:
//      la guía vive en el chat del editor de la computadora;
//   1. los LIENZOS vacíos (Reel o TikTok 9:16, YouTube 16:9, Cuadrado 1:1, Post 4:5): un proyecto nuevo con ese tamaño;
//   2. «Generar con IA»: el Video Generator, que dejó de ser una pestaña y es una plantilla más de «Nuevo video»;
//   3. las plantillas de anuncio del editor (lib/editor-video/plantillas.ts), con las sugeridas para el negocio primero y
//      «Sugerida» en su rótulo (lib/plantillas-sugeridas.ts): se arman en un proyecto nuevo (`?plantilla=`,
//      plantilla/ArmarPlantilla.tsx).
// Puro: sin `_opencut/` (carga el motor) ni React. Qué HACE cada tarjeta lo dice `destinoDe`, y cada pantalla lo cumple a
// su manera (la computadora crea el lienzo con el motor; las dos navegan a la plantilla o al generador).
// Lo fija tests/video-editor-nuevo-video.test.ts.
// =============================================================================

import type { PlantillaCrear } from '@/app/_crear/reglas';
import { plantillasEnOrden } from '@/lib/editor-video/plantillas';
import { ejemploDeVideo, insigniaDeVideo } from '@/lib/editor-video/plantillas-ejemplos';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { PLANTILLAS_GUIADAS, plantillaGuiada } from '@/lib/video-plantillas';

/** Lo que un lienzo vacío le pone al proyecto nuevo (`settings` del motor, como lo guarda «Relación» o «Detalles»). */
export type LienzoNuevo = {
  canvasSize: { width: number; height: number };
  /**
   * Una proporción fija del reproductor («9:16») o «personalizado» (4:5 no está en «Relación»). Fija: el primer clip
   * NO pisa el lienzo (commands/timeline/element/insert-element.ts), que es lo que se eligió.
   */
  relacion: string;
  canvasSizeMode: 'preset' | 'custom';
  /** Sólo el personalizado: «Detalles» lo recuerda para volver a él (panels/properties/detalles.tsx). */
  lastCustomCanvasSize?: { width: number; height: number };
};

type Formato = { id: string; nombre: string; ancho: number; alto: number; relacion: string };

/** Los lienzos vacíos, en el orden de la tarjeta. Los lados son pares (el H.264 lo pide). */
export const FORMATOS_VIDEO: readonly Formato[] = [
  { id: 'reel', nombre: 'Reel o TikTok', ancho: 1080, alto: 1920, relacion: '9:16' },
  { id: 'youtube', nombre: 'YouTube', ancho: 1920, alto: 1080, relacion: '16:9' },
  { id: 'cuadrado', nombre: 'Cuadrado', ancho: 1080, alto: 1080, relacion: '1:1' },
  { id: 'post', nombre: 'Post 4:5', ancho: 1080, alto: 1350, relacion: 'personalizado' },
];

/** El Video Generator (crear con IA): la ruta de la computadora y la del teléfono. */
export const GENERAR_CON_IA = { escritorio: '/video-generator', movil: '/m/video' } as const;
/** «Tu personaje con IA»: el estudio del personaje (la que era la tab AI Avatar), en la computadora y en el teléfono. */
export const PERSONAJE_CON_IA = { escritorio: '/ai-avatar', movil: '/m/ai-avatar' } as const;
/** El rótulo de la primera sección de «Nuevo video». */
export const GRUPO_REPLICAR = 'Replicar un outlier';

const PREFIJO = { lienzo: 'lienzo:', plantilla: 'plantilla:', guia: 'guia:' } as const;
const ID_IA = 'ia:generar';
const ID_PERSONAJE = 'personaje:nuevo';

/** El lienzo de una plantilla guiada: vertical, como su referencia (un reel). */
export const LIENZO_GUIADO: LienzoNuevo = { canvasSize: { width: 1080, height: 1920 }, relacion: '9:16', canvasSizeMode: 'preset' };

/** El máximo común divisor, para escribir la proporción de un lienzo («1080 / 1350» → «4 / 5»). */
const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b));

/** Las tarjetas de «Nuevo video». Con las señales del negocio, las plantillas que le sirven van primero. */
export function plantillasNuevoVideo(senales?: SenalesNegocio | null): PlantillaCrear[] {
  const lienzos = FORMATOS_VIDEO.map((f): PlantillaCrear => {
    const d = mcd(f.ancho, f.alto);
    return { id: PREFIJO.lienzo + f.id, nombre: f.nombre, formato: `${f.ancho / d} / ${f.alto / d}`, rotulo: `${f.ancho} × ${f.alto}` };
  });
  const ia: PlantillaCrear = { id: ID_IA, nombre: 'Generar con IA', formato: '9 / 16', rotulo: 'Desde una idea' };
  const guiadas = PLANTILLAS_GUIADAS.map((p): PlantillaCrear => ({
    id: PREFIJO.guia + p.id,
    nombre: p.nombre,
    formato: '9 / 16',
    rotulo: `${p.duracionS} s · ${p.bloques.length} bloques`,
    grupo: GRUPO_REPLICAR,
    insignia: 'MaKo te guía',
    ayuda: p.descripcion,
  }));
  const personaje: PlantillaCrear = { id: ID_PERSONAJE, nombre: 'Tu personaje con IA', formato: '3 / 4', rotulo: 'Desde tu foto', grupo: GRUPO_REPLICAR };
  // Las plantillas con su ejemplo (6/11/2026, docs/plantillas-reales/video.md) llevan su insignia, cuándo usarla y «Ver
  // ejemplo» (lib/editor-video/plantillas-ejemplos.ts): la tarjeta es la estructura y el ejemplo lleno se ve aparte. El
  // `rotulo` sigue igual (lo fija tests/video-editor-nuevo-video.test.ts).
  const anuncios = plantillasEnOrden(senales).map(({ plantilla: p, porque }): PlantillaCrear => {
    const e = ejemploDeVideo(p.id);
    return {
      id: PREFIJO.plantilla + p.id,
      nombre: p.nombre,
      formato: '9 / 16',
      rotulo: porque ? `Sugerida · ${p.duracion} s` : `${p.duracion} s`,
      ...(e ? { insignia: insigniaDeVideo(p, porque), ayuda: e.cuando, verEjemplo: true } : {}),
    };
  });
  return [...guiadas, personaje, ...lienzos, ia, ...anuncios];
}

/** Cuántas tarjetas van antes de los lienzos (las guiadas y «Tu personaje con IA»). */
export const ANTES_DE_LOS_LIENZOS = PLANTILLAS_GUIADAS.length + 1;

/** Qué hace una tarjeta de «Nuevo video». */
export type DestinoNuevoVideo =
  | { tipo: 'lienzo'; lienzo: LienzoNuevo }
  | { tipo: 'plantilla'; id: string }
  | { tipo: 'guia'; id: string; lienzo: LienzoNuevo; nombre: string }
  | { tipo: 'personaje' }
  | { tipo: 'ia' };

export function destinoDe(id: string): DestinoNuevoVideo | null {
  if (id === ID_IA) return { tipo: 'ia' };
  if (id === ID_PERSONAJE) return { tipo: 'personaje' };
  if (id.startsWith(PREFIJO.guia)) {
    const p = plantillaGuiada(id.slice(PREFIJO.guia.length));
    return p ? { tipo: 'guia', id: p.id, lienzo: LIENZO_GUIADO, nombre: p.nombre } : null;
  }
  if (id.startsWith(PREFIJO.lienzo)) {
    const f = FORMATOS_VIDEO.find((x) => PREFIJO.lienzo + x.id === id);
    if (!f) return null;
    const canvasSize = { width: f.ancho, height: f.alto };
    return {
      tipo: 'lienzo',
      lienzo: f.relacion === 'personalizado'
        ? { canvasSize, relacion: f.relacion, canvasSizeMode: 'custom', lastCustomCanvasSize: canvasSize }
        : { canvasSize, relacion: f.relacion, canvasSizeMode: 'preset' },
    };
  }
  if (id.startsWith(PREFIJO.plantilla)) {
    const p = plantillasEnOrden(null).find((x) => PREFIJO.plantilla + x.plantilla.id === id);
    return p ? { tipo: 'plantilla', id: p.plantilla.id } : null;
  }
  return null;
}

/** La ruta que arma una plantilla de anuncio en un proyecto nuevo (la page la valida contra el catálogo). */
export function rutaDePlantilla(id: string, movil = false): string {
  return `${movil ? '/m' : ''}/video-editor/nuevo?plantilla=${encodeURIComponent(id)}`;
}

/** Los pedidos de ejemplo que se escriben solos en la caja de «¿Qué vas a crear hoy?». */
export const EJEMPLOS_NUEVO_VIDEO: readonly string[] = [
  'Un reel de 30 segundos presentando mi producto',
  'Un video para YouTube con los 3 errores más comunes de mis clientes',
  'Un anuncio vertical con un testimonio y una oferta al final',
  'Un TikTok con subtítulos grandes contando cómo empezó mi negocio',
];

/** Las tarjetas sin las plantillas GUIADAS (el teléfono: su guía vive en el chat del editor de la computadora). */
export function sinGuiadas(plantillas: readonly PlantillaCrear[]): PlantillaCrear[] {
  return plantillas.filter((p) => !p.id.startsWith(PREFIJO.guia));
}
