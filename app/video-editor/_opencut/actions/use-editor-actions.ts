"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import { useActionHandler } from "@/app/video-editor/_opencut/actions/use-action-handler";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useElementSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-selection";
import {
	addMediaTime,
	maxMediaTime,
	mediaTime,
	mediaTimeFromSeconds,
	minMediaTime,
	subMediaTime,
	ZERO_MEDIA_TIME,
} from "@/app/video-editor/_opencut/wasm";
import { useKeyframeSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-keyframe-selection";
import {
	canElementBeHidden,
	canElementHaveAudio,
	hasMediaId,
	type TimelineElement,
} from "@/app/video-editor/_opencut/timeline";
import { cancelInteraction } from "@/app/video-editor/_opencut/editor/cancel-interaction";
import { invokeAction } from "@/app/video-editor/_opencut/actions";
import { canToggleSourceAudio } from "@/app/video-editor/_opencut/timeline/audio-separation";
import { clampDb, hasAnimatedVolume } from "@/app/video-editor/_opencut/timeline/audio-state";
import { getElementKeyframes } from "@/app/video-editor/_opencut/animation";
import { elementosVinculados } from "@/app/video-editor/_opencut/ripple/iman";
import {
	objetivosEnCabezal,
	pistasEnOrden,
	sinBloqueados,
	todosEnCabezal,
} from "@/app/video-editor/_opencut/timeline/components/pistas-ce";
import { COLORES_MARCADOR } from "@/app/video-editor/_opencut/timeline/components/theme";
import {
	copiarAtributos,
	cortarSeleccion,
	pegarAtributos,
} from "@/app/video-editor/_opencut/commands/timeline/element/atributos";
import {
	activateScope,
	clearActiveScope,
	type ScopeEntry,
} from "@/app/video-editor/_opencut/selection/scope";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { useImportarArchivos } from "@/app/video-editor/_opencut/media/importar";
import {
	SECCION_IMPORTAR_MEDIOS,
	useAssetsPanelStore,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import {
	alternarReproduccion,
	busquedaRapida,
	detenerBusqueda,
	irAlBorde,
	irAPuntoDeCorte,
	moverCuadros,
} from "@/app/video-editor/_opencut/preview/navegacion";

/** «Avanzar/Retroceder muchos fotogramas»: 10 cuadros (timelineLargeAdjustRange de CapCut). */
const CUADROS_PASO_GRANDE = 10;

function irA(editor: EditorCore, tiempo: number): void {
	const limite = editor.timeline.getTotalDuration();
	editor.playback.seek({
		time: maxMediaTime({
			a: ZERO_MEDIA_TIME,
			b: minMediaTime({ a: limite, b: mediaTime({ ticks: Math.round(tiempo) }) }),
		}),
	});
}

let colorMarcador = 0;

export function useEditorActions() {
	const editor = useEditor();
	const router = useRouter();
	const { importar } = useImportarArchivos();
	const { selectedElements, setElementSelection } = useElementSelection();
	const { selectedKeyframes, clearKeyframeSelection } = useKeyframeSelection();
	const selectedMaskPointSelection = useEditor((e) =>
		e.selection.getSelectedMaskPointSelection(),
	);
	const toggleSnapping = useTimelineStore((s) => s.toggleSnapping);
	const rippleEditingEnabled = useTimelineStore((s) => s.rippleEditingEnabled);
	const toggleRippleEditing = useTimelineStore((s) => s.toggleRippleEditing);
	const alternarVinculacion = useTimelineStore((s) => s.alternarVinculacion);
	const alternarEjeVistaPrevia = useTimelineStore((s) => s.alternarEjeVistaPrevia);
	const fijarModoCursor = useTimelineStore((s) => s.fijarModoCursor);
	const toggleElementExpanded = useTimelineStore((s) => s.toggleElementExpanded);
	const hasTimelineSelection =
		selectedElements.length > 0 ||
		selectedKeyframes.length > 0 ||
		selectedMaskPointSelection !== null;
	const hasTimelineSelectionRef = useCommittedRef(hasTimelineSelection);
	const clearTimelineSelectionRef = useCommittedRef(() => {
		editor.selection.clearSelection();
	});
	const clearTimelineActiveSelectionRef = useCommittedRef(() => {
		editor.selection.clearMostSpecificSelection();
	});
	const [timelineScope] = useState<ScopeEntry>(() => ({
		hasSelection: () => hasTimelineSelectionRef.current,
		clear: () => {
			clearTimelineSelectionRef.current();
		},
		clearActive: () => {
			clearTimelineActiveSelectionRef.current();
		},
	}));

	useEffect(() => {
		if (!hasTimelineSelection) {
			return;
		}

		return activateScope({ entry: timelineScope });
	}, [hasTimelineSelection, timelineScope]);

	// ── Reproductor ──────────────────────────────────────────────────────────

	// Las del reproductor llaman a preview/navegacion.ts (paquete E): ahí vive
	// la búsqueda rápida a varias velocidades (J/K/L), y Espacio/flechas tienen
	// que cortarla igual que en CapCut.
	useActionHandler("toggle-play", () => alternarReproduccion(editor), undefined);

	useActionHandler(
		"stop-playback",
		() => {
			detenerBusqueda(editor);
			editor.playback.seek({ time: ZERO_MEDIA_TIME });
		},
		undefined,
	);

	useActionHandler(
		"seek-forward",
		(args) => {
			const delta = mediaTimeFromSeconds({ seconds: args?.seconds ?? 1 });
			irA(editor, addMediaTime({ a: editor.playback.getCurrentTime(), b: delta }));
		},
		undefined,
	);

	useActionHandler(
		"seek-backward",
		(args) => {
			const delta = mediaTimeFromSeconds({ seconds: args?.seconds ?? 1 });
			irA(editor, subMediaTime({ a: editor.playback.getCurrentTime(), b: delta }));
		},
		undefined,
	);

	useActionHandler("frame-step-forward", () => moverCuadros(editor, 1), undefined);
	useActionHandler("frame-step-backward", () => moverCuadros(editor, -1), undefined);
	useActionHandler(
		"jump-forward",
		() => moverCuadros(editor, CUADROS_PASO_GRANDE),
		undefined,
	);
	useActionHandler(
		"jump-backward",
		() => moverCuadros(editor, -CUADROS_PASO_GRANDE),
		undefined,
	);
	useActionHandler("goto-start", () => irAlBorde(editor, "inicio"), undefined);
	useActionHandler("goto-end", () => irAlBorde(editor, "fin"), undefined);
	useActionHandler("punto-corte-anterior", () => irAPuntoDeCorte(editor, -1), undefined);
	useActionHandler("punto-corte-siguiente", () => irAPuntoDeCorte(editor, 1), undefined);
	useActionHandler("busqueda-izquierda", () => busquedaRapida(editor, -1), undefined);
	useActionHandler("busqueda-detener", () => detenerBusqueda(editor), undefined);
	useActionHandler("busqueda-derecha", () => busquedaRapida(editor, 1), undefined);

	// ── Línea de tiempo ──────────────────────────────────────────────────────

	useActionHandler(
		"split",
		() => {
			const objetivos = objetivosEnCabezal({ editor });
			if (objetivos.length === 0) return;
			editor.timeline.splitElements({
				elements: objetivos,
				splitTime: editor.playback.getCurrentTime(),
			});
		},
		undefined,
	);

	useActionHandler(
		"dividir-todo",
		() => {
			const objetivos = todosEnCabezal({ editor });
			if (objetivos.length === 0) return;
			editor.timeline.splitElements({
				elements: objetivos,
				splitTime: editor.playback.getCurrentTime(),
			});
		},
		undefined,
	);

	useActionHandler(
		"split-left",
		() => {
			const objetivos = objetivosEnCabezal({ editor });
			if (objetivos.length === 0) return;

			const rightSideElements = editor.timeline.splitElements({
				elements: objetivos,
				splitTime: editor.playback.getCurrentTime(),
				retainSide: "right",
			});

			// Con el imán, lo que queda se corre a la izquierda: el cabezal lo
			// sigue, como en CapCut.
			if (rippleEditingEnabled && rightSideElements.length > 0) {
				const firstRightElement = editor.timeline.getElementsWithTracks({
					elements: [rightSideElements[0]],
				})[0];
				if (firstRightElement) {
					editor.playback.seek({ time: firstRightElement.element.startTime });
				}
			}
		},
		undefined,
	);

	useActionHandler(
		"split-right",
		() => {
			const objetivos = objetivosEnCabezal({ editor });
			if (objetivos.length === 0) return;
			editor.timeline.splitElements({
				elements: objetivos,
				splitTime: editor.playback.getCurrentTime(),
				retainSide: "left",
			});
		},
		undefined,
	);

	useActionHandler(
		"delete-selected",
		() => {
			switch (editor.selection.getActiveSelectionKind()) {
				case "mask-points":
					if (!selectedMaskPointSelection) {
						return;
					}
					editor.timeline.deleteFreeformPathMaskPoints({
						trackId: selectedMaskPointSelection.trackId,
						elementId: selectedMaskPointSelection.elementId,
						maskId: selectedMaskPointSelection.maskId,
						pointIds: selectedMaskPointSelection.pointIds,
					});
					return;
				case "keyframes":
					if (selectedKeyframes.length === 0) {
						return;
					}
					editor.timeline.removeKeyframes({ keyframes: selectedKeyframes });
					clearKeyframeSelection();
					return;
				case "elements": {
					const tracks = editor.scenes.getActiveScene().tracks;
					const aBorrar = sinBloqueados({ tracks, refs: selectedElements });
					if (aBorrar.length === 0) {
						return;
					}
					// Vinculación: lo que está encima de un clip borrado de la pista
					// principal se va con él (se hace acá, no en el imán: ver ripple/iman.ts).
					if (useTimelineStore.getState().vinculacion) {
						const ids = new Set(aBorrar.map((r) => r.elementId));
						for (const ref of aBorrar) {
							if (ref.trackId !== tracks.main.id) continue;
							const clip = tracks.main.elements.find((e) => e.id === ref.elementId);
							if (!clip) continue;
							for (const vinculado of elementosVinculados({ tracks, clip })) {
								if (!ids.has(vinculado.elementId)) {
									ids.add(vinculado.elementId);
									aBorrar.push(vinculado);
								}
							}
						}
					}
					editor.timeline.deleteElements({ elements: aBorrar });
					return;
				}
				default:
					return;
			}
		},
		undefined,
	);

	useActionHandler(
		"toggle-source-audio",
		() => {
			if (selectedElements.length !== 1) {
				return;
			}

			const selectedElement = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			})[0];
			if (!selectedElement || selectedElement.track.locked) {
				return;
			}

			const mediaAsset = (() => {
				const { element } = selectedElement;
				if (!hasMediaId(element)) {
					return null;
				}

				return (
					editor.media
						.getAssets()
						.find((asset) => asset.id === element.mediaId) ?? null
				);
			})();
			if (!canToggleSourceAudio(selectedElement.element, mediaAsset)) {
				return;
			}

			editor.timeline.toggleSourceAudioSeparation({
				trackId: selectedElement.track.id,
				elementId: selectedElement.element.id,
			});
		},
		undefined,
	);

	useActionHandler(
		"select-all",
		() => {
			const allElements = pistasEnOrden(editor.scenes.getActiveScene()).flatMap(
				(track) =>
					track.locked
						? []
						: track.elements.map((element) => ({
								trackId: track.id,
								elementId: element.id,
							})),
			);
			setElementSelection({ elements: allElements });
		},
		undefined,
	);

	useActionHandler(
		"seleccionar-izquierda",
		() => {
			const ahora = editor.playback.getCurrentTime();
			setElementSelection({
				elements: pistasEnOrden(editor.scenes.getActiveScene()).flatMap((track) =>
					track.locked
						? []
						: track.elements
								.filter((e) => e.startTime < ahora)
								.map((e) => ({ trackId: track.id, elementId: e.id })),
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"seleccionar-derecha",
		() => {
			const ahora = editor.playback.getCurrentTime();
			setElementSelection({
				elements: pistasEnOrden(editor.scenes.getActiveScene()).flatMap((track) =>
					track.locked
						? []
						: track.elements
								.filter((e) => e.startTime + e.duration > ahora)
								.map((e) => ({ trackId: track.id, elementId: e.id })),
				),
			});
		},
		undefined,
	);

	useActionHandler("modo-seleccion", () => fijarModoCursor("seleccionar"), undefined);
	useActionHandler("modo-division", () => fijarModoCursor("dividir"), undefined);

	useActionHandler(
		"cancel-interaction",
		() => {
			if (!cancelInteraction()) {
				invokeAction("deselect-all");
			}
		},
		undefined,
	);

	useActionHandler(
		"deselect-all",
		() => {
			if (!clearActiveScope()) {
				editor.selection.clearMostSpecificSelection();
			}
		},
		undefined,
	);

	useActionHandler(
		"duplicate-selected",
		() => {
			const tracks = editor.scenes.getActiveScene().tracks;
			editor.timeline.duplicateElements({
				elements: sinBloqueados({ tracks, refs: selectedElements }),
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-muted-selected",
		() => {
			const tracks = editor.scenes.getActiveScene().tracks;
			editor.timeline.toggleElementsMuted({
				elements: sinBloqueados({ tracks, refs: selectedElements }),
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-visibility-selected",
		() => {
			const tracks = editor.scenes.getActiveScene().tracks;
			editor.timeline.toggleElementsVisibility({
				elements: sinBloqueados({ tracks, refs: selectedElements }),
			});
		},
		undefined,
	);

	// «Activar/Desactivar el clip» (V): un clip desactivado no se ve NI se oye.
	// Lo visual se oculta; el audio se silencia. Un video hace las dos cosas y
	// recuerda si ya estaba silenciado (`clip.silenciadoAntes`) para no
	// des-silenciar al reactivarlo lo que el usuario había silenciado.
	useActionHandler(
		"alternar-clip",
		() => {
			const tracks = editor.scenes.getActiveScene().tracks;
			const refs = sinBloqueados({ tracks, refs: selectedElements });
			const pares = editor.timeline.getElementsWithTracks({ elements: refs });
			if (pares.length === 0) return;
			const desactivado = (e: TimelineElement) =>
				canElementBeHidden(e) ? e.hidden === true : e.params.muted === true;
			const desactivar = pares.some(({ element }) => !desactivado(element));
			editor.timeline.updateElements({
				updates: pares.map(({ track, element }) => {
					const base = { trackId: track.id, elementId: element.id };
					if (element.type === "video") {
						const silenciadoAntes = desactivar
							? element.params.muted === true
							: element.params["clip.silenciadoAntes"] === true;
						return {
							...base,
							patch: {
								hidden: desactivar,
								params: {
									...element.params,
									muted: desactivar ? true : silenciadoAntes,
									"clip.silenciadoAntes": desactivar ? silenciadoAntes : false,
								},
							},
						};
					}
					if (canElementBeHidden(element)) {
						return { ...base, patch: { hidden: desactivar } };
					}
					return {
						...base,
						patch: { params: { ...element.params, muted: desactivar } },
					};
				}),
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-bookmark",
		() => {
			editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
		},
		undefined,
	);

	useActionHandler(
		"marcador-nuevo-color",
		async () => {
			const time = editor.playback.getCurrentTime();
			colorMarcador = (colorMarcador + 1) % COLORES_MARCADOR.length;
			if (!editor.scenes.isBookmarked({ time })) {
				await editor.scenes.toggleBookmark({ time });
			}
			const marcador = editor.scenes.getBookmarkAtTime({ time });
			if (!marcador) return;
			await editor.scenes.updateBookmark({
				time: marcador.time,
				updates: { color: COLORES_MARCADOR[colorMarcador] },
			});
		},
		undefined,
	);

	useActionHandler(
		"marcador-siguiente",
		() => {
			const ahora = editor.playback.getCurrentTime();
			const siguiente = [...editor.scenes.getActiveScene().bookmarks]
				.map((b) => b.time as number)
				.sort((a, b) => a - b)
				.find((t) => t > ahora + 1);
			if (siguiente !== undefined) irA(editor, siguiente);
		},
		undefined,
	);

	useActionHandler(
		"marcador-anterior",
		() => {
			const ahora = editor.playback.getCurrentTime();
			const previo = [...editor.scenes.getActiveScene().bookmarks]
				.map((b) => b.time as number)
				.sort((a, b) => a - b)
				.filter((t) => t < ahora - 1)
				.pop();
			if (previo !== undefined) irA(editor, previo);
		},
		undefined,
	);

	const cambiarVolumen = (deltaDb: number) => {
		const tracks = editor.scenes.getActiveScene().tracks;
		const pares = editor.timeline
			.getElementsWithTracks({ elements: sinBloqueados({ tracks, refs: selectedElements }) })
			.filter(
				({ element }) =>
					canElementHaveAudio(element) && !hasAnimatedVolume({ element }),
			);
		if (pares.length === 0) return;
		editor.timeline.updateElements({
			updates: pares.map(({ track, element }) => {
				const actual = typeof element.params.volume === "number" ? element.params.volume : 0;
				const volume = Math.round(clampDb(actual + deltaDb) * 10) / 10;
				return {
					trackId: track.id,
					elementId: element.id,
					patch: { params: { ...element.params, volume } },
				};
			}),
		});
	};
	useActionHandler("volumen-subir", () => cambiarVolumen(0.1), undefined);
	useActionHandler("volumen-bajar", () => cambiarVolumen(-0.1), undefined);

	useActionHandler(
		"panel-fotogramas-clave",
		() => {
			const pares = editor.timeline.getElementsWithTracks({ elements: selectedElements });
			for (const { element } of pares) {
				if (getElementKeyframes({ animations: element.animations }).length > 0) {
					toggleElementExpanded(element.id);
				}
			}
		},
		undefined,
	);

	useActionHandler(
		"copy-selected",
		() => {
			editor.clipboard.copy();
		},
		undefined,
	);

	useActionHandler(
		"cortar",
		() => {
			cortarSeleccion(editor);
		},
		undefined,
	);

	useActionHandler(
		"paste-copied",
		() => {
			editor.clipboard.paste();
		},
		undefined,
	);

	useActionHandler(
		"copiar-atributos",
		() => {
			copiarAtributos(editor);
		},
		undefined,
	);

	useActionHandler(
		"pegar-atributos",
		() => {
			pegarAtributos(editor);
		},
		undefined,
	);

	useActionHandler(
		"toggle-snapping",
		() => {
			toggleSnapping();
		},
		undefined,
	);

	useActionHandler(
		"toggle-ripple-editing",
		() => {
			const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
			if (tracks?.main.locked) {
				toast(
					rippleEditingEnabled
						? "La pista principal está bloqueada. No se puede desactivar el imán en la pista principal."
						: "La pista principal está bloqueada. No se puede activar el imán en la pista principal.",
				);
				return;
			}
			toggleRippleEditing();
			// Al prenderlo, la principal se junta en el acto (el imán corre en
			// cada cambio de pistas: pasarle las de ahora lo dispara).
			if (!rippleEditingEnabled && tracks) {
				editor.timeline.updateTracks(tracks);
			}
		},
		undefined,
	);

	useActionHandler("alternar-vinculacion", () => alternarVinculacion(), undefined);
	useActionHandler(
		"alternar-eje-vista-previa",
		() => {
			const { modoCursor, ejeVistaPrevia } = useTimelineStore.getState();
			if (modoCursor === "dividir" && ejeVistaPrevia) {
				toast("No se puede desactivar la vista previa del eje en el modo de división con el mouse");
				return;
			}
			alternarEjeVistaPrevia();
		},
		undefined,
	);

	// ── Básico ───────────────────────────────────────────────────────────────

	useActionHandler(
		"undo",
		() => {
			editor.command.undo();
		},
		undefined,
	);

	useActionHandler(
		"redo",
		() => {
			editor.command.redo();
		},
		undefined,
	);

	// Ctrl+I «Importar archivos multimedia»: el mismo selector que Multimedia ›
	// Importar (el keydown cuenta como gesto del usuario, así que el navegador
	// deja abrirlo), y la biblioteca va a Multimedia para que se vea lo que entra.
	useActionHandler(
		"importar-multimedia",
		() => {
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = true;
			input.accept = "image/*,video/*,audio/*";
			input.onchange = () => {
				const files = Array.from(input.files ?? []);
				if (files.length === 0) return;
				useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_IMPORTAR_MEDIOS });
				void importar({ files });
			};
			input.click();
		},
		undefined,
	);

	useActionHandler(
		"volver-inicio",
		async () => {
			try {
				await editor.project.prepareExit();
			} catch (error) {
				console.error("Failed to prepare project exit:", error);
			} finally {
				editor.project.closeProject();
				router.push(rutaEditor("/video-editor"));
			}
		},
		undefined,
	);

	// todo: potnetially unify these two actions:
	useActionHandler(
		"remove-media-asset",
		(args) => {
			if (!args) return;
			editor.media.removeMediaAsset({
				projectId: args.projectId,
				id: args.assetId,
			});
		},
		undefined,
	);

	useActionHandler(
		"remove-media-assets",
		(args) => {
			if (!args) return;
			editor.media.removeMediaAssets({
				projectId: args.projectId,
				ids: args.assetIds,
			});
		},
		undefined,
	);
}

