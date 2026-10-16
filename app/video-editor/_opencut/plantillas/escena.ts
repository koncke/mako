// =============================================================================
// Plantillas: qué se ve en el segundo `t` (para la miniatura de la pestaña)
// =============================================================================
// La miniatura (plantillas/components/miniatura-plantilla.tsx) dibuja la plantilla en
// un canvas 2D sin armar la línea de tiempo: quieta en `portada`, en bucle al pasar
// el mouse. Le hace falta, para cada instante, qué piezas se ven, dónde y con qué
// pose de animación: la MISMA pose que pinta el editor (animaciones/calcular.ts,
// poseEn), con los params que escribe el armado (./armar.ts, paramsDeAnimacion). La
// «Máquina de escribir» no tiene pose (revela letras): va aparte, en `revelado`.
//
// Los rectángulos van en px de LIENZO_REF; el del texto es la caja ESTIMADA
// (cajaDeTexto: sin medir con la fuente). Las transiciones no se dibujan: en una
// miniatura de 92 px el corte se lee igual.
// Puro, con test (tests/video-editor-plantillas.test.ts, test 13).

import type { Pose } from "@/app/video-editor/_opencut/animaciones/catalogo";
import { poseEn, revelacionTexto, type RevelacionTexto } from "@/app/video-editor/_opencut/animaciones/calcular";
import { cajaDeTexto, LIENZO_REF, type Celda, type Pieza, type PistaPlantilla, type Plantilla } from "@/lib/editor-video/plantillas";
import { paramsDeAnimacion, type TipoBase } from "./armar";

export type PiezaEnEscena = {
	pieza: Pieza;
	/** Px de LIENZO_REF, desde arriba a la izquierda, sin la animación. */
	rect: Celda;
	pose: Pose;
	/** «Máquina de escribir»: cuánto del texto se ve (null = entero). No es una pose: no mueve, revela. */
	revelado: RevelacionTexto | null;
	/** Segundos desde que empezó la pieza. */
	local: number;
};

/** De ABAJO hacia arriba: el orden en que se dibuja. */
const ORDEN_DIBUJO: Record<PistaPlantilla, number> = {
	principal: 0,
	"video-1": 1,
	"forma-1": 2,
	"texto-4": 3,
	"texto-3": 4,
	"texto-2": 5,
	"texto-1": 6,
};

const TIPO: Record<Pieza["tipo"], TipoBase> = { clip: "image", texto: "text", forma: "graphic" };
const LIENZO_ENTERO: Celda = { x: 0, y: 0, ancho: LIENZO_REF.ancho, alto: LIENZO_REF.alto };

function rectDe(pieza: Pieza): Celda {
	if (pieza.tipo === "texto") return cajaDeTexto(pieza);
	return pieza.celda ?? LIENZO_ENTERO;
}

/** Las piezas que se ven en el segundo `t`, en el orden en que se dibujan. */
export function escenaEn(plantilla: Plantilla, t: number): PiezaEnEscena[] {
	// El último cuadro, no el instante final (en `duracion` ya no se ve nada).
	const instante = Math.min(Math.max(0, t), plantilla.duracion - 1e-6);
	return plantilla.piezas
		.filter((p) => instante >= p.inicio && instante < p.fin)
		.sort((x, y) => ORDEN_DIBUJO[x.pista] - ORDEN_DIBUJO[y.pista])
		.map((pieza) => {
			const D = pieza.fin - pieza.inicio;
			const local = instante - pieza.inicio;
			const params = paramsDeAnimacion(pieza.animacion, TIPO[pieza.tipo], D);
			const texto = pieza.tipo === "texto";
			return {
				pieza,
				rect: rectDe(pieza),
				pose: poseEn(params, local, D, texto),
				revelado: texto ? revelacionTexto(params, local, D) : null,
				local,
			};
		});
}
