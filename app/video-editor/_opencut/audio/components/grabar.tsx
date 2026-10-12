"use client";

// =============================================================================
// «Grabar» en la barra de la línea de tiempo: el botón y su panel
// =============================================================================
// La lógica (micrófono, cuenta regresiva, guardar e insertar) está en
// ../grabar.ts. Esto es el botón del micrófono (a la derecha de la barra,
// antes del Imán) y el panel que abre: Entrada, Reducción del eco, Silenciar el
// proyecto, el vúmetro y el botón rojo, con los textos de CapCut
// (`pc_click_begin-record`, `pc_click_end_record`, `pc_add_audio_recording_label`).
//
// Mientras cuenta o graba el panel no se cierra solo: un clic afuera dejaría
// una grabación corriendo sin forma de detenerla.

import { useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/video-editor/_opencut/components/ui/popover";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { SelectCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import type { ContextoHerramienta, HerramientaLinea } from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import {
	cancelarGrabacion,
	cargarDispositivos,
	detenerGrabacion,
	empezarGrabacion,
	soltarMicrofono,
	useGrabacion,
} from "../grabar";

const PREDETERMINADO = "predeterminado";

function reloj(segundos: number): string {
	const s = Math.floor(segundos);
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ControlGrabar({ herramienta }: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const editor = useEditor();
	const fase = useGrabacion((s) => s.fase);
	const enCurso = fase !== "inactiva";

	// Si la barra se desmonta (se cierra el editor) grabando, se suelta el micrófono.
	useEffect(() => () => soltarMicrofono(), []);

	return (
		<Popover
			onOpenChange={(abierto) => {
				if (abierto) void cargarDispositivos();
			}}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={herramienta.etiqueta}
							className={cn(
								"flex size-7 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-white/8",
								enCurso && "text-destructive",
							)}
						>
							<Mic className="size-4" />
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="top" className="px-2 py-1 text-xs">
					{herramienta.etiqueta}
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="end"
				className="w-[264px] p-4"
				onInteractOutside={(e) => {
					if (useGrabacion.getState().fase !== "inactiva") e.preventDefault();
				}}
				onEscapeKeyDown={(e) => {
					if (useGrabacion.getState().fase !== "inactiva") e.preventDefault();
				}}
			>
				<PanelGrabar
					onBoton={() => {
						const actual = useGrabacion.getState().fase;
						if (actual === "inactiva") void empezarGrabacion(editor);
						else if (actual === "cuenta" || actual === "pidiendo") cancelarGrabacion();
						else if (actual === "grabando") void detenerGrabacion(editor);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

function PanelGrabar({ onBoton }: { onBoton: () => void }) {
	const { fase, cuenta, transcurrido, nivel, dispositivos, dispositivo, reducirEco, silenciarProyecto, fijar } =
		useGrabacion();
	const quieto = fase === "inactiva";

	return (
		<div className="flex flex-col gap-3">
			<p className="text-[13px] font-medium text-foreground">Grabar</p>
			<div className="flex items-center gap-2">
				<span className="w-[92px] shrink-0 text-[12px] text-(--cc-text-2)">Entrada</span>
				<SelectCe
					valor={dispositivo || PREDETERMINADO}
					ariaLabel="Entrada"
					opciones={[
						{ id: PREDETERMINADO, etiqueta: "Predeterminado" },
						...dispositivos.map((d) => ({ id: d.id, etiqueta: d.nombre })),
					]}
					onCambio={(id) => fijar({ dispositivo: id === PREDETERMINADO ? "" : id })}
				/>
			</div>
			<label className="flex items-center gap-2 text-[12px] text-(--cc-text-2)">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex-1">Reducción del eco</span>
					</TooltipTrigger>
					<TooltipContent side="top" className="px-2 py-1 text-xs">
						Activar para evitar el eco del altavoz
					</TooltipContent>
				</Tooltip>
				<Switch checked={reducirEco} disabled={!quieto} onCheckedChange={(v) => fijar({ reducirEco: v })} />
			</label>
			<label className="flex items-center gap-2 text-[12px] text-(--cc-text-2)">
				<span className="flex-1">Silenciar el proyecto</span>
				<Switch
					checked={silenciarProyecto}
					disabled={!quieto}
					onCheckedChange={(v) => fijar({ silenciarProyecto: v })}
				/>
			</label>

			<div className="h-1 overflow-hidden rounded-full bg-(--cc-sunken)" aria-hidden>
				<div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(nivel * 100)}%` }} />
			</div>

			<div className="flex flex-col items-center gap-2 pt-1">
				<button
					type="button"
					onClick={onBoton}
					disabled={fase === "guardando"}
					aria-label={fase === "grabando" ? "Detener la grabación" : "Iniciar grabación"}
					className="flex size-12 cursor-pointer items-center justify-center rounded-full border-2 border-foreground/80 disabled:cursor-default disabled:opacity-50"
				>
					{fase === "grabando" ? (
						<Square className="size-4 fill-destructive text-destructive" />
					) : fase === "cuenta" ? (
						<span className="text-lg font-semibold text-foreground tabular-nums">{cuenta}</span>
					) : (
						<span className="size-8 rounded-full bg-destructive" />
					)}
				</button>
				<p className="text-center text-[12px] text-(--cc-text-3)">
					{fase === "grabando"
						? `Grabando ${reloj(transcurrido)}`
						: fase === "guardando"
							? "Guardando…"
							: "Haz clic para iniciar la grabación"}
				</p>
				{fase === "grabando" && (
					<p className="text-center text-[11px] text-(--cc-text-3)">Haz clic para finalizar la grabación</p>
				)}
			</div>
		</div>
	);
}
