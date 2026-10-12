// =============================================================================
// FFT compleja radix-2, in situ, para el análisis del audio (ritmos, ruido)
// =============================================================================
// Chica a propósito: tamaño potencia de 2, tablas precalculadas por tamaño. La
// usan la reducción de ruido (STFT ida y vuelta) y la detección de ritmos (flujo
// espectral). Sin dependencias para que corra igual en el navegador y en los
// tests de node.

export class Fft {
	readonly n: number;
	private readonly coseno: Float64Array;
	private readonly seno: Float64Array;
	private readonly inverso: Uint32Array;

	constructor(n: number) {
		if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`FFT: ${n} no es potencia de 2`);
		this.n = n;
		this.coseno = new Float64Array(n / 2);
		this.seno = new Float64Array(n / 2);
		for (let i = 0; i < n / 2; i++) {
			this.coseno[i] = Math.cos((2 * Math.PI * i) / n);
			this.seno[i] = Math.sin((2 * Math.PI * i) / n);
		}
		this.inverso = new Uint32Array(n);
		const bits = Math.log2(n);
		for (let i = 0; i < n; i++) {
			let r = 0;
			for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
			this.inverso[i] = r;
		}
	}

	/** Transforma `re`/`im` en el lugar. `inversa` incluye el 1/n. */
	transformar(re: Float64Array, im: Float64Array, inversa = false): void {
		const n = this.n;
		for (let i = 0; i < n; i++) {
			const j = this.inverso[i];
			if (j > i) {
				let t = re[i];
				re[i] = re[j];
				re[j] = t;
				t = im[i];
				im[i] = im[j];
				im[j] = t;
			}
		}
		const signo = inversa ? 1 : -1;
		for (let tam = 2; tam <= n; tam <<= 1) {
			const mitad = tam >> 1;
			const paso = n / tam;
			for (let inicio = 0; inicio < n; inicio += tam) {
				for (let k = 0; k < mitad; k++) {
					const wr = this.coseno[k * paso];
					const wi = signo * this.seno[k * paso];
					const a = inicio + k;
					const b = a + mitad;
					const tr = re[b] * wr - im[b] * wi;
					const ti = re[b] * wi + im[b] * wr;
					re[b] = re[a] - tr;
					im[b] = im[a] - ti;
					re[a] += tr;
					im[a] += ti;
				}
			}
		}
		if (inversa) {
			for (let i = 0; i < n; i++) {
				re[i] /= n;
				im[i] /= n;
			}
		}
	}
}

/** Ventana de Hann periódica (la que suma constante con solapamiento del 50 %). */
export function hann(n: number): Float64Array {
	const w = new Float64Array(n);
	for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
	return w;
}

/** Cede el hilo: los análisis largos no congelan la pantalla. */
export const ceder = () => new Promise<void>((r) => setTimeout(r, 0));
