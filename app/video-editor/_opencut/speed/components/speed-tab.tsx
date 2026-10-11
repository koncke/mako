"use client";

// =============================================================================
// La pestaña «Velocidad» del panel derecho: «Estándar» y «Curva»
// =============================================================================
// Como CapCut 9.3 (relevamiento-capcut-funciones §2.5):
//
//   Estándar   Velocidad 0,1×–100× (deslizador logarítmico: 1× queda a un tercio,
//              como en CapCut, donde la mitad útil es la cámara lenta), Duración
//              (al escribir una duración se recalcula la velocidad) y «Cambiar
//              tono del audio», APAGADO por defecto: CapCut conserva el tono
//              (`is_tone_modify:false`). Un proyecto de OpenCut con velocidad y sin
//              `maintainPitch` cambiaba el tono, así que ahí el interruptor se ve
//              prendido: muestra lo que pasa, no el default. Con una curva puesta
//              muestra su velocidad media, y tocarla la reemplaza por una fija.
//   Curva      Ninguno + los ajustes predefinidos, y el editor de puntos
//              (./editor-curva.tsx). Sólo video: CapCut no tiene curva en audio.
//
// Mientras se arrastra se PREVISUALIZA (retime + duración calculada acá, porque
// la vista previa del motor no pasa por el pipeline que la recalcula); al
// soltar se descarta la vista previa y se ejecuta CambiarVelocidadCommand, que
// es un paso de deshacer y corre lo que el clip alargado pisaría.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, Minus, Plus } from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { Slider } from "@/app/video-editor/_opencut/components/ui/slider";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import {
	BotonRestablecer,
	CajaNumero,
	FilaCe,
	SeccionCe,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { AudioElement, RetimeConfig, VideoElement } from "@/app/video-editor/_opencut/timeline";
import {
	DEFAULT_RETIME_RATE,
	MAX_RETIME_RATE,
	MIN_RETIME_RATE,
	PRESETS_CURVA,
	SEPARACION_MINIMA,
	buildConstantRetime,
	buildCurveRetime,
	canMaintainPitch,
	clampRetimeRate,
	curvaDeRetime,
	presetCurva,
	velocidadEnCurva,
	velocidadMediaDe,
	type PuntoCurva,
} from "@/app/video-editor/_opencut/retime";
import {
	CambiarVelocidadCommand,
	DURACION_MINIMA_TRAS_RAMPA,
	duracionConRetime,
} from "@/app/video-editor/_opencut/commands/timeline/element/velocidad";
import { TICKS_PER_SECOND, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { EditorCurva, MiniaturaCurva } from "./editor-curva";

type ClipConVelocidad = VideoElement | AudioElement;

const AVISO_CORTO =
	"El clip es demasiado corto. Debería durar por lo menos 0.1 s después de la rampa de velocidad.";

// ── Aplicar ──────────────────────────────────────────────────────────────────

function previsualizar(
	editor: EditorCore,
	trackId: string,
	element: ClipConVelocidad,
	retime: RetimeConfig | undefined,
) {
	editor.timeline.previewElements({
		updates: [
			{
				trackId,
				elementId: element.id,
				updates: {
					retime,
					duration: roundMediaTime({ time: duracionConRetime(element, retime) }),
				},
			},
		],
	});
}

/** Confirma el cambio: un paso de deshacer. Devuelve false si se rechazó. */
function aplicar(
	editor: EditorCore,
	trackId: string,
	element: ClipConVelocidad,
	retime: RetimeConfig | undefined,
): boolean {
	editor.timeline.discardPreview();
	if (duracionConRetime(element, retime) < DURACION_MINIMA_TRAS_RAMPA) {
		toast.error(AVISO_CORTO);
		return false;
	}
	editor.command.execute({
		command: new CambiarVelocidadCommand({ trackId, elementId: element.id, retime }),
	});
	return true;
}

const segundos = (ticks: number) => ticks / TICKS_PER_SECOND;
const formatoSegundos = (ticks: number) => `${segundos(ticks).toFixed(1)}s`;

// ── Estándar ─────────────────────────────────────────────────────────────────

// El deslizador es logarítmico: 0 → 0,1×, 1/3 → 1×, 2/3 → 10×, 1 → 100×.
const aPosicion = (rate: number) => (Math.log10(clampRetimeRate({ rate })) + 1) / 3;
const deposicion = (pos: number) =>
	clampRetimeRate({ rate: Math.round(10 ** (pos * 3 - 1) * 10) / 10 });

function tieneAudio(ctx: ContextoInspector): boolean {
	if (ctx.element.type === "audio") return true;
	if (ctx.element.type !== "video") return false;
	const { mediaId } = ctx.element;
	return ctx.mediaAssets.find((a) => a.id === mediaId)?.hasAudio !== false;
}

export function VelocidadEstandar(ctx: ContextoInspector) {
	const editor = useEditor();
	const { element: crudo, track } = ctx;
	// Lo que se muestra sale del elemento con la vista previa aplicada.
	const vivo = useEditor((e) => {
		const tracks = e.timeline.getPreviewTracks();
		const el = tracks
			? [...tracks.overlay, tracks.main, ...tracks.audio]
					.find((t) => t.id === track.id)
					?.elements.find((x) => x.id === crudo.id)
			: undefined;
		return el ?? crudo;
	}) as ClipConVelocidad;
	const pendiente = useRef<RetimeConfig | undefined>(undefined);

	if (crudo.type !== "video" && crudo.type !== "audio") return null;
	const element = crudo as ClipConVelocidad;

	const conCurva = curvaDeRetime(vivo.retime) !== null;
	const rate = velocidadMediaDe(vivo.retime);
	const original = duracionConRetime(element, undefined);
	const duracion = vivo.duration;
	const cambiarTono = element.retime ? element.retime.maintainPitch !== true : false;
	const tonoPosible = canMaintainPitch({ rate });

	const retimeConstante = (r: number): RetimeConfig | undefined => {
		const conservar = !cambiarTono;
		if (r === DEFAULT_RETIME_RATE && conservar) return undefined;
		return buildConstantRetime({ rate: r, maintainPitch: conservar });
	};
	const verVelocidad = (r: number) => {
		pendiente.current = retimeConstante(clampRetimeRate({ rate: r }));
		previsualizar(editor, track.id, element, pendiente.current);
	};
	// La caja confirma en cada blur, haya cambiado o no: sin vista previa en
	// curso no hay nada que confirmar (y `pendiente` puede ser de antes).
	const confirmar = () => {
		if (!editor.timeline.isPreviewActive()) return;
		aplicar(editor, track.id, element, pendiente.current);
	};

	const verDuracion = (s: number) => {
		const fuente = duracionConRetime(element, undefined);
		const r = clampRetimeRate({ rate: fuente / Math.max(1, s * TICKS_PER_SECOND) });
		verVelocidad(Math.round(r * 100) / 100);
	};

	return (
		// Sin título de sección: la pestaña ya dice «Velocidad» y el segmentado
		// «Estándar»; CapCut va directo a las filas.
		<div className="flex flex-col px-4 pt-2 pb-3">
			<FilaCe
				rotulo="Velocidad"
				acciones={
					<BotonRestablecer
						desactivado={!element.retime}
						onClick={() => aplicar(editor, track.id, element, undefined)}
					/>
				}
			>
				<Slider
					className="min-w-0 flex-1"
					aria-label="Velocidad"
					min={0}
					max={1}
					step={0.001}
					value={[aPosicion(rate)]}
					onValueChange={([p]) => p !== undefined && verVelocidad(deposicion(p))}
					onValueCommit={confirmar}
				/>
				<CajaNumero
					valor={Math.round(rate * 10) / 10}
					min={MIN_RETIME_RATE}
					max={MAX_RETIME_RATE}
					paso={0.1}
					sufijo="x"
					ariaLabel="Velocidad"
					onPrevisualizar={verVelocidad}
					onConfirmar={confirmar}
				/>
			</FilaCe>
			<FilaCe rotulo="Duración">
				<span className="ml-auto shrink-0 text-[12px] text-(--cc-text-3) tabular-nums">
					{formatoSegundos(original)}
				</span>
				<span className="shrink-0 text-[12px] text-(--cc-text-3)">→</span>
				<CajaNumero
					valor={Math.round(segundos(duracion) * 10) / 10}
					min={0.1}
					paso={0.1}
					sufijo="s"
					ariaLabel="Duración"
					onPrevisualizar={verDuracion}
					onConfirmar={confirmar}
				/>
			</FilaCe>
			{tieneAudio(ctx) && (
				<div className="flex min-h-[38px] items-center gap-2">
					<span className="flex-1 text-[12px] text-(--cc-text-2)">Cambiar tono del audio</span>
					<Switch
						aria-label="Cambiar tono del audio"
						checked={tonoPosible ? cambiarTono : true}
						disabled={!tonoPosible || conCurva}
						onCheckedChange={(v) =>
							aplicar(
								editor,
								track.id,
								element,
								// A 1× conservando el tono no hay retime: si lo hubiera, el
								// audio-manager prepararía el clip entero para nada.
								rate === DEFAULT_RETIME_RATE && !v
									? undefined
									: buildConstantRetime({ rate, maintainPitch: !v }),
							)
						}
					/>
					<span className="w-[66px] shrink-0" />
				</div>
			)}
		</div>
	);
}

// ── Curva ────────────────────────────────────────────────────────────────────

export function VelocidadCurva(ctx: ContextoInspector) {
	const editor = useEditor();
	const { element: crudo, track } = ctx;
	const cabezal = useEditor((e) => e.playback.getCurrentTime());
	// Los puntos mientras se arrastra (null: los del clip).
	const [arrastre, setArrastre] = useState<PuntoCurva[] | null>(null);
	const [elegido, setElegido] = useState<number | null>(null);

	if (crudo.type !== "video") return null;
	const element = crudo as VideoElement;
	const curva = curvaDeRetime(element.retime);
	const presetActual = curva?.preset ?? "ninguno";
	const puntos = arrastre ?? curva?.puntos ?? null;

	const elegirPreset = (id: string) => {
		setElegido(null);
		if (id === "ninguno") {
			if (curva) aplicar(editor, track.id, element, undefined);
			return;
		}
		const preset = presetCurva(id);
		if (!preset) return;
		aplicar(editor, track.id, element, buildCurveRetime({ preset: id, puntos: preset.puntos }));
	};

	const retimeDe = (p: PuntoCurva[]) => buildCurveRetime({ preset: presetActual, puntos: p });

	const enClip =
		cabezal >= element.startTime && cabezal <= element.startTime + element.duration
			? (cabezal - element.startTime) / Math.max(1, element.duration)
			: null;

	const agregarPunto = () => {
		if (!puntos) return;
		let x: number;
		if (enClip !== null && enClip > 0 && enClip < 1) {
			x = enClip;
		} else {
			// Sin cabezal sobre el clip: en el medio del hueco más grande.
			let mejor = 0;
			for (let i = 1; i < puntos.length; i++) {
				if (puntos[i].x - puntos[i - 1].x > puntos[mejor + 1].x - puntos[mejor].x) mejor = i - 1;
			}
			x = (puntos[mejor].x + puntos[mejor + 1].x) / 2;
		}
		if (puntos.some((p) => Math.abs(p.x - x) < SEPARACION_MINIMA)) {
			toast.error("El espacio es demasiado pequeño para agregar un punto de control");
			return;
		}
		const nuevos = [...puntos, { x, y: velocidadEnCurva({ puntos }, x) }].sort((a, b) => a.x - b.x);
		if (aplicar(editor, track.id, element, retimeDe(nuevos))) {
			setElegido(nuevos.findIndex((p) => p.x === x));
		}
	};

	const borrarPunto = () => {
		if (!puntos || elegido === null || elegido === 0 || elegido === puntos.length - 1) return;
		const nuevos = puntos.filter((_, i) => i !== elegido);
		if (aplicar(editor, track.id, element, retimeDe(nuevos))) setElegido(null);
	};

	const restablecerCurva = () => {
		const preset = presetCurva(presetActual);
		if (!preset) return;
		setElegido(null);
		aplicar(editor, track.id, element, buildCurveRetime({ preset: preset.id, puntos: preset.puntos }));
	};

	return (
		<div className="flex flex-col pt-1">
			<div className="grid grid-cols-4 gap-x-2 gap-y-2.5 px-4 pt-2 pb-3">
				<TarjetaPreset
					etiqueta="Ninguno"
					activa={presetActual === "ninguno"}
					onClick={() => elegirPreset("ninguno")}
				>
					<Ban className="size-5 text-(--cc-text-3)" strokeWidth={1.5} />
				</TarjetaPreset>
				{PRESETS_CURVA.map((p) => (
					<TarjetaPreset
						key={p.id}
						etiqueta={p.etiqueta}
						activa={presetActual === p.id}
						onClick={() => elegirPreset(p.id)}
					>
						<MiniaturaCurva puntos={p.puntos} />
					</TarjetaPreset>
				))}
			</div>

			{curva && puntos && (
				<SeccionCe
					titulo={PRESETS_CURVA.find((p) => p.id === presetActual)?.etiqueta ?? "Personalizado"}
					plegable={false}
					acciones={<BotonRestablecer onClick={restablecerCurva} />}
				>
					<div className="flex items-center justify-between pb-2 text-[12px] text-(--cc-text-3)">
						<span>Duración</span>
						<span className="tabular-nums">
							{formatoSegundos(duracionConRetime(element, undefined))} →{" "}
							<span className="text-foreground">
								{formatoSegundos(duracionConRetime(element, retimeDe(puntos)))}
							</span>
						</span>
					</div>
					<EditorCurva
						puntos={puntos}
						elegido={elegido}
						cabezal={enClip}
						onElegir={setElegido}
						onArrastrar={(p) => {
							setArrastre(p);
							previsualizar(editor, track.id, element, retimeDe(p));
						}}
						onSoltar={(p) => {
							setArrastre(null);
							aplicar(editor, track.id, element, retimeDe(p));
						}}
					/>
					<div className="flex items-center gap-1 pt-2">
						<BotonPunto titulo="Agregar punto" onClick={agregarPunto}>
							<Plus className="size-3.5" />
						</BotonPunto>
						<BotonPunto
							titulo="Eliminar punto"
							onClick={borrarPunto}
							desactivado={elegido === null || elegido === 0 || elegido === puntos.length - 1}
						>
							<Minus className="size-3.5" />
						</BotonPunto>
					</div>
				</SeccionCe>
			)}
		</div>
	);
}

function TarjetaPreset({
	etiqueta,
	activa,
	onClick,
	children,
}: {
	etiqueta: string;
	activa: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={activa}
			onClick={onClick}
			className="group flex min-w-0 cursor-pointer flex-col items-center gap-1"
		>
			<span
				className={cn(
					"flex aspect-square w-full items-center justify-center rounded-[5px] border bg-(--cc-sunken) transition-colors",
					activa ? "border-primary" : "border-transparent group-hover:border-(--cc-line-2)",
				)}
			>
				{children}
			</span>
			<span
				className={cn(
					"w-full truncate text-center text-[11px]",
					activa ? "text-primary" : "text-(--cc-text-2)",
				)}
				title={etiqueta}
			>
				{etiqueta}
			</span>
		</button>
	);
}

function BotonPunto({
	titulo,
	onClick,
	desactivado,
	children,
}: {
	titulo: string;
	onClick: () => void;
	desactivado?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={titulo}
					disabled={desactivado}
					onClick={onClick}
					className="flex h-6 cursor-pointer items-center justify-center rounded-[4px] bg-(--cc-raised) px-2 text-(--cc-icon) hover:text-foreground disabled:cursor-default disabled:text-(--cc-icon-off)"
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">{titulo}</TooltipContent>
		</Tooltip>
	);
}
