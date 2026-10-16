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
// borde de abajo donde estaba. El tacho borra la línea (el de la casa, rojo).
//
// Los atajos son los de la ayuda de CapCut (`pc_double_click_delete`), con las teclas
// de Windows: Enter en el medio DIVIDE el subtítulo; Enter al principio o al final
// sale de la edición; Ctrl+Enter (y Mayús+Enter) es un salto de línea; Retroceso al
// principio COMBINA con el de arriba y Supr al final, con el de abajo (subtitles/
// editar.ts). Y «Buscar y reemplazar» (`find replace`): «Sustituir» en el elegido y
// «Reemplazar todo». ⚠️ El campo de CapCut dice «Reemplazar como» (`pc_replace_with`),
// un error de traducción de «Replace with»: acá va «Reemplazar con».
//
// «Animaciones de subtítulos» (el karaoke de CapCut, text/resaltado.ts): «Subtítulos
// pronunciados» (Ninguno · Palabra · Frase, y su color) y «Subtítulos no pronunciados»
// (su opacidad). Como una plantilla, va a TODOS los subtítulos de una vez y en un solo
// paso de deshacer. Sin tiempos por palabra no hace nada: en vez de los controles, el
// aviso de dónde se consiguen.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, SearchReplaceIcon } from "@hugeicons/core-free-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/video-editor/_opencut/components/ui/tooltip";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { BuscadorBiblioteca, normalizarBusqueda } from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { bordeInferiorDe } from "../build-subtitle-text-element";
import {
	actualizarSubtitulos,
	aplicarEstiloASubtitulos,
	estiloDe,
	lienzoDe,
	subtitulosDe,
	type SubtituloEnPista,
} from "../insert";
import { combinarSubtitulo, dividirSubtitulo, paramsConTexto, reemplazarEnSubtitulos } from "../editar";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import {
	BotonRestablecer,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
	SegmentadoCe,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { useElementPreview } from "@/app/video-editor/_opencut/timeline/hooks/use-element-preview";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import {
	DEFAULTS_RESALTADO,
	MODOS_RESALTAR,
	PARAM_NO_DICHAS_OPACIDAD,
	PARAM_RESALTAR,
	PARAM_RESALTAR_COLOR,
	type ModoResaltar,
} from "@/app/video-editor/_opencut/params/extra/subtitulos";
import { tieneTiemposPorPalabra } from "@/app/video-editor/_opencut/text/resaltado";

// ⚠️ El panel derecho DESMONTA la pestaña cada vez que cambia el elemento elegido
// (la cáscara le pone el id del elemento en la `key`). Y elegir una línea de esta
// lista cambia el elegido. Sin esto, tocar el texto de otra línea la elegía, la
// pestaña se volvía a montar y el foco se perdía antes de poder escribir; y la
// búsqueda y el desplazamiento volvían a cero en cada clic. Lo que tiene que
// sobrevivir a ese remontaje vive acá, fuera del componente.
const memoria = { enfocar: null as string | null, cursor: null as number | null, busqueda: "", reemplazo: "", reemplazando: false, scroll: 0 };

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
	// Dividir o combinar ya usaron lo escrito: el blur que sigue no lo vuelve a escribir.
	const saltarConfirmar = useRef(false);

	// La línea cuyo texto se tocó antes del remontaje recupera el foco (y el cursor donde
	// lo dejó dividir o combinar).
	useEffect(() => {
		if (memoria.enfocar !== element.id) return;
		memoria.enfocar = null;
		const t = campo.current;
		if (!t) return;
		t.focus();
		const c = memoria.cursor ?? t.value.length;
		memoria.cursor = null;
		t.setSelectionRange(c, c);
	}, [element.id]);

	// Lo de afuera (deshacer, otra pestaña) pisa el borrador si no se está editando.
	useEffect(() => {
		if (document.activeElement?.closest("[data-linea]") !== ref.current) setBorrador(guardado);
	}, [guardado]);

	useEffect(() => {
		if (elegida) ref.current?.scrollIntoView({ block: "nearest" });
	}, [elegida]);

	const confirmar = () => {
		if (saltarConfirmar.current) {
			saltarConfirmar.current = false;
			return;
		}
		const texto = borrador.replace(/[ \t]+\n/g, "\n").trim();
		if (texto === guardado.trim()) return;
		if (!texto) {
			setBorrador(guardado);
			return;
		}
		// Corregir una palabra no cambia cuándo se dijo: la regla vive en subtitles/editar.ts
		// (`paramsConTexto`), que la usa también el chat.
		actualizarSubtitulos({
			editor,
			cambios: [{ trackId: track.id, elementId: element.id, params: paramsConTexto(editor, element, texto) }],
		});
	};

	/** Dividir o combinar con lo escrito; si no se puede, el aviso de CapCut. */
	const dividir = (t: HTMLTextAreaElement) => {
		saltarConfirmar.current = true;
		const nuevo = dividirSubtitulo({ editor, trackId: track.id, elementId: element.id, texto: t.value, cursor: t.selectionStart });
		if (!nuevo) {
			saltarConfirmar.current = false;
			// `pc_captions_cannot_split_here`.
			toast("No se puede dividir aquí");
			return;
		}
		// El cursor va al principio del subtítulo nuevo, como en CapCut.
		memoria.enfocar = nuevo;
		memoria.cursor = 0;
		editor.selection.setSelectedElements({ elements: [{ trackId: track.id, elementId: nuevo }] });
	};
	const combinarCon = (t: HTMLTextAreaElement, direccion: "arriba" | "abajo") => {
		saltarConfirmar.current = true;
		const queda = combinarSubtitulo({ editor, trackId: track.id, elementId: element.id, texto: t.value, direccion });
		if (!queda) {
			saltarConfirmar.current = false;
			// `pc_captions_cannot_merge_here`.
			toast("No se puede combinar aquí");
			return;
		}
		// El cursor queda en la unión de los dos textos.
		const sobrevive = subtitulosDe(editor.scenes.getActiveSceneOrNull()?.tracks).find((s) => s.element.id === queda);
		const textoNuevo = String(sobrevive?.element.params.content ?? "");
		memoria.enfocar = queda;
		memoria.cursor = direccion === "arriba" ? Math.max(0, textoNuevo.length - t.value.trim().length) : t.value.trim().length;
		editor.selection.setSelectedElements({ elements: [{ trackId: track.id, elementId: queda }] });
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
						const t = e.currentTarget;
						const sinSeleccion = t.selectionStart === t.selectionEnd;
						const alPrincipio = sinSeleccion && t.selectionStart === 0;
						const alFinal = sinSeleccion && t.selectionStart >= t.value.trimEnd().length;
						if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
							// «Empezar una nueva línea: Command + Enter» (Ctrl en Windows).
							e.preventDefault();
							const a = t.selectionStart;
							setBorrador(`${t.value.slice(0, a)}\n${t.value.slice(t.selectionEnd)}`);
							requestAnimationFrame(() => t.setSelectionRange(a + 1, a + 1));
							return;
						}
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault();
							// Al principio o al final: salir de la edición. En el medio: dividir.
							if (alPrincipio || alFinal || !sinSeleccion) t.blur();
							else dividir(t);
							return;
						}
						if (e.key === "Backspace" && alPrincipio) {
							e.preventDefault();
							combinarCon(t, "arriba");
							return;
						}
						if (e.key === "Delete" && alFinal) {
							e.preventDefault();
							combinarCon(t, "abajo");
							return;
						}
						if (e.key === "Escape") {
							setBorrador(guardado);
							t.blur();
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

const OPCIONES_PRONUNCIADOS: ReadonlyArray<{ id: ModoResaltar; etiqueta: string }> = [
	{ id: "ninguno", etiqueta: "Ninguno" },
	// «Palabra pronunciada» / «Frase pronunciada»: el título de arriba ya dice «pronunciados».
	{ id: "palabra", etiqueta: "Palabra" },
	{ id: "frase", etiqueta: "Frase" },
];

/** «Animaciones de subtítulos»: el resaltado de TODOS los subtítulos (ver el encabezado). */
function AnimacionSubtitulos({
	element,
	trackId,
	lista,
}: {
	element: TextElement;
	trackId: string;
	lista: SubtituloEnPista[];
}) {
	const editor = useEditor();
	// Lo que se MUESTRA sale del elemento vivo: el número se mueve mientras se arrastra.
	const { renderElement: vivo } = useElementPreview({ trackId, elementId: element.id, fallback: element });
	const p = vivo.params;
	const modo: ModoResaltar = MODOS_RESALTAR.includes(p[PARAM_RESALTAR] as ModoResaltar)
		? (p[PARAM_RESALTAR] as ModoResaltar)
		: DEFAULTS_RESALTADO.modo;
	const color = typeof p[PARAM_RESALTAR_COLOR] === "string" ? String(p[PARAM_RESALTAR_COLOR]) : DEFAULTS_RESALTADO.color;
	const opacidad =
		typeof p[PARAM_NO_DICHAS_OPACIDAD] === "number" ? Number(p[PARAM_NO_DICHAS_OPACIDAD]) : DEFAULTS_RESALTADO.noDichasOpacidad;
	const conTiempos = useMemo(() => lista.some(({ element: el }) => tieneTiemposPorPalabra(el.params)), [lista]);
	const esteConTiempos = tieneTiemposPorPalabra(element.params);

	// Las escrituras parten de los subtítulos CONFIRMADOS (`lista`), no de la vista previa:
	// arrastrar recalcula desde el mismo punto. La vista previa va en UN `previewElements`
	// y se confirma con un solo paso de deshacer (commitPreview).
	const previsualizar = (cambios: ParamValues) =>
		editor.timeline.previewElements({
			updates: lista.map(({ track, element: el }) => ({
				trackId: track.id,
				elementId: el.id,
				updates: { params: { ...el.params, ...cambios } },
			})),
		});
	const confirmar = () => editor.timeline.commitPreview();
	const aplicar = (cambios: ParamValues) =>
		actualizarSubtitulos({
			editor,
			cambios: lista.map(({ track, element: el }) => ({ trackId: track.id, elementId: el.id, params: cambios })),
		});

	return (
		<SeccionCe titulo="Animaciones de subtítulos" clave="ce:subtitulos:animacion">
			{!conTiempos ? (
				<p className="py-1 text-[12px] text-(--cc-text-3)">Sin tiempos por palabra: usa Subtítulos automáticos</p>
			) : (
				<>
					<p className="pb-1.5 text-[12px] text-(--cc-text-2)">Subtítulos pronunciados</p>
					<SegmentadoCe
						opciones={OPCIONES_PRONUNCIADOS}
						valor={modo}
						onCambio={(v) => v !== modo && aplicar({ [PARAM_RESALTAR]: v })}
					/>
					{modo !== "ninguno" && (
						<>
							<FilaCe
								rotulo="Color"
								acciones={
									<BotonRestablecer
										desactivado={color.toLowerCase() === DEFAULTS_RESALTADO.color}
										onClick={() => aplicar({ [PARAM_RESALTAR_COLOR]: DEFAULTS_RESALTADO.color })}
									/>
								}
							>
								<ColorPicker
									className="w-full"
									value={color.replace(/^#/, "").toUpperCase()}
									onChange={(c) => previsualizar({ [PARAM_RESALTAR_COLOR]: `#${c}` })}
									onChangeEnd={(c) => {
										previsualizar({ [PARAM_RESALTAR_COLOR]: `#${c}` });
										confirmar();
									}}
								/>
							</FilaCe>
							<p className="pt-1 text-[12px] text-(--cc-text-2)">Subtítulos no pronunciados</p>
							<FilaCe
								rotulo="Opacidad"
								acciones={
									<BotonRestablecer
										desactivado={opacidad === DEFAULTS_RESALTADO.noDichasOpacidad}
										onClick={() => aplicar({ [PARAM_NO_DICHAS_OPACIDAD]: DEFAULTS_RESALTADO.noDichasOpacidad })}
									/>
								}
							>
								<DeslizadorValor
									valor={opacidad}
									min={0}
									max={100}
									paso={1}
									sufijo="%"
									ariaLabel="Opacidad de lo no pronunciado"
									onPrevisualizar={(v) => previsualizar({ [PARAM_NO_DICHAS_OPACIDAD]: v })}
									onConfirmar={confirmar}
								/>
							</FilaCe>
						</>
					)}
					{!esteConTiempos && (
						<p className="pt-1.5 text-[11.5px] text-(--cc-text-3)">Este subtítulo no tiene tiempos por palabra</p>
					)}
				</>
			)}
		</SeccionCe>
	);
}

export function PestanaSubtitulos({ element, track }: ContextoInspector) {
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
	const reemplazo = useReemplazo();
	const [aplicando, setAplicando] = useState(false);

	/** «Sustituir» (en el elegido) o «Reemplazar todo»: un solo paso de deshacer. */
	const reemplazar = (soloId?: string) => {
		const n = reemplazarEnSubtitulos({ editor, buscar: busqueda.valor, reemplazo: reemplazo.valor, soloId });
		// `pc_replacement_succeeded` / `pc_find_content_does_not_exist`.
		if (n > 0) toast.success("Sustituido");
		else toast("No se encontraron resultados");
	};
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
			<div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
				<div className="flex items-center gap-1">
					<div className="min-w-0 flex-1">
						<BuscadorBiblioteca valor={busqueda.valor} onCambio={busqueda.setValor} />
					</div>
					<button
						type="button"
						aria-pressed={reemplazo.abierto}
						onClick={() => reemplazo.alternar()}
						title="Buscar y reemplazar"
						aria-label="Buscar y reemplazar"
						className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-(--cc-raised) aria-pressed:bg-(--cc-raised) aria-pressed:text-primary"
					>
						<HugeiconsIcon icon={SearchReplaceIcon} className="size-4" />
					</button>
					<Tooltip>
						<TooltipTrigger asChild>
							<span
								tabIndex={0}
								aria-label="Atajos de los subtítulos"
								className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-(--cc-raised)"
							>
								<HugeiconsIcon icon={InformationCircleIcon} className="size-4" />
							</span>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="max-w-[260px] whitespace-pre-line text-[11.5px] leading-snug">
							{AYUDA_ATAJOS}
						</TooltipContent>
					</Tooltip>
				</div>
				{reemplazo.abierto && (
					<div className="flex items-center gap-1.5">
						<input
							value={reemplazo.valor}
							onChange={(e) => reemplazo.setValor(e.target.value)}
							onKeyDown={(e) => e.stopPropagation()}
							placeholder="Reemplazar con"
							aria-label="Reemplazar con"
							className="h-7 min-w-0 flex-1 rounded-[4px] bg-(--cc-input) px-2 text-[12px] text-(--cc-text) outline-none placeholder:text-(--cc-text-3) focus:ring-1 focus:ring-primary"
						/>
						<Button type="button" variant="secondary" size="sm" disabled={!busqueda.valor.trim()} onClick={() => reemplazar(element.id)}>
							Sustituir
						</Button>
						<Button type="button" variant="secondary" size="sm" disabled={!busqueda.valor.trim()} onClick={() => reemplazar()}>
							Reemplazar todo
						</Button>
					</div>
				)}
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
			<div className="shrink-0 border-t border-(--cc-line-2)">
				<AnimacionSubtitulos element={element as TextElement} trackId={track.id} lista={lista} />
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

/**
 * La ayuda de los atajos (`pc_double_click_delete` de CapCut), con las teclas de Windows:
 * Command → Ctrl, Delete → Retroceso, Fn + Delete → Supr. Sin la primera línea de CapCut
 * («doble clic en el número»): acá la lista no tiene números y un clic ya lleva ahí.
 */
const AYUDA_ATAJOS = [
	"• Dividir un subtítulo: Enter",
	"• Salir de la edición: coloca el cursor al principio o al final de un subtítulo y pulsa Enter",
	"• Empezar una nueva línea: Ctrl + Enter",
	"• Combinar hacia arriba: coloca el cursor al principio de un subtítulo y pulsa Retroceso",
	"• Combinar hacia abajo: coloca el cursor al final de un subtítulo y pulsa Supr",
].join("\n");

function useReemplazo() {
	const [abierto, setAbierto] = useState(memoria.reemplazando);
	const [valor, setValorLocal] = useState(memoria.reemplazo);
	return {
		abierto,
		valor,
		alternar: () => {
			memoria.reemplazando = !abierto;
			setAbierto(!abierto);
		},
		setValor: (v: string) => {
			memoria.reemplazo = v;
			setValorLocal(v);
		},
	};
}

function useBuscador() {
	const [valor, setValorLocal] = useState(memoria.busqueda);
	const setValor = (v: string) => {
		memoria.busqueda = v;
		setValorLocal(v);
	};
	return { valor, setValor, normalizado: normalizarBusqueda(valor) };
}
