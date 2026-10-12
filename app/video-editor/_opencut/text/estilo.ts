// =============================================================================
// El estilo de CapCut de un texto: May./min., Trazo, Sombra y la opacidad del Fondo
// =============================================================================
// Lee los parámetros de params/extra/texto.ts de un elemento y los deja en una
// forma que el dibujo (./dibujar.ts) usa sin volver a mirar `params`. Las
// medidas siguen en unidades de pantalla (0–100); el paso a píxeles va en el
// dibujo, que sabe el tamaño de la letra.

import { converter, parse } from "culori";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	DEFAULTS_TEXTO,
	TEXTO,
	type Mayusculas,
	type PosicionTrazo,
} from "@/app/video-editor/_opencut/params/extra/texto";

export type EstiloTexto = {
	trazo: { color: string; grosor: number; posicion: PosicionTrazo } | null;
	sombra: {
		color: string;
		/** 0–1 */
		opacidad: number;
		desenfoque: number;
		distancia: number;
		/** Grados, 0 = a la derecha, positivo = hacia arriba (CapCut: −45° = abajo a la derecha). */
		angulo: number;
	} | null;
	/** 0–1, multiplica el alfa del color del fondo. */
	fondoOpacidad: number;
	brillo: {
		color: string;
		/** 0–1 */
		intensidad: number;
		/** 0–100, cuánto se abre el halo. */
		intervalo: number;
	} | null;
	/**
	 * −100…100 (0 = recto). `null` también si el texto tiene fondo o subrayado:
	 * CapCut no los curva («El texto con fondo no se puede curvar»), y acá el
	 * dibujo los deja rectos en vez de dibujar un fondo recto bajo letras curvas.
	 */
	curva: { fuerza: number } | null;
};

const numero = (params: ParamValues, clave: string, fallback: number) => {
	const v = params[clave];
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
const texto = (params: ParamValues, clave: string, fallback: string) => {
	const v = params[clave];
	return typeof v === "string" && v ? v : fallback;
};

export function leerEstiloTexto(params: ParamValues): EstiloTexto {
	const grosor = numero(params, TEXTO.trazoGrosor, DEFAULTS_TEXTO.trazoGrosor);
	const posicion = texto(params, TEXTO.trazoPosicion, DEFAULTS_TEXTO.trazoPosicion);
	const trazo =
		params[TEXTO.trazoActivo] === true && grosor > 0
			? {
					color: texto(params, TEXTO.trazoColor, DEFAULTS_TEXTO.trazoColor),
					grosor,
					posicion: (posicion === "dentro" || posicion === "centro" ? posicion : "fuera") as PosicionTrazo,
				}
			: null;
	const opacidadSombra = numero(params, TEXTO.sombraOpacidad, DEFAULTS_TEXTO.sombraOpacidad) / 100;
	const sombra =
		params[TEXTO.sombraActiva] === true && opacidadSombra > 0
			? {
					color: texto(params, TEXTO.sombraColor, DEFAULTS_TEXTO.sombraColor),
					opacidad: Math.min(1, opacidadSombra),
					desenfoque: Math.max(0, numero(params, TEXTO.sombraDesenfoque, DEFAULTS_TEXTO.sombraDesenfoque)),
					distancia: Math.max(0, numero(params, TEXTO.sombraDistancia, DEFAULTS_TEXTO.sombraDistancia)),
					angulo: numero(params, TEXTO.sombraAngulo, DEFAULTS_TEXTO.sombraAngulo),
				}
			: null;
	const intensidadBrillo = numero(params, TEXTO.brilloIntensidad, DEFAULTS_TEXTO.brilloIntensidad) / 100;
	const brillo =
		params[TEXTO.brilloActivo] === true && intensidadBrillo > 0
			? {
					color: texto(params, TEXTO.brilloColor, DEFAULTS_TEXTO.brilloColor),
					intensidad: Math.min(1, intensidadBrillo),
					intervalo: Math.max(0, Math.min(100, numero(params, TEXTO.brilloIntervalo, DEFAULTS_TEXTO.brilloIntervalo))),
				}
			: null;
	const fuerza = Math.max(-100, Math.min(100, numero(params, TEXTO.curvaFuerza, DEFAULTS_TEXTO.curvaFuerza)));
	const curva =
		params[TEXTO.curvaActiva] === true && Math.abs(fuerza) >= 1 && !curvaBloqueada(params) ? { fuerza } : null;
	return {
		trazo,
		sombra,
		fondoOpacidad: Math.max(0, Math.min(1, numero(params, TEXTO.fondoOpacidad, DEFAULTS_TEXTO.fondoOpacidad) / 100)),
		brillo,
		curva,
	};
}

/**
 * Por qué no se puede curvar este texto, con el rótulo de CapCut, o `null` si
 * se puede (`pc_text_bend_background_unavailable`, `…_underline_unavailable`).
 */
export function curvaBloqueada(params: ParamValues): string | null {
	if (params["background.enabled"] === true) return "El texto con fondo no se puede curvar";
	if (params.textDecoration === "underline" || params.textDecoration === "line-through") {
		return "El texto subrayado no se puede curvar";
	}
	return null;
}

// ── De la escala de la pantalla a píxeles ────────────────────────────────────
// En proporción a la letra ya escalada al lienzo (`scaledFontSize`). Los topes
// salen de mirar el máximo de CapCut: un trazo de 100 es grueso pero la letra se
// sigue leyendo; una sombra a distancia 100 se despega una letra entera.

/** El ancho del trazo (lo que se ve del borde), en px del lienzo. */
export const pxTrazo = (grosor: number, fontPx: number) => (grosor / 100) * 0.2 * fontPx;
/** Lo que sobresale el trazo del contorno de la letra. */
export function sobresaleTrazo(estilo: EstiloTexto, fontPx: number): number {
	if (!estilo.trazo) return 0;
	const w = pxTrazo(estilo.trazo.grosor, fontPx);
	return estilo.trazo.posicion === "fuera" ? w : estilo.trazo.posicion === "centro" ? w / 2 : 0;
}
export const pxDistanciaSombra = (distancia: number, fontPx: number) => (distancia / 100) * fontPx;
export const pxDesenfoqueSombra = (desenfoque: number, fontPx: number) => (desenfoque / 100) * 0.3 * fontPx;
/** El desenfoque del halo del Brillo: con 0 igual se ve un borde de luz pegado a la letra. */
export const pxIntervaloBrillo = (intervalo: number, fontPx: number) => (0.04 + (intervalo / 100) * 0.5) * fontPx;
/**
 * Cuántas veces se apila el halo y con qué alfa: una sola pasada de la sombra
 * de canvas es tenue (el desenfoque gaussiano reparte el color), y CapCut a
 * intensidad 100 es un halo pleno.
 */
export function pasadasBrillo(intensidad: number): { pasadas: number; alfa: number } {
	return { pasadas: 1 + Math.round(intensidad * 2), alfa: 0.35 + 0.65 * intensidad };
}

// ── May./min. ────────────────────────────────────────────────────────────────

export function leerMayusculas(params: ParamValues): Mayusculas {
	const v = params[TEXTO.mayusculas];
	return v === "mayusculas" || v === "minusculas" || v === "titulo" ? v : "ninguno";
}

/**
 * «Mayúscula», «Minúscula», «Tipo título». Se aplica al MEDIR (no sólo al
 * dibujar): «MAYÚSCULA» es más ancha que «mayúscula» y el recuadro de selección
 * y el fondo tienen que medir lo que se ve. El contenido guardado no cambia.
 */
export function aplicarMayusculas(contenido: string, modo: Mayusculas): string {
	if (modo === "mayusculas") return contenido.toLocaleUpperCase("es");
	if (modo === "minusculas") return contenido.toLocaleLowerCase("es");
	if (modo === "titulo") {
		return contenido
			.toLocaleLowerCase("es")
			.replace(/(^|[\s\-–—¿¡("'«])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase("es"));
	}
	return contenido;
}

// ── Colores ──────────────────────────────────────────────────────────────────

const aRgb = converter("rgb");

/** El color con su alfa multiplicado por `factor` («Opacidad» de la sombra y del fondo). */
export function colorConAlfa(color: string, factor: number): string {
	if (factor >= 1) return color;
	const rgb = aRgb(parse(color));
	if (!rgb) return color;
	const a = (rgb.alpha ?? 1) * Math.max(0, factor);
	const canal = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
	return `rgba(${canal(rgb.r)}, ${canal(rgb.g)}, ${canal(rgb.b)}, ${Math.round(a * 1000) / 1000})`;
}
