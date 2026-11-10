// =============================================================================
// Las reglas puras de la pestaña «Motion» (pestana-motion.tsx), aparte para poder probarlas sin el editor
// =============================================================================
// tests/motion-panel.test.ts. Sin React y sin nada del motor de OpenCut (el WASM no carga fuera del navegador).
// =============================================================================

import type { CampoMotion } from "@/lib/motion/tipos";

/** Los campos que van en «Estilo»; los demás, en «Textos». */
export const CAMPOS_DE_ESTILO: ReadonlySet<string> = new Set([
	"tono",
	"fuente",
	"colorFondo",
	"colorTexto",
	"colorAcento",
	"colorPanel",
	"conFondo",
]);

/**
 * ¿Lleva deslizador? Sólo un rango que se recorre con la mano (los decimales, de 0 a 2; las estrellas, de 0 a 5): el
 * número de una cifra va de -999.999.999 a 999.999.999 y un deslizador ahí no sirve para elegir nada.
 */
export function conDeslizador(c: Extract<CampoMotion, { tipo: "numero" }>): boolean {
	return c.max - c.min <= 100;
}

/** «Nombre: no puede quedar vacío» → «no puede quedar vacío»: el rótulo ya está arriba del campo. */
export function motivoParaElCampo(motivo: string): string {
	return motivo.replace(/^[^:«]+: /, "");
}
