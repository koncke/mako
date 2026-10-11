"use client";

// =============================================================================
// El editor: la ventana de CapCut 9.3
// =============================================================================
// Barra superior (≈43 px) y debajo cuatro paneles, con las proporciones MEDIDAS
// sobre la captura oficial (relevamiento-capcut-armazon.md §1):
//
//   biblioteca 34,1 % · reproductor 34,5 % · propiedades 28,9 %   ← 63,6 % del alto
//   línea de tiempo                                                ← 30,5 % del alto
//
// Los paneles van redondeados (~7 px) sobre el fondo de la ventana (#141414), con
// 8 px entre ellos y 10 px de margen a los lados. Las separaciones SON los
// divisores: se arrastran, como en CapCut, y no dibujan ninguna línea. «Diseño ▾»
// de la barra superior mueve los cuatro de una (components/editor/diseno-paneles.ts).
//
// Cada panel va envuelto en un contenedor con el radio y `overflow-hidden`: el
// redondeado es de la DISTRIBUCIÓN, no de cada panel (que son de otros paquetes y
// no tienen por qué saber dónde están).

// Todas las funciones de la copia de CapCut se registran antes del primer dibujo.
import "@/app/video-editor/ce/extensiones";
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/app/video-editor/_opencut/components/ui/resizable";
import { AssetsPanel } from "@/app/video-editor/_opencut/components/editor/panels/assets";
import { PropertiesPanel } from "@/app/video-editor/_opencut/components/editor/panels/properties";
import { Timeline } from "@/app/video-editor/_opencut/timeline/components";
import { PreviewPanel } from "@/app/video-editor/_opencut/preview/components";
import { EditorHeader } from "@/app/video-editor/_opencut/components/editor/editor-header";
import { EditorProvider } from "@/app/video-editor/_opencut/components/providers/editor-provider";
import { MigrationDialog } from "@/app/video-editor/_opencut/project/components/migration-dialog";
import { usePanelStore } from "@/app/video-editor/_opencut/editor/panel-store";
import { usePasteMedia } from "@/app/video-editor/_opencut/media/use-paste-media";
import { MobileGate } from "@/app/video-editor/_opencut/components/editor/mobile-gate";
import { tamanosDe, useDisenoStore } from "@/app/video-editor/_opencut/components/editor/diseno-paneles";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { conEspacio } from "@/app/video-editor/espacio";
import {
	createPreviewOverlayControl,
	isPreviewOverlayVisible,
	mergePreviewOverlaySources,
} from "@/app/video-editor/_opencut/preview/overlays";
import { usePreviewStore } from "@/app/video-editor/_opencut/preview/preview-store";
import { getGuidePreviewOverlaySource } from "@/app/video-editor/_opencut/guides";
import {
	bookmarkNotesPreviewOverlay,
	getBookmarkPreviewOverlaySource,
} from "@/app/video-editor/_opencut/timeline/bookmarks/index";

export function EditorPage({ projectId }: { projectId: string }) {
	const editor = useEditor();
	// Salir por «atrás» del navegador (y no por «Volver a la página de inicio»)
	// también deja la miniatura del primer cuadro y el último cambio guardados:
	// sin esto, la tarjeta del inicio queda con el ícono genérico. Si ya se salió
	// por el menú, el proyecto está cerrado y prepareExit no hace nada.
	// ⚠️ Si lo que desmonta el editor es un cambio de cliente (`?ws=` distinto),
	// VideoEditorCliente ya fijó el espacio NUEVO: guardar ahora escribiría el
	// proyecto de un cliente en el almacenamiento de otro. Ahí no se guarda.
	useEffect(() => {
		const espacio = conEspacio("");
		return () => {
			if (conEspacio("") !== espacio) return;
			void editor.project.prepareExit().catch(() => {});
		};
	}, [editor]);

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<div className="flex h-full w-full flex-col overflow-hidden bg-(--cc-app)">
					<AvisoRenderDegradado />
					<EditorHeader />
					<div className="min-h-0 min-w-0 flex-1 px-[10px] pb-[10px]">
						<EditorLayout />
					</div>
					<MigrationDialog />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

/**
 * Sin WebGPU el motor dibuja por el camino lento (renderer.isDegraded). CapCut no
 * tiene este aviso, pero sin él la persona no sabe por qué el reproductor va a
 * los saltos: queda una franja fina que se cierra.
 */
function AvisoRenderDegradado() {
	const degradado = useEditor((e) => e.renderer.isDegraded);
	const [cerrado, setCerrado] = useState(false);
	if (!degradado || cerrado) return null;
	return (
		<div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-(--cc-panel) text-[11px] text-(--cc-text-3)">
			<span>Para la mejor experiencia, abre el editor en Chrome.</span>
			<button
				type="button"
				onClick={() => setCerrado(true)}
				aria-label="Cerrar"
				className="flex size-5 cursor-pointer items-center justify-center rounded-[3px] hover:bg-(--cc-raised)"
			>
				<HugeiconsIcon icon={Cancel01Icon} className="size-3" />
			</button>
		</div>
	);
}

/** El redondeado y el fondo de CapCut alrededor de cada panel. */
function Marco({ children }: { children: React.ReactNode }) {
	return <div className="size-full min-h-0 min-w-0 overflow-hidden rounded-[7px] bg-(--cc-panel)">{children}</div>;
}

/** Los divisores son las separaciones de 8 px (7 px entre arriba y la línea de tiempo), sin línea. */
const DIVISOR_VERTICAL = "w-2 shrink-0 bg-transparent after:w-2 hover:bg-white/5";
const DIVISOR_HORIZONTAL =
	"data-[panel-group-direction=vertical]:h-[7px] data-[panel-group-direction=vertical]:after:h-[7px] hover:bg-white/5";

function EditorLayout() {
	usePasteMedia();
	const { panels, setPanel } = usePanelStore();
	const pedido = useDisenoStore((s) => s.pedido);
	const diseno = useDisenoStore((s) => s.diseno);
	const grupoVertical = useRef<ImperativePanelGroupHandle>(null);
	const grupoHorizontal = useRef<ImperativePanelGroupHandle>(null);

	// «Diseño ▾» / «Restablecer diseño actual»: mueve los divisores a la plantilla.
	// `pedido` arranca en 0 y sólo sube con un clic: al montar manda lo guardado.
	useEffect(() => {
		if (pedido === 0) return;
		const t = tamanosDe(diseno);
		grupoVertical.current?.setLayout([t.mainContent, t.timeline]);
		grupoHorizontal.current?.setLayout([t.tools, t.preview, t.properties]);
	}, [pedido, diseno]);

	const activeScene = useEditor((editor) =>
		editor.scenes.getActiveSceneOrNull(),
	);
	const currentTime = useEditor((editor) => editor.playback.getCurrentTime());
	const activeGuide = usePreviewStore((state) => state.activeGuide);
	const overlays = usePreviewStore((state) => state.overlays);
	const setOverlayVisibility = usePreviewStore(
		(state) => state.setOverlayVisibility,
	);
	const showBookmarkNotes = isPreviewOverlayVisible({
		overlay: bookmarkNotesPreviewOverlay,
		overlays,
	});

	const overlaySource = useMemo(
		() =>
			mergePreviewOverlaySources({
				sources: [
					getGuidePreviewOverlaySource({
						guideId: activeGuide,
					}),
					activeScene
						? getBookmarkPreviewOverlaySource({
								bookmarks: activeScene.bookmarks,
								time: currentTime,
								isVisible: showBookmarkNotes,
							})
						: {
								definitions: [bookmarkNotesPreviewOverlay],
								instances: [],
							},
				],
			}),
		[activeGuide, activeScene, currentTime, showBookmarkNotes],
	);

	const overlayControls = useMemo(
		() =>
			overlaySource.definitions.map((overlay) =>
				createPreviewOverlayControl({ overlay, overlays }),
			),
		[overlaySource.definitions, overlays],
	);

	return (
		<ResizablePanelGroup
			ref={grupoVertical}
			direction="vertical"
			className="size-full"
			onLayout={(sizes) => {
				setPanel({ panel: "mainContent", size: sizes[0] ?? panels.mainContent });
				setPanel({ panel: "timeline", size: sizes[1] ?? panels.timeline });
			}}
		>
			<ResizablePanel
				defaultSize={panels.mainContent}
				minSize={30}
				maxSize={85}
				className="min-h-0"
			>
				<ResizablePanelGroup
					ref={grupoHorizontal}
					direction="horizontal"
					className="size-full"
					onLayout={(sizes) => {
						setPanel({ panel: "tools", size: sizes[0] ?? panels.tools });
						setPanel({ panel: "preview", size: sizes[1] ?? panels.preview });
						setPanel({ panel: "properties", size: sizes[2] ?? panels.properties });
					}}
				>
					<ResizablePanel defaultSize={panels.tools} minSize={15} maxSize={55} className="min-w-0">
						<Marco>
							<AssetsPanel />
						</Marco>
					</ResizablePanel>

					<ResizableHandle className={DIVISOR_VERTICAL} />

					<ResizablePanel defaultSize={panels.preview} minSize={18} className="min-h-0 min-w-0 flex-1">
						<Marco>
							<PreviewPanel
								overlayControls={overlayControls}
								overlayInstances={overlaySource.instances}
								onOverlayVisibilityChange={setOverlayVisibility}
							/>
						</Marco>
					</ResizablePanel>

					<ResizableHandle className={DIVISOR_VERTICAL} />

					<ResizablePanel defaultSize={panels.properties} minSize={15} maxSize={55} className="min-w-0">
						<Marco>
							<PropertiesPanel />
						</Marco>
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>

			<ResizableHandle className={DIVISOR_HORIZONTAL} />

			<ResizablePanel
				defaultSize={panels.timeline}
				minSize={15}
				maxSize={70}
				className="min-h-0"
			>
				<Marco>
					<Timeline />
				</Marco>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
