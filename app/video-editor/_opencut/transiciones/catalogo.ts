// =============================================================================
// El catálogo de transiciones: qué le pasa a cada clip en cada instante
// =============================================================================
// Una transición NO es un shader de dos entradas: el render compone capas (el
// WASM) y cada capa corre sus pases sola (pases-ce.ts). Entonces cada transición
// dice, para el progreso p (0 → 1) de la ventana, cómo queda la capa del clip que
// SALE (el de la izquierda, «sale») y la del que ENTRA («entra»): opacidad,
// transformación (posición, escala, giro) y pases `ce-tr-*` de una entrada
// (./shaders.ts). El que entra se dibuja ENCIMA (va después en la pista), así que
// los barridos y el círculo son una máscara sobre él y la mezcla es su opacidad.
//
// LA REGLA QUE NO SE VE: el que sale en p = 0 y el que entra en p = 1 tienen que
// quedar EXACTAMENTE como sin transición (identidad), o el clip pega un salto al
// entrar o salir de la ventana. Lo verifica tests/video-editor-transiciones.test.ts.
//
// Los nombres de las transiciones de CapCut vienen de su servidor y no están en
// el es-LA.po (como los de efectos y filtros): son nuestros, en español neutro.
// Las categorías sí son las de CapCut (relevamiento-capcut-armazon.md §3.2).

import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import type { EstadoVisual } from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import {
	MASCARA_BARRIDO,
	MASCARA_CIRCULO,
	MASCARA_PERSIANAS,
	PASE_COLOR,
	PASE_DESENFOQUE,
	PASE_GLITCH,
	PASE_MASCARA,
	PASE_PIXELADO,
	PASE_ZOOM,
} from "./shaders";

export type RolTransicion = "sale" | "entra";

// En el orden de la columna de CapCut (Básico, Cámara, Efecto, Redes sociales,
// MG, Deslizar, Máscara): «Redes sociales» y «MG» son plantillas animadas de su
// servidor y no se copian.
export const CATEGORIAS_TRANSICION = ["Básico", "Cámara", "Efecto", "Deslizar", "Máscara"] as const;
export type CategoriaTransicion = (typeof CATEGORIAS_TRANSICION)[number];

export type Lienzo = { width: number; height: number };

export type DefinicionTransicion = {
	id: string;
	nombre: string;
	categoria: CategoriaTransicion;
	/** Palabras extra para el buscador. */
	claves?: string[];
	/** La capa de `rol` en el progreso `p` (0..1), a partir de su estado sin transición. */
	aplicar: (rol: RolTransicion, p: number, estado: EstadoVisual, lienzo: Lienzo) => EstadoVisual;
};

// ── Curvas y piezas ──────────────────────────────────────────────────────────

const acotar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
/** El tramo [a, b] de p llevado a 0..1. */
export const tramo = (p: number, a: number, b: number) => acotar((p - a) / (b - a));
/** Suave en las dos puntas (smoothstep). */
export const suave = (t: number) => {
	const x = acotar(t);
	return x * x * (3 - 2 * x);
};
const acelera = (t: number) => acotar(t) ** 3;
const frena = (t: number) => 1 - (1 - acotar(t)) ** 3;
const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;

function mover(e: EstadoVisual, dx: number, dy: number): EstadoVisual {
	if (dx === 0 && dy === 0) return e;
	return {
		...e,
		transform: {
			...e.transform,
			position: { x: e.transform.position.x + dx, y: e.transform.position.y + dy },
		},
	};
}

/** Multiplica la escala conservando el signo (el del reflejo, que ya corrió). */
function escalar(e: EstadoVisual, f: number): EstadoVisual {
	if (f === 1) return e;
	return { ...e, transform: { ...e.transform, scaleX: e.transform.scaleX * f, scaleY: e.transform.scaleY * f } };
}

function girar(e: EstadoVisual, grados: number): EstadoVisual {
	if (grados === 0) return e;
	return { ...e, transform: { ...e.transform, rotate: e.transform.rotate + grados } };
}

function opacar(e: EstadoVisual, f: number): EstadoVisual {
	if (f === 1) return e;
	return { ...e, opacity: e.opacity * acotar(f) };
}

function conPase(e: EstadoVisual, pase: EffectPass | null): EstadoVisual {
	if (!pase) return e;
	return { ...e, pases: [...(e.pases ?? []), pase] };
}

/** Un pase que en su valor neutro no corre (cuesta una vuelta de GPU por cuadro). */
const paseColor = (color: [number, number, number], cantidad: number): EffectPass | null =>
	cantidad <= 0 ? null : { shader: PASE_COLOR, uniforms: { u_color: color, u_cantidad: cantidad } };
const paseDesenfoque = (radio: number): EffectPass | null =>
	radio <= 0.0005 ? null : { shader: PASE_DESENFOQUE, uniforms: { u_radio: radio } };
const paseZoom = (fuerza: number): EffectPass | null =>
	fuerza <= 0.001 ? null : { shader: PASE_ZOOM, uniforms: { u_fuerza: fuerza } };
const paseMascara = (modo: number, progreso: number, direccion: [number, number], suavidad: number): EffectPass | null =>
	progreso >= 1
		? null
		: {
				shader: PASE_MASCARA,
				uniforms: { u_modo: modo, u_progreso: progreso, u_direccion: direccion, u_suavidad: suavidad },
			};
const pasePixelado = (bloque: number): EffectPass | null =>
	bloque <= 0.002 ? null : { shader: PASE_PIXELADO, uniforms: { u_bloque: bloque } };
const paseGlitch = (intensidad: number, semilla: number): EffectPass | null =>
	intensidad <= 0.001 ? null : { shader: PASE_GLITCH, uniforms: { u_intensidad: intensidad, u_semilla: semilla } };

/**
 * Cuánto hay que agrandar una capa que llena el lienzo para que, girada
 * `grados`, lo siga cubriendo sin dejar esquinas vacías.
 */
export function escalaQueCubre(grados: number, lienzo: Lienzo): number {
	const r = (grados * Math.PI) / 180;
	const c = Math.abs(Math.cos(r));
	const s = Math.abs(Math.sin(r));
	const { width: w, height: h } = lienzo;
	if (w <= 0 || h <= 0) return 1;
	return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
}

const NEGRO: [number, number, number] = [0, 0, 0];
const BLANCO: [number, number, number] = [1, 1, 1];

/** Mitad y mitad: el que sale va al color, el que entra vuelve de él. */
function haciaColor(color: [number, number, number], curva: (t: number) => number) {
	return (rol: RolTransicion, p: number, e: EstadoVisual): EstadoVisual => {
		if (rol === "sale") {
			if (p >= 0.5) return opacar(e, 0);
			return conPase(e, paseColor(color, curva(tramo(p, 0, 0.5))));
		}
		if (p < 0.5) return opacar(e, 0);
		return conPase(e, paseColor(color, curva(1 - tramo(p, 0.5, 1))));
	};
}

/** El que entra se desliza desde afuera (dx, dy en lienzos) y queda en su lugar. */
function deslizar(dx: number, dy: number) {
	return (rol: RolTransicion, p: number, e: EstadoVisual, l: Lienzo): EstadoVisual => {
		if (rol === "sale") return e;
		const falta = 1 - frena(p);
		return mover(e, dx * l.width * falta, dy * l.height * falta);
	};
}

/** Los dos se corren juntos: el que sale se va y el que entra lo empuja. */
function empujar(dx: number, dy: number) {
	return (rol: RolTransicion, p: number, e: EstadoVisual, l: Lienzo): EstadoVisual => {
		const t = suave(p);
		if (rol === "sale") return mover(e, -dx * l.width * t, -dy * l.height * t);
		return mover(e, dx * l.width * (1 - t), dy * l.height * (1 - t));
	};
}

/**
 * Una dirección de la PANTALLA (y hacia arriba) llevada a los uv de la capa.
 * El pase corre sobre la fuente, ANTES de que el compositor la voltee (Reflejar)
 * y la gire: sin esto, «Barrido a la izquierda» sobre un clip reflejado barría
 * hacia la derecha. La pantalla es R(−giro)·volteo·capa (el giro de la
 * transformación es horario en pantalla), así que la capa es volteo·R(giro)·pantalla.
 * Por eso el gancho corre después del reflejo (./gancho.ts): el signo de la
 * escala ya es el final.
 */
export function direccionEnCapa(dir: [number, number], e: EstadoVisual): [number, number] {
	const r = (e.transform.rotate * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	const x = c * dir[0] - s * dir[1];
	const y = s * dir[0] + c * dir[1];
	const limpio = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
	return [
		limpio(e.transform.scaleX < 0 ? -x : x),
		limpio(e.transform.scaleY < 0 ? -y : y),
	];
}

/** Un barrido: el borde del que entra viaja en `dir` (de la pantalla, y hacia arriba). */
function barrido(dir: [number, number]) {
	return (rol: RolTransicion, p: number, e: EstadoVisual): EstadoVisual =>
		rol === "sale" ? e : conPase(e, paseMascara(MASCARA_BARRIDO, suave(p), direccionEnCapa(dir, e), 0.04));
}

// ── El catálogo ──────────────────────────────────────────────────────────────

export const TRANSICIONES: readonly DefinicionTransicion[] = [
	// Básico
	{
		id: "mezclar",
		nombre: "Mezclar",
		categoria: "Básico",
		claves: ["disolver", "fundido", "cruzado", "mix"],
		aplicar: (rol, p, e) => (rol === "sale" ? e : opacar(e, suave(p))),
	},
	{
		id: "fundido-negro",
		nombre: "Fundido a negro",
		categoria: "Básico",
		claves: ["negro", "oscuro"],
		aplicar: haciaColor(NEGRO, suave),
	},
	{
		id: "destello-blanco",
		nombre: "Destello blanco",
		categoria: "Básico",
		claves: ["blanco", "flash", "fundido a blanco"],
		aplicar: haciaColor(BLANCO, (t) => acotar(t) ** 2),
	},
	{
		id: "desenfoque",
		nombre: "Desenfoque",
		categoria: "Básico",
		claves: ["desenfocar", "blur"],
		aplicar: (rol, p, e) => {
			if (rol === "sale") return conPase(e, paseDesenfoque(0.035 * suave(tramo(p, 0, 0.6))));
			return conPase(opacar(e, suave(tramo(p, 0.3, 0.7))), paseDesenfoque(0.035 * (1 - suave(tramo(p, 0.4, 1)))));
		},
	},
	// Cámara
	{
		id: "acercar",
		nombre: "Acercar",
		categoria: "Cámara",
		claves: ["zoom", "acercamiento"],
		aplicar: (rol, p, e) => {
			if (rol === "sale") return conPase(escalar(e, mezcla(1, 2.2, acelera(p))), paseZoom(0.6 * suave(tramo(p, 0, 0.5))));
			const llega = escalar(opacar(e, suave(tramo(p, 0.3, 0.6))), mezcla(0.6, 1, frena(p)));
			return conPase(llega, paseZoom(0.6 * (1 - suave(tramo(p, 0.5, 1)))));
		},
	},
	{
		id: "alejar",
		nombre: "Alejar",
		categoria: "Cámara",
		claves: ["zoom", "alejamiento"],
		aplicar: (rol, p, e) => {
			if (rol === "sale") return conPase(escalar(e, mezcla(1, 0.6, acelera(p))), paseZoom(0.6 * suave(tramo(p, 0, 0.5))));
			const llega = escalar(opacar(e, suave(tramo(p, 0.2, 0.55))), mezcla(1.8, 1, frena(p)));
			return conPase(llega, paseZoom(0.6 * (1 - suave(tramo(p, 0.45, 1)))));
		},
	},
	{
		id: "girar",
		nombre: "Girar",
		categoria: "Cámara",
		claves: ["rotar", "giro", "remolino"],
		aplicar: (rol, p, e, l) => {
			const movido = 0.5 * Math.sin(Math.PI * acotar(p));
			if (rol === "sale") {
				const grados = 120 * acelera(p);
				return conPase(escalar(girar(e, grados), escalaQueCubre(grados, l)), paseZoom(movido));
			}
			const grados = -120 * (1 - frena(p));
			const llega = escalar(girar(opacar(e, suave(tramo(p, 0.4, 0.6))), grados), escalaQueCubre(grados, l));
			return conPase(llega, paseZoom(movido));
		},
	},
	// Efecto
	{
		id: "glitch",
		nombre: "Glitch",
		categoria: "Efecto",
		claves: ["fallo", "interferencia", "señal"],
		aplicar: (rol, p, e) => {
			// Corte seco en la mitad, con el fallo creciendo hasta ahí y apagándose después.
			const semilla = Math.floor(acotar(p) * 14);
			if (rol === "sale") return conPase(e, paseGlitch(suave(tramo(p, 0, 0.5)), semilla));
			if (p < 0.5) return opacar(e, 0);
			return conPase(e, paseGlitch(1 - suave(tramo(p, 0.5, 1)), semilla));
		},
	},
	{
		id: "pixelado",
		nombre: "Pixelado",
		categoria: "Efecto",
		claves: ["pixeles", "mosaico"],
		aplicar: (rol, p, e) => {
			if (rol === "sale") return conPase(e, pasePixelado(0.08 * suave(tramo(p, 0, 0.5))));
			return conPase(opacar(e, suave(tramo(p, 0.4, 0.6))), pasePixelado(0.08 * (1 - suave(tramo(p, 0.5, 1)))));
		},
	},
	// Deslizar
	{ id: "deslizar-izquierda", nombre: "Deslizar a la izquierda", categoria: "Deslizar", aplicar: deslizar(1, 0) },
	{ id: "deslizar-derecha", nombre: "Deslizar a la derecha", categoria: "Deslizar", aplicar: deslizar(-1, 0) },
	// La posición va en px del lienzo con y hacia ABAJO (frame-descriptor: centerY = alto/2 + y).
	{ id: "deslizar-arriba", nombre: "Deslizar hacia arriba", categoria: "Deslizar", aplicar: deslizar(0, 1) },
	{ id: "deslizar-abajo", nombre: "Deslizar hacia abajo", categoria: "Deslizar", aplicar: deslizar(0, -1) },
	{ id: "empujar-izquierda", nombre: "Empujar a la izquierda", categoria: "Deslizar", claves: ["empujar"], aplicar: empujar(1, 0) },
	{ id: "empujar-derecha", nombre: "Empujar a la derecha", categoria: "Deslizar", claves: ["empujar"], aplicar: empujar(-1, 0) },
	// Máscara: la dirección es de la PANTALLA con y hacia ARRIBA (la de los uv del
	// pase), y `direccionEnCapa` la lleva a la capa volteada o girada.
	{ id: "barrido-izquierda", nombre: "Barrido a la izquierda", categoria: "Máscara", claves: ["cortinilla", "wipe"], aplicar: barrido([-1, 0]) },
	{ id: "barrido-derecha", nombre: "Barrido a la derecha", categoria: "Máscara", claves: ["cortinilla", "wipe"], aplicar: barrido([1, 0]) },
	{ id: "barrido-arriba", nombre: "Barrido hacia arriba", categoria: "Máscara", claves: ["cortinilla", "wipe"], aplicar: barrido([0, 1]) },
	{ id: "barrido-abajo", nombre: "Barrido hacia abajo", categoria: "Máscara", claves: ["cortinilla", "wipe"], aplicar: barrido([0, -1]) },
	{
		id: "circulo",
		nombre: "Círculo",
		categoria: "Máscara",
		claves: ["iris", "redondo"],
		aplicar: (rol, p, e) => (rol === "sale" ? e : conPase(e, paseMascara(MASCARA_CIRCULO, suave(p), [1, 0], 0.03))),
	},
	{
		id: "persianas",
		nombre: "Persianas",
		categoria: "Máscara",
		claves: ["franjas", "rayas"],
		aplicar: (rol, p, e) => (rol === "sale" ? e : conPase(e, paseMascara(MASCARA_PERSIANAS, suave(p), direccionEnCapa([1, 0], e), 0.08))),
	},
];

const porId = new Map(TRANSICIONES.map((t) => [t.id, t]));

export function transicionPorId(id: string | null | undefined): DefinicionTransicion | null {
	return id ? (porId.get(id) ?? null) : null;
}
