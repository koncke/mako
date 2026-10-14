// =============================================================================
// «Borrar silencios»: dividir en cada borde, quitar las piezas mudas y cerrar el hueco
// =============================================================================
// Pedido de Martín (reunión 858545195 @94:33, validado el 13/10): «un botón "Borrar
// silencios", que los elimine solo». Un solo comando —un solo Deshacer— que por adentro
// usa las mismas piezas que la barra: `SplitElementsCommand` (con lo que reparte entre
// las dos mitades: fundidos, animaciones, transición, curva de velocidad) y
// `DeleteElementsCommand` (con lo que le quita al vecino). Lo que decide dónde cortar y
// dónde queda cada clip es puro y está probado (audio/silencios-plan.ts).
//
// Lo que NO hace, a propósito: borrar el clip entero (si no queda nada que oír, no se
// toca: audio/silencios-plan.ts → quedaAlgoEnLaLinea) ni mover otras pistas (lo que
// está encima lo arrastra la vinculación de CapCut si está prendida: ripple/iman.ts).

import {
	Command,
	createElementSelectionResult,
	type CommandResult,
} from "@/app/video-editor/_opencut/commands/base-command";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import {
	isRetimableElement,
	type SceneTracks,
	type TimelineElement,
	type TimelineTrack,
} from "@/app/video-editor/_opencut/timeline";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline/types";
import { roundMediaTime, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	cortesDelClip,
	esPiezaDeSilencio,
	quedaAlgoEnLaLinea,
	recolocar,
	silenciosEnLaLinea,
	type Tramo,
} from "@/app/video-editor/_opencut/audio/silencios-plan";
import { DeleteElementsCommand } from "./delete-elements";
import { SplitElementsCommand } from "./split-elements";

export type PlanDeSilencios = {
	ref: ElementRef;
	/** Los silencios en segundos de la FUENTE (dsp/silencios.ts → rangosDeSilencio). */
	silenciosFuente: Tramo[];
};

export class BorrarSilenciosCommand extends Command {
	private savedState: SceneTracks | null = null;
	private quedaron: ElementRef[] = [];
	private quitadoTicks = 0;
	private readonly planes: PlanDeSilencios[];

	constructor(planes: PlanDeSilencios[]) {
		super();
		this.planes = planes;
	}

	/** Cuánto se quitó de la línea, en segundos (para el aviso). */
	segundosQuitados(): number {
		return this.quitadoTicks / TICKS_PER_SECOND;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;
		this.quedaron = [];
		this.quitadoTicks = 0;
		// De atrás para adelante: lo que se quita de un clip corre lo que viene después
		// en su pista, y así ningún corrimiento alcanza a un clip que falta procesar.
		const enOrden = this.planes
			.flatMap((plan) => {
				const hallado = editor.timeline.getElementsWithTracks({ elements: [plan.ref] })[0];
				return hallado ? [{ plan, inicio: hallado.element.startTime as number }] : [];
			})
			.sort((a, b) => b.inicio - a.inicio);
		for (const { plan } of enOrden) this.borrarEnClip(editor, plan);
		return this.quedaron.length > 0 ? createElementSelectionResult(this.quedaron) : undefined;
	}

	private borrarEnClip(editor: EditorCore, plan: PlanDeSilencios): void {
		const hallado = editor.timeline.getElementsWithTracks({ elements: [plan.ref] })[0];
		if (!hallado) return;
		const { track, element } = hallado;
		const T = TICKS_PER_SECOND;
		const clip = {
			inicio: element.startTime / T,
			duracion: element.duration / T,
			trimStart: element.trimStart / T,
			retime: isRetimableElement(element) ? element.retime : undefined,
		};
		const silencios = silenciosEnLaLinea(clip, plan.silenciosFuente);
		if (silencios.length === 0 || !quedaAlgoEnLaLinea(clip, silencios)) return;
		// Las posiciones de ANTES, para recolocar al final sin depender del imán.
		const inicioAntes = new Map(
			(track.elements as TimelineElement[]).map((e) => [e.id, e.startTime as number]),
		);

		// 1. Dividir en cada borde. Cada división se hace sobre las piezas que ya hay:
		//    la que contiene el corte se parte y las demás quedan como están.
		let piezas: ElementRef[] = [plan.ref];
		for (const corte of cortesDelClip(clip, silencios)) {
			const division = new SplitElementsCommand({
				elements: piezas,
				splitTime: roundMediaTime({ time: corte * T }),
			});
			division.execute();
			piezas = [...piezas, ...division.getRightSideElements()];
		}

		// 2. Qué pieza es silencio: por su punto medio.
		const vivas = editor.timeline.getElementsWithTracks({ elements: piezas });
		const mudas = vivas.filter(({ element: e }) =>
			esPiezaDeSilencio(
				{ inicio: e.startTime / T, fin: (e.startTime + e.duration) / T },
				silencios,
			),
		);
		const quedan = vivas
			.filter((v) => !mudas.includes(v))
			.sort((a, b) => a.element.startTime - b.element.startTime);
		if (mudas.length === 0 || quedan.length === 0) return;
		const quitado = mudas.reduce((s, { element: e }) => s + (e.duration as number), 0);
		new DeleteElementsCommand({
			elements: mudas.map(({ track: t, element: e }) => ({ trackId: t.id, elementId: e.id })),
		}).execute();

		// 3. Recolocar: las piezas pegadas desde donde empezaba el clip y lo de después
		//    corrido lo que se quitó (audio/silencios-plan.ts → recolocar).
		const tracks = editor.scenes.getActiveScene().tracks;
		const pista = editor.timeline.getTrackById({ trackId: track.id });
		if (!pista) return;
		const idsPiezas = new Set(quedan.map((v) => v.element.id));
		const lugares = recolocar({
			piezas: quedan.map((v) => ({ id: v.element.id, duracion: v.element.duration as number })),
			otros: (pista.elements as TimelineElement[])
				.filter((e) => !idsPiezas.has(e.id))
				.map((e) => ({ id: e.id, inicioAntes: inicioAntes.get(e.id) ?? (e.startTime as number) })),
			inicioOriginal: element.startTime as number,
			finOriginal: (element.startTime + element.duration) as number,
			quitado,
		});
		const reubicar = <TTrack extends TimelineTrack>(t: TTrack): TTrack => {
			if (t.id !== track.id) return t;
			const elements = t.elements.map((e) => {
				const lugar = lugares.get(e.id);
				return lugar === undefined || lugar === e.startTime
					? e
					: ({ ...e, startTime: roundMediaTime({ time: lugar }) } as typeof e);
			});
			return { ...t, elements } as TTrack;
		};
		editor.timeline.updateTracks({
			overlay: tracks.overlay.map((t) => reubicar(t)),
			main: reubicar(tracks.main),
			audio: tracks.audio.map((t) => reubicar(t)),
		});

		this.quedaron.push(...quedan.map((v) => ({ trackId: track.id, elementId: v.element.id })));
		this.quitadoTicks += quitado;
	}

	undo(): void {
		if (this.savedState) EditorCore.getInstance().timeline.updateTracks(this.savedState);
	}
}
