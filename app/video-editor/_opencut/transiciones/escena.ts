// =============================================================================
// Transiciones en la escena: qué clip se ve de más y qué sabe el gancho
// =============================================================================
// DECISIÓN (paquete G, 11/10/2026): la ventana de la transición va CENTRADA en el
// corte y la duración total del proyecto no cambia. Con una transición de D
// segundos entre A (izquierda) y B (derecha), en [corte − D/2, corte + D/2] se
// dibujan los dos: A sigue D/2 después de su final y B empieza D/2 antes de su
// inicio. De dónde sale ese material de más:
//
//   · del medio, si lo hay: lo que el recorte dejó afuera (`trimEnd` de A,
//     `trimStart` de B), como los «handles» de CapCut;
//   · si no alcanza, el clip se queda en su último (A) o primer (B) cuadro,
//     lo que CapCut llama «Crear marcos duplicados para la transición».
//
// Lo hace el render (services/renderer/resolve.ts) con `ventanaCe` del nodo y
// `acotarFuente` de acá. El AUDIO no cambia: cada clip suena en su tramo, como
// en CapCut (la transición es de imagen).
//
// El gancho visual (./gancho.ts) recibe sólo los params del elemento, así que la
// escena le arma una copia con lo que necesita saber de AMBOS lados del clip:
// la transición que le sale (si es el de la izquierda de un corte) y la que le
// entra (si es el de la derecha), con la duración ya topeada.
//
// Puro (sin WASM): quien llama pasa los ticks por segundo.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import {
	TR_ENTRA_DURACION,
	TR_ENTRA_ID,
	TR_SALE_DURACION,
	TR_SALE_ID,
	claveDecodificadorTransicion,
} from "./claves";
import { cortesDePista, duracionEfectiva, idTransicion, type ClipCorte } from "./reglas";
import { transicionPorId } from "./catalogo";
// Una transición armada sin el gancho que la dibuja no existiría: se registra acá.
import "./gancho";

/** Cuánto se dibuja un clip fuera de su tramo, en ticks. */
export type VentanaCe = { antes: number; despues: number };

export type TransicionDeNodo = {
	ventana: VentanaCe;
	/** Los params del elemento más las claves `__tr.*` para el gancho visual. */
	params: ParamValues;
	/**
	 * Con qué clave pide cuadros al decodificador. Si A y B son del MISMO medio
	 * (lo común: se divide un clip y se pone una transición en el corte), durante
	 * la ventana los dos piden cuadros a la vez, y el `videoCache` tiene UN
	 * decodificador por clave que numera los pedidos: el viejo pierde y devuelve
	 * el cuadro del otro. Los clips de un mismo medio pegados con transición se
	 * alternan entre dos decodificadores.
	 */
	claveDecodificador?: string;
};

type ClipEscena = ClipCorte & { mediaId?: string };

const mediaDe = (e: ClipEscena): string | undefined =>
	"mediaId" in e && typeof e.mediaId === "string" ? e.mediaId : undefined;

/**
 * Las transiciones que rigen en una pista (los elementos visibles), por id de
 * elemento. Sin transiciones devuelve un mapa vacío y la escena sigue igual.
 */
export function transicionesDePista(
	elementos: readonly TimelineElement[],
	tps: number,
): Map<string, TransicionDeNodo> {
	const salida = new Map<string, TransicionDeNodo>();
	const cortes = cortesDePista(elementos as readonly ClipEscena[]);
	if (cortes.length === 0) return salida;

	const entrada = (e: ClipEscena): TransicionDeNodo => {
		let actual = salida.get(e.id);
		if (!actual) {
			actual = { ventana: { antes: 0, despues: 0 }, params: { ...e.params } };
			salida.set(e.id, actual);
		}
		return actual;
	};

	// La paridad del clip en la pista decide el decodificador: dos clips pegados
	// siempre caen en decodificadores distintos, y como la ventana no pasa de un
	// cuarto del clip del medio (el tope es la mitad del más corto, repartida a
	// los dos lados), el primero y el tercero de una fila nunca se superponen.
	const enCortes = new Set(cortes.flatMap(({ a, b }) => [a.id, b.id]));
	const ordenDe = new Map(
		(elementos as readonly ClipEscena[])
			.filter((e) => enCortes.has(e.id))
			.sort((x, y) => x.startTime - y.startTime || x.id.localeCompare(y.id))
			.map((e, i) => [e.id, i]),
	);

	for (const { a, b } of cortes) {
		const id = idTransicion(a);
		if (!id || !transicionPorId(id)) continue;
		const segundos = duracionEfectiva(a, b, tps);
		const mitad = Math.round((segundos * tps) / 2);
		// Menos de un cuadro a 60 fps no se llega a ver: es un corte.
		if (segundos < 1 / 60 || mitad <= 0) continue;

		const sale = entrada(a);
		sale.ventana.despues = mitad;
		sale.params[TR_SALE_ID] = id;
		sale.params[TR_SALE_DURACION] = segundos;

		const entra = entrada(b);
		entra.ventana.antes = mitad;
		entra.params[TR_ENTRA_ID] = id;
		entra.params[TR_ENTRA_DURACION] = segundos;

		const medio = mediaDe(a);
		if (medio && medio === mediaDe(b)) {
			for (const e of [a, b]) {
				if ((ordenDe.get(e.id) ?? 0) % 2 === 1) entrada(e).claveDecodificador = claveDecodificadorTransicion(medio);
			}
		}
	}
	return salida;
}

/** El instante del clip (ticks desde su inicio) cae fuera de lo que se dibuja. */
export function fueraDeVentana(
	params: { duration: number; ventanaCe?: VentanaCe },
	clipTime: number,
): boolean {
	const antes = params.ventanaCe?.antes ?? 0;
	const despues = params.ventanaCe?.despues ?? 0;
	return clipTime < -antes || clipTime >= params.duration + despues;
}

/**
 * El instante de la FUENTE (ticks) dentro de lo que el medio tiene: antes de
 * empezar o después de terminar el clip, el material recortado; y si no hay, el
 * primer o el último cuadro. `fin` es el largo del medio en ticks
 * (`trimStart + tramo + trimEnd`). Se pide un milisegundo antes del final: en el
 * final exacto el decodificador ya no tiene cuadro.
 */
export function acotarFuente({
	tiempo,
	fin,
	tps,
}: {
	tiempo: number;
	fin: number;
	tps: number;
}): number {
	const ultimo = Math.max(0, fin - tps / 1000);
	return Math.min(Math.max(0, tiempo), ultimo);
}
