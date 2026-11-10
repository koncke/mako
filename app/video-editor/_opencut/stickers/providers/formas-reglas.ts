// =============================================================================
// Stickers › Formas: qué definiciones del registro de gráficos son FORMAS
// =============================================================================
// El registro de `graphic` (graphics/registry.ts) tiene las formas y, desde el 10/11/2026, los motion graphics
// (graphics/definitions/motion.ts): un `graphic` ANIMADO por plantilla. Stickers › Formas muestra «una definición nueva
// del registro que no está en la lista» con su nombre; sin este corte, las nueve plantillas de motion salían ahí como
// formas cuadradas. Los motion tienen su lugar: Biblioteca › Plantillas › Motion.
//
// Vive aparte de providers/shapes.ts para poder probarlo sin cargar el WASM del motor (shapes.ts importa graphics/index.ts):
// tests/video-editor-motion.test.ts.
// =============================================================================

import type { GraphicDefinition } from "@/app/video-editor/_opencut/graphics/types";

export type FormaDelRegistro = { shapeKey: string; name: string; definitionId: string };

/** Las definiciones del registro que no están en la lista fija y SON formas (no animadas). */
export function formasNuevasDelRegistro(
	definiciones: ReadonlyArray<Pick<GraphicDefinition, "id" | "name" | "animado">>,
	conocidas: ReadonlySet<string>,
): FormaDelRegistro[] {
	return definiciones
		.filter((definition) => !conocidas.has(definition.id) && !definition.animado)
		.map((definition) => ({ shapeKey: definition.id, name: definition.name, definitionId: definition.id }));
}
