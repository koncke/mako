"use client";

// La cabecera de una pista (columna de 147 px, `#2a2a2a`), como en CapCut:
// el ícono del tipo de pista a la izquierda y, a la derecha, «Bloquear pista»,
// «Ocultar la pista» (si la pista se ve) y «Silenciar pista» (si suena).

import type { ComponentType } from "react";
import {
	Captions,
	Eye,
	EyeOff,
	Film,
	Lock,
	LockOpen,
	Music,
	PictureInPicture2,
	Sparkles,
	Sticker,
	Type,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	canTrackBeHidden,
	canTrackHaveAudio,
	type TimelineTrack,
} from "@/app/video-editor/_opencut/timeline";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { alternarBloqueoPista, esPistaSubtitulos } from "./pistas-ce";

type Icono = ComponentType<{ className?: string }>;

/** Ícono y nombre de la pista (el nombre va en el tooltip del ícono). */
export function tipoDePista({
	track,
	isMain,
}: {
	track: TimelineTrack;
	isMain: boolean;
}): { Icono: Icono; nombre: string } {
	switch (track.type) {
		case "video":
			return isMain
				? { Icono: Film, nombre: "Pista principal" }
				: { Icono: PictureInPicture2, nombre: "Superposición" };
		case "text":
			return esPistaSubtitulos(track)
				? { Icono: Captions, nombre: "Subtítulos" }
				: { Icono: Type, nombre: "Texto" };
		case "graphic":
			return { Icono: Sticker, nombre: "Stickers" };
		case "effect":
			return { Icono: Sparkles, nombre: "Efectos" };
		case "audio":
			return { Icono: Music, nombre: "Audio" };
	}
}

export function CabeceraPista({
	track,
	isMain,
	height,
	elegida,
}: {
	track: TimelineTrack;
	isMain: boolean;
	height: number;
	/** La pista tiene el clip elegido (fila un tono más clara). */
	elegida: boolean;
}) {
	const editor = useEditor();
	const { Icono, nombre } = tipoDePista({ track, isMain });
	const oculta = canTrackBeHidden(track) && track.hidden;
	const silenciada = canTrackHaveAudio(track) && track.muted;

	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-between gap-2 pr-3 pl-3",
				elegida ? "bg-(--cc-track-active)" : "bg-(--cc-track-head)",
			)}
			style={{ height }}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="flex min-w-0 items-center gap-1.5 text-(--cc-track-icon)">
						<Icono className="size-4 shrink-0" />
						{esPistaSubtitulos(track) && (
							<span className="truncate text-[11px] text-(--cc-text-2)">{nombre}</span>
						)}
					</span>
				</TooltipTrigger>
				<TooltipContent side="right" className="px-2 py-1 text-xs">
					{nombre}
				</TooltipContent>
			</Tooltip>
			<div className="flex items-center gap-2.5">
				<Interruptor
					etiqueta={track.locked ? "Desbloquear pista" : "Bloquear pista"}
					encendido={track.locked === true}
					Icono={track.locked ? Lock : LockOpen}
					onClick={() => alternarBloqueoPista({ editor, trackId: track.id })}
				/>
				{canTrackBeHidden(track) && (
					<Interruptor
						etiqueta={oculta ? "Mostrar la pista" : "Ocultar la pista"}
						encendido={oculta}
						Icono={oculta ? EyeOff : Eye}
						onClick={() => editor.timeline.toggleTrackVisibility({ trackId: track.id })}
					/>
				)}
				{canTrackHaveAudio(track) && (
					<Interruptor
						// CapCut no tiene un rótulo para «quitar el silencio de la pista»
						// (el ícono se alterna); se arma con su «Reactivar el audio del clip».
						etiqueta={silenciada ? "Reactivar el audio de la pista" : "Silenciar pista"}
						encendido={silenciada}
						Icono={silenciada ? VolumeX : Volume2}
						onClick={() => editor.timeline.toggleTrackMute({ trackId: track.id })}
					/>
				)}
			</div>
		</div>
	);
}

function Interruptor({
	etiqueta,
	encendido,
	Icono,
	onClick,
}: {
	etiqueta: string;
	encendido: boolean;
	Icono: Icono;
	onClick: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={etiqueta}
					aria-pressed={encendido}
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
					className={cn(
						"flex size-5 cursor-pointer items-center justify-center rounded-[3px] hover:bg-white/8",
						encendido ? "text-(--cc-text)" : "text-(--cc-track-icon) hover:text-(--cc-icon)",
					)}
				>
					<Icono className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" className="px-2 py-1 text-xs">
				{etiqueta}
			</TooltipContent>
		</Tooltip>
	);
}
