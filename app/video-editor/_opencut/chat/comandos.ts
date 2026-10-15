// =============================================================================
// chat/comandos — cada operación resuelta del chat, con el comando que usa su BOTÓN
// =============================================================================
// La regla: una operación del chat se porta igual que el botón de la pantalla (imán,
// transiciones, fundidos, animaciones), así que usa el MISMO comando del motor:
//
//   transición, animación, estilo, posición,   UpdateElementsCommand con los params, como
//   reflejo, fundidos, ruido, normalizar       `updateElements` de su panel (la regla de
//   (apagar o cambiar el objetivo)             elegir animación: animaciones/elegir.ts)
//   velocidad                                  CambiarVelocidadCommand (speed-tab.tsx)
//   recortar                                   computeGroupResize + UpdateElementsCommand,
//                                              lo mismo que arrastrar el borde
//                                              (timeline/controllers/resize-controller.ts)
//   filtro / efecto de un clip                 AddClipEffectCommand / RemoveClipEffectCommand /
//                                              UpdateClipEffectParamsCommand
//   capa de filtro o efecto                    InsertElementCommand(buildEffectElement), el ⊕
//   ajustar el color                           el `write` del origen del panel «Ajustar»
//                                              (effects/capas.ts, origenEfecto)
//   extraer audio                              ToggleSourceAudioSeparationCommand
//   cortar tramo / frase / muletillas          CortarTramosCommand (el de «Transcripción»)
//
// Todo va en UN BatchCommand (chat/aplicar.ts). Los comandos que dependen de cómo quedó
// el elemento después de los anteriores del lote (los efectos se REEMPLAZAN como lista, los
// recortes se miden contra los bordes de ese momento, lo nuevo recién tiene id al
// insertarse) se arman AL EJECUTAR (`Diferido`): armados al pedir, el segundo cambio de
// efectos de un clip pisaba al primero.
//
// Sin test: necesita el editor y el WASM. Lo que dice cada fila de la revisión lo
// prueba tests/video-editor-chat.test.ts; que el comando haga eso en pantalla se mira en
// el navegador.
// =============================================================================

import { EditorCore } from "@/app/video-editor/_opencut/core";
import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import {
	AddClipEffectCommand,
	DeleteElementsCommand,
	InsertElementCommand,
	RemoveClipEffectCommand,
	SplitElementsCommand,
	ToggleSourceAudioSeparationCommand,
	UpdateClipEffectParamsCommand,
	UpdateElementsCommand,
} from "@/app/video-editor/_opencut/commands/timeline/element";
import {
	CambiarVelocidadCommand,
	DURACION_MINIMA_TRAS_RAMPA,
	duracionConRetime,
} from "@/app/video-editor/_opencut/commands/timeline/element/velocidad";
import { CortarTramosCommand } from "@/app/video-editor/_opencut/commands/timeline/element/cortar-tramos";
import { ReemplazarSubtitulosCommand } from "@/app/video-editor/_opencut/subtitles/editar";
import { buildEffectElement, buildTextElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { findTrackInSceneTracks } from "@/app/video-editor/_opencut/timeline/track-element-update";
import type { ElementRef, RetimeConfig, SceneTracks, TimelineElement, VisualElement } from "@/app/video-editor/_opencut/timeline/types";
import { computeGroupResize } from "@/app/video-editor/_opencut/timeline/group-resize";
import { buildResizeMembers } from "@/app/video-editor/_opencut/timeline/controllers/resize-controller";
import { buildConstantRetime, buildCurveRetime, presetCurva } from "@/app/video-editor/_opencut/retime";
import { registerDefaultEffects } from "@/app/video-editor/_opencut/effects";
import { origenEfecto } from "@/app/video-editor/_opencut/effects/capas";
import { PARAMS_BASICO, TIPO_AJUSTE } from "@/app/video-editor/_opencut/effects/definitions/ajuste";
import { PREFIJO_FILTRO } from "@/app/video-editor/_opencut/effects/definitions/filtros";
import { buscarFrase, muletillasDe, palabrasEnOrden, tramosDePalabras, transcripcionDe } from "@/app/video-editor/_opencut/transcripcion/modelo";
import { TICKS_PER_SECOND, mediaTime, mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm";
import type { OperacionResuelta, RefElemento } from "./linea";

/** Lo que se aplica después del lote, con su propio paso de deshacer (tarda). */
export type OperacionLarga = Extract<OperacionResuelta, { op: "revertir" | "congelar" | "normalizar" | "generar_subtitulos" }>;
const LARGAS = new Set<OperacionResuelta["op"]>(["revertir", "congelar", "normalizar", "generar_subtitulos"]);
export const esLarga = (r: OperacionResuelta): r is OperacionLarga => LARGAS.has(r.op);

/** Un comando que se arma al EJECUTAR, contra la línea de tiempo de ese momento del lote. */
class Diferido extends Command {
	private real: Command | null = null;
	constructor(private readonly armar: () => Command | null) {
		super();
	}
	execute(): CommandResult | undefined {
		this.real = this.armar();
		return this.real?.execute();
	}
	undo(): void {
		this.real?.undo();
	}
	redo(): CommandResult | undefined {
		return this.real?.redo();
	}
}

const segundos = (s: number) => mediaTimeFromSeconds({ seconds: s });

function elementoActual(o: ElementRef): TimelineElement | null {
	const tracks: SceneTracks = EditorCore.getInstance().scenes.getActiveScene().tracks;
	return (findTrackInSceneTracks({ tracks, trackId: o.trackId })?.elements as TimelineElement[] | undefined)?.find((e) => e.id === o.elementId) ?? null;
}

const actualizar = (o: ElementRef, patch: Partial<TimelineElement>) => new UpdateElementsCommand({ updates: [{ ...o, patch }] });

export type LoteChat = {
	/** En orden; van en UN BatchCommand. */
	comandos: Command[];
	/** Los cortes, para decir después cuáles no cortaron nada. */
	cortes: Array<{ que: string; comando: CortarTramosCommand }>;
};

/**
 * Los comandos de las operaciones que van en el lote (las largas las corre chat/aplicar.ts
 * después). `idioma` es el de las muletillas (Subtítulos › Idioma).
 */
export function armarLote(resueltas: readonly OperacionResuelta[], { idioma }: { idioma: string }): LoteChat {
	registerDefaultEffects();
	const nuevos = new Map<string, InsertElementCommand>();
	/** Dónde está el elemento: lo nuevo de este lote lo dice su inserción, al ejecutarse. */
	const objetivo = (el: RefElemento): ElementRef | null => {
		if (!el.nuevo) return { trackId: el.trackId, elementId: el.elementId };
		const insercion = nuevos.get(el.ref);
		const trackId = insercion?.getTrackId();
		return insercion && trackId ? { trackId, elementId: insercion.getElementId() } : null;
	};
	/** Un comando sobre UN elemento, armado al ejecutar con el elemento de ese momento. */
	const sobre = (el: RefElemento, armar: (o: ElementRef, actual: TimelineElement) => Command | null) =>
		new Diferido(() => {
			const o = objetivo(el);
			const actual = o ? elementoActual(o) : null;
			return o && actual ? armar(o, actual) : null;
		});

	const comandos: Command[] = [];
	const cortes: LoteChat["cortes"] = [];
	const tramos: Array<[number, number]> = [];
	let corteDeTramos: CortarTramosCommand | null = null;

	for (const r of resueltas) {
		if (esLarga(r)) continue;
		switch (r.op) {
			case "agregar_texto": {
				// Lo mismo que «Texto predeterminado» (text/components/assets-view.tsx), con el texto pedido.
				const insercion = new InsertElementCommand({
					element: buildTextElement({
						raw: { name: r.texto.slice(0, 40), duration: segundos(r.duracion), params: { content: r.texto } },
						startTime: segundos(r.inicio),
					}),
					placement: { mode: "auto", trackType: "text" },
				});
				if (r.ref) nuevos.set(r.ref, insercion);
				comandos.push(insercion);
				break;
			}
			case "capa_efecto": {
				// El ⊕ de la biblioteca (effects/capas.ts, agregarCapaEfecto) en el tramo pedido.
				const insercion = new InsertElementCommand({
					element: buildEffectElement({ effectType: r.tipo, startTime: segundos(r.inicio), duration: segundos(r.duracion) }),
					placement: { mode: "auto", trackType: "effect" },
				});
				if (r.ref) nuevos.set(r.ref, insercion);
				comandos.push(insercion);
				break;
			}
			case "cambiar_texto":
				comandos.push(sobre(r.el, (o) => actualizar(o, { params: { content: r.texto } } as Partial<TimelineElement>)));
				break;
			case "borrar":
				comandos.push(
					new Diferido(() => {
						const elements = r.els.map(objetivo).filter((o): o is ElementRef => o !== null);
						return elements.length ? new DeleteElementsCommand({ elements }) : null;
					}),
				);
				break;
			case "mover":
				comandos.push(sobre(r.el, (o) => actualizar(o, { startTime: segundos(r.inicio) })));
				break;
			case "duracion":
				comandos.push(sobre(r.el, (o) => actualizar(o, { duration: segundos(r.duracion) })));
				break;
			case "dividir":
				comandos.push(sobre(r.el, (o) => new SplitElementsCommand({ elements: [o], splitTime: segundos(r.en) })));
				break;
			case "recortar": {
				// Como arrastrar cada borde. El derecho primero: el izquierdo, en la principal con
				// el imán, corre el clip y el borde derecho pedido ya no caería en su lugar.
				const borde = (lado: "left" | "right", s: number) =>
					sobre(r.el, (o) => {
						const editor = EditorCore.getInstance();
						const fps = editor.project.getActiveOrNull()?.settings.fps;
						const [miembro] = buildResizeMembers({ tracks: editor.scenes.getActiveScene().tracks, selectedElements: [o] });
						if (!fps || !miembro) return null;
						const desde = lado === "left" ? miembro.startTime : miembro.startTime + miembro.duration;
						const resultado = computeGroupResize({
							members: [miembro],
							side: lado,
							deltaTime: mediaTime({ ticks: Math.round(s * TICKS_PER_SECOND) - desde }),
							fps,
						});
						if (resultado.deltaTime === 0) return null;
						return new UpdateElementsCommand({
							updates: resultado.updates.map((u) => ({ trackId: u.trackId, elementId: u.elementId, patch: u.patch as Partial<TimelineElement> })),
						});
					});
				if (r.fin !== undefined) comandos.push(borde("right", r.fin));
				if (r.inicio !== undefined) comandos.push(borde("left", r.inicio));
				break;
			}
			case "volumen":
				comandos.push(sobre(r.el, (o) => actualizar(o, { params: { volume: r.db } } as Partial<TimelineElement>)));
				break;
			case "silenciar":
				comandos.push(sobre(r.el, (o) => actualizar(o, { params: { muted: r.silenciado } } as Partial<TimelineElement>)));
				break;
			case "ocultar":
				comandos.push(sobre(r.el, (o) => actualizar(o, { hidden: r.oculto } as Partial<TimelineElement>)));
				break;
			case "params":
				// `applyElementUpdate` MEZCLA los params: lo que no va en el parche queda como estaba.
				comandos.push(sobre(r.el, (o) => actualizar(o, { params: r.params } as Partial<TimelineElement>)));
				break;
			case "velocidad":
				comandos.push(
					sobre(r.el, (o, actual) => {
						if (actual.type !== "video" && actual.type !== "audio") return null;
						let retime: RetimeConfig | undefined;
						if (r.curva) {
							const preset = presetCurva(r.curva);
							if (!preset) return null;
							retime = buildCurveRetime({ preset: preset.id, puntos: preset.puntos });
						} else if (r.rate !== null) {
							// Como «Estándar» (speed/components/speed-tab.tsx): conserva el tono salvo
							// que se pida o que ya lo cambiara; a 1× conservándolo no hay retime.
							const cambiaTono = r.cambiarTono ?? (actual.retime ? actual.retime.maintainPitch !== true : false);
							retime = r.rate === 1 && !cambiaTono ? undefined : buildConstantRetime({ rate: r.rate, maintainPitch: !cambiaTono });
						}
						if (duracionConRetime(actual, retime) < DURACION_MINIMA_TRAS_RAMPA) return null;
						return new CambiarVelocidadCommand({ ...o, retime });
					}),
				);
				break;
			case "filtro":
				comandos.push(
					sobre(r.el, (o, actual) => {
						const previo = ((actual as VisualElement).effects ?? []).find((x) => x.type.startsWith(PREFIJO_FILTRO));
						if (r.tipo === null) return previo ? new RemoveClipEffectCommand({ ...o, effectId: previo.id }) : null;
						if (previo && previo.type === r.tipo) return new UpdateClipEffectParamsCommand({ ...o, effectId: previo.id, params: { intensidad: r.intensidad } });
						// Un clip tiene UN filtro: agregar otro lo reemplaza en su lugar (grupoUnico).
						return new AddClipEffectCommand({ ...o, effectType: r.tipo, params: { intensidad: r.intensidad } });
					}),
				);
				break;
			case "efecto":
				comandos.push(
					sobre(r.el, (o, actual) => {
						if (!r.quitar) return new AddClipEffectCommand({ ...o, effectType: r.tipo });
						const efecto = ((actual as VisualElement).effects ?? []).find((x) => x.type === r.tipo);
						return efecto ? new RemoveClipEffectCommand({ ...o, effectId: efecto.id }) : null;
					}),
				);
				break;
			case "ajustar_color":
				comandos.push(
					sobre(r.el, (o, actual) => {
						if (actual.type !== "video" && actual.type !== "image") return null;
						// El `write` de cada deslizador de «Ajustar»: crea el efecto `ajuste` si falta.
						const origen = origenEfecto({ element: actual, trackId: o.trackId, buscar: (x) => x.type === TIPO_AJUSTE, tipoNuevo: TIPO_AJUSTE });
						let nuevo: TimelineElement = actual;
						for (const [clave, valor] of Object.entries(r.valores)) {
							const def = PARAMS_BASICO.find((p) => p.key === clave);
							if (def) nuevo = origen.param(def).write?.({ element: nuevo, value: valor }) ?? nuevo;
						}
						return actualizar(o, { effects: (nuevo as VisualElement).effects } as Partial<TimelineElement>);
					}),
				);
				break;
			case "separar_audio":
				comandos.push(sobre(r.el, (o) => new ToggleSourceAudioSeparationCommand(o)));
				break;
			case "reemplazar_en_subtitulos":
				comandos.push(new ReemplazarSubtitulosCommand({ buscar: r.buscar, reemplazo: r.reemplazo }));
				break;
			case "cortar_tramo":
				// Todos los tramos en UN corte: medidos contra la misma línea de tiempo (la que vio la IA).
				tramos.push([r.inicio, r.fin]);
				if (!corteDeTramos) {
					corteDeTramos = new CortarTramosCommand({ tramos });
					cortes.push({ que: tramos.length === 1 ? "el tramo pedido" : "los tramos pedidos", comando: corteDeTramos });
					comandos.push(corteDeTramos);
				}
				break;
			case "cortar_frase": {
				// Por TEXTO, al ejecutar: lo de antes en el lote pudo correr el video.
				const comando = new CortarTramosCommand({
					tramos: (tracks) => {
						const parrafos = transcripcionDe({ tracks, tps: TICKS_PER_SECOND });
						const apariciones = buscarFrase(parrafos, r.frase);
						const elegidas = r.vez ? apariciones.slice(r.vez - 1, r.vez) : apariciones;
						return tramosDePalabras({ palabras: palabrasEnOrden(parrafos), quitar: new Set(elegidas.flat()) });
					},
				});
				cortes.push({ que: `«${r.frase.slice(0, 40)}»`, comando });
				comandos.push(comando);
				break;
			}
			case "eliminar_muletillas": {
				const comando = new CortarTramosCommand({
					tramos: (tracks) => {
						const parrafos = transcripcionDe({ tracks, tps: TICKS_PER_SECOND });
						return tramosDePalabras({ palabras: palabrasEnOrden(parrafos), quitar: muletillasDe(parrafos, idioma) });
					},
				});
				cortes.push({ que: "las muletillas", comando });
				comandos.push(comando);
				break;
			}
		}
	}
	return { comandos, cortes };
}
