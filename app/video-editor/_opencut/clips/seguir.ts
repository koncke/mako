// =============================================================================
// Clips mágicos: seguir a la PERSONA al pasar un clip horizontal a vertical (puro: sin motor, sin `wasm`)
// =============================================================================
// Hasta el 10/11/2026 el 16:9 se recortaba al CENTRO para llenar el 9:16 (./cubrir.ts): quien hablaba a un costado
// del cuadro quedaba cortado o afuera (pendientes §5.1). Ahora se mira dónde está la persona, con el MISMO
// segmentador de «Eliminación automática» (../fondo/segmentador.ts, MediaPipe selfie, en el navegador y sin costo):
//
//   1. se toman algunos cuadros del tramo (`momentosAMuestrear`: uno por segundo, hasta 60);
//   2. de la máscara de cada uno sale el centro HORIZONTAL de la persona, pesado por su área (`perfilDePersona`): con
//      dos personas, el centro de las dos; con menos del 1 % del cuadro, «no hay nadie»;
//   3. el camino se arma (`caminoDelEncuadre`): donde no hubo nadie se sostiene lo último visto, se saca el ruido de
//      la máscara (mediana de 3) y se suaviza (promedio de 5, ±2 s), y nunca se sale del cuadro. Con alguien en menos
//      de un cuarto de los cuadros no se mueve nada: una mancha suelta no puede correr el encuadre;
//   4. el encuadre (`encuadreQueSigue`): la fuente se agranda hasta cubrir el alto del vertical (sin recortar los
//      costados) y se corre con `transform.positionX`. Si el camino casi no se mueve, un valor fijo; si se mueve,
//      fotogramas clave en los momentos que no explica la recta entre sus vecinos (los pone ./seguir-en-editor.ts:
//      escribir un fotograma clave necesita el motor).
//
// Si no se encontró a nadie en ningún cuadro, o la fuente no es más ancha que el vertical (no hay costados que
// elegir), no hay encuadre: queda el recorte al centro de siempre.

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	RECORTE_ABAJO,
	RECORTE_ARRIBA,
	RECORTE_DERECHA,
	RECORTE_IZQUIERDA,
} from "@/app/video-editor/_opencut/params/extra/recorte";
import { confianzaDePersona } from "@/app/video-editor/_opencut/fondo/mascara";

export type Tamano = { width: number; height: number };

/** Lo que se vio en UN cuadro: el centro horizontal de la persona (0–1 del ancho de la fuente), o nadie. */
export type MuestraPersona = { t: number; centro: number | null };

/** Un punto del camino del encuadre: en `t` segundos del clip, el centro (0–1 del ancho de la fuente) a la vista. */
export type PuntoCamino = { t: number; centro: number };

/** El encuadre que sigue a la persona: la escala que cubre el vertical, la X de base y, si se mueve, sus claves. */
export type EncuadreSeguido = {
	escala: number;
	x: number;
	/** `null`: quieto (alcanza con `x`). Si no, un fotograma clave de `transform.positionX` por punto. */
	claves: Array<{ t: number; x: number }> | null;
};

export const SEGUIR = {
	/** Un cuadro por segundo del clip… */
	pasoS: 1,
	/** …y no más de 60 (un clip mágico dura de 15 a 60 s). */
	maxMuestras: 60,
	/** Menos que esto del cuadro (1 %) es una mancha de la máscara, no una persona. */
	areaMinima: 0.01,
	/** Con alguien en menos de un cuarto de los cuadros, lo visto no alcanza para mover el encuadre: queda al centro. */
	presenciaMinima: 0.25,
	/** Un camino que se mueve menos que esto (fracción del ancho de la fuente) queda fijo: es el balanceo de quien habla. */
	quieto: 0.04,
	/** Un fotograma clave que la recta entre sus vecinos ya explica a menos de esto (fracción del ancho) sobra. */
	tolerancia: 0.01,
} as const;

/**
 * El centro horizontal de la persona en una máscara del segmentador, pesado por su área: la suma de lo que es persona
 * en cada columna (con la misma rampa que el recorte de «Eliminación automática»). `centro` va de 0 a 1 del ancho.
 */
export function perfilDePersona({
	confianza,
	esDeFondo,
	ancho,
	alto,
}: {
	confianza: ArrayLike<number>;
	esDeFondo: boolean;
	ancho: number;
	alto: number;
}): { centro: number | null; area: number } {
	if (!(ancho > 0) || !(alto > 0) || confianza.length < ancho * alto) return { centro: null, area: 0 };
	let masa = 0;
	let momento = 0;
	for (let x = 0; x < ancho; x++) {
		let columna = 0;
		for (let y = 0; y < alto; y++) columna += confianzaDePersona(confianza[y * ancho + x], esDeFondo);
		masa += columna;
		momento += columna * (x + 0.5);
	}
	const area = masa / (ancho * alto);
	if (area < SEGUIR.areaMinima) return { centro: null, area };
	return { centro: momento / masa / ancho, area };
}

/** En qué segundos del clip se mira: repartidos parejo, al medio de cada tramo. */
export function momentosAMuestrear(duracionS: number): number[] {
	if (!(duracionS > 0)) return [];
	const n = Math.max(1, Math.min(SEGUIR.maxMuestras, Math.ceil(duracionS / SEGUIR.pasoS)));
	const paso = duracionS / n;
	return Array.from({ length: n }, (_, k) => (k + 0.5) * paso);
}

function mediana3(v: number[]): number[] {
	return v.map((x, i) => {
		if (i === 0 || i === v.length - 1) return x;
		return [v[i - 1], x, v[i + 1]].sort((p, q) => p - q)[1];
	});
}

function promedio5(v: number[]): number[] {
	return v.map((_, i) => {
		let suma = 0;
		let n = 0;
		for (let j = Math.max(0, i - 2); j <= Math.min(v.length - 1, i + 2); j++) {
			suma += v[j];
			n++;
		}
		return suma / n;
	});
}

/**
 * El camino del centro a la vista, ya suavizado y adentro del cuadro. `ventana`: la fracción del ancho de la fuente
 * que entra en el vertical (el centro no puede acercarse al borde más que la mitad de eso). Sin nadie en ningún
 * cuadro, `null`.
 */
export function caminoDelEncuadre(muestras: readonly MuestraPersona[], ventana: number): PuntoCamino[] | null {
	const ordenadas = [...muestras].filter((m) => Number.isFinite(m.t)).sort((a, b) => a.t - b.t);
	const conAlguien = ordenadas.filter((m) => m.centro !== null && Number.isFinite(m.centro));
	const primera = conAlguien[0];
	if (!primera || conAlguien.length < ordenadas.length * SEGUIR.presenciaMinima) return null;
	// Donde no hubo nadie (se dio vuelta, salió un momento, la máscara falló) se sostiene lo último que se vio.
	let ultimo = primera.centro as number;
	const crudos = ordenadas.map((m) => {
		if (m.centro !== null && Number.isFinite(m.centro)) ultimo = m.centro;
		return ultimo;
	});
	const suaves = promedio5(mediana3(crudos));
	const mitad = Math.min(0.5, Math.max(0, ventana / 2));
	return ordenadas.map((m, i) => ({ t: m.t, centro: Math.min(1 - mitad, Math.max(mitad, suaves[i])) }));
}

/** Los puntos que hacen falta para que la recta entre fotogramas clave pase a menos de `tolerancia` de todos. */
export function simplificarCamino(camino: readonly PuntoCamino[], tolerancia: number = SEGUIR.tolerancia): PuntoCamino[] {
	if (camino.length <= 2) return [...camino];
	const quedan = new Array<boolean>(camino.length).fill(false);
	quedan[0] = true;
	quedan[camino.length - 1] = true;
	const pendientes: Array<[number, number]> = [[0, camino.length - 1]];
	while (pendientes.length) {
		const [a, b] = pendientes.pop() as [number, number];
		let peor = -1;
		let distancia = tolerancia;
		for (let i = a + 1; i < b; i++) {
			const f = (camino[i].t - camino[a].t) / (camino[b].t - camino[a].t || 1);
			const recta = camino[a].centro + f * (camino[b].centro - camino[a].centro);
			const d = Math.abs(camino[i].centro - recta);
			if (d > distancia) {
				distancia = d;
				peor = i;
			}
		}
		if (peor >= 0) {
			quedan[peor] = true;
			pendientes.push([a, peor], [peor, b]);
		}
	}
	return camino.filter((_, i) => quedan[i]);
}

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Para arriba: una escala redondeada para abajo dejaría una raya sin video arriba y abajo del vertical. */
const r4Arriba = (v: number) => Math.ceil(v * 10_000) / 10_000;

/**
 * El encuadre que sigue a la persona en un clip, o `null` (el recorte al centro de siempre): sin nadie en los cuadros,
 * o con una fuente que no es más ancha que el lienzo.
 */
export function encuadreQueSigue({
	muestras,
	fuente,
	lienzo,
}: {
	muestras: readonly MuestraPersona[];
	fuente: Tamano;
	lienzo: Tamano;
}): EncuadreSeguido | null {
	if (!(fuente.width > 0 && fuente.height > 0 && lienzo.width > 0 && lienzo.height > 0)) return null;
	const propFuente = fuente.width / fuente.height;
	const propLienzo = lienzo.width / lienzo.height;
	if (propFuente <= propLienzo * 1.0001) return null;
	// El compositor encaja la fuente ENTERA (el ancho, acá) y la escala la agranda: hasta cubrir el alto.
	const escala = r4Arriba(propFuente / propLienzo);
	const camino = caminoDelEncuadre(muestras, 1 / escala);
	if (!camino) return null;
	const anchoDibujado = lienzo.width * escala;
	const tope = Math.floor(((anchoDibujado - lienzo.width) / 2) * 100) / 100;
	// Para que el punto `centro` de la fuente quede en el medio del lienzo, la fuente se corre al revés.
	const xDe = (centro: number) => {
		const x = r2(-(centro - 0.5) * anchoDibujado);
		// `+ 0`: un −0 se guardaría como «-0» y se leería distinto del 0 del centro.
		return Math.min(tope, Math.max(-tope, x)) + 0;
	};
	const centros = camino.map((p) => p.centro);
	if (Math.max(...centros) - Math.min(...centros) < SEGUIR.quieto) {
		const orden = [...centros].sort((a, b) => a - b);
		return { escala, x: xDe(orden[Math.floor(orden.length / 2)]), claves: null };
	}
	const claves = simplificarCamino(camino).map((p) => ({ t: p.t, x: xDe(p.centro) }));
	return { escala, x: claves[0].x, claves };
}

/** Los params del clip para un encuadre que sigue: sin recorte (lo que sobra lo tapa el borde del lienzo), agrandado y corrido. */
export function paramsDelEncuadre(e: EncuadreSeguido): ParamValues {
	return {
		[RECORTE_IZQUIERDA]: 0,
		[RECORTE_ARRIBA]: 0,
		[RECORTE_DERECHA]: 0,
		[RECORTE_ABAJO]: 0,
		"transform.scaleX": e.escala,
		"transform.scaleY": e.escala,
		"transform.positionX": e.x,
		"transform.positionY": 0,
	};
}
