"use client";

import { createAudioContext } from "@/app/video-editor/_opencut/media/audio";
import {
	buildSourceWaveformSummary,
	type SourceWaveformSummary,
} from "@/app/video-editor/_opencut/media/waveform-summary";
import { ondaPorTramos } from "@/app/video-editor/_opencut/media/onda-por-tramos";

interface GetSourceWaveformSummaryArgs {
	sourceKey: string;
	audioBuffer?: AudioBuffer;
	sourceFile?: File;
	audioUrl?: string;
}

export class WaveformCache {
	private summaries = new Map<string, Promise<SourceWaveformSummary>>();

	getSourceSummary({
		sourceKey,
		audioBuffer,
		sourceFile,
		audioUrl,
	}: GetSourceWaveformSummaryArgs): Promise<SourceWaveformSummary> {
		const existing = this.summaries.get(sourceKey);
		if (existing) {
			return existing;
		}

		const promise = this.buildSummary({
			sourceKey,
			audioBuffer,
			sourceFile,
			audioUrl,
		}).catch((error) => {
			this.summaries.delete(sourceKey);
			throw error;
		});

		this.summaries.set(sourceKey, promise);
		return promise;
	}

	clearSource({ sourceKey }: { sourceKey: string }): void {
		this.summaries.delete(sourceKey);
	}

	clearAll(): void {
		this.summaries.clear();
	}

	private async buildSummary({
		sourceKey,
		audioBuffer,
		sourceFile,
		audioUrl,
	}: GetSourceWaveformSummaryArgs): Promise<SourceWaveformSummary> {
		if (audioBuffer) {
			return buildSourceWaveformSummary({ sourceKey, buffer: audioBuffer });
		}

		// Un archivo se lee DE A TROZOS (media/onda-por-tramos.ts): leerlo entero pedía 3,6 veces lo que pesa en cada carga
		// del proyecto (docs/editor-video/memoria-del-editor.md §1). Lo de abajo queda para lo que mediabunny no lee y para
		// la música de biblioteca (una URL chica).
		if (sourceFile) {
			const porTramos = await ondaPorTramos({ sourceKey, file: sourceFile });
			if (porTramos.estado === "listo") return porTramos.resumen;
			if (porTramos.estado === "sin-audio") {
				throw new Error(`No audio track for waveform: ${sourceKey}`);
			}
		}

		let arrayBuffer: ArrayBuffer | null = null;
		if (sourceFile) {
			arrayBuffer = await sourceFile.arrayBuffer();
		} else if (audioUrl) {
			const response = await fetch(audioUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch waveform source: ${response.status}`);
			}
			arrayBuffer = await response.arrayBuffer();
		}

		if (!arrayBuffer) {
			throw new Error(`No waveform source available for ${sourceKey}`);
		}

		const audioContext = createAudioContext();
		try {
			const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
			return buildSourceWaveformSummary({ sourceKey, buffer });
		} finally {
			void audioContext.close();
		}
	}
}

export const waveformCache = new WaveformCache();
