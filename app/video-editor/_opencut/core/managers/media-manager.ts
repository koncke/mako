import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { toast } from "sonner";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { storageService } from "@/app/video-editor/_opencut/services/storage/service";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { videoCache } from "@/app/video-editor/_opencut/services/video-cache/service";
import { waveformCache } from "@/app/video-editor/_opencut/services/waveform-cache/service";
import { BatchCommand, RemoveMediaAssetCommand } from "@/app/video-editor/_opencut/commands";
import { crearCopiaLiviana } from "@/app/video-editor/_opencut/media/copia-liviana";
import { clavesDelOriginal, medidasDeCopia } from "@/app/video-editor/_opencut/media/copia-liviana-reglas";
import { soltarImagenes } from "@/app/video-editor/_opencut/services/renderer/nodes/image-node";
import { soltarMiniaturas } from "@/app/video-editor/_opencut/timeline/components/miniaturas";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Si un video conviene con copia liviana. Sin medidas guardadas se intenta: crearCopiaLiviana mira la pista. */
function convieneCopia(asset: MediaAsset): boolean {
	if (asset.type !== "video" || asset.copiaLiviana) return false;
	if (!asset.width || !asset.height) return true;
	return medidasDeCopia({ width: asset.width, height: asset.height }) !== null;
}

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();

	/**
	 * Las copias livianas por armar, de a una (media/copia-liviana-reglas.ts): la vista previa decodifica la copia y
	 * exportar el original. El corte cambia con cada proyecto, para que una copia que termina tarde no se pegue en otro.
	 */
	private colaCopias: Array<{ projectId: string; id: string }> = [];
	private armandoCopias = false;
	private corteCopias = new AbortController();

	constructor(private editor: EditorCore) {}

	async addMediaAsset({
		projectId,
		asset,
		subirFps = true,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
		/**
		 * Si un archivo con más cuadros por segundo sube los del proyecto (lo que hace importar). `false` para lo que entra
		 * sin que la persona lo importe (el B-roll de Pexels, broll/red.ts): ese cambio va FUERA del historial, y al chat
		 * le apagaba «Restaurar» (revisión del 10/11/2026).
		 */
		subirFps?: boolean;
	}): Promise<MediaAsset | null> {
		const newAsset: MediaAsset = {
			...asset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			if (subirFps) {
				this.editor.project.ratchetFpsForImportedMedia({
					importedAssets: [newAsset],
				});
			}
			if (convieneCopia(newAsset)) this.encolarCopia({ projectId, id: newAsset.id });
			return newAsset;
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
			this.notify();

			if (storageService.isQuotaExceededError({ error })) {
				toast.error("No hay suficiente espacio de almacenamiento");
			}

			return null;
		}
	}

	removeMediaAsset({ projectId, id }: { projectId: string; id: string }): void {
		this.removeMediaAssets({ projectId, ids: [id] });
	}

	removeMediaAssets({
		projectId,
		ids,
	}: {
		projectId: string;
		ids: string[];
	}): void {
		const uniqueIds = [...new Set(ids)];
		if (uniqueIds.length === 0) {
			return;
		}

		const command =
			uniqueIds.length === 1
				? new RemoveMediaAssetCommand({
						projectId,
						assetId: uniqueIds[0],
					})
				: new BatchCommand(
						uniqueIds.map((id) =>
							new RemoveMediaAssetCommand({
								projectId,
								assetId: id,
							}),
						),
					);

		this.editor.command.execute({ command });
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.cortarCopias();
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;
			this.notify();
			void this.recuperarCopias({ projectId });
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.cortarCopias();
		waveformCache.clearAll();
		soltarImagenes();
		soltarMiniaturas();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		this.cortarCopias();
		videoCache.clearAll();
		waveformCache.clearAll();
		// Las URLs de abajo se revocan: lo decodificado de ellas no se vuelve a pedir.
		soltarImagenes();
		soltarMiniaturas();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	/** Las copias que ya estaban guardadas se usan; las que faltan (un proyecto de antes del 11/11/2026) se arman. */
	private async recuperarCopias({ projectId }: { projectId: string }): Promise<void> {
		const senal = this.corteCopias.signal;
		for (const asset of this.assets) {
			if (!convieneCopia(asset)) continue;
			const guardada = await storageService.loadCopiaLiviana({ projectId, id: asset.id }).catch(() => null);
			if (senal.aborted) return;
			if (guardada && guardada.size > 0) this.ponerCopia({ id: asset.id, file: guardada });
			else this.encolarCopia({ projectId, id: asset.id });
		}
	}

	private encolarCopia({ projectId, id }: { projectId: string; id: string }): void {
		if (this.colaCopias.some((c) => c.id === id)) return;
		this.colaCopias.push({ projectId, id });
		void this.armarCopias();
	}

	private async armarCopias(): Promise<void> {
		if (this.armandoCopias) return;
		this.armandoCopias = true;
		const senal = this.corteCopias.signal;
		try {
			while (this.colaCopias.length > 0 && !senal.aborted) {
				// Exportar va primero: ya decodifica el original y no conviene sumarle otro decodificador.
				while (videoCache.estaExportando() && !senal.aborted) await esperar(2000);
				const siguiente = this.colaCopias.shift();
				if (!siguiente || senal.aborted) break;
				const asset = this.assets.find((a) => a.id === siguiente.id);
				if (!asset || !convieneCopia(asset)) continue;
				const copia = await crearCopiaLiviana({ file: asset.file, signal: senal });
				if (!copia || senal.aborted) continue;
				try {
					await storageService.saveCopiaLiviana({ projectId: siguiente.projectId, id: siguiente.id, file: copia });
				} catch (error) {
					// Sin lugar en el disco: en esta sesión se usa igual, y al volver a abrir se intenta de nuevo.
					console.warn("[copia liviana] no se pudo guardar", error);
				}
				this.ponerCopia({ id: siguiente.id, file: copia });
			}
		} finally {
			this.armandoCopias = false;
			// Lo que entró de OTRO proyecto mientras se cortaba el anterior.
			if (this.colaCopias.length > 0 && !this.corteCopias.signal.aborted) void this.armarCopias();
		}
	}

	private ponerCopia({ id, file }: { id: string; file: File }): void {
		if (!this.assets.some((a) => a.id === id)) return;
		this.assets = this.assets.map((a) => (a.id === id ? { ...a, copiaLiviana: file } : a));
		this.notify();
		// La vista previa pasa a pedir la copia. El decodificador del original que abrió mientras tanto se suelta un
		// rato después (para no cortarle un cuadro en vuelo); si está exportando, lo suelta exportar al terminar.
		setTimeout(() => {
			if (videoCache.estaExportando()) return;
			if (!this.assets.find((a) => a.id === id)?.copiaLiviana) return;
			for (const clave of clavesDelOriginal(id)) videoCache.clearVideo({ mediaId: clave });
		}, 1500);
	}

	private cortarCopias(): void {
		this.corteCopias.abort();
		this.corteCopias = new AbortController();
		this.colaCopias = [];
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => {
			fn();
		});
	}
}
