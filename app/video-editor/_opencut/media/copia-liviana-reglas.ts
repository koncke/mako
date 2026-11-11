/**
 * Las reglas de la COPIA LIVIANA de un video (el «proxy» de Descript y CapCut): la vista previa decodifica una copia
 * de 540 px de lado corto y exportar usa el original.
 *
 * Por qué (medido el 11/11/2026, docs/editor-video/memoria-del-editor.md): el navegador decodifica a la resolución del
 * ARCHIVO, no a la del lienzo. Achicar el lienzo de salida (el «1/2» de la vista previa, o el `maxCanvasSinkFrameSize`
 * de Remotion) casi no baja nada: 3 clips de 1080×1920 pasaron de +297 a +264 MB. Con una copia de 540×960, +86 MB.
 * En 4K el pico bajó de +529 a +26 MB, y los cuadros salen 10 veces más rápido.
 *
 * Puro: lo prueba tests/video-editor-copia-liviana.test.ts sin navegador.
 */
import { claveDecodificadorTransicion } from "@/app/video-editor/_opencut/transiciones/claves";

/** El lado corto de la copia. 540 alcanza para la vista previa, que casi nunca pasa de 540 px de alto en pantalla. */
export const LADO_CORTO_COPIA = 540;

/**
 * Desde qué lado corto se arma la copia. Un 720p ya decodifica poco (la mitad de píxeles que un 1080). Lo que pesa son
 * los videos de celular (1080) y los 4K.
 */
export const LADO_CORTO_MINIMO = 720;

/**
 * El tamaño de la copia: el lado corto a 540 px, la misma proporción y medidas pares (H.264 las pide pares). `null` si
 * el video ya es liviano y no hace falta copia.
 */
export function medidasDeCopia({
	width,
	height,
}: {
	width: number;
	height: number;
}): { width: number; height: number } | null {
	if (!(width > 0) || !(height > 0)) return null;
	const corto = Math.min(width, height);
	if (corto <= LADO_CORTO_MINIMO) return null;
	const k = LADO_CORTO_COPIA / corto;
	const par = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
	return { width: par(width), height: par(height) };
}

/**
 * La clave del decodificador de la copia en el `videoCache`. Tiene que ser OTRA que la del original: si la vista previa
 * y la exportación compartieran la clave, el que llega primero deja abierto SU decodificador y la exportación saldría en
 * 540 px.
 */
export function claveLiviana(clave: string): string {
	return `${clave}::liviana`;
}

/** Las claves del ORIGINAL de un medio: la de siempre y la del segundo decodificador de una transición. */
export function clavesDelOriginal(mediaId: string): string[] {
	return [mediaId, claveDecodificadorTransicion(mediaId)];
}

/** Las claves de la COPIA de un medio. */
export function clavesDeLaCopia(mediaId: string): string[] {
	return clavesDelOriginal(mediaId).map(claveLiviana);
}

/** El nombre del archivo de la copia en el OPFS del proyecto, al lado del original (que se guarda con su id). */
export function archivoDeCopia(mediaId: string): string {
	return `${mediaId}.liviana`;
}
