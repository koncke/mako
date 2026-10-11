// =============================================================================
// El IMÁN de la pista principal y la VINCULACIÓN, como en CapCut
// =============================================================================
// OpenCut traía un «ripple» que, al borrar o recortar, corría los clips de
// TODAS las pistas. CapCut no hace eso: tiene dos interruptores en la barra de
// la línea de tiempo.
//
//   · «Imán de la pista principal» (P): la pista principal NUNCA tiene huecos.
//     Se empaqueta desde 0 en el orden de los clips, así borrar, recortar,
//     mover o cambiar la velocidad de un clip junta a los demás. Las otras
//     pistas no se tocan.
//   · «Vinculación» (`): lo que está ENCIMA de un clip de la pista principal
//     (texto, stickers, efectos… según «Configuración de vinculación») se mueve
//     con ese clip. El borrado vinculado se hace en la acción de borrar
//     (actions/use-editor-actions.ts), no acá: desde acá no se distingue un
//     borrado de un deshacer, y borrar en un deshacer destruiría trabajo.
//
// Corre en `timeline.updateTracks`, que es por donde pasa TODO cambio de pistas
// (comandos, deshacer/rehacer y `commitPreview`, que no pasa por `execute`).
// Por eso tiene que ser idempotente: empaquetar una pista ya empaquetada no
// cambia nada y devuelve el MISMO objeto (sin re-render ni guardado de más).
//
// Regla para no correr dos veces lo que el comando ya movió: un elemento de
// otra pista se corre con su clip SÓLO si el cambio no lo tocó (mismo inicio
// antes y después). En un deshacer, el comando ya lo devolvió a su lugar: está
// «tocado» y no se vuelve a correr.

import type {
	SceneTracks,
	TimelineElement,
	TimelineTrack,
} from "@/app/video-editor/_opencut/timeline/types";
import {
	useTimelineStore,
	type TipoVinculo,
} from "@/app/video-editor/_opencut/timeline/timeline-store";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

type Opciones = {
	iman: boolean;
	vinculacion: boolean;
	tipos: Record<TipoVinculo, boolean>;
};

function opcionesActuales(): Opciones {
	const s = useTimelineStore.getState();
	return {
		iman: s.rippleEditingEnabled,
		vinculacion: s.vinculacion,
		tipos: s.tiposVinculados,
	};
}

/** A qué casilla de «Configuración de vinculación» pertenece un elemento. */
export function tipoVinculoDe({
	element,
	track,
}: {
	element: TimelineElement;
	track: TimelineTrack;
}): TipoVinculo | null {
	switch (element.type) {
		case "text":
			return "texto";
		case "sticker":
		case "graphic":
			return "stickers";
		case "effect": {
			const id = element.effectType.toLowerCase();
			if (id.includes("filtro") || id.includes("filter")) return "filtros";
			if (id.includes("ajust") || id.includes("adjust")) return "ajuste";
			return "efectos";
		}
		case "audio":
			// Texto a voz lo marca el paquete de subtítulos/voz con `params.tts`;
			// lo de la biblioteca de sonidos son efectos de sonido; lo importado, audio.
			if (element.params.tts === true) return "textoAVoz";
			return element.sourceType === "library" ? "efectosSonido" : "audio";
		case "video":
		case "image":
			return track.type === "video" ? "superposicion" : null;
	}
}

export function estaVinculado({
	element,
	track,
	tipos,
}: {
	element: TimelineElement;
	track: TimelineTrack;
	tipos: Record<TipoVinculo, boolean>;
}): boolean {
	const tipo = tipoVinculoDe({ element, track });
	return tipo !== null && tipos[tipo];
}

const fin = (e: TimelineElement) => e.startTime + e.duration;

/**
 * Los elementos de otras pistas vinculados a un clip de la pista principal:
 * los que EMPIEZAN dentro de él (como en CapCut, el ancla es el inicio).
 */
export function elementosVinculados({
	tracks,
	clip,
	tipos = useTimelineStore.getState().tiposVinculados,
}: {
	tracks: SceneTracks;
	clip: { startTime: number; duration: number };
	tipos?: Record<TipoVinculo, boolean>;
}): Array<{ trackId: string; elementId: string }> {
	const desde = clip.startTime;
	const hasta = clip.startTime + clip.duration;
	return [...tracks.overlay, ...tracks.audio].flatMap((track) =>
		track.locked
			? []
			: track.elements
					.filter(
						(element) =>
							element.startTime >= desde &&
							element.startTime < hasta &&
							estaVinculado({ element, track, tipos }),
					)
					.map((element) => ({ trackId: track.id, elementId: element.id })),
	);
}

/** Empaqueta la pista principal desde 0. Devuelve los inicios nuevos por id. */
function empaquetar({
	elementos,
	inicioAntes,
}: {
	elementos: TimelineElement[];
	inicioAntes: Map<string, number>;
}): Map<string, number> {
	const orden = [...elementos].sort((a, b) => {
		if (a.startTime !== b.startTime) return a.startTime - b.startTime;
		// Empate: el que llegó o se movió a este lugar va primero (es lo que se
		// soltó acá y empuja al que estaba).
		const aMovido = inicioAntes.get(a.id) !== a.startTime ? 0 : 1;
		const bMovido = inicioAntes.get(b.id) !== b.startTime ? 0 : 1;
		return aMovido - bMovido;
	});
	const inicios = new Map<string, number>();
	let cursor = 0;
	for (const elemento of orden) {
		inicios.set(elemento.id, cursor);
		cursor += elemento.duration;
	}
	return inicios;
}

function conInicios<TTrack extends TimelineTrack>(
	track: TTrack,
	inicios: Map<string, number>,
): TTrack {
	let cambio = false;
	const elements = track.elements.map((element) => {
		const nuevo = inicios.get(element.id);
		if (nuevo === undefined || nuevo === element.startTime) return element;
		cambio = true;
		return { ...element, startTime: nuevo as MediaTime };
	});
	return cambio ? ({ ...track, elements } as TTrack) : track;
}

export function aplicarImanPrincipal({
	antes,
	despues,
	opciones = opcionesActuales(),
}: {
	antes: SceneTracks | null;
	despues: SceneTracks;
	opciones?: Opciones;
}): SceneTracks {
	const { iman, vinculacion, tipos } = opciones;
	if (!iman && !vinculacion) return despues;
	if (despues.main.locked) return despues;

	const principalAntes = new Map(
		(antes?.main.elements ?? []).map((e) => [e.id, e]),
	);
	const inicioAntes = new Map(
		[...principalAntes.values()].map((e) => [e.id, e.startTime as number]),
	);

	// 1. Imán: la principal sin huecos.
	let principal = despues.main;
	if (iman) {
		principal = conInicios(
			despues.main,
			empaquetar({ elementos: despues.main.elements, inicioAntes }),
		);
	}

	// 2. Vinculación: cada clip de la principal que cambió de lugar arrastra lo
	//    que tenía encima (lo que el cambio no tocó).
	let overlay = despues.overlay;
	let audio = despues.audio;
	if (vinculacion && antes) {
		// Los rangos que «reclaman» lo que tienen encima, en orden de prioridad:
		//  1. cada clip que ya estaba, con su lugar de ANTES (delta 0 también
		//     cuenta: lo que está sobre un clip quieto se queda quieto, aunque
		//     ahora caiga sobre otro que se movió);
		//  2. cada clip nuevo (la mitad derecha de un «Borrar a la izquierda», lo
		//     insertado), con su lugar ANTES DEL IMÁN: lo que el imán le corrió.
		const corrimientos: Array<{ desde: number; hasta: number; delta: number }> =
			[];
		const despuesPorId = new Map(despues.main.elements.map((e) => [e.id, e]));
		for (const clip of principal.elements) {
			const previo = principalAntes.get(clip.id);
			if (!previo) continue;
			// Sin imán, un clip que cambió de duración se RECORTÓ, no se movió: lo
			// de encima se queda (con imán, el empaquetado ya deja su inicio igual).
			const delta =
				!iman && clip.duration !== previo.duration
					? 0
					: clip.startTime - previo.startTime;
			corrimientos.push({ desde: previo.startTime, hasta: fin(previo), delta });
		}
		for (const clip of principal.elements) {
			if (principalAntes.has(clip.id)) continue;
			const crudo = despuesPorId.get(clip.id);
			if (!crudo) continue;
			corrimientos.push({
				desde: crudo.startTime,
				hasta: fin(crudo),
				delta: clip.startTime - crudo.startTime,
			});
		}

		if (corrimientos.some((c) => c.delta !== 0)) {
			const inicioPrevio = new Map<string, number>();
			for (const track of [...antes.overlay, ...antes.audio]) {
				for (const e of track.elements) inicioPrevio.set(e.id, e.startTime);
			}

			const correr = <TTrack extends TimelineTrack>(track: TTrack): TTrack => {
				if (track.locked) return track;
				let cambio = false;
				const elements = track.elements.map((element) => {
					// Sólo lo que el cambio no tocó (ver la cabecera).
					if (inicioPrevio.get(element.id) !== element.startTime) return element;
					if (!estaVinculado({ element, track, tipos })) return element;
					const c = corrimientos.find(
						(r) => element.startTime >= r.desde && element.startTime < r.hasta,
					);
					if (!c || c.delta === 0) return element;
					cambio = true;
					return {
						...element,
						startTime: Math.max(0, element.startTime + c.delta) as MediaTime,
					};
				});
				return cambio ? ({ ...track, elements } as TTrack) : track;
			};

			overlay = despues.overlay.map(correr);
			audio = despues.audio.map(correr);
		}
	}

	const sinCambios =
		principal === despues.main &&
		overlay.every((t, i) => t === despues.overlay[i]) &&
		audio.every((t, i) => t === despues.audio[i]);
	if (sinCambios) return despues;
	return { overlay, main: principal, audio };
}
