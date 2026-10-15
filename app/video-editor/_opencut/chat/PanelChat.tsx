"use client";

// =============================================================================
// PanelChat — «Editar con IA»: el chat al costado del Video Editor
// =============================================================================
// Pedido de Martín (15/10/2026): «es importante que video editor tenga, como landing, un
// chat al costado donde pueda ir editando todo con prompt». CapCut no tiene un chat así:
// la fuente es el del Landing Generator (app/web-generator/editor/paneles/
// PanelAgente.tsx, copiado de Gamma 5) y se copia su comportamiento, con los colores de
// CapCut (`--cc-*`):
//   · mensajes del agente en burbuja gris a la izquierda y de la persona a la derecha;
//   · sugerencias en píldoras; input al pie «Envía un mensaje al agente…» con el enviar
//     redondo; mientras la IA trabaja, «Espera a que la IA termine» y el cuadrado de detener;
//   · el alcance en chips: «Todo el video» o lo elegido en la línea de tiempo;
//   · la respuesta es un CAMBIO PROPUESTO con «Original | Modificado», que se acepta o se
//     descarta entero; después de aceptar, «Restaurar» lo vuelve atrás.
// El hilo vive en la memoria de la pestaña, por proyecto (como el del Landing: no hay tabla
// para eso). Nada se aplica sin «Aceptar»: lo fija tests/video-editor-chat.test.ts.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, ArrowUp02Icon, Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TOPES_CHAT, validarOperaciones } from "@/lib/editor-video/chat-catalogo";
import { resumenDeCambios, revisarOperaciones, vistaDeLinea, type CambioChat } from "./linea";
import { aceptarPropuesta, deshacerPropuesta, type AplicadaChat, type PropuestaChat } from "./aplicar";
import { datosDeLinea, disponiblesChat } from "./contexto";

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;

type EstadoPropuesta = "pendiente" | "aplicando" | "sin-version" | "aplicada" | "descartada" | "restaurada";

type Mensaje =
	| { id: number; de: "yo"; texto: string; alcance: string | null }
	| {
			id: number;
			de: "mako";
			texto: string;
			error?: boolean;
			propuesta?: PropuestaChat;
			cambios?: CambioChat[];
			descartes?: string[];
			estado?: EstadoPropuesta;
			aviso?: string;
			aplicada?: AplicadaChat;
	  };

// ─────────────────────────────────────────────────────────────────────────────
// El hilo: un store de módulo, por proyecto
// ─────────────────────────────────────────────────────────────────────────────
// Un store y no un estado del componente: el panel se cierra y se desmonta, y la respuesta
// de un pedido largo tiene que caer en el chat aunque el panel no esté abierto cuando llega.
// Se pierde al recargar la pestaña, como el del Landing.

type Hilo = { mensajes: Mensaje[]; corriendo: boolean };
const HILO_VACIO: Hilo = { mensajes: [], corriendo: false };
const hilos = new Map<string, Hilo>();
const cortes = new Map<string, AbortController>();
const oyentes = new Set<() => void>();
let ultimoId = 0;

function cambiarHilo(proyectoId: string, f: (h: Hilo) => Hilo) {
	hilos.set(proyectoId, f(hilos.get(proyectoId) ?? HILO_VACIO));
	for (const o of oyentes) o();
}
function cambiarMensaje(proyectoId: string, id: number, cambio: Partial<Extract<Mensaje, { de: "mako" }>>) {
	cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: h.mensajes.map((m) => (m.id === id && m.de === "mako" ? { ...m, ...cambio } : m)) }));
}
const suscribir = (f: () => void) => {
	oyentes.add(f);
	return () => { oyentes.delete(f); };
};
function useHilo(proyectoId: string): Hilo {
	return useSyncExternalStore(suscribir, () => hilos.get(proyectoId) ?? HILO_VACIO, () => HILO_VACIO);
}

type Respuesta = { ok: true; resumen: string; operaciones: unknown[] } | { ok: false; error: string };

/** El pedido a la ruta. Un corte de la persona no es un error (no se pinta en rojo). */
async function pedirIA(cuerpo: object, senal: AbortSignal): Promise<Respuesta | { ok: false; error: string; cortado: true }> {
	const plazo = new AbortController();
	const t = setTimeout(() => plazo.abort(), PLAZO_MS);
	const alCortar = () => plazo.abort();
	senal.addEventListener("abort", alCortar);
	try {
		const res = await fetch("/api/video-editor/ia", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(cuerpo),
			signal: plazo.signal,
		});
		const json = (await res.json().catch(() => null)) as Respuesta | null;
		if (!json) return { ok: false, error: "MaKo no respondió. Vuelve a intentar." };
		return json;
	} catch {
		if (senal.aborted) return { ok: false, error: "Detenido.", cortado: true };
		return { ok: false, error: "MaKo tardó demasiado. Vuelve a intentar." };
	} finally {
		clearTimeout(t);
		senal.removeEventListener("abort", alCortar);
	}
}

/** Manda una instrucción. Corre afuera del componente: su respuesta cae en el store. */
async function pedirEdicion(editor: EditorCore, instruccion: string, alcance: "video" | "seleccion"): Promise<void> {
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	const texto = instruccion.trim();
	if (!proyecto || !escena || !texto) return;
	const proyectoId = proyecto.metadata.id;
	if (hilos.get(proyectoId)?.corriendo) return;

	const elegidos = editor.selection.getSelectedElements().map((e) => ({ trackId: e.trackId, elementId: e.elementId }));
	const alcanceReal = alcance === "seleccion" && elegidos.length ? "seleccion" : "video";
	cambiarHilo(proyectoId, (h) => ({
		corriendo: true,
		mensajes: [...h.mensajes, { id: ++ultimoId, de: "yo", texto, alcance: alcanceReal === "seleccion" ? rotuloSeleccion(elegidos.length) : null }],
	}));
	const terminar = (m: Mensaje) => cambiarHilo(proyectoId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, m] }));

	// Lo que el motor tiene con nombre (la primera vez espera la lista de fuentes) y, recién
	// después, la línea de tiempo de ese momento: la misma que se le manda a la IA.
	const disponibles = await disponiblesChat(editor);
	const escenaAhora = editor.scenes.getActiveSceneOrNull();
	if (!escenaAhora || escenaAhora.id !== escena.id) {
		terminar({ id: ++ultimoId, de: "mako", texto: "Cambiaste de escena. Vuelve a pedirlo.", error: true });
		return;
	}
	const tracks = escenaAhora.tracks;
	const datos = datosDeLinea(editor, tracks);
	const vista = vistaDeLinea({
		tracks,
		tps: TICKS_PER_SECOND,
		cabezal: editor.playback.getCurrentTime(),
		elegidos,
		disponibles,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
	});

	if (vista.json.length > TOPES_CHAT.vistaMax) {
		terminar({ id: ++ultimoId, de: "mako", texto: "El proyecto es muy grande para el chat. Elige unos clips y pídelo sobre la selección.", error: true });
		return;
	}

	const corte = new AbortController();
	cortes.set(proyectoId, corte);
	const r = await pedirIA({ instruccion: texto, linea: vista.json, alcance: alcanceReal }, corte.signal);
	cortes.delete(proyectoId);
	if (!r.ok) {
		terminar({ id: ++ultimoId, de: "mako", texto: r.error, error: !("cortado" in r) });
		return;
	}
	// La forma ya la validó la ruta; acá se vuelve a validar (el editor no le cree a nadie) y se
	// revisan las referencias contra la vista con la que se pidió.
	const { operaciones, descartes: deForma } = validarOperaciones(r.operaciones);
	const revision = revisarOperaciones({ operaciones, vista, alcance: alcanceReal, transcripcion: datos.transcripcion });
	const descartes = [...deForma, ...revision.descartes];
	if (!revision.resueltas.length) {
		terminar({ id: ++ultimoId, de: "mako", texto: r.resumen || "Sin cambios.", descartes: descartes.length ? descartes : undefined });
		return;
	}
	const refsPorId = new Map([...vista.refs.values()].map((x) => [x.elementId, x.ref] as const));
	terminar({
		id: ++ultimoId,
		de: "mako",
		texto: r.resumen || "Listo.",
		estado: "pendiente",
		cambios: revision.cambios,
		descartes: descartes.length ? descartes : undefined,
		propuesta: { proyectoId, escenaId: escena.id, tracksEnviados: tracks, refsPorId, elegidos, alcance: alcanceReal, operaciones },
	});
}

const rotuloSeleccion = (n: number) => (n === 1 ? "1 elemento elegido" : `${n} elementos elegidos`);

// ─────────────────────────────────────────────────────────────────────────────
// La revisión de una propuesta: «Original | Modificado»
// ─────────────────────────────────────────────────────────────────────────────

const ETIQUETA_CAMBIO: Record<CambioChat["tipo"], string> = { cambia: "Cambia", agrega: "Nuevo", quita: "Se quita" };
const MAX_FILAS = 8;

function RevisionPropuesta({
	cambios,
	descartes,
	estado,
	aviso,
	tocada,
	onAceptar,
	onAplicarIgual,
	onDescartar,
	onRestaurar,
}: {
	cambios: CambioChat[];
	descartes?: string[];
	estado: EstadoPropuesta;
	aviso?: string;
	tocada: boolean;
	onAceptar: () => void;
	onAplicarIgual: () => void;
	onDescartar: () => void;
	onRestaurar: () => void;
}) {
	const [vista, setVista] = useState<"original" | "modificado">("modificado");
	const filas = cambios.slice(0, MAX_FILAS);
	const boton = "flex h-7 cursor-pointer items-center rounded-[4px] px-3 text-[12px] font-medium";
	return (
		<div className="grid gap-2 rounded-[8px] bg-(--cc-sunken) p-2.5">
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[12px] font-semibold text-(--cc-text)">{resumenDeCambios(cambios) || "Sin cambios"}</span>
				<div className="flex shrink-0 rounded-[4px] bg-(--cc-panel) p-0.5" role="group" aria-label="Comparar">
					{(["original", "modificado"] as const).map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={vista === v}
							onClick={() => setVista(v)}
							className="h-6 cursor-pointer rounded-[3px] px-2 text-[11px] text-(--cc-text-3) aria-pressed:bg-(--cc-raised) aria-pressed:text-(--cc-text)"
						>
							{v === "original" ? "Original" : "Modificado"}
						</button>
					))}
				</div>
			</div>
			<ul className="grid gap-1.5">
				{filas.map((c, i) => {
					const lado = vista === "original" ? c.antes : c.despues;
					return (
						<li key={`${c.tipo}:${i}`} className="grid gap-0.5 rounded-[6px] bg-(--cc-panel) px-2.5 py-2">
							<div className="flex min-w-0 items-center gap-1.5">
								<span
									className="shrink-0 rounded-[3px] px-1.5 py-px text-[10px] font-semibold"
									style={{
										background: c.tipo === "agrega" ? "color-mix(in srgb, var(--cc-accent) 22%, transparent)" : c.tipo === "quita" ? "color-mix(in srgb, var(--destructive) 22%, transparent)" : "var(--cc-raised)",
										color: c.tipo === "agrega" ? "var(--cc-accent)" : c.tipo === "quita" ? "var(--destructive)" : "var(--cc-text-2)",
									}}
								>
									{ETIQUETA_CAMBIO[c.tipo]}
								</span>
								<b className="min-w-0 truncate text-[12px] font-medium text-(--cc-text)">{c.titulo}</b>
							</div>
							<p className={`m-0 text-[12px] text-(--cc-text-2) ${vista === "original" && c.tipo === "cambia" ? "line-through decoration-(--cc-text-3)" : ""}`}>
								{lado || (vista === "original" ? "No existía" : "Se quita")}
							</p>
						</li>
					);
				})}
			</ul>
			{cambios.length > MAX_FILAS && <span className="text-[11px] text-(--cc-text-3)">y {cambios.length - MAX_FILAS} más</span>}
			{descartes && descartes.length > 0 && (
				<p className="m-0 rounded-[6px] bg-(--cc-panel) px-2.5 py-1.5 text-[11.5px] text-(--cc-text-3)">
					No se aplica: {descartes.slice(0, 3).join(" · ")}
					{descartes.length > 3 ? ` y ${descartes.length - 3} más` : ""}
				</p>
			)}
			{tocada && estado === "pendiente" && (
				<p className="m-0 rounded-[6px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "color-mix(in srgb, var(--caution) 18%, transparent)", color: "var(--caution)" }}>
					Cambiaste la línea de tiempo mientras tanto.
				</p>
			)}
			{aviso && (
				<p role="alert" className="m-0 rounded-[6px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "color-mix(in srgb, var(--destructive) 18%, transparent)", color: "var(--destructive)" }}>
					{aviso}
				</p>
			)}
			<div className="flex flex-wrap items-center justify-end gap-2">
				{estado === "pendiente" && (
					<>
						<button type="button" onClick={onDescartar} className={`${boton} text-(--cc-text-2) hover:bg-(--cc-raised)`}>Descartar</button>
						<button type="button" onClick={onAceptar} className={`${boton} bg-(--cc-accent) text-black hover:brightness-110`}>Aceptar</button>
					</>
				)}
				{estado === "aplicando" && <span className="mr-auto size-4 animate-spin rounded-full border-2 border-(--cc-text-3) border-t-transparent" aria-label="Aplicando" />}
				{estado === "sin-version" && (
					<>
						<button type="button" onClick={onDescartar} className={`${boton} text-(--cc-text-2) hover:bg-(--cc-raised)`}>Descartar</button>
						<button type="button" onClick={onAplicarIgual} className={`${boton} bg-(--cc-btn-2) text-(--cc-text) hover:brightness-125`}>Aplicar igual</button>
					</>
				)}
				{estado === "aplicada" && (
					<>
						<span className="mr-auto flex items-center gap-1 text-[12px] font-semibold text-(--cc-text-2)">
							<HugeiconsIcon icon={Tick02Icon} className="size-3.5" /> Aplicado
						</span>
						<button type="button" onClick={onRestaurar} className={`${boton} border border-(--cc-btn-2) text-(--cc-text) hover:bg-(--cc-raised)`}>Restaurar</button>
					</>
				)}
				{estado === "descartada" && <span className="mr-auto text-[12px] font-semibold text-(--cc-text-3)">Descartado</span>}
				{estado === "restaurada" && <span className="mr-auto text-[12px] font-semibold text-(--cc-text-3)">Restaurado</span>}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla
// ─────────────────────────────────────────────────────────────────────────────

/** Las sugerencias: el rótulo es lo que se ve; `instruccion`, lo que se pide; `rellenar` deja el texto para completar. */
type Sugerencia = { rotulo: string; instruccion?: string; rellenar?: string; necesitaSeleccion?: boolean };
const SUGERENCIAS: Sugerencia[] = [
	{ rotulo: "Agrega un título", rellenar: "Agrega al inicio un título de 3 segundos que diga: " },
	{ rotulo: "Corta en el cabezal", instruccion: "Corta lo elegido donde está el cabezal.", necesitaSeleccion: true },
	{ rotulo: "Transiciones suaves", instruccion: "Pon la transición Mezclar en cada corte de la pista principal." },
	{ rotulo: "Quita las muletillas", instruccion: "Quita las muletillas del video." },
	{ rotulo: "Baja la música", instruccion: "Baja a la mitad el volumen de los audios." },
	{ rotulo: "Silencia los videos", instruccion: "Silencia el sonido original de los videos." },
	{ rotulo: "Alarga los textos", instruccion: "Haz que cada texto dure un segundo más, sin pisar a los demás." },
];

export function PanelChat({ onCerrar }: { onCerrar: () => void }) {
	const editor = useEditor();
	const proyectoId = useEditor((e) => e.project.getActiveOrNull()?.metadata.id ?? "");
	const tracksVivos = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const seleccion = useEditor((e) => e.selection.getSelectedElements());
	const hilo = useHilo(proyectoId);
	const [texto, setTexto] = useState("");
	const [alcance, setAlcance] = useState<"video" | "seleccion">("video");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const hiloRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef(editor);
	useLayoutEffect(() => { editorRef.current = editor; });

	// Sin nada elegido no hay alcance de selección: se CALCULA, no se dispara.
	const alcanceReal: "video" | "seleccion" = alcance === "seleccion" && seleccion.length > 0 ? "seleccion" : "video";

	// El chat baja solo con cada mensaje nuevo.
	useEffect(() => {
		const el = hiloRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [hilo.mensajes.length, hilo.corriendo]);

	const enviar = (instruccion: string, alc: "video" | "seleccion" = alcanceReal) => {
		if (hilo.corriendo || !instruccion.trim() || !proyectoId) return;
		void pedirEdicion(editorRef.current, instruccion, alc);
		setTexto("");
	};

	const sugerir = (s: Sugerencia) => {
		if (s.instruccion) {
			enviar(s.instruccion, s.necesitaSeleccion ? "seleccion" : alcanceReal);
			return;
		}
		if (s.rellenar) setTexto(s.rellenar);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		});
	};

	const aceptar = async (m: Extract<Mensaje, { de: "mako" }>, sinVersion = false) => {
		if (!m.propuesta) return;
		cambiarMensaje(proyectoId, m.id, { estado: "aplicando", aviso: undefined });
		const r = await aceptarPropuesta(editorRef.current, m.propuesta, { sinVersion });
		if (!r.ok) {
			cambiarMensaje(proyectoId, m.id, { estado: r.sinVersion ? "sin-version" : "pendiente", aviso: r.error });
			return;
		}
		// Lo que al aplicar no se pudo (un clip que ya no estaba, un corte sin video debajo) se dice.
		cambiarMensaje(proyectoId, m.id, { estado: "aplicada", aplicada: r.aplicada, descartes: r.descartes.length ? r.descartes : m.descartes });
		toast.success("Cambio aplicado");
	};

	const restaurar = (m: Extract<Mensaje, { de: "mako" }>) => {
		if (!m.aplicada) return;
		if (deshacerPropuesta(editorRef.current, m.aplicada)) {
			cambiarMensaje(proyectoId, m.id, { estado: "restaurada" });
			toast.success("Cambio deshecho");
			return;
		}
		// Se editó después: la vuelta es el deshacer de siempre.
		toast("Deshazlo con Ctrl+Z");
	};

	const detener = () => cortes.get(proyectoId)?.abort();
	const visibles = SUGERENCIAS.filter((s) => !s.necesitaSeleccion || seleccion.length > 0);
	const pildora = "cursor-pointer rounded-full bg-(--cc-raised) px-3 py-1.5 text-left text-[12px] text-(--cc-text) hover:brightness-125 disabled:cursor-default disabled:opacity-50";
	const chip = "flex h-[26px] min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium";

	return (
		<aside className="flex size-full min-h-0 flex-col bg-(--cc-panel)" aria-label="Editar con IA">
			<header className="flex h-10 shrink-0 items-center gap-2 bg-(--cc-panel-head) pr-1.5 pl-3">
				<HugeiconsIcon icon={AiMagicIcon} className="size-4 text-(--cc-accent)" />
				<span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-(--cc-text)">Editar con IA</span>
				<button
					type="button"
					onClick={onCerrar}
					title="Cerrar el panel"
					aria-label="Cerrar el panel"
					className="flex size-7 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-(--cc-raised)"
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
				</button>
			</header>

			<div ref={hiloRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
				{hilo.mensajes.length === 0 && (
					<>
						<div className="self-start rounded-[12px] bg-(--cc-raised) px-3 py-2 text-[12.5px] leading-[1.5] text-(--cc-text)">
							Pídeme que edite lo que quieras del video.
						</div>
						<div className="flex flex-wrap gap-1.5">
							{visibles.map((s) => (
								<button key={s.rotulo} type="button" className={pildora} onClick={() => sugerir(s)} disabled={hilo.corriendo}>{s.rotulo}</button>
							))}
						</div>
					</>
				)}
				{hilo.mensajes.map((m) =>
					m.de === "yo" ? (
						<div key={m.id} className="max-w-[88%] self-end rounded-[12px] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap text-(--cc-text)" style={{ background: "color-mix(in srgb, var(--cc-accent) 20%, var(--cc-panel))" }}>
							{m.alcance && <span className="mb-1 block text-[11px] font-semibold opacity-80">{m.alcance}</span>}
							{m.texto}
						</div>
					) : (
						<div key={m.id} className="grid gap-2">
							<div
								className="self-start rounded-[12px] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap"
								style={m.error ? { background: "color-mix(in srgb, var(--destructive) 18%, transparent)", color: "var(--destructive)" } : { background: "var(--cc-raised)", color: "var(--cc-text)" }}
							>
								{m.texto}
							</div>
							{m.propuesta && m.cambios && m.estado ? (
								<RevisionPropuesta
									cambios={m.cambios}
									descartes={m.descartes}
									estado={m.estado}
									aviso={m.aviso}
									tocada={!!tracksVivos && tracksVivos !== m.propuesta.tracksEnviados}
									onAceptar={() => void aceptar(m)}
									onAplicarIgual={() => void aceptar(m, true)}
									onDescartar={() => cambiarMensaje(proyectoId, m.id, { estado: "descartada", aviso: undefined })}
									onRestaurar={() => restaurar(m)}
								/>
							) : m.descartes && m.descartes.length > 0 ? (
								<p className="m-0 self-start rounded-[6px] bg-(--cc-sunken) px-2.5 py-1.5 text-[11.5px] text-(--cc-text-3)">
									No se aplica: {m.descartes.slice(0, 3).join(" · ")}
								</p>
							) : null}
						</div>
					),
				)}
				{hilo.corriendo && (
					<div className="flex items-center gap-2 self-start rounded-[12px] bg-(--cc-raised) px-3 py-2 text-[12.5px] text-(--cc-text-3)">
						<span className="size-3.5 animate-spin rounded-full border-2 border-(--cc-text-3) border-t-transparent" aria-hidden /> Pensando
					</div>
				)}
				{hilo.mensajes.length > 0 && !hilo.corriendo && (
					<div className="flex flex-wrap gap-1.5">
						{visibles.slice(0, 4).map((s) => (
							<button key={s.rotulo} type="button" className={pildora} onClick={() => sugerir(s)}>{s.rotulo}</button>
						))}
					</div>
				)}
			</div>

			<footer className="grid shrink-0 gap-2 px-3 pt-2 pb-3">
				<div className="flex min-w-0 gap-1.5" role="group" aria-label="Alcance">
					<button
						type="button"
						aria-pressed={alcanceReal === "video"}
						onClick={() => setAlcance("video")}
						className={`${chip} border-(--cc-btn-2) text-(--cc-text-3) aria-pressed:border-(--cc-accent) aria-pressed:text-(--cc-accent)`}
					>
						Todo el video
					</button>
					{seleccion.length > 0 && (
						<button
							type="button"
							aria-pressed={alcanceReal === "seleccion"}
							onClick={() => setAlcance("seleccion")}
							className={`${chip} border-(--cc-btn-2) text-(--cc-text-3) aria-pressed:border-(--cc-accent) aria-pressed:text-(--cc-accent)`}
						>
							<span className="truncate">{rotuloSeleccion(seleccion.length)}</span>
						</button>
					)}
				</div>
				<div className="grid gap-1 rounded-[10px] bg-(--cc-input) px-3 pt-2.5 pb-2 focus-within:ring-1 focus-within:ring-(--cc-accent)">
					<textarea
						ref={inputRef}
						value={texto}
						onChange={(e) => setTexto(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
								e.preventDefault();
								enviar(texto);
							}
						}}
						placeholder={hilo.corriendo ? "Espera a que la IA termine" : "Envía un mensaje al agente…"}
						disabled={hilo.corriendo || !proyectoId}
						rows={2}
						maxLength={TOPES_CHAT.instruccion}
						aria-label="Mensaje al agente"
						className="max-h-40 min-h-10 w-full resize-none border-0 bg-transparent p-0 text-[12.5px] leading-[1.45] text-(--cc-text) outline-none placeholder:text-(--cc-text-3)"
					/>
					<div className="flex justify-end">
						{hilo.corriendo ? (
							<button
								type="button"
								onClick={detener}
								title="Detener generación"
								aria-label="Detener generación"
								className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-(--cc-accent) text-black"
							>
								<span className="block size-2.5 rounded-[2px] bg-current" />
							</button>
						) : (
							<button
								type="button"
								onClick={() => enviar(texto)}
								disabled={!texto.trim() || !proyectoId}
								title="Enviar"
								aria-label="Enviar"
								className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-(--cc-btn-2) text-(--cc-text) enabled:data-[listo]:bg-(--cc-accent) enabled:data-[listo]:text-black disabled:cursor-default"
								data-listo={texto.trim() ? "" : undefined}
							>
								<HugeiconsIcon icon={ArrowUp02Icon} className="size-4" />
							</button>
						)}
					</div>
				</div>
			</footer>
		</aside>
	);
}
