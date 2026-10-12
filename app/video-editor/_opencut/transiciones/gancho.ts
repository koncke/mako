// =============================================================================
// El gancho visual de las transiciones
// =============================================================================
// Corre en resolve.ts para cada clip de video o imagen, después de los
// fotogramas clave y de las animaciones. Lee de los params (la copia que arma
// ./escena.ts) si al clip le sale y/o le entra una transición, calcula el
// progreso con el instante SIN acotar (`tiempoClip`: negativo antes del inicio,
// más que la duración después del final) y deja la capa como dice el catálogo,
// pases `ce-tr-*` incluidos (EstadoVisual.pases).
//
// Orden 1100: después de las animaciones de entrada/salida (H, 100) y del
// reflejo (I, 1000). Los barridos necesitan saber hacia dónde MIRA la capa (el
// signo final de la escala y el giro) para orientar la máscara en la pantalla
// (catalogo.ts, `direccionEnCapa`). El contrato del reflejo («un gancho que toque
// la escala conserva el signo») se cumple: esto sólo MULTIPLICA la escala por
// números positivos y suma posición y giro.
//
// Lo importan ./registro.ts y ./escena.ts (la escena no arma una transición sin
// que el gancho exista).

import { registrarGanchoVisual, type EstadoVisual } from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import { TR_ENTRA_DURACION, TR_ENTRA_ID, TR_SALE_DURACION, TR_SALE_ID } from "./claves";
import { transicionPorId, type Lienzo, type RolTransicion } from "./catalogo";
import type { ParamValues } from "@/app/video-editor/_opencut/params";

function leer(params: ParamValues, claveId: string, claveDuracion: string) {
	const id = params[claveId];
	const duracion = params[claveDuracion];
	if (typeof id !== "string" || typeof duracion !== "number" || !(duracion > 0)) return null;
	const definicion = transicionPorId(id);
	return definicion ? { definicion, duracion } : null;
}

/**
 * El estado de la capa en `tiempo` (segundos desde el inicio del clip, sin
 * acotar) para un clip de `duracion` segundos. Exportado para la prueba y para
 * las miniaturas: es EL cálculo, no una copia.
 */
export function aplicarTransiciones(
	estado: EstadoVisual,
	{ params, tiempo, duracion, lienzo }: { params: ParamValues; tiempo: number; duracion: number; lienzo: Lienzo },
): EstadoVisual {
	let actual = estado;
	const entra = leer(params, TR_ENTRA_ID, TR_ENTRA_DURACION);
	if (entra) {
		// La ventana arranca D/2 antes del inicio del clip.
		const p = (tiempo + entra.duracion / 2) / entra.duracion;
		if (p < 1) actual = paso(entra.definicion.aplicar, "entra", p, actual, lienzo);
	}
	const sale = leer(params, TR_SALE_ID, TR_SALE_DURACION);
	if (sale) {
		const p = (tiempo - (duracion - sale.duracion / 2)) / sale.duracion;
		if (p > 0) actual = paso(sale.definicion.aplicar, "sale", p, actual, lienzo);
	}
	return actual;
}

function paso(
	aplicar: (rol: RolTransicion, p: number, e: EstadoVisual, l: Lienzo) => EstadoVisual,
	rol: RolTransicion,
	p: number,
	estado: EstadoVisual,
	lienzo: Lienzo,
): EstadoVisual {
	return aplicar(rol, Math.min(1, Math.max(0, p)), estado, lienzo);
}

registrarGanchoVisual({
	id: "ce-transiciones",
	orden: 1100,
	aplicar: (estado, ctx) => {
		if (!(TR_ENTRA_ID in ctx.params) && !(TR_SALE_ID in ctx.params)) return estado;
		return aplicarTransiciones(estado, {
			params: ctx.params,
			// Sin `tiempoClip` (un llamador viejo) el instante acotado sirve igual
			// adentro del clip; sólo se pierde lo de afuera, que entonces no se dibuja.
			tiempo: ctx.tiempoClip ?? ctx.localTime,
			duracion: ctx.duration,
			lienzo: ctx.lienzo,
		});
	},
});
