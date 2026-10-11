"use client";

// =============================================================================
// Panel derecho › «Subtítulos» (con un subtítulo elegido)
// =============================================================================
// Como el panel de subtítulos de CapCut: TODAS las líneas de la escena, en orden,
// con su tiempo, editables en el lugar. Un clic en una línea la elige y lleva el
// cabezal a su inicio; la que está bajo el cabezal se marca. Abajo, «Aplicar en
// todos los subtítulos» copia el estilo del elegido (fuente, color, fondo,
// tamaño, posición…) a los demás.
//
// Editar el texto vuelve a partir las líneas (el motor no parte solo) dejando el
// borde de abajo donde estaba; Enter confirma y Mayús+Enter es un salto de línea
// propio. El tacho borra la línea (el de la casa, rojo).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { BuscadorBiblioteca, normalizarBusqueda } from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { bordeInferiorDe, partirYUbicar } from "../build-subtitle-text-element";
import {
	actualizarSubtitulos,
	aplicarEstiloASubtitulos,
	estiloDe,
	lienzoDe,
	subtitulosDe,
	type SubtituloEnPista,
} from "../insert";

// ⚠️ El panel derecho DESMONTA la pestaña cada vez que cambia el elemento elegido
// (la cáscara le pone el id del elemento en la `key`). Y elegir una línea de esta
// lista cambia el elegido. Sin esto, tocar el texto de otra línea la elegía, la
// pestaña se volvía a montar y el foco se perdía antes de poder escribir; y la
// búsqueda y el desplazamiento volvían a cero en cada clic. Lo que tiene que
// sobrevivir a ese remontaje vive acá, fuera del componente.
const memoria = { enfocar: null as string | null, busqueda: "", scroll: 0 };

function tiempo(ticks: number): string {
	const s = Math.max(0, ticks / TICKS_PER_SECOND);
	const m = Math.floor(s / 60);
	const resto = s - m * 60;
	return `${String(m).padStart(2, "0")}:${resto.toFixed(1).padStart(4, "0")}`;
}

function Linea({
	sub,
	elegida,
	enCabezal,
	onElegir,
}: {
	sub: SubtituloEnPista;
	elegida: boolean;
	enCabezal: boolean;
	onElegir: () => void;
}) {
	const editor = useEditor();
	const { element, track } = sub;
	const guardado = String(element.params.content ?? "");
	const [borrador, setBorrador] = useState(guardado);
	const ref = useRef<HTMLDivElement>(null);
	const campo = useRef<HTMLTextAreaElement>(null);

	// La línea cuyo texto se tocó antes del remontaje recupera el foco.
	useEffect(() => {
		if (memoria.enfocar !== element.id) return;
		memoria.enfocar = null;
		const t = campo.current;
		if (!t) return;
		t.focus();
		t.setSelectionRange(t.value.length, t.value.length);
	}, [element.id]);

	// Lo de afuera (deshacer, otra pestaña) pisa el borrador si no se está editando.
	useEffect(() => {
		if (document.activeElement?.closest("[data-linea]") !== ref.current) setBorrador(guardado);
	}, [guardado]);

	useEffect(() => {
		if (elegida) ref.current?.scrollIntoView({ block: "nearest" });
	}, [elegida]);

	const confirmar = () => {
		const texto = borrador.replace(/[ \t]+\n/g, "\n").trim();
		if (texto === guardado.trim()) return;
		if (!texto) {
			setBorrador(guardado);
			return;
		}
		const lienzo = lienzoDe(editor);
		const borde = bordeInferiorDe({ params: element.params, lienzo });
		const ubicado = partirYUbicar({
			params: { ...element.params, content: texto },
			lienzo,
			ubicacion: borde != null ? { bordeInferior: borde } : {},
		});
		// La X la decide el cliente si movió el subtítulo: sólo cambia el texto y la Y.
		actualizarSubtitulos({
			editor,
			cambios: [
				{
					trackId: track.id,
					elementId: element.id,
					params: { content: ubicado.content, "transform.positionY": ubicado["transform.positionY"] },
				},
			],
		});
	};

	return (
		<div
			ref={ref}
			data-linea
			onClick={onElegir}
			className={cn(
				"group flex cursor-pointer gap-2 rounded-[5px] border px-2 py-1.5",
				elegida
					? "border-primary bg-(--cc-raised)/60"
					: "border-transparent hover:bg-(--cc-raised)/40",
			)}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span
					className={cn(
						"text-[11px] tabular-nums",
						enCabezal ? "text-primary" : "text-(--cc-text-3)",
					)}
				>
					{tiempo(element.startTime)} – {tiempo(element.startTime + element.duration)}
				</span>
				<textarea
					ref={campo}
					value={borrador}
					rows={1}
					aria-label="Subtítulo"
					onChange={(e) => setBorrador(e.target.value)}
					onFocus={() => {
						if (elegida) return;
						memoria.enfocar = element.id;
						onElegir();
					}}
					onBlur={confirmar}
					onKeyDown={(e) => {
						// Las teclas del editor (Espacio = reproducir, Supr = borrar el clip)
						// no se disparan mientras se escribe.
						e.stopPropagation();
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							(e.target as HTMLTextAreaElement).blur();
						}
						if (e.key === "Escape") {
							setBorrador(guardado);
							(e.target as HTMLTextAreaElement).blur();
						}
					}}
					className="w-full resize-none bg-transparent text-[12px] leading-snug text-(--cc-text) outline-none [field-sizing:content]"
				/>
			</div>
			<button
				type="button"
				aria-label="Eliminar"
				title="Eliminar"
				onClick={(e) => {
					e.stopPropagation();
					editor.timeline.deleteElements({
						elements: [{ trackId: track.id, elementId: element.id }],
					});
				}}
				className="flex size-6 shrink-0 cursor-pointer items-center justify-center self-start rounded-[4px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-(--cc-raised)"
			>
				<IconoBorrar size={14} />
			</button>
		</div>
	);
}

export function PestanaSubtitulos({ element }: ContextoInspector) {
	const editor = useEditor();
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const lista = useMemo(() => subtitulosDe(tracks), [tracks]);
	// El índice bajo el cabezal (no el tiempo): así la lista se vuelve a dibujar
	// sólo cuando cambia de línea, no en cada cuadro de la reproducción.
	const enCabezal = useEditor((e) => {
		const t = e.playback.getCurrentTime();
		return lista.findIndex(
			({ element: el }) => t >= el.startTime && t < el.startTime + el.duration,
		);
	});
	const busqueda = useBuscador();
	const [aplicando, setAplicando] = useState(false);
	const desplazable = useRef<HTMLDivElement>(null);

	// Antes de pintar: el desplazamiento donde estaba (ver `memoria`).
	useLayoutEffect(() => {
		if (desplazable.current) desplazable.current.scrollTop = memoria.scroll;
	}, []);

	const visibles = busqueda.normalizado
		? lista.filter(({ element: el }) =>
				normalizarBusqueda(String(el.params.content ?? "")).includes(busqueda.normalizado),
			)
		: lista;

	const elegir = (sub: SubtituloEnPista) => {
		editor.selection.setSelectedElements({
			elements: [{ trackId: sub.track.id, elementId: sub.element.id }],
		});
		editor.playback.seek({ time: sub.element.startTime });
	};

	const aplicarATodos = async () => {
		if (aplicando) return;
		setAplicando(true);
		try {
			const fuente = element as TextElement;
			const lienzo = lienzoDe(editor);
			const n = await aplicarEstiloASubtitulos({
				editor,
				estilo: estiloDe(fuente),
				excepto: fuente.id,
				bordeComun: bordeInferiorDe({ params: fuente.params, lienzo }),
			});
			// `apply_to_all_subtitle`.
			if (n > 0) toast.success("Se aplicó a todos los subtítulos");
		} finally {
			setAplicando(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 px-3 pt-3 pb-2">
				<BuscadorBiblioteca valor={busqueda.valor} onCambio={busqueda.setValor} />
			</div>
			<div
				ref={desplazable}
				onScroll={(e) => {
					memoria.scroll = e.currentTarget.scrollTop;
				}}
				className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
			>
				{visibles.map((sub) => (
					<Linea
						key={sub.element.id}
						sub={sub}
						elegida={sub.element.id === element.id}
						enCabezal={lista[enCabezal]?.element.id === sub.element.id}
						onElegir={() => elegir(sub)}
					/>
				))}
				{visibles.length === 0 && (
					<p className="px-2 py-6 text-center text-[12px] text-(--cc-text-3)">No se encontraron resultados</p>
				)}
			</div>
			<div className="shrink-0 border-t border-(--cc-line-2) p-3">
				<Button
					type="button"
					variant="secondary"
					className="w-full"
					disabled={aplicando || lista.length < 2}
					onClick={() => void aplicarATodos()}
				>
					Aplicar en todos los subtítulos
				</Button>
			</div>
		</div>
	);
}

function useBuscador() {
	const [valor, setValorLocal] = useState(memoria.busqueda);
	const setValor = (v: string) => {
		memoria.busqueda = v;
		setValorLocal(v);
	};
	return { valor, setValor, normalizado: normalizarBusqueda(valor) };
}
