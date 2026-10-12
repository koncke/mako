// =============================================================================
// Audio (paquete J): fundidos, normalizar, reducir el ruido, modificador de voz
// =============================================================================
// Las claves y cómo se leen están en audio/claves.ts. Acá se DECLARAN las que son
// un ajuste del clip: así entran en los defaults de un clip nuevo y viajan con
// «Copiar/Pegar atributos». Ninguna se anima: los fundidos no llevan ◇ en
// CapCut, y Tono/Timbre sí (relevamiento-capcut-armazon §5), pero acá el
// modificador de voz procesa el clip ENTERO (audio/cadena.ts) con un valor
// fijo; animarlo exige procesar por tramos. El volumen, que sí se anima, es del
// motor (params/registry.ts).
//
// Lo que es del ARCHIVO (la casilla de normalizar con su intensidad medida, los
// ritmos, la marca de «Extraer audio») no se declara: «Pegar atributos» pega sólo
// lo declarado, y en otro clip mentiría (ver audio/claves.ts).

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import {
	FUNDIDO_ENTRADA,
	FUNDIDO_SALIDA,
	NORMALIZAR_OBJETIVO,
	OBJETIVOS_INTENSIDAD,
	OBJETIVO_PREDETERMINADO,
	PERILLAS_VOZ,
	REDUCIR_RUIDO,
	VOZ,
	clavePerilla,
} from "@/app/video-editor/_opencut/audio/claves";

const params: ElementParamDefinition[] = [
	{
		key: FUNDIDO_ENTRADA,
		label: "Aparición progresiva",
		type: "number",
		default: 0,
		min: 0,
		step: 0.1,
		keyframable: false,
	},
	{
		key: FUNDIDO_SALIDA,
		label: "Desaparición progresiva",
		type: "number",
		default: 0,
		min: 0,
		step: 0.1,
		keyframable: false,
	},
	{
		key: NORMALIZAR_OBJETIVO,
		label: "Intensidad objetivo",
		type: "select",
		default: OBJETIVO_PREDETERMINADO,
		keyframable: false,
		options: OBJETIVOS_INTENSIDAD.map((o) => ({ value: o.id, label: o.etiqueta })),
	},
	{
		key: REDUCIR_RUIDO,
		label: "Reducir el ruido",
		type: "boolean",
		default: false,
		keyframable: false,
	},
	{
		key: VOZ,
		label: "Modificador de voz",
		type: "text",
		default: "original",
		keyframable: false,
	},
	...PERILLAS_VOZ.map(
		(p): ElementParamDefinition => ({
			key: clavePerilla(p.id),
			label: p.etiqueta,
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
			keyframable: false,
		}),
	),
];

export const paramsAudio: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	audio: params,
	video: params,
};
