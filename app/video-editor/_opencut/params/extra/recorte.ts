// =============================================================================
// «Recortar»: parámetros del clip
// =============================================================================
// Cuánto se le saca a cada lado del cuadro, como fracción (0–1) del ancho o del
// alto de la FUENTE: independiente de la resolución, así un proxy o un archivo
// revertido con otro tamaño recortan igual. `recorte.proporcion` recuerda qué
// eligió el usuario en el diálogo («Libre», «16:9»…) para volver a abrirlo así.
// No se animan (CapCut no pone ◇ al recorte). Los aplica el gancho de fuente de
// recorte/ganchos.ts; el diálogo es recorte/dialogo-recorte.tsx.

import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";

export const RECORTE_IZQUIERDA = "recorte.izquierda";
export const RECORTE_ARRIBA = "recorte.arriba";
export const RECORTE_DERECHA = "recorte.derecha";
export const RECORTE_ABAJO = "recorte.abajo";
export const RECORTE_PROPORCION = "recorte.proporcion";

/**
 * Las proporciones del diálogo, en el orden de CapCut. `valor` es ancho/alto en
 * píxeles; «Libre» no tiene, «Original» es la del archivo.
 */
export const PROPORCIONES_RECORTE: ReadonlyArray<{ id: string; etiqueta: string; valor?: number }> = [
	{ id: "libre", etiqueta: "Libre" },
	{ id: "original", etiqueta: "Original" },
	{ id: "16:9", etiqueta: "16:9", valor: 16 / 9 },
	{ id: "9:16", etiqueta: "9:16", valor: 9 / 16 },
	{ id: "1:1", etiqueta: "1:1", valor: 1 },
	{ id: "4:3", etiqueta: "4:3", valor: 4 / 3 },
	{ id: "3:4", etiqueta: "3:4", valor: 3 / 4 },
	{ id: "2:1", etiqueta: "2:1", valor: 2 },
	{ id: "2.35:1", etiqueta: "2.35:1", valor: 2.35 },
	{ id: "1.85:1", etiqueta: "1.85:1", valor: 1.85 },
];

const lado = (key: string, label: string): ElementParamDefinition => ({
	key,
	label,
	type: "number",
	default: 0,
	min: 0,
	max: 1,
	step: 0.0001,
	keyframable: false,
});

const params: ElementParamDefinition[] = [
	lado(RECORTE_IZQUIERDA, "Recorte izquierdo"),
	lado(RECORTE_ARRIBA, "Recorte superior"),
	lado(RECORTE_DERECHA, "Recorte derecho"),
	lado(RECORTE_ABAJO, "Recorte inferior"),
	{
		key: RECORTE_PROPORCION,
		label: "Relación de aspecto",
		type: "select",
		default: "libre",
		keyframable: false,
		options: PROPORCIONES_RECORTE.map((p) => ({ value: p.id, label: p.etiqueta })),
	},
];

export const paramsRecorte: Partial<Record<ElementType, ElementParamDefinition[]>> = {
	video: params,
	image: params,
};
