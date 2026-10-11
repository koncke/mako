"use client";

// =============================================================================
// Multimedia › Importar: lo que el usuario trajo (videos, fotos, audios)
// =============================================================================
// Como CapCut: sin archivos, la zona punteada «⊕ Importar — Arrastra y suelta…»;
// con archivos, una barra (Importar · filtro · Ordenar · vista) y la grilla de
// miniaturas con la duración arriba a la derecha, «Agregado» si ya está en la
// línea de tiempo, el ⊕ cian al pasar el mouse y, en los videos, la
// previsualización al pasar (scrub: la posición del mouse elige el cuadro).
// Arrastrar una miniatura la suelta en la línea de tiempo; soltar archivos del
// sistema en cualquier parte del panel los importa.

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
	AddCircleIcon,
	ArrowDown01Icon,
	GridViewIcon,
	Image02Icon,
	LeftToRightListDashIcon,
	MusicNote03Icon,
	SortingOneNineIcon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import {
	type FiltroMedios,
	type MediaSortKey,
	useAssetsPanelStore,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import {
	VacioBiblioteca,
	ZonaImportar,
	formatearDuracion,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { invokeAction } from "@/app/video-editor/_opencut/actions";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useImportarArchivos } from "@/app/video-editor/_opencut/media/importar";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { useFileUpload } from "@/app/video-editor/_opencut/media/use-file-upload";
import {
	SelectableItem,
	SelectableSurface,
	useSelection,
	useSelectionScope,
} from "@/app/video-editor/_opencut/selection";
import { MASKABLE_ELEMENT_TYPES, type TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/app/video-editor/_opencut/timeline/creation";
import { buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { mediaTimeFromSeconds, type MediaTime } from "@/app/video-editor/_opencut/wasm";

export const TEXTO_ZONA_MEDIOS =
	"Arrastra y suelta los videos, las fotos y los archivos de audio aquí";

const FILTROS: { id: FiltroMedios; etiqueta: string; vacio: string }[] = [
	{ id: "todos", etiqueta: "Todos", vacio: "No se encontraron resultados" },
	{ id: "video", etiqueta: "Videos", vacio: "Aún no hay videos" },
	{ id: "image", etiqueta: "Fotos", vacio: "Aún no hay ninguna imagen" },
	{ id: "audio", etiqueta: "Audio", vacio: "Aún no hay audios" },
];

const ORDENES: { id: MediaSortKey; etiqueta: string }[] = [
	{ id: "name", etiqueta: "Nombre" },
	{ id: "type", etiqueta: "Tipo" },
	{ id: "duration", etiqueta: "Duración" },
	{ id: "size", etiqueta: "Tamaño" },
];

/** Los ids de los medios que usa la escena activa (ordenados: el selector compara arrays). */
export function idsMediosEnLinea(editor: EditorCore): string[] {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena) return [];
	const ids = new Set<string>();
	const pistas = [escena.tracks.main, ...escena.tracks.overlay, ...escena.tracks.audio];
	for (const pista of pistas) {
		for (const elemento of pista.elements as TimelineElement[]) {
			if ("mediaId" in elemento && typeof elemento.mediaId === "string") {
				ids.add(elemento.mediaId);
			}
		}
	}
	return [...ids].sort();
}

/** Inserta un medio en el cabezal (lo que hace el ⊕ de CapCut). */
export function agregarMedioEnCabezal({
	editor,
	asset,
	startTime,
}: {
	editor: EditorCore;
	asset: MediaAsset;
	startTime: MediaTime;
}) {
	const duration =
		asset.duration != null
			? mediaTimeFromSeconds({ seconds: asset.duration })
			: DEFAULT_NEW_ELEMENT_DURATION;
	editor.timeline.insertElement({
		element: buildElementFromMedia({
			mediaId: asset.id,
			mediaType: asset.type,
			name: asset.name,
			duration,
			startTime,
		}),
		placement: { mode: "auto" },
	});
}

export function MediaView() {
	const mediaFiles = useEditor((e) => e.media.getAssets());
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const usados = useEditor(idsMediosEnLinea);

	const mediaViewMode = useAssetsPanelStore((s) => s.mediaViewMode);
	const highlightMediaId = useAssetsPanelStore((s) => s.highlightMediaId);
	const clearHighlight = useAssetsPanelStore((s) => s.clearHighlight);
	const mediaSortBy = useAssetsPanelStore((s) => s.mediaSortBy);
	const mediaSortOrder = useAssetsPanelStore((s) => s.mediaSortOrder);
	const filtroMedios = useAssetsPanelStore((s) => s.filtroMedios);

	const { importar, procesando, progreso } = useImportarArchivos();
	const { isDragOver, dragProps, openFilePicker, fileInputProps } = useFileUpload({
		accept: "image/*,video/*,audio/*",
		multiple: true,
		onFilesSelected: (files) => void importar({ files }),
	});

	const handleRemove = ({ ids }: { ids: string[] }) => {
		if (!activeProject) return;
		invokeAction("remove-media-assets", {
			projectId: activeProject.metadata.id,
			assetIds: ids,
		});
	};

	const propios = useMemo(
		() => mediaFiles.filter((item) => !item.ephemeral),
		[mediaFiles],
	);

	const visibles = useMemo(() => {
		const filtrados =
			filtroMedios === "todos"
				? [...propios]
				: propios.filter((item) => item.type === filtroMedios);
		const signo = mediaSortOrder === "asc" ? 1 : -1;
		filtrados.sort((a, b) => {
			const valor = (item: MediaAsset): string | number => {
				switch (mediaSortBy) {
					case "name":
						return item.name.toLowerCase();
					case "type":
						return item.type;
					case "duration":
						return item.duration ?? 0;
					case "size":
						return item.file.size;
				}
			};
			const va = valor(a);
			const vb = valor(b);
			return va < vb ? -signo : va > vb ? signo : 0;
		});
		return filtrados;
	}, [propios, filtroMedios, mediaSortBy, mediaSortOrder]);

	const orderedMediaIds = useMemo(() => visibles.map((item) => item.id), [visibles]);
	const usadosSet = useMemo(() => new Set(usados), [usados]);
	const vacioFiltro = FILTROS.find((f) => f.id === filtroMedios)?.vacio ?? "";

	return (
		<div className="relative flex h-full min-h-0 flex-col" {...dragProps}>
			<input {...fileInputProps} />

			{propios.length === 0 ? (
				<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
					<ZonaImportar
						texto={TEXTO_ZONA_MEDIOS}
						onClick={openFilePicker}
						procesando={procesando}
						progreso={progreso}
						resaltada={isDragOver}
					/>
				</div>
			) : (
				<>
					<BarraMedios
						onImportar={openFilePicker}
						procesando={procesando}
						progreso={progreso}
					/>
					<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
						{visibles.length === 0 ? (
							<VacioBiblioteca texto={vacioFiltro} />
						) : (
							<SelectableSurface
								ariaLabel="Multimedia"
								orderedIds={orderedMediaIds}
								revealId={highlightMediaId}
								onRevealComplete={clearHighlight}
							>
								<MediaScopeRegistrar />
								<ListaMedios
									items={visibles}
									modo={mediaViewMode}
									usados={usadosSet}
									onRemove={handleRemove}
								/>
							</SelectableSurface>
						)}
					</div>
					{isDragOver && (
						<div className="pointer-events-none absolute inset-2 z-20">
							<ZonaImportar
								texto={TEXTO_ZONA_MEDIOS}
								onClick={openFilePicker}
								resaltada
								className="h-full bg-[var(--cc-panel)]/95"
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}

function MediaScopeRegistrar() {
	useSelectionScope();
	return null;
}

// ── Barra de arriba: Importar · Todos ▾ · Ordenar · Cuadrícula/Lista ─────────

function BarraMedios({
	onImportar,
	procesando,
	progreso,
}: {
	onImportar: () => void;
	procesando: boolean;
	progreso: number;
}) {
	const mediaViewMode = useAssetsPanelStore((s) => s.mediaViewMode);
	const setMediaViewMode = useAssetsPanelStore((s) => s.setMediaViewMode);
	const mediaSortBy = useAssetsPanelStore((s) => s.mediaSortBy);
	const mediaSortOrder = useAssetsPanelStore((s) => s.mediaSortOrder);
	const setMediaSort = useAssetsPanelStore((s) => s.setMediaSort);
	const filtroMedios = useAssetsPanelStore((s) => s.filtroMedios);
	const setFiltroMedios = useAssetsPanelStore((s) => s.setFiltroMedios);

	const filtroActual = FILTROS.find((f) => f.id === filtroMedios) ?? FILTROS[0];

	return (
		<div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
			<button
				type="button"
				onClick={onImportar}
				disabled={procesando}
				className="flex h-7 cursor-pointer items-center gap-1.5 rounded-[4px] bg-[var(--cc-raised)] px-2.5 text-[12px] text-[var(--cc-text)] hover:bg-[var(--cc-btn-2)] disabled:cursor-default disabled:opacity-70"
			>
				<HugeiconsIcon icon={AddCircleIcon} className="size-3.5" />
				{procesando ? `Importando… ${progreso} %` : "Importar"}
			</button>

			<div className="ml-auto flex items-center gap-1">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex h-7 cursor-pointer items-center gap-1 rounded-[4px] px-2 text-[12px] text-[var(--cc-text-2)] hover:bg-[var(--cc-raised)] hover:text-[var(--cc-text)]"
						>
							{filtroActual.etiqueta}
							<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{FILTROS.map((filtro) => (
							<DropdownMenuItem
								key={filtro.id}
								onClick={() => setFiltroMedios(filtro.id)}
								className={cn(filtro.id === filtroMedios && "text-primary")}
							>
								{filtro.etiqueta}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<BotonIcono etiqueta="Ordenar" icono={SortingOneNineIcon} />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel className="text-[11px] text-[var(--cc-text-3)]">
							Ordenar por
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{ORDENES.map((orden) => {
							const activo = orden.id === mediaSortBy;
							return (
								<DropdownMenuItem
									key={orden.id}
									onClick={() =>
										setMediaSort({
											key: orden.id,
											order: activo && mediaSortOrder === "asc" ? "desc" : "asc",
										})
									}
									className={cn(activo && "text-primary")}
								>
									{orden.etiqueta}
									{activo && (
										<span className="ml-auto pl-3">
											{mediaSortOrder === "asc" ? "↑" : "↓"}
										</span>
									)}
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>

				<BotonIcono
					etiqueta={mediaViewMode === "grid" ? "Lista" : "Cuadrícula"}
					icono={mediaViewMode === "grid" ? LeftToRightListDashIcon : GridViewIcon}
					onClick={() => setMediaViewMode(mediaViewMode === "grid" ? "list" : "grid")}
				/>
			</div>
		</div>
	);
}

function BotonIcono({
	etiqueta,
	icono,
	...resto
}: {
	etiqueta: string;
	icono: IconSvgElement;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			aria-label={etiqueta}
			title={etiqueta}
			className="flex size-7 cursor-pointer items-center justify-center rounded-[4px] text-[var(--cc-text-2)] hover:bg-[var(--cc-raised)] hover:text-[var(--cc-text)]"
			{...resto}
		>
			<HugeiconsIcon icon={icono} className="size-4" />
		</button>
	);
}

// ── La grilla / lista ────────────────────────────────────────────────────────

function ListaMedios({
	items,
	modo,
	usados,
	onRemove,
}: {
	items: MediaAsset[];
	modo: "grid" | "list";
	usados: Set<string>;
	onRemove: (args: { ids: string[] }) => void;
}) {
	const esGrilla = modo === "grid";
	return (
		<div
			className={cn(esGrilla ? "grid gap-x-2 gap-y-3" : "flex flex-col gap-0.5")}
			style={
				esGrilla
					? { gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }
					: undefined
			}
		>
			{items.map((item) => (
				<MenuMedio item={item} onRemove={onRemove} key={item.id}>
					<SelectableItem className={cn("rounded-[4px]", !esGrilla && "w-full")} id={item.id}>
						<TarjetaMedio item={item} grilla={esGrilla} agregado={usados.has(item.id)} />
					</SelectableItem>
				</MenuMedio>
			))}
		</div>
	);
}

function MenuMedio({
	item,
	children,
	onRemove,
}: {
	item: MediaAsset;
	children: React.ReactNode;
	onRemove: (args: { ids: string[] }) => void;
}) {
	const { isSelected, selectedIds } = useSelection();
	const ids = isSelected(item.id) ? selectedIds : [item.id];

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem
					variant="destructive"
					icon={<IconoBorrar size={14} />}
					onClick={(event: React.MouseEvent<HTMLDivElement>) => {
						event.stopPropagation();
						onRemove({ ids });
					}}
				>
					{ids.length > 1 ? `Eliminar (${ids.length})` : "Eliminar"}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function TarjetaMedio({
	item,
	grilla,
	agregado,
}: {
	item: MediaAsset;
	grilla: boolean;
	agregado: boolean;
}) {
	const editor = useEditor();

	return (
		<DraggableItem
			name={item.name}
			preview={<MiniaturaMedio item={item} scrub={grilla} />}
			dragData={{
				id: item.id,
				type: "media",
				mediaType: item.type,
				name: item.name,
				...(item.type !== "audio" && {
					targetElementTypes: [...MASKABLE_ELEMENT_TYPES],
				}),
			}}
			onAddToTimeline={({ currentTime }) =>
				agregarMedioEnCabezal({ editor, asset: item, startTime: currentTime })
			}
			aspectRatio={1}
			variant={grilla ? "card" : "compact"}
			containerClassName="w-full"
			insignias={
				grilla ? (
					<>
						{item.type !== "image" && item.duration ? (
							<span className="pointer-events-none absolute top-1 right-1 rounded-[3px] bg-black/60 px-1 text-[10px] leading-4 text-white tabular-nums">
								{formatearDuracion(item.duration)}
							</span>
						) : null}
						{agregado && (
							<span className="pointer-events-none absolute top-1 left-1 rounded-[3px] bg-black/60 px-1 text-[10px] leading-4 text-white">
								Agregado
							</span>
						)}
					</>
				) : undefined
			}
		/>
	);
}

// ── Miniaturas ───────────────────────────────────────────────────────────────

function MiniaturaMedio({ item, scrub }: { item: MediaAsset; scrub: boolean }) {
	if (item.type === "video") {
		return <MiniaturaVideo item={item} scrub={scrub} />;
	}
	if (item.type === "image" && (item.thumbnailUrl || item.url)) {
		return (
			<div className="relative size-full">
				<Image
					src={item.thumbnailUrl ?? item.url ?? ""}
					alt={item.name}
					fill
					sizes="128px"
					className="object-cover"
					loading="lazy"
					draggable={false}
					unoptimized
				/>
			</div>
		);
	}
	return (
		<Marcador
			icono={item.type === "audio" ? MusicNote03Icon : Image02Icon}
			audio={item.type === "audio"}
		/>
	);
}

function Marcador({ icono, audio }: { icono: IconSvgElement; audio?: boolean }) {
	return (
		<div
			className={cn(
				"flex size-full items-center justify-center text-[var(--cc-text-2)]",
				audio ? "bg-[var(--cc-clip-audio)]" : "bg-[var(--cc-sunken)]",
			)}
		>
			<HugeiconsIcon icon={icono} className="size-6" />
		</div>
	);
}

/**
 * La miniatura de un video que se previsualiza al pasar el mouse: el ancho de la
 * tarjeta es la duración del clip y la posición del puntero elige el cuadro. El
 * <video> se monta sólo mientras el mouse está encima (un video por miniatura
 * dejaría decenas de decodificadores abiertos) y sólo se ve cuando ya buscó el
 * primer cuadro, para no parpadear en negro.
 */
function MiniaturaVideo({ item, scrub }: { item: MediaAsset; scrub: boolean }) {
	const [encima, setEncima] = useState(false);
	const [fraccion, setFraccion] = useState<number | null>(null);
	const [listo, setListo] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const buscando = useRef(false);
	const pendiente = useRef<number | null>(null);

	const buscar = useCallback((segundos: number) => {
		const video = videoRef.current;
		if (!video || video.readyState < 1) {
			pendiente.current = segundos;
			return;
		}
		// Una búsqueda por vez: si el mouse se mueve más rápido que el decodificador,
		// gana la última posición, no la cola entera.
		if (buscando.current) {
			pendiente.current = segundos;
			return;
		}
		buscando.current = true;
		video.currentTime = segundos;
	}, []);

	const alBuscar = () => {
		buscando.current = false;
		setListo(true);
		if (pendiente.current != null) {
			const siguiente = pendiente.current;
			pendiente.current = null;
			buscar(siguiente);
		}
	};

	const puedeScrub = scrub && Boolean(item.url) && Boolean(item.duration);

	return (
		<div
			className="relative size-full"
			onMouseEnter={() => puedeScrub && setEncima(true)}
			onMouseLeave={() => {
				setEncima(false);
				setListo(false);
				setFraccion(null);
				buscando.current = false;
				pendiente.current = null;
			}}
			onMouseMove={(event) => {
				if (!puedeScrub || !item.duration) return;
				const caja = event.currentTarget.getBoundingClientRect();
				const f = Math.min(1, Math.max(0, (event.clientX - caja.left) / caja.width));
				setFraccion(f);
				// Nunca el último cuadro exacto: algunos contenedores no lo pueden decodificar.
				buscar(Math.min(f * item.duration, Math.max(0, item.duration - 0.05)));
			}}
		>
			{item.thumbnailUrl ? (
				<Image
					src={item.thumbnailUrl}
					alt={item.name}
					fill
					sizes="128px"
					className="object-cover"
					loading="lazy"
					draggable={false}
					unoptimized
				/>
			) : (
				<Marcador icono={Video01Icon} />
			)}
			{encima && item.url && (
				<video
					ref={videoRef}
					src={item.url}
					muted
					playsInline
					preload="auto"
					disablePictureInPicture
					onLoadedMetadata={() => {
						if (pendiente.current != null) {
							const primero = pendiente.current;
							pendiente.current = null;
							buscar(primero);
						}
					}}
					onSeeked={alBuscar}
					className={cn(
						"pointer-events-none absolute inset-0 size-full object-cover",
						listo ? "opacity-100" : "opacity-0",
					)}
				/>
			)}
			{encima && fraccion != null && (
				<span
					className="pointer-events-none absolute inset-y-0 w-px bg-white/90"
					style={{ left: `${fraccion * 100}%` }}
				/>
			)}
		</div>
	);
}
