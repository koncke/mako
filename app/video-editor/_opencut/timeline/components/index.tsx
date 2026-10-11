"use client";

// La línea de tiempo de CapCut Desktop 9.3 sobre el motor de OpenCut.
//
// De arriba abajo: la barra de herramientas (una cáscara que dibuja la ranura
// `herramientasLinea`), y debajo dos columnas: a la izquierda las cabeceras de
// pista (147 px) y la columna del botón «Portada» (56 px); a la derecha la
// regla, los marcadores y las pistas. Las pistas van como en CapCut: texto,
// stickers y efectos finos arriba, las superposiciones de video, la PRINCIPAL
// (la más alta) y el audio abajo.
//
// Rueda: sola = vertical; Alt (o Shift) = horizontal; Ctrl = zoom. El zoom se
// escucha con `{ passive: false }`, si no Chrome hace zoom de la PÁGINA.

import { ScrollArea } from "@/app/video-editor/_opencut/components/ui/scroll-area";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import { TooltipProvider } from "@/app/video-editor/_opencut/components/ui/tooltip";
import { useTimelineZoom } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-zoom";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useContainerSize } from "@/app/video-editor/_opencut/hooks/use-container-size";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { mediaTime, TICKS_PER_SECOND, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import type { ElementDragView, DropTarget } from "@/app/video-editor/_opencut/timeline";
import { TimelineTrackContent } from "./timeline-track";
import { TimelinePlayhead } from "./timeline-playhead";
import { SelectionBox } from "@/app/video-editor/_opencut/selection/selection-box";
import { useBoxSelect } from "@/app/video-editor/_opencut/selection/hooks/use-box-select";
import { SnapIndicator } from "./snap-indicator";
import type { SnapPoint } from "@/app/video-editor/_opencut/timeline/snapping";
import type { TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import {
	TIMELINE_SCROLLBAR_SIZE_PX,
	TIMELINE_CONTENT_TOP_PADDING_PX,
	TIMELINE_TRACK_GAP_PX,
	TIMELINE_TRACK_HEADER_WIDTH_PX,
	TIMELINE_COVER_COLUMN_WIDTH_PX,
	TIMELINE_TRACK_LABELS_COLUMN_WIDTH_PX,
	KEYFRAME_LANE_HEIGHT_PX,
} from "./layout";
import { useElementInteraction } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-interaction";
import {
	canTrackHaveAudio,
	canTrackBeHidden,
	getTimelineZoomMin,
	getTimelinePaddingPx,
} from "@/app/video-editor/_opencut/timeline";
import { timelineTimeToPixels } from "@/app/video-editor/_opencut/timeline/pixel-utils";
import {
	getTrackHeight,
	getCumulativeHeightBefore,
	getTotalTracksHeight,
} from "./track-layout";
import { SELECTED_TRACK_ROW_CLASS } from "./theme";
import {
	computeTrackExpansionHeight,
	getTrackExpandedRows,
	getPropertyLabel,
	type ExpandedRow,
} from "./expanded-layout";
import { TIMELINE_HORIZONTAL_WHEEL_STEP_PX, TIMELINE_ZOOM_BUTTON_FACTOR } from "./interaction";
import { TimelineToolbar } from "./timeline-toolbar";
import { useElementSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-selection";
import { useTimelineSeek } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-seek";
import { useTimelineDragDrop } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-drag-drop";
import { TimelineRuler } from "./timeline-ruler";
import {
	TimelineBookmarksRow,
	useBookmarkDrag,
} from "@/app/video-editor/_opencut/timeline/bookmarks/index";
import { useEdgeAutoScroll } from "@/app/video-editor/_opencut/timeline/hooks/use-edge-auto-scroll";
import { useInitialScrollBottom } from "@/app/video-editor/_opencut/timeline/hooks/use-initial-scroll-bottom";
import { useTimelineResize } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-resize";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useScrollPosition } from "@/app/video-editor/_opencut/timeline/hooks/use-scroll-position";
import { useTimelinePlayhead } from "@/app/video-editor/_opencut/timeline/hooks/use-timeline-playhead";
import { DragLine } from "./drag-line";
import { atajoDe, invokeAction } from "@/app/video-editor/_opencut/actions";
import { useActionHandler } from "@/app/video-editor/_opencut/actions/use-action-handler";
import { resolveTimelineElementIntersections } from "./selection-hit-testing";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { BASE_TIMELINE_PIXELS_PER_SECOND, TIMELINE_ZOOM_MAX } from "@/app/video-editor/_opencut/timeline/scale";
import { CabeceraPista } from "./cabecera-pista";
import { BotonPortada } from "./portada-boton";
import { alternarBloqueoPista, pistasEnOrden } from "./pistas-ce";
import { useZoomLinea } from "./zoom-linea";
import { fijarTiempoEjeVistaPrevia } from "./eje-vista-previa";
import { TIMELINE_LAYERS } from "./layers";

const TRACKS_CONTAINER_MAX_HEIGHT = 800;
const FALLBACK_CONTAINER_WIDTH = 1000;
const TRACKS_CONTAINER_HEIGHT = { min: 0, max: TRACKS_CONTAINER_MAX_HEIGHT };

export function Timeline() {
	const snappingEnabled = useTimelineStore((s) => s.snappingEnabled);
	// En «Modo de división» el eje va siempre (CapCut no deja apagarlo ahí).
	const ejeVistaPrevia = useTimelineStore(
		(s) => s.ejeVistaPrevia || s.modoCursor === "dividir",
	);
	const {
		selectedElements,
		clearElementSelection,
		setElementSelection,
		mergeElementsIntoSelection,
	} = useElementSelection();
	const editor = useEditor();
	const timeline = editor.timeline;
	const scene = useEditor((currentEditor) =>
		currentEditor.scenes.getActiveSceneOrNull(),
	);
	const tracks = useMemo<TimelineTrack[]>(() => pistasEnOrden(scene), [scene]);
	const mainTrackId = scene?.tracks.main.id ?? null;
	const seek = (time: MediaTime) => editor.playback.seek({ time });

	const timelineRef = useRef<HTMLDivElement>(null);
	const timelineHeaderRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const rulerScrollRef = useRef<HTMLDivElement>(null);
	const tracksContainerRef = useRef<HTMLDivElement>(null);
	const tracksScrollRef = useRef<HTMLDivElement>(null);
	const trackLabelsRef = useRef<HTMLDivElement>(null);
	const playheadRef = useRef<HTMLDivElement>(null);
	const trackLabelsScrollRef = useRef<HTMLDivElement>(null);

	const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(
		null,
	);
	const { width: tracksContainerWidth } = useContainerSize({
		containerRef: tracksContainerRef,
	});
	const { height: timelineHeaderHeightValue } = useContainerSize({
		containerRef: timelineHeaderRef,
	});
	const { viewportWidth: tracksViewportWidth } = useScrollPosition({
		scrollRef: tracksScrollRef,
	});

	const handleSnapPointChange = useCallback((snapPoint: SnapPoint | null) => {
		setCurrentSnapPoint(snapPoint);
	}, []);

	const timelineDuration = timeline.getTotalDuration() || 0;
	const containerWidth = tracksContainerWidth || FALLBACK_CONTAINER_WIDTH;
	const minZoomLevel = getTimelineZoomMin({
		duration: timelineDuration,
		containerWidth,
	});

	const savedViewState = editor.project.getTimelineViewState();

	const { zoomLevel, setZoomLevel, handleWheel, saveScrollPosition } =
		useTimelineZoom({
			containerRef: timelineRef,
			minZoom: minZoomLevel,
			initialZoom: savedViewState?.zoomLevel,
			initialScrollLeft: savedViewState?.scrollLeft,
			initialPlayheadTime: savedViewState?.playheadTime,
			tracksScrollRef,
			rulerScrollRef,
		});
	const { isResizing, handleResizeStart } = useTimelineResize({
		zoomLevel,
		onSnapPointChange: handleSnapPointChange,
	});

	const expandedElementIds = useTimelineStore((s) => s.expandedElementIds);

	const getTrackExpansionHeight = useCallback(
		(trackIndex: number) => {
			const track = tracks[trackIndex];
			if (!track) return 0;
			return computeTrackExpansionHeight({ track, expandedElementIds });
		},
		[tracks, expandedElementIds],
	);

	// Stable refs so the wheel listener never goes stale
	const setZoomLevelRef = useRef(setZoomLevel);
	useEffect(() => {
		setZoomLevelRef.current = setZoomLevel;
	}, [setZoomLevel]);

	const saveScrollPositionRef = useRef(saveScrollPosition);
	useEffect(() => {
		saveScrollPositionRef.current = saveScrollPosition;
	}, [saveScrollPosition]);

	const minZoomLevelRef = useRef(minZoomLevel);
	useEffect(() => {
		minZoomLevelRef.current = minZoomLevel;
	}, [minZoomLevel]);

	// Pushes tracks scroll position to the two overflow:hidden followers
	// (ruler and track labels). Called from the wheel handler (before paint,
	// zero lag) and from onScroll on the tracks area (covers scrollbar drag).
	const syncFollowers = useCallback(() => {
		const tracks = tracksScrollRef.current;
		if (!tracks) return;
		if (rulerScrollRef.current) {
			rulerScrollRef.current.scrollLeft = tracks.scrollLeft;
		}
		if (trackLabelsScrollRef.current) {
			trackLabelsScrollRef.current.scrollTop = tracks.scrollTop;
		}
	}, []);

	// ── Zoom: Acercar / Alejar / Hacer zoom para ajustar (barra y teclado) ────
	// La barra recibe funciones ESTABLES que leen la versión de este render por
	// un ref: publicar las del render directamente re-publicaría en cada uno.
	const fijarZoom = (zoom: number) =>
		setZoomLevel(Math.max(minZoomLevel, Math.min(TIMELINE_ZOOM_MAX, zoom)));
	const ajustarZoom = () => {
		const segundos = editor.timeline.getTotalDuration() / TICKS_PER_SECOND;
		if (segundos <= 0) return;
		const ancho = (tracksScrollRef.current?.clientWidth ?? containerWidth) - 48;
		fijarZoom(ancho / (segundos * BASE_TIMELINE_PIXELS_PER_SECOND));
		requestAnimationFrame(() => {
			const el = tracksScrollRef.current;
			if (!el) return;
			el.scrollLeft = 0;
			if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = 0;
			saveScrollPositionRef.current();
		});
	};
	const accionesZoomRef = useCommittedRef({ fijarZoom, ajustarZoom });

	useEffect(() => {
		useZoomLinea.getState().publicar({
			zoom: zoomLevel,
			min: minZoomLevel,
			max: TIMELINE_ZOOM_MAX,
			fijarZoom: (zoom) => accionesZoomRef.current.fijarZoom(zoom),
			ajustar: () => accionesZoomRef.current.ajustarZoom(),
		});
	}, [zoomLevel, minZoomLevel, accionesZoomRef]);

	useActionHandler(
		"acercar-linea",
		() => fijarZoom(zoomLevel * TIMELINE_ZOOM_BUTTON_FACTOR),
		undefined,
	);
	useActionHandler(
		"alejar-linea",
		() => fijarZoom(zoomLevel / TIMELINE_ZOOM_BUTTON_FACTOR),
		undefined,
	);
	useActionHandler("ajustar-linea", () => ajustarZoom(), undefined);

	// Single non-passive capture listener owns all wheel input. Prevents any
	// native scroll or browser zoom from firing inside the timeline.
	useEffect(() => {
		const container = timelineRef.current;
		if (!container) return;

		let pendingZoomDelta = 0;
		let zoomRafId: ReturnType<typeof requestAnimationFrame> | null = null;

		const onWheel = (e: WheelEvent) => {
			const isZoom = e.ctrlKey || e.metaKey;

			if (isZoom) {
				e.preventDefault();
				const normalizedDelta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
				pendingZoomDelta += normalizedDelta;

				if (zoomRafId === null) {
					zoomRafId = requestAnimationFrame(() => {
						const frameRawDelta = pendingZoomDelta;
						const cappedDelta =
							Math.sign(frameRawDelta) * Math.min(Math.abs(frameRawDelta), 30);
						const zoomFactor = Math.exp(-cappedDelta / 300);
						setZoomLevelRef.current((prev) => prev * zoomFactor);
						pendingZoomDelta = 0;
						zoomRafId = null;
					});
				}
				return;
			}

			const tracks = tracksScrollRef.current;
			if (!tracks) return;

			// Alt+rueda = horizontal (preset «CapCut»); Shift y el trackpad, también.
			const isHorizontal =
				e.altKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

			e.preventDefault();

			if (isHorizontal) {
				const raw =
					Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
				const clamped =
					Math.sign(raw) *
					Math.min(Math.abs(raw), TIMELINE_HORIZONTAL_WHEEL_STEP_PX);
				tracks.scrollLeft = Math.max(0, tracks.scrollLeft + clamped);
			} else {
				tracks.scrollTop = Math.max(0, tracks.scrollTop + e.deltaY);
			}

			syncFollowers();
			saveScrollPositionRef.current();
		};

		container.addEventListener("wheel", onWheel, {
			passive: false,
			capture: true,
		});
		return () => {
			container.removeEventListener("wheel", onWheel, { capture: true });
			if (zoomRafId !== null) cancelAnimationFrame(zoomRafId);
		};
	}, [syncFollowers]);

	useInitialScrollBottom({
		tracksScrollRef,
		trackLabelsScrollRef,
		onAfterScroll: () => saveScrollPositionRef.current(),
		isReady: tracks.length > 0,
	});

	const { dragView, handleElementMouseDown, handleElementClick } =
		useElementInteraction({
		zoomLevel,
		tracksContainerRef,
		tracksScrollRef,
		snappingEnabled,
		onSnapPointChange: handleSnapPointChange,
	});
	const isElementDragging = dragView.kind === "dragging";

	const {
		dragState: bookmarkDragState,
		handleBookmarkMouseDown,
		lastMouseXRef: bookmarkLastMouseXRef,
	} = useBookmarkDrag({
		zoomLevel,
		scrollRef: tracksScrollRef,
		snappingEnabled,
		onSnapPointChange: handleSnapPointChange,
	});

	const { handleRulerMouseDown: handlePlayheadRulerMouseDown } =
		useTimelinePlayhead({
			zoomLevel,
			rulerRef,
			rulerScrollRef,
			tracksScrollRef,
			playheadRef,
		});

	const { isDragOver, dropTarget, dragProps } = useTimelineDragDrop({
		containerRef: tracksContainerRef,
		tracksScrollRef,
		zoomLevel,
	});

	const {
		selectionBox,
		handleMouseDown: handleSelectionMouseDown,
		isSelecting,
		shouldIgnoreClick,
	} = useBoxSelect({
		containerRef: tracksContainerRef,
		selectedIds: selectedElements,
		anchorId: null,
		getIsAdditiveSelection: (event) =>
			event.shiftKey || event.ctrlKey || event.metaKey,
		resolveIntersections: ({ startPos, currentPos }) => {
			if (!tracksContainerRef.current) {
				return [];
			}

			return resolveTimelineElementIntersections({
				container: tracksContainerRef.current,
				scrollContainer: tracksScrollRef.current,
				tracks,
				mainTrackId,
				zoomLevel,
				startPos,
				currentPos,
			});
		},
		onSelectionChange: ({ intersectedIds, isAdditive }) => {
			if (isAdditive) {
				mergeElementsIntoSelection({ elements: intersectedIds });
			} else {
				setElementSelection({ elements: intersectedIds });
			}
		},
	});

	const contentWidth = timelineTimeToPixels({
		time: timelineDuration,
		zoomLevel,
	});
	const paddingPx = getTimelinePaddingPx({
		containerWidth,
		zoomLevel,
		minZoom: minZoomLevel,
	});
	const dynamicTimelineWidth = Math.max(
		contentWidth + paddingPx,
		containerWidth,
	);
	const hasHorizontalScrollbar =
		dynamicTimelineWidth > (tracksViewportWidth || containerWidth);

	useEdgeAutoScroll({
		isActive: bookmarkDragState.isDragging,
		getMouseClientX: () => bookmarkLastMouseXRef.current,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth: dynamicTimelineWidth,
	});

	useEdgeAutoScroll({
		isActive: isElementDragging,
		getMouseClientX: () =>
			dragView.kind === "dragging" ? dragView.currentMouseX : 0,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth: dynamicTimelineWidth,
	});

	const showSnapIndicator =
		snappingEnabled &&
		currentSnapPoint !== null &&
		(isElementDragging || bookmarkDragState.isDragging || isResizing);

	const {
		handleTracksMouseDown,
		handleTracksClick,
		handleRulerMouseDown,
		handleRulerClick,
	} = useTimelineSeek({
		playheadRef,
		trackLabelsRef,
		rulerScrollRef,
		tracksScrollRef,
		zoomLevel,
		duration: timeline.getTotalDuration(),
		isSelecting,
		clearSelectedElements: clearElementSelection,
		seek,
	});

	const timelineHeaderHeight =
		timelineHeaderHeightValue + TIMELINE_CONTENT_TOP_PADDING_PX;

	// ── Eje de vista previa: el reproductor muestra el cuadro bajo el mouse ──
	const [xEje, setXEje] = useState<number | null>(null);
	const reproduciendo = useEditor((e) => e.playback.getIsPlaying());
	const ocupado =
		reproduciendo ||
		isElementDragging ||
		isResizing ||
		isSelecting ||
		bookmarkDragState.isDragging;
	const moverEje = (event: React.MouseEvent) => {
		const scroll = tracksScrollRef.current;
		const contenedor = tracksContainerRef.current;
		if (!ejeVistaPrevia || ocupado || !scroll || !contenedor) {
			if (xEje !== null) salirEje();
			return;
		}
		const rect = contenedor.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const segundos = (x + scroll.scrollLeft) / (BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel);
		const limite = editor.timeline.getTotalDuration();
		const ticks = Math.max(0, Math.min(limite, Math.round(segundos * TICKS_PER_SECOND)));
		if (limite <= 0) return;
		setXEje(x);
		fijarTiempoEjeVistaPrevia(mediaTime({ ticks }));
	};
	const salirEje = () => {
		setXEje(null);
		fijarTiempoEjeVistaPrevia(null);
	};
	// El reproductor vuelve al cabezal en cuanto el eje deja de valer (se apagó,
	// arrancó la reproducción o empezó un arrastre). La línea se esconde sola
	// porque se dibuja sólo con el eje vigente (`ejeVisible`).
	const ejeVisible = xEje !== null && ejeVistaPrevia && !ocupado;
	useEffect(() => {
		if (!ejeVistaPrevia || ocupado) fijarTiempoEjeVistaPrevia(null);
	}, [ejeVistaPrevia, ocupado]);
	useEffect(() => () => fijarTiempoEjeVistaPrevia(null), []);

	const totalTracksHeight = getTotalTracksHeight({
		tracks,
		getExtraHeight: getTrackExpansionHeight,
		mainTrackId,
	});
	const lineaVacia = tracks.every((t) => t.elements.length === 0);

	return (
		<section
			className={
				"panel relative flex h-full flex-col overflow-hidden rounded-[7px] bg-(--cc-panel)"
			}
			{...dragProps}
			aria-label="Línea de tiempo"
		>
			<TimelineToolbar />

			<TooltipProvider delayDuration={400}>
				<div className="relative flex flex-1 overflow-hidden" ref={timelineRef}>
					<TrackLabelsPanel
						trackLabelsRef={trackLabelsRef}
						trackLabelsScrollRef={trackLabelsScrollRef}
						timelineHeaderHeight={timelineHeaderHeight}
						hasHorizontalScrollbar={hasHorizontalScrollbar}
						getTrackExpansionHeight={getTrackExpansionHeight}
						mainTrackId={mainTrackId}
					/>

					<div
						className="relative isolate flex flex-1 flex-col overflow-hidden"
						ref={tracksContainerRef}
						onMouseMove={moverEje}
						onMouseLeave={salirEje}
					>
						<SelectionBox
							bounds={selectionBox?.bounds ?? null}
						/>
						<DragLine
							dropTarget={dropTarget}
							tracks={tracks}
							mainTrackId={mainTrackId}
							isVisible={isDragOver && !dropTarget?.targetElement}
							headerHeight={timelineHeaderHeight}
						/>
						<DragLine
							dropTarget={isElementDragging ? dragView.dropTarget : null}
							tracks={tracks}
							mainTrackId={mainTrackId}
							isVisible={isElementDragging}
							headerHeight={timelineHeaderHeight}
						/>

						<div ref={rulerScrollRef} className="shrink-0 overflow-hidden">
							<div
								ref={timelineHeaderRef}
								className="flex flex-col"
								style={{ width: `${dynamicTimelineWidth}px` }}
							>
								<TimelineRuler
									zoomLevel={zoomLevel}
									dynamicTimelineWidth={dynamicTimelineWidth}
									rulerRef={rulerRef}
									tracksScrollRef={rulerScrollRef}
									handleWheel={handleWheel}
									handleTimelineContentClick={handleRulerClick}
									handleRulerTrackingMouseDown={handleRulerMouseDown}
									handleRulerMouseDown={handlePlayheadRulerMouseDown}
								/>
								<TimelineBookmarksRow
									zoomLevel={zoomLevel}
									dynamicTimelineWidth={dynamicTimelineWidth}
									dragState={bookmarkDragState}
									onBookmarkMouseDown={handleBookmarkMouseDown}
									handleWheel={handleWheel}
									handleTimelineContentClick={handleRulerClick}
									handleRulerTrackingMouseDown={handleRulerMouseDown}
									handleRulerMouseDown={handlePlayheadRulerMouseDown}
								/>
							</div>
						</div>

						<ScrollArea
							className="flex-1"
							ref={tracksScrollRef}
							onScroll={() => {
								syncFollowers();
								saveScrollPosition();
							}}
						>
							<div
								className="flex min-h-full flex-col"
								style={{ width: `${dynamicTimelineWidth}px` }}
							>
								{/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- spatial gesture surface (tracks container background); direct-target clicks here originate box-select or clear selection. Keyboard control is global timeline shortcuts. */}
								<div
									className="relative shrink-0"
									style={{
										height: `${
											Math.max(
												TRACKS_CONTAINER_HEIGHT.min,
												Math.min(TRACKS_CONTAINER_HEIGHT.max, totalTracksHeight),
											) + TIMELINE_CONTENT_TOP_PADDING_PX
										}px`,
									}}
									onMouseDown={(event) => {
										const isDirectTarget = event.target === event.currentTarget;
										if (!isDirectTarget) return;
										event.stopPropagation();
										handleTracksMouseDown(event);
										handleSelectionMouseDown(event);
									}}
									onClick={(event) => {
										const isDirectTarget = event.target === event.currentTarget;
										if (!isDirectTarget) return;
										event.stopPropagation();
										handleTracksClick(event);
									}}
								>
									{tracks.length > 0 && (
										<TimelineTrackRows
											mainTrackId={mainTrackId}
											lineaVacia={lineaVacia}
											zoomLevel={zoomLevel}
											dragView={dragView}
											onResizeStart={handleResizeStart}
											onElementMouseDown={handleElementMouseDown}
											onElementClick={handleElementClick}
											onTrackMouseDown={(event) => {
												handleSelectionMouseDown(event);
												handleTracksMouseDown(event);
											}}
											onTrackMouseUp={handleTracksClick}
											shouldIgnoreClick={shouldIgnoreClick}
											isDragOver={isDragOver}
											dropTarget={dropTarget}
										/>
									)}
								</div>
								<TimelineGutter
									onMouseDown={(event) => {
										handleTracksMouseDown(event);
										handleSelectionMouseDown(event);
									}}
									onClick={handleTracksClick}
								/>
							</div>
						</ScrollArea>

						<TimelinePlayhead
							zoomLevel={zoomLevel}
							hasHorizontalScrollbar={hasHorizontalScrollbar}
							rulerRef={rulerRef}
							rulerScrollRef={rulerScrollRef}
							tracksScrollRef={tracksScrollRef}
							timelineRef={timelineRef}
							playheadRef={playheadRef}
							isSnappingToPlayhead={
								showSnapIndicator && currentSnapPoint?.type === "playhead"
							}
						/>

						{ejeVisible && (
							<div
								aria-hidden
								className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/45"
								style={{ left: xEje, zIndex: TIMELINE_LAYERS.playhead - 1 }}
							/>
						)}
					</div>
					<SnapIndicator
						snapPoint={currentSnapPoint}
						zoomLevel={zoomLevel}
						timelineRef={timelineRef}
						tracksScrollRef={tracksScrollRef}
						isVisible={showSnapIndicator}
					/>
				</div>
			</TooltipProvider>
		</section>
	);
}

function TrackLabelsPanel({
	trackLabelsRef,
	trackLabelsScrollRef,
	timelineHeaderHeight,
	hasHorizontalScrollbar,
	getTrackExpansionHeight,
	mainTrackId,
}: {
	trackLabelsRef: React.RefObject<HTMLDivElement | null>;
	trackLabelsScrollRef: React.RefObject<HTMLDivElement | null>;
	timelineHeaderHeight: number;
	hasHorizontalScrollbar: boolean;
	getTrackExpansionHeight: (trackIndex: number) => number;
	mainTrackId: string | null;
}) {
	const scene = useEditor((e) => e.scenes.getActiveSceneOrNull());
	const tracks = useMemo<TimelineTrack[]>(() => pistasEnOrden(scene), [scene]);
	const { selectedElements } = useElementSelection();
	const tracksWithSelection = useMemo(
		() => new Set(selectedElements.map((el) => el.trackId)),
		[selectedElements],
	);

	const expandedElementIds = useTimelineStore((s) => s.expandedElementIds);
	const trackExpandedRowsMap = useMemo(
		() =>
			tracks.map((track) =>
				getTrackExpandedRows({ track, expandedElementIds }),
			),
		[tracks, expandedElementIds],
	);

	return (
		<div
			className="flex shrink-0 flex-col"
			style={{
				width: `${TIMELINE_TRACK_LABELS_COLUMN_WIDTH_PX}px`,
				// La columna de cabeceras es `#2a2a2a` de arriba abajo; la de
				// «Portada», del color del panel.
				background: `linear-gradient(to right, var(--cc-track-head) ${TIMELINE_TRACK_HEADER_WIDTH_PX}px, transparent ${TIMELINE_TRACK_HEADER_WIDTH_PX}px)`,
			}}
		>
			<div
				className="shrink-0 bg-(--cc-track-head)"
				style={{
					height: timelineHeaderHeight || 40,
					width: TIMELINE_TRACK_HEADER_WIDTH_PX,
				}}
			/>
			<div ref={trackLabelsRef} className="flex-1 overflow-hidden">
				<div ref={trackLabelsScrollRef} className="size-full overflow-hidden">
					{tracks.length > 0 && (
						<div
							className="flex flex-col"
							style={{ gap: `${TIMELINE_TRACK_GAP_PX}px` }}
						>
							{tracks.map((track, index) => {
								const expandedRows = trackExpandedRowsMap[index];
								const isMain = track.id === mainTrackId;
								const baseHeight = getTrackHeight({ type: track.type, isMain });

								return (
									<div
										key={track.id}
										className="flex"
										style={{
											height: `${baseHeight + getTrackExpansionHeight(index)}px`,
										}}
									>
										<div
											className="flex flex-col"
											style={{ width: TIMELINE_TRACK_HEADER_WIDTH_PX }}
										>
											<CabeceraPista
												track={track}
												isMain={isMain}
												height={baseHeight}
												elegida={tracksWithSelection.has(track.id)}
											/>
											{expandedRows.length > 0 && (
												<PropertyTree rows={expandedRows} />
											)}
										</div>
										{/* La columna «Portada»: el botón sólo en la fila de la principal. */}
										<div
											className="flex items-center justify-center"
											style={{ width: TIMELINE_COVER_COLUMN_WIDTH_PX, height: baseHeight }}
										>
											{isMain && <BotonPortada alto={baseHeight} />}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
			<div
				className="shrink-0 bg-(--cc-track-head)"
				style={{
					width: TIMELINE_TRACK_HEADER_WIDTH_PX,
					height: hasHorizontalScrollbar ? TIMELINE_SCROLLBAR_SIZE_PX : 0,
				}}
			/>
		</div>
	);
}

function TimelineTrackRows({
	mainTrackId,
	lineaVacia,
	zoomLevel,
	dragView,
	onResizeStart,
	onElementMouseDown,
	onElementClick,
	onTrackMouseDown,
	onTrackMouseUp,
	shouldIgnoreClick,
	isDragOver,
	dropTarget,
}: {
	mainTrackId: string | null;
	lineaVacia: boolean;
	zoomLevel: number;
	dragView: ElementDragView;
	onResizeStart: React.ComponentProps<
		typeof TimelineTrackContent
	>["onResizeStart"];
	onElementMouseDown: React.ComponentProps<
		typeof TimelineTrackContent
	>["onElementMouseDown"];
	onElementClick: React.ComponentProps<
		typeof TimelineTrackContent
	>["onElementClick"];
	onTrackMouseDown: (event: React.MouseEvent) => void;
	onTrackMouseUp: (event: React.MouseEvent) => void;
	shouldIgnoreClick: () => boolean;
	isDragOver: boolean;
	dropTarget: DropTarget | null;
}) {
	const editor = useEditor();
	const timeline = editor.timeline;
	const hayPortapapeles = useEditor((e) => e.clipboard.hasEntry());
	const scene = useEditor((e) => e.scenes.getActiveSceneOrNull());
	const tracks = useMemo<TimelineTrack[]>(() => pistasEnOrden(scene), [scene]);
	const { selectedElements } = useElementSelection();
	const tracksWithSelection = useMemo(
		() => new Set(selectedElements.map((el) => el.trackId)),
		[selectedElements],
	);

	const expandedElementIds = useTimelineStore((s) => s.expandedElementIds);

	const getTrackExpansionHeight = useCallback(
		(trackIndex: number) => {
			const track = tracks[trackIndex];
			if (!track) return 0;
			return computeTrackExpansionHeight({ track, expandedElementIds });
		},
		[tracks, expandedElementIds],
	);

	const draggingElementIds = useMemo(
		() =>
			dragView.kind === "dragging"
			? dragView.memberTimeOffsets
			: (null as ReadonlyMap<string, MediaTime> | null),
		[dragView],
	);
	const sortedTracks = useMemo(() => {
		if (!draggingElementIds)
			return tracks.map((track, index) => ({ track, index }));
		return [...tracks]
			.map((track, index) => ({ track, index }))
			.sort((a, b) => {
				const aHasDragged = a.track.elements.some((element) =>
					draggingElementIds.has(element.id),
				);
				const bHasDragged = b.track.elements.some((element) =>
					draggingElementIds.has(element.id),
				);
				if (aHasDragged) return 1;
				if (bHasDragged) return -1;
				return 0;
			});
	}, [tracks, draggingElementIds]);

	return (
		<>
			{sortedTracks.map(({ track, index }) => {
				const isMain = track.id === mainTrackId;
				return (
					<ContextMenu key={track.id}>
						<ContextMenuTrigger asChild>
							<div
								className={cn(
									"absolute right-0 left-0 bg-(--cc-track) transition-colors",
									tracksWithSelection.has(track.id) && SELECTED_TRACK_ROW_CLASS,
								)}
								style={{
									top: `${TIMELINE_CONTENT_TOP_PADDING_PX + getCumulativeHeightBefore({ tracks, trackIndex: index, getExtraHeight: getTrackExpansionHeight, mainTrackId })}px`,
									height: `${getTrackHeight({ type: track.type, isMain }) + getTrackExpansionHeight(index)}px`,
								}}
							>
								<TimelineTrackContent
									track={track}
									isMain={isMain}
									mostrarVacio={isMain && lineaVacia}
									zoomLevel={zoomLevel}
									dragView={dragView}
									onResizeStart={onResizeStart}
									onElementMouseDown={onElementMouseDown}
									onElementClick={onElementClick}
									onTrackMouseDown={onTrackMouseDown}
									onTrackMouseUp={onTrackMouseUp}
									shouldIgnoreClick={shouldIgnoreClick}
									targetElementId={
										isDragOver
											? (dropTarget?.targetElement?.elementId ?? null)
											: null
									}
								/>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent className="w-52">
							<ContextMenuItem
								disabled={!hayPortapapeles || track.locked}
								textRight={atajoDe("paste-copied")}
								onClick={(event: React.MouseEvent) => {
									event.stopPropagation();
									invokeAction("paste-copied");
								}}
							>
								Pegar
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem
								onClick={(event: React.MouseEvent) => {
									event.stopPropagation();
									alternarBloqueoPista({ editor, trackId: track.id });
								}}
							>
								{track.locked ? "Desbloquear pista" : "Bloquear pista"}
							</ContextMenuItem>
							{canTrackBeHidden(track) && (
								<ContextMenuItem
									onClick={(event: React.MouseEvent) => {
										event.stopPropagation();
										timeline.toggleTrackVisibility({ trackId: track.id });
									}}
								>
									{track.hidden ? "Mostrar la pista" : "Ocultar la pista"}
								</ContextMenuItem>
							)}
							{canTrackHaveAudio(track) && (
								<ContextMenuItem
									onClick={(event: React.MouseEvent) => {
										event.stopPropagation();
										timeline.toggleTrackMute({ trackId: track.id });
									}}
								>
									{track.muted ? "Reactivar el audio de la pista" : "Silenciar pista"}
								</ContextMenuItem>
							)}
						</ContextMenuContent>
					</ContextMenu>
				);
			})}
		</>
	);
}

function TimelineGutter({
	onMouseDown,
	onClick,
}: {
	onMouseDown: (event: React.MouseEvent) => void;
	onClick: (event: React.MouseEvent) => void;
}) {
	return (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- spatial gesture surface (empty space below tracks); clicks here clear selection. Keyboard control is global timeline shortcuts.
		<div className="flex-1" onMouseDown={onMouseDown} onClick={onClick} />
	);
}

function PropertyTree({ rows }: { rows: ExpandedRow[] }) {
	return (
		<div className="flex flex-col overflow-hidden">
			{rows.map((row) => (
				<div
					key={row.propertyPath}
					className={cn("flex shrink-0 items-center px-3 bg-(--cc-sunken)")}
					style={{ height: `${KEYFRAME_LANE_HEIGHT_PX}px` }}
				>
					<span className="text-muted-foreground truncate text-xs leading-none">
						{getPropertyLabel(row.propertyPath)}
					</span>
				</div>
			))}
		</div>
	);
}

