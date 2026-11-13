"use client";

// =============================================================================
// Volver a enlazar el archivo de un clip que falta en este navegador
// =============================================================================
// La entrada para la pantalla (hoy, el aviso del teléfono: app/m/video-editor/EditorVideoM.tsx). Procesa el archivo
// elegido igual que importar (./processing.ts: miniatura, duración, tamaño; avisa si no se puede leer), rechaza uno
// de otro tipo que el del clip y lo guarda con el MISMO mediaId (MediaManager.reenlazarMedio). Qué falta lo dice
// ./archivos-faltantes.ts.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import { AVISO_OTRO_TIPO, type TipoFaltante } from "@/app/video-editor/_opencut/media/archivos-faltantes";

/** Enlaza `file` como el medio `mediaId` del proyecto abierto. `true` si quedó enlazado. */
export async function reenlazarArchivo({
	editor,
	mediaId,
	tipo,
	file,
}: {
	editor: EditorCore;
	mediaId: string;
	tipo: TipoFaltante;
	file: File;
}): Promise<boolean> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto) return false;
	// processMediaAssets ya avisa por qué no entró (formato, espacio, no se pudo leer).
	const [asset] = await processMediaAssets({ files: [file] });
	if (!asset) return false;
	// Si mientras se leía se cambió de proyecto, la biblioteca abierta ya es la de otro.
	if (editor.project.getActiveOrNull()?.metadata.id !== proyecto.metadata.id) {
		if (asset.url) URL.revokeObjectURL(asset.url);
		return false;
	}
	if (asset.type !== tipo) {
		if (asset.url) URL.revokeObjectURL(asset.url);
		toast.error(AVISO_OTRO_TIPO[tipo]);
		return false;
	}
	const enlazado = await editor.media.reenlazarMedio({ projectId: proyecto.metadata.id, id: mediaId, asset });
	return enlazado !== null;
}
