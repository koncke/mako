"use client";

// =============================================================================
// El REPRODUCTOR (panel central), como CapCut 9.3
// =============================================================================
//   ┌ Reproductor ─────────────────────────── ≡ ┐  cabecera.tsx
//   │ [reglas]                                  │  guides/reglas.tsx (Ctrl+Alt+R)
//   │        el lienzo, con los tiradores,      │  transform-handles.tsx
//   │        las guías del usuario y el imán    │  guides/lineas-guia.tsx
//   │ 00:00:03:15 / 00:00:10:20   ▶   Completa 🔍 Relación ⤢ │  toolbar.tsx
//   └───────────────────────────────────────────┘
//
// Los atajos del reproductor (← →, ↑ ↓, J K L, Ctrl+Shift+F…) los atiende
// atajos-reproductor.ts, montado acá. La resolución de reproducción se aplica
// al renderer del reproductor (`escalaSalida`), nunca al export.

import { useCallback, useEffect, useMemo, useRef } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useRafLoop } from "@/app/video-editor/_opencut/hooks/use-raf-loop";
import { useContainerSize } from "@/app/video-editor/_opencut/hooks/use-container-size";
import { CanvasRenderer } from "@/app/video-editor/_opencut/services/renderer/canvas-renderer";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { RootNode } from "@/app/video-editor/_opencut/services/renderer/nodes/root-node";
import { buildScene } from "@/app/video-editor/_opencut/services/renderer/scene-builder";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { PreviewOverlayLayer } from "./overlay-layer";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";
import { ContextMenu, ContextMenuTrigger } from "@/app/video-editor/_opencut/components/ui/context-menu";
import type {
	PreviewOverlayControl,
	PreviewOverlayInstance,
} from "@/app/video-editor/_opencut/preview/overlays";
import { PreviewContextMenu } from "./context-menu";
import { PreviewToolbar } from "./toolbar";
import { CabeceraReproductor } from "./cabecera";
import {
	PreviewViewportProvider,
	usePreviewViewportState,
} from "./preview-viewport";
import { usePreviewStore } from "@/app/video-editor/_opencut/preview/preview-store";
import {
	usePantallaCompleta,
	type PantallaCompleta,
} from "@/app/video-editor/_opencut/preview/hooks/use-pantalla-completa";
import { useAtajosReproductor } from "@/app/video-editor/_opencut/preview/atajos-reproductor";
import { tiempoEjeVistaPrevia } from "@/app/video-editor/_opencut/timeline/components/eje-vista-previa";
import { Reglas, GROSOR_REGLA } from "@/app/video-editor/_opencut/guides/reglas";
import { LineasGuia } from "@/app/video-editor/_opencut/guides/lineas-guia";
import { useArrastreGuia } from "@/app/video-editor/_opencut/guides/use-arrastre-guia";

function usePreviewSize() {
	const canvasSize = useEditor(
		(e) => e.project.getActive()?.settings.canvasSize,
	);

	return {
		width: canvasSize?.width,
		height: canvasSize?.height,
	};
}

function normalizeWheelDelta({
	delta,
	deltaMode,
	pageSize,
}: {
	delta: number;
	deltaMode: number;
	pageSize: number;
}): number {
	if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
		return delta * 16;
	}

	if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		return delta * pageSize;
	}

	return delta;
}

export function PreviewPanel({
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const pantalla = usePantallaCompleta({ panelRef });

	return (
		<div
			ref={panelRef}
			className={cn(
				"panel bg-background relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border",
				// Pantalla completa: el panel tapa el editor entero (ver
				// use-pantalla-completa.ts: la raíz `.ce` es la que pasa a pantalla
				// completa del navegador, para que los menús sigan viéndose). z 45:
				// arriba de las capas de la línea de tiempo (hasta 40,
				// timeline/components/layers.ts) y abajo de los menús (z-50).
				pantalla.activa && "fixed inset-0 z-[45] rounded-none border-0",
			)}
		>
			{pantalla.activa ? null : <CabeceraReproductor />}
			<PreviewCanvas
				pantalla={pantalla}
				overlayControls={overlayControls}
				overlayInstances={overlayInstances}
				onOverlayVisibilityChange={onOverlayVisibilityChange}
			/>
			<RenderTreeController />
		</div>
	);
}

function RenderTreeController() {
	const editor = useEditor();
	const tracks = useEditor(
		(e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks,
	);
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const activeProject = useEditor((e) => e.project.getActive());

	const { width, height } = usePreviewSize();

	useDeepCompareEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
			isPreview: true,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [tracks, mediaAssets, activeProject?.settings.background, width, height]);

	return null;
}

/**
 * La escala a la que se dibuja el reproductor: la resolución elegida abajo
 * («Completa», «1/2», «1/4») y, con «Dar prioridad al rendimiento», la mitad de
 * eso MIENTRAS se reproduce (en pausa se ve con la resolución elegida).
 */
function useEscalaReproductor(): number {
	const resolucion = usePreviewStore((s) => s.resolucion);
	const prioridad = usePreviewStore((s) => s.prioridad);
	const reproduciendo = useEditor((e) => e.playback.getIsPlaying());
	return resolucion * (prioridad === "rendimiento" && reproduciendo ? 0.5 : 1);
}

function PreviewCanvas({
	pantalla,
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	pantalla: PantallaCompleta;
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const canvasMountRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const ultimoErrorRef = useRef<string | null>(null);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const viewportSize = useContainerSize({ containerRef: viewportRef });
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const renderTree = useEditor((e) => e.renderer.getRenderTree());
	const mostrarReglas = usePreviewStore((s) => s.mostrarReglas);
	const escala = useEscalaReproductor();
	const viewport = usePreviewViewportState({
		canvasHeight: nativeHeight,
		canvasWidth: nativeWidth,
		viewportHeight: viewportSize.height,
		viewportRef,
		viewportWidth: viewportSize.width,
	});
	const { canPan, panByScreenDelta, scaleZoom } = viewport;
	const lienzo = activeProject.settings.canvasSize;
	const proyecto = activeProject.metadata.id;

	useAtajosReproductor({ zoom: viewport, pantalla });
	const { arrastre, empezar: empezarArrastreGuia } = useArrastreGuia({
		geometria: viewport,
		viewportRef,
		proyecto,
		lienzo,
	});

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: nativeWidth,
			height: nativeHeight,
			fps: activeProject.settings.fps,
		});
	}, [nativeWidth, nativeHeight, activeProject.settings.fps]);

	// La resolución de reproducción va al renderer DEL REPRODUCTOR; el cuadro se
	// vuelve a dibujar aunque el cabezal no se haya movido.
	useEffect(() => {
		renderer.escalaSalida = escala;
		lastFrameRef.current = -1;
	}, [renderer, escala]);

	// Mount the compositor's output canvas directly into the preview. wgpu
	// renders straight into this element, so there is no intermediate copy —
	// the container div owns positioning/styling, the canvas itself fills it.
	useEffect(() => {
		const mount = canvasMountRef.current;
		if (!mount) return;
		const outputCanvas = renderer.getOutputCanvas();
		outputCanvas.style.display = "block";
		outputCanvas.style.width = "100%";
		outputCanvas.style.height = "100%";
		mount.appendChild(outputCanvas);
		return () => {
			if (outputCanvas.parentElement === mount) {
				mount.removeChild(outputCanvas);
			}
		};
	}, [renderer]);

	const render = useCallback(() => {
		if (!renderTree || renderingRef.current) return;

		// «Eje de vista previa» (línea de tiempo): con el mouse sobre las pistas
		// se muestra ese cuadro sin mover el cabezal.
		const renderTime = Math.min(
			tiempoEjeVistaPrevia() ?? editor.playback.getCurrentTime(),
			editor.timeline.getLastFrameTime(),
		);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * renderer.fps.denominator) / renderer.fps.numerator,
		);
		const frame = Math.floor(renderTime / ticksPerFrame);

		if (
			frame === lastFrameRef.current &&
			renderTree === lastSceneRef.current
		) {
			return;
		}

		renderingRef.current = true;
		lastSceneRef.current = renderTree;
		lastFrameRef.current = frame;
		renderer
			.render({ node: renderTree, time: renderTime })
			.catch((error: unknown) => {
				// Un cuadro que falla no puede dejar el reproductor congelado: sin
				// esto `renderingRef` quedaba en true para siempre. Pasó (11/10/2026)
				// con «Desenfoque» como capa (el WASM rechazaba el cuadro): después ya
				// no se dibujaba nada más hasta recargar. Se avisa una vez por error.
				const mensaje = error instanceof Error ? error.message : String(error);
				if (mensaje !== ultimoErrorRef.current) {
					ultimoErrorRef.current = mensaje;
					console.error("[reproductor] no se pudo dibujar el cuadro:", error);
				}
			})
			.finally(() => {
				renderingRef.current = false;
			});
	}, [renderer, renderTree, editor.playback, editor.timeline]);

	useRafLoop(render);

	useEffect(() => {
		const container = viewportRef.current;
		if (!container) return;

		let pendingZoomDelta = 0;
		let pendingPanDeltaX = 0;
		let pendingPanDeltaY = 0;
		let zoomRafId: ReturnType<typeof requestAnimationFrame> | null = null;
		let panRafId: ReturnType<typeof requestAnimationFrame> | null = null;

		const onWheel = (event: WheelEvent) => {
			const normalizedDeltaX = normalizeWheelDelta({
				delta: event.deltaX,
				deltaMode: event.deltaMode,
				pageSize: container.clientWidth,
			});
			const normalizedDeltaY = normalizeWheelDelta({
				delta: event.deltaY,
				deltaMode: event.deltaMode,
				pageSize: container.clientHeight,
			});
			const isZoomGesture = event.ctrlKey || event.metaKey;
			if (isZoomGesture) {
				event.preventDefault();
				pendingZoomDelta += normalizedDeltaY;

				if (zoomRafId === null) {
					zoomRafId = requestAnimationFrame(() => {
						const cappedDelta =
							Math.sign(pendingZoomDelta) *
							Math.min(Math.abs(pendingZoomDelta), 30);
						const zoomFactor = Math.exp(-cappedDelta / 300);

						scaleZoom({ factor: zoomFactor });
						pendingZoomDelta = 0;
						zoomRafId = null;
					});
				}

				return;
			}

			if (!canPan) {
				return;
			}

			if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
				return;
			}

			event.preventDefault();
			pendingPanDeltaX += normalizedDeltaX;
			pendingPanDeltaY += normalizedDeltaY;

			if (panRafId === null) {
				panRafId = requestAnimationFrame(() => {
					panByScreenDelta({
						deltaX: pendingPanDeltaX,
						deltaY: pendingPanDeltaY,
					});
					pendingPanDeltaX = 0;
					pendingPanDeltaY = 0;
					panRafId = null;
				});
			}
		};

		container.addEventListener("wheel", onWheel, {
			capture: true,
			passive: false,
		});

		return () => {
			container.removeEventListener("wheel", onWheel, {
				capture: true,
			});
			if (zoomRafId !== null) {
				cancelAnimationFrame(zoomRafId);
			}
			if (panRafId !== null) {
				cancelAnimationFrame(panRafId);
			}
		};
	}, [canPan, panByScreenDelta, scaleZoom]);

	return (
		<PreviewViewportProvider value={viewport}>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="relative mx-2 mt-2 min-h-0 min-w-0 flex-1">
					{mostrarReglas ? (
						<Reglas
							onSacarGuia={(eje, event) =>
								empezarArrastreGuia({ eje, id: null, event })
							}
						/>
					) : null}
					<div
						className="absolute inset-0"
						style={
							mostrarReglas
								? { left: GROSOR_REGLA, top: GROSOR_REGLA }
								: undefined
						}
					>
						<ContextMenu>
							<ContextMenuTrigger asChild>
								<div
									ref={viewportRef}
									className="relative size-full min-h-0 min-w-0 overflow-hidden"
								>
									<div
										ref={canvasMountRef}
										className="absolute block"
										style={{
											left: viewport.sceneLeft,
											top: viewport.sceneTop,
											width: viewport.sceneWidth,
											height: viewport.sceneHeight,
											background:
												activeProject.settings.background.type === "blur"
													? "transparent"
													: activeProject?.settings.background.color,
										}}
									/>
									<PreviewOverlayLayer
										instances={overlayInstances}
										plane="under-interaction"
									/>
									<PreviewInteractionOverlay />
									<PreviewOverlayLayer
										instances={overlayInstances}
										plane="over-interaction"
									/>
									<LineasGuia
										proyecto={proyecto}
										lienzo={lienzo}
										arrastre={arrastre}
										onAgarrar={(guia, event) =>
											empezarArrastreGuia({ eje: guia.eje, id: guia.id, event })
										}
									/>
								</div>
							</ContextMenuTrigger>
							<PreviewContextMenu
								pantalla={pantalla}
								overlayControls={overlayControls}
								onOverlayVisibilityChange={onOverlayVisibilityChange}
							/>
						</ContextMenu>
					</div>
				</div>
				<PreviewToolbar pantalla={pantalla} />
			</div>
		</PreviewViewportProvider>
	);
}
