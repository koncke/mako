"use client";

// =============================================================================
// Una tarjeta de la biblioteca que se arrastra a la línea de tiempo
// =============================================================================
// La usan todas las pestañas (Multimedia, Texto, Stickers, Efectos…). Como en
// CapCut: miniatura con el nombre debajo, botón ⊕ cian al pasar el mouse
// («Agregar a la línea de tiempo», en el cabezal) y arrastre a la línea de tiempo.
// El arrastre usa el `dragSource` del motor y dibuja su propio fantasma (la
// miniatura) porque el del navegador sale traslúcido y con el tamaño de la tarjeta.
//
// `useArrastreLinea` es lo mismo sin la tarjeta, para los renglones que no son
// miniaturas (la lista de audios).

import { portalCe } from "@/app/video-editor/portal";
import { Plus } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AspectRatio } from "@/app/video-editor/_opencut/components/ui/aspect-ratio";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { TimelineDragData } from "@/app/video-editor/_opencut/timeline/drag";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export const ROTULO_AGREGAR = "Agregar a la línea de tiempo";

/** Un gif de 1×1 transparente: esconde el fantasma del navegador. */
const IMAGEN_VACIA =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

let imagenVacia: HTMLImageElement | null = null;
function fantasmaVacio(): HTMLImageElement {
	if (!imagenVacia) {
		imagenVacia = new window.Image();
		imagenVacia.src = IMAGEN_VACIA;
	}
	return imagenVacia;
}

/** El arrastre a la línea de tiempo, para cualquier elemento de la biblioteca. */
export function useArrastreLinea({
	dragData,
	fantasma,
	habilitado = true,
	onDragStart,
}: {
	dragData: TimelineDragData;
	/** Lo que se dibuja pegado al puntero mientras se arrastra. */
	fantasma: ReactNode;
	habilitado?: boolean;
	onDragStart?: (event: React.DragEvent) => void;
}) {
	const editor = useEditor();
	const [arrastrando, setArrastrando] = useState(false);
	const [posicion, setPosicion] = useState({ x: 0, y: 0 });

	useEffect(() => {
		if (!arrastrando) return;
		const seguir = (event: DragEvent) => setPosicion({ x: event.clientX, y: event.clientY });
		document.addEventListener("dragover", seguir);
		return () => document.removeEventListener("dragover", seguir);
	}, [arrastrando]);

	const props = habilitado
		? {
				draggable: true,
				onDragStart: (event: React.DragEvent) => {
					event.dataTransfer.setDragImage(fantasmaVacio(), 0, 0);
					editor.timeline.dragSource.begin({
						dataTransfer: event.dataTransfer,
						dragData,
					});
					setPosicion({ x: event.clientX, y: event.clientY });
					setArrastrando(true);
					onDragStart?.(event);
				},
				onDragEnd: () => {
					setArrastrando(false);
					editor.timeline.dragSource.end();
				},
			}
		: {};

	const nodoFantasma =
		habilitado && arrastrando && typeof document !== "undefined"
			? createPortal(
					<div
						className="pointer-events-none fixed z-9999"
						style={{ left: posicion.x - 36, top: posicion.y - 36 }}
					>
						<div className="size-[72px] overflow-hidden rounded-[6px] shadow-2xl ring-2 ring-primary [&_img]:size-full [&_img]:object-cover">
							{fantasma}
						</div>
					</div>,
					portalCe() ?? document.body,
				)
			: null;

	return { arrastrando, props, fantasma: nodoFantasma };
}

export interface DraggableItemProps {
	name: string;
	preview: ReactNode;
	dragData: TimelineDragData;
	onDragStart?: ({ e }: { e: React.DragEvent }) => void;
	onAddToTimeline?: ({ currentTime }: { currentTime: MediaTime }) => void;
	/** Clic en la miniatura (no en el ⊕). Texto y Stickers lo usan para agregar. */
	onClick?: () => void;
	aspectRatio?: number;
	className?: string;
	containerClassName?: string;
	/** Se conserva por compatibilidad: el fantasma ya no lleva ⊕. */
	shouldShowPlusOnDrag?: boolean;
	shouldShowLabel?: boolean;
	isRounded?: boolean;
	variant?: "card" | "compact";
	isDraggable?: boolean;
	/** Lo que va encima de la miniatura (duración, «Agregado»…). */
	insignias?: ReactNode;
}

export function DraggableItem({
	name,
	preview,
	dragData,
	onDragStart,
	onAddToTimeline,
	onClick,
	aspectRatio = 16 / 9,
	className = "",
	containerClassName,
	shouldShowLabel = true,
	isRounded = true,
	variant = "card",
	isDraggable = true,
	insignias,
}: DraggableItemProps) {
	const editor = useEditor();
	const { arrastrando, props, fantasma } = useArrastreLinea({
		dragData,
		fantasma: preview,
		habilitado: isDraggable,
		onDragStart: onDragStart ? (e) => onDragStart({ e }) : undefined,
	});

	const agregar = onAddToTimeline
		? () => onAddToTimeline({ currentTime: editor.playback.getCurrentTime() })
		: undefined;

	if (variant === "compact") {
		return (
			<div className={cn("group relative w-full", containerClassName)}>
				<div
					className={cn(
						"flex h-8 w-full cursor-default items-center gap-2.5 rounded-[4px] px-1 outline-none hover:bg-[var(--cc-raised)]/50",
						className,
					)}
					onClick={onClick}
					{...props}
				>
					<div className="relative size-6 shrink-0 overflow-hidden rounded-[3px] bg-[var(--cc-sunken)]">
						{preview}
					</div>
					<span className="min-w-0 flex-1 truncate text-left text-[12px] text-[var(--cc-text)]">
						{name}
					</span>
					{agregar && !arrastrando && (
						<BotonAgregar
							className="relative right-auto bottom-auto opacity-0 group-hover:opacity-100"
							onClick={agregar}
						/>
					)}
				</div>
				{fantasma}
			</div>
		);
	}

	return (
		<div className={cn("group relative", containerClassName ?? "w-28")}>
			<div className={cn("relative flex w-full cursor-default flex-col gap-1", className)}>
				<AspectRatio
					ratio={aspectRatio}
					className={cn(
						"relative overflow-hidden bg-[var(--cc-sunken)]",
						isRounded && "rounded-[4px]",
						"ring-primary/0 transition-shadow group-hover:ring-1 group-hover:ring-[var(--cc-text-3)]/40",
					)}
					onClick={onClick}
					{...(onClick && {
						role: "button",
						tabIndex: 0,
						"aria-label": name,
						onKeyDown: (event: React.KeyboardEvent) => {
							if (event.key !== "Enter" && event.key !== " ") return;
							event.preventDefault();
							onClick();
						},
					})}
					{...props}
				>
					{preview}
					{insignias}
					{agregar && !arrastrando && (
						<BotonAgregar
							className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
							onClick={agregar}
						/>
					)}
				</AspectRatio>
				{shouldShowLabel && (
					// El nombre entero, cortado por CSS. Antes se armaba a mano con
					// `name.slice(0,16)+"..."+name.slice(-3)` cuando pasaba de 8 letras:
					// «prueba.mp4» (10) salía «prueba.mp4...mp4», la extensión dos veces.
					<span
						className="w-full truncate text-left text-[11px] leading-4 text-[var(--cc-text-2)]"
						title={name}
					>
						{name}
					</span>
				)}
			</div>
			{fantasma}
		</div>
	);
}

/** El ⊕ cian de las tarjetas de CapCut. */
export function BotonAgregar({
	className,
	onClick,
}: {
	className?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={ROTULO_AGREGAR}
			title={ROTULO_AGREGAR}
			className={cn(
				"absolute right-1 bottom-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md transition-opacity hover:brightness-110",
				className,
			)}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClick();
			}}
			onMouseDown={(event) => event.stopPropagation()}
		>
			<Plus className="size-3.5" strokeWidth={2.5} />
		</button>
	);
}
