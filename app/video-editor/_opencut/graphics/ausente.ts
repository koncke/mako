// =============================================================================
// Un `graphic` cuya definición ya no existe: no se dibuja y nada tira
// =============================================================================
// Un proyecto guarda el `definitionId` de cada gráfico. Si la definición se va (un `motion-<x>` de una plantilla de
// lib/motion que se sacó o se renombró), `graphicsRegistry.get` tira «Unknown graphic», y como lo llaman el render, el
// descriptor del cuadro, la miniatura de la línea de tiempo y el panel, un elemento así tumbaba el reproductor entero
// (hasta el 10/11/2026). Ahora `getGraphicDefinition` (graphics/index.ts) devuelve ESTA definición vacía —sin parámetros
// y sin dibujo— y `resolve.ts` ni siquiera arma su nodo: el elemento queda en la línea de tiempo, no se ve, y lo demás
// sigue andando.
//
// Aparte de graphics/index.ts para poder probarlo sin el WASM del motor (tests/video-editor-motion.test.ts).
// =============================================================================

import type { GraphicDefinition } from "./types";

export function graficoAusente(definitionId: string): GraphicDefinition {
	return {
		id: definitionId,
		name: "Gráfico que ya no existe",
		keywords: [],
		params: [],
		render() {},
	};
}

/** La definición registrada, o la vacía de un gráfico que ya no existe. */
export function definicionOAusente(
	registro: { has(id: string): boolean; get(id: string): GraphicDefinition },
	definitionId: string,
): GraphicDefinition {
	return registro.has(definitionId) ? registro.get(definitionId) : graficoAusente(definitionId);
}
