"use client";

// =============================================================================
// Audio › «Básico»: Volumen, fundidos, Normalizar la intensidad, Reducir el ruido
// =============================================================================
// Como CapCut 9.3 (relevamiento-capcut-funciones §3.1). Va como pestaña
// «Básico» de un clip de audio y como sub-pestaña «Básico» de la pestaña
// «Audio» de un clip de video con sonido (ver ../registro.ts).
//
//   Volumen      el param del motor, en dB, con ◇ (CapCut lo anima).
//   Aparición / Desaparición progresiva   segundos, sin ◇; son los mismos
//                params que arrastran los círculos del clip (D).
//   ☐ Normalizar la intensidad  mide al prender y guarda lo medido;
//                «Intensidad objetivo» elige −23 / −12 / −14 LUFS.
//   ☐ Reducir el ruido  se procesa al reproducir y al exportar (audio/cadena.ts).
//
// «Mejorar voz», «Aislar voz» y «Canal» no se dibujan: los dos primeros son IA
// de CapCut (Pro) y «Canal» quedó fuera del paquete (anotado como pendiente).

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	AccionesGrupo,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
	SelectCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import {
	getElementParam,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { VOLUME_DB_MAX, VOLUME_DB_MIN } from "@/app/video-editor/_opencut/timeline/audio-constants";
import {
	FUNDIDO_ENTRADA,
	FUNDIDO_SALIDA,
	NORMALIZAR,
	NORMALIZAR_OBJETIVO,
	OBJETIVOS_INTENSIDAD,
	OBJETIVO_PREDETERMINADO,
	REDUCIR_RUIDO,
} from "../claves";
import { alternarNormalizacion } from "../normalizar";
import type { ClipConAudio } from "../decodificar";

const esClipConAudio = (e: TimelineElement): e is ClipConAudio => e.type === "audio" || e.type === "video";

/**
 * Una fila como `FilaCe` pero con la columna del rótulo más ancha y en dos
 * renglones si hace falta: «Desaparición progresiva» o «Tamaño de la
 * habitación» no entran en los 76 px del kit y se cortaban con «…».
 */
export function FilaAudio({
	rotulo,
	children,
	acciones,
}: {
	rotulo: string;
	children: ReactNode;
	acciones?: ReactNode;
}) {
	return (
		<div className="flex min-h-[38px] items-center gap-2">
			<div className="w-[92px] shrink-0 text-[12px] leading-tight text-(--cc-text-2)">{rotulo}</div>
			<div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
			<div className="flex w-[66px] shrink-0 items-center justify-end gap-0.5">{acciones}</div>
		</div>
	);
}

export function AudioBasico({ element, track, mediaAssets }: ContextoInspector) {
	if (!esClipConAudio(element)) return null;
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo="Básico" plegable={false}>
				<FilaVolumen element={element} trackId={track.id} />
				<FilaFundido element={element} trackId={track.id} clave={FUNDIDO_ENTRADA} otra={FUNDIDO_SALIDA} />
				<FilaFundido element={element} trackId={track.id} clave={FUNDIDO_SALIDA} otra={FUNDIDO_ENTRADA} />
			</SeccionCe>
			<SeccionNormalizar element={element} trackId={track.id} mediaAssets={mediaAssets} />
			<SeccionRuido element={element} trackId={track.id} />
		</div>
	);
}

function FilaVolumen({ element, trackId }: { element: ClipConAudio; trackId: string }) {
	const param = getElementParam({ element, key: "volume" });
	if (!param) return null;
	return <FilaVolumenParam element={element} trackId={trackId} param={param} />;
}

function FilaVolumenParam({
	element,
	trackId,
	param,
}: {
	element: ClipConAudio;
	trackId: string;
	param: ElementParamDefinition;
}) {
	const grupo = useParamsConFotogramas({ element, trackId, params: [param] });
	const valor = Number(grupo.valores.volume ?? 0);
	return (
		<FilaAudio rotulo="Volumen" acciones={<AccionesGrupo grupo={grupo} />}>
			<DeslizadorValor
				valor={valor}
				min={VOLUME_DB_MIN}
				max={VOLUME_DB_MAX}
				paso={0.1}
				sufijo="dB"
				ariaLabel="Volumen"
				onPrevisualizar={(v) => grupo.previsualizar({ volume: v })}
				onConfirmar={grupo.confirmar}
			/>
		</FilaAudio>
	);
}

function FilaFundido({
	element,
	trackId,
	clave,
	otra,
}: {
	element: ClipConAudio;
	trackId: string;
	clave: string;
	otra: string;
}) {
	const param = getElementParam({ element, key: clave });
	if (!param) return null;
	return <FilaFundidoParam element={element} trackId={trackId} param={param} otra={otra} />;
}

function FilaFundidoParam({
	element,
	trackId,
	param,
	otra,
}: {
	element: ClipConAudio;
	trackId: string;
	param: ElementParamDefinition;
	otra: string;
}) {
	const grupo = useParamsConFotogramas({ element, trackId, params: [param] });
	const duracion = element.duration / TICKS_PER_SECOND;
	const otro = Number(element.params[otra] ?? 0) || 0;
	// Los dos fundidos no se pisan (igual que los círculos del clip).
	const max = Math.max(0.1, Math.floor((duracion - otro) * 10) / 10);
	const valor = Math.min(max, Number(grupo.valores[param.key] ?? 0) || 0);
	return (
		<FilaAudio rotulo={param.label} acciones={<AccionesGrupo grupo={grupo} animable={false} />}>
			<DeslizadorValor
				valor={valor}
				min={0}
				max={max}
				paso={0.1}
				sufijo="s"
				ariaLabel={param.label}
				onPrevisualizar={(v) => grupo.previsualizar({ [param.key]: Math.max(0, Math.min(max, v)) })}
				onConfirmar={grupo.confirmar}
			/>
		</FilaAudio>
	);
}

function SeccionNormalizar({
	element,
	trackId,
	mediaAssets,
}: {
	element: ClipConAudio;
	trackId: string;
	mediaAssets: ContextoInspector["mediaAssets"];
}) {
	const editor = useEditor();
	const [progreso, setProgreso] = useState<number | null>(null);
	const activa = element.params[NORMALIZAR] === true;
	const objetivo = String(element.params[NORMALIZAR_OBJETIVO] ?? OBJETIVO_PREDETERMINADO);

	const alternar = async (marcada: boolean) => {
		if (progreso !== null) return;
		if (marcada) setProgreso(0);
		try {
			const aplicado = await alternarNormalizacion({
				editor,
				trackId,
				element,
				mediaAssets,
				activar: marcada,
				onProgreso: (f) => setProgreso(f),
			});
			// `pc_loudness_adjusted` dice «Normalizar a %1 LUFS» (una orden donde
			// va un hecho): se corrige a lo que pasó.
			if (marcada && aplicado) toast.success(`Normalizado a ${aplicado} LUFS`);
			else if (marcada) toast.error("El clip no tiene sonido");
		} catch (error) {
			console.error("[normalizar]", error);
			toast.error("No se pudo normalizar");
		} finally {
			setProgreso(null);
		}
	};

	return (
		<SeccionCe
			titulo="Normalizar la intensidad"
			plegable={false}
			casilla={{ marcada: activa || progreso !== null, onCambio: (v) => void alternar(v) }}
		>
			{progreso !== null ? (
				<FilaCe>
					<span className="text-[12px] text-(--cc-text-3)">
						{/* `pc_loudness_process` */}
						Aplicando normalización de intensidad… {Math.round(progreso * 100)}%
					</span>
				</FilaCe>
			) : activa ? (
				<FilaAudio rotulo="Intensidad objetivo">
					<SelectCe
						valor={objetivo}
						ariaLabel="Intensidad objetivo"
						opciones={OBJETIVOS_INTENSIDAD.map((o) => ({ id: o.id, etiqueta: o.etiqueta }))}
						onCambio={(id) =>
							editor.timeline.updateElements({
								updates: [
									{
										trackId,
										elementId: element.id,
										patch: { params: { ...element.params, [NORMALIZAR_OBJETIVO]: id } },
									},
								],
							})
						}
					/>
				</FilaAudio>
			) : null}
		</SeccionCe>
	);
}

function SeccionRuido({ element, trackId }: { element: ClipConAudio; trackId: string }) {
	const editor = useEditor();
	const activa = element.params[REDUCIR_RUIDO] === true;
	return (
		<SeccionCe
			titulo="Reducir el ruido"
			plegable={false}
			casilla={{
				marcada: activa,
				onCambio: (v) =>
					editor.timeline.updateElements({
						updates: [
							{ trackId, elementId: element.id, patch: { params: { ...element.params, [REDUCIR_RUIDO]: v } } },
						],
					}),
			}}
		/>
	);
}
