// =============================================================================
// El servicio de transcripción: arma el worker de Whisper y le habla
// =============================================================================
// Elige dónde corre el modelo: WebGPU si el navegador lo tiene (mucho más
// rápido), si no WASM. Si WebGPU falla al cargar o al transcribir, se pasa a
// WASM y se repite UNA vez: es cómputo local, no gasta plata de nadie. La caída
// queda recordada en la pestaña para no volver a probar WebGPU en cada pedido.
//
// «Cancelar» TERMINA el worker: Whisper no se puede frenar a mitad de un trozo
// y un worker que sigue transcribiendo lo viejo mientras le piden lo nuevo
// correría dos sesiones de ONNX a la vez. El modelo queda en la caché del
// navegador; volver a cargarlo tarda segundos, no la descarga.

import type {
	TranscriptionLanguage,
	TranscriptionResult,
	TranscriptionProgress,
	TranscriptionModelId,
} from "@/app/video-editor/_opencut/transcription/types";
import {
	DEFAULT_TRANSCRIPTION_MODEL,
	TRANSCRIPTION_MODELS,
	dtypeDe,
	type DispositivoWhisper,
} from "@/app/video-editor/_opencut/transcription/models";
import type { WorkerMessage, WorkerResponse } from "./worker";

type ProgressCallback = (progress: TranscriptionProgress) => void;

export class TranscripcionCancelada extends Error {
	constructor() {
		super("Transcription cancelled");
		this.name = "TranscripcionCancelada";
	}
}

let webgpuCayo = false;

async function hayWebGpu(): Promise<boolean> {
	if (webgpuCayo || typeof navigator === "undefined") return false;
	const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
	if (!gpu) return false;
	try {
		return (await gpu.requestAdapter()) != null;
	} catch {
		return false;
	}
}

class TranscriptionService {
	private worker: Worker | null = null;
	private clave: string | null = null;
	private rechazarEnCurso: ((error: Error) => void) | null = null;

	async transcribe({
		audioData,
		language = "auto",
		modelId = DEFAULT_TRANSCRIPTION_MODEL,
		onProgress,
	}: {
		audioData: Float32Array;
		language?: TranscriptionLanguage;
		modelId?: TranscriptionModelId;
		onProgress?: ProgressCallback;
	}): Promise<TranscriptionResult> {
		const dispositivo: DispositivoWhisper = (await hayWebGpu()) ? "webgpu" : "wasm";
		try {
			return await this.correr({ audioData, language, modelId, dispositivo, onProgress });
		} catch (error) {
			if (error instanceof TranscripcionCancelada || dispositivo !== "webgpu") throw error;
			// WebGPU cargó mal, transcribió mal o no dio marcas por palabra: una vez
			// más, en WASM (que sí cae a tiempos por frase si hace falta).
			console.warn("[transcripción] WebGPU falló; sigo con WASM", error);
			webgpuCayo = true;
			this.terminate();
			return this.correr({ audioData, language, modelId, dispositivo: "wasm", onProgress });
		}
	}

	private async correr({
		audioData,
		language,
		modelId,
		dispositivo,
		onProgress,
	}: {
		audioData: Float32Array;
		language: TranscriptionLanguage;
		modelId: TranscriptionModelId;
		dispositivo: DispositivoWhisper;
		onProgress?: ProgressCallback;
	}): Promise<TranscriptionResult> {
		const worker = await this.ensureWorker({ modelId, dispositivo, onProgress });

		return new Promise<TranscriptionResult>((resolve, reject) => {
			const terminar = () => {
				worker.removeEventListener("message", handleMessage);
				this.rechazarEnCurso = null;
			};
			this.rechazarEnCurso = (error) => {
				terminar();
				reject(error);
			};

			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				switch (response.type) {
					case "transcribe-progress":
						onProgress?.({ status: "transcribing", progress: response.progress });
						break;
					case "transcribe-complete":
						terminar();
						resolve({
							text: response.text,
							palabras: response.palabras,
							precision: response.precision,
							language: response.language,
						});
						break;
					case "transcribe-error":
						terminar();
						reject(new Error(response.error));
						break;
					case "cancelled":
						terminar();
						reject(new TranscripcionCancelada());
						break;
				}
			};

			worker.addEventListener("message", handleMessage);
			// La copia viaja transferida: el buffer de un minuto de audio son ~4 MB
			// y no hace falta tenerlo dos veces.
			const audio = audioData.slice();
			worker.postMessage(
				{
					type: "transcribe",
					audio,
					language: language === "auto" ? null : language,
					exigirPalabras: dispositivo === "webgpu",
				} satisfies WorkerMessage,
				[audio.buffer],
			);
		});
	}

	cancel() {
		const rechazar = this.rechazarEnCurso;
		this.terminate();
		rechazar?.(new TranscripcionCancelada());
	}

	private async ensureWorker({
		modelId,
		dispositivo,
		onProgress,
	}: {
		modelId: TranscriptionModelId;
		dispositivo: DispositivoWhisper;
		onProgress?: ProgressCallback;
	}): Promise<Worker> {
		const clave = `${modelId}:${dispositivo}`;
		if (this.worker && this.clave === clave) return this.worker;

		this.terminate();
		const model = TRANSCRIPTION_MODELS.find((m) => m.id === modelId);
		if (!model) throw new Error(`Unknown model: ${modelId}`);

		const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
		this.worker = worker;

		await new Promise<void>((resolve, reject) => {
			const terminar = () => {
				worker.removeEventListener("message", handleMessage);
				this.rechazarEnCurso = null;
			};
			this.rechazarEnCurso = (error) => {
				terminar();
				reject(error);
			};
			const handleMessage = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				switch (response.type) {
					case "init-progress":
						onProgress?.({ status: "loading-model", progress: response.progress });
						break;
					case "init-complete":
						terminar();
						resolve();
						break;
					case "init-error":
						terminar();
						this.terminate();
						reject(new Error(response.error));
						break;
				}
			};
			worker.addEventListener("message", handleMessage);
			// Un error del worker (al cargar o más tarde, transcribiendo) rechaza lo
			// que esté en curso: si no, la pantalla quedaría esperando para siempre.
			worker.addEventListener("error", (event) => {
				const rechazar = this.rechazarEnCurso;
				if (this.worker === worker) this.terminate();
				rechazar?.(new Error(event.message || "No se pudo iniciar el modelo"));
			});
			worker.postMessage({
				type: "init",
				modelId: model.huggingFaceId,
				device: dispositivo,
				dtype: dtypeDe(dispositivo),
			} satisfies WorkerMessage);
		});

		this.clave = clave;
		return worker;
	}

	terminate() {
		this.worker?.terminate();
		this.worker = null;
		this.clave = null;
	}
}

export const transcriptionService = new TranscriptionService();
