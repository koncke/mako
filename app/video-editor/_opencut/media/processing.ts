import { toast } from "sonner";
import { getMediaTypeFromFile } from "@/app/video-editor/_opencut/media/media-utils";
import { formatStorageBytes } from "@/app/video-editor/_opencut/services/storage/quota";
import { storageService } from "@/app/video-editor/_opencut/services/storage/service";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { reportarASoporte } from "@/app/_ui/ReportarASoporte";
import { ROTULO_MANDADO, ROTULO_REPORTAR } from "@/lib/soporte-reporte";
import { readVideoFile, SinPistaDeVideo } from "./mediabunny";
import { decidirImportacionVideo, detalleTecnico, motivoDeLectura, type ResultadoLectura } from "./importar-motivo";
import { renderThumbnailDataUrl } from "./thumbnail";

export interface ProcessedMediaAsset extends Omit<MediaAsset, "id"> {}

/**
 * El aviso de un archivo, con «Reportar a Soporte» que lleva el DETALLE TÉCNICO (ticket #15, 27/10/2026): el botón del
 * Toaster sólo manda el título y la descripción, y así el reporte de Leila llegó sin la causa.
 */
function avisar({ titulo, descripcion, tecnico, tipo = "error" }: { titulo: string; descripcion: string; tecnico: string; tipo?: "error" | "warning" }) {
	const mostrar = tipo === "error" ? toast.error : toast.warning;
	mostrar(titulo, {
		description: descripcion,
		duration: 12000,
		action: {
			label: ROTULO_REPORTAR,
			onClick: () => {
				void reportarASoporte({ error: `${titulo}. ${descripcion} · Técnico: ${tecnico}` }).then((r) =>
					r.ok ? toast.success(`${ROTULO_MANDADO} · ticket #${r.id}`) : toast.error(r.error),
				);
			},
		},
	});
}

const getStorageLimitDescription = ({
	fileSize,
	availableBytes,
}: {
	fileSize: number;
	availableBytes: number | null;
}): string => {
	const fileSizeLabel = formatStorageBytes({ bytes: fileSize });

	if (availableBytes === null) {
		return `El archivo pesa ${fileSizeLabel}.`;
	}

	return `El archivo pesa ${fileSizeLabel} y en el navegador quedan ${formatStorageBytes({
		bytes: availableBytes,
	})} libres.`;
};

async function generateImageThumbnail({
	imageFile,
}: {
	imageFile: File;
}): Promise<{ thumbnailUrl: string; width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new window.Image();
		const objectUrl = URL.createObjectURL(imageFile);

		image.addEventListener("load", () => {
			try {
				const thumbnailUrl = renderThumbnailDataUrl({
					width: image.naturalWidth,
					height: image.naturalHeight,
					draw: ({ context, width, height }) => {
						context.drawImage(image, 0, 0, width, height);
					},
				});
				resolve({
					thumbnailUrl,
					width: image.naturalWidth,
					height: image.naturalHeight,
				});
			} catch (error) {
				reject(
					error instanceof Error ? error : new Error("Could not render image"),
				);
			} finally {
				URL.revokeObjectURL(objectUrl);
				image.remove();
			}
		});

		image.addEventListener("error", () => {
			URL.revokeObjectURL(objectUrl);
			image.remove();
			reject(new Error("Could not load image"));
		});

		image.src = objectUrl;
	});
}

export async function processMediaAssets({
	files,
	onProgress,
}: {
	files: FileList | File[];
	onProgress?: ({ progress }: { progress: number }) => void;
}): Promise<ProcessedMediaAsset[]> {
	const fileArray = Array.from(files);
	const processedAssets: ProcessedMediaAsset[] = [];

	const total = fileArray.length;
	let completed = 0;

	for (const file of fileArray) {
		const fileType = getMediaTypeFromFile({ file });

		if (!fileType) {
			toast.error("Formato no admitido", { description: file.name });
			continue;
		}

		const storageCheck = await storageService.canStoreFile({
			size: file.size,
		});

		if (!storageCheck.canStore) {
			toast.error("No hay suficiente almacenamiento", {
				description: getStorageLimitDescription({
					fileSize: file.size,
					availableBytes: storageCheck.availableBytes,
				}),
			});
			continue;
		}

		const url = URL.createObjectURL(file);
		let tipo: typeof fileType = fileType;
		let thumbnailUrl: string | undefined;
		let duration: number | undefined;
		let width: number | undefined;
		let height: number | undefined;
		let fps: number | undefined;
		let hasAudio: boolean | undefined;

		try {
			if (fileType === "image") {
				const result = await generateImageThumbnail({ imageFile: file });
				thumbnailUrl = result.thumbnailUrl;
				width = result.width;
				height = result.height;
			} else if (fileType === "video") {
				// Lo que se pudo leer decide (media/importar-motivo.ts): importar, importar avisando, como audio, o no
				// importar diciendo por qué. Antes, una lectura fallida igual sumaba el clip, sin duración ni tamaño.
				let lectura: ResultadoLectura;
				let videoData: Awaited<ReturnType<typeof readVideoFile>> | null = null;
				try {
					videoData = await readVideoFile({ file });
					lectura = { ok: true, canDecode: videoData.canDecode, codec: videoData.codec, errorDecodificar: videoData.errorDecodificar };
				} catch (error) {
					console.error("[importar] no se pudo leer el video", file.name, error);
					lectura = { ok: false, error, sinImagenConAudio: error instanceof SinPistaDeVideo && error.tieneAudio };
				}
				const decision = decidirImportacionVideo(lectura, file);
				if (decision.accion === "rechazar") {
					avisar({ titulo: "No se pudo importar", descripcion: `${file.name}: ${decision.motivo}`, tecnico: decision.tecnico });
					URL.revokeObjectURL(url);
					continue;
				}
				if (decision.accion === "como-audio") {
					tipo = "audio";
					duration = await medirDuracion({ file });
					toast.info(`${file.name}: ${decision.aviso}`);
				} else if (videoData) {
					duration = videoData.duration;
					width = videoData.width;
					height = videoData.height;
					fps = Number.isFinite(videoData.fps) ? Math.round(videoData.fps) : undefined;
					hasAudio = videoData.hasAudio;
					thumbnailUrl = videoData.thumbnailUrl ?? undefined;
					if (decision.accion === "importar-con-aviso") {
						avisar({ titulo: `No se puede previsualizar ${file.name}`, descripcion: decision.aviso, tecnico: decision.tecnico, tipo: "warning" });
					}
				}
			} else if (fileType === "audio") {
				duration = await getMediaDuration({ file });
				// Un .webm de audio (el que sale de «Extraer audio» de un video con Opus,
				// o una grabación) puede llegar sin duración en la cabecera: el <audio>
				// dice Infinity y el clip quedaría infinito. Se mide leyendo el archivo.
				if (!Number.isFinite(duration)) {
					duration = await medirDuracion({ file });
				}
			}

			processedAssets.push({
				name: file.name,
				type: tipo,
				file,
				url,
				thumbnailUrl,
				duration,
				width,
				height,
				fps,
				hasAudio,
			});

			await new Promise((resolve) => setTimeout(resolve, 0));

			completed += 1;
			if (onProgress) {
				const percent = Math.round((completed / total) * 100);
				onProgress({ progress: percent });
			}
		} catch (error) {
			console.error("Error processing file:", file.name, error);
			avisar({ titulo: "No se pudo importar", descripcion: `${file.name}: ${motivoDeLectura(error, file)}`, tecnico: detalleTecnico(error, file) });
			URL.revokeObjectURL(url);
		}
	}

	return processedAssets;
}

const getMediaDuration = ({ file }: { file: File }): Promise<number> => {
	return new Promise((resolve, reject) => {
		const element = document.createElement(
			file.type.startsWith("video/") ? "video" : "audio",
		) as HTMLVideoElement;
		const objectUrl = URL.createObjectURL(file);

		element.addEventListener("loadedmetadata", () => {
			resolve(element.duration);
			URL.revokeObjectURL(objectUrl);
			element.remove();
		});

		element.addEventListener("error", () => {
			reject(new Error("Could not load media"));
			URL.revokeObjectURL(objectUrl);
			element.remove();
		});

		element.src = objectUrl;
		element.load();
	});
};

async function medirDuracion({ file }: { file: File }): Promise<number | undefined> {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const segundos = await input.computeDuration();
		return Number.isFinite(segundos) && segundos > 0 ? segundos : undefined;
	} catch {
		return undefined;
	} finally {
		input.dispose();
	}
}
