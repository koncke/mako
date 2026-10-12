"use client";

// Un clip de la línea de tiempo, como en CapCut Desktop 9.3 (relevamiento §7.2):
//   · video/imagen: franja del nombre arriba (con la duración), la tira
//     CONTINUA de miniaturas y, en la pista principal, la onda del audio propio
//     abajo;
//   · texto: barra ladrillo con el texto; stickers/efectos con su color;
//   · audio: azul marino con la onda celeste y los fundidos (círculos blancos);
//   · elegido: contorno blanco de 2 px y tiradores blancos de 4 px;
//   · ⧓ sobre el corte si el clip tiene transición (`transicion.id`, paquete G).
// En «Modo de división» (B) el clic DIVIDE el clip en ese punto en vez de
// elegirlo. Los clips de una pista bloqueada no reciben el mouse.

import { createContext, useContext, useState } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { AudioWaveform, WAVEFORM_GAIN_SAMPLE_COUNT } from "./audio-waveform";
import { AudioVolumeLine } from "./audio-volume-line";
import { useElementPreview } from "@/app/video-editor/_opencut/timeline/hooks/use-element-preview";
import {
	useKeyframeDrag,
	type KeyframeDragState,
} from "@/app/video-editor/_opencut/timeline/hooks/element/use-keyframe-drag";
import { useKeyframeSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-keyframe-selection";
import { useKeyframeBoxSelect } from "@/app/video-editor/_opencut/timeline/hooks/element/use-keyframe-box-select";
import { SelectionBox } from "@/app/video-editor/_opencut/selection/selection-box";
import { getElementKeyframes } from "@/app/video-editor/_opencut/animation";
import {
	canElementHaveAudio,
	canElementBeHidden,
	hasElementEffects,
	hasMediaId,
	timelineTimeToPixels,
	timelineTimeToSnappedPixels,
} from "@/app/video-editor/_opencut/timeline";
import { getTrackHeight } from "./track-layout";
import { claseCuerpoClip, leerToken } from "./theme";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import type { SelectionBoxBounds } from "@/app/video-editor/_opencut/selection/types";
import type {
	TimelineElement as TimelineElementType,
	TimelineTrack,
	ElementDragView,
	VideoElement,
	ImageElement,
	AudioElement,
	RetimeConfig,
} from "@/app/video-editor/_opencut/timeline";
import { mediaSupportsAudio } from "@/app/video-editor/_opencut/media/media-utils";
import {
	canToggleSourceAudio,
	isSourceAudioSeparated,
} from "@/app/video-editor/_opencut/timeline/audio-separation";
import { buildWaveformGainSamples, isElementMuted } from "@/app/video-editor/_opencut/timeline/audio-state";
import { getTimelinePixelsPerSecond } from "@/app/video-editor/_opencut/timeline";
import { buildWaveformSourceKey } from "@/app/video-editor/_opencut/media/waveform-summary";
import {
	addMediaTime,
	mediaTime,
	type MediaTime,
	TICKS_PER_SECOND,
} from "@/app/video-editor/_opencut/wasm";
import {
	atajoDe,
	type TAction,
	type TActionWithOptionalArgs,
	invokeAction,
} from "@/app/video-editor/_opencut/actions";
import { useElementSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-selection";
import { resolveStickerId } from "@/app/video-editor/_opencut/stickers";
import { buildGraphicPreviewUrl } from "@/app/video-editor/_opencut/graphics";
import Image from "next/image";
import { KeyframeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Gauge, Sparkles, WandSparkles } from "lucide-react";
import { PRESETS_CURVA } from "@/app/video-editor/_opencut/retime/curva";
import { efectosListables } from "@/app/video-editor/_opencut/effects/components/panel-color";
import { useMemo, type ComponentProps, type ReactNode } from "react";
import type { SelectedKeyframeRef, ElementKeyframe } from "@/app/video-editor/_opencut/animation/types";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { usePropertiesStore } from "@/app/video-editor/_opencut/components/editor/panels/properties/stores/properties-store";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import {
	CLIP_NAME_STRIP_HEIGHT_PX,
	CLIP_WAVE_STRIP_HEIGHT_PX,
	KEYFRAME_LANE_HEIGHT_PX,
} from "./layout";
import {
	getExpandedRows,
	getExpansionHeight,
	type ExpandedRow,
} from "./expanded-layout";
import { TiraMiniaturas } from "./tira-miniaturas";
import { FundidosAudio } from "./fundidos-audio";
import { RitmosClip } from "@/app/video-editor/_opencut/audio/components/ritmos-clip";
import { abrirTransicion } from "@/app/video-editor/_opencut/transiciones/acciones";
import { idTransicion, transicionVigente } from "@/app/video-editor/_opencut/transiciones/reglas";
import { transicionPorId } from "@/app/video-editor/_opencut/transiciones/catalogo";
import { FranjasAnimacion } from "@/app/video-editor/_opencut/animaciones/components/franjas-animacion";

const KEYFRAME_INDICATOR_MIN_WIDTH_PX = 40;
/** Entre dos clips pegados queda 1 px de cada lado, como el filo oscuro de CapCut. */
const ELEMENT_RING_WIDTH_PX = 1;

const PixelsPerSecondContext = createContext<number | null>(null);

interface KeyframeIndicator {
	time: MediaTime;
	offsetPx: number;
	keyframes: SelectedKeyframeRef[];
}

export function buildKeyframeIndicator({
	keyframe,
	trackId,
	elementId,
	displayedStartTime,
	zoomLevel,
	elementLeft,
}: {
	keyframe: ElementKeyframe;
	trackId: string;
	elementId: string;
	displayedStartTime: MediaTime;
	zoomLevel: number;
	elementLeft: number;
}): {
	time: MediaTime;
	offsetPx: number;
	keyframeRef: SelectedKeyframeRef;
} {
	const keyframeRef = {
		trackId,
		elementId,
		propertyPath: keyframe.propertyPath,
		keyframeId: keyframe.id,
	};
	const keyframeLeft = timelineTimeToSnappedPixels({
		time: displayedStartTime + keyframe.time,
		zoomLevel,
	});
	return {
		time: keyframe.time,
		offsetPx: keyframeLeft - elementLeft,
		keyframeRef,
	};
}

export function getKeyframeIndicators({
	keyframes,
	trackId,
	elementId,
	displayedStartTime,
	zoomLevel,
	elementLeft,
	elementWidth,
}: {
	keyframes: ElementKeyframe[];
	trackId: string;
	elementId: string;
	displayedStartTime: MediaTime;
	zoomLevel: number;
	elementLeft: number;
	elementWidth: number;
}): KeyframeIndicator[] {
	if (elementWidth < KEYFRAME_INDICATOR_MIN_WIDTH_PX) {
		return [];
	}

	const keyframesByTime = new Map<MediaTime, KeyframeIndicator>();
	for (const keyframe of keyframes) {
		const indicator = buildKeyframeIndicator({
			keyframe,
			trackId,
			elementId,
			displayedStartTime,
			zoomLevel,
			elementLeft,
		});
		const existingIndicator = keyframesByTime.get(indicator.time);
		if (!existingIndicator) {
			keyframesByTime.set(indicator.time, {
				time: indicator.time,
				offsetPx: indicator.offsetPx,
				keyframes: [indicator.keyframeRef],
			});
			continue;
		}

		existingIndicator.keyframes.push(indicator.keyframeRef);
	}

	return [...keyframesByTime.values()].sort((a, b) => a.time - b.time);
}

/** «00:00:05:12» (horas:minutos:segundos:cuadros), como el rótulo de los clips de CapCut. */
function formatoDuracion(ticks: number, fps: number): string {
	const total = ticks / TICKS_PER_SECOND;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = Math.floor(total % 60);
	const f = Math.floor((total % 1) * fps);
	const dos = (n: number) => String(n).padStart(2, "0");
	return `${dos(h)}:${dos(m)}:${dos(s)}:${dos(f)}`;
}

/**
 * ⧓ sobre el corte: la MISMA regla con la que la escena dibuja la transición
 * (transiciones/reglas.ts: pista de video, clip pegado a la derecha que no está
 * oculto, ≤1 tick) y un id que el catálogo conoce. Con una regla propia se veía
 * un ⧓ sobre un corte que no tenía transición (el vecino oculto, o un id viejo).
 */
function tieneTransicion(track: TimelineTrack, element: TimelineElementType): boolean {
	return transicionVigente(track, element) && transicionPorId(idTransicion(element)) !== null;
}

interface TimelineElementProps {
	element: TimelineElementType;
	track: TimelineTrack;
	isMain?: boolean;
	zoomLevel: number;
	isSelected: boolean;
	onResizeStart: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
		side: "left" | "right";
	}) => void;
	onElementMouseDown: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
	}) => void;
	onElementClick: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
	}) => void;
	dragView: ElementDragView;
	isDropTarget?: boolean;
}

export function TimelineElement({
	element,
	track,
	isMain = false,
	zoomLevel,
	isSelected,
	onResizeStart,
	onElementMouseDown,
	onElementClick,
	dragView,
	isDropTarget = false,
}: TimelineElementProps) {
	const editor = useEditor();
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const { selectedElements } = useElementSelection();
	const modoCursor = useTimelineStore((s) => s.modoCursor);
	const { renderElement } = useElementPreview({
		trackId: track.id,
		elementId: element.id,
		fallback: element,
	});
	const [xCorte, setXCorte] = useState<number | null>(null);

	const mediaAsset = hasMediaId(element)
		? (mediaAssets.find((asset) => asset.id === element.mediaId) ?? null)
		: null;
	const hasAudio = mediaSupportsAudio({ media: mediaAsset });

	const isCurrentElementSelected = selectedElements.some(
		(selected) =>
			selected.elementId === element.id && selected.trackId === track.id,
	);

	const isDragging = dragView.kind === "dragging";
	const dragTimeOffset = isDragging
		? dragView.memberTimeOffsets.get(element.id)
		: undefined;
	const isBeingDragged = dragTimeOffset !== undefined;
	const dragOffsetY =
		isDragging && isBeingDragged
			? dragView.currentMouseY - dragView.startMouseY
			: 0;
	const elementStartTime =
		isDragging && isBeingDragged
			? addMediaTime({ a: dragView.currentTime, b: dragTimeOffset })
			: renderElement.startTime;
	const displayedStartTime = elementStartTime;
	const displayedDuration = renderElement.duration;
	const elementWidth = timelineTimeToPixels({
		time: displayedDuration,
		zoomLevel,
	});
	const timelinePixelsPerSecond = getTimelinePixelsPerSecond({ zoomLevel });
	const elementLeft = timelineTimeToSnappedPixels({
		time: displayedStartTime,
		zoomLevel,
	});
	const keyframeIndicators = isSelected
		? getKeyframeIndicators({
				keyframes: getElementKeyframes({ animations: element.animations }),
				trackId: track.id,
				elementId: element.id,
				displayedStartTime,
				zoomLevel,
				elementLeft,
				elementWidth,
			})
		: [];

	const {
		keyframeDragState,
		handleKeyframeMouseDown,
		handleKeyframeClick,
		getVisualOffsetPx,
	} = useKeyframeDrag({ zoomLevel, element, displayedStartTime });

	const elementKeyframes = getElementKeyframes({
		animations: element.animations,
	});

	const isExpanded = useTimelineStore((s) =>
		s.expandedElementIds.has(element.id),
	);
	const expandedRows = useMemo(
		() =>
			isExpanded ? getExpandedRows({ animations: element.animations }) : [],
		[isExpanded, element.animations],
	);

	const {
		containerRef: expandedLanesRef,
		selectionBox: keyframeSelectionBox,
		isBoxSelecting: isKeyframeBoxSelecting,
		handleExpandedAreaMouseDown,
		handleExpandedAreaClick,
	} = useKeyframeBoxSelect({
		trackId: track.id,
		elementId: element.id,
		rows: expandedRows,
		keyframes: elementKeyframes,
		displayedStartTime,
		zoomLevel,
		elementLeft,
	});

	const isMuted = canElementHaveAudio(element) && isElementMuted({ element });
	const canToggleCurrentSourceAudio =
		selectedElements.length === 1 &&
		isCurrentElementSelected &&
		canToggleSourceAudio(element, mediaAsset);
	const separado =
		element.type === "video" && isSourceAudioSeparated({ element });
	const hasKeyframes = elementKeyframes.length > 0;
	const expansionHeight = getExpansionHeight({ rows: expandedRows });
	const baseTrackHeight = getTrackHeight({ type: track.type, isMain });
	const bloqueada = track.locked === true;
	const divide = modoCursor === "dividir" && !bloqueada;

	// ⧓: el clip de la izquierda de un corte tiene una transición que rige.
	const marcadorTransicion = tieneTransicion(track, element);

	/** Tiempo de la línea bajo el mouse, ajustado al cuadro (para dividir). */
	const tiempoBajoMouse = (event: React.MouseEvent): MediaTime | null => {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		const fps = editor.project.getActive().settings.fps;
		const ticksCuadro = (TICKS_PER_SECOND * fps.denominator) / fps.numerator;
		const crudo = displayedStartTime + (x / timelinePixelsPerSecond) * TICKS_PER_SECOND;
		const ajustado = Math.round(crudo / ticksCuadro) * ticksCuadro;
		if (ajustado <= element.startTime || ajustado >= element.startTime + element.duration) {
			return null;
		}
		return mediaTime({ ticks: Math.round(ajustado) });
	};

	const expandedContent =
		isExpanded && expandedRows.length > 0 ? (
			<ExpandedKeyframeLanes
				rows={expandedRows}
				keyframes={elementKeyframes}
				trackId={track.id}
				elementId={element.id}
				displayedStartTime={displayedStartTime}
				zoomLevel={zoomLevel}
				elementLeft={elementLeft}
				keyframeDragState={keyframeDragState}
				onKeyframeMouseDown={handleKeyframeMouseDown}
				onKeyframeClick={handleKeyframeClick}
				getVisualOffsetPx={getVisualOffsetPx}
				containerRef={expandedLanesRef}
				onLaneMouseDown={handleExpandedAreaMouseDown}
				onLaneClick={handleExpandedAreaClick}
				selectionBox={keyframeSelectionBox}
				isBoxSelecting={isKeyframeBoxSelecting}
			/>
		) : null;

	const muchos = selectedElements.length > 1 && isCurrentElementSelected;

	return (
		<PixelsPerSecondContext.Provider value={timelinePixelsPerSecond}>
			<ContextMenu>
				<ContextMenuTrigger asChild disabled={bloqueada}>
					<div
						className={cn(
							"group/clip absolute top-0 select-none",
							bloqueada && "pointer-events-none",
							divide && "cursor-crosshair",
						)}
						style={{
							left: `${elementLeft}px`,
							width: `${elementWidth}px`,
							height:
								expandedRows.length > 0
									? `${baseTrackHeight + expansionHeight}px`
									: "100%",
							transform:
								isDragging && isBeingDragged
									? `translate3d(0, ${dragOffsetY}px, 0)`
									: undefined,
						}}
						onMouseDownCapture={(event) => {
							if (!divide || event.button !== 0) return;
							event.preventDefault();
							event.stopPropagation();
							const splitTime = tiempoBajoMouse(event);
							if (splitTime === null) return;
							editor.timeline.splitElements({
								elements: [{ trackId: track.id, elementId: element.id }],
								splitTime,
							});
						}}
						onClickCapture={(event) => {
							if (divide) event.stopPropagation();
						}}
						onMouseMove={(event) => {
							if (!divide) return;
							const rect = event.currentTarget.getBoundingClientRect();
							setXCorte(event.clientX - rect.left);
						}}
						onMouseLeave={() => setXCorte(null)}
					>
						<ElementInner
							element={element}
							displayElement={renderElement}
							track={track}
							isMain={isMain}
							isSelected={isSelected}
							isExpanded={expandedRows.length > 0}
							baseTrackHeight={baseTrackHeight}
							expandedContent={expandedContent}
							onElementClick={onElementClick}
							onElementMouseDown={onElementMouseDown}
							onResizeStart={onResizeStart}
							isDropTarget={isDropTarget}
						/>
						{/* El tramo de la Entrada / Salida / Combinado (animaciones/components/franjas-animacion.tsx). */}
						<FranjasAnimacion
							element={renderElement}
							pixelsPerSecond={timelinePixelsPerSecond}
							alto={baseTrackHeight}
						/>
						{isSelected && (
							<div
								className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
								style={{ height: `${baseTrackHeight}px` }}
							>
								<KeyframeIndicators
									indicators={keyframeIndicators}
									dragState={keyframeDragState}
									displayedStartTime={displayedStartTime}
									elementLeft={elementLeft}
									onKeyframeMouseDown={handleKeyframeMouseDown}
									onKeyframeClick={handleKeyframeClick}
									getVisualOffsetPx={getVisualOffsetPx}
								/>
							</div>
						)}
						{divide && xCorte !== null && (
							<div
								aria-hidden
								className="pointer-events-none absolute top-0 z-20 w-px bg-white"
								style={{ left: xCorte, height: baseTrackHeight }}
							/>
						)}
						{marcadorTransicion && (
							<MarcadorTransicion
								// Elige el clip y abre su pestaña «Transición» (paquete G).
								onClick={() =>
									abrirTransicion(editor, { trackId: track.id, elementId: element.id })
								}
								alto={baseTrackHeight}
							/>
						)}
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent className="w-60">
					<ActionMenuItem action="copy-selected">Copiar</ActionMenuItem>
					<ActionMenuItem action="cortar">Cortar</ActionMenuItem>
					<ActionMenuItem action="paste-copied">Pegar</ActionMenuItem>
					<ActionMenuItem action="delete-selected" variant="destructive">
						{muchos ? `Eliminar (${selectedElements.length})` : "Eliminar"}
					</ActionMenuItem>
					<ContextMenuSeparator />
					<ActionMenuItem action="split">Dividir</ActionMenuItem>
					<ContextMenuSeparator />
					<ActionMenuItem action="copiar-atributos" disabled={muchos}>
						Copiar atributos
					</ActionMenuItem>
					<ActionMenuItem action="pegar-atributos">Pegar atributos</ActionMenuItem>
					{(canToggleCurrentSourceAudio ||
						(canElementHaveAudio(element) && hasAudio)) && <ContextMenuSeparator />}
					{canToggleCurrentSourceAudio && (
						<ActionMenuItem action="toggle-source-audio">
							{separado ? "Recuperar audio" : "Extraer audio"}
						</ActionMenuItem>
					)}
					{canElementHaveAudio(element) && hasAudio && element.type === "video" && (
						<ActionMenuItem action="toggle-elements-muted-selected">
							{isMuted ? "Reactivar el audio del clip" : "Silenciar el audio del clip"}
						</ActionMenuItem>
					)}
					<ContextMenuSeparator />
					<ActionMenuItem action="alternar-clip">
						Activar/Desactivar el clip
					</ActionMenuItem>
					{hasKeyframes && (
						<ActionMenuItem action="panel-fotogramas-clave">
							Mostrar/ocultar el panel de fotogramas clave
						</ActionMenuItem>
					)}
					{hasMediaId(element) && element.type !== "audio" && (
						<>
							<ContextMenuSeparator />
							{/* Reemplazar conservando duración y efectos: todavía no. */}
							<ContextMenuItem disabled>Reemplazar el clip</ContextMenuItem>
						</>
					)}
				</ContextMenuContent>
			</ContextMenu>
		</PixelsPerSecondContext.Provider>
	);
}

function MarcadorTransicion({
	onClick,
	alto,
}: {
	onClick: () => void;
	alto: number;
}) {
	return (
		<button
			type="button"
			aria-label="Transición"
			title="Transición"
			className="pointer-events-auto absolute -right-[9px] z-20 flex size-[18px] cursor-pointer items-center justify-center rounded-[4px] bg-white text-[11px] leading-none text-(--cc-clip-video) shadow-sm"
			style={{ top: Math.max(2, alto / 2 - 9) }}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
		>
			⧓
		</button>
	);
}

function ElementInner({
	element,
	displayElement,
	track,
	isMain,
	isSelected,
	isExpanded,
	baseTrackHeight,
	expandedContent,
	onElementClick,
	onElementMouseDown,
	onResizeStart,
	isDropTarget = false,
}: {
	element: TimelineElementType;
	displayElement?: TimelineElementType;
	track: TimelineTrack;
	isMain: boolean;
	isSelected: boolean;
	isExpanded: boolean;
	baseTrackHeight: number;
	expandedContent: React.ReactNode;
	onElementClick: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
	}) => void;
	onElementMouseDown: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
	}) => void;
	onResizeStart: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
		side: "left" | "right";
	}) => void;
	isDropTarget?: boolean;
}) {
	const visibleElement = displayElement ?? element;
	// Un clip desactivado (V) o una pista oculta/silenciada se ven apagados.
	const pistaApagada =
		("hidden" in track && track.hidden) || ("muted" in track && track.muted && track.type === "audio");
	const isReducedOpacity =
		(canElementBeHidden(visibleElement) && visibleElement.hidden) ||
		(visibleElement.type === "audio" && visibleElement.params.muted === true) ||
		pistaApagada ||
		isDropTarget;
	return (
		<div
			className="absolute top-0 bottom-0"
			style={{
				left: `${ELEMENT_RING_WIDTH_PX}px`,
				right: `${ELEMENT_RING_WIDTH_PX}px`,
			}}
		>
			<div
				className={cn(
					"absolute inset-0 overflow-hidden rounded-[4px]",
					isExpanded && "bg-background",
				)}
			>
				<button
					type="button"
					tabIndex={-1}
					className="absolute inset-0 flex size-full flex-col text-left"
					onClick={(event) => onElementClick({ event, element })}
					onMouseDown={(event) => onElementMouseDown({ event, element })}
				>
					<div
						className={cn(
							"relative flex w-full shrink-0 overflow-hidden",
							claseCuerpoClip(element),
							isReducedOpacity && "opacity-50",
						)}
						style={{ height: `${baseTrackHeight}px` }}
					>
						<ElementContent
							element={visibleElement}
							track={track}
							isMain={isMain}
							isSelected={isSelected}
							alto={baseTrackHeight}
						/>
					</div>
					{expandedContent}
				</button>
			</div>

			{/* Elegido: contorno blanco de 2 px. */}
			{isSelected && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 rounded-[4px] border-2 border-(--cc-select)"
					style={{ height: baseTrackHeight }}
				/>
			)}

			{isSelected && (
				<>
					<ResizeHandle
						side="left"
						element={element}
						track={track}
						height={baseTrackHeight}
						onResizeStart={onResizeStart}
					/>
					<ResizeHandle
						side="right"
						element={element}
						track={track}
						height={baseTrackHeight}
						onResizeStart={onResizeStart}
					/>
				</>
			)}
		</div>
	);
}

/** Tirador de recorte: barra blanca de 4 px en el borde del clip elegido. */
function ResizeHandle({
	side,
	element,
	track,
	height,
	onResizeStart,
}: {
	side: "left" | "right";
	element: TimelineElementType;
	track: TimelineTrack;
	height: number;
	onResizeStart: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
		side: "left" | "right";
	}) => void;
}) {
	const isLeft = side === "left";
	return (
		<button
			type="button"
			className={cn(
				"absolute top-0 flex w-2.5 items-center",
				isLeft
					? "left-0 cursor-w-resize justify-start"
					: "right-0 cursor-e-resize justify-end",
			)}
			style={{ height }}
			onMouseDown={(event) => onResizeStart({ event, element, track, side })}
			onClick={(event) => event.stopPropagation()}
			aria-label={isLeft ? "Recortar el inicio" : "Recortar el final"}
		>
			<span
				className={cn(
					"flex h-full w-1 items-center justify-center bg-(--cc-select)",
					isLeft ? "rounded-l-[4px]" : "rounded-r-[4px]",
				)}
			>
				<span className="h-3 w-px bg-black/45" />
			</span>
		</button>
	);
}

function KeyframeIndicators({
	indicators,
	dragState,
	displayedStartTime,
	elementLeft,
	onKeyframeMouseDown,
	onKeyframeClick,
	getVisualOffsetPx,
}: {
	indicators: KeyframeIndicator[];
	dragState: KeyframeDragState;
	displayedStartTime: MediaTime;
	elementLeft: number;
	onKeyframeMouseDown: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
	}) => void;
	onKeyframeClick: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
		orderedKeyframes: SelectedKeyframeRef[];
		indicatorTime: MediaTime;
	}) => void;
	getVisualOffsetPx: (params: {
		indicatorTime: MediaTime;
		indicatorOffsetPx: number;
		isBeingDragged: boolean;
		displayedStartTime: MediaTime;
		elementLeft: number;
	}) => number;
}) {
	const { isKeyframeSelected } = useKeyframeSelection();
	const orderedKeyframes = indicators.flatMap(
		(indicator) => indicator.keyframes,
	);

	return indicators.map((indicator) => {
		const isIndicatorSelected = indicator.keyframes.some((keyframe) =>
			isKeyframeSelected({ keyframe }),
		);
		const isBeingDragged = indicator.keyframes.some((keyframe) =>
			dragState.draggingKeyframeIds.has(keyframe.keyframeId),
		);
		const visualOffsetPx = getVisualOffsetPx({
			indicatorTime: indicator.time,
			indicatorOffsetPx: indicator.offsetPx,
			isBeingDragged,
			displayedStartTime,
			elementLeft,
		});

		return (
			<button
				key={indicator.time}
				type="button"
				className="pointer-events-auto absolute top-1/2 mr-0.5 -translate-x-1/2 -translate-y-1/2 cursor-grab"
				style={{ left: visualOffsetPx }}
				onMouseDown={(event) =>
					onKeyframeMouseDown({ event, keyframes: indicator.keyframes })
				}
				onClick={(event) =>
					onKeyframeClick({
						event,
						keyframes: indicator.keyframes,
						orderedKeyframes,
						indicatorTime: indicator.time,
					})
				}
				aria-label="Fotograma clave"
			>
				<HugeiconsIcon
					icon={KeyframeIcon}
					className={cn(
						"size-3.5 text-black",
						isIndicatorSelected ? "fill-primary" : "fill-white",
					)}
					strokeWidth={1.5}
				/>
			</button>
		);
	});
}

function ExpandedKeyframeLanes({
	rows,
	keyframes,
	trackId,
	elementId,
	displayedStartTime,
	zoomLevel,
	elementLeft,
	keyframeDragState,
	onKeyframeMouseDown,
	onKeyframeClick,
	getVisualOffsetPx,
	containerRef,
	onLaneMouseDown,
	onLaneClick,
	selectionBox,
	isBoxSelecting,
}: {
	rows: ExpandedRow[];
	keyframes: ElementKeyframe[];
	trackId: string;
	elementId: string;
	displayedStartTime: MediaTime;
	zoomLevel: number;
	elementLeft: number;
	keyframeDragState: KeyframeDragState;
	onKeyframeMouseDown: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
	}) => void;
	containerRef: React.RefObject<HTMLDivElement | null>;
	onLaneMouseDown: (event: React.MouseEvent) => void;
	onLaneClick: (event: React.MouseEvent) => void;
	selectionBox: {
		bounds: SelectionBoxBounds;
	} | null;
	isBoxSelecting: boolean;
	onKeyframeClick: (params: {
		event: React.MouseEvent;
		keyframes: SelectedKeyframeRef[];
		orderedKeyframes: SelectedKeyframeRef[];
		indicatorTime: MediaTime;
	}) => void;
	getVisualOffsetPx: (params: {
		indicatorTime: MediaTime;
		indicatorOffsetPx: number;
		isBeingDragged: boolean;
		displayedStartTime: MediaTime;
		elementLeft: number;
	}) => number;
}) {
	const { isKeyframeSelected } = useKeyframeSelection();

	const orderedKeyframes = useMemo(
		() =>
			[...keyframes]
				.sort(
					(a, b) =>
						a.time - b.time || a.propertyPath.localeCompare(b.propertyPath),
				)
				.map((kf) => ({
					trackId,
					elementId,
					propertyPath: kf.propertyPath,
					keyframeId: kf.id,
				})),
		[keyframes, trackId, elementId],
	);

	return (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- spatial gesture surface (keyframe lanes); keyboard control over keyframes is via global timeline shortcuts, not per-element focus.
		<div
			ref={containerRef}
			className="relative flex flex-col"
			onMouseDown={onLaneMouseDown}
			onClick={onLaneClick}
		>
			{rows.map((row) => {
				const laneKeyframes = keyframes.filter(
					(kf) => kf.propertyPath === row.propertyPath,
				);
				return (
					<div
						key={row.propertyPath}
						className={cn("relative flex items-center bg-(--cc-sunken)")}
						style={{ height: `${KEYFRAME_LANE_HEIGHT_PX}px` }}
					>
						{laneKeyframes.map((kf) => {
							const keyframeRef: SelectedKeyframeRef = {
								trackId,
								elementId,
								propertyPath: row.propertyPath,
								keyframeId: kf.id,
							};
							const isBeingDragged = keyframeDragState.draggingKeyframeIds.has(
								kf.id,
							);
							const kfLeft = timelineTimeToSnappedPixels({
								time: displayedStartTime + kf.time,
								zoomLevel,
							});
							const offsetPx = kfLeft - elementLeft;
							const visualOffset = getVisualOffsetPx({
								indicatorTime: kf.time,
								indicatorOffsetPx: offsetPx,
								isBeingDragged,
								displayedStartTime,
								elementLeft,
							});
							const isSelected = isKeyframeSelected({
								keyframe: keyframeRef,
							});

							return (
								<button
									key={kf.id}
									type="button"
									className={cn(
										"pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab",
										isBoxSelecting && "pointer-events-none",
									)}
									style={{ left: visualOffset }}
									onMouseDown={(event) => {
										event.stopPropagation();
										onKeyframeMouseDown({
											event,
											keyframes: [keyframeRef],
										});
									}}
									onClick={(event) => {
										event.stopPropagation();
										onKeyframeClick({
											event,
											keyframes: [keyframeRef],
											orderedKeyframes,
											indicatorTime: kf.time,
										});
									}}
									aria-label="Fotograma clave"
								>
									<HugeiconsIcon
										icon={KeyframeIcon}
										className={cn(
											"mr-1 size-3.5 text-black",
											isSelected ? "fill-primary" : "fill-white",
										)}
										strokeWidth={1.5}
									/>
								</button>
							);
						})}
					</div>
				);
			})}
			{selectionBox && <SelectionBox bounds={selectionBox.bounds} />}
		</div>
	);
}

// ── Contenido por tipo ──────────────────────────────────────────────────────

interface ElementContentProps {
	element: TimelineElementType;
	track: TimelineTrack;
	isMain: boolean;
	isSelected: boolean;
	alto: number;
}

/** El rótulo de un clip fino (texto, sticker, efecto): ícono + texto en una línea. */
function RotuloFino({ icono, children }: { icono?: ReactNode; children: ReactNode }) {
	return (
		<div className="flex size-full min-w-0 items-center gap-1.5 px-2">
			{icono}
			<span className="truncate text-[11px] leading-none text-white/90">{children}</span>
		</div>
	);
}

function TextElementContent({
	element,
}: {
	element: Extract<TimelineElementType, { type: "text" }>;
}) {
	const contenido =
		typeof element.params.content === "string" ? element.params.content : "";
	return <RotuloFino>{contenido || element.name}</RotuloFino>;
}

function EffectElementContent({
	element,
}: {
	element: Extract<TimelineElementType, { type: "effect" }>;
}) {
	return (
		<RotuloFino icono={<Sparkles className="size-3.5 shrink-0 text-white/90" />}>
			{element.name}
		</RotuloFino>
	);
}

function StickerElementContent({
	element,
}: {
	element: Extract<TimelineElementType, { type: "sticker" }>;
}) {
	return (
		<RotuloFino
			icono={
				<Image
					src={resolveStickerId({
						stickerId: element.stickerId,
						options: { width: 20, height: 20 },
					})}
					alt=""
					className="size-4 shrink-0"
					width={20}
					height={20}
					unoptimized
				/>
			}
		>
			{element.name}
		</RotuloFino>
	);
}

function GraphicElementContent({
	element,
}: {
	element: Extract<TimelineElementType, { type: "graphic" }>;
}) {
	return (
		<RotuloFino
			icono={
				<Image
					src={buildGraphicPreviewUrl({
						definitionId: element.definitionId,
						params: element.params,
						size: 20,
					})}
					alt=""
					className="size-4 shrink-0"
					width={20}
					height={20}
					unoptimized
				/>
			}
		>
			{element.name}
		</RotuloFino>
	);
}

/** La franja del nombre arriba del clip (20 px en la captura → 16). */
/** La velocidad sobre el clip, como CapCut: «2.0x» con velocidad constante, el
 *  nombre de la curva con una curva (retime/curva.ts). A 1× no se dibuja. */
function RotuloVelocidad({ retime }: { retime: RetimeConfig | undefined }) {
	if (!retime) return null;
	let texto: string | null = null;
	if (retime.mode === "curve" && retime.curva) {
		texto = PRESETS_CURVA.find((p) => p.id === retime.curva?.preset)?.etiqueta ?? "Curva";
	} else if (Math.abs(retime.rate - 1) > 1e-3) {
		texto = `${retime.rate >= 10 ? retime.rate.toFixed(0) : retime.rate.toFixed(1)}x`;
	}
	if (!texto) return null;
	return (
		<span className="flex shrink-0 items-center gap-0.5 rounded-[3px] bg-black/35 px-1 py-px text-[10px] leading-none text-white/90">
			<Gauge className="size-2.5" aria-hidden />
			{texto}
		</span>
	);
}

function FranjaNombre({
	nombre,
	duracion,
	claseFondo,
	inicio,
}: {
	nombre: string;
	duracion?: string;
	claseFondo: string;
	inicio?: ReactNode;
}) {
	return (
		<div
			className={cn("flex w-full shrink-0 items-center gap-1.5 overflow-hidden px-1.5", claseFondo)}
			style={{ height: CLIP_NAME_STRIP_HEIGHT_PX }}
		>
			{inicio}
			<span className="truncate text-[10px] leading-none text-white/85">{nombre}</span>
			{duracion && (
				<span className="shrink-0 text-[10px] leading-none text-white/60">{duracion}</span>
			)}
		</div>
	);
}

function AudioElementContent({
	element,
	trackId,
	isSelected,
}: {
	element: AudioElement;
	trackId: string;
	isSelected: boolean;
}) {
	const pixelsPerSecond = useContext(PixelsPerSecondContext);
	if (pixelsPerSecond === null) {
		throw new Error(
			"AudioElementContent must be rendered inside PixelsPerSecondContext.Provider",
		);
	}
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const fps = useEditor((e) => e.project.getActiveOrNull()?.settings.fps);
	const mediaAsset =
		element.sourceType === "upload"
			? (mediaAssets.find((asset) => asset.id === element.mediaId) ?? null)
			: null;

	const audioBuffer =
		element.sourceType === "library" ? element.buffer : undefined;
	const audioUrl =
		element.sourceType === "library" ? element.sourceUrl : mediaAsset?.url;
	const sourceFile =
		element.sourceType === "upload" ? mediaAsset?.file : undefined;
	const sourceKey =
		element.sourceType === "upload"
			? buildWaveformSourceKey({ kind: "media", id: element.mediaId })
			: buildWaveformSourceKey({ kind: "library", id: element.sourceUrl });
	const mediaLabel = mediaAsset?.name ?? element.name;
	const gainSamples = useMemo(
		() =>
			buildWaveformGainSamples({
				element,
				count: WAVEFORM_GAIN_SAMPLE_COUNT,
			}),
		[element],
	);
	const colorOnda = useMemo(() => leerToken("--cc-clip-audio-wave", "rgba(255,255,255,0.7)"), []);
	const fpsNum = fps ? fps.numerator / fps.denominator : 30;

	return (
		<div className="group/audio relative flex size-full flex-col">
			<FranjaNombre
				nombre={mediaLabel}
				duracion={formatoDuracion(element.duration, fpsNum)}
				claseFondo="bg-(--cc-clip-audio-name)"
				inicio={<RotuloVelocidad retime={element.retime} />}
			/>
			<div className="relative min-h-0 flex-1 overflow-hidden">
				{(audioBuffer || audioUrl || sourceFile) && (
					<AudioWaveform
						sourceKey={sourceKey}
						sourceFile={sourceFile}
						audioBuffer={audioBuffer}
						audioUrl={audioUrl}
						gainSamples={gainSamples}
						pixelsPerSecond={pixelsPerSecond}
						clipDurationSec={element.duration / TICKS_PER_SECOND}
						retime={element.retime}
						sourceStartSec={element.trimStart / TICKS_PER_SECOND}
						color={colorOnda}
					/>
				)}
				<AudioVolumeLine element={element} trackId={trackId} />
				{/* Los ritmos marcados (paquete J, audio/components/ritmos-clip.tsx). */}
				<RitmosClip element={element} pixelsPerSecond={pixelsPerSecond} />
			</div>
			<FundidosAudio
				element={element}
				trackId={trackId}
				pixelsPerSecond={pixelsPerSecond}
				visible={isSelected}
			/>
		</div>
	);
}

function EffectsButton({
	element,
	track,
}: {
	element: VideoElement | ImageElement;
	track: TimelineTrack;
}) {
	const editor = useEditor();
	const setActiveTab = usePropertiesStore((s) => s.setActiveTab);

	const handleClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		editor.selection.setSelectedElements({
			elements: [{ trackId: track.id, elementId: element.id }],
		});
		// Las pestañas las registra el paquete de color (effects/registro-ce.ts):
		// «Efectos» lista filtros y efectos del clip; si sólo tiene ajuste o croma,
		// lo que hay para tocar está en «Ajustar». Si es sólo el croma, en Video ›
		// «Eliminar fondo» (fondo/registro.tsx, SUBPESTANA_ELIMINAR_FONDO).
		const soloCroma = (element.effects ?? []).every((e) => e.type === "croma");
		setActiveTab({
			elementType: element.type,
			tabId:
				efectosListables(element.effects).length > 0
					? "efectos-clip"
					: soloCroma
						? "video-eliminar-fondo"
						: "ajustar-basico",
		});
	};

	return (
		<button
			type="button"
			aria-label="Efectos"
			className="flex shrink-0 cursor-pointer justify-center text-white"
			onMouseDown={(event) => event.stopPropagation()}
			onClick={handleClick}
		>
			<WandSparkles className="size-3" />
		</button>
	);
}

/** Video o imagen: nombre + duración, tira de miniaturas y (en la principal) la onda. */
function MediaClipContent({
	element,
	track,
	isMain,
	alto,
}: {
	element: VideoElement | ImageElement;
	track: TimelineTrack;
	isMain: boolean;
	alto: number;
}) {
	const pixelsPerSecond = useContext(PixelsPerSecondContext) ?? 50;
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const fps = useEditor((e) => e.project.getActiveOrNull()?.settings.fps);
	const mediaAsset = mediaAssets.find((asset) => asset.id === element.mediaId);
	const fpsNum = fps ? fps.numerator / fps.denominator : 30;
	const conOnda =
		isMain &&
		element.type === "video" &&
		mediaSupportsAudio({ media: mediaAsset ?? null }) &&
		!isSourceAudioSeparated({ element });
	const colorOnda = useMemo(() => leerToken("--cc-clip-audio-wave", "rgba(255,255,255,0.7)"), []);
	const gainSamples = useMemo(
		() =>
			element.type === "video"
				? buildWaveformGainSamples({ element, count: WAVEFORM_GAIN_SAMPLE_COUNT })
				: undefined,
		[element],
	);
	const aspecto =
		mediaAsset?.width && mediaAsset?.height ? mediaAsset.width / mediaAsset.height : 16 / 9;
	const altoTira = alto - CLIP_NAME_STRIP_HEIGHT_PX - (conOnda ? CLIP_WAVE_STRIP_HEIGHT_PX : 0);
	const retime = element.type === "video" ? element.retime : undefined;

	return (
		<div className="flex size-full flex-col">
			<FranjaNombre
				nombre={mediaAsset?.name ?? element.name}
				duracion={formatoDuracion(element.duration, fpsNum)}
				claseFondo="bg-(--cc-clip-video-name)"
				inicio={
					<>
						{hasElementEffects({ element }) ? (
							<EffectsButton element={element} track={track} />
						) : null}
						<RotuloVelocidad retime={retime} />
					</>
				}
			/>
			<div className="relative w-full shrink-0" style={{ height: Math.max(0, altoTira) }}>
				{mediaAsset ? (
					<TiraMiniaturas
						mediaId={mediaAsset.id}
						tipo={element.type}
						file={element.type === "video" ? mediaAsset.file : undefined}
						urlRespaldo={
							element.type === "video"
								? mediaAsset.thumbnailUrl
								: (mediaAsset.thumbnailUrl ?? mediaAsset.url)
						}
						aspecto={aspecto}
						pixelsPerSecond={pixelsPerSecond}
						clipDurationSec={element.duration / TICKS_PER_SECOND}
						sourceStartSec={element.trimStart / TICKS_PER_SECOND}
						retime={retime}
					/>
				) : null}
			</div>
			{conOnda && mediaAsset && element.type === "video" && (
				<div
					className="relative w-full shrink-0 overflow-hidden"
					style={{ height: CLIP_WAVE_STRIP_HEIGHT_PX }}
				>
					<AudioWaveform
						sourceKey={buildWaveformSourceKey({ kind: "media", id: mediaAsset.id })}
						sourceFile={mediaAsset.file}
						audioUrl={mediaAsset.url}
						gainSamples={gainSamples}
						pixelsPerSecond={pixelsPerSecond}
						clipDurationSec={element.duration / TICKS_PER_SECOND}
						retime={element.retime}
						sourceStartSec={element.trimStart / TICKS_PER_SECOND}
						color={colorOnda}
					/>
				</div>
			)}
		</div>
	);
}

function ElementContent({ element, track, isMain, isSelected, alto }: ElementContentProps) {
	switch (element.type) {
		case "text":
			return <TextElementContent element={element} />;
		case "effect":
			return <EffectElementContent element={element} />;
		case "sticker":
			return <StickerElementContent element={element} />;
		case "graphic":
			return <GraphicElementContent element={element} />;
		case "audio":
			return (
				<AudioElementContent element={element} trackId={track.id} isSelected={isSelected} />
			);
		case "video":
		case "image":
			return (
				<MediaClipContent element={element} track={track} isMain={isMain} alto={alto} />
			);
	}
}

function ActionMenuItem({
	action,
	children,
	...props
}: Omit<ComponentProps<typeof ContextMenuItem>, "onClick" | "textRight"> & {
	action: TActionWithOptionalArgs;
	children: ReactNode;
}) {
	return (
		<ContextMenuItem
			onClick={(event: React.MouseEvent) => {
				event.stopPropagation();
				invokeAction(action);
			}}
			textRight={atajoDe(action as TAction)}
			{...props}
		>
			{children}
		</ContextMenuItem>
	);
}
