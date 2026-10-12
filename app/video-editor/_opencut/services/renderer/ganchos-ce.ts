// =============================================================================
// Los GANCHOS del render — dónde se enchufan las funciones de la copia de CapCut
// =============================================================================
// Las animaciones de entrada/salida, las transiciones, el reflejo, el recorte,
// el croma, los filtros, los ajustes y quitar el fondo tocan TODAS el mismo
// camino del render (scene-builder → resolve → frame-descriptor). Si cada una
// editara esas funciones, se pisarían. En vez de eso el motor llama a estos
// ganchos en dos puntos fijos, y cada función registra el suyo desde su archivo:
//
//   1. GANCHO VISUAL (resolve.ts → resolveVisualState): después de calcular la
//      transformación y la opacidad del cuadro (keyframes incluidos), cada gancho
//      puede modificarlas. Ahí van las animaciones de entrada/salida/combo, el
//      reflejo (escala negativa = flip en el compositor) y la parte geométrica de
//      una transición.
//
//   2. GANCHO DE FUENTE (frame-descriptor.ts → collectVisualSourceNode): antes de
//      subir el cuadro decodificado al compositor, cada gancho puede devolver OTRA
//      imagen (y otro tamaño). Ahí van el recorte, quitar el fondo y cualquier
//      proceso por píxel que no sea un pase de shader. Los pases `ce-*` de los
//      efectos (filtros, ajustes, croma) se aplican acá también, automáticamente:
//      ver `preaplicarPasesCe`.
//
// Los ganchos reciben los `params` del ELEMENTO (los de params/registry + los de
// params/extra), así que una función declara su parámetro y lo lee acá, sin
// tocar los tipos de la línea de tiempo. Corren en el orden de `orden`.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { Transform } from "@/app/video-editor/_opencut/rendering";
import type { EffectPass } from "@/app/video-editor/_opencut/effects/types";
import { aplicarPasesCe, esPaseCe } from "./pases-ce";

// ── 1. Gancho visual ─────────────────────────────────────────────────────────

export type EstadoVisual = {
	transform: Transform;
	opacity: number;
	/**
	 * Pases `ce-*` de UNA entrada que el gancho le suma a la capa, después de los
	 * efectos del clip (las transiciones: una máscara de alfa, un desenfoque, un
	 * fundido a un color). Un gancho que arma el estado de nuevo conserva los que
	 * ya traía (`{ ...estado, transform }`).
	 */
	pases?: EffectPass[];
};

export type ContextoVisual = {
	/** `element.params` del elemento (vacío para nodos que no vienen de uno). */
	params: ParamValues;
	elementoId: string | undefined;
	/** Segundos desde el inicio del clip y duración del clip, en segundos. */
	localTime: number;
	duration: number;
	/**
	 * Segundos desde el inicio del clip SIN acotar (`localTime` va de 0 a la
	 * duración): durante una transición el clip se dibuja también un poco antes de
	 * empezar (negativo) o después de terminar (más que `duration`).
	 */
	tiempoClip?: number;
	/** Tamaño del lienzo del proyecto. */
	lienzo: { width: number; height: number };
};

type GanchoVisual = {
	id: string;
	orden: number;
	aplicar: (estado: EstadoVisual, ctx: ContextoVisual) => EstadoVisual;
};

const ganchosVisual = new Map<string, GanchoVisual>();

export function registrarGanchoVisual(gancho: GanchoVisual): void {
	ganchosVisual.set(gancho.id, gancho);
}

export function aplicarGanchosVisual(estado: EstadoVisual, ctx: ContextoVisual): EstadoVisual {
	if (ganchosVisual.size === 0) return estado;
	let actual = estado;
	for (const g of [...ganchosVisual.values()].sort((a, b) => a.orden - b.orden)) {
		try {
			actual = g.aplicar(actual, ctx);
		} catch (error) {
			// Un gancho roto no puede dejar la pantalla en negro: se salta y avisa.
			console.error(`[ganchos-ce] el gancho visual «${g.id}» falló`, error);
		}
	}
	return actual;
}

// ── 2. Gancho de fuente ──────────────────────────────────────────────────────

export type FuenteVisual = {
	source: CanvasImageSource;
	width: number;
	height: number;
};

export type ContextoFuente = ContextoVisual & { tipo: "video" | "image" | "sticker" | "graphic" };

type GanchoFuente = {
	id: string;
	orden: number;
	/**
	 * Opcional: lo que el gancho necesita listo ANTES de este cuadro (un modelo
	 * que se baja, como el de quitar el fondo). El render lo ESPERA, así el primer
	 * cuadro de un export ya sale con el gancho aplicado en vez de salir crudo
	 * mientras carga. Devuelve una promesa sólo si hay algo que esperar (lo común
	 * es `undefined`: no cuesta nada por cuadro), y nunca la rechaza.
	 */
	preparar?: (ctx: ContextoFuente) => Promise<void> | void;
	/** Devuelve `null` si no tiene nada que hacer con este cuadro (lo común). */
	aplicar: (fuente: FuenteVisual, ctx: ContextoFuente) => FuenteVisual | null;
};

const ganchosFuente = new Map<string, GanchoFuente>();

export function registrarGanchoFuente(gancho: GanchoFuente): void {
	ganchosFuente.set(gancho.id, gancho);
}

/**
 * Lo que hay que esperar antes de `aplicarGanchosFuente` para este cuadro, o
 * `null` si no hay nada (sin promesa, para no sumar una microtarea por capa y
 * por cuadro). El que llama hace `const e = prepararGanchosFuente(ctx); if (e) await e;`.
 */
export function prepararGanchosFuente(ctx: ContextoFuente): Promise<void> | null {
	let esperas: Promise<void>[] | null = null;
	for (const g of ganchosFuente.values()) {
		if (!g.preparar) continue;
		try {
			const espera = g.preparar(ctx);
			if (espera) (esperas ??= []).push(espera);
		} catch (error) {
			console.error(`[ganchos-ce] el gancho de fuente «${g.id}» falló al prepararse`, error);
		}
	}
	if (!esperas) return null;
	// Un gancho que no pudo prepararse sigue sin él (su `aplicar` devuelve null):
	// el cuadro no se pierde por eso.
	return Promise.allSettled(esperas).then(() => undefined);
}

export function aplicarGanchosFuente(fuente: FuenteVisual, ctx: ContextoFuente): FuenteVisual {
	if (ganchosFuente.size === 0) return fuente;
	let actual = fuente;
	for (const g of [...ganchosFuente.values()].sort((a, b) => a.orden - b.orden)) {
		try {
			actual = g.aplicar(actual, ctx) ?? actual;
		} catch (error) {
			console.error(`[ganchos-ce] el gancho de fuente «${g.id}» falló`, error);
		}
	}
	return actual;
}

/**
 * Saca de los grupos de pases los `ce-*` (que el WASM no conoce) y los aplica a
 * la fuente con el WebGL2 de pases-ce.ts. Devuelve la fuente procesada y los
 * grupos que quedan para el compositor de Rust.
 */
export function preaplicarPasesCe(
	fuente: FuenteVisual,
	grupos: EffectPass[][],
): { fuente: FuenteVisual; grupos: EffectPass[][] } {
	const ce = grupos.flat().filter((p) => esPaseCe(p.shader));
	if (ce.length === 0) return { fuente, grupos };
	const resto = grupos
		.map((g) => g.filter((p) => !esPaseCe(p.shader)))
		.filter((g) => g.length > 0);
	const source = aplicarPasesCe({
		source: fuente.source as OffscreenCanvas,
		width: fuente.width,
		height: fuente.height,
		passes: ce,
	});
	return { fuente: { source, width: fuente.width, height: fuente.height }, grupos: resto };
}
