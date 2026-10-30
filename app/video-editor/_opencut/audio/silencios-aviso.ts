// =============================================================================
// «Borrar silencios» sin pausas: qué se le dice a la persona, y la pausa mínima que puede pedir
// =============================================================================
// Ticket 31 (Leila, 29/10/2026): pidió en el chat «Quiero borrar silencios y me dice que no hay cuando sobran».
// El modelo eligió UN clip de 0,9 s (el ejemplo del catálogo traía siempre `"ref"`), ahí no entra ninguna pausa
// de 0,4 s, y el chat dijo «No se aplica: no hay silencios de 0,4 s o más», sin decir DÓNDE buscó ni qué hacer.
// El botón decía «Sin silencios» con el mismo problema: sin nada elegido busca sólo en el clip bajo el cabezal.
//
// Ahora el aviso dice en qué clip (o en cuántos) buscó y cuánto duraba, y qué pedir. El chat del Video Editor NO
// manda historial (cada pedido llega solo a /api/video-editor/ia): una pregunta como «¿las busco más cortas?» no
// se puede contestar con un «sí». Por eso el aviso trae la FRASE que hay que escribir.
//
// Sin imports pesados: lo usan el chat (chat/aplicar.ts, chat/linea.ts) y el botón, y el test lo carga en node.

import type { SceneTracks } from "@/app/video-editor/_opencut/timeline/types";
import { PAUSA_MIN_S } from "./dsp/silencios";

export { PAUSA_MIN_S };

/** La pausa mínima que se puede pedir: con menos de 0,2 s el margen de 80 ms a cada lado no deja nada que cortar. */
export const PAUSA_MIN_RANGO = { desde: 0.2, hasta: 2 } as const;

/** Con lo que empieza el aviso del chat. Ya es una oración entera: el chat no le antepone «No se aplica:». */
export const NO_ENCONTRE = "No encontré pausas";

/** «0,4 s». */
export const segundosDeAviso = (s: number) => `${(Math.round(s * 10) / 10).toString().replace(".", ",")} s`;

/** Dónde se buscó y no hubo pausas. */
export type BusquedaSinPausas = {
	/** Cuántos clips se escucharon. */
	clips: number;
	/** El nombre del clip, cuando fue uno. */
	titulo?: string;
	/** Lo que duraban, en la línea de tiempo. */
	segundos: number;
	/** La pausa más corta que se buscó. */
	minimoS: number;
	/** Si se buscó en todo el video (todos los clips con sonido de la pista principal). */
	todoElVideo: boolean;
};

const dondeSeBusco = (b: BusquedaSinPausas) =>
	b.todoElVideo
		? `todo el video (${segundosDeAviso(b.segundos)})`
		: b.clips === 1 && b.titulo
			? `«${b.titulo}», que dura ${segundosDeAviso(b.segundos)}`
			: `${b.clips} clips (${segundosDeAviso(b.segundos)})`;

/** El aviso del chat: qué pasó, dónde, y la frase para pedir lo que sigue (no hay historial: un «sí» no alcanza). */
export function textoSinSilencios(b: BusquedaSinPausas): string {
	const que = `${NO_ENCONTRE} de ${segundosDeAviso(b.minimoS)} o más en ${dondeSeBusco(b)}.`;
	const pedidos = [
		...(b.todoElVideo ? [] : ["«borra los silencios de todo el video»"]),
		...(b.minimoS > PAUSA_MIN_RANGO.desde + 1e-9 ? [`«borra las pausas de ${segundosDeAviso(PAUSA_MIN_RANGO.desde)} o más»`] : []),
	];
	return pedidos.length ? `${que} Pídeme ${pedidos.join(" o ")}.` : `${que} No hay silencios para sacar.`;
}

/**
 * Cuántos clips con sonido tiene la escena, en todas sus pistas: para decir si hay más video donde buscar. Las pistas son
 * un OBJETO (`overlay`, `main`, `audio`), no una lista: tratarlas como lista rompía el aviso justo cuando no había pausas
 * (lo vio el tsc acotado, 29/10). Con sonido es lo mismo que `canElementHaveAudio` (timeline/element-utils.ts): video o audio.
 */
export function clipsConSonido(tracks: SceneTracks): number {
	let n = 0;
	for (const pista of [...tracks.overlay, tracks.main, ...tracks.audio]) {
		for (const el of pista.elements) if (el.type === "video" || el.type === "audio") n++;
	}
	return n;
}

/** El aviso del botón de la barra: busca en lo elegido o en el clip bajo el cabezal. */
export function avisoBotonSinSilencios(b: Omit<BusquedaSinPausas, "todoElVideo">, hayMasClips: boolean): { titulo: string; descripcion: string } {
	const donde = b.clips === 1 && b.titulo ? `«${b.titulo}» (${segundosDeAviso(b.segundos)})` : `${b.clips} clips (${segundosDeAviso(b.segundos)})`;
	return {
		titulo: `${NO_ENCONTRE} de ${segundosDeAviso(b.minimoS)} o más`,
		descripcion: hayMasClips ? `Busqué sólo en ${donde}. Para buscar en más, elige más clips.` : `Busqué en ${donde}.`,
	};
}
