/**
 * El resumen de la forma de onda armado DE A PEDAZOS: cada trozo de audio que llega suma sus picos y se suelta.
 *
 * Por qué (medido el 11/11/2026, docs/editor-video/memoria-del-editor.md §1): antes se leía el archivo ENTERO, se copiaba
 * y se decodificaba todo el audio de una vez, 3,6 veces lo que pesa el archivo (76 MB → +275 MB) en cada carga del
 * proyecto. Con trozos, lo que queda en memoria es el resumen (un pico cada 128 muestras) y el trozo que se está mirando.
 *
 * Da lo MISMO que `buildSourceWaveformSummary` (media/waveform-summary.ts) con el audio entero: el pico de cada balde de
 * `bucketSize` muestras, sobre todos los canales. Puro: lo prueba tests/video-editor-onda-por-tramos.test.ts.
 */
import type { SourceWaveformSummary } from "./waveform-summary";

export class PicosPorTramos {
	private picos: number[] = [];
	private total = 0;

	constructor(private readonly bucketSize: number) {}

	/**
	 * Suma un trozo: un Float32Array por canal, del mismo largo, que empieza en la muestra `inicio` de la fuente. Un hueco
	 * entre trozos queda en 0. Lo de antes de la muestra 0 (el relleno del códec) no cuenta.
	 */
	agregar(canales: readonly Float32Array[], inicio: number): void {
		const largo = canales[0]?.length ?? 0;
		const bs = this.bucketSize;
		for (let i = Math.max(0, -inicio); i < largo; i++) {
			const pos = inicio + i;
			let pico = 0;
			for (const canal of canales) {
				const v = Math.abs(canal[i] ?? 0);
				if (v > pico) pico = v;
			}
			const balde = Math.floor(pos / bs);
			while (this.picos.length <= balde) this.picos.push(0);
			if (pico > this.picos[balde]) this.picos[balde] = pico;
			if (pos + 1 > this.total) this.total = pos + 1;
		}
	}

	resumen({ sourceKey, sampleRate }: { sourceKey: string; sampleRate: number }): SourceWaveformSummary {
		const baldes = Math.max(1, Math.ceil(this.total / this.bucketSize));
		const amplitudes = new Float32Array(baldes);
		for (let b = 0; b < baldes; b++) amplitudes[b] = this.picos[b] ?? 0;
		return { sourceKey, sampleRate, totalSamples: this.total, bucketSize: this.bucketSize, amplitudes };
	}
}
