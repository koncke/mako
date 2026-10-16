// =============================================================================
// Plantillas: un clip que CUBRE un rectángulo del lienzo
// =============================================================================
// Un hueco de clip ocupa una celda (la mitad de arriba en «Antes y después») o el
// lienzo entero. Para llenarla sin deformar ni dejar franjas, como «Rellenar» de
// CapCut: se RECORTA la fuente a la proporción de la celda (`recorte.*`,
// params/extra/recorte.ts) y después se escala y se corre.
//
// Las cuentas siguen al motor:
//   · El gancho de recorte (recorte/ganchos.ts) sube SÓLO lo recortado, y el
//     compositor lo encaja en el lienzo como a cualquier fuente: «contain»,
//     `min(W / ancho, H / alto)` (compositor/frame-descriptor.ts, computeVisualTransform).
//   · La escala multiplica ese encaje: escala = ancho de la celda / ancho mostrado.
//   · La posición es el centro del clip menos el centro del lienzo, con la Y hacia
//     ABAJO (como el motor; el panel la muestra al revés).
//
// Recibe la celda en px del lienzo DE VERDAD (no de LIENZO_REF): así lo usa también
// «Reemplazar el clip», que cubre el rectángulo donde el clip se ve hoy.
// Puro, con test (tests/video-editor-plantillas.test.ts, test 12).

import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	RECORTE_ABAJO,
	RECORTE_ARRIBA,
	RECORTE_DERECHA,
	RECORTE_IZQUIERDA,
} from "@/app/video-editor/_opencut/params/extra/recorte";

export type Rect = { x: number; y: number; ancho: number; alto: number };
export type Tamano = { width: number; height: number };

export type Cubrir = {
	/** Fracción de la FUENTE que se saca de cada lado (0–1). */
	recorte: { izquierda: number; arriba: number; derecha: number; abajo: number };
	escala: number;
	/** Px del lienzo desde el centro, Y hacia abajo. */
	x: number;
	y: number;
};

// Cuatro decimales, como el diálogo de recorte (recorte/geometria.ts): menos de un
// píxel en un 8K, y el proyecto no guarda ruido.
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Recorta, escala y corre una fuente de `fuente` px para que cubra `celda` (px del lienzo). */
export function cubrirCelda({ fuente, celda, lienzo }: { fuente: Tamano; celda: Rect; lienzo: Tamano }): Cubrir {
	const propCelda = celda.ancho / celda.alto;
	const propFuente = fuente.width / fuente.height;
	let lado = 0;
	let vertical = 0;
	// La fuente más ancha que la celda pierde los costados; más alta, arriba y abajo.
	if (propFuente > propCelda) lado = r4((1 - propCelda / propFuente) / 2);
	else if (propFuente < propCelda) vertical = r4((1 - propFuente / propCelda) / 2);
	const anchoRecortado = fuente.width * (1 - 2 * lado);
	const altoRecortado = fuente.height * (1 - 2 * vertical);
	const encaje = Math.min(lienzo.width / anchoRecortado, lienzo.height / altoRecortado);
	return {
		recorte: { izquierda: lado, arriba: vertical, derecha: lado, abajo: vertical },
		escala: r4(celda.ancho / (anchoRecortado * encaje)),
		x: r2(celda.x + celda.ancho / 2 - lienzo.width / 2),
		y: r2(celda.y + celda.alto / 2 - lienzo.height / 2),
	};
}

/** Los params del elemento para lo que dio `cubrirCelda`. */
export function paramsDeCubrir(c: Cubrir): ParamValues {
	return {
		[RECORTE_IZQUIERDA]: c.recorte.izquierda,
		[RECORTE_ARRIBA]: c.recorte.arriba,
		[RECORTE_DERECHA]: c.recorte.derecha,
		[RECORTE_ABAJO]: c.recorte.abajo,
		"transform.scaleX": c.escala,
		"transform.scaleY": c.escala,
		"transform.positionX": c.x,
		"transform.positionY": c.y,
	};
}
