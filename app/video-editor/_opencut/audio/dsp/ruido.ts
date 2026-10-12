// =============================================================================
// «Reducir el ruido»: compuerta espectral sobre el clip entero
// =============================================================================
// CapCut trae RNNoise local (`Resources/rnnoise`), una red que no está en el
// repo. Esto es lo clásico que no necesita modelo: STFT (Hann √, 50 %), un
// perfil del ruido por banda tomado de los cuadros MÁS SILENCIOSOS del clip
// (percentil bajo de la magnitud: en una voz en off, las pausas), y una ganancia
// tipo Wiener con piso, suavizada en el tiempo (sube rápido, baja lento) y entre
// bandas vecinas, que es lo que evita el «ruido musical» de los pitidos sueltos.
//
// Sirve para el zumbido y el soplido constantes (ventilador, aire, hiss del
// micrófono), que es lo que la gente graba. Un ruido que cambia (tránsito,
// gente hablando atrás) no lo saca: eso es la red de CapCut.
//
// `intensidad` 0–1 (CapCut guarda `denoise_rate 0,85`).

import { Fft, ceder } from "./fft";

const PERCENTIL_RUIDO = 0.15;
const MAX_CUADROS_PERFIL = 1500;

function tamanoVentana(sampleRate: number): number {
	return sampleRate >= 32000 ? 1024 : 512;
}

/** La POTENCIA media del ruido por banda, desde el percentil bajo de cuadros repartidos. */
function perfilRuido(canales: readonly Float32Array[], n: number, ventana: Float64Array, fft: Fft): Float64Array {
	const largo = canales[0].length;
	const salto = n / 2;
	const cuadros = Math.max(1, Math.floor((largo - n) / salto) + 1);
	const cada = Math.max(1, Math.ceil(cuadros / MAX_CUADROS_PERFIL));
	const bandas = n / 2 + 1;
	const muestras: Float64Array[] = Array.from({ length: bandas }, () => new Float64Array(Math.ceil(cuadros / cada)));
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	let k = 0;
	for (let f = 0; f < cuadros; f += cada, k++) {
		const ini = f * salto;
		for (let i = 0; i < n; i++) {
			let v = 0;
			for (const c of canales) v += c[ini + i] ?? 0;
			re[i] = (v / canales.length) * ventana[i];
			im[i] = 0;
		}
		fft.transformar(re, im);
		for (let b = 0; b < bandas; b++) muestras[b][k] = Math.hypot(re[b], im[b]);
	}
	// La magnitud de un ruido en una banda sigue una Rayleigh: su percentil p es
	// σ·√(−2·ln(1−p)), y su POTENCIA media es 2σ². Sin esta corrección el
	// percentil bajo subestima el ruido ~5 veces en potencia (medido: con el 15 %
	// crudo, la pausa de una voz con ruido blanco bajaba sólo 3,6 dB).
	const sigmaPorPercentil = 1 / Math.sqrt(-2 * Math.log(1 - PERCENTIL_RUIDO));
	const potencia = new Float64Array(bandas);
	for (let b = 0; b < bandas; b++) {
		const orden = muestras[b].subarray(0, k).sort();
		const sigma = (orden[Math.min(k - 1, Math.floor(PERCENTIL_RUIDO * k))] ?? 0) * sigmaPorPercentil;
		potencia[b] = 2 * sigma * sigma;
	}
	return potencia;
}

export async function reducirRuido({
	canales,
	sampleRate,
	intensidad = 0.85,
}: {
	canales: readonly Float32Array[];
	sampleRate: number;
	intensidad?: number;
}): Promise<Float32Array[]> {
	const largo = canales[0]?.length ?? 0;
	const n = tamanoVentana(sampleRate);
	if (largo < n * 2) return canales.map((c) => c.slice());

	const fft = new Fft(n);
	// Hann √ en análisis y síntesis: al 50 % el producto suma exactamente 1.
	const ventana = new Float64Array(n);
	for (let i = 0; i < n; i++) ventana[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
	const ruido = perfilRuido(canales, n, ventana, fft);

	const fuerza = Math.max(0, Math.min(1, intensidad));
	const sobreResta = 1.5 + 1.5 * fuerza;
	// Piso de la ganancia: −12 dB con fuerza 0, −30 dB con fuerza 1.
	const piso = 10 ** (-(12 + 18 * fuerza) / 20);
	const bandas = n / 2 + 1;
	const salto = n / 2;
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	const ganancia = new Float64Array(bandas);
	const suavizada = new Float64Array(bandas);

	const salida: Float32Array[] = [];
	let trabajados = 0;
	for (const canal of canales) {
		const out = new Float32Array(largo);
		const previa = new Float64Array(bandas).fill(1);
		// Se rellena medio cuadro antes y después para que el principio y el final
		// también pasen por dos ventanas y la suma dé 1.
		for (let ini = -salto; ini < largo; ini += salto) {
			for (let i = 0; i < n; i++) {
				const j = ini + i;
				re[i] = j >= 0 && j < largo ? canal[j] * ventana[i] : 0;
				im[i] = 0;
			}
			fft.transformar(re, im);
			for (let b = 0; b < bandas; b++) {
				const mag2 = re[b] * re[b] + im[b] * im[b];
				const r2 = ruido[b] * sobreResta;
				const g = mag2 > 0 ? Math.max(piso, 1 - r2 / mag2) : piso;
				// Sube enseguida (no se come el ataque de una sílaba), baja lento.
				ganancia[b] = g > previa[b] ? g : 0.7 * previa[b] + 0.3 * g;
				previa[b] = ganancia[b];
			}
			for (let b = 0; b < bandas; b++) {
				const a = ganancia[Math.max(0, b - 1)];
				const c = ganancia[Math.min(bandas - 1, b + 1)];
				suavizada[b] = (a + 2 * ganancia[b] + c) / 4;
			}
			for (let b = 0; b < bandas; b++) {
				re[b] *= suavizada[b];
				im[b] *= suavizada[b];
				if (b > 0 && b < n / 2) {
					re[n - b] *= suavizada[b];
					im[n - b] *= suavizada[b];
				}
			}
			fft.transformar(re, im, true);
			for (let i = 0; i < n; i++) {
				const j = ini + i;
				if (j >= 0 && j < largo) out[j] += re[i] * ventana[i];
			}
			if (++trabajados % 400 === 0) await ceder();
		}
		salida.push(out);
	}
	return salida;
}
