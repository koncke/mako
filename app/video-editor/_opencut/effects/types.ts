import type { ParamDefinition, ParamValues } from "@/app/video-editor/_opencut/params";

export interface Effect {
	id: string;
	type: string;
	params: ParamValues;
	enabled: boolean;
}

export type EffectUniformValue = number | number[];

export interface EffectPass {
	shader: string;
	uniforms: Record<string, EffectUniformValue>;
}

export interface EffectPassTemplate {
	shader: string;
	uniforms(params: {
		effectParams: ParamValues;
		width: number;
		height: number;
	}): Record<string, EffectUniformValue>;
}

export interface EffectRendererConfig {
	passes: EffectPassTemplate[];
	buildPasses?: (params: {
		effectParams: ParamValues;
		width: number;
		height: number;
	}) => EffectPass[];
}

/**
 * Qué es el efecto en la copia de CapCut: decide en qué pestaña de la biblioteca
 * aparece, qué pestaña del panel derecho lo edita y el color de su clip.
 */
export type ClaseEfecto = "efecto" | "filtro" | "ajuste" | "croma";

export interface EffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: ParamDefinition[];
	renderer: EffectRendererConfig;
	/** Sin esto, un efecto de video («efecto»). */
	clase?: ClaseEfecto;
	/** La categoría de la biblioteca («Retro», «Paisaje»…), para la columna ▾. */
	categoria?: string;
	/**
	 * Un clip tiene a lo sumo UNO de este grupo: agregar otro lo reemplaza en su
	 * lugar (CapCut: un filtro nuevo sobre un clip pisa al anterior, «Se
	 * reemplazó el filtro»). Sin grupo, se apilan.
	 */
	grupoUnico?: string;
	/** Cambia con el tiempo: la miniatura se anima al pasar el mouse. */
	animado?: boolean;
}
