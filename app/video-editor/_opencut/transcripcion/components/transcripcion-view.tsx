"use client";

// =============================================================================
// Biblioteca › Subtítulos › «Transcripción»: editar el video editando el texto
// =============================================================================
// «Edición basada en la transcripción» de CapCut (`pc_text_cut_*`): la voz del video
// como texto; se eligen palabras y «Eliminar» saca esa parte del video («Elimina
// texto para eliminar partes correspondientes de tu video»). Y «Eliminar las
// muletillas» de una vez. Rótulos del es-LA.po de CapCut 9.3.
//
// La transcripción son los subtítulos con tiempos por palabra (transcripcion/
// modelo.ts): «Transcribir» es «Subtítulos automáticos», y lo que se borra acá se
// borra también del subtítulo. Un subtítulo sin tiempos (importado, escrito a mano o
// reescrito) se ve apagado y no se elige: no hay forma honesta de saber qué parte
// del video es cada palabra.
//
// Elegir: clic en una palabra (lleva el cabezal ahí), arrastrar o Mayús+clic para
// varias. Supr o Retroceso eliminan lo elegido; Esc lo suelta.
// Lo que CapCut tiene y acá no: copiar y pegar partes del video, «Mostrar texto
// eliminado», marcar pausas y repeticiones.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import {
	BuscadorBiblioteca,
	normalizarBusqueda,
	VacioBiblioteca,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { usePreferenciasSubtitulos, useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { cancelarGeneracion, generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { cortarTramosEnEditor } from "@/app/video-editor/_opencut/commands/timeline/element/cortar-tramos";
import { muletillasDe, palabrasEnOrden, tramosDePalabras, transcripcionDe, type PalabraTx } from "../modelo";

/** «1,2 s». */
const segundos = (s: number) => `${(Math.round(s * 10) / 10).toString().replace(".", ",")} s`;

/** Saca del video las palabras `ids` y lo dice en un aviso. */
function eliminarPalabras(
	editor: EditorCore,
	palabras: readonly PalabraTx[],
	ids: ReadonlySet<string>,
): boolean {
	const tramos = tramosDePalabras({ palabras, quitar: ids });
	if (tramos.length === 0) return false;
	const hecho = cortarTramosEnEditor(editor, tramos);
	if (!hecho) {
		// `pc_text_cut_no_found_main_track` (corto): la voz no está sobre un clip de la principal.
		toast.error("No hay video debajo en la pista principal");
		return false;
	}
	toast.success(`Se quitaron ${segundos(hecho.quitadoSegundos)}`);
	if (hecho.sinClip > 0) toast("Una parte no tenía video debajo");
	return true;
}

export function TranscripcionView() {
	const editor = useEditor();
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const idioma = usePreferenciasSubtitulos((s) => s.idioma);
	const { fase, progreso } = useTrabajoSubtitulos();
	const hayLinea = useEditor((e) => e.timeline.getTotalDuration() > 0);
	const parrafos = useMemo(() => transcripcionDe({ tracks, tps: TICKS_PER_SECOND }), [tracks]);
	const todas = useMemo(() => palabrasEnOrden(parrafos), [parrafos]);
	const lugar = useMemo(() => new Map(todas.map((p, i) => [p.id, i])), [todas]);
	const bloqueadas = useMemo(() => new Set(parrafos.filter((p) => p.bloqueado).map((p) => p.elementId)), [parrafos]);
	// Las de una pista bloqueada no: el video se cortaría y su subtítulo no.
	const muletillas = useMemo(() => {
		const todasLas = muletillasDe(parrafos, idioma);
		return new Set([...todasLas].filter((id) => !bloqueadas.has(id.split("#")[0])));
	}, [parrafos, idioma, bloqueadas]);
	// La palabra bajo el cabezal, como índice: la vista se vuelve a dibujar al cambiar de
	// palabra, no en cada cuadro.
	const actual = useEditor((e) => {
		const t = e.playback.getCurrentTime() / TICKS_PER_SECOND;
		return todas.findIndex((p) => t >= p.inicio && t < p.fin);
	});
	const reproduciendo = useEditor((e) => e.playback.getIsPlaying());

	const [eleccion, setEleccion] = useState<{ ancla: number; foco: number } | null>(null);
	const arrastrando = useRef(false);
	const [busqueda, setBusqueda] = useState("");
	const buscado = normalizarBusqueda(busqueda);
	const contenedor = useRef<HTMLDivElement>(null);
	const nodos = useRef(new Map<number, HTMLSpanElement>());

	// La línea de tiempo cambió (un corte, un deshacer): lo elegido ya no es lo mismo.
	useEffect(() => setEleccion(null), [todas]);

	// Al reproducir, la palabra que suena queda a la vista.
	useEffect(() => {
		if (reproduciendo && actual >= 0) nodos.current.get(actual)?.scrollIntoView({ block: "nearest" });
	}, [actual, reproduciendo]);

	useEffect(() => {
		const soltar = () => {
			arrastrando.current = false;
		};
		window.addEventListener("mouseup", soltar);
		return () => window.removeEventListener("mouseup", soltar);
	}, []);

	const desde = eleccion ? Math.min(eleccion.ancla, eleccion.foco) : -1;
	const hasta = eleccion ? Math.max(eleccion.ancla, eleccion.foco) : -2;
	/** Lo elegido, sin lo de pistas bloqueadas. */
	const elegidas = useMemo(() => {
		const ids = new Set<string>();
		for (let i = desde; i <= hasta; i++) if (!bloqueadas.has(todas[i].elementId)) ids.add(todas[i].id);
		return ids;
	}, [desde, hasta, todas, bloqueadas]);
	const coincide = (p: PalabraTx) => !!buscado && normalizarBusqueda(p.texto).includes(buscado);
	const resultados = buscado ? todas.filter(coincide).length : 0;

	const eliminar = (ids: ReadonlySet<string>) => {
		if (ids.size === 0) return;
		if (eliminarPalabras(editor, todas, ids)) setEleccion(null);
	};

	const alTeclado = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") setEleccion(null);
		else if ((e.key === "Delete" || e.key === "Backspace") && elegidas.size > 0) {
			e.preventDefault();
			e.stopPropagation();
			eliminar(elegidas);
		}
	};

	const alApretar = (i: number, e: React.MouseEvent) => {
		if (e.button !== 0) return;
		contenedor.current?.focus({ preventScroll: true });
		if (e.shiftKey && eleccion) {
			setEleccion({ ancla: eleccion.ancla, foco: i });
			return;
		}
		arrastrando.current = true;
		setEleccion({ ancla: i, foco: i });
		editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: todas[i].inicio }) });
	};

	if (parrafos.length === 0 || todas.length === 0) {
		const generando = fase !== "inactivo";
		return (
			<VacioBiblioteca
				texto={
					parrafos.length === 0
						? "Transcribe la voz de tu video. Puedes eliminar partes de tu video editando su transcripción."
						: "Tus subtítulos no tienen el tiempo de cada palabra. Vuelve a transcribir."
				}
			>
				{generando ? (
					<div className="flex items-center gap-2 text-[12px] text-(--cc-text-2)">
						<Spinner className="size-3.5" />
						<span>{fase === "modelo" ? `Descargando… ${progreso} %` : `Transcribiendo… ${progreso} %`}</span>
						<button type="button" onClick={cancelarGeneracion} className="cursor-pointer text-(--cc-text-3) hover:text-(--cc-text)">
							Cancelar
						</button>
					</div>
				) : (
					<Button type="button" disabled={!hayLinea} onClick={() => void generarSubtitulos(editor)}>
						Transcribir
					</Button>
				)}
			</VacioBiblioteca>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
				<BuscadorBiblioteca valor={busqueda} onCambio={setBusqueda} />
				<div className="flex min-h-7 items-center justify-between gap-2 text-[12px] text-(--cc-text-3)">
					{elegidas.size > 0 ? (
						<>
							<span>{elegidas.size === 1 ? "1 palabra" : `${elegidas.size} palabras`}</span>
							<Button type="button" size="sm" variant="destructive" onClick={() => eliminar(elegidas)}>
								Eliminar
							</Button>
						</>
					) : buscado ? (
						// `pc_text_cut_matches_criteria(_plur)`.
						<span>{resultados === 1 ? "Se encontró 1 resultado" : `Se encontraron ${resultados} resultados`}</span>
					) : muletillas.size > 0 ? (
						<>
							<span>{muletillas.size === 1 ? "1 muletilla" : `${muletillas.size} muletillas`}</span>
							<Button type="button" size="sm" variant="secondary" onClick={() => eliminar(muletillas)}>
								Eliminar las muletillas
							</Button>
						</>
					) : (
						<span>Elige palabras para eliminarlas</span>
					)}
				</div>
			</div>
			<div
				ref={contenedor}
				tabIndex={0}
				onKeyDown={alTeclado}
				className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3 outline-none select-none"
				aria-label="Transcripción"
			>
				{parrafos.map((parrafo) => (
					<p
						key={parrafo.elementId}
						className={cn(
							"mb-2.5 text-[13px] leading-6 text-(--cc-text)",
							(parrafo.palabras.length === 0 || parrafo.bloqueado) && "text-(--cc-text-3)",
						)}
						title={parrafo.palabras.length === 0 ? "Sin el tiempo de cada palabra" : parrafo.bloqueado ? "Pista bloqueada" : undefined}
					>
						{parrafo.palabras.length === 0
							? parrafo.texto
							: parrafo.palabras.map((p) => {
									const i = lugar.get(p.id) ?? -1;
									const elegida = i >= desde && i <= hasta;
									const esMuletilla = muletillas.has(p.id);
									return (
										<span
											key={p.id}
											ref={(n) => {
												if (n) nodos.current.set(i, n);
												else nodos.current.delete(i);
											}}
											onMouseDown={(e) => alApretar(i, e)}
											onMouseEnter={() => {
												if (arrastrando.current && eleccion) setEleccion({ ancla: eleccion.ancla, foco: i });
											}}
											title={esMuletilla ? "Muletilla" : undefined}
											className={cn(
												"cursor-text rounded-[3px] px-[1px]",
												esMuletilla && "text-(--cc-text-3) italic underline decoration-dotted",
												i === actual && "text-primary",
												coincide(p) && "bg-(--cc-raised)",
												elegida && "bg-primary/25 text-(--cc-text)",
											)}
										>
											{p.texto}{" "}
										</span>
									);
								})}
					</p>
				))}
			</div>
		</div>
	);
}
