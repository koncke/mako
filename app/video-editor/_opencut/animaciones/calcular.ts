// =============================================================================
// Animación: de los parámetros del elemento a la pose de ESTE cuadro
// =============================================================================
// Lo usan el gancho visual (./gancho.ts), la medida del texto (la «Máquina de
// escribir» revela caracteres: text/measure-element.ts) y las miniaturas del
// panel. Todo en SEGUNDOS: el gancho ya los recibe así (ganchos-ce.ts).
//
// Los tramos, como CapCut:
//   [0, entrada)            la Entrada
//   [D − salida, D)         la Salida
//   [0, combo)              el Combinado (excluye Entrada y Salida)
//   [entrada, D − salida)   el Bucle, repetido con período `duracion`
// Si Entrada + Salida no entran en el clip (se acortó después de elegirlas), la
// Salida cede: lo que se ve primero es lo que el cliente eligió primero.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { Transform } from "@/app/video-editor/_opencut/rendering";
import { ANIM } from "@/app/video-editor/_opencut/params/extra/animaciones";
import {
	POSE_IDENTIDAD,
	componerPoses,
	presetAnimacion,
	type CategoriaAnimacion,
	type Pose,
	type PresetAnimacion,
} from "./catalogo";

type Activa = { preset: PresetAnimacion; duracion: number };

function leerActiva(params: ParamValues, categoria: CategoriaAnimacion): Activa | null {
	const preset = presetAnimacion(categoria, params[ANIM[categoria].id]);
	if (!preset) return null;
	const crudo = params[ANIM[categoria].duracion];
	const duracion = typeof crudo === "number" && Number.isFinite(crudo) ? crudo : preset.duracion;
	return duracion > 0 ? { preset, duracion } : null;
}

/** Duraciones efectivas, ya acotadas al largo del clip. */
export function tramosAnimacion(
	params: ParamValues,
	duracionClip: number,
): {
	entrada: Activa | null;
	salida: Activa | null;
	combo: Activa | null;
	bucle: Activa | null;
} {
	const D = Math.max(0, duracionClip);
	const entrada = leerActiva(params, "entrada");
	const salida = leerActiva(params, "salida");
	const combo = leerActiva(params, "combo");
	const bucle = leerActiva(params, "bucle");
	const dEntrada = entrada ? Math.min(entrada.duracion, D) : 0;
	const dSalida = salida ? Math.min(salida.duracion, Math.max(0, D - dEntrada)) : 0;
	return {
		entrada: entrada && dEntrada > 0 ? { ...entrada, duracion: dEntrada } : null,
		salida: salida && dSalida > 0 ? { ...salida, duracion: dSalida } : null,
		combo: combo ? { ...combo, duracion: Math.min(combo.duracion, D) } : null,
		bucle,
	};
}

/** La pose de un elemento en el segundo `t` de un clip de `D` segundos. */
export function poseEn(params: ParamValues, t: number, D: number, texto: boolean): Pose {
	const { entrada, salida, combo, bucle } = tramosAnimacion(params, D);
	if (!entrada && !salida && !combo && !bucle) return POSE_IDENTIDAD;
	const opciones = { texto };
	let pose = POSE_IDENTIDAD;

	if (combo && combo.duracion > 0 && t < combo.duracion) {
		pose = componerPoses(pose, combo.preset.pose(t / combo.duracion, opciones));
	}
	const finEntrada = entrada?.duracion ?? 0;
	const inicioSalida = D - (salida?.duracion ?? 0);
	if (entrada && t < finEntrada) {
		pose = componerPoses(pose, entrada.preset.pose(t / entrada.duracion, opciones));
	}
	if (salida && t >= inicioSalida) {
		pose = componerPoses(pose, salida.preset.pose((t - inicioSalida) / salida.duracion, opciones));
	}
	if (bucle && bucle.duracion > 0 && t >= finEntrada && t < inicioSalida) {
		const fase = ((t - finEntrada) / bucle.duracion) % 1;
		pose = componerPoses(pose, bucle.preset.pose(fase, opciones));
	}
	return pose;
}

const ESCALA_MINIMA = 0.01;

/**
 * Aplica una pose a la transformación y la opacidad del cuadro. Lo demás del
 * estado (los `pases` que suma otro gancho visual, ganchos-ce.ts) pasa tal cual.
 */
export function aplicarPose<E extends { transform: Transform; opacity: number }>(
	estado: E,
	pose: Pose,
	lienzo: { width: number; height: number },
): E {
	if (pose === POSE_IDENTIDAD) return estado;
	const { transform } = estado;
	// La escala conserva el SIGNO: el reflejo (orden 1000) la da vuelta después,
	// pero un keyframe o un clip ya reflejado pueden traerla negativa.
	const escalar = (valor: number, factor: number) => {
		const absoluto = Math.max(ESCALA_MINIMA, Math.abs(valor * factor));
		return valor < 0 ? -absoluto : absoluto;
	};
	return {
		...estado,
		transform: {
			...transform,
			position: {
				x: transform.position.x + pose.dx * lienzo.width,
				y: transform.position.y + pose.dy * lienzo.height,
			},
			scaleX: escalar(transform.scaleX, pose.escala * pose.escalaX),
			scaleY: escalar(transform.scaleY, pose.escala * pose.escalaY),
			rotate: transform.rotate + pose.giro,
		},
		opacity: Math.max(0, Math.min(1, estado.opacity * pose.opacidad)),
	};
}

// ── Texto que se revela («Máquina de escribir», «Palabra por palabra») ──────

export type RevelacionTexto = {
	/** 0 = nada, 1 = todo. */
	fraccion: number;
	modo: "caracter" | "palabra";
};

/** `null` si el texto se ve entero en este instante (lo común). */
export function revelacionTexto(params: ParamValues, t: number, D: number): RevelacionTexto | null {
	const { entrada, salida } = tramosAnimacion(params, D);
	if (entrada?.preset.revela && t < entrada.duracion) {
		return { fraccion: Math.max(0, t / entrada.duracion), modo: entrada.preset.revela };
	}
	if (salida?.preset.revela) {
		const inicio = D - salida.duracion;
		if (t >= inicio) {
			return { fraccion: Math.max(0, 1 - (t - inicio) / salida.duracion), modo: salida.preset.revela };
		}
	}
	return null;
}

/** ¿El parámetro tiene una animación que se vea? (para el ◇ de la línea de tiempo, etc.). */
export function tieneAnimacion(params: ParamValues): boolean {
	return (
		presetAnimacion("entrada", params[ANIM.entrada.id]) !== null ||
		presetAnimacion("salida", params[ANIM.salida.id]) !== null ||
		presetAnimacion("combo", params[ANIM.combo.id]) !== null ||
		presetAnimacion("bucle", params[ANIM.bucle.id]) !== null
	);
}
