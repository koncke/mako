// =============================================================================
// Recorte: de los parámetros del clip a un rectángulo, y vuelta
// =============================================================================
// Los parámetros (params/extra/recorte.ts) guardan cuánto se le saca a cada lado
// como fracción de la fuente. El diálogo trabaja con un rectángulo normalizado
// {x, y, ancho, alto} (0–1) y el gancho con píxeles; acá están las cuentas, sin
// React ni motor, para que las usen los tres (y element-bounds del reproductor).

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	PROPORCIONES_RECORTE,
	RECORTE_ABAJO,
	RECORTE_ARRIBA,
	RECORTE_DERECHA,
	RECORTE_IZQUIERDA,
	RECORTE_PROPORCION,
} from "@/app/video-editor/_opencut/params/extra/recorte";

/** Rectángulo normalizado (0–1) sobre la fuente. */
export type RectRecorte = { x: number; y: number; ancho: number; alto: number };

export const RECT_COMPLETO: RectRecorte = { x: 0, y: 0, ancho: 1, alto: 1 };

/** Lo mínimo que puede quedar de cada lado, para que el cuadro no desaparezca. */
export const LADO_MINIMO = 0.02;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function rectDeParams(params: ParamValues | undefined): RectRecorte {
	if (!params) return RECT_COMPLETO;
	const izquierda = acotar(num(params[RECORTE_IZQUIERDA]), 0, 1);
	const arriba = acotar(num(params[RECORTE_ARRIBA]), 0, 1);
	const derecha = acotar(num(params[RECORTE_DERECHA]), 0, 1);
	const abajo = acotar(num(params[RECORTE_ABAJO]), 0, 1);
	const ancho = 1 - izquierda - derecha;
	const alto = 1 - arriba - abajo;
	if (ancho < LADO_MINIMO || alto < LADO_MINIMO) return RECT_COMPLETO;
	return { x: izquierda, y: arriba, ancho, alto };
}

export function paramsDeRect(rect: RectRecorte, proporcion: string): ParamValues {
	const r = normalizarRect(rect);
	return {
		[RECORTE_IZQUIERDA]: redondear(r.x),
		[RECORTE_ARRIBA]: redondear(r.y),
		[RECORTE_DERECHA]: redondear(1 - r.x - r.ancho),
		[RECORTE_ABAJO]: redondear(1 - r.y - r.alto),
		[RECORTE_PROPORCION]: proporcion,
	};
}

// Cuatro decimales: menos de un píxel en un 8K, y el proyecto no guarda ruido.
const redondear = (v: number) => Math.max(0, Math.round(v * 10_000) / 10_000);

export function normalizarRect(rect: RectRecorte): RectRecorte {
	const ancho = acotar(rect.ancho, LADO_MINIMO, 1);
	const alto = acotar(rect.alto, LADO_MINIMO, 1);
	return {
		x: acotar(rect.x, 0, 1 - ancho),
		y: acotar(rect.y, 0, 1 - alto),
		ancho,
		alto,
	};
}

export function esRectCompleto(rect: RectRecorte): boolean {
	return rect.x < 1e-4 && rect.y < 1e-4 && rect.ancho > 1 - 1e-4 && rect.alto > 1 - 1e-4;
}

export function hayRecorte(params: ParamValues | undefined): boolean {
	return !esRectCompleto(rectDeParams(params));
}

export function proporcionDeParams(params: ParamValues | undefined): string {
	const v = params?.[RECORTE_PROPORCION];
	return typeof v === "string" && PROPORCIONES_RECORTE.some((p) => p.id === v) ? v : "libre";
}

/** Ancho/alto en píxeles de una proporción, o null si es «Libre». */
export function valorProporcion(
	id: string,
	fuente: { width: number; height: number },
): number | null {
	if (id === "original") return fuente.width / fuente.height;
	return PROPORCIONES_RECORTE.find((p) => p.id === id)?.valor ?? null;
}

/**
 * El rectángulo más grande con esa proporción (en píxeles), centrado en el
 * actual. Es lo que hace CapCut al elegir una proporción en el desplegable.
 */
export function rectConProporcion(
	actual: RectRecorte,
	proporcion: number,
	fuente: { width: number; height: number },
): RectRecorte {
	// En unidades normalizadas, ancho/alto = proporción × (alto_px / ancho_px).
	const relacion = (proporcion * fuente.height) / fuente.width;
	let ancho = 1;
	let alto = ancho / relacion;
	if (alto > 1) {
		alto = 1;
		ancho = relacion;
	}
	const cx = actual.x + actual.ancho / 2;
	const cy = actual.y + actual.alto / 2;
	return normalizarRect({ x: cx - ancho / 2, y: cy - alto / 2, ancho, alto });
}

/** El tamaño en píxeles de la fuente ya recortada (para el reproductor). */
export function dimensionesRecortadas({
	params,
	width,
	height,
}: {
	params: ParamValues | undefined;
	width: number;
	height: number;
}): { width: number; height: number } {
	const rect = rectDeParams(params);
	return {
		width: Math.max(1, Math.round(width * rect.ancho)),
		height: Math.max(1, Math.round(height * rect.alto)),
	};
}
