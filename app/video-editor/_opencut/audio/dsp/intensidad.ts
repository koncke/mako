// =============================================================================
// Sonoridad integrada (LUFS), ITU-R BS.1770-4 — «Normalizar la intensidad»
// =============================================================================
// CapCut normaliza a un objetivo en LUFS (−23 por defecto, −14 YouTube, −12
// TikTok) y guarda la sonoridad medida del clip (`avg_loudness`). Esto mide lo
// mismo que cualquier medidor EBU R128: filtro K (estante alto + pasa altos),
// bloques de 400 ms solapados al 75 %, compuerta absoluta de −70 LUFS y relativa
// de −10 LU.
//
// Se alimenta por TROZOS (`agregar`) con el estado de los filtros entre uno y
// otro, así un video largo se mide mientras se decodifica, sin juntarlo entero.
//
// Un clip MONO se mide como si sonara por los dos canales (así lo reproduce el
// editor): sin eso, normalizar una grabación de voz la dejaría 3 dB más fuerte
// que una música estéreo con el mismo objetivo.

/** Coeficientes del filtro K para una frecuencia de muestreo (libebur128). */
function coeficientesK(sampleRate: number) {
	// Estante alto (+4 dB arriba de ~1,7 kHz): la cabeza.
	let f0 = 1681.974450955533;
	const G = 3.999843853973347;
	let Q = 0.7071752369554196;
	let K = Math.tan((Math.PI * f0) / sampleRate);
	const Vh = 10 ** (G / 20);
	const Vb = Vh ** 0.4996667741545416;
	let a0 = 1 + K / Q + K * K;
	const estante = {
		b0: (Vh + (Vb * K) / Q + K * K) / a0,
		b1: (2 * (K * K - Vh)) / a0,
		b2: (Vh - (Vb * K) / Q + K * K) / a0,
		a1: (2 * (K * K - 1)) / a0,
		a2: (1 - K / Q + K * K) / a0,
	};
	// Pasa altos de ~38 Hz (curva RLB).
	f0 = 38.13547087602444;
	Q = 0.5003270373238773;
	K = Math.tan((Math.PI * f0) / sampleRate);
	a0 = 1 + K / Q + K * K;
	const pasaAltos = {
		b0: 1,
		b1: -2,
		b2: 1,
		a1: (2 * (K * K - 1)) / a0,
		a2: (1 - K / Q + K * K) / a0,
	};
	return { estante, pasaAltos };
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** Estado de un biquad (forma directa I) de un canal. */
class Etapa {
	private x1 = 0;
	private x2 = 0;
	private y1 = 0;
	private y2 = 0;
	constructor(private readonly c: Biquad) {}
	paso(x: number): number {
		const { b0, b1, b2, a1, a2 } = this.c;
		const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
		this.x2 = this.x1;
		this.x1 = x;
		this.y2 = this.y1;
		this.y1 = y;
		return y;
	}
}

const BLOQUE_S = 0.4;
const SALTO_S = 0.1;
const COMPUERTA_ABSOLUTA = -70;
const COMPUERTA_RELATIVA = -10;

const aLufs = (energia: number) => -0.691 + 10 * Math.log10(energia);

export class MedidorIntensidad {
	private readonly salto: number;
	private readonly porBloque: number;
	private readonly etapas: Array<[Etapa, Etapa]> = [];
	/** Energía (suma de cuadrados ya ponderada) de cada sub-bloque de 100 ms. */
	private readonly subbloques: number[] = [];
	private acumulado = 0;
	private enSubbloque = 0;
	private total = 0;
	private energiaTotal = 0;

	constructor(private readonly sampleRate: number) {
		this.salto = Math.max(1, Math.round(SALTO_S * sampleRate));
		this.porBloque = Math.round(BLOQUE_S / SALTO_S);
	}

	/** Suma un trozo (un Float32Array por canal; mono o estéreo). */
	agregar(canales: readonly Float32Array[]): void {
		if (canales.length === 0) return;
		const usados = canales.slice(0, 2);
		// Mono: el mismo canal en los dos lados (ver la cabecera).
		const peso = usados.length === 1 ? 2 : 1;
		const { estante, pasaAltos } = coeficientesK(this.sampleRate);
		while (this.etapas.length < usados.length) {
			this.etapas.push([new Etapa(estante), new Etapa(pasaAltos)]);
		}
		const largo = Math.min(...usados.map((c) => c.length));
		for (let i = 0; i < largo; i++) {
			let suma = 0;
			for (let c = 0; c < usados.length; c++) {
				const [e1, e2] = this.etapas[c];
				const y = e2.paso(e1.paso(usados[c][i]));
				suma += y * y;
			}
			suma *= peso;
			this.acumulado += suma;
			this.energiaTotal += suma;
			this.total++;
			if (++this.enSubbloque === this.salto) {
				this.subbloques.push(this.acumulado);
				this.acumulado = 0;
				this.enSubbloque = 0;
			}
		}
	}

	/** La sonoridad integrada en LUFS; `-Infinity` si es silencio. */
	resultado(): number {
		const n = this.porBloque;
		const energias: number[] = [];
		for (let i = 0; i + n <= this.subbloques.length; i++) {
			let e = 0;
			for (let k = 0; k < n; k++) e += this.subbloques[i + k];
			energias.push(e / (n * this.salto));
		}
		// Más corto que un bloque: el clip entero es UN bloque.
		if (energias.length === 0) {
			if (this.total === 0 || this.energiaTotal <= 0) return Number.NEGATIVE_INFINITY;
			energias.push(this.energiaTotal / this.total);
		}
		const sobreAbsoluta = energias.filter((e) => e > 0 && aLufs(e) > COMPUERTA_ABSOLUTA);
		if (sobreAbsoluta.length === 0) return Number.NEGATIVE_INFINITY;
		const media = sobreAbsoluta.reduce((a, b) => a + b, 0) / sobreAbsoluta.length;
		const umbral = aLufs(media) + COMPUERTA_RELATIVA;
		const sobreRelativa = sobreAbsoluta.filter((e) => aLufs(e) > umbral);
		if (sobreRelativa.length === 0) return Number.NEGATIVE_INFINITY;
		return aLufs(sobreRelativa.reduce((a, b) => a + b, 0) / sobreRelativa.length);
	}
}

/** Atajo para un búfer entero. */
export function intensidadIntegrada(canales: readonly Float32Array[], sampleRate: number): number {
	const medidor = new MedidorIntensidad(sampleRate);
	medidor.agregar(canales);
	return medidor.resultado();
}
