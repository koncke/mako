import type { MediaAssetData } from "@/app/video-editor/_opencut/services/storage/types";

export type MediaType = "image" | "video" | "audio";

export interface MediaAsset
	extends Omit<MediaAssetData, "size" | "lastModified"> {
	file: File;
	url?: string;
	/**
	 * La copia liviana de un video (540 px de lado corto), con la que decodifica la VISTA PREVIA. Exportar usa siempre
	 * `file`. Se arma después de importar, se guarda en el OPFS al lado del original y no viaja en los metadatos.
	 * Ver media/copia-liviana-reglas.ts.
	 */
	copiaLiviana?: File;
}
