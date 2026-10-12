"use client";

// =============================================================================
// La fila de abajo del reproductor, como CapCut 9.3
// =============================================================================
// Izquierda: el tiempo actual en CIAN y la duración total (HH:MM:SS:FF).
// Centro: ▶ / ❚❚. Derecha, en el orden de CapCut: resolución de reproducción
// («Completa», «1/2», «1/4»), zoom del reproductor, «Relación» y «Pantalla
// completa». Medidas: las de la captura oficial ÷1,25.

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatTimecode } from "@/app/video-editor/_opencut/wasm/opencut";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowDown01Icon,
	FullScreenIcon,
	MinimizeScreenIcon,
	Search01Icon,
} from "@hugeicons/core-free-icons";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { EditableTimecode } from "@/app/video-editor/_opencut/components/editable-timecode";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { PREVIEW_ZOOM_PRESETS } from "@/app/video-editor/_opencut/preview/zoom";
import { usePreviewViewport } from "./preview-viewport";
import { usePreviewStore } from "@/app/video-editor/_opencut/preview/preview-store";
import { alternarReproduccion } from "@/app/video-editor/_opencut/preview/navegacion";
import { ATAJOS_REPRODUCTOR } from "@/app/video-editor/_opencut/preview/atajos-reproductor";
import type { PantallaCompleta } from "@/app/video-editor/_opencut/preview/hooks/use-pantalla-completa";
import type { EscalaSalida } from "@/app/video-editor/_opencut/canvas/escala-salida";
import {
	RELACIONES,
	relacionActual,
	tamanoDeRelacion,
	type IdRelacion,
	type Relacion,
} from "@/app/video-editor/_opencut/canvas/sizes";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

/** Los botones de texto de la derecha («Completa», «Relación»): chicos, grises, sin borde. */
const BOTON_TEXTO =
	"inline-flex h-6 cursor-pointer items-center gap-0.5 rounded px-1.5 text-[12px] text-[var(--cc-text-2)] outline-none hover:bg-[var(--cc-raised)] hover:text-[var(--cc-text)] focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-[var(--cc-raised)] data-[state=open]:text-[var(--cc-text)]";

export function PreviewToolbar({ pantalla }: { pantalla: PantallaCompleta }) {
	return (
		<div className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
			<TimecodeDisplay />
			<PlayPauseButton />
			<div className="flex min-w-0 items-center justify-self-end gap-1">
				<ResolucionMenu />
				<ZoomMenu />
				<RelacionMenu />
				<PantallaCompletaBoton pantalla={pantalla} />
			</div>
		</div>
	);
}

function ConAyuda({
	texto,
	atajo,
	children,
}: {
	texto: string;
	atajo?: string;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="top" className="text-[12px]">
				{texto}
				{atajo ? <span className="ml-2 text-[var(--cc-text-3)]">{atajo}</span> : null}
			</TooltipContent>
		</Tooltip>
	);
}

function TimecodeDisplay() {
	const editor = useEditor();
	const totalDuration = useEditor((e) => e.timeline.getTotalDuration());
	const fps = useEditor((e) => e.project.getActive().settings.fps);
	const [currentTime, setCurrentTime] = useState<MediaTime>(() =>
		editor.playback.getCurrentTime(),
	);

	useEffect(() => {
		const unsubscribeUpdate = editor.playback.onUpdate(setCurrentTime);
		const unsubscribeSeek = editor.playback.onSeek(setCurrentTime);
		return () => {
			unsubscribeUpdate();
			unsubscribeSeek();
		};
	}, [editor.playback]);

	return (
		<div className="flex min-w-0 items-center text-[12px] tabular-nums">
			{/* El actual va en el cian de CapCut (`text-primary` = --cc-accent). */}
			<EditableTimecode
				time={currentTime}
				duration={totalDuration}
				format="HH:MM:SS:FF"
				fps={fps}
				onTimeChange={({ time }) => editor.playback.seek({ time })}
				className="text-[12px]"
			/>
			<span className="px-1 font-mono text-[var(--cc-text-3)]">/</span>
			<span className="truncate font-mono text-[var(--cc-text-2)]">
				{formatTimecode({
					time: totalDuration,
					format: "HH:MM:SS:FF",
					rate: fps,
				})}
			</span>
		</div>
	);
}

function PlayPauseButton() {
	const editor = useEditor();
	const isPlaying = useEditor((e) => e.playback.getIsPlaying());
	const Icono = isPlaying ? Pause : Play;

	return (
		<ConAyuda texto={isPlaying ? "Pausar" : "Reproducir"} atajo="Espacio">
			<button
				type="button"
				aria-label={isPlaying ? "Pausar" : "Reproducir"}
				onClick={() => alternarReproduccion(editor)}
				className="flex size-7 cursor-pointer items-center justify-center rounded text-[var(--cc-text)] outline-none hover:bg-[var(--cc-raised)] focus-visible:ring-1 focus-visible:ring-ring"
			>
				<Icono className="size-4 fill-current" strokeWidth={1.5} />
			</button>
		</ConAyuda>
	);
}

// ── Resolución de reproducción ──────────────────────────────────────────────

const RESOLUCIONES: { escala: EscalaSalida; etiqueta: string; calidad: string }[] = [
	{ escala: 1, etiqueta: "Completa", calidad: "Alta calidad" },
	{ escala: 0.5, etiqueta: "1/2", calidad: "Calidad media" },
	{ escala: 0.25, etiqueta: "1/4", calidad: "Baja calidad" },
];

function ResolucionMenu() {
	const resolucion = usePreviewStore((s) => s.resolucion);
	const setResolucion = usePreviewStore((s) => s.setResolucion);
	const actual = RESOLUCIONES.find((r) => r.escala === resolucion) ?? RESOLUCIONES[0];

	return (
		<DropdownMenu>
			<ConAyuda texto="Calidad de la reproducción">
				<DropdownMenuTrigger className={BOTON_TEXTO}>
					{actual.etiqueta}
					<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
				</DropdownMenuTrigger>
			</ConAyuda>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuRadioGroup
					value={String(resolucion)}
					onValueChange={(v) => setResolucion(Number(v) as EscalaSalida)}
				>
					{RESOLUCIONES.map((r) => (
						<DropdownMenuRadioItem key={r.escala} value={String(r.escala)}>
							{r.etiqueta}
							<span className="ml-auto text-[11px] text-[var(--cc-text-3)]">
								{r.calidad}
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<p className="px-2.5 pb-1 text-[11px] leading-snug text-[var(--cc-text-3)]">
					La resolución del video exportado no se verá afectada.
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── Zoom del reproductor ────────────────────────────────────────────────────

function ZoomMenu() {
	const { isAtFit, zoomPercent, fitToScreen, setViewportPercent, zoomIn, zoomOut } =
		usePreviewViewport();

	return (
		<DropdownMenu>
			<ConAyuda texto="Zoom">
				<DropdownMenuTrigger className={cn(BOTON_TEXTO, "tabular-nums")}>
					<HugeiconsIcon icon={Search01Icon} className="size-3.5" />
					{/* Ajustado no muestra número: el % depende del tamaño del panel. */}
					{isAtFit ? null : <span>{zoomPercent}%</span>}
					<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
				</DropdownMenuTrigger>
			</ConAyuda>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuItem onSelect={zoomIn}>
					Acercar reproductor
					<DropdownMenuShortcut>{ATAJOS_REPRODUCTOR.acercar}</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={zoomOut}>
					Alejar reproductor
					<DropdownMenuShortcut>{ATAJOS_REPRODUCTOR.alejar}</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={fitToScreen}>
					Hacer zoom para ajustar el reproductor
					<DropdownMenuShortcut>{ATAJOS_REPRODUCTOR.ajustar}</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup
					value={isAtFit ? "" : String(zoomPercent)}
					onValueChange={(v) => setViewportPercent({ percent: Number(v) })}
				>
					{PREVIEW_ZOOM_PRESETS.map((preset) => (
						<DropdownMenuRadioItem key={preset} value={String(preset)}>
							{preset}%
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── Relación ────────────────────────────────────────────────────────────────

/** El rectangulito de cada proporción, como los íconos del menú de CapCut. */
function IconoProporcion({ relacion }: { relacion: Relacion }) {
	const p = relacion.proporcion;
	if (p === null) {
		return (
			<span className="flex size-4 items-center justify-center">
				<span className="size-3 rounded-[2px] border border-dashed border-current" />
			</span>
		);
	}
	const LADO = 14;
	const ancho = p >= 1 ? LADO : Math.max(5, Math.round(LADO * p));
	const alto = p >= 1 ? Math.max(5, Math.round(LADO / p)) : LADO;
	return (
		<span className="flex size-4 items-center justify-center">
			<span
				className="rounded-[2px] border border-current"
				style={{ width: ancho, height: alto }}
			/>
		</span>
	);
}

function RelacionMenu() {
	const editor = useEditor();
	const settings = useEditor((e) => e.project.getActive().settings);
	const actual = relacionActual(settings);

	const elegir = (id: IdRelacion) => {
		const canvasSize = tamanoDeRelacion({ id, settings });
		const mismoTamano =
			canvasSize.width === settings.canvasSize.width &&
			canvasSize.height === settings.canvasSize.height;
		if (mismoTamano && settings.relacion === id) return;
		editor.project.updateSettings({
			settings: {
				...(mismoTamano ? {} : { canvasSize }),
				canvasSizeMode: "preset",
				relacion: id,
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className={BOTON_TEXTO}>
				Relación
				<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				<DropdownMenuRadioGroup
					value={actual ?? ""}
					onValueChange={(v) => elegir(v as IdRelacion)}
				>
					{RELACIONES.map((r) => (
						<DropdownMenuRadioItem key={r.id} value={r.id} className="gap-2">
							<IconoProporcion relacion={r} />
							{r.etiqueta}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── Pantalla completa ───────────────────────────────────────────────────────

function PantallaCompletaBoton({ pantalla }: { pantalla: PantallaCompleta }) {
	const texto = pantalla.activa ? "Salir de pantalla completa" : "Pantalla completa";
	return (
		<ConAyuda
			texto={texto}
			atajo={pantalla.activa ? "Esc" : ATAJOS_REPRODUCTOR.pantallaCompleta}
		>
			<button
				type="button"
				aria-label={texto}
				onClick={pantalla.alternar}
				className="flex size-6 cursor-pointer items-center justify-center rounded text-[var(--cc-text-2)] outline-none hover:bg-[var(--cc-raised)] hover:text-[var(--cc-text)] focus-visible:ring-1 focus-visible:ring-ring"
			>
				<HugeiconsIcon
					icon={pantalla.activa ? MinimizeScreenIcon : FullScreenIcon}
					className="size-4"
				/>
			</button>
		</ConAyuda>
	);
}
