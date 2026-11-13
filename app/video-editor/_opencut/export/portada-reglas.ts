// =============================================================================
// La portada del cuadro de Exportar y de Publicar: cuándo un cuadro no muestra nada y qué se prueba (puro)
// =============================================================================
// Visto en producción el 12/11/2026: Publicar mostraba la portada NEGRA. No era Publicar: los dos diálogos son el mismo
// componente y llaman a la misma `portada()` (./exportar.ts). Medido en el panel del navegador: en un proyecto sano las dos
// salen con el MISMO JPEG; en el proyecto de la prueba las DOS salían negras (todo 0), porque su video ya no estaba en el
// navegador (la carpeta del OPFS vacía): la escena salta el clip y queda el fondo. Y la portada lo dibujaba en silencio.
//
// Por eso: un cuadro vacío (todo negro o transparente) no se da por bueno. Se prueba OTRA vez el mismo momento (un
// decodificador que recién abre, o un pedido que pisó otro en el videoCache, da un cuadro vacío la primera vez), después
// un segundo más adelante y la mitad del tramo (un video que arranca desde negro). Si falta un archivo, el diálogo lo dice.
//
// Sin imports: el test lo carga en node (tests/video-editor-detalles-12-11.test.ts).

/** Por debajo de esta luz (0–255, ya multiplicada por la opacidad) un píxel cuenta como negro. */
export const LUZ_MINIMA = 10;

/** El lado de la muestra con la que se mira si el cuadro está vacío (16 × 16 = 256 píxeles alcanzan). */
export const LADO_MUESTRA = 16;

/** Lo que se espera entre un intento y el siguiente. */
export const ESPERA_ENTRE_INTENTOS_MS = 120;

/** ¿Todos los píxeles (RGBA seguidos, como los de `getImageData`) son negros o transparentes? */
export function cuadroVacio(pixeles: ArrayLike<number>, luzMinima = LUZ_MINIMA): boolean {
	for (let i = 0; i + 3 < pixeles.length; i += 4) {
		const luz = ((pixeles[i] + pixeles[i + 1] + pixeles[i + 2]) / 3) * (pixeles[i + 3] / 255);
		if (luz > luzMinima) return false;
	}
	return true;
}

/**
 * Los momentos que se prueban, en ticks y en orden: el pedido, el MISMO otra vez, un segundo después y la mitad del tramo.
 * Todos dentro de [desde, hasta) y sin repetir (salvo el segundo intento del primero, que es a propósito).
 */
export function intentosDePortada({ desde, hasta, tps }: { desde: number; hasta: number; tps: number }): number[] {
	const inicio = Math.max(0, Math.round(desde));
	const ultimo = Math.max(inicio, Math.round(hasta) - 1);
	const en = (t: number) => Math.min(Math.max(inicio, Math.round(t)), ultimo);
	const mas = [en(inicio + tps), en(inicio + (ultimo - inicio) / 2)].filter((t, i, lista) => t !== inicio && lista.indexOf(t) === i);
	return [inicio, inicio, ...mas];
}

/** El aviso del diálogo cuando la línea usa un archivo que no está en este navegador: la portada y el video salen sin él. */
export function avisoSinArchivo(nombres: readonly string[]): string | null {
	if (nombres.length === 0) return null;
	if (nombres.length === 1) return `Falta «${nombres[0]}» en este navegador`;
	return `Faltan ${nombres.length} archivos en este navegador`;
}
