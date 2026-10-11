"use client";

// =============================================================================
// Importar archivos a la biblioteca (Multimedia › Importar y Audio › Importar)
// =============================================================================
// Lo mismo que hacía la vista de medios de OpenCut adentro del componente, sacado
// a un hook para que lo usen las dos pestañas: procesa los archivos (miniatura,
// duración, tamaño), los guarda en el proyecto (IndexedDB/OPFS del workspace) y
// avisa con el toast de importar. `soloTipo` es el filtro de Audio › Importar,
// que en CapCut rechaza lo que no es audio con su propio aviso.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { getMediaTypeFromFile } from "@/app/video-editor/_opencut/media/media-utils";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import type { MediaAsset, MediaType } from "@/app/video-editor/_opencut/media/types";
import { showMediaUploadToast } from "@/app/video-editor/_opencut/media/upload-toast";

/** Procesa y guarda los archivos en el proyecto activo. Devuelve los que quedaron. */
export async function importarArchivos({
	editor,
	files,
	onProgress,
}: {
	editor: EditorCore;
	files: File[];
	onProgress?: (porcentaje: number) => void;
}): Promise<MediaAsset[]> {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || files.length === 0) return [];

	const procesados = await processMediaAssets({
		files,
		onProgress: ({ progress }) => onProgress?.(progress),
	});
	const creados: MediaAsset[] = [];
	for (const asset of procesados) {
		const creado = await editor.media.addMediaAsset({
			projectId: proyecto.metadata.id,
			asset,
		});
		if (creado) creados.push(creado);
	}
	return creados;
}

export function useImportarArchivos() {
	const editor = useEditor();
	const [procesando, setProcesando] = useState(false);
	const [progreso, setProgreso] = useState(0);

	const importar = useCallback(
		async ({
			files,
			soloTipo,
		}: {
			files: File[];
			soloTipo?: MediaType;
		}): Promise<MediaAsset[]> => {
			let aceptados = files;
			if (soloTipo) {
				aceptados = files.filter((file) => getMediaTypeFromFile({ file }) === soloTipo);
				const rechazados = files.length - aceptados.length;
				if (rechazados > 0 && soloTipo === "audio") {
					// El aviso de CapCut (`pc_files_failed_to_import_only_audio_is_supported`).
					toast.error(
						rechazados === 1
							? "No se pudo importar 1 archivo. Solo es compatible con la importación de audio"
							: `No se pudieron importar ${rechazados} archivos. Solo es compatible con la importación de audio`,
					);
				}
			}
			if (aceptados.length === 0) return [];

			setProcesando(true);
			setProgreso(0);
			try {
				let creados: MediaAsset[] = [];
				await showMediaUploadToast({
					filesCount: aceptados.length,
					promise: async () => {
						creados = await importarArchivos({
							editor,
							files: aceptados,
							onProgress: setProgreso,
						});
						return {
							uploadedCount: creados.length,
							assetNames: creados.map((asset) => asset.name),
						};
					},
				});
				return creados;
			} catch (error) {
				console.error("[biblioteca] no se pudo importar", error);
				return [];
			} finally {
				setProcesando(false);
				setProgreso(0);
			}
		},
		[editor],
	);

	return { importar, procesando, progreso };
}
