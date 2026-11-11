/**
 * El lienzo que se le pasa al WASM para subir un cuadro. El WASM pide un `OffscreenCanvas` (`uploadTexture`), y los
 * cuadros de video llegan en un `HTMLCanvasElement` (el `CanvasSink` de mediabunny corre en el hilo principal). Antes se
 * creaba un `OffscreenCanvas` NUEVO del tamaño del cuadro por cada subida: 250 MB/s de lienzos tirados en 1080×1920 y
 * 1 GB/s en 4K. Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md §4): en 4K, el pico de la GPU pasaba de
 * +529 a +762 MB, y el basurero los soltaba tarde.
 *
 * Ahora cada textura tiene SU lienzo, que se redibuja cuadro a cuadro: `copyExternalImageToTexture` copia lo que hay en
 * el momento de la llamada, así que redibujarlo después no toca la textura ya subida. Es lo mismo que ya hacían las
 * texturas dibujadas (`syncRenderedTexture`, en ./wasm-compositor.ts). Lo prueba tests/video-editor-lienzo-por-capa.test.ts.
 */
export function lienzoDeSubida({
	source,
	width,
	height,
	previo,
	label,
}: {
	source: CanvasImageSource;
	width: number;
	height: number;
	/** El lienzo que esta textura usó en el cuadro anterior, si hubo. */
	previo?: OffscreenCanvas;
	label: string;
}): OffscreenCanvas {
	// Un OffscreenCanvas ajeno (el recorte, los efectos) se sube tal cual: no se copia ni se guarda.
	if (source instanceof OffscreenCanvas) return source;

	if (typeof OffscreenCanvas === "undefined") {
		throw new Error(`OffscreenCanvas is required for ${label}`);
	}

	const lienzo = previo && previo.width === width && previo.height === height ? previo : new OffscreenCanvas(width, height);
	const context = lienzo.getContext("2d");
	if (!context) {
		throw new Error(`Failed to get 2d context for ${label}`);
	}
	context.clearRect(0, 0, width, height);
	context.drawImage(source, 0, 0, width, height);
	return lienzo;
}
