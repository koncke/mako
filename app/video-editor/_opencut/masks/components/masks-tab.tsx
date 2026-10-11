"use client";

// =============================================================================
// Video › Máscara — como CapCut
// =============================================================================
// Arriba la grilla de formas de CapCut (Ninguna, Línea, Líneas paralelas,
// Círculo, Rectángulo, Corazón, Estrella, Pluma, Texto) con «Invertir» y ↺;
// debajo, los parámetros de la forma elegida: Posición, Rotación, Tamaño,
// Difuminar y Borde.
//
// Las formas son las del motor de OpenCut con el nombre de CapCut:
//   split → Línea (tapa medio cuadro) · cinematic-bars → Líneas paralelas
//   (conserva la franja del medio) · ellipse → Círculo · freeform → Pluma.
// «diamond» (Rombo) existe en el motor pero no en CapCut: no se ofrece; si un
// proyecto viejo lo trae, aparece al final para que se vea qué tiene.
//
// Unidades: el motor guarda posición y tamaño como FRACCIÓN de la caja del clip;
// CapCut los muestra en píxeles. Se convierten con la caja del clip en el lienzo
// (la misma que usan las asas del reproductor). Y va hacia arriba, como en
// Básico.
//
// El overlay del reproductor entra en modo máscara (asas de la máscara, y con
// «Pluma» se dibuja haciendo clic) cuando la vista activa del panel es "masks":
// por eso la sub-pestaña se registra con ese id (stores/properties-store.ts).
//
// Pendiente frente a CapCut: «Esquinas redondeadas» del rectángulo (el motor no
// la dibuja), el ◇ de fotograma clave de la máscara (el motor no anima máscaras)
// y «Realizar seguimiento de la máscara».

import type { ComponentType } from "react";
import { useMemo } from "react";
import { Ban, Circle, Diamond, Equal, FlipHorizontal2, Heart, Minus, PenTool, Square, Star, Type } from "lucide-react";
import type { MaskableElement, TimelineElement } from "@/app/video-editor/_opencut/timeline";
import type { Mask, MaskType, TextMask } from "@/app/video-editor/_opencut/masks/types";
import type { NumberParamDefinition } from "@/app/video-editor/_opencut/params";
import { buildDefaultMaskInstance, getMaskDefinition } from "@/app/video-editor/_opencut/masks";
import { MAX_FEATHER } from "@/app/video-editor/_opencut/masks/feather";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useElementPreview } from "@/app/video-editor/_opencut/timeline/hooks/use-element-preview";
import { getVisibleElementsWithBounds } from "@/app/video-editor/_opencut/preview/element-bounds";
import { isMaskableElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import { FontPicker } from "@/app/video-editor/_opencut/components/ui/font-picker";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { usePropertyDraft } from "@/app/video-editor/_opencut/components/editor/panels/properties/hooks/use-property-draft";
import {
	BotonRestablecer,
	CajaNumero,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";

type Icono = ComponentType<{ className?: string }>;

const FORMAS: ReadonlyArray<{ tipo: MaskType | null; nombre: string; Icono: Icono }> = [
	{ tipo: null, nombre: "Ninguna", Icono: Ban },
	{ tipo: "split", nombre: "Línea", Icono: Minus },
	{ tipo: "cinematic-bars", nombre: "Líneas paralelas", Icono: Equal },
	{ tipo: "ellipse", nombre: "Círculo", Icono: Circle },
	{ tipo: "rectangle", nombre: "Rectángulo", Icono: Square },
	{ tipo: "heart", nombre: "Corazón", Icono: Heart },
	{ tipo: "star", nombre: "Estrella", Icono: Star },
	{ tipo: "freeform", nombre: "Pluma", Icono: PenTool },
	{ tipo: "text", nombre: "Texto", Icono: Type },
];
const RESTO: Partial<Record<MaskType, { nombre: string; Icono: Icono }>> = {
	diamond: { nombre: "Rombo", Icono: Diamond },
};

export function nombreMascara(tipo: MaskType): string {
	return FORMAS.find((f) => f.tipo === tipo)?.nombre ?? RESTO[tipo]?.nombre ?? tipo;
}

/** La sub-pestaña registrada en la ranura del panel derecho. */
export function MascaraCe({ element, track }: ContextoInspector) {
	if (!isMaskableElement(element)) return null;
	return <MasksTab element={element} trackId={track.id} />;
}

export function MasksTab({ element, trackId }: { element: MaskableElement; trackId: string }) {
	const editor = useEditor();
	const { renderElement, previewUpdates, commit } = useElementPreview<MaskableElement>({
		trackId,
		elementId: element.id,
		fallback: element,
	});
	const caja = useCajaDelClip(element, trackId);

	// Una máscara por clip, como CapCut (el motor admite varias; se edita la primera).
	const mascara = element.masks?.[0] ?? null;
	const viva = renderElement.masks?.[0] ?? mascara;

	const poner = (masks: Mask[]) =>
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, patch: { masks } as Partial<TimelineElement> }],
		});

	const elegir = (tipo: MaskType | null) => {
		if (tipo === null) {
			if (mascara) editor.timeline.removeMask({ trackId, elementId: element.id, maskId: mascara.id });
			return;
		}
		if (mascara?.type === tipo) return;
		poner([
			buildDefaultMaskInstance({
				maskType: tipo,
				elementSize: caja ? { width: caja.width, height: caja.height } : undefined,
			}),
		]);
	};

	const restablecer = () => {
		if (!mascara) return;
		const nueva = buildDefaultMaskInstance({
			maskType: mascara.type,
			elementSize: caja ? { width: caja.width, height: caja.height } : undefined,
		});
		poner([{ ...nueva, id: mascara.id } as Mask]);
	};

	const previsualizar = (cambios: Record<string, number | string | boolean>) => {
		if (!viva) return;
		previewUpdates({
			masks: [{ ...viva, params: { ...viva.params, ...cambios } } as Mask],
		});
	};

	const formas = [...FORMAS];
	if (mascara && !FORMAS.some((f) => f.tipo === mascara.type)) {
		const r = RESTO[mascara.type];
		if (r) formas.push({ tipo: mascara.type, ...r });
	}

	return (
		<div className="flex flex-col pt-1">
			<SeccionCe
				titulo="Máscara"
				plegable={false}
				acciones={
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label="Invertir"
									aria-pressed={!!mascara?.params.inverted}
									disabled={!mascara}
									onClick={() =>
										mascara &&
										editor.timeline.toggleMaskInverted({
											trackId,
											elementId: element.id,
											maskId: mascara.id,
										})
									}
									className={cn(
										"flex h-5 cursor-pointer items-center gap-1 rounded-[3px] px-1.5 text-[12px] text-(--cc-icon) hover:bg-(--cc-raised) disabled:cursor-default disabled:text-(--cc-icon-off) disabled:hover:bg-transparent",
										mascara?.params.inverted && "text-primary",
									)}
								>
									<FlipHorizontal2 className="size-3.5" />
									Invertir
								</button>
							</TooltipTrigger>
							<TooltipContent side="top">Invertir</TooltipContent>
						</Tooltip>
						<BotonRestablecer onClick={restablecer} desactivado={!mascara} />
					</>
				}
			>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 pb-1">
					{formas.map(({ tipo, nombre, Icono }) => {
						const elegida = tipo === null ? !mascara : mascara?.type === tipo;
						return (
							<button
								key={nombre}
								type="button"
								aria-pressed={elegida}
								onClick={() => elegir(tipo)}
								className="group flex cursor-pointer flex-col items-center gap-1"
							>
								<span
									className={cn(
										"flex aspect-square w-full items-center justify-center rounded-[5px] border bg-(--cc-sunken) text-(--cc-icon) group-hover:text-foreground",
										elegida ? "border-primary text-primary" : "border-transparent",
									)}
								>
									<Icono className="size-5" />
								</span>
								<span
									className={cn(
										"w-full truncate text-center text-[11px]",
										elegida ? "text-foreground" : "text-(--cc-text-2)",
									)}
								>
									{nombre}
								</span>
							</button>
						);
					})}
				</div>
			</SeccionCe>

			{viva && (
				<ParametrosMascara
					mascara={viva}
					caja={caja}
					previsualizar={previsualizar}
					confirmar={commit}
				/>
			)}
		</div>
	);
}

/** La caja del clip en el lienzo (px), en el cabezal o en el borde más cercano del clip. */
function useCajaDelClip(element: TimelineElement, trackId: string) {
	const tracks = useEditor((e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks);
	const currentTime = useEditor((e) => e.playback.getCurrentTime());
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const lienzo = useEditor((e) => e.project.getActive().settings.canvasSize);
	return useMemo(() => {
		const t = Math.min(Math.max(currentTime, element.startTime), element.startTime + element.duration - 1);
		return (
			getVisibleElementsWithBounds({ tracks, currentTime: t, canvasSize: lienzo, mediaAssets }).find(
				(it) => it.trackId === trackId && it.elementId === element.id,
			)?.bounds ?? null
		);
	}, [tracks, currentTime, lienzo, mediaAssets, element.startTime, element.duration, element.id, trackId]);
}

function ParametrosMascara({
	mascara,
	caja,
	previsualizar,
	confirmar,
}: {
	mascara: Mask;
	caja: { width: number; height: number } | null;
	previsualizar: (cambios: Record<string, number | string | boolean>) => void;
	confirmar: () => void;
}) {
	const def = getMaskDefinition(mascara.type);
	const p = mascara.params as unknown as Record<string, unknown>;
	const n = (k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
	const numParam = (k: string) =>
		def.params.find((x): x is NumberParamDefinition => x.key === k && x.type === "number");
	// Sin caja (el clip no se ve en ningún cuadro) se mide contra 1000 px: los
	// números siguen siendo proporcionales y editables.
	const ancho = caja?.width ?? 1000;
	const alto = caja?.height ?? 1000;
	const tiene = (k: string) => k in p;
	const { features } = def;

	const pluma = mascara.type === "freeform" && !(mascara.params as { closed?: boolean }).closed;

	return (
		<SeccionCe titulo="Configuración de la máscara" clave="ce:mascara:config">
			{pluma && (
				<p className="pb-1 text-[12px] text-(--cc-text-3)">Haz clic para empezar a dibujar</p>
			)}
			{mascara.type === "text" && (
				<CamposTexto mascara={mascara as TextMask} previsualizar={previsualizar} confirmar={confirmar} />
			)}

			{features.hasPosition && tiene("centerX") && tiene("centerY") && (
				<FilaCe rotulo="Posición">
					<CajaNumero
						className="min-w-0 flex-1"
						etiqueta="X"
						ariaLabel="Posición X"
						valor={Math.round(n("centerX") * ancho)}
						paso={1}
						onPrevisualizar={(v) => previsualizar({ centerX: v / ancho })}
						onConfirmar={confirmar}
					/>
					<CajaNumero
						className="min-w-0 flex-1"
						etiqueta="Y"
						ariaLabel="Posición Y"
						valor={Math.round(-n("centerY") * alto)}
						paso={1}
						onPrevisualizar={(v) => previsualizar({ centerY: -v / alto })}
						onConfirmar={confirmar}
					/>
				</FilaCe>
			)}

			{features.hasRotation && tiene("rotation") && (
				<FilaCe rotulo="Rotación">
					<CajaNumero
						className="min-w-0 flex-1"
						ariaLabel="Rotación"
						valor={n("rotation")}
						min={numParam("rotation")?.min ?? -360}
						max={numParam("rotation")?.max ?? 360}
						paso={1}
						sufijo="°"
						onPrevisualizar={(v) => previsualizar({ rotation: v })}
						onConfirmar={confirmar}
					/>
				</FilaCe>
			)}

			{features.sizeMode === "uniform" && tiene("scale") && (
				<FilaCe rotulo="Tamaño">
					<DeslizadorValor
						valor={Math.round(n("scale", 1) * 100)}
						min={1}
						max={500}
						paso={1}
						sufijo="%"
						ariaLabel="Tamaño"
						onPrevisualizar={(v) => previsualizar({ scale: v / 100 })}
						onConfirmar={confirmar}
					/>
				</FilaCe>
			)}
			{(features.sizeMode === "width-height" ||
				features.sizeMode === "width-only" ||
				features.sizeMode === "height-only") && (
				<FilaCe rotulo="Tamaño">
					{features.sizeMode !== "height-only" && (
						<CajaNumero
							className="min-w-0 flex-1"
							etiqueta="An"
							ariaLabel="Ancho"
							valor={Math.round(n("width") * ancho)}
							min={1}
							paso={1}
							onPrevisualizar={(v) => previsualizar({ width: v / ancho })}
							onConfirmar={confirmar}
						/>
					)}
					{features.sizeMode !== "width-only" && (
						<CajaNumero
							className="min-w-0 flex-1"
							etiqueta="Al"
							ariaLabel="Alto"
							valor={Math.round(n("height") * alto)}
							min={1}
							paso={1}
							onPrevisualizar={(v) => previsualizar({ height: v / alto })}
							onConfirmar={confirmar}
						/>
					)}
				</FilaCe>
			)}

			<FilaCe rotulo="Difuminar">
				<DeslizadorValor
					valor={Math.round((n("feather") / MAX_FEATHER) * 100)}
					min={0}
					max={100}
					paso={1}
					ariaLabel="Difuminar"
					onPrevisualizar={(v) => previsualizar({ feather: (v / 100) * MAX_FEATHER })}
					onConfirmar={confirmar}
				/>
			</FilaCe>

			<FilaCe rotulo="Borde">
				<DeslizadorValor
					valor={n("strokeWidth")}
					min={0}
					max={100}
					paso={1}
					ariaLabel="Borde"
					onPrevisualizar={(v) => previsualizar({ strokeWidth: v })}
					onConfirmar={confirmar}
				/>
			</FilaCe>
			{n("strokeWidth") > 0 && (
				<FilaCe rotulo="Color">
					<ColorPicker
						className="w-full"
						value={String(p.strokeColor ?? "#ffffff").replace(/^#/, "").toUpperCase()}
						onChange={(c) => previsualizar({ strokeColor: `#${c}` })}
						onChangeEnd={(c) => {
							previsualizar({ strokeColor: `#${c}` });
							confirmar();
						}}
					/>
				</FilaCe>
			)}
		</SeccionCe>
	);
}

function CamposTexto({
	mascara,
	previsualizar,
	confirmar,
}: {
	mascara: TextMask;
	previsualizar: (cambios: Record<string, number | string | boolean>) => void;
	confirmar: () => void;
}) {
	const draft = usePropertyDraft({
		displayValue: mascara.params.content,
		parse: (input) => input,
		onPreview: (v: string) => previsualizar({ content: v }),
		onCommit: confirmar,
		supportsExpressions: false,
	});
	return (
		<>
			<div className="py-1.5">
				<Textarea
					aria-label="Texto"
					className="min-h-[60px] bg-(--cc-sunken)"
					value={draft.displayValue}
					onFocus={draft.onFocus}
					onChange={draft.onChange}
					onBlur={draft.onBlur}
				/>
			</div>
			<FilaCe rotulo="Fuente">
				<div className="min-w-0 flex-1">
					<FontPicker
						defaultValue={mascara.params.fontFamily}
						onValueChange={(v) => {
							previsualizar({ fontFamily: v });
							confirmar();
						}}
					/>
				</div>
			</FilaCe>
			<FilaCe rotulo="Tamaño de la fuente">
				<CajaNumero
					className="min-w-0 flex-1"
					ariaLabel="Tamaño de la fuente"
					valor={mascara.params.fontSize}
					min={1}
					paso={1}
					onPrevisualizar={(v) => previsualizar({ fontSize: v })}
					onConfirmar={confirmar}
				/>
			</FilaCe>
			<FilaCe rotulo="Espaciado">
				<CajaNumero
					className="min-w-0 flex-1"
					ariaLabel="Espaciado entre caracteres"
					valor={mascara.params.letterSpacing ?? 0}
					min={-100}
					max={500}
					paso={1}
					onPrevisualizar={(v) => previsualizar({ letterSpacing: v })}
					onConfirmar={confirmar}
				/>
				<CajaNumero
					className="min-w-0 flex-1"
					ariaLabel="Interlineado"
					valor={mascara.params.lineHeight ?? 1.2}
					min={0.1}
					max={10}
					paso={0.1}
					onPrevisualizar={(v) => previsualizar({ lineHeight: v })}
					onConfirmar={confirmar}
				/>
			</FilaCe>
		</>
	);
}
