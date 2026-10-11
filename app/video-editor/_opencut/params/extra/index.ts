// =============================================================================
// Parámetros de elemento que agrega MaKo sobre los de OpenCut
// =============================================================================
// Los parámetros de un elemento (posición, escala, volumen…) viven en
// `element.params` y se declaran en ../registry.ts, que es UN archivo. Las
// funciones de la copia de CapCut (animaciones de entrada/salida, transiciones,
// recorte, reflejo, fundidos de audio…) suman los suyos desde su propio archivo
// en esta carpeta, y acá se juntan: registry.ts los agrega al final de la lista
// de cada tipo de elemento.
//
// Un parámetro declarado así es keyframeable, se guarda con el proyecto y lo
// lee el renderer con `element.params[key]`, sin tocar los tipos de timeline.
//
// Para agregar: crear `extra/<funcion>.ts` que exporte un
// `Partial<Record<ElementType, ElementParamDefinition[]>>` y sumarlo a FUENTES.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

import { paramsReflejo } from "./reflejo";
import { paramsRecorte } from "./recorte";
import { paramsSubtitulos } from "./subtitulos";

type ParamsPorTipo = Partial<Record<ElementType, ElementParamDefinition[]>>;

const FUENTES: ParamsPorTipo[] = [paramsReflejo, paramsRecorte, paramsSubtitulos];

export function paramsExtra(tipo: ElementType): ElementParamDefinition[] {
	return FUENTES.flatMap((f) => f[tipo] ?? []);
}
