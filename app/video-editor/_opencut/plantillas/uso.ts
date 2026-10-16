// =============================================================================
// Plantillas: lo puro de «Utilizar plantilla» (qué muestras, qué fuentes, dónde se arma)
// =============================================================================
// Lo usan la pestaña (plantillas/components/), el armado en el navegador
// (./instanciar.ts) y, en la tanda 4, el chat. Todo lo que llega al motor o al
// navegador (guardar un medio, cargar una fuente, medir) vive en ./muestras.ts y
// ./instanciar.ts; acá sólo las cuentas:
//   · qué imágenes de muestra pide una plantilla (una por rótulo; "" es el cierre);
//   · qué familias cargar ENTERAS al usarla (sólo las suyas, plan §1.4.1) y qué
//     letras pide cada miniatura (fonts/muestras.ts: las familias enteras de todas
//     las tarjetas colgaban la pestaña, hallazgos → «lo que se cuelga no es el karaoke»);
//   · si la línea de tiempo está vacía (vacía → se arma ahí; con algo → proyecto
//     nuevo, como «Utilizar plantilla» de CapCut, que abre un borrador);
//   · los medios de Multimedia que llenan un hueco, en la forma que pide el armado.
// Puro (sin editor ni WASM), con test (tests/video-editor-plantillas-uso.test.ts).

import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import type { SceneTracks } from "@/app/video-editor/_opencut/timeline";
import { huecosDe, type PiezaTexto, type Plantilla } from "@/lib/editor-video/plantillas";
import type { MedioHueco } from "./armar";

/** El nombre del medio oculto de una muestra: por él se reusa (una por rótulo y proyecto). */
export const nombreMuestra = (rotulo: string) => `Muestra · ${rotulo || "Cierre"}.png`;

/** Los rótulos de los huecos de clip, sin repetir y en el orden de la plantilla ("" = el cierre). */
export function rotulosDe(plantilla: Plantilla): string[] {
	const rotulos: string[] = [];
	for (const pieza of plantilla.piezas) {
		if (pieza.tipo === "clip" && !rotulos.includes(pieza.hueco.rotulo)) rotulos.push(pieza.hueco.rotulo);
	}
	return rotulos;
}

/** ¿No hay NADA en la línea de tiempo? (las pistas vacías no cuentan). */
export function lineaVacia(tracks: SceneTracks): boolean {
	return [...tracks.overlay, tracks.main, ...tracks.audio].every((t) => t.elements.length === 0);
}

const textos = (p: Plantilla) => p.piezas.filter((x): x is PiezaTexto => x.tipo === "texto");

/** Las familias que hay que cargar ENTERAS antes de medir (sólo las de esta plantilla). */
export function familiasDe(plantilla: Plantilla): string[] {
	return [...new Set(textos(plantilla).map((t) => t.estilo.fuente))];
}

/** El peso con que se dibuja un texto de la plantilla. */
export const pesoDe = (t: PiezaTexto) => (t.estilo.negrita ? 700 : 400);

/** Lo que se ve escrito de un texto de la plantilla (con «Mayúsculas» ya aplicadas). */
export const textoVisible = (t: PiezaTexto, texto: string = t.muestra) => (t.estilo.mayusculas ? texto.toUpperCase() : texto);

export type PedidoMuestra = { familia: string; peso: number; texto: string };

/**
 * Las fuentes de la MINIATURA: una por familia y peso, con todas las letras que la
 * tarjeta dibuja en algún momento (quieta y en bucle). Se piden con cargarMuestra
 * (fonts/muestras.ts, `&text=`), nunca la familia entera.
 */
export function muestrasDeFuente(plantilla: Plantilla): PedidoMuestra[] {
	const porClave = new Map<string, PedidoMuestra>();
	for (const t of textos(plantilla)) {
		const peso = pesoDe(t);
		const clave = `${t.estilo.fuente}|${peso}`;
		const ya = porClave.get(clave);
		if (ya) ya.texto += textoVisible(t);
		else porClave.set(clave, { familia: t.estilo.fuente, peso, texto: textoVisible(t) });
	}
	return [...porClave.values()];
}

/**
 * Los medios de Multimedia que mandan llenar un hueco (nombre del hueco → id del
 * medio), como los pide el armado. Lo que no sirve vuelve como descarte con su
 * motivo (lo lee el chat); lo demás (tipo que el hueco no acepta, video corto) lo
 * descarta el armado, que es quien sabe cuánto dura cada pieza.
 */
export function mediosDeHuecos(
	plantilla: Plantilla,
	assets: ReadonlyArray<Pick<MediaAsset, "id" | "type" | "name" | "width" | "height" | "duration">>,
	pedidos: Record<string, string>,
): { medios: Record<string, MedioHueco>; descartes: string[] } {
	const huecos = new Map(huecosDe(plantilla).map((h) => [h.nombre, h]));
	const medios: Record<string, MedioHueco> = {};
	const descartes: string[] = [];
	for (const [hueco, mediaId] of Object.entries(pedidos)) {
		const h = huecos.get(hueco);
		const a = assets.find((x) => x.id === mediaId);
		if (!h || h.tipo !== "clip") descartes.push(`"${hueco}" no es un hueco de clip de esta plantilla`);
		else if (!a || (a.type !== "video" && a.type !== "image")) descartes.push(`"${hueco}": el medio no es un video ni una foto de Multimedia`);
		else if (!a.width || !a.height) descartes.push(`"${hueco}": no se sabe el tamaño de «${a.name}»`);
		else medios[hueco] = { mediaId: a.id, type: a.type, width: a.width, height: a.height, duracion: a.duration, nombre: a.name };
	}
	return { medios, descartes };
}
