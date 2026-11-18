// =============================================================================
// image-editor/chat/fotos — los filtros, los ajustes y el recorte de una foto, como los guarda el motor (puro)
// =============================================================================
// O37 (18/11/2026, el pedido del 27/10: «si una persona quiere editar lo que sea debería poder, con prompts»): el chat
// «MaKo IA» del Image Editor ya cambia textos, formas, fotos y páginas, y no podía tocar los filtros ni el recorte de una
// foto. El motor los guarda en el JSON del documento, así que el chat los escribe ahí y entran con `applyDocument`, en
// UN paso de deshacer, como todo lo demás (./aplicar.ts).
//
// Lo que gobierna, y no se ve en las firmas:
//   · ES UNA COPIA DEL MOTOR, A PROPÓSITO. Los filtros viven en `_doory/editor/engine/objects/filters.ts` (FILTER_PRESETS,
//     FILTER_RANGES, normalizeSpecs) y el recorte en `_doory/editor/engine/crop.ts` (fitAspect) y en la barra
//     `_doory/editor/toolbar/sections/crop.tsx` (ASPECTS). El server lee este módulo y no puede importar el motor (test 4
//     de tests/image-editor-integracion.test.ts), así que se copian los DATOS, y tests/image-editor-chat-fotos.test.ts
//     corre los dos lados y falla si se separan.
//   · EN EL DOCUMENTO, UNA FOTO GUARDA `filters: [{ type, value }]` (el `filterSpecs` del motor, deshidratado: lo mueve
//     `serialization.ts`). Sin filtros, la clave no va. Los valores son los del motor (-1..1); la persona y la IA hablan
//     en los de la pantalla (brillo -100..100, tono -180..180), y la escala de cada uno es la de FILTER_RANGES.
//   · UN AJUSTE SE SUMA A LO QUE HAY (como `withSpec` del panel): «más brillo» no le saca el blanco y negro. Un filtro
//     (Vívido, Noir…) REEMPLAZA todo, como en el panel.
//   · RECORTAR ACHICA DENTRO DE LO QUE YA SE VE: el documento no guarda el tamaño original de la foto, así que el chat no
//     puede agrandar el recorte ni volver a la foto entera (eso queda en el editor). El centro de lo que se ve no se mueve.
// =============================================================================

import type { ImageFilterSpec, ImageFilterType } from '@/app/image-editor/_doory/types/document';

export type FiltroFoto = 'original' | 'vivido' | 'calido' | 'frio' | 'mono' | 'noir' | 'desvaido' | 'vintage' | 'dramatico';

/** Los filtros del panel de la foto («Filtros»): el nombre de la pantalla y lo que el motor guarda (FILTER_PRESETS). */
export const FILTROS_FOTO: Readonly<Record<FiltroFoto, { preset: string; nombre: string; specs: readonly ImageFilterSpec[] }>> = {
  original: { preset: 'none', nombre: 'Original', specs: [] },
  vivido: { preset: 'vivid', nombre: 'Vívido', specs: [{ type: 'contrast', value: 0.15 }, { type: 'saturation', value: 0.45 }] },
  calido: { preset: 'warm', nombre: 'Cálido', specs: [{ type: 'hue', value: -0.04 }, { type: 'saturation', value: 0.2 }, { type: 'brightness', value: 0.04 }] },
  frio: { preset: 'cool', nombre: 'Frío', specs: [{ type: 'hue', value: 0.08 }, { type: 'saturation', value: -0.1 }, { type: 'brightness', value: 0.02 }] },
  mono: { preset: 'mono', nombre: 'Mono', specs: [{ type: 'grayscale', value: 1 }] },
  noir: { preset: 'noir', nombre: 'Noir', specs: [{ type: 'grayscale', value: 1 }, { type: 'contrast', value: 0.35 }, { type: 'vignette', value: 0.55 }] },
  desvaido: { preset: 'fade', nombre: 'Desvaído', specs: [{ type: 'contrast', value: -0.2 }, { type: 'saturation', value: -0.25 }, { type: 'brightness', value: 0.1 }] },
  vintage: { preset: 'vintage', nombre: 'Vintage', specs: [{ type: 'sepia', value: 1 }, { type: 'contrast', value: 0.1 }, { type: 'vignette', value: 0.4 }] },
  dramatico: { preset: 'dramatic', nombre: 'Dramático', specs: [{ type: 'contrast', value: 0.4 }, { type: 'saturation', value: -0.15 }, { type: 'brightness', value: -0.05 }, { type: 'vignette', value: 0.35 }] },
};

export type AjusteDeslizable = 'brillo' | 'contraste' | 'saturacion' | 'tono' | 'desenfoque' | 'vineta';
export type AjusteSiNo = 'blanco_y_negro' | 'sepia';

/** Los deslizadores del panel de la foto, en las unidades de la PANTALLA (`min`, `max`) y lo que divide para el motor. */
export const AJUSTES_FOTO: Readonly<Record<AjusteDeslizable, { tipo: ImageFilterType; min: number; max: number; escala: number; nombre: string }>> = {
  brillo: { tipo: 'brightness', min: -100, max: 100, escala: 100, nombre: 'brillo' },
  contraste: { tipo: 'contrast', min: -100, max: 100, escala: 100, nombre: 'contraste' },
  saturacion: { tipo: 'saturation', min: -100, max: 100, escala: 100, nombre: 'saturación' },
  tono: { tipo: 'hue', min: -180, max: 180, escala: 180, nombre: 'tono' },
  desenfoque: { tipo: 'blur', min: 0, max: 100, escala: 100, nombre: 'desenfoque' },
  vineta: { tipo: 'vignette', min: 0, max: 100, escala: 100, nombre: 'viñeta' },
};

/** Los que se prenden o se apagan («Escala de grises» y «Sepia» del panel). */
export const AJUSTES_SI_NO: Readonly<Record<AjusteSiNo, { tipo: ImageFilterType; nombre: string }>> = {
  blanco_y_negro: { tipo: 'grayscale', nombre: 'blanco y negro' },
  sepia: { tipo: 'sepia', nombre: 'sepia' },
};

export const CAMPOS_AJUSTE = [...(Object.keys(AJUSTES_FOTO) as AjusteDeslizable[]), ...(Object.keys(AJUSTES_SI_NO) as AjusteSiNo[])] as const;
export type AjustesFoto = Partial<Record<AjusteDeslizable, number> & Record<AjusteSiNo, boolean>>;

/** El orden en que el motor guarda los filtros (`normalizeSpecs`). */
const ORDEN: readonly ImageFilterType[] = ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'vignette', 'grayscale', 'sepia'];
const TIPOS = new Set<string>(ORDEN);

/** Copia de `normalizeSpecs` del motor: sin los neutros ni los repetidos (gana el último), en su orden y redondeados. */
export function normalizarFiltros(specs: readonly ImageFilterSpec[]): ImageFilterSpec[] {
  const porTipo = new Map<ImageFilterType, number>();
  for (const s of specs) porTipo.set(s.type, s.value);
  return ORDEN.filter((t) => (porTipo.get(t) ?? 0) !== 0).map((t) => ({ type: t, value: Math.round((porTipo.get(t) ?? 0) * 1000) / 1000 }));
}

/** Los filtros que una foto guarda en el documento, saneados (lo que no es un filtro del motor no cuenta). */
export function filtrosDe(o: Record<string, unknown>): ImageFilterSpec[] {
  const lista = Array.isArray(o.filters) ? o.filters : [];
  return normalizarFiltros(lista.filter((s): s is ImageFilterSpec => !!s && typeof s === 'object' && TIPOS.has(String((s as ImageFilterSpec).type)) && typeof (s as ImageFilterSpec).value === 'number' && Number.isFinite((s as ImageFilterSpec).value)));
}

/** Guarda los filtros como el motor (sin la clave si no queda ninguno). */
export function ponerFiltros(o: Record<string, unknown>, specs: readonly ImageFilterSpec[]): void {
  const n = normalizarFiltros(specs);
  if (n.length) o.filters = n;
  else delete o.filters;
}

/** Los ajustes nuevos sobre los de la foto (como `withSpec` del panel): los que no se nombran, quedan. */
export function conAjustes(actuales: readonly ImageFilterSpec[], ajustes: AjustesFoto): ImageFilterSpec[] {
  const porTipo = new Map<ImageFilterType, number>(actuales.map((s) => [s.type, s.value]));
  for (const [k, a] of Object.entries(AJUSTES_FOTO) as Array<[AjusteDeslizable, (typeof AJUSTES_FOTO)[AjusteDeslizable]]>) {
    const v = ajustes[k];
    if (typeof v === 'number') porTipo.set(a.tipo, v / a.escala);
  }
  for (const [k, a] of Object.entries(AJUSTES_SI_NO) as Array<[AjusteSiNo, (typeof AJUSTES_SI_NO)[AjusteSiNo]]>) {
    const v = ajustes[k];
    if (typeof v === 'boolean') porTipo.set(a.tipo, v ? 1 : 0);
  }
  return normalizarFiltros([...porTipo].map(([type, value]) => ({ type, value })));
}

/** Dos listas de filtros ya normalizadas, iguales. */
export const filtrosIguales = (a: readonly ImageFilterSpec[], b: readonly ImageFilterSpec[]) => a.length === b.length && a.every((s, i) => s.type === b[i].type && s.value === b[i].value);

/** Los ajustes de una foto en las unidades de la pantalla, para la vista de la IA (vacío = sin filtros). */
export function ajustesDeVista(specs: readonly ImageFilterSpec[]): AjustesFoto {
  const out: AjustesFoto = {};
  for (const s of specs) {
    const desl = (Object.entries(AJUSTES_FOTO) as Array<[AjusteDeslizable, (typeof AJUSTES_FOTO)[AjusteDeslizable]]>).find(([, a]) => a.tipo === s.type);
    if (desl) { out[desl[0]] = Math.round(s.value * desl[1].escala); continue; }
    const si = (Object.entries(AJUSTES_SI_NO) as Array<[AjusteSiNo, (typeof AJUSTES_SI_NO)[AjusteSiNo]]>).find(([, a]) => a.tipo === s.type);
    if (si) out[si[0]] = s.value > 0;
  }
  return out;
}

/** Cómo se lee en la revisión lo que tiene una foto: el filtro por su nombre, «sin filtros» o los ajustes. */
export function textoDeFiltros(specs: readonly ImageFilterSpec[]): string {
  const n = normalizarFiltros(specs);
  if (!n.length) return 'sin filtros';
  const filtro = Object.values(FILTROS_FOTO).find((f) => f.specs.length && filtrosIguales(normalizarFiltros(f.specs), n));
  if (filtro) return filtro.nombre;
  const v = ajustesDeVista(n);
  return Object.entries(v)
    .map(([k, x]) => (typeof x === 'boolean' ? AJUSTES_SI_NO[k as AjusteSiNo].nombre : typeof x === 'number' ? `${AJUSTES_FOTO[k as AjusteDeslizable].nombre} ${x > 0 ? '+' : ''}${x}` : ''))
    .filter(Boolean)
    .join(' · ');
}

export type ProporcionRecorte = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

/** Las proporciones de la barra de recorte del editor (`ASPECTS` de _doory/editor/toolbar/sections/crop.tsx, sin «Libre»). */
export const PROPORCIONES_RECORTE: Readonly<Record<ProporcionRecorte, number>> = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16 };

export type Recorte = { cropX: number; cropY: number; width: number; height: number };

/**
 * El recorte más grande con esa proporción (ancho / alto, como se VE) dentro de lo que ya se ve, centrado. Es
 * `fitAspect` del motor con la foto acotada a lo visible (el documento no trae el tamaño original de la foto).
 * `sx`, `sy`: la escala de la foto en la página (positiva).
 */
export function recorteConProporcion(actual: Recorte, sx: number, sy: number, proporcion: number): Recorte {
  const enImagen = proporcion * (sy / sx);
  let width = actual.width;
  let height = width / enImagen;
  if (height > actual.height) {
    height = actual.height;
    width = height * enImagen;
  }
  return { width, height, cropX: actual.cropX + (actual.width - width) / 2, cropY: actual.cropY + (actual.height - height) / 2 };
}
