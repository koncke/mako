// =============================================================================
// Plantillas: las imágenes de MUESTRA de los huecos de clip
// =============================================================================
// Un hueco sin sustituir es una imagen en la pista, como cualquier clip (con su
// transición, su animación y su recorte), con `plantilla.muestra` (./huecos.ts).
// Es un PNG de 1080x1920 por rótulo («Tu clip», «Antes», «Después», «Tu
// producto»; "" el cierre), dibujado en un OffscreenCanvas con ./dibujo.ts, y se
// guarda como medio OCULTO (`ephemeral`: no aparece en Multimedia, molde
// commands/timeline/element/congelar.ts) en el proyecto. Si ya está (otra
// plantilla en el mismo proyecto, o se deshizo y se volvió a usar), se reusa por
// el nombre: no se junta una copia por vez.
//
// ⚠️ Los medios ocultos quedan en OPFS sin recolección (como los cuadros
// congelados; hallazgos → «Lo que quedó SIN hacer» › Operaciones de clip).

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import { LIENZO_REF } from "@/lib/editor-video/plantillas";
import type { MuestraClip } from "./armar";
import { dibujarMuestraClip, type Contexto2D } from "./dibujo";
import { nombreMuestra } from "./uso";

/** El PNG de la muestra de un rótulo, en el tamaño de referencia (1080x1920). */
export async function pngDeMuestra(rotulo: string): Promise<Blob> {
	const { ancho, alto } = LIENZO_REF;
	const celda = { x: 0, y: 0, ancho, alto };
	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(ancho, alto);
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Sin canvas 2D para la muestra");
		dibujarMuestraClip(ctx as unknown as Contexto2D, rotulo, celda);
		return canvas.convertToBlob({ type: "image/png" });
	}
	const canvas = document.createElement("canvas");
	canvas.width = ancho;
	canvas.height = alto;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Sin canvas 2D para la muestra");
	dibujarMuestraClip(ctx, rotulo, celda);
	return new Promise((resolver, rechazar) =>
		canvas.toBlob((b) => (b ? resolver(b) : rechazar(new Error("No se pudo dibujar la muestra"))), "image/png"),
	);
}

/**
 * Las muestras de `rotulos`, guardadas en el proyecto abierto (las que ya estaban,
 * reusadas). Tira error si no se pudo guardar alguna: sin su muestra el armado no
 * tiene qué poner en el hueco (armar.ts también tira).
 */
export async function prepararMuestras(editor: EditorCore, rotulos: readonly string[]): Promise<Record<string, MuestraClip>> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto) throw new Error("Sin proyecto abierto");
	const muestras: Record<string, MuestraClip> = {};
	for (const rotulo of rotulos) {
		const nombre = nombreMuestra(rotulo);
		const ya = editor.media
			.getAssets()
			.find((a) => a.ephemeral && a.type === "image" && a.name === nombre && a.width && a.height);
		if (ya?.width && ya.height) {
			muestras[rotulo] = { mediaId: ya.id, width: ya.width, height: ya.height };
			continue;
		}
		const archivo = new File([await pngDeMuestra(rotulo)], nombre, { type: "image/png" });
		const [procesado] = await processMediaAssets({ files: [archivo] });
		if (!procesado) throw new Error(`No se pudo procesar la muestra «${nombre}»`);
		const medio = await editor.media.addMediaAsset({
			projectId: proyecto.metadata.id,
			asset: { ...procesado, ephemeral: true },
		});
		if (!medio) throw new Error(`No se pudo guardar la muestra «${nombre}»`);
		muestras[rotulo] = { mediaId: medio.id, width: medio.width ?? LIENZO_REF.ancho, height: medio.height ?? LIENZO_REF.alto };
	}
	return muestras;
}
