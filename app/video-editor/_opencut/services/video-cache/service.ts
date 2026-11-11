import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

interface VideoSinkData {
	input: Input;
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	nextFrame: WrappedCanvas | null;
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

/**
 * Cuánto tiempo DE USO sin pedirle un cuadro cierra el decodificador de un clip (≈100 MB uno de celular, medido el
 * 11/11/2026 en docs/editor-video/memoria-del-editor.md §2). Antes quedaba abierto hasta sacar el archivo del proyecto.
 */
export const DECODIFICADOR_INACTIVO_MS = 5000;
/**
 * El tiempo de uso avanza como mucho esto entre dos pedidos: con el editor quieto no corre. Si no, al volver de una
 * pausa larga se cerrarían los clips que siguen a la vista, y cada uno se reabriría en el mismo cuadro.
 */
const PASO_MAXIMO_MS = 100;
/** Cada cuánto tiempo de uso se mira qué cerrar. */
const PODA_CADA_MS = 1000;

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private frameChain = new Map<string, Promise<unknown>>();
	private seekGenerations = new Map<string, number>();

	// El tope de decodificadores abiertos (ver DECODIFICADOR_INACTIVO_MS).
	private tiempoDeUso = 0;
	private ultimoPedido = 0;
	private ultimaPoda = 0;
	private usadoEn = new Map<string, number>();
	private pedidosEnCurso = new Map<string, number>();
	private readonly inactivoMs: number;
	private readonly reloj: () => number;

	constructor({
		inactivoMs = DECODIFICADOR_INACTIVO_MS,
		reloj = () => performance.now(),
	}: { inactivoMs?: number; reloj?: () => number } = {}) {
		this.inactivoMs = inactivoMs;
		this.reloj = reloj;
	}

	async getFrameAt({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		this.marcarUso(mediaId);
		this.pedidosEnCurso.set(mediaId, (this.pedidosEnCurso.get(mediaId) ?? 0) + 1);
		try {
			return await this.pedirCuadro({ mediaId, file, time });
		} finally {
			const quedan = (this.pedidosEnCurso.get(mediaId) ?? 1) - 1;
			if (quedan > 0) this.pedidosEnCurso.set(mediaId, quedan);
			else this.pedidosEnCurso.delete(mediaId);
			this.podarInactivos();
		}
	}

	/** Cuántos decodificadores hay abiertos. */
	abiertos(): number {
		return this.sinks.size;
	}

	private marcarUso(mediaId: string): void {
		const ahora = this.reloj();
		if (this.ultimoPedido > 0) this.tiempoDeUso += Math.min(Math.max(0, ahora - this.ultimoPedido), PASO_MAXIMO_MS);
		this.ultimoPedido = ahora;
		this.usadoEn.set(mediaId, this.tiempoDeUso);
	}

	/**
	 * Cierra los decodificadores que no pidieron un cuadro en `inactivoMs` de uso: los clips que salieron de pantalla.
	 * Nunca uno con un pedido en curso, uno que se está abriendo ni uno que lee el cuadro siguiente. Si se vuelve a ese clip, se reabre solo.
	 */
	private podarInactivos(): void {
		if (this.tiempoDeUso - this.ultimaPoda < PODA_CADA_MS) return;
		this.ultimaPoda = this.tiempoDeUso;
		for (const mediaId of [...this.sinks.keys()]) {
			if (this.pedidosEnCurso.has(mediaId) || this.initPromises.has(mediaId)) continue;
			// Uno que está leyendo el cuadro siguiente tampoco: cerrarlo ahí deja un aviso «Prefetch failed».
			if (this.sinks.get(mediaId)?.prefetching) continue;
			if (this.tiempoDeUso - (this.usadoEn.get(mediaId) ?? 0) > this.inactivoMs) {
				this.clearVideo({ mediaId });
			}
		}
	}

	private async pedirCuadro({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		await this.ensureSink({ mediaId, file });

		const sinkData = this.sinks.get(mediaId);
		if (!sinkData) return null;

		const generation = (this.seekGenerations.get(mediaId) ?? 0) + 1;
		this.seekGenerations.set(mediaId, generation);

		const previous = this.frameChain.get(mediaId) ?? Promise.resolve();
		const current = previous.then(() => {
			if (this.seekGenerations.get(mediaId) !== generation) {
				return sinkData.currentFrame ?? null;
			}
			return this.resolveFrame({ sinkData, time });
		});
		this.frameChain.set(
			mediaId,
			current.catch(() => {}),
		);
		return current;
	}

	private async resolveFrame({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		if (sinkData.nextFrame && sinkData.nextFrame.timestamp <= time) {
			sinkData.currentFrame = sinkData.nextFrame;
			sinkData.nextFrame = null;
			this.startPrefetch({ sinkData });
		}

		if (
			sinkData.currentFrame &&
			this.isFrameValid({ frame: sinkData.currentFrame, time })
		) {
			if (!sinkData.nextFrame && !sinkData.prefetching) {
				this.startPrefetch({ sinkData });
			}
			return sinkData.currentFrame;
		}

		if (
			sinkData.iterator &&
			sinkData.currentFrame &&
			time >= sinkData.lastTime &&
			time < sinkData.lastTime + 2.0
		) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				if (!sinkData.nextFrame && !sinkData.prefetching) {
					this.startPrefetch({ sinkData });
				}
				return frame;
			}
		}

		const frame = await this.seekToTime({ sinkData, time });
		if (frame && !sinkData.nextFrame && !sinkData.prefetching) {
			this.startPrefetch({ sinkData });
		}
		return frame;
	}

	private isFrameValid({
		frame,
		time,
	}: {
		frame: WrappedCanvas;
		time: number;
	}): boolean {
		return time >= frame.timestamp && time < frame.timestamp + frame.duration;
	}
	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) return null;

		try {
			while (true) {
				// Wait for any pending prefetch to finish before touching iterator
				if (sinkData.prefetching && sinkData.prefetchPromise) {
					await sinkData.prefetchPromise;
				}

				// Check if the nextFrame (which might have just arrived) is what we need
				if (
					sinkData.nextFrame &&
					sinkData.nextFrame.timestamp <= targetTime + 0.05 // Tolerance
				) {
					sinkData.currentFrame = sinkData.nextFrame;
					sinkData.nextFrame = null;
				} else {
					const { value: frame, done } = await sinkData.iterator.next();

					if (done || !frame) break;

					sinkData.currentFrame = frame;
				}

				const frame = sinkData.currentFrame;
				if (!frame) break;

				sinkData.lastTime = frame.timestamp;

				if (this.isFrameValid({ frame, time: targetTime })) {
					return frame;
				}

				if (frame.timestamp > targetTime + 1.0) break;
			}
		} catch (error) {
			console.warn("Iterator failed, will restart:", error);
			sinkData.iterator = null;
		}

		return null;
	}
	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			if (sinkData.prefetching && sinkData.prefetchPromise) {
				await sinkData.prefetchPromise;
			}

			if (sinkData.iterator) {
				await sinkData.iterator.return();
				sinkData.iterator = null;
			}

			sinkData.nextFrame = null;
			sinkData.iterator = sinkData.sink.canvases(time);
			sinkData.lastTime = time;

			// Fetch current frame
			const { value: frame } = await sinkData.iterator.next();

			if (frame) {
				sinkData.currentFrame = frame;
				this.startPrefetch({ sinkData });
				return frame;
			}
		} catch (error) {
			console.warn("Failed to seek video:", error);
		}

		return null;
	}

	private startPrefetch({ sinkData }: { sinkData: VideoSinkData }): void {
		if (sinkData.prefetching || !sinkData.iterator || sinkData.nextFrame) {
			return;
		}

		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.prefetchNextFrame({ sinkData });
	}

	private async prefetchNextFrame({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		if (!sinkData.iterator) {
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			return;
		}

		try {
			const { value: frame, done } = await sinkData.iterator.next();

			if (done || !frame) {
				sinkData.prefetching = false;
				sinkData.prefetchPromise = null;
				return;
			}

			sinkData.nextFrame = frame;
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
		} catch (error) {
			console.warn("Prefetch failed:", error);
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			sinkData.iterator = null;
		}
	}
	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;

		if (this.initPromises.has(mediaId)) {
			await this.initPromises.get(mediaId);
			return;
		}

		const initPromise = this.initializeSink({ mediaId, file });
		this.initPromises.set(mediaId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(mediaId);
		}
	}
	private async initializeSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		const input = new Input({
			source: new BlobSource(file),
			formats: ALL_FORMATS,
		});

		try {
			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) {
				throw new Error("No video track found");
			}

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) {
				throw new Error("Video codec not supported for decoding");
			}

			const sink = new CanvasSink(videoTrack, {
				poolSize: 3,
				fit: "contain",
			});

			this.sinks.set(mediaId, {
				input,
				sink,
				iterator: null,
				currentFrame: null,
				nextFrame: null,
				lastTime: -1,
				prefetching: false,
				prefetchPromise: null,
			});
		} catch (error) {
			input.dispose();
			console.error(`Failed to initialize video sink for ${mediaId}:`, error);
			throw error;
		}
	}

	clearVideo({ mediaId }: { mediaId: string }): void {
		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}

			sinkData.input.dispose();
			this.sinks.delete(mediaId);
		}

		this.initPromises.delete(mediaId);
		this.frameChain.delete(mediaId);
		this.seekGenerations.delete(mediaId);
		this.usadoEn.delete(mediaId);
	}

	clearAll(): void {
		for (const [mediaId] of this.sinks) {
			this.clearVideo({ mediaId });
		}
	}

	/**
	 * Cuántas exportaciones están corriendo. Mientras haya una, nadie suelta los decodificadores del ORIGINAL: los está
	 * leyendo (core/managers/media-manager.ts, al llegar una copia liviana).
	 */
	private exportaciones = 0;

	empezarExportacion(): void {
		this.exportaciones++;
	}

	terminarExportacion(): void {
		this.exportaciones = Math.max(0, this.exportaciones - 1);
	}

	estaExportando(): boolean {
		return this.exportaciones > 0;
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
			activeSinks: Array.from(this.sinks.values()).filter((s) => s.iterator)
				.length,
			cachedFrames: Array.from(this.sinks.values()).filter(
				(s) => s.currentFrame,
			).length,
		};
	}
}

export const videoCache = new VideoCache();
