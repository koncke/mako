// =============================================================================
// «Marcar ritmos automáticamente»: los golpes de una música, en el navegador
// =============================================================================
// CapCut trae los ritmos PRECALCULADOS en su servidor para la música de su
// biblioteca (`ai_beats.beats_url`); para un audio propio los calcula él. Acá se
// calcula todo en el navegador, con el método clásico (Ellis 2007, el de
// librosa):
//
//   1. envolvente de ataques: flujo espectral (lo que SUBE el espectro en escala
//      logarítmica de un cuadro al siguiente), sin su media local y normalizada;
//   2. tempo: el retardo con más autocorrelación de esa envolvente, ponderado
//      por una campana (en octavas) alrededor de 120 BPM, que es lo que evita
//      elegir el doble o la mitad;
//   3. pulsos: programación dinámica que premia caer en un ataque y castiga
//      alejarse del período del tempo.
//
// «Ritmo 2» son todos los pulsos; «Ritmo 1», uno cada dos (la fase con ataques
// más fuertes), como los dos niveles de CapCut (`beat_metre_1/2`).
//
// Devuelve segundos desde el principio de las muestras recibidas.

import { Fft, ceder } from "./fft";

const TASA_ANALISIS = 22050;
const VENTANA = 1024;
const SALTO = 256;
const BPM_CENTRO = 120;
const BPM_MIN = 50;
const BPM_MAX = 220;
/** Ancho de la campana del tempo, en octavas. */
const SIGMA_TEMPO = 0.9;
/** Qué tanto castiga la programación dinámica salirse del período. */
const RIGIDEZ = 100;

export type Ritmos = { ritmo1: number[]; ritmo2: number[]; bpm: number };

/** Mezcla a mono y baja a ~22 kHz promediando (el análisis no necesita más). */
export function aMonoAnalisis(canales: readonly Float32Array[], sampleRate: number): { muestras: Float32Array; tasa: number } {
	const factor = Math.max(1, Math.round(sampleRate / TASA_ANALISIS));
	const largo = Math.floor((canales[0]?.length ?? 0) / factor);
	const muestras = new Float32Array(largo);
	for (let i = 0; i < largo; i++) {
		let v = 0;
		for (let k = 0; k < factor; k++) for (const c of canales) v += c[i * factor + k];
		muestras[i] = v / (factor * canales.length);
	}
	return { muestras, tasa: sampleRate / factor };
}

/**
 * Lo mismo que `aMonoAnalisis` pero por TROZOS, como llegan del decodificador:
 * guarda el resto de un trozo para el siguiente (si no, cada borde perdería
 * muestras y los ritmos se irían corriendo a lo largo de la canción) y nunca
 * junta el audio a la tasa original (diez minutos a 48 kHz son 115 MB en mono).
 */
export class AcumuladorAnalisis {
	private factor = 0;
	private tasaOriginal = 0;
	private suma = 0;
	private cuantas = 0;
	private bloques: Float32Array[] = [];
	private actual = new Float32Array(1 << 16);
	private enActual = 0;

	agregar(canales: readonly Float32Array[], sampleRate: number): void {
		if (canales.length === 0) return;
		if (this.factor === 0) {
			this.tasaOriginal = sampleRate;
			this.factor = Math.max(1, Math.round(sampleRate / TASA_ANALISIS));
		}
		const largo = Math.min(...canales.map((c) => c.length));
		const n = canales.length * this.factor;
		for (let i = 0; i < largo; i++) {
			for (const c of canales) this.suma += c[i];
			if (++this.cuantas === this.factor) {
				this.actual[this.enActual++] = this.suma / n;
				this.suma = 0;
				this.cuantas = 0;
				if (this.enActual === this.actual.length) {
					this.bloques.push(this.actual);
					this.actual = new Float32Array(this.actual.length);
					this.enActual = 0;
				}
			}
		}
	}

	resultado(): { muestras: Float32Array; tasa: number } {
		const total = this.bloques.length * this.actual.length + this.enActual;
		const muestras = new Float32Array(total);
		let pos = 0;
		for (const b of this.bloques) {
			muestras.set(b, pos);
			pos += b.length;
		}
		muestras.set(this.actual.subarray(0, this.enActual), pos);
		return { muestras, tasa: this.factor > 0 ? this.tasaOriginal / this.factor : TASA_ANALISIS };
	}
}

async function envolventeAtaques(muestras: Float32Array, tasa: number): Promise<Float64Array> {
	const fft = new Fft(VENTANA);
	const ventana = new Float64Array(VENTANA);
	for (let i = 0; i < VENTANA; i++) ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / VENTANA);
	const cuadros = Math.max(0, Math.floor((muestras.length - VENTANA) / SALTO) + 1);
	// Hasta ~8 kHz: arriba hay más ruido que golpes.
	const bandas = Math.min(VENTANA / 2, Math.round((8000 / tasa) * VENTANA));
	const re = new Float64Array(VENTANA);
	const im = new Float64Array(VENTANA);
	let previo = new Float64Array(bandas);
	let actual = new Float64Array(bandas);
	const flujo = new Float64Array(cuadros);
	for (let f = 0; f < cuadros; f++) {
		const ini = f * SALTO;
		for (let i = 0; i < VENTANA; i++) {
			re[i] = muestras[ini + i] * ventana[i];
			im[i] = 0;
		}
		fft.transformar(re, im);
		let suma = 0;
		for (let b = 1; b < bandas; b++) {
			actual[b] = Math.log1p(100 * Math.hypot(re[b], im[b]));
			const d = actual[b] - previo[b];
			if (d > 0 && f > 0) suma += d;
		}
		flujo[f] = suma;
		[previo, actual] = [actual, previo];
		if (f % 2000 === 1999) await ceder();
	}
	// Sin la media local (~0,5 s): lo que importa es el golpe, no el volumen.
	const medio = Math.round((0.25 * tasa) / SALTO);
	const ataques = new Float64Array(cuadros);
	let acumulado = 0;
	const prefijo = new Float64Array(cuadros + 1);
	for (let i = 0; i < cuadros; i++) {
		acumulado += flujo[i];
		prefijo[i + 1] = acumulado;
	}
	for (let i = 0; i < cuadros; i++) {
		const a = Math.max(0, i - medio);
		const b = Math.min(cuadros, i + medio + 1);
		ataques[i] = Math.max(0, flujo[i] - (prefijo[b] - prefijo[a]) / (b - a));
	}
	let media = 0;
	for (const v of ataques) media += v;
	media /= Math.max(1, cuadros);
	let varianza = 0;
	for (const v of ataques) varianza += (v - media) ** 2;
	const desvio = Math.sqrt(varianza / Math.max(1, cuadros));
	if (desvio > 0) for (let i = 0; i < cuadros; i++) ataques[i] /= desvio;
	return ataques;
}

/** El período en cuadros (fraccionario). */
function estimarPeriodo(ataques: Float64Array, cuadrosPorSegundo: number): number {
	const centro = (60 / BPM_CENTRO) * cuadrosPorSegundo;
	const desde = Math.max(2, Math.floor((60 / BPM_MAX) * cuadrosPorSegundo));
	const hasta = Math.min(ataques.length - 1, Math.ceil((60 / BPM_MIN) * cuadrosPorSegundo));
	const r = new Float64Array(hasta + 2);
	for (let lag = desde - 1; lag <= hasta + 1 && lag < ataques.length; lag++) {
		let s = 0;
		for (let i = lag; i < ataques.length; i++) s += ataques[i] * ataques[i - lag];
		r[lag] = s / (ataques.length - lag);
	}
	let mejor = desde;
	let mejorValor = Number.NEGATIVE_INFINITY;
	for (let lag = desde; lag <= hasta; lag++) {
		const peso = Math.exp(-0.5 * (Math.log2(lag / centro) / SIGMA_TEMPO) ** 2);
		const v = r[lag] * peso;
		if (v > mejorValor) {
			mejorValor = v;
			mejor = lag;
		}
	}
	// Interpolación parabólica del pico: el período no es un número entero de cuadros.
	const a = r[mejor - 1] ?? 0;
	const b = r[mejor];
	const c = r[mejor + 1] ?? 0;
	const den = a - 2 * b + c;
	const ajuste = den !== 0 ? (0.5 * (a - c)) / den : 0;
	return mejor + (Math.abs(ajuste) < 1 ? ajuste : 0);
}

function seguirPulsos(ataques: Float64Array, periodo: number): number[] {
	const n = ataques.length;
	const puntaje = new Float64Array(n);
	const anterior = new Int32Array(n).fill(-1);
	const desde = Math.round(periodo / 2);
	const hasta = Math.round(2 * periodo);
	for (let t = 0; t < n; t++) {
		let mejor = 0;
		let cual = -1;
		for (let p = t - hasta; p <= t - desde; p++) {
			if (p < 0) continue;
			const desvio = Math.log((t - p) / periodo);
			const v = puntaje[p] - RIGIDEZ * desvio * desvio;
			if (cual === -1 || v > mejor) {
				mejor = v;
				cual = p;
			}
		}
		puntaje[t] = ataques[t] + (cual >= 0 ? mejor : 0);
		anterior[t] = cual;
	}
	// El último pulso: el mejor puntaje del último período.
	let fin = n - 1;
	for (let t = Math.max(0, n - Math.round(periodo)); t < n; t++) if (puntaje[t] > puntaje[fin]) fin = t;
	const pulsos: number[] = [];
	for (let t = fin; t >= 0; t = anterior[t]) {
		pulsos.push(t);
		if (anterior[t] < 0) break;
	}
	pulsos.reverse();
	// Sin los pulsos de las puntas que caen en silencio (intro/cola sin golpes).
	const fuertes = pulsos.map((t) => ataques[t]);
	const umbral = 0.5 * (fuertes.reduce((a, b) => a + b, 0) / Math.max(1, fuertes.length));
	let i = 0;
	while (i < pulsos.length && fuertes[i] < umbral) i++;
	let j = pulsos.length - 1;
	while (j > i && fuertes[j] < umbral) j--;
	return pulsos.slice(i, j + 1);
}

export async function detectarRitmos({
	muestras,
	tasa,
}: {
	muestras: Float32Array;
	tasa: number;
}): Promise<Ritmos> {
	const vacio: Ritmos = { ritmo1: [], ritmo2: [], bpm: 0 };
	if (muestras.length < tasa * 2) return vacio;
	let energia = 0;
	for (let i = 0; i < muestras.length; i += 16) energia += muestras[i] * muestras[i];
	if (energia / (muestras.length / 16) < 1e-7) return vacio;

	const ataques = await envolventeAtaques(muestras, tasa);
	if (ataques.length < 8) return vacio;
	const cuadrosPorSegundo = tasa / SALTO;
	const periodo = estimarPeriodo(ataques, cuadrosPorSegundo);
	const pulsos = seguirPulsos(ataques, periodo);
	// El flujo del cuadro f mide el paso f−1 → f, y el golpe cae cerca del centro
	// de su ventana, pero un poco DESPUÉS: medido con bombos sintéticos a 95, 120
	// y 140 BPM, el centro solo marcaba 8,6–8,9 ms antes (≈ 0,8 saltos).
	const aSegundos = (f: number) => (f * SALTO + VENTANA / 2 + 0.8 * SALTO) / tasa;
	const ritmo2 = pulsos.map(aSegundos);
	let par = 0;
	let impar = 0;
	pulsos.forEach((t, k) => {
		if (k % 2 === 0) par += ataques[t];
		else impar += ataques[t];
	});
	const fase = par >= impar ? 0 : 1;
	const ritmo1 = pulsos.filter((_, k) => k % 2 === fase).map(aSegundos);
	return { ritmo1, ritmo2, bpm: (60 * cuadrosPorSegundo) / periodo };
}
