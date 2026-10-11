// =============================================================================
// «Exportar GIF» (320P / 640P): los cuadros del render, en un GIF que se repite
// =============================================================================
// Usa el MISMO render que el video (CanvasRenderer sobre el compositor) a 10
// cuadros por segundo, achica cada cuadro a 320/640 de lado corto en un canvas
// 2D y lo cuantiza a 256 colores con gifenc (MIT, ya en el repo). Una paleta
// por cuadro: con una global, un corte de escena se queda sin sus colores.
//
// CapCut corta en 60 s («No se puede exportar. El video es demasiado largo.»):
// un GIF de un minuto ya pesa decenas de MB y nadie lo va a subir.

import type { FrameRate } from "opencut-wasm";
import type { RootNode } from "@/app/video-editor/_opencut/services/renderer/nodes/root-node";
import { CanvasRenderer } from "@/app/video-editor/_opencut/services/renderer/canvas-renderer";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { GIF_FPS, RESOLUCIONES_GIF, type ResolucionGifId } from "./opciones";

export async function exportarGif({
	escena,
	lienzo,
	resolucion,
	fps,
	onProgreso,
	cancelado,
}: {
	escena: RootNode;
	lienzo: { width: number; height: number };
	resolucion: ResolucionGifId;
	fps: FrameRate;
	onProgreso: (p: number) => void;
	cancelado: () => boolean;
}): Promise<Blob | null> {
	const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
	const lado = RESOLUCIONES_GIF.find((r) => r.id === resolucion)?.lado ?? 320;
	const corto = Math.max(1, Math.min(lienzo.width, lienzo.height));
	const ancho = Math.max(2, Math.round((lienzo.width * lado) / corto));
	const alto = Math.max(2, Math.round((lienzo.height * lado) / corto));

	const renderer = new CanvasRenderer({ width: lienzo.width, height: lienzo.height, fps });
	const destino = document.createElement("canvas");
	destino.width = ancho;
	destino.height = alto;
	const ctx = destino.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("Canvas 2D no disponible");
	ctx.imageSmoothingQuality = "high";

	const gif = GIFEncoder();
	const segundos = escena.duration / TICKS_PER_SECOND;
	const cuadros = Math.max(1, Math.floor(segundos * GIF_FPS));
	const retardoMs = 1000 / GIF_FPS;

	for (let i = 0; i < cuadros; i++) {
		if (cancelado()) return null;
		const tiempo = Math.round((i / GIF_FPS) * TICKS_PER_SECOND);
		await renderer.renderToCanvas({ node: escena, time: tiempo, targetCanvas: destino });
		const { data } = ctx.getImageData(0, 0, ancho, alto);
		const paleta = quantize(data, 256);
		const indices = applyPalette(data, paleta);
		gif.writeFrame(indices, ancho, alto, { palette: paleta, delay: retardoMs, repeat: 0 });
		onProgreso((i + 1) / cuadros);
		// Ceder el hilo cada tanto: la cuantización es síncrona y el diálogo tiene
		// que poder dibujar el porcentaje (y el botón Cancelar, responder).
		if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
	}
	gif.finish();
	return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
}
