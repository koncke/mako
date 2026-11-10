// =============================================================================
// «Reducir el ruido»: RNNoise decide cuánto bajar cada banda; la ganancia se aplica acá
// =============================================================================
// CapCut usa RNNoise, una red neuronal (`Resources/rnnoise`). Hasta el 28/10 esto era
// una compuerta espectral propia con un perfil fijo por clip, y medido contra la red
// perdía en todo: con ruido rosa bajaba las pausas −16 dB, con un ruido que cambia
// −1,5, y en estéreo el perfil salía de L+R (docs/hallazgos-video-editor.md).
//
// RNNoise NO se usa para sacar el audio: su salida re-sintetiza la voz (una voz LIMPIA
// sale con una SNR de 11 dB contra la entrada). Se usa como el oído que decide:
//
//   1. cada canal, llevado a 48 kHz (RNNoise sólo trabaja ahí), pasa por la red con un
//      ESPEJO de 3 s antes y después (el principio del clip al revés: la red arranca
//      ya acostumbrada a ESE ruido, sin un borde que la sorprenda) y se le saca el
//      retardo medido (dsp/rnnoise.ts). Con 1 s, el principio de una pieza de «Borrar
//      silencios» quedaba hasta 18 dB más ruidoso que el mismo lugar procesado de
//      corrido; con 3 s, 10 dB como mucho y siempre 25 dB por debajo de la entrada;
//   2. por cuadro de 10 ms y por cada una de sus 21 bandas: ganancia = √(energía que
//      dejó / energía que entró);
//   3. la ganancia se ENLAZA entre canales donde llevan LO MISMO (la misma voz en los
//      dos: si cada lado bajara distinto, la imagen estéreo se movería). La enlazada es
//      el máximo de los que votan; no vota un canal sin señal (−80 dBFS) ni uno que en
//      esa banda está 20 dB o más por debajo del más fuerte. Cada canal toma de ella lo
//      que su coherencia con el otro dice que comparten, y el resto lo decide su propia
//      ganancia. Con el máximo solo, el eco de sala de un canal limpio dejaba pasar el
//      ruido del otro (medido: pausas −17 dB con un eco de 0,3 s, −8 con uno de 1 s);
//   4. una banda que la red baja menos de 6 dB se deja entera (es voz: la rodilla de
//      0,5 lleva una voz limpia de una SNR de 19 a 35 dB y las pausas no se mueven),
//      y nada baja más que el piso de la intensidad;
//   5. donde no HAY ruido no se toca nada, y se decide POR CANAL: si el cuadro más bajo
//      de ese canal en ±2 s (sin contar el silencio digital) está por debajo de −75 dBFS,
//      no recibe la ganancia; desde −65, toda. Sin esto la red se come algo de las «s» y
//      las «f» de una voz limpia (SNR de 24,6 dB con consonantes, 113 sin ellas), también
//      la del canal limpio de un estéreo con el ruido en el otro;
//   6. la ganancia se aplica al audio ORIGINAL, a su tasa, con una STFT √Hann al 50 %
//      que reconstruye exacto donde la ganancia es 1. Lo que no se toca, no cambia.
//
// Corre igual en la vista previa y en el export (audio/cadena.ts). Cada pieza de
// «Borrar silencios» se procesa sola: el espejo es lo que evita un salto de ruido
// en el corte (tests/video-editor-ruido.test.ts). Cuesta ~6 s por minuto de audio
// y canal distinto (el modelo, ~0,7 ms por cuadro de 10 ms): 8 veces lo de antes.
//
// `intensidad` 0–1 (CapCut guarda `denoise_rate 0,85`): el piso va de −12 dB a −48.
//
// Desde el 10/11/2026 corre en un WORKER (audio/ruido-hilo/): en el hilo de la pantalla, un estéreo de 10 min
// trababa el editor ~2 min. Este módulo no sabe dónde corre: cada pausa (`ceder`) es inyectable —el worker suelta
// su hilo sin la espera mínima de un `setTimeout` encadenado y corta ahí si le cancelan el pedido— y `alAvanzar`
// cuenta lo hecho.
// Nada de eso toca las cuentas: el resultado es el mismo byte a byte (tests/video-editor-ruido-hilo.test.ts).

import { Fft, ceder } from "./fft";
import { CUADRO_RNNOISE, RETARDO_RNNOISE, SR_RNNOISE, type MotorRnnoise } from "./rnnoise";

/** Los bordes de las bandas de RNNoise (`eband5ms`, de a 200 Hz), hasta 20 kHz. */
const BORDES_HZ = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 2000, 2400, 2800, 3200, 4000, 4800, 5600, 6800, 8000, 9600, 12000, 15600, 20000];
const BANDAS = BORDES_HZ.length - 1;
const CENTROS_HZ = BORDES_HZ.slice(0, -1).map((b, i) => (b + BORDES_HZ[i + 1]) / 2);
/** El cuadro de análisis: 960 muestras (dos de RNNoise) en una FFT de 1024. */
const VENTANA_ANALISIS = 960;
const FFT_ANALISIS = 1024;
const ESPEJO_S = 3;
/** Una banda con ganancia ≥ esto se deja entera; debajo, se baja la mitad menos. */
const RODILLA = 0.5;
/** Un canal vota si la energía de esa banda está a menos de 20 dB del más fuerte… */
const VOTO_RELATIVO = 10 ** (-20 / 10);
/** …y si el cuadro tiene señal (−80 dBFS). */
const SIN_SENAL = 10 ** (-80 / 10);
/** La coherencia entre los dos canales se suma en ±2 cuadros (50 ms). */
const COHERENCIA_CUADROS = 2;
/** El piso del ruido: el cuadro más bajo en ±2 s, sin contar el silencio digital (−100 dBFS). */
const VENTANA_PISO = 200;
const SILENCIO_DIGITAL = 10 ** (-100 / 10);
/** Con el piso por debajo de −75 dBFS no hay ruido que sacar; desde −65, decide la red. */
const SIN_RUIDO_DB = -75;
const CON_RUIDO_DB = -65;

function tamanoVentana(sampleRate: number): number {
	return sampleRate >= 32000 ? 1024 : 512;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuánto falta (para la barra de avance) y dónde se suelta el hilo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que pesa un cuadro de la red contra uno de los otros pasos (el análisis, la coherencia y la STFT que aplica):
 * medido el 10/11/2026 con 30 s de voz con ruido, en node 24, ~0,64 ms contra ~0,1 ms. Sólo ordena la barra.
 */
const PESO_RED = 6;

type Avance = {
	/** Suma lo hecho, lo cuenta y suelta el hilo (si `ceder` tira, el trabajo se corta acá). */
	paso(unidades: number): Promise<void>;
	fin(): void;
};

function crearAvance(total: number, alAvanzar: ((hecho: number) => void) | undefined, soltar: () => Promise<void>): Avance {
	let hecho = 0;
	return {
		async paso(unidades) {
			hecho += unidades;
			// El 1 lo dice `fin`: una estimación que se pasa no puede anunciar que terminó.
			alAvanzar?.(total > 0 ? Math.min(0.99, hecho / total) : 0.99);
			await soltar();
		},
		fin() {
			alAvanzar?.(1);
		},
	};
}

/** Las unidades de todo el trabajo, con los mismos largos que van a recorrer los bucles de abajo. */
function unidadesDeTrabajo(largo: number, sampleRate: number, distintos: number): number {
	const largo48 = sampleRate === SR_RNNOISE ? largo : Math.floor(largo / (sampleRate / SR_RNNOISE));
	const e = Math.max(0, Math.min(Math.round(ESPEJO_S * SR_RNNOISE), largo48 - 1));
	const red = Math.ceil((2 * e + largo48 + RETARDO_RNNOISE + CUADRO_RNNOISE) / CUADRO_RNNOISE);
	const cuadros = Math.ceil(largo48 / CUADRO_RNNOISE);
	const salto = tamanoVentana(sampleRate) / 2;
	const aplicar = Math.ceil((largo + salto) / salto);
	return distintos * (red * PESO_RED + cuadros + aplicar) + (distintos === 2 ? cuadros : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// A 48 kHz, sólo para que la red escuche (lo que suena nunca se remuestrea)
// ─────────────────────────────────────────────────────────────────────────────

const LANCZOS = 4;
const FASES = 512;

/** Lanczos-4 con la tabla de fases precalculada; al bajar la tasa, el núcleo se ensancha (antialias). */
export function a48k(x: Float32Array, sampleRate: number): Float32Array {
	if (sampleRate === SR_RNNOISE) return x;
	const paso = sampleRate / SR_RNNOISE;
	const corte = Math.min(1, SR_RNNOISE / sampleRate);
	const ancho = Math.ceil(LANCZOS / corte);
	const taps = 2 * ancho;
	const tabla = new Float64Array(FASES * taps);
	for (let f = 0; f < FASES; f++) {
		let suma = 0;
		for (let j = 0; j < taps; j++) {
			const d = (f / FASES + ancho - 1 - j) * corte;
			const v = d === 0 ? 1 : Math.abs(d) >= LANCZOS ? 0 : (LANCZOS * Math.sin(Math.PI * d) * Math.sin((Math.PI * d) / LANCZOS)) / (Math.PI * Math.PI * d * d);
			tabla[f * taps + j] = v;
			suma += v;
		}
		for (let j = 0; j < taps; j++) tabla[f * taps + j] /= suma;
	}
	const n = Math.floor(x.length / paso);
	const y = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const t = i * paso;
		const c = Math.floor(t);
		const base = Math.min(FASES - 1, Math.round((t - c) * FASES)) * taps;
		const desde = c - ancho + 1;
		let s = 0;
		for (let j = 0; j < taps; j++) {
			const k = desde + j;
			if (k >= 0 && k < x.length) s += x[k] * tabla[base + j];
		}
		y[i] = s;
	}
	return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que decide la red, por cuadro de 10 ms y banda
// ─────────────────────────────────────────────────────────────────────────────

type Analisis = {
	cuadros: number;
	/** cuadros × BANDAS: ganancia de la red, 0–1. */
	ganancia: Float32Array;
	/** cuadros × BANDAS: energía de la entrada en la banda (para el voto). */
	energiaBanda: Float32Array;
	/** Energía media por muestra del cuadro (para «sin señal»). */
	energiaCuadro: Float64Array;
	/** El canal a 48 kHz (para la coherencia con el otro). */
	x: Float32Array;
};

/** La red sobre el canal a 48 kHz, con el espejo; devuelve la salida ya sin el retardo. */
async function pasarPorLaRed(motor: MotorRnnoise, x: Float32Array, avance: Avance): Promise<Float32Array> {
	const e = Math.max(0, Math.min(Math.round(ESPEJO_S * SR_RNNOISE), x.length - 1));
	const largo = e + x.length + e;
	const extendida = new Float32Array(largo);
	for (let i = 0; i < e; i++) extendida[i] = x[e - i];
	extendida.set(x, e);
	for (let i = 0; i < e; i++) extendida[e + x.length + i] = x[x.length - 2 - i];
	const total = largo + RETARDO_RNNOISE + CUADRO_RNNOISE;
	const y = new Float32Array(total);
	const cuadro = new Float32Array(CUADRO_RNNOISE);
	const estado = motor.crear();
	try {
		let k = 0;
		for (let ini = 0; ini < total; ini += CUADRO_RNNOISE) {
			for (let i = 0; i < CUADRO_RNNOISE; i++) cuadro[i] = (extendida[ini + i] ?? 0) * 32768;
			estado.procesar(cuadro);
			for (let i = 0; i < CUADRO_RNNOISE && ini + i < total; i++) y[ini + i] = cuadro[i] / 32768;
			// ~0,7 ms por cuadro: cada 40 se suelta el hilo (la vista previa corre en él, si no hay worker).
			if (++k % 40 === 0) await avance.paso(40 * PESO_RED);
		}
	} finally {
		estado.liberar();
	}
	const desde = RETARDO_RNNOISE + e;
	return y.slice(desde, desde + x.length);
}

const BINS_ANALISIS = BORDES_HZ.map((hz) => Math.min(FFT_ANALISIS / 2, Math.round(hz / (SR_RNNOISE / FFT_ANALISIS))));

function ventanaAnalisis(): Float64Array {
	const ventana = new Float64Array(VENTANA_ANALISIS);
	for (let i = 0; i < VENTANA_ANALISIS; i++) ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / VENTANA_ANALISIS);
	return ventana;
}

async function analizar(motor: MotorRnnoise, canal: Float32Array, sampleRate: number, avance: Avance): Promise<Analisis> {
	const x = a48k(canal, sampleRate);
	const y = await pasarPorLaRed(motor, x, avance);
	const fft = new Fft(FFT_ANALISIS);
	const ventana = ventanaAnalisis();
	const cuadros = Math.ceil(x.length / CUADRO_RNNOISE);
	const ganancia = new Float32Array(cuadros * BANDAS);
	const energiaBanda = new Float32Array(cuadros * BANDAS);
	const energiaCuadro = new Float64Array(cuadros);
	const rx = new Float64Array(FFT_ANALISIS);
	const ix = new Float64Array(FFT_ANALISIS);
	const ry = new Float64Array(FFT_ANALISIS);
	const iy = new Float64Array(FFT_ANALISIS);
	const bins = BINS_ANALISIS;
	for (let k = 0; k < cuadros; k++) {
		// Cuadro k: centrado en la muestra k·480 + 240.
		const ini = k * CUADRO_RNNOISE - CUADRO_RNNOISE / 2;
		let energia = 0;
		for (let i = 0; i < FFT_ANALISIS; i++) {
			const j = ini + i;
			const dentro = i < VENTANA_ANALISIS && j >= 0 && j < x.length;
			const vx = dentro ? x[j] : 0;
			rx[i] = vx * (dentro ? ventana[i] : 0);
			ry[i] = dentro ? y[j] * ventana[i] : 0;
			ix[i] = 0;
			iy[i] = 0;
			energia += vx * vx;
		}
		energiaCuadro[k] = energia / VENTANA_ANALISIS;
		fft.transformar(rx, ix);
		fft.transformar(ry, iy);
		for (let b = 0; b < BANDAS; b++) {
			let sx = 0;
			let sy = 0;
			for (let q = bins[b]; q < bins[b + 1]; q++) {
				sx += rx[q] * rx[q] + ix[q] * ix[q];
				sy += ry[q] * ry[q] + iy[q] * iy[q];
			}
			ganancia[k * BANDAS + b] = sx > 1e-18 ? Math.min(1, Math.sqrt(sy / sx)) : 1;
			energiaBanda[k * BANDAS + b] = sx;
		}
		if (k % 200 === 199) await avance.paso(200);
	}
	return { cuadros, ganancia, energiaBanda, energiaCuadro, x };
}

/**
 * El piso del ruido por cuadro: el mínimo de la energía en ±VENTANA_PISO cuadros, sin contar el
 * silencio digital (una intro muda no es «sin ruido»). Sin ningún cuadro con señal en la ventana, 0.
 */
function pisoDelRuido(energia: Float64Array): Float64Array {
	const n = energia.length;
	const piso = new Float64Array(n);
	// Mínimo deslizante con una cola monótona de índices.
	const cola = new Int32Array(n);
	let ini = 0;
	let fin = 0;
	let j = 0;
	for (let k = 0; k < n; k++) {
		for (; j < n && j <= k + VENTANA_PISO; j++) {
			if (energia[j] < SILENCIO_DIGITAL) continue;
			while (fin > ini && energia[cola[fin - 1]] >= energia[j]) fin--;
			cola[fin++] = j;
		}
		while (fin > ini && cola[ini] < k - VENTANA_PISO) ini++;
		piso[k] = fin > ini ? energia[cola[ini]] : 0;
	}
	return piso;
}

/**
 * Cuánto llevan LO MISMO dos canales, por cuadro y banda (0–1): la coherencia, |ΣXa·X̄b|² / (Σ|Xa|²·Σ|Xb|²),
 * sumada en ±COHERENCIA_CUADROS. La misma voz en los dos da cerca de 1; el ruido de un solo lado contra el
 * eco de sala del otro, cerca de 0.
 */
async function coherencia(a: Analisis, b: Analisis, avance: Avance): Promise<Float32Array> {
	const cuadros = Math.min(a.cuadros, b.cuadros);
	const fft = new Fft(FFT_ANALISIS);
	const ventana = ventanaAnalisis();
	const n = cuadros * BANDAS;
	const cr = new Float64Array(n);
	const ci = new Float64Array(n);
	const ea = new Float64Array(n);
	const eb = new Float64Array(n);
	const ra = new Float64Array(FFT_ANALISIS);
	const ia = new Float64Array(FFT_ANALISIS);
	const rb = new Float64Array(FFT_ANALISIS);
	const ib = new Float64Array(FFT_ANALISIS);
	for (let k = 0; k < cuadros; k++) {
		const ini = k * CUADRO_RNNOISE - CUADRO_RNNOISE / 2;
		for (let i = 0; i < FFT_ANALISIS; i++) {
			const j = ini + i;
			const w = i < VENTANA_ANALISIS ? ventana[i] : 0;
			ra[i] = (a.x[j] ?? 0) * w;
			rb[i] = (b.x[j] ?? 0) * w;
			ia[i] = 0;
			ib[i] = 0;
		}
		fft.transformar(ra, ia);
		fft.transformar(rb, ib);
		for (let c = 0; c < BANDAS; c++) {
			const i = k * BANDAS + c;
			for (let q = BINS_ANALISIS[c]; q < BINS_ANALISIS[c + 1]; q++) {
				cr[i] += ra[q] * rb[q] + ia[q] * ib[q];
				ci[i] += ia[q] * rb[q] - ra[q] * ib[q];
				ea[i] += ra[q] * ra[q] + ia[q] * ia[q];
				eb[i] += rb[q] * rb[q] + ib[q] * ib[q];
			}
		}
		if (k % 200 === 199) await avance.paso(200);
	}
	const coh = new Float32Array(n);
	for (let k = 0; k < cuadros; k++) {
		for (let c = 0; c < BANDAS; c++) {
			let sr = 0;
			let si = 0;
			let sa = 0;
			let sb = 0;
			for (let m = Math.max(0, k - COHERENCIA_CUADROS); m <= Math.min(cuadros - 1, k + COHERENCIA_CUADROS); m++) {
				const i = m * BANDAS + c;
				sr += cr[i];
				si += ci[i];
				sa += ea[i];
				sb += eb[i];
			}
			coh[k * BANDAS + c] = sa > 1e-18 && sb > 1e-18 ? Math.min(1, (sr * sr + si * si) / (sa * sb)) : 0;
		}
	}
	return coh;
}

/**
 * La ganancia de cada canal (ver la cabecera, 3 y 4): la ENLAZADA es el máximo de los que votan, con la rodilla;
 * cada canal toma de ella lo que lleva en común con el otro (`coh`) y el resto lo decide su propia ganancia. Sin
 * `coh` (un solo canal, o más de dos), todos toman la enlazada.
 */
function gananciasPorCanal(analisis: readonly Analisis[], coh: Float32Array | null): Float32Array[] {
	const cuadros = Math.min(...analisis.map((a) => a.cuadros));
	const g = analisis.map(() => new Float32Array(cuadros * BANDAS));
	for (let k = 0; k < cuadros; k++) {
		for (let b = 0; b < BANDAS; b++) {
			const i = k * BANDAS + b;
			let mayor = 0;
			for (const a of analisis) mayor = Math.max(mayor, a.energiaBanda[i]);
			let vota = false;
			let maximo = 0;
			for (const a of analisis) {
				if (a.energiaCuadro[k] < SIN_SENAL || a.energiaBanda[i] < mayor * VOTO_RELATIVO) continue;
				vota = true;
				maximo = Math.max(maximo, a.ganancia[i]);
			}
			// Nadie vota: es silencio en todos lados, no hay nada que bajar.
			const enlazada = vota ? Math.min(1, maximo / RODILLA) : 1;
			analisis.forEach((a, c) => {
				const propia = vota ? Math.min(1, a.ganancia[i] / RODILLA) : 1;
				g[c][i] = coh ? propia + coh[i] * (enlazada - propia) : enlazada;
			});
		}
	}
	return g;
}

/**
 * Cuánto de su ganancia recibe UN canal, por cuadro: 0 donde ese canal no tiene ruido que sacar
 * (su piso, por debajo de −75 dBFS), 1 desde −65. Un canal limpio al lado de uno con ruido no la
 * recibe (medido: el limpio pasaba de una SNR de 36 a 24,5 dB).
 */
function pesoDelCanal(a: Analisis): Float32Array {
	const piso = pisoDelRuido(a.energiaCuadro);
	const peso = new Float32Array(a.cuadros);
	for (let k = 0; k < a.cuadros; k++) {
		const pisoDb = piso[k] > 0 ? 10 * Math.log10(piso[k]) : -Infinity;
		peso[k] = Math.max(0, Math.min(1, (pisoDb - SIN_RUIDO_DB) / (CON_RUIDO_DB - SIN_RUIDO_DB)));
	}
	return peso;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aplicar la ganancia al audio original, a su tasa
// ─────────────────────────────────────────────────────────────────────────────

async function aplicar(canal: Float32Array, sampleRate: number, g: Float32Array, peso: Float32Array, piso: number, avance: Avance): Promise<Float32Array> {
	const largo = canal.length;
	const n = tamanoVentana(sampleRate);
	const salto = n / 2;
	const fft = new Fft(n);
	// √Hann en análisis y síntesis: al 50 % el producto suma exactamente 1.
	const ventana = new Float64Array(n);
	for (let i = 0; i < n; i++) ventana[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
	const nb = n / 2 + 1;
	// Cada bin, entre qué dos centros de banda cae y con qué peso.
	const banda = new Int32Array(nb);
	const entre = new Float64Array(nb);
	for (let q = 0; q < nb; q++) {
		const hz = (q * sampleRate) / n;
		let b = 0;
		while (b < BANDAS - 2 && hz > CENTROS_HZ[b + 1]) b++;
		banda[q] = b;
		entre[q] = Math.max(0, Math.min(1, (hz - CENTROS_HZ[b]) / (CENTROS_HZ[b + 1] - CENTROS_HZ[b])));
	}
	const cuadros = g.length / BANDAS;
	const gb = new Float64Array(BANDAS);
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	const out = new Float32Array(largo);
	let trabajados = 0;
	// Se rellena medio cuadro antes y después para que el principio y el final
	// también pasen por dos ventanas y la suma dé 1.
	for (let ini = -salto; ini < largo; ini += salto) {
		// El centro de este cuadro en el reloj de la red (cuadros de 480 a 48 kHz, centro en k·480 + 240).
		const pos = (((ini + n / 2) / sampleRate) * SR_RNNOISE - CUADRO_RNNOISE / 2) / CUADRO_RNNOISE;
		const k0 = Math.max(0, Math.min(cuadros - 1, Math.floor(pos)));
		const k1 = Math.min(cuadros - 1, k0 + 1);
		const a = Math.max(0, Math.min(1, pos - k0));
		const w = (1 - a) * peso[k0] + a * peso[k1];
		for (let b = 0; b < BANDAS; b++) gb[b] = 1 - (1 - Math.max(piso, (1 - a) * g[k0 * BANDAS + b] + a * g[k1 * BANDAS + b])) * w;
		for (let i = 0; i < n; i++) {
			const j = ini + i;
			re[i] = j >= 0 && j < largo ? canal[j] * ventana[i] : 0;
			im[i] = 0;
		}
		fft.transformar(re, im);
		for (let q = 0; q < nb; q++) {
			const gq = (1 - entre[q]) * gb[banda[q]] + entre[q] * gb[banda[q] + 1];
			re[q] *= gq;
			im[q] *= gq;
			if (q > 0 && q < n / 2) {
				re[n - q] *= gq;
				im[n - q] *= gq;
			}
		}
		fft.transformar(re, im, true);
		for (let i = 0; i < n; i++) {
			const j = ini + i;
			if (j >= 0 && j < largo) out[j] += re[i] * ventana[i];
		}
		if (++trabajados % 200 === 0) await avance.paso(200);
	}
	return out;
}

function mismaSenal(a: Float32Array, b: Float32Array): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

export async function reducirRuido({
	canales,
	sampleRate,
	intensidad = 0.85,
	motor,
	alAvanzar,
	ceder: soltar = ceder,
}: {
	canales: readonly Float32Array[];
	sampleRate: number;
	intensidad?: number;
	motor: MotorRnnoise;
	/** Lo hecho, de 0 a 1, cada vez que se suelta el hilo (y 1 al terminar). */
	alAvanzar?: (hecho: number) => void;
	/** Cómo se suelta el hilo (por defecto, un `setTimeout`). Si tira, el trabajo se corta ahí con ese error. */
	ceder?: () => Promise<void>;
}): Promise<Float32Array[]> {
	const largo = canales[0]?.length ?? 0;
	if (largo < tamanoVentana(sampleRate) * 2) {
		alAvanzar?.(1);
		return canales.map((c) => c.slice());
	}
	const fuerza = Math.max(0, Math.min(1, intensidad));
	const piso = 10 ** (-(12 + 36 * fuerza) / 20);

	// Un estéreo con los dos lados iguales (el mono de un teléfono) se escucha una vez.
	const distintos: Float32Array[] = [];
	for (const c of canales) if (!distintos.some((d) => mismaSenal(d, c))) distintos.push(c);
	const avance = crearAvance(unidadesDeTrabajo(largo, sampleRate, distintos.length), alAvanzar, soltar);
	const analisis: Analisis[] = [];
	for (const c of distintos) analisis.push(await analizar(motor, c, sampleRate, avance));
	const coh = analisis.length === 2 ? await coherencia(analisis[0], analisis[1], avance) : null;
	const ganancias = gananciasPorCanal(analisis, coh);
	const pesos = analisis.map(pesoDelCanal);

	const hechos = new Map<Float32Array, Float32Array>();
	const salida: Float32Array[] = [];
	for (const c of canales) {
		const igual = [...hechos.keys()].find((d) => mismaSenal(d, c));
		const cual = distintos.findIndex((d) => mismaSenal(d, c));
		const y = igual ? (hechos.get(igual) as Float32Array).slice() : await aplicar(c, sampleRate, ganancias[cual], pesos[cual], piso, avance);
		if (!igual) hechos.set(c, y);
		salida.push(y);
	}
	avance.fin();
	return salida;
}
