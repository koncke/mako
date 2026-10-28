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
// El hilo es por proyecto y, desde el 16/10, queda GUARDADO por persona (chat/hilo.ts, mig 0298):
// al recargar vuelve, con las propuestas pendientes todavía para aceptar. Nada se aplica sin
// «Aceptar»: lo fija tests/video-editor-chat.test.ts.
//
// CON LAS PIEZAS DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops
// Center»): el hilo es `HiloMako` (con la criatura de la tab, la misma que lo nombra en el Ops Center) y la caja es
// `CajaChat` (app/_chat/). El motor es el de siempre (edita el proyecto ABIERTO, en modo «editar»), y la propuesta con
// «Original | Modificado» va en el hueco `enMensaje` de la respuesta que la trajo. Las piezas toman los colores de CapCut:
// `CSS_CHAT` redefine sus tokens (--surface, --ink…) con los `--cc-*` bajo `.cc-chat` (AGENTS.md, «Una pantalla oscura se
// hace redefiniendo TOKENS»). El alcance sigue en sus chips arriba de la caja; en el hilo ya no se repite en la burbuja.
//
// EL PANEL ÚNICO, FIJO A LA IZQUIERDA, CON LOS COLORES DE MaKo (27/10/2026; Martín: «adaptar las tabs de video e imagen
// con el chat que tenemos de MaKo, para que se pueda editar con prompting, algo similar a lo que hicimos con Web
// Generator, que este al costado... Tambien ponle los colores de MaKo a esas tabs»). Copiado del agente del Web
// Generator (app/web-generator/editor/paneles/PanelAgente.tsx + ChatAgente.tsx) y de lo que ya hizo el Image Editor en
// esta rama (app/image-editor/mako/chat/PanelMakoIA.tsx):
//   · `PanelDeChat` (app/admin/operaciones/PanelChat.tsx): la cabecera con la estrella de MaKo y «en línea», el
//     arrastrar y soltar, la columna del hilo y el lugar de la caja. Ya no tiene «Cerrar el panel»: el chat no se cierra.
//     Su «←» da vuelta la MISMA tarjeta a la lista de proyectos, sin navegar (../inicio/PanelProyectos.tsx);
//   · arriba de la caja, «Discutir | Editar» (app/_chat/SelectorIntencion.tsx, la preferencia compartida con Automations
//     y el Web Generator): Discutir contesta y sugiere sin tocar nada; Editar arma el cambio. Los chips del alcance
//     («Todo el video» o lo elegido) van sólo con Editar;
//   · el saludo es la burbuja de MaKo con sus sugerencias en píldoras, como el agente del Web Generator.
// Los colores ya no se redefinen acá: adentro de `.ce` los tokens de MaKo (--surface, --ink…) son los de la app, en
// claro u oscuro (capcut-theme.css). `CSS_CHAT` sólo trae las medidas del agente del Web Generator.
// Lo que NO cambió: el motor (`pedirEdicion`, más abajo, y ./aplicar.ts), la propuesta con «Original | Modificado» en el
// hueco de la respuesta, Aceptar / Descartar / Restaurar, el foco de un link `?propuesta=`, el hilo guardado, la caja
// quieta sin la app de escritorio y lo que no es del proyecto abierto como burbuja con su link (./pedidos.ts).
// =============================================================================

import "@/app/admin/operaciones/centro.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CajaChat } from "@/app/_chat/CajaChat";
import { HiloMako, type EnMensaje } from "@/app/_chat/HiloMako";
import { SelectorIntencion, useIntencion } from "@/app/_chat/SelectorIntencion";
import type { ItemHilo } from "@/app/m/mako/chat-ui";
import { PanelDeChat } from "@/app/admin/operaciones/PanelChat";
import { ASPECTO_MAKO } from "@/lib/centro-munecos";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TOPES_CHAT, validarOperaciones } from "@/lib/editor-video/chat-catalogo";
import { resumenDeCambios, revisarOperaciones, vistaDeLinea, type CambioChat } from "./linea";
import { aceptarPropuesta, deshacerPropuesta } from "./aplicar";
import { datosDeLinea, disponiblesChat } from "./contexto";
import { cambiarHilo, cambiarMensaje, cargarHilo, conId, leerHilo, suscribir, type EstadoPropuesta, type Hilo, type MensajeMako } from "./hilo";
import { marcarCerrada, resolverEnServidor, traerPropuestas } from "./propuestas";
import { useChatAbierto } from "./estado";
import { storageService } from "@/app/video-editor/_opencut/services/storage/service";
import Link from "@/app/_ui/Link";
import { PLAZO_PEDIDOS_MS, burbujasDe, cuerpoPedidos, interpretacionDe, objetosDeProyectos, textoActual } from "./pedidos";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { useAppDeEscritorio } from "@/app/_chat/useAppDeEscritorio";

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;

/**
 * POST /api/mako/pedidos: qué se pide (lo del proyecto abierto y lo demás, chat/pedidos.ts). Con los proyectos del
 * NAVEGADOR (`objetos`: viven en IndexedDB y el servidor no los tiene). Nunca lanza: una falla o el plazo vencido
 * devuelven null, y el mensaje entero sigue a la IA del chat, como antes.
 */
async function pedirPedidos(texto: string, proyecto: { id: string; nombre: string }, senal: AbortSignal): Promise<unknown> {
	const plazo = new AbortController();
	const t = setTimeout(() => plazo.abort(), PLAZO_PEDIDOS_MS);
	const alCortar = () => plazo.abort();
	senal.addEventListener("abort", alCortar);
	try {
		const objetos = objetosDeProyectos(await storageService.loadAllProjectsMetadata().catch(() => []));
		const res = await fetch("/api/mako/pedidos", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(cuerpoPedidos(texto, proyecto, objetos)),
			signal: plazo.signal,
		});
		return await res.json().catch(() => null);
	} catch {
		return null;
	} finally {
		clearTimeout(t);
		senal.removeEventListener("abort", alCortar);
	}
}

const cortes = new Map<string, AbortController>();
const HILO_SERVER: Hilo = { mensajes: [], corriendo: false };

function useHilo(proyectoId: string): Hilo {
	return useSyncExternalStore(suscribir, () => leerHilo(proyectoId), () => HILO_SERVER);
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

/**
 * Manda una instrucción. Corre afuera del componente: su respuesta cae en el store.
 *
 * Primero QUÉ se pide (`pedirPedidos`, mientras el hilo dice «Pensando»): lo del proyecto abierto va a la IA del chat
 * con su texto; lo demás («y créame otro proyecto», «la otra», algo de otra tab) vuelve como burbujas de MaKo debajo
 * de la respuesta, con su link (chat/pedidos.ts). Sin nada del proyecto abierto, no se llama a la IA. `interpretar:
 * false` = un pedido NUESTRO (una sugerencia), que es de edición por definición y no gasta la vuelta.
 */
// `op.intencion` (27/10/2026): «Discutir | Editar» del panel. La lee el motor (lo cablea el chat de la API y los motores:
// con «discutir», MaKo contesta sin armar una propuesta); hasta entonces viaja y no cambia nada (todo pasa por «Aceptar»).
async function pedirEdicion(editor: EditorCore, instruccion: string, alcance: "video" | "seleccion", op: { interpretar?: boolean; intencion?: "editar" | "discutir" } = {}): Promise<void> {
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	const texto = instruccion.trim();
	if (!proyecto || !escena || !texto) return;
	const proyectoId = proyecto.metadata.id;
	if (leerHilo(proyectoId).corriendo) return;

	const elegidos = editor.selection.getSelectedElements().map((e) => ({ trackId: e.trackId, elementId: e.elementId }));
	const alcanceReal = alcance === "seleccion" && elegidos.length ? "seleccion" : "video";
	cambiarHilo(proyectoId, (h) => ({
		corriendo: true,
		mensajes: [...h.mensajes, conId({ de: "yo", texto, alcance: alcanceReal === "seleccion" ? rotuloSeleccion(elegidos.length) : null })],
	}));
	const corte = new AbortController();
	cortes.set(proyectoId, corte);
	// Las burbujas de lo que NO es del proyecto abierto van debajo de la respuesta («se contesta lo actual y se propone lo otro»).
	let burbujas: Array<Omit<MensajeMako, "id" | "c" | "t">> = [];
	const terminar = (m: Omit<MensajeMako, "id" | "c" | "t"> | null) => {
		cortes.delete(proyectoId);
		const nuevos = [...(m ? [m] : []), ...burbujas].map(conId);
		cambiarHilo(proyectoId, (h) => ({ corriendo: false, mensajes: [...h.mensajes, ...nuevos] }));
	};

	let paraEditar: string | null = texto;
	if (op.interpretar !== false) {
		const ri = await pedirPedidos(texto, { id: proyectoId, nombre: proyecto.metadata.name }, corte.signal);
		if (corte.signal.aborted) {
			terminar({ de: "mako", texto: "Detenido." });
			return;
		}
		// Falló o tardó: `interpretacionDe` devuelve lo de siempre (el mensaje entero a la IA del chat).
		const interp = interpretacionDe(ri, texto);
		paraEditar = textoActual(interp);
		burbujas = burbujasDe(interp, proyectoId).map((b) => ({ de: "mako" as const, texto: b.texto, ...(b.links.length ? { links: b.links } : {}) }));
	}
	if (!paraEditar) {
		terminar(null);
		return;
	}

	// Lo que el motor tiene con nombre (la primera vez espera la lista de fuentes) y, recién
	// después, la línea de tiempo de ese momento: la misma que se le manda a la IA.
	const disponibles = await disponiblesChat(editor);
	const escenaAhora = editor.scenes.getActiveSceneOrNull();
	if (!escenaAhora || escenaAhora.id !== escena.id) {
		terminar({ de: "mako", texto: "Cambiaste de escena. Vuelve a pedirlo.", error: true });
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
		medios: datos.medios,
	});

	if (vista.json.length > TOPES_CHAT.vistaMax) {
		terminar({ de: "mako", texto: "El proyecto es muy grande para el chat. Elige unos clips y pídelo sobre la selección.", error: true });
		return;
	}

	const r = await pedirIA({ instruccion: paraEditar, linea: vista.json, alcance: alcanceReal }, corte.signal);
	if (!r.ok) {
		terminar({ de: "mako", texto: r.error, error: !("cortado" in r) });
		return;
	}
	// La forma ya la validó la ruta; acá se vuelve a validar (el editor no le cree a nadie) y se
	// revisan las referencias contra la vista con la que se pidió.
	const { operaciones, descartes: deForma } = validarOperaciones(r.operaciones);
	const revision = revisarOperaciones({ operaciones, vista, alcance: alcanceReal, transcripcion: datos.transcripcion });
	const descartes = [...deForma, ...revision.descartes];
	if (!revision.resueltas.length) {
		terminar({ de: "mako", texto: r.resumen || "Sin cambios.", descartes: descartes.length ? descartes : undefined });
		return;
	}
	// Las refs de los elementos y de los medios («m2» tiene que seguir siendo el mismo al aceptar).
	const refsPorId = new Map([
		...[...vista.refs.values()].map((x) => [x.elementId, x.ref] as const),
		...[...vista.medios.values()].map((m) => [m.mediaId, m.ref] as const),
	]);
	terminar({
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
	puedeRestaurar,
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
	/** Hay con qué deshacer: una aplicada que volvió de la base ya no tiene «Restaurar». */
	puedeRestaurar: boolean;
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
										// Los pares de MaKo que pasan AA en claro y en oscuro (un azul al 22 % con el azul encima daba 3,5:1 en claro).
										background: c.tipo === "agrega" ? "var(--primary-bg)" : c.tipo === "quita" ? "color-mix(in srgb, var(--destructive) 14%, transparent)" : "var(--cc-raised)",
										color: c.tipo === "agrega" ? "var(--primary-strong)" : c.tipo === "quita" ? "var(--destructive)" : "var(--cc-text-2)",
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
					<ReportarASoporte />
				</p>
			)}
			<div className="flex flex-wrap items-center justify-end gap-2">
				{estado === "pendiente" && (
					<>
						<button type="button" onClick={onDescartar} className={`${boton} text-(--cc-text-2) hover:bg-(--cc-raised)`}>Descartar</button>
						<button type="button" onClick={onAceptar} className={`${boton} bg-(--cc-accent) text-(--cc-on-accent) hover:brightness-110`}>Aceptar</button>
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
						{puedeRestaurar && (
							<button type="button" onClick={onRestaurar} className={`${boton} border border-(--cc-btn-2) text-(--cc-text) hover:bg-(--cc-raised)`}>Restaurar</button>
						)}
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
/** Con «Discutir»: preguntas, no pedidos de cambio (como el Image Editor y el Web Generator). */
const SUGERENCIAS_DISCUTIR: Sugerencia[] = [
	{ rotulo: "¿Qué mejorarías?", instruccion: "¿Qué mejorarías de este video para que retenga más?" },
	{ rotulo: "¿El inicio engancha?", instruccion: "¿Los primeros 3 segundos enganchan? ¿Qué cambiarías?" },
	{ rotulo: "Ideas de título", instruccion: "Dame tres ideas de título para el inicio de este video." },
];

/**
 * El chat de MaKo en la tarjeta de la izquierda (../marco.tsx). `onProyectos` es la «←» de la cabecera: la misma tarjeta
 * pasa a la lista de proyectos, sin navegar. `onVerEditor`: en el teléfono (< 768 px), la tarjeta ocupa todo y este botón
 * de la cabecera la cambia por el editor (en una pantalla más ancha no se ve: capcut-theme.css, `.ce-solo-angosta`).
 */
export function PanelChat({ onProyectos, onVerEditor }: { onProyectos: () => void; onVerEditor?: () => void }) {
	const editor = useEditor();
	const proyectoId = useEditor((e) => e.project.getActiveOrNull()?.metadata.id ?? "");
	const tracksVivos = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const seleccion = useEditor((e) => e.selection.getSelectedElements());
	const nombreProyecto = useEditor((e) => e.project.getActiveOrNull()?.metadata.name ?? null);
	const hilo = useHilo(proyectoId);
	const [texto, setTexto] = useState("");
	// Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
	const appEscritorio = useAppDeEscritorio();
	// «Discutir | Editar», la preferencia compartida con los otros chats de MaKo (app/_chat/SelectorIntencion.tsx).
	const [intencion, elegirIntencion] = useIntencion();
	const [alcance, setAlcance] = useState<"video" | "seleccion">("video");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const hiloRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef(editor);
	useLayoutEffect(() => { editorRef.current = editor; });

	// Sin nada elegido no hay alcance de selección: se CALCULA, no se dispara.
	const alcanceReal: "video" | "seleccion" = alcance === "seleccion" && seleccion.length > 0 ? "seleccion" : "video";

	// El hilo guardado de este proyecto, la primera vez que se abre su chat en la pestaña (chat/hilo.ts).
	useEffect(() => {
		if (proyectoId) void cargarHilo(proyectoId, nombreProyecto);
	}, [proyectoId, nombreProyecto]);

	// El chat baja solo con cada mensaje nuevo.
	useEffect(() => {
		const el = hiloRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [hilo.mensajes.length, hilo.corriendo]);

	// El foco no sobrevive al panel: cerrado antes de los 4 s, quedaba en el store y al reabrirse saltaba a la propuesta
	// vieja en vez de quedarse abajo, donde está lo nuevo (revisión del 20/10).
	useEffect(() => () => useChatAbierto.getState().setFoco(null), []);

	// ⚠️ DESPUÉS de bajar: la propuesta del link (`?propuesta=`, chat/propuestas.ts) se busca, se centra y se resalta
	// unos segundos. Si todavía no está en el hilo, espera a que llegue (depende de la cantidad de mensajes).
	const foco = useChatAbierto((s) => s.foco);
	useEffect(() => {
		if (!foco) return;
		const el = hiloRef.current?.querySelector<HTMLElement>(`[data-mensaje="${CSS.escape(foco)}"]`);
		if (!el) return;
		el.scrollIntoView({ block: "center" });
		const t = setTimeout(() => useChatAbierto.getState().setFoco(null), 4000);
		return () => clearTimeout(t);
	}, [foco, hilo.mensajes.length]);

	const enviar = (instruccion: string, alc: "video" | "seleccion" = alcanceReal, op: { interpretar?: boolean } = {}) => {
		if (hilo.corriendo || !instruccion.trim() || !proyectoId || appEscritorio.bloqueada) return;
		// La intención viaja al motor: con «Discutir» MaKo contesta y sugiere, sin armar una propuesta.
		void pedirEdicion(editorRef.current, instruccion.slice(0, TOPES_CHAT.instruccion), alc, { ...op, intencion });
		setTexto("");
	};

	const sugerir = (s: Sugerencia) => {
		if (s.instruccion) {
			// Una sugerencia es NUESTRA y de edición por definición: no pasa por «qué se pide».
			enviar(s.instruccion, s.necesitaSeleccion ? "seleccion" : alcanceReal, { interpretar: false });
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

	const aceptar = async (m: MensajeMako, sinVersion = false) => {
		if (!m.propuesta) return;
		cambiarMensaje(proyectoId, m.id, { estado: "aplicando", aviso: undefined });
		const r = await aceptarPropuesta(editorRef.current, m.propuesta, { sinVersion });
		if (!r.ok) {
			cambiarMensaje(proyectoId, m.id, { estado: r.sinVersion ? "sin-version" : "pendiente", aviso: r.error });
			return;
		}
		// Lo que al aplicar no se pudo (un clip que ya no estaba, un corte sin video debajo) se dice.
		cambiarMensaje(proyectoId, m.id, { estado: "aplicada", aplicada: r.aplicada, descartes: r.descartes.length ? r.descartes : m.descartes });
		// Una propuesta de la API (por WhatsApp, por la API): se cierra también en la base (chat/propuestas.ts), SÓLO lo
		// que este mensaje tenía. Lo que se sumó después sigue abierto y se trae como un mensaje nuevo.
		if (m.propuestaApi) void resolverEnServidor(m.propuestaApi.id, "aplicada", r.descartes, m.propuesta.operaciones).then((c) => alCerrar(m.id, c));
		toast.success("Cambio aplicado");
	};

	/**
	 * Lo que contestó la base al cerrar: si lo confirmó, se anota (si no, la próxima búsqueda lo reintenta); lo que se
	 * pidió mientras tanto sigue abierto y se trae, y `traerPropuestas` lo avisa.
	 */
	const alCerrar = (mensajeId: string, c: { cerrada: boolean; quedan: number }) => {
		if (c.cerrada) marcarCerrada(proyectoId, mensajeId);
		if (c.quedan) void traerPropuestas(editorRef.current);
	};

	const restaurar = (m: MensajeMako) => {
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
	const visibles = (intencion === "discutir" ? SUGERENCIAS_DISCUTIR : SUGERENCIAS).filter((s) => !s.necesitaSeleccion || seleccion.length > 0);
	const pildoras = (lista: Sugerencia[]) => (
		<div className="cc-chat-pildoras">
			{lista.map((s) => (
				<button key={s.rotulo} type="button" className="cc-chat-pildora" onClick={() => sugerir(s)} disabled={hilo.corriendo || !proyectoId}>{s.rotulo}</button>
			))}
		</div>
	);

	// El hilo del Ops Center: cada mensaje con su id y su hora; lo de MaKo que el hilo no sabe dibujar (el error, los links
	// de otro proyecto, la propuesta con «Original | Modificado»), en su hueco. El foco de un link (`?propuesta=`) busca ese
	// hueco por `data-mensaje`.
	const items = useMemo((): ItemHilo[] => hilo.mensajes.map((m) => ({
		k: "msg", id: m.id, role: m.de === "yo" ? "user" : "assistant", at: Number.isFinite(m.c) && m.c > 0 ? new Date(m.c).toISOString() : null,
		texto: m.de === "mako" && m.error ? "" : m.texto,
	})), [hilo.mensajes]);
	const enMensaje = (x: Extract<ItemHilo, { k: "msg" }>): EnMensaje | null => {
		const m = hilo.mensajes.find((y) => y.id === x.id);
		if (!m || m.de !== "mako") return null;
		return {
			arriba: m.error ? <p className="m-0 text-[12.5px] leading-[1.5] text-(--destructive)">{m.texto}</p> : null,
			abajo: (
				<div data-mensaje={m.id} className="mt-1 grid gap-2 rounded-[14px] transition-shadow" style={foco === m.id ? { boxShadow: "0 0 0 2px var(--cc-accent)" } : undefined}>
					{/* Un pedido que no es de este proyecto (chat/pedidos.ts): a dónde lleva. El Link pega el ?ws=. */}
					{m.links && m.links.length > 0 && (
						<div className="flex flex-wrap gap-1.5 self-start">
							{m.links.map((l) => (
								<Link key={l.href} href={l.href} className="cc-chat-pildora">
									{l.texto}
								</Link>
							))}
						</div>
					)}
					{m.propuesta && m.cambios && m.estado ? (
						<RevisionPropuesta
							cambios={m.cambios}
							descartes={m.descartes}
							estado={m.estado}
							aviso={m.aviso}
							tocada={!!tracksVivos && !!m.propuesta.tracksEnviados && tracksVivos !== m.propuesta.tracksEnviados}
							puedeRestaurar={!!m.aplicada}
							onAceptar={() => void aceptar(m)}
							onAplicarIgual={() => void aceptar(m, true)}
							onDescartar={() => {
								cambiarMensaje(proyectoId, m.id, { estado: "descartada", aviso: undefined });
								if (m.propuestaApi) void resolverEnServidor(m.propuestaApi.id, "descartada", [], m.propuesta?.operaciones ?? []).then((c) => alCerrar(m.id, c));
							}}
							onRestaurar={() => restaurar(m)}
						/>
					) : m.descartes && m.descartes.length > 0 ? (
						<p className="m-0 self-start rounded-[6px] bg-(--cc-sunken) px-2.5 py-1.5 text-[11.5px] text-(--cc-text-3)">
							No se aplica: {m.descartes.slice(0, 3).join(" · ")}
						</p>
					) : null}
				</div>
			),
		};
	};

	return (
		// La tarjeta es el <section> del marco (../marco.tsx); acá adentro, el panel único (otro <section>, nunca un <aside>:
		// con la barra de la agencia, `[data-barra-agencia] aside` le fuerza el alto de la ventana y la caja queda afuera).
		<div className="cc-chat" data-testid="ve-chat-mako">
			<style href="cc-chat" precedence="medium">{CSS_CHAT}</style>
			<PanelDeChat
				hilo={hiloRef}
				estado=""
				cabecera={{
					clave: `video:${proyectoId}`, titulo: "MaKo", criatura: "MaKo", aspecto: ASPECTO_MAKO,
					animo: hilo.corriendo ? "trabajando" : "despierto",
					// La «←» da vuelta la MISMA tarjeta a la lista de proyectos, sin navegar (como la del Web Generator).
					antes: (
						<button type="button" className="cc-chat-icono" onClick={onProyectos} title="Ver tus proyectos" aria-label="Ver tus proyectos">
							←
						</button>
					),
					// Sin «Cerrar el panel»: el chat no se cierra nunca.
					acciones: (
						<>
							<span className="cc-chat-estado">{hilo.corriendo ? "escribiendo…" : "en línea"}</span>
							{onVerEditor && (
								<button type="button" className="cc-chat-icono ce-solo-angosta" onClick={onVerEditor} title="Ver el editor" aria-label="Ver el editor">
									<HugeiconsIcon icon={Video01Icon} className="size-4" />
								</button>
							)}
						</>
					),
				}}
				caja={
					<div className="cc-chat-pie">
						{/* «Discutir | Editar», como en el Web Generator, el Image Editor y Automations. */}
						<SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={hilo.corriendo} />
						{intencion === "editar" && (
							<div className="cc-chat-chips" role="group" aria-label="Alcance">
								<button type="button" className="cc-chat-chip" aria-pressed={alcanceReal === "video"} onClick={() => setAlcance("video")}>
									Todo el video
								</button>
								{seleccion.length > 0 && (
									<button type="button" className="cc-chat-chip" aria-pressed={alcanceReal === "seleccion"} onClick={() => setAlcance("seleccion")}>
										<span>{rotuloSeleccion(seleccion.length)}</span>
									</button>
								)}
							</div>
						)}
						{/* La caja única (app/_chat/CajaChat.tsx). */}
						<div className="co-caja">
							<CajaChat campo={inputRef} texto={texto} onTexto={setTexto} onMandar={() => enviar(texto)} ocupado={hilo.corriendo}
								apagado={!proyectoId} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda bloqueo={appEscritorio.bloqueo} />
						</div>
					</div>
				}
			>
				{hilo.mensajes.length === 0 && (
					<>
						<div className="cc-chat-burbuja">
							{!proyectoId
								? "Crea o abre un proyecto y pídeme lo que quieras del video."
								: intencion === "discutir"
									? "Pregúntame lo que quieras de tu video: te digo qué cambiaría, sin tocar nada."
									: "Pídeme que edite lo que quieras del video."}
						</div>
						{proyectoId ? pildoras(visibles) : null}
					</>
				)}
				<HiloMako items={items} quien={QUIEN} ahora={Date.now()} escribiendo={hilo.corriendo ? { segs: 0 } : null}
					tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} enMensaje={enMensaje} />
				{hilo.corriendo && (
					<button type="button" className="cc-chat-detener" onClick={detener}>
						Detener generación
					</button>
				)}
				{hilo.mensajes.length > 0 && !hilo.corriendo && pildoras(visibles.slice(0, 4))}
			</PanelDeChat>
		</div>
	);
}

/** Quien contesta en el hilo: la estrella de MaKo, como en el Web Generator y el Image Editor (antes, la criatura de la tab). */
const QUIEN = { nombre: "MaKo", aspecto: ASPECTO_MAKO };
const nada = () => {};

/**
 * Las medidas del agente del Web Generator (`CSS_AGENTE` de app/web-generator/editor/paneles/PanelAgente.tsx): la cabecera
 * de 48 con la estrella, la burbuja gris de MaKo, las píldoras celestes y la caja. Los COLORES son los tokens de MaKo, que
 * adentro de `.ce` valen lo mismo que en la app y siguen su claro u oscuro (capcut-theme.css): ya no se redefinen acá.
 */
const CSS_CHAT = `
.cc-chat{display:flex;flex:1;flex-direction:column;min-height:0;background:var(--surface);color:var(--ink);font-size:14px;line-height:1.45}
.cc-chat>.co-panel{flex:1;min-height:0;background:transparent}
.cc-chat .co-cab{min-height:48px;padding:0 8px 0 12px;gap:8px}
.cc-chat .co-hilo{padding:8px 12px 12px}
.cc-chat .co-hilo__col{gap:10px}
.cc-chat .co-caja-wrap{padding:0}
.cc-chat .co-caja textarea::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-chat-estado{font-size:12px;color:var(--faint);white-space:nowrap}
.cc-chat-icono{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dim);cursor:pointer;font-size:16px;line-height:1}
.cc-chat-icono:hover{background:var(--velo-hover);color:var(--ink)}
.cc-chat-icono:focus-visible,.cc-chat-pildora:focus-visible,.cc-chat-chip:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cc-chat-pie{display:grid;gap:8px;padding:8px 12px 12px}
.cc-chat-burbuja{align-self:flex-start;max-width:100%;padding:10px 14px;border-radius:14px;background:var(--surface-2);color:var(--ink);font-size:13.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.cc-chat-pildoras{display:flex;flex-wrap:wrap;gap:6px}
.cc-chat-pildora{padding:6px 12px;border:0;border-radius:999px;background:var(--primary-bg);color:var(--primary-strong);font:inherit;font-size:12.5px;font-weight:500;text-align:left;text-decoration:none;cursor:pointer;transition:background .15s ease}
.cc-chat-pildora:hover:not(:disabled){background:color-mix(in srgb,var(--primary) 18%,var(--surface))}
.cc-chat-pildora:disabled{opacity:.5;cursor:default}
.cc-chat-chips{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
.cc-chat-chip{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;height:26px;padding:0 10px;border:1px solid var(--border-strong);border-radius:999px;background:var(--surface);color:var(--dim);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.cc-chat-chip>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-chat-chip[aria-pressed="true"]{border-color:var(--primary-weak);background:var(--primary-bg);color:var(--primary-strong)}
.cc-chat-detener{align-self:flex-start;padding:0;border:0;background:none;font:inherit;font-size:12px;color:var(--faint);cursor:pointer}
.cc-chat-detener:hover{color:var(--ink)}
@media (prefers-reduced-motion:reduce){.cc-chat-pildora{transition:none}}
`;
