import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { clampRetimeRate, shouldMaintainPitch } from "@/app/video-editor/_opencut/retime/rate";
import type { AudioClipSource } from "@/app/video-editor/_opencut/media/audio";
import { createAudioContext, collectAudioClips } from "@/app/video-editor/_opencut/media/audio";
import {
	buildAudioGainAutomation,
	hasAnimatedVolume,
} from "@/app/video-editor/_opencut/timeline/audio-state";
import { createAudioMasteringChain } from "@/app/video-editor/_opencut/media/audio-mastering";
import {
	getClipTimeAtSourceTime,
	getSourceTimeAtClipTime,
	renderRetimedBuffer,
} from "@/app/video-editor/_opencut/retime";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";
import {
	claveProcesado,
	leerFundidos,
	puntosFundido,
	tieneFundidos,
} from "@/app/video-editor/_opencut/audio/claves";
import { procesarClip } from "@/app/video-editor/_opencut/audio/cadena";

// Lo que suma el paquete de audio (J) a la reproducción de OpenCut:
//
// · FUNDIDOS: cada clip con «Aparición/Desaparición progresiva» suena a través
//   de un GainNode propio («envolvente») con rampas lineales entre los puntos de
//   `puntosFundido`, la MISMA cuenta que hace la mezcla del export muestra a
//   muestra (media/audio.ts). Vale para los dos caminos (por trozos y preparado).
// · PROCESADO: reducir el ruido y el modificador de voz obligan a preparar el
//   clip entero (`procesarClip`, audio/cadena.ts, también la del export).
// · CACHÉS: un cambio cualquiera en la línea de tiempo (mover un texto) ya no
//   tira lo decodificado ni lo procesado: las claves dicen qué sirve, y lo que
//   ningún clip usa se poda al reproducir. Procesar la voz de un clip de un
//   minuto tarda; rehacerlo en cada cambio dejaba la reproducción muda un rato.
// · VISTA PREVIA: mientras se arrastra (volumen, un fundido, una perilla) la
//   línea notifica cada movimiento; reiniciar el audio en cada uno se oía como
//   un tartamudeo. Se espera a que se confirme.

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private lookaheadSeconds = 2;
	private scheduleIntervalMs = 500;
	private clips: AudioClipSource[] = [];
	private sinks = new Map<string, AudioBufferSink>();
	private inputs = new Map<string, Input>();
	private activeClipIds = new Set<string>();
	private clipIterators = new Map<
		string,
		AsyncGenerator<WrappedAudioBuffer, void, unknown>
	>();
	private queuedSources = new Set<AudioBufferSourceNode>();
	private preparedClipBuffers = new Map<string, Promise<AudioBuffer | null>>();
	private decodedBuffers = new Map<string, Promise<AudioBuffer | null>>();
	/** El GainNode de los fundidos de cada clip, en esta sesión de reproducción. */
	private envolventes = new Map<string, GainNode>();
	private prepararTimer: number | null = null;
	private playbackSessionId = 0;
	private lastIsPlaying = false;
	private lastVolume = 1;
	private playbackLatencyCompensationSeconds = 0;
	private unsubscribers: Array<() => void> = [];

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
			this.editor.playback.onSeek(this.handleSeek),
		);
	}

	dispose(): void {
		if (this.prepararTimer !== null && typeof window !== "undefined") {
			window.clearTimeout(this.prepararTimer);
		}
		this.stopPlayback();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.disposeSinks();
		this.preparedClipBuffers.clear();
		this.decodedBuffers.clear();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
			this.masterGain = null;
		}
	}

	private handlePlaybackChange = (): void => {
		const isPlaying = this.editor.playback.getIsPlaying();
		const volume = this.editor.playback.getVolume();

		if (volume !== this.lastVolume) {
			this.lastVolume = volume;
			this.updateGain();
		}

		if (isPlaying !== this.lastIsPlaying) {
			this.lastIsPlaying = isPlaying;
			if (isPlaying) {
				void this.startPlayback({
					time: this.editor.playback.getCurrentTime() / TICKS_PER_SECOND,
				});
			} else {
				this.stopPlayback();
			}
		}
	};

	private handleSeek = (time: number): void => {
		if (this.editor.playback.getIsScrubbing()) {
			this.stopPlayback();
			return;
		}

		if (this.editor.playback.getIsPlaying()) {
			void this.startPlayback({ time: time / TICKS_PER_SECOND });
			return;
		}

		this.stopPlayback();
	};

	private handleTimelineChange = (): void => {
		// Durante una vista previa (arrastrar) no se reinicia: llega la
		// confirmación y ahí sí (ver la cabecera).
		if (this.editor.timeline.isPreviewActive()) return;
		this.disposeSinks();

		if (!this.editor.playback.getIsPlaying()) {
			this.programarPreparacion();
			return;
		}

		void this.startPlayback({
			time: this.editor.playback.getCurrentTime() / TICKS_PER_SECOND,
		});
	};

	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof window === "undefined") return null;

		this.audioContext = createAudioContext();
		const { input } = createAudioMasteringChain({
			audioContext: this.audioContext,
			destination: this.audioContext.destination,
		});
		this.masterGain = input;
		this.masterGain.gain.value = this.lastVolume;
		return this.audioContext;
	}

	private updateGain(): void {
		if (!this.masterGain) return;
		this.masterGain.gain.value = this.lastVolume;
	}

	private getPlaybackTime(): number {
		if (!this.audioContext) return this.playbackStartTime;
		const elapsed =
			this.audioContext.currentTime - this.playbackStartContextTime;
		return this.playbackStartTime + elapsed;
	}

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		this.playbackSessionId++;
		this.playbackLatencyCompensationSeconds = 0;

		const tracks = this.editor.scenes.getActiveScene().tracks;
		const mediaAssets = this.editor.media.getAssets();
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}

		this.clips = await collectAudioClips({ tracks, mediaAssets });
		if (!this.editor.playback.getIsPlaying()) return;
		this.podarCaches();

		this.playbackStartTime = time;
		this.playbackStartContextTime = audioContext.currentTime;

		this.scheduleUpcomingClips();

		if (typeof window !== "undefined") {
			this.scheduleTimer = window.setInterval(() => {
				this.scheduleUpcomingClips();
			}, this.scheduleIntervalMs);
		}
	}

	private scheduleUpcomingClips(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const currentTime = this.getPlaybackTime();
		const windowEnd = currentTime + this.lookaheadSeconds;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (this.activeClipIds.has(clip.id)) continue;

			const clipEnd = clip.startTime + clip.duration;
			if (clipEnd <= currentTime) continue;
			if (clip.startTime > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			if (this.shouldUsePreparedClipBuffer({ clip })) {
				void this.schedulePreparedClip({
					clip,
					startTime: currentTime,
					sessionId: this.playbackSessionId,
				});
			} else {
				void this.runClipIterator({
					clip,
					startTime: currentTime,
					sessionId: this.playbackSessionId,
				});
			}
		}
	}

	private stopPlayback(): void {
		if (this.scheduleTimer && typeof window !== "undefined") {
			window.clearInterval(this.scheduleTimer);
		}
		this.scheduleTimer = null;

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const source of this.queuedSources) {
			try {
				source.stop();
			} catch {}
			source.disconnect();
		}
		this.queuedSources.clear();

		for (const envolvente of this.envolventes.values()) envolvente.disconnect();
		this.envolventes.clear();
	}

	/**
	 * A dónde se conecta el sonido de un clip: su envolvente de fundidos, o el
	 * master si no tiene. Hay UNA envolvente por clip y sesión, programada desde
	 * el instante del clip en que empieza a sonar. Si el clip se vuelve a
	 * programar en la misma sesión (el re-sincronizado de `runClipIterator`
	 * cuando sube la compensación de latencia), se reprograma: las rampas viejas
	 * quedaban corridas lo que se corrió el audio.
	 */
	private destinoDelClip({
		audioContext,
		clip,
		desdeLocal,
	}: {
		audioContext: AudioContext;
		clip: AudioClipSource;
		desdeLocal: number;
	}): AudioNode {
		const master = this.masterGain ?? audioContext.destination;
		const fundidos = leerFundidos(clip.timelineElement.params, clip.duration);
		if (!tieneFundidos(fundidos)) return master;
		let envolvente = this.envolventes.get(clip.id);
		if (envolvente) {
			envolvente.gain.cancelScheduledValues(0);
		} else {
			envolvente = audioContext.createGain();
			envolvente.connect(master);
			this.envolventes.set(clip.id, envolvente);
		}
		const aContexto = (local: number) =>
			this.playbackStartContextTime +
			this.playbackLatencyCompensationSeconds +
			(clip.startTime + local - this.playbackStartTime);
		// Desde lo que va a sonar primero: el instante pedido o, si preparar el
		// clip tardó y ese instante ya pasó, el de AHORA. Así todos los puntos
		// quedan en el futuro y el factor de partida es el exacto.
		const ahoraLocal = audioContext.currentTime - aContexto(0);
		const desde = Math.max(0, desdeLocal, ahoraLocal);
		const [primero, ...resto] = puntosFundido(desde, clip.duration, fundidos);
		if (!primero) return envolvente;
		envolvente.gain.setValueAtTime(primero.factor, aContexto(primero.t));
		for (const punto of resto) {
			envolvente.gain.linearRampToValueAtTime(punto.factor, aContexto(punto.t));
		}
		return envolvente;
	}

	private async runClipIterator({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		const sink = await this.getAudioSink({ clip });
		if (!sink || !this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;
		const playbackTimeAfterSinkReady = this.getPlaybackTime();
		const iteratorStartTime = Math.max(
			startTime,
			clipStart,
			playbackTimeAfterSinkReady,
		);
		if (iteratorStartTime >= clipEnd) {
			return;
		}
		const sourceStartTime =
			clip.trimStart +
			getSourceTimeAtClipTime({
				clipTime: iteratorStartTime - clip.startTime,
				retime: clip.retime,
			});

		const iterator = sink.buffers(sourceStartTime);
		this.clipIterators.set(clip.id, iterator);
		let consecutiveDroppedBufferCount = 0;
		const destino = this.destinoDelClip({
			audioContext,
			clip,
			desdeLocal: iteratorStartTime - clip.startTime,
		});

		for await (const { buffer, timestamp } of iterator) {
			if (!this.editor.playback.getIsPlaying()) return;
			if (sessionId !== this.playbackSessionId) return;

			const timelineTime =
				clip.startTime +
				getClipTimeAtSourceTime({
					sourceTime: timestamp - clip.trimStart,
					retime: clip.retime,
				});
			if (timelineTime >= clipEnd) break;

			const node = audioContext.createBufferSource();
			node.buffer = buffer;
			if (clip.retime) {
				node.playbackRate.value = clampRetimeRate({ rate: clip.retime.rate });
			}
			const clipGain = audioContext.createGain();
			clipGain.gain.value = clip.volume;
			node.connect(clipGain);
			clipGain.connect(destino);

			const startTimestamp =
				this.playbackStartContextTime +
				this.playbackLatencyCompensationSeconds +
				(timelineTime - this.playbackStartTime);

			if (startTimestamp >= audioContext.currentTime) {
				node.start(startTimestamp);
				consecutiveDroppedBufferCount = 0;
			} else {
				const offset = audioContext.currentTime - startTimestamp;
				if (offset < buffer.duration) {
					node.start(audioContext.currentTime, offset);
					consecutiveDroppedBufferCount = 0;
				} else {
					consecutiveDroppedBufferCount += 1;
					if (consecutiveDroppedBufferCount >= 5) {
						const nextCompensationSeconds = Math.max(
							this.playbackLatencyCompensationSeconds,
							Math.min(0.25, offset + 0.01),
						);
						if (
							nextCompensationSeconds >
							this.playbackLatencyCompensationSeconds + 0.001
						) {
							this.playbackLatencyCompensationSeconds = nextCompensationSeconds;
						}
						const resyncStartTime = this.getPlaybackTime();
						this.clipIterators.delete(clip.id);
						void this.runClipIterator({
							clip,
							startTime: resyncStartTime,
							sessionId,
						});
						return;
					}
					continue;
				}
			}

			this.queuedSources.add(node);
			node.addEventListener("ended", () => {
				node.disconnect();
				clipGain.disconnect();
				this.queuedSources.delete(node);
			});

			const aheadTime = timelineTime - this.getPlaybackTime();
			if (aheadTime >= 1) {
				await this.waitUntilCaughtUp({ timelineTime, targetAhead: 1 });
				if (sessionId !== this.playbackSessionId) return;
			}
		}

		this.clipIterators.delete(clip.id);
		// don't remove from activeClipIds - prevents scheduler from restarting this clip
		// the set is cleared on stopPlayback anyway
	}

	private async schedulePreparedClip({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		const buffer = await this.getPreparedClipBuffer({ clip });
		if (!buffer || !this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;
		const playbackTimeAfterReady = this.getPlaybackTime();
		const effectiveStartTime = Math.max(
			startTime,
			clipStart,
			playbackTimeAfterReady,
		);
		if (effectiveStartTime >= clipEnd) {
			return;
		}

		const node = audioContext.createBufferSource();
		node.buffer = buffer;
		const clipGain = audioContext.createGain();
		node.connect(clipGain);
		clipGain.connect(
			this.destinoDelClip({
				audioContext,
				clip,
				desdeLocal: effectiveStartTime - clipStart,
			}),
		);

		const startTimestamp =
			this.playbackStartContextTime +
			this.playbackLatencyCompensationSeconds +
			(effectiveStartTime - this.playbackStartTime);
		const clipOffset = effectiveStartTime - clipStart;
		let actualStartTimestamp = startTimestamp;
		let actualClipOffset = clipOffset;

		if (startTimestamp >= audioContext.currentTime) {
			node.start(startTimestamp, clipOffset);
		} else {
			const lateOffset = audioContext.currentTime - startTimestamp;
			actualStartTimestamp = audioContext.currentTime;
			actualClipOffset = clipOffset + lateOffset;
			node.start(actualStartTimestamp, actualClipOffset);
		}

		this.scheduleClipGainAutomation({
			audioContext,
			clip,
			clipGain,
			startTimestamp: actualStartTimestamp,
			startLocalTime: actualClipOffset,
		});

		this.queuedSources.add(node);
		node.addEventListener("ended", () => {
			node.disconnect();
			clipGain.disconnect();
			this.queuedSources.delete(node);
		});
	}

	private waitUntilCaughtUp({
		timelineTime,
		targetAhead,
	}: {
		timelineTime: number;
		targetAhead: number;
	}): Promise<void> {
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (!this.editor.playback.getIsPlaying()) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				const playbackTime = this.getPlaybackTime();
				if (timelineTime - playbackTime < targetAhead) {
					clearInterval(checkInterval);
					resolve();
				}
			}, 100);
		});
	}

	private disposeSinks(): void {
		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();

		for (const input of this.inputs.values()) {
			input.dispose();
		}
		this.inputs.clear();
		this.sinks.clear();
	}

	private shouldUsePreparedClipBuffer({
		clip,
	}: {
		clip: AudioClipSource;
	}): boolean {
		return (
			this.hasCurveRetime({ clip }) ||
			claveProcesado(clip.timelineElement.params) !== null ||
			hasAnimatedVolume({ element: clip.timelineElement }) ||
			shouldMaintainPitch({
				rate: clip.retime?.rate ?? 1,
				maintainPitch: clip.retime?.maintainPitch,
			})
		);
	}

	private hasCurveRetime({ clip }: { clip: AudioClipSource }): boolean {
		const mode = (clip.retime as { mode?: unknown } | undefined)?.mode;
		return mode === "curve";
	}

	private scheduleClipGainAutomation({
		audioContext,
		clip,
		clipGain,
		startTimestamp,
		startLocalTime,
	}: {
		audioContext: AudioContext;
		clip: AudioClipSource;
		clipGain: GainNode;
		startTimestamp: number;
		startLocalTime: number;
	}): void {
		clipGain.gain.cancelScheduledValues(startTimestamp);
		clipGain.gain.setValueAtTime(clip.volume, startTimestamp);

		if (!hasAnimatedVolume({ element: clip.timelineElement })) {
			return;
		}

		const points = buildAudioGainAutomation({
			element: clip.timelineElement,
			fromLocalTime: startLocalTime,
			toLocalTime: clip.duration,
		});

		if (points.length === 0) {
			return;
		}

		clipGain.gain.setValueAtTime(points[0].gain, startTimestamp);
		for (let index = 1; index < points.length; index++) {
			const point = points[index];
			const pointTimestamp =
				startTimestamp + (point.localTime - startLocalTime);
			if (pointTimestamp < audioContext.currentTime) {
				continue;
			}

			clipGain.gain.linearRampToValueAtTime(point.gain, pointTimestamp);
		}
	}

	private buildPreparedClipCacheKey({
		clip,
	}: {
		clip: AudioClipSource;
	}): string {
		// Sin el id ni el inicio del clip (OpenCut los ponía): el búfer está en el
		// tiempo DEL CLIP y no depende de dónde cae. Con ellos, mover un clip con
		// modificador de voz lo volvía a procesar y quedaba mudo mientras tanto.
		return JSON.stringify({
			sourceKey: clip.sourceKey,
			duration: clip.duration,
			trimStart: clip.trimStart,
			trimEnd: clip.trimEnd,
			retime: clip.retime ?? null,
			procesado: claveProcesado(clip.timelineElement.params),
		});
	}

	private async getPreparedClipBuffer({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBuffer | null> {
		const cacheKey = this.buildPreparedClipCacheKey({ clip });
		const existing = this.preparedClipBuffers.get(cacheKey);
		if (existing) {
			return existing;
		}

		const promise = (async () => {
			const audioContext = this.ensureAudioContext();
			if (!audioContext) {
				return null;
			}

			const decodedBuffer = await this.getDecodedBuffer({ clip });
			if (!decodedBuffer) {
				return null;
			}

			const enSuTiempo = await renderRetimedBuffer({
				audioContext,
				sourceBuffer: decodedBuffer,
				trimStart: clip.trimStart,
				clipDuration: clip.duration,
				retime: clip.retime,
				maintainPitch: clip.retime?.maintainPitch === true,
			});
			return await procesarClip({
				buffer: enSuTiempo,
				params: clip.timelineElement.params,
			});
		})().catch((error) => {
			// Que un clip que no se pudo procesar no tumbe la reproducción: queda
			// mudo y se reintenta con el próximo cambio (la caché lo suelta).
			console.warn("[audio] no se pudo preparar el clip", error);
			this.preparedClipBuffers.delete(cacheKey);
			return null;
		});

		this.preparedClipBuffers.set(cacheKey, promise);
		return promise;
	}

	private async getDecodedBuffer({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBuffer | null> {
		const existing = this.decodedBuffers.get(clip.sourceKey);
		if (existing) {
			return existing;
		}

		const promise = this.decodeClipBuffer({ clip });
		this.decodedBuffers.set(clip.sourceKey, promise);
		return promise;
	}

	private async decodeClipBuffer({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBuffer | null> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) {
			return null;
		}

		const input = new Input({
			source: new BlobSource(clip.file),
			formats: ALL_FORMATS,
		});

		try {
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			const chunks: AudioBuffer[] = [];
			let totalSamples = 0;

			for await (const { buffer } of sink.buffers(0)) {
				chunks.push(buffer);
				totalSamples += buffer.length;
			}

			if (chunks.length === 0) {
				return null;
			}

			const targetSampleRate = audioContext.sampleRate;
			const nativeSampleRate = chunks[0].sampleRate;
			const numChannels = Math.min(2, chunks[0].numberOfChannels);
			const nativeChannels = Array.from(
				{ length: numChannels },
				() => new Float32Array(totalSamples),
			);

			let offset = 0;
			for (const chunk of chunks) {
				for (let channel = 0; channel < numChannels; channel++) {
					nativeChannels[channel].set(
						chunk.getChannelData(Math.min(channel, chunk.numberOfChannels - 1)),
						offset,
					);
				}
				offset += chunk.length;
			}

			const outputSamples = Math.ceil(
				totalSamples * (targetSampleRate / nativeSampleRate),
			);
			const offlineContext = new OfflineAudioContext(
				numChannels,
				outputSamples,
				targetSampleRate,
			);
			const nativeBuffer = audioContext.createBuffer(
				numChannels,
				totalSamples,
				nativeSampleRate,
			);

			for (let channel = 0; channel < numChannels; channel++) {
				nativeBuffer.copyToChannel(nativeChannels[channel], channel);
			}

			const sourceNode = offlineContext.createBufferSource();
			sourceNode.buffer = nativeBuffer;
			sourceNode.connect(offlineContext.destination);
			sourceNode.start(0);

			return await offlineContext.startRendering();
		} catch (error) {
			console.warn("Failed to decode clip audio:", error);
			return null;
		} finally {
			input.dispose();
		}
	}

	/** Suelta lo decodificado y lo preparado que ya no usa ningún clip. */
	private podarCaches(clips: AudioClipSource[] = this.clips): void {
		const claves = new Set(clips.map((clip) => this.buildPreparedClipCacheKey({ clip })));
		for (const clave of [...this.preparedClipBuffers.keys()]) {
			if (!claves.has(clave)) this.preparedClipBuffers.delete(clave);
		}
		const fuentes = new Set(
			clips
				.filter((clip) => this.shouldUsePreparedClipBuffer({ clip }))
				.map((clip) => clip.sourceKey),
		);
		for (const clave of [...this.decodedBuffers.keys()]) {
			if (!fuentes.has(clave)) this.decodedBuffers.delete(clave);
		}
	}

	/**
	 * Con la reproducción parada, procesa de antemano los clips con voz o sin
	 * ruido que cambiaron: al darle play ya están listos. Espera a que se dejen
	 * de tocar las perillas.
	 */
	private programarPreparacion(): void {
		if (typeof window === "undefined") return;
		if (this.prepararTimer !== null) window.clearTimeout(this.prepararTimer);
		this.prepararTimer = window.setTimeout(() => {
			this.prepararTimer = null;
			void this.prepararProcesados();
		}, 600);
	}

	private async prepararProcesados(): Promise<void> {
		const escena = this.editor.scenes.getActiveSceneOrNull();
		if (!escena || this.editor.playback.getIsPlaying()) return;
		const tracks = escena.tracks;
		const conProceso = [...tracks.overlay, tracks.main, ...tracks.audio].some((track) =>
			track.elements.some(
				(element) =>
					(element.type === "audio" || element.type === "video") &&
					claveProcesado(element.params) !== null,
			),
		);
		if (!conProceso) return;
		const clips = await collectAudioClips({
			tracks,
			mediaAssets: this.editor.media.getAssets(),
		});
		// Lo de una perilla anterior ya no sirve: sin podar acá, mover el Tono
		// cinco veces dejaría cinco copias del clip procesado en memoria.
		if (!this.editor.playback.getIsPlaying()) this.podarCaches(clips);
		for (const clip of clips) {
			if (this.editor.playback.getIsPlaying()) return;
			if (clip.muted || claveProcesado(clip.timelineElement.params) === null) continue;
			await this.getPreparedClipBuffer({ clip });
		}
	}

	private async getAudioSink({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBufferSink | null> {
		const existingSink = this.sinks.get(clip.sourceKey);
		if (existingSink) return existingSink;

		try {
			const input = new Input({
				source: new BlobSource(clip.file),
				formats: ALL_FORMATS,
			});
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				input.dispose();
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			this.inputs.set(clip.sourceKey, input);
			this.sinks.set(clip.sourceKey, sink);
			return sink;
		} catch (error) {
			console.warn("Failed to initialize audio sink:", error);
			return null;
		}
	}
}
