// =============================================================================
// La «Curva» de velocidad de CapCut (Velocidad › Curva)
// =============================================================================
// Una curva es una lista de puntos (x, y): x va de 0 a 1 a lo largo del CLIP
// (tiempo de la línea de tiempo, normalizado) e y es la velocidad en ese punto,
// de 0,1× a 10× como en el editor de CapCut. Entre puntos la velocidad se
// interpola con una cúbica monótona (Fritsch–Carlson) sobre log2(y): así la
// curva no se pasa de los puntos (una interpolación cúbica común inventa un
// 0,05× o un 14× entre dos puntos cercanos) y subir de 1× a 2× pesa lo mismo
// que bajar de 1× a 0,5×, como en el gráfico de CapCut, que es logarítmico.
//
// Lo que necesita el motor es la INTEGRAL: si el clip dura D (en la unidad que
// sea), el tiempo de la fuente en el instante t es D·F(t/D), con F(u) = ∫₀ᵘ v.
// De ahí sale todo:
//   · la fuente que recorre el clip entero es D·F(1) = D·v̄ (v̄, la velocidad
//     media), así que la duración del clip es  fuente / v̄;
//   · la duración no depende de la unidad (ticks o segundos): por eso
//     `getTimelineDurationForSourceSpan` no necesita saber cuánto dura el clip,
//     y `getSourceTimeAtClipTime` sí (ver retime/resolve.ts).
//
// F se tabula (512 tramos, trapecios) y se guarda por curva: el render la pide
// en cada cuadro y el audio en cada muestra.
//
// Las formas de los ajustes predefinidos son una aproximación a ojo de las de
// CapCut (no hay datos publicados): se editan igual que en CapCut, moviendo los
// puntos.

export type PuntoCurva = { x: number; y: number };

export type CurvaVelocidad = {
	preset: string;
	puntos: PuntoCurva[];
};

export const VELOCIDAD_CURVA_MIN = 0.1;
export const VELOCIDAD_CURVA_MAX = 10;
/** Dos puntos no pueden quedar más cerca que esto (en x). */
export const SEPARACION_MINIMA = 0.02;

export type PresetCurva = {
	id: string;
	/** El rótulo de CapCut (es-LA.po). */
	etiqueta: string;
	puntos: PuntoCurva[];
};

// Rótulos: pc_custome_rate «Personalizado», montage_pc «Montaje», pc_new_hero
// «Héroe», bullet_time «Bala», pc_new_jump_cut «Corte en la edición»,
// pc_new_flash_in «Flash de entrada», pc_new_flash_out «Flash de salida».
export const PRESETS_CURVA: readonly PresetCurva[] = [
	{
		id: "personalizado",
		etiqueta: "Personalizado",
		puntos: [
			{ x: 0, y: 1 },
			{ x: 0.25, y: 1 },
			{ x: 0.5, y: 1 },
			{ x: 0.75, y: 1 },
			{ x: 1, y: 1 },
		],
	},
	{
		// Rápido–lento–rápido: dos tirones con una pausa larga en el medio.
		id: "montaje",
		etiqueta: "Montaje",
		puntos: [
			{ x: 0, y: 1 },
			{ x: 0.15, y: 5 },
			{ x: 0.4, y: 0.5 },
			{ x: 0.6, y: 0.5 },
			{ x: 0.85, y: 5 },
			{ x: 1, y: 1 },
		],
	},
	{
		// El «momento heroico»: rápido, cámara lenta en el centro, rápido.
		id: "heroe",
		etiqueta: "Héroe",
		puntos: [
			{ x: 0, y: 2 },
			{ x: 0.3, y: 2 },
			{ x: 0.45, y: 0.3 },
			{ x: 0.65, y: 0.3 },
			{ x: 0.8, y: 2 },
			{ x: 1, y: 2 },
		],
	},
	{
		// Bala: normal, casi congelado en el centro, normal.
		id: "bala",
		etiqueta: "Bala",
		puntos: [
			{ x: 0, y: 1 },
			{ x: 0.3, y: 1 },
			{ x: 0.42, y: 0.1 },
			{ x: 0.58, y: 0.1 },
			{ x: 0.7, y: 1 },
			{ x: 1, y: 1 },
		],
	},
	{
		// Corte en la edición (jump cut): normal, un salto muy rápido, normal.
		id: "salto",
		etiqueta: "Corte en la edición",
		puntos: [
			{ x: 0, y: 1 },
			{ x: 0.35, y: 1 },
			{ x: 0.45, y: 8 },
			{ x: 0.55, y: 8 },
			{ x: 0.65, y: 1 },
			{ x: 1, y: 1 },
		],
	},
	{
		id: "flash-entrada",
		etiqueta: "Flash de entrada",
		puntos: [
			{ x: 0, y: 8 },
			{ x: 0.15, y: 8 },
			{ x: 0.4, y: 1 },
			{ x: 1, y: 1 },
		],
	},
	{
		id: "flash-salida",
		etiqueta: "Flash de salida",
		puntos: [
			{ x: 0, y: 1 },
			{ x: 0.6, y: 1 },
			{ x: 0.85, y: 8 },
			{ x: 1, y: 8 },
		],
	},
];

export function presetCurva(id: string): PresetCurva | undefined {
	return PRESETS_CURVA.find((p) => p.id === id);
}

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Ordena, acota y completa los puntos: el primero en x=0 y el último en x=1
 * siempre (CapCut no deja mover los extremos en x), velocidades entre 0,1× y
 * 10×, sin dos puntos en la misma x.
 */
export function normalizarPuntos(puntos: readonly PuntoCurva[]): PuntoCurva[] {
	const validos = puntos
		.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
		.map((p) => ({
			x: acotar(p.x, 0, 1),
			y: acotar(p.y, VELOCIDAD_CURVA_MIN, VELOCIDAD_CURVA_MAX),
		}))
		.sort((a, b) => a.x - b.x);
	if (validos.length === 0) {
		return [
			{ x: 0, y: 1 },
			{ x: 1, y: 1 },
		];
	}
	const salida: PuntoCurva[] = [];
	for (const p of validos) {
		const ultimo = salida[salida.length - 1];
		if (ultimo && p.x - ultimo.x < 1e-6) {
			ultimo.y = p.y;
			continue;
		}
		salida.push({ ...p });
	}
	salida[0] = { x: 0, y: salida[0].y };
	if (salida.length === 1) salida.push({ x: 1, y: salida[0].y });
	salida[salida.length - 1] = { x: 1, y: salida[salida.length - 1].y };
	return salida;
}

// ── Interpolación (cúbica monótona sobre log2 de la velocidad) ──────────────

type Interpolador = { xs: number[]; ys: number[]; m: number[] };

function armarInterpolador(puntos: readonly PuntoCurva[]): Interpolador {
	const xs = puntos.map((p) => p.x);
	const ys = puntos.map((p) => Math.log2(p.y));
	const n = xs.length;
	const d: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		const h = xs[i + 1] - xs[i];
		d.push(h > 0 ? (ys[i + 1] - ys[i]) / h : 0);
	}
	const m: number[] = new Array(n).fill(0);
	if (n === 2) {
		m[0] = d[0];
		m[1] = d[0];
		return { xs, ys, m };
	}
	m[0] = d[0];
	m[n - 1] = d[n - 2];
	for (let i = 1; i < n - 1; i++) {
		// Pendiente cero en los picos y valles: la curva no se pasa del punto.
		m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
	}
	for (let i = 0; i < n - 1; i++) {
		if (d[i] === 0) {
			m[i] = 0;
			m[i + 1] = 0;
			continue;
		}
		const a = m[i] / d[i];
		const b = m[i + 1] / d[i];
		const s = a * a + b * b;
		if (s > 9) {
			const t = 3 / Math.sqrt(s);
			m[i] = t * a * d[i];
			m[i + 1] = t * b * d[i];
		}
	}
	return { xs, ys, m };
}

function evaluar(interp: Interpolador, u: number): number {
	const { xs, ys, m } = interp;
	const n = xs.length;
	if (u <= xs[0]) return ys[0];
	if (u >= xs[n - 1]) return ys[n - 1];
	let i = 0;
	while (i < n - 2 && u > xs[i + 1]) i++;
	const h = xs[i + 1] - xs[i];
	if (h <= 0) return ys[i];
	const t = (u - xs[i]) / h;
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		(2 * t3 - 3 * t2 + 1) * ys[i] +
		(t3 - 2 * t2 + t) * h * m[i] +
		(-2 * t3 + 3 * t2) * ys[i + 1] +
		(t3 - t2) * h * m[i + 1]
	);
}

// ── Tabla de la integral ────────────────────────────────────────────────────

const TRAMOS = 512;

type Tabla = {
	interp: Interpolador;
	/** F(i/TRAMOS), i = 0..TRAMOS. */
	integral: Float64Array;
	media: number;
};

const tablas = new Map<string, Tabla>();

function claveDe(puntos: readonly PuntoCurva[]): string {
	return puntos.map((p) => `${p.x.toFixed(5)}:${p.y.toFixed(5)}`).join("|");
}

function tablaDe(curva: { puntos: readonly PuntoCurva[] }): Tabla {
	const clave = claveDe(curva.puntos);
	const ya = tablas.get(clave);
	if (ya) return ya;

	const puntos = normalizarPuntos(curva.puntos);
	const interp = armarInterpolador(puntos);
	const integral = new Float64Array(TRAMOS + 1);
	let anterior = 2 ** evaluar(interp, 0);
	for (let i = 1; i <= TRAMOS; i++) {
		const v = 2 ** evaluar(interp, i / TRAMOS);
		integral[i] = integral[i - 1] + ((anterior + v) / 2) / TRAMOS;
		anterior = v;
	}
	const tabla: Tabla = { interp, integral, media: integral[TRAMOS] };
	// Pocas curvas vivas a la vez (las del proyecto y la que se arrastra): un
	// tope chico alcanza y no deja crecer la memoria mientras se edita.
	if (tablas.size >= 64) {
		const primera = tablas.keys().next().value;
		if (primera !== undefined) tablas.delete(primera);
	}
	tablas.set(clave, tabla);
	return tabla;
}

/** Velocidad de la curva en u (0–1 del clip). */
export function velocidadEnCurva(curva: { puntos: readonly PuntoCurva[] }, u: number): number {
	return 2 ** evaluar(tablaDe(curva).interp, acotar(u, 0, 1));
}

/** Velocidad media: la fuente recorrida por unidad de clip. */
export function mediaCurva(curva: { puntos: readonly PuntoCurva[] }): number {
	return tablaDe(curva).media;
}

/** F(u) = ∫₀ᵘ v: fracción de «clip × velocidad» recorrida hasta u (0–1). */
export function integralCurva(curva: { puntos: readonly PuntoCurva[] }, u: number): number {
	const { integral } = tablaDe(curva);
	const pos = acotar(u, 0, 1) * TRAMOS;
	const i = Math.min(TRAMOS - 1, Math.floor(pos));
	const resto = pos - i;
	return integral[i] + (integral[i + 1] - integral[i]) * resto;
}

/** La inversa de F: el u (0–1) en que la integral llega a f. */
export function inversaIntegralCurva(curva: { puntos: readonly PuntoCurva[] }, f: number): number {
	const { integral, media } = tablaDe(curva);
	if (f <= 0) return 0;
	if (f >= media) return 1;
	let bajo = 0;
	let alto = TRAMOS;
	while (alto - bajo > 1) {
		const medio = (bajo + alto) >> 1;
		if (integral[medio] <= f) bajo = medio;
		else alto = medio;
	}
	const tramo = integral[alto] - integral[bajo];
	const resto = tramo > 0 ? (f - integral[bajo]) / tramo : 0;
	return (bajo + resto) / TRAMOS;
}

/**
 * Parte la curva en u (al dividir el clip): cada mitad conserva los puntos que
 * le tocan, re-normalizados a su propio 0–1, más un punto en el corte con la
 * velocidad que había ahí.
 *
 * Con otros nudos, la interpolación de cada mitad no es EXACTAMENTE el tramo de
 * la curva original (medido: con «Montaje» partido al 37 %, la mitad izquierda
 * recorría 1,5 % más de fuente que la que le toca, y el clip mostraba al final
 * cuadros que ya son de la mitad derecha). Por eso cada mitad se escala para que
 * su velocidad media dé justo la fuente que le corresponde: la forma cambia un
 * pelo, el empalme queda exacto.
 */
export function partirCurva(
	curva: CurvaVelocidad,
	u: number,
): { izquierda: CurvaVelocidad; derecha: CurvaVelocidad } {
	if (u <= SEPARACION_MINIMA || u >= 1 - SEPARACION_MINIMA) {
		return { izquierda: curva, derecha: curva };
	}
	const puntos = normalizarPuntos(curva.puntos);
	const enCorte = velocidadEnCurva({ puntos }, u);
	const izquierda = [
		...puntos.filter((p) => p.x < u - 1e-6).map((p) => ({ x: p.x / u, y: p.y })),
		{ x: 1, y: enCorte },
	];
	const derecha = [
		{ x: 0, y: enCorte },
		...puntos
			.filter((p) => p.x > u + 1e-6)
			.map((p) => ({ x: (p.x - u) / (1 - u), y: p.y })),
	];
	const total = integralCurva({ puntos }, 1);
	const hastaCorte = integralCurva({ puntos }, u);
	return {
		izquierda: { preset: "personalizado", puntos: ajustarMedia(izquierda, hastaCorte / u) },
		derecha: {
			preset: "personalizado",
			puntos: ajustarMedia(derecha, (total - hastaCorte) / (1 - u)),
		},
	};
}

/** Escala las velocidades para que la media de la curva sea `media`. */
function ajustarMedia(puntos: PuntoCurva[], media: number): PuntoCurva[] {
	let actuales = normalizarPuntos(puntos);
	// Dos vueltas: el tope de 0,1×–10× puede comerse parte del ajuste de la primera.
	for (let vuelta = 0; vuelta < 2; vuelta++) {
		const actual = mediaCurva({ puntos: actuales });
		if (!(actual > 0) || Math.abs(actual - media) < 1e-9) break;
		const factor = media / actual;
		actuales = normalizarPuntos(actuales.map((p) => ({ x: p.x, y: p.y * factor })));
	}
	return actuales;
}
