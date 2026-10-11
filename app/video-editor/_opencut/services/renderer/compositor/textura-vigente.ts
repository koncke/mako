// =============================================================================
// ¿La textura externa que ya subió el compositor sigue sirviendo?
// =============================================================================
// El compositor no re-sube un cuadro si es «el mismo». La identidad del objeto
// NO alcanza: el decodificador de video (mediabunny, `CanvasSink` con
// `poolSize: 3`) recicla 3 canvas en rueda, así que el MISMO canvas trae otro
// cuadro 3, 6, 9… cuadros después. Pasó (11/10/2026): al mover el cabezal 1 s
// (30 cuadros) el reproductor seguía mostrando el cuadro anterior, y con
// Velocidad 3× el MP4 exportado quedaba congelado desde 0,67 s hasta el final.
// Por eso además del objeto se compara la `version` (el timestamp del cuadro,
// resolve.ts → `sourceVersion`).
//
// Vive aparte de wasm-compositor.ts para poder probarlo sin cargar el WASM
// (tests/video-editor-motor.test.ts).

export type HuellaExterna = {
	source: unknown;
	width: number;
	height: number;
	version?: number;
};

export function texturaExternaVigente(previa: HuellaExterna | undefined, nueva: HuellaExterna): boolean {
	return (
		previa !== undefined &&
		previa.source === nueva.source &&
		previa.version === nueva.version &&
		previa.width === nueva.width &&
		previa.height === nueva.height
	);
}
