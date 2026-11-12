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
// Los paneles van redondeados (~7 px) sobre el fondo de la ventana (`--bg` de MaKo desde el 29/10/2026), con
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
import { DialogoReemplazar } from "@/app/video-editor/_opencut/reemplazo/dialogo-reemplazar";
import { usePanelStore } from "@/app/video-editor/_opencut/editor/panel-store";
import { usePasteMedia } from "@/app/video-editor/_opencut/media/use-paste-media";
import { MobileGate } from "@/app/video-editor/_opencut/components/editor/mobile-gate";
import { tamanosDe, useDisenoStore } from "@/app/video-editor/_opencut/components/editor/diseno-paneles";
import { minimosDePaneles } from "@/app/video-editor/_opencut/components/editor/minimos-paneles";
import { useAncho } from "@/app/video-editor/_opencut/hooks/use-ancho";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { StoragePersistenceDialog } from "@/app/video-editor/_opencut/services/storage/components/storage-persistence-dialog";
import { iniciarEspejo } from "@/app/video-editor/_opencut/chat/espejo";
import { iniciarPropuestas } from "@/app/video-editor/_opencut/chat/propuestas";
import { CursoresAgentes } from "@/app/video-editor/_opencut/enjambre/components/cursores";
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
import { ZERO_MEDIA_TIME } from "@/app/video-editor/_opencut/wasm";

/** Si algún marcador tiene una nota escrita (lo único que muestra la capa de notas del reproductor). */
function hayNotasDeMarcador(bookmarks: ReadonlyArray<{ note?: string | null }> | undefined): boolean {
	return !!bookmarks?.some((b) => b.note != null && b.note.trim() !== "");
}

export function EditorPage({ projectId, propuesta = null }: { projectId: string; propuesta?: string | null }) {
	const editor = useEditor();
	// Salir por «atrás» del navegador (y no por «Volver a la página de inicio»)
	// también deja la miniatura del primer cuadro y el último cambio guardados:
	// sin esto, la tarjeta del inicio queda con el ícono genérico. Si ya se salió
	// por el menú, el proyecto está cerrado y prepareExit no hace nada.
	// ⚠️ Si lo que desmonta el editor es un cambio de cliente (`?ws=` distinto),
	// VideoEditorCliente ya fijó el espacio NUEVO: guardar ahora escribiría el
	// proyecto de un cliente en el almacenamiento de otro. Ahí no se guarda.
	// ⚠️ En desarrollo React (Strict Mode) desmonta y vuelve a montar cada efecto
	// enseguida de montarlo: eso NO es salir. Pasó (11/10/2026): al entrar desde
	// el inicio corría prepareExit antes de inicializar la GPU y quedaba en la
	// consola «Failed to generate project thumbnail on exit: GPU context not
	// initialized». Por eso la salida se mira una microtarea después: si el
	// editor volvió a montarse, no se salió.
	const montado = useRef(false);
	useEffect(() => {
		montado.current = true;
		const espacio = conEspacio("");
		return () => {
			montado.current = false;
			if (conEspacio("") !== espacio) return;
			queueMicrotask(() => {
				if (montado.current) return;
				void editor.project.prepareExit().catch(() => {});
			});
		};
	}, [editor]);

	// La copia de lectura del proyecto, para la API de MaKo: se sube un rato después de cada cambio (chat/espejo.ts).
	useEffect(() => iniciarEspejo(editor), [editor]);
	// Lo que la API propuso en este proyecto (por WhatsApp, por la API): aparece en el chat para aceptarlo (chat/propuestas.ts).
	// Con `?propuesta=` (el «Aceptar en el editor» del Ops Center), el chat abre en ÉSA.
	useEffect(() => iniciarPropuestas(editor, { foco: propuesta, proyecto: projectId }), [editor, propuesta, projectId]);

	return (
		<MobileGate>
			<EditorProvider projectId={projectId} propuesta={propuesta}>
				<div className="flex h-full w-full flex-col overflow-hidden bg-(--cc-app)">
					<AvisoRenderDegradado />
					<EditorHeader />
					{/* Los paneles van en una caja `absolute inset-0`: un `size-full` contra el alto
					    de un hijo flex no resuelve en Safari y el editor quedaría en cero (AGENTS.md). */}
					{/* «Editar con IA» ya no es una columna acá: es la tarjeta izquierda de la pantalla de Create, siempre abierta
					    (VideoEditorCliente → PantallaCrear, 29/10/2026). */}
					<div className="relative min-h-0 min-w-0 flex-1 mx-[10px] mb-[10px]">
						<div className="absolute inset-0">
							<EditorLayout />
						</div>
					</div>
					<MigrationDialog />
					{/* Pedir que el navegador no borre los proyectos cuando le falta espacio (lo hacía la portada de CapCut, que se
					    borró el 29/10/2026): en Chrome se pide callado; en Firefox, con el diálogo. */}
					<StoragePersistenceDialog />
					{/* «Reemplazar el clip» / «Sustituir» (reemplazo/): uno solo, lo abre la línea de tiempo. */}
					<DialogoReemplazar />
					{/* Los cursores de los agentes de la «Edición automática», mientras trabajan (enjambre/). */}
					<CursoresAgentes />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

/**
 * `renderer.isDegraded` = el navegador no tiene NI WebGPU NI WebGL2, y entonces NO
 * hay vista previa (el reproductor no monta el compositor, ver preview/components).
 * El aviso decía «abre el editor en Chrome» —suponía un camino lento que no
 * existe— y se lo mostraba a gente que ya estaba en Chrome con la aceleración de
 * gráficos caída (tarjeta #853, 17/10/2026). Ahora dice lo que destraba.
 */
function AvisoRenderDegradado() {
	const degradado = useEditor((e) => e.renderer.isDegraded);
	const [cerrado, setCerrado] = useState(false);
	if (!degradado || cerrado) return null;
	return (
		<div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-(--cc-panel) text-[11px] text-(--cc-text-3)">
			<span>La vista previa necesita la aceleración de gráficos: reinicia el navegador.</span>
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

/**
 * El redondeado, el fondo y el borde de MaKo alrededor de cada panel. `zona` nombra el panel para lo que tiene que
 * encontrarlo en la pantalla (los cursores de la «Edición automática», enjambre/cursores.ts).
 */
function Marco({ children, zona }: { children: React.ReactNode; zona: "biblioteca" | "reproductor" | "propiedades" | "linea" }) {
	return (
		<div data-ce-zona={zona} className="size-full min-h-0 min-w-0 overflow-hidden rounded-[7px] bg-(--cc-panel) shadow-[0_0_0_1px_var(--border)]">
			{children}
		</div>
	);
}

/** Los divisores son las separaciones de 8 px (7 px entre arriba y la línea de tiempo), sin línea. */
const DIVISOR_VERTICAL = "w-2 shrink-0 bg-transparent after:w-2 hover:bg-(--velo-hover)";
const DIVISOR_HORIZONTAL =
	"data-[panel-group-direction=vertical]:h-[7px] data-[panel-group-direction=vertical]:after:h-[7px] hover:bg-(--velo-hover)";

function EditorLayout() {
	usePasteMedia();
	const { panels, setPanel } = usePanelStore();
	const pedido = useDisenoStore((s) => s.pedido);
	const diseno = useDisenoStore((s) => s.diseno);
	const grupoVertical = useRef<ImperativePanelGroupHandle>(null);
	const grupoHorizontal = useRef<ImperativePanelGroupHandle>(null);
	// Los mínimos de los paneles de arriba en PÍXELES (components/editor/minimos-paneles.ts), pasados a % con el ancho medido.
	const zona = useRef<HTMLDivElement>(null);
	const minimos = minimosDePaneles(useAncho(zona));

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
	const activeGuide = usePreviewStore((state) => state.activeGuide);
	const overlays = usePreviewStore((state) => state.overlays);
	const setOverlayVisibility = usePreviewStore(
		(state) => state.setOverlayVisibility,
	);
	const showBookmarkNotes = isPreviewOverlayVisible({
		overlay: bookmarkNotesPreviewOverlay,
		overlays,
	});
	// ⚠️ El tiempo del cabezal, SÓLO si se ven las notas de los marcadores y hay alguna (es lo único que lo usa:
	// getBookmarkPreviewOverlaySource no dibuja nada sin eso). Esta es la RAÍZ del editor: leerlo siempre la
	// redibujaba ENTERA —biblioteca, reproductor, propiedades y línea de tiempo, con sus ~90 tooltips y menús— en
	// cada salto del cabezal (cada movimiento del mouse al arrastrarlo) y en cada aviso de CUALQUIER manager mientras
	// se reproduce, porque `useEditor` escucha a los nueve (editor/use-editor.ts). Martín, 12/11/2026: «se me traba
	// exageradamente todo... ni siquiera lo puedo utilizar» (docs/hallazgos-video-editor.md).
	const currentTime = useEditor((editor) =>
		showBookmarkNotes && hayNotasDeMarcador(editor.scenes.getActiveSceneOrNull()?.bookmarks)
			? editor.playback.getCurrentTime()
			: ZERO_MEDIA_TIME,
	);

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
		<div ref={zona} className="size-full">
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
					<ResizablePanel defaultSize={panels.tools} minSize={minimos.tools} maxSize={55} className="min-w-0">
						<Marco zona="biblioteca">
							<AssetsPanel />
						</Marco>
					</ResizablePanel>

					<ResizableHandle className={DIVISOR_VERTICAL} />

					<ResizablePanel defaultSize={panels.preview} minSize={minimos.preview} className="min-h-0 min-w-0 flex-1">
						<Marco zona="reproductor">
							<PreviewPanel
								overlayControls={overlayControls}
								overlayInstances={overlaySource.instances}
								onOverlayVisibilityChange={setOverlayVisibility}
							/>
						</Marco>
					</ResizablePanel>

					<ResizableHandle className={DIVISOR_VERTICAL} />

					<ResizablePanel defaultSize={panels.properties} minSize={minimos.properties} maxSize={55} className="min-w-0">
						<Marco zona="propiedades">
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
				<Marco zona="linea">
					<Timeline />
				</Marco>
			</ResizablePanel>
		</ResizablePanelGroup>
		</div>
	);
}
