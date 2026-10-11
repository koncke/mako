// =============================================================================
// Un cuadro de la fuente de un clip, fuera del reproductor
// =============================================================================
// «Congelar» necesita el cuadro del cabezal en resolución completa y el diálogo
// de «Recortar» uno para dibujar. No se usa el `videoCache` del reproductor: es
// un decodificador por medio compartido con la reproducción, y un salto suyo
// mientras se reproduce mueve el cuadro que está mostrando. Acá se abre un
// Input propio, se saca UN cuadro y se cierra.

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";

export type Cuadro = {
	source: CanvasImageSource;
	width: number;
	height: number;
};

/** El cuadro del video que se ve en `segundos` (tiempo de la FUENTE). */
export async function cuadroDeVideo({
	file,
	segundos,
	ladoMaximo,
}: {
	file: File;
	segundos: number;
	/** Achica el cuadro si el lado largo pasa de esto (para mostrar, no para congelar). */
	ladoMaximo?: number;
}): Promise<Cuadro> {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryVideoTrack();
		if (!pista || !(await pista.canDecode())) {
			throw new Error("El video no se puede decodificar en este navegador");
		}
		const escala = ladoMaximo
			? Math.min(1, ladoMaximo / Math.max(pista.displayWidth, pista.displayHeight))
			: 1;
		const width = Math.max(1, Math.round(pista.displayWidth * escala));
		const height = Math.max(1, Math.round(pista.displayHeight * escala));
		const sink = new CanvasSink(pista, { width, height, fit: "fill", poolSize: 0 });
		const primero = await pista.getFirstTimestamp().catch(() => 0);
		const envuelto =
			(await sink.getCanvas(Math.max(primero, segundos))) ?? (await sink.getCanvas(primero));
		if (!envuelto) throw new Error("No hay cuadro en ese instante");
		return { source: envuelto.canvas, width, height };
	} finally {
		input.dispose();
	}
}

/** Carga la imagen de un medio de tipo imagen. */
export function cuadroDeImagen(asset: MediaAsset): Promise<Cuadro> {
	return new Promise((resolve, reject) => {
		const url = asset.url ?? URL.createObjectURL(asset.file);
		const propia = !asset.url;
		const img = new Image();
		img.onload = () => {
			resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
			if (propia) URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			if (propia) URL.revokeObjectURL(url);
			reject(new Error("No se pudo cargar la imagen"));
		};
		img.src = url;
	});
}

/** Un cuadro a JPEG (calidad alta: es lo que se ve 3 s quieto en pantalla). */
export async function cuadroAJpeg(cuadro: Cuadro): Promise<Blob> {
	const lienzo =
		typeof OffscreenCanvas !== "undefined"
			? new OffscreenCanvas(cuadro.width, cuadro.height)
			: Object.assign(document.createElement("canvas"), {
					width: cuadro.width,
					height: cuadro.height,
				});
	const c2d = lienzo.getContext("2d") as
		| OffscreenCanvasRenderingContext2D
		| CanvasRenderingContext2D
		| null;
	if (!c2d) throw new Error("Sin contexto 2D");
	c2d.drawImage(cuadro.source, 0, 0, cuadro.width, cuadro.height);
	if (lienzo instanceof OffscreenCanvas) {
		return lienzo.convertToBlob({ type: "image/jpeg", quality: 0.95 });
	}
	return new Promise((resolve, reject) =>
		(lienzo as HTMLCanvasElement).toBlob(
			(b) => (b ? resolve(b) : reject(new Error("No se pudo codificar el cuadro"))),
			"image/jpeg",
			0.95,
		),
	);
}
