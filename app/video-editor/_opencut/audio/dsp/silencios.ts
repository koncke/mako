// =============================================================================
// Silencios: dónde el clip no suena, medido por ventanas de RMS
// =============================================================================
// Pedido de Martín (reunión 858545195 @94:33, validado el 13/10): «un botón "Borrar
// silencios", que los elimine solo».
//
// Esto es la parte PURA: recibe los trozos de audio que entrega `recorrerFuente`
// (audio/decodificar.ts), mide el nivel por ventana y decide qué tramos son
// silencio. No toca la línea de tiempo: eso lo hace el comando
// (commands/timeline/element/borrar-silencios.ts) con los tramos que salen de acá.
// Sin dependencias: lo prueba `tests/video-editor-silencios.test.ts`.
//
// Los tres números que deciden, con sus porqués:
// · ventana de 20 ms: más corta y una consonante sorda parece silencio; más larga y
//   el corte entra tarde en la palabra.
// · un silencio vale a partir de 400 ms: las pausas naturales entre frases rondan
//   los 200-300 ms y hay que dejarlas, o el habla queda apretada.
// · se conservan 80 ms a cada lado: cortar al ras del umbral come el ataque de la
//   palabra siguiente y la cola de la anterior.
//
// ⚠️ EL UMBRAL NO ES SÓLO ABSOLUTO. Con −40 dBFS fijo, una grabación bajita (un
// teléfono lejos) sería «toda silencio» y se borraría entera. El umbral efectivo es
// el menor entre el absoluto y «25 dB por debajo del nivel típico fuerte» (p95), así
// que lo que se corta es lo que está callado RESPECTO de ese clip.

import type { Trozo } from "../decodificar";

export type VentanaNivel = {
	/** Inicio de la ventana, en segundos de la FUENTE. */
	t: number;
	/** Nivel RMS en dBFS (−100 = silencio digital). */
	db: number;
};

export type OpcionesSilencio = {
	/** Por debajo de esto es silencio (dBFS). */
	umbralDb?: number;
	/** Un silencio más corto no se toca (s). */
	minSilencioS?: number;
	/** Lo que se deja a cada lado del corte (s). */
	margenS?: number;
	/** Cuánto por debajo del nivel típico fuerte se considera callado (dB). */
	relativoDb?: number;
};

const DEFAULTS: Required<OpcionesSilencio> = { umbralDb: -40, minSilencioS: 0.4, margenS: 0.08, relativoDb: 25 };
const PISO_DB = -100;

/** Acumula trozos y los convierte en ventanas de nivel. Mono: promedio de canales. */
export class MedidorVentanas {
	private readonly ventanas: VentanaNivel[] = [];
	constructor(private readonly ventanaS = 0.02) {}

	agregar({ canales, sampleRate, inicio }: Trozo): void {
		if (!canales.length || sampleRate <= 0) return;
		const n = Math.max(1, Math.round(this.ventanaS * sampleRate));
		const largo = canales[0].length;
		for (let i = 0; i + n / 2 <= largo; i += n) {
			const fin = Math.min(largo, i + n);
			let suma = 0;
			for (let j = i; j < fin; j++) {
				let m = 0;
				for (const c of canales) m += c[j] ?? 0;
				m /= canales.length;
				suma += m * m;
			}
			const rms = Math.sqrt(suma / (fin - i));
			this.ventanas.push({ t: inicio + i / sampleRate, db: rms > 0 ? Math.max(PISO_DB, 20 * Math.log10(rms)) : PISO_DB });
		}
	}

	resultado(): VentanaNivel[] {
		return this.ventanas;
	}
}

/** El percentil `p` (0-1) de los niveles, o `PISO_DB` sin ventanas. */
function percentil(ventanas: readonly VentanaNivel[], p: number): number {
	if (!ventanas.length) return PISO_DB;
	const dbs = ventanas.map((v) => v.db).sort((a, b) => a - b);
	return dbs[Math.min(dbs.length - 1, Math.max(0, Math.floor(p * (dbs.length - 1))))];
}

/** Por encima de esto la ventana trae ALGO (ruido de sala, voz); por debajo es silencio digital. */
const SUELO_SONORO_DB = PISO_DB + 6;

/**
 * El umbral con el que se decide, dado lo que suena en ESTE clip. El nivel típico
 * fuerte (p95) se mide sobre las ventanas que traen algo: si entraran las de
 * silencio digital, un clip con 29 s de aire y una frase tendría p95 en el piso y
 * el umbral bajaría a −125 dB, con lo cual nada sería silencio (medido con el test
 * «todo silencio»: 0 tramos). Sin ninguna ventana sonora manda el absoluto.
 */
export function umbralEfectivo(ventanas: readonly VentanaNivel[], opciones: OpcionesSilencio = {}): number {
	const o = { ...DEFAULTS, ...opciones };
	const sonoras = ventanas.filter((v) => v.db > SUELO_SONORO_DB);
	if (!sonoras.length) return o.umbralDb;
	return Math.min(o.umbralDb, percentil(sonoras, 0.95) - o.relativoDb);
}

/**
 * Los tramos de silencio, en segundos de la FUENTE, ya con el margen comido a cada
 * lado. Ordenados y sin solaparse.
 */
export function rangosDeSilencio(ventanas: readonly VentanaNivel[], opciones: OpcionesSilencio = {}): [number, number][] {
	const o = { ...DEFAULTS, ...opciones };
	if (ventanas.length < 2) return [];
	const umbral = umbralEfectivo(ventanas, opciones);
	const paso = ventanas[1].t - ventanas[0].t;
	const primero = ventanas[0].t;
	const ultimo = ventanas[ventanas.length - 1].t + paso;
	const out: [number, number][] = [];
	let inicio: number | null = null;
	// El margen protege la palabra de al lado. En el borde del clip no hay palabra
	// de al lado: un silencio que arranca con el clip se corta desde el principio, y
	// uno que llega al final se corta hasta el final (medido con el caso típico: con
	// el margen puesto quedaban 80 ms de aire al final de cada toma).
	const cerrar = (fin: number) => {
		if (inicio === null) return;
		const a = inicio <= primero + 1e-9 ? inicio : inicio + o.margenS;
		const b = fin >= ultimo - 1e-9 ? fin : fin - o.margenS;
		if (fin - inicio >= o.minSilencioS && b > a) out.push([a, b]);
		inicio = null;
	};
	for (const v of ventanas) {
		if (v.db < umbral) {
			if (inicio === null) inicio = v.t;
		} else {
			cerrar(v.t);
		}
	}
	cerrar(ultimo);
	return out;
}

/**
 * Lo que QUEDA del tramo [desde, hasta) de la fuente al sacar los silencios: los
 * tramos que suenan, en orden. Nunca devuelve el clip vacío: si todo es silencio,
 * devuelve `[]` y quien llama decide no tocar nada.
 */
export function tramosQueQuedan({
	desde,
	hasta,
	silencios,
}: {
	desde: number;
	hasta: number;
	silencios: readonly [number, number][];
}): [number, number][] {
	const out: [number, number][] = [];
	let cursor = desde;
	for (const [a, b] of [...silencios].sort((x, y) => x[0] - y[0])) {
		const a2 = Math.max(desde, Math.min(hasta, a));
		const b2 = Math.max(desde, Math.min(hasta, b));
		if (b2 <= a2) continue;
		if (a2 > cursor) out.push([cursor, a2]);
		cursor = Math.max(cursor, b2);
	}
	if (cursor < hasta) out.push([cursor, hasta]);
	return out.filter(([a, b]) => b - a > 1e-6);
}

/** Cuánto se quita, en segundos de la fuente. */
export function segundosQuitados(silencios: readonly [number, number][]): number {
	return silencios.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
}
