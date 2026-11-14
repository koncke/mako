"use client";

// =============================================================================
// PanelChat — «Editar con IA»: el chat al costado del Video Editor
// =============================================================================
// Pedido de Martín (15/10/2026): «es importante que video editor tenga, como landing, un
// chat al costado donde pueda ir editando todo con prompt». CapCut no tiene un chat así:
// la fuente es el del Landing Generator (app/web-generator/editor/paneles/
// PanelAgente.tsx, copiado de Gamma 5) y se copia su comportamiento:
//   · mensajes del agente en burbuja gris a la izquierda y de la persona a la derecha;
//   · sugerencias en píldoras; input al pie «Escribe a MaKo» (29/10/2026: «Envía un mensaje al agente…» se partía en dos
//     renglones en la tarjeta de 340 px) con el enviar
//     redondo; mientras la IA trabaja, «Espera a que la IA termine» y el cuadrado de detener;
//   · el alcance en chips: «Todo el video» o lo elegido en la línea de tiempo;
//   · la respuesta es un CAMBIO PROPUESTO con «Original | Modificado», que se acepta o se
//     descarta entero; después de aceptar, «Restaurar» lo vuelve atrás;
//   · lo que tarda al aceptar (borrar los silencios) se ve construyéndose: la fase y cada silencio
//     que se encontró, de a uno (app/_ui/ArmadoEnVivo.tsx, ./armado.ts).
// El hilo es por proyecto y, desde el 16/10, queda GUARDADO por persona (chat/hilo.ts, mig 0298):
// al recargar vuelve, con las propuestas pendientes todavía para aceptar. Nada se aplica sin
// «Aceptar»: lo fija tests/video-editor-chat.test.ts.
//
// CON LAS PIEZAS DEL OPS CENTER (22/10/2026, TB3; Martín: «quiero que todos los chats de MaKo en las tabs sean el del Ops
// Center»): el hilo es `HiloMako` (con la criatura de la tab, la misma que lo nombra en el Ops Center) y la caja es
// `CajaChat` (app/_chat/). El motor es el de siempre (edita el proyecto ABIERTO, en modo «editar»), y la propuesta con
// «Original | Modificado» va en el hueco `enMensaje` de la respuesta que la trajo. El alcance sigue en sus chips arriba de
// la caja; en el hilo ya no se repite en la burbuja.
//
// LA TARJETA IZQUIERDA DE CREATE (29/10/2026; Martín: «el mismo diseño de la barra lateral del chat de MaKo SIEMPRE abierto
// a la izquierda» y «los colores de MaKo, no esos colores»): VideoEditorCliente lo pasa como el chat propio de la pantalla
// de Create (app/_crear/PantallaCrear.tsx). Ya no se cierra (se fueron el ✕ y el botón de la barra superior que lo abría) y
// su cabecera lleva la «←» de la pantalla (`volver`), que da vuelta la tarjeta a la lista de proyectos. Con los tokens de
// MaKo tal cual: se fue `CSS_CHAT`, que les ponía los `--cc-*` de CapCut a las piezas del Ops Center.
// =============================================================================

import "@/app/admin/operaciones/centro.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CajaChat } from "@/app/_chat/CajaChat";
import { HiloMako, type EnMensaje } from "@/app/_chat/HiloMako";
import { useNotaEnElActo } from "@/app/_chat/useNotaEnElActo";
import { cuerpoConArchivos, useAdjuntosDelChat } from "@/app/_chat/useAdjuntosDelChat";
import { ERROR_ADJUNTO, memoriaConArchivos } from "@/lib/mako-adjuntos";
import { TOPES_CONVERSACION } from "@/lib/editor-video/chat-conversacion";
import type { ItemHilo } from "@/app/m/mako/chat-ui";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { CabeceraDeChat } from "@/app/admin/operaciones/PanelChat";
import { ASPECTO_MAKO } from "@/lib/centro-munecos";
import { AperturaMako, useApertura } from "@/app/_chat/AperturaMako";
import { SUPERFICIE_VIDEO } from "@/lib/aperturas/video";
import { GuiaEnElChat } from "@/app/video-editor/guia/GuiaEnElChat";
import { subtitulosDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { rotuloProgresoSubtitulos, textoDeSubtitulos } from "@/app/video-editor/_opencut/subtitles/resultado";
import { useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TOPES_CHAT, validarOperaciones } from "@/lib/editor-video/chat-catalogo";
import { resumenDeCambios, revisarOperaciones, textoSegundos, vistaDeLinea, type CambioChat } from "./linea";
import { anotarProgreso, empezarArmado, useArmado, type ArmadoChat } from "./armado";
import { ArmadoEnVivo } from "@/app/_ui/ArmadoEnVivo";
import { fasesDesde } from "@/app/_ui/armado-en-vivo";
import { aceptarPropuesta, deshacerPropuesta } from "./aplicar";
import { agentesDeOperaciones, mostrarCursores, sumarTiempo, tareasDeOperaciones } from "@/app/video-editor/_opencut/enjambre/cursores-sueltos";
import { datosDeLinea, disponiblesChat } from "./contexto";
import { cambiarHilo, cambiarMensaje, cargarHilo, conId, leerHilo, suscribir, type EstadoPropuesta, type Hilo, type MensajeMako } from "./hilo";
import { marcarCerrada, resolverEnServidor, traerPropuestas } from "./propuestas";
import { useChatAbierto } from "./estado";
import { esConfirmacion, propuestaQueConfirma } from "./confirmar";
import { descartesDelPedido, textoSinCambios } from "./respuesta";
import { storageService } from "@/app/video-editor/_opencut/services/storage/service";
import Link from "@/app/_ui/Link";
import { PLAZO_PEDIDOS_MS, burbujasDe, cuerpoPedidos, interpretacionDe, objetosDeProyectos, textoActual } from "./pedidos";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { useAppDeEscritorio } from "@/app/_chat/useAppDeEscritorio";
import { useCitaDelChat } from '@/app/_chat/useCitaDelChat';
import { separarCita } from '@/lib/centro-mensajes';
import { SelectorIntencion, useIntencion, type IntencionChat } from '@/app/_chat/SelectorIntencion';
import { esRespuestaSoloPro, marcarSoloPro, useSoloPro } from '@/app/_components/solo-pro';
import { CandadoSoloPro } from '@/app/_components/CandadoSoloPro';

/** La ruta corta a 120 s; el pedido se corta un poco después. */
const PLAZO_MS = 125_000;
/** Con fotos o PDF (28/10/2026): la ruta los lee antes (una foto con la visión, ~52 s) y su `maxDuration` es 300. */
const PLAZO_CON_ARCHIVOS_MS = 245_000;

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

type Respuesta = { ok: true; resumen: string; operaciones: unknown[]; descartes?: string[] } | { ok: false; error: string };

/** El pedido a la ruta. Un corte de la persona no es un error (no se pinta en rojo). */
async function pedirIA(cuerpo: Record<string, unknown>, senal: AbortSignal, archivos: readonly File[] = []): Promise<Respuesta | { ok: false; error: string; cortado: true }> {
	const plazo = new AbortController();
	const t = setTimeout(() => plazo.abort(), archivos.length ? PLAZO_CON_ARCHIVOS_MS : PLAZO_MS);
	const alCortar = () => plazo.abort();
	senal.addEventListener("abort", alCortar);
	try {
		const res = await fetch("/api/video-editor/ia", archivos.length
			? { method: "POST", body: cuerpoConArchivos(cuerpo, archivos), signal: plazo.signal }
			: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), signal: plazo.signal });
		const json = (await res.json().catch(() => null)) as Respuesta | null;
		// El 413 de Vercel (archivos de más) llega en texto: no es JSON.
		if (!json) return { ok: false, error: res.status === 413 ? ERROR_ADJUNTO.pesado : "MaKo no respondió. Vuelve a intentar." };
		// Editar con IA es de MaKo Pro (lib/editores-ia-pro.ts): la caja pasa a mostrar el candado (app/_components/solo-pro.ts).
		if (res.status === 403 && esRespuestaSoloPro(json)) marcarSoloPro("ia-editores");
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
async function pedirEdicion(editor: EditorCore, instruccion: string, alcance: "video" | "seleccion", op: { interpretar?: boolean; archivos?: readonly File[]; intencion?: IntencionChat } = {}): Promise<void> {
	// «Discutir» (app/_chat/SelectorIntencion.tsx, 5/11/2026): MaKo contesta sin proponer nada, y el mensaje va entero (no
	// se parte en pedidos: no hay nada que hacer en otra tab).
	const discutir = op.intencion === "discutir";
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	const texto = instruccion.trim();
	// Las fotos o los PDF del pedido (28/10/2026): la ruta los lee y van aparte de la instrucción.
	const archivos = op.archivos ?? [];
	if (!proyecto || !escena || (!texto && !archivos.length)) return;
	const proyectoId = proyecto.metadata.id;
	if (leerHilo(proyectoId).corriendo) return;

	const elegidos = editor.selection.getSelectedElements().map((e) => ({ trackId: e.trackId, elementId: e.elementId }));
	const alcanceReal = alcance === "seleccion" && elegidos.length ? "seleccion" : "video";
	cambiarHilo(proyectoId, (h) => ({
		corriendo: true,
		mensajes: [...h.mensajes, conId({ de: "yo", texto: memoriaConArchivos(texto, archivos.map((f) => f.name)), alcance: alcanceReal === "seleccion" ? rotuloSeleccion(elegidos.length) : null })],
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
	if (op.interpretar !== false && texto && !discutir) {
		const { pedido: lemos, conCita } = separarCita(texto);
		const ri = await pedirPedidos(lemos, { id: proyectoId, nombre: proyecto.metadata.name }, corte.signal);
		if (corte.signal.aborted) {
			terminar({ de: "mako", texto: "Detenido." });
			return;
		}
		// Falló o tardó: `interpretacionDe` devuelve lo de siempre (el mensaje entero a la IA del chat).
		const interp = interpretacionDe(ri, lemos);
		paraEditar = conCita(textoActual(interp));
		burbujas = burbujasDe(interp, proyectoId).map((b) => ({ de: "mako" as const, texto: b.texto, ...(b.links.length ? { links: b.links } : {}) }));
	}
	if (!paraEditar && !archivos.length) {
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
		fondo: datos.fondo,
	});

	if (vista.json.length > TOPES_CHAT.vistaMax) {
		terminar({ de: "mako", texto: "El proyecto es muy grande para el chat. Elige unos clips y pídelo sobre la selección.", error: true });
		return;
	}

	// Lo que se habló ANTES de este pedido (lib/editor-video/chat-conversacion.ts, 12/11/2026): sin eso, «hazlo» o «la edición de
	// la referencia» no sabían a qué se referían, ni a la receta que MaKo escribió al replicar un reel. El pedido de ahora es el
	// último «yo» del hilo: va como instrucción, no repetido como conversación.
	const hilo = leerHilo(proyectoId).mensajes;
	let ultimoYo = hilo.length - 1;
	while (ultimoYo >= 0 && hilo[ultimoYo].de !== "yo") ultimoYo--;
	const conversacion = hilo
		.slice(0, Math.max(0, ultimoYo))
		.slice(-TOPES_CONVERSACION.mensajes)
		.map((m) => ({ de: m.de, texto: m.texto, ...(m.de === "mako" && m.error ? { error: true } : {}) }));
	const r = await pedirIA({ instruccion: paraEditar, linea: vista.json, alcance: alcanceReal, ...(discutir ? { intencion: "discutir" } : {}), ...(conversacion.length ? { conversacion } : {}) }, corte.signal, archivos);
	if (!r.ok) {
		terminar({ de: "mako", texto: r.error, error: !("cortado" in r) });
		return;
	}
	// Discutir: la respuesta y nada más (el server ya tiró cualquier operación).
	if (discutir) {
		terminar({ de: "mako", texto: r.resumen || "No tengo nada que sugerir sobre eso." });
		return;
	}
	// La forma ya la validó la ruta; acá se vuelve a validar (el editor no le cree a nadie) y se
	// revisan las referencias contra la vista con la que se pidió.
	const { operaciones, descartes: deForma } = validarOperaciones(r.operaciones);
	const revision = revisarOperaciones({ operaciones, vista, alcance: alcanceReal, transcripcion: datos.transcripcion });
	// `deForma` es casi siempre vacío: la ruta ya filtró, y lo que tiró viene en `r.descartes`.
	// Tres subtítulos con el mismo motivo son UN motivo (./respuesta.ts).
	const descartes = descartesDelPedido({ ruta: r.descartes, forma: deForma, revision: revision.descartes });
	if (!revision.resueltas.length) {
		// El resumen del modelo afirma lo que IBA a hacer: si propuso algo y no quedó nada, lo dice el código (./respuesta.ts).
		const propuso = (Array.isArray(r.operaciones) ? r.operaciones.length : 0) + (r.descartes?.length ?? 0);
		terminar({ de: "mako", texto: textoSinCambios({ resumen: r.resumen, propuso }), descartes: descartes.length ? descartes : undefined });
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

/** «Borrar los silencios» mientras se aplica: qué está escuchando, cada silencio que encontró y el corte. */
function SilenciosEnVivo({ armado }: { armado: ArmadoChat }) {
	const fases = fasesDesde(
		[
			{ id: "escuchando", texto: armado.escuchando ? `Escuchar ${armado.escuchando}` : "Escuchar el audio" },
			{ id: "cortando", texto: "Cortar y pegar lo que queda" },
		],
		armado.fase === "listo" || armado.fase === "fallo" ? "cortando" : armado.fase,
		{ terminado: armado.fase === "listo", fallo: armado.fase === "fallo" },
	);
	return (
		<ArmadoEnVivo
			titulo={armado.fase === "listo" && armado.segundos !== undefined ? `Se quitaron ${textoSegundos(armado.segundos)}` : "Borrando los silencios"}
			fases={fases}
			piezas={armado.silencios.map((s, i) => ({ id: String(i), texto: `${textoSegundos(s.desde)} → ${textoSegundos(s.hasta)}`, detalle: `${s.titulo} · ${textoSegundos(s.hasta - s.desde)}` }))}
			unidad="silencios"
			terminado={armado.fase === "listo"}
		/>
	);
}

function RevisionPropuesta({
	mensajeId,
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
	mensajeId: string;
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
	const armado = useArmado(mensajeId);
	const trabajoSubtitulos = useTrabajoSubtitulos();
	const filas = cambios.slice(0, MAX_FILAS);
	const boton = "flex h-7 cursor-pointer items-center rounded-[4px] px-3 text-[12px] font-medium";
	return (
		<div className="grid grid-cols-1 gap-2 rounded-[8px] bg-(--surface-2) p-2.5">
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate text-[12px] font-semibold text-(--ink)">{resumenDeCambios(cambios) || "Sin cambios"}</span>
				<div className="flex shrink-0 rounded-[4px] bg-(--surface) p-0.5" role="group" aria-label="Comparar">
					{(["original", "modificado"] as const).map((v) => (
						<button
							key={v}
							type="button"
							aria-pressed={vista === v}
							onClick={() => setVista(v)}
							className="h-6 cursor-pointer rounded-[3px] px-2 text-[11px] text-(--faint) aria-pressed:bg-(--surface-2) aria-pressed:text-(--ink)"
						>
							{v === "original" ? "Original" : "Modificado"}
						</button>
					))}
				</div>
			</div>
			<ul className="grid grid-cols-1 gap-1.5">
				{filas.map((c, i) => {
					const lado = vista === "original" ? c.antes : c.despues;
					return (
						<li key={`${c.tipo}:${i}`} className="grid grid-cols-1 gap-0.5 rounded-[6px] bg-(--surface) px-2.5 py-2">
							<div className="flex min-w-0 items-center gap-1.5">
								<span
									className="shrink-0 rounded-[3px] px-1.5 py-px text-[10px] font-semibold"
									style={{
										background: c.tipo === "agrega" ? "color-mix(in srgb, var(--primary) 22%, transparent)" : c.tipo === "quita" ? "color-mix(in srgb, var(--destructive) 22%, transparent)" : "var(--surface-2)",
										color: c.tipo === "agrega" ? "var(--primary)" : c.tipo === "quita" ? "var(--destructive)" : "var(--dim)",
									}}
								>
									{ETIQUETA_CAMBIO[c.tipo]}
								</span>
								<b className="min-w-0 truncate text-[12px] font-medium text-(--ink)">{c.titulo}</b>
							</div>
							<p className={`m-0 text-[12px] text-(--dim) ${vista === "original" && c.tipo === "cambia" ? "line-through decoration-(--faint)" : ""}`}>
								{lado || (vista === "original" ? "No existía" : "Se quita")}
							</p>
						</li>
					);
				})}
			</ul>
			{cambios.length > MAX_FILAS && <span className="text-[11px] text-(--faint)">y {cambios.length - MAX_FILAS} más</span>}
			{armado && <SilenciosEnVivo armado={armado} />}
			{descartes && descartes.length > 0 && (
				<p className="m-0 rounded-[6px] bg-(--surface) px-2.5 py-1.5 text-[11.5px] text-(--faint)">
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
						<button type="button" onClick={onDescartar} className={`${boton} text-(--dim) hover:bg-(--velo-hover)`}>Descartar</button>
						<button type="button" onClick={onAceptar} className={`${boton} bg-(--primary) text-(--on-primary) hover:bg-(--primary-strong)`}>Aceptar</button>
					</>
				)}
				{estado === "aplicando" && (
					<span className="mr-auto flex min-w-0 items-center gap-2">
						<span className="size-4 shrink-0 animate-spin rounded-full border-2 border-(--faint) border-t-transparent" aria-label="Aplicando" />
						{/* Los subtítulos tardan (la primera vez baja el reconocedor): se dice qué está haciendo, como el panel. */}
						{trabajoSubtitulos.fase !== "inactivo" && (
							<span className="truncate text-[11.5px] text-(--dim)" aria-live="polite">{rotuloProgresoSubtitulos(trabajoSubtitulos.fase, trabajoSubtitulos.progreso)}</span>
						)}
					</span>
				)}
				{estado === "sin-version" && (
					<>
						<button type="button" onClick={onDescartar} className={`${boton} text-(--dim) hover:bg-(--velo-hover)`}>Descartar</button>
						<button type="button" onClick={onAplicarIgual} className={`${boton} border border-(--border-strong) text-(--ink) hover:bg-(--velo-hover)`}>Aplicar igual</button>
					</>
				)}
				{estado === "aplicada" && (
					<>
						<span className="mr-auto flex items-center gap-1 text-[12px] font-semibold text-(--dim)">
							<HugeiconsIcon icon={Tick02Icon} className="size-3.5" /> Aplicado
						</span>
						{puedeRestaurar && (
							<button type="button" onClick={onRestaurar} className={`${boton} border border-(--border-strong) text-(--ink) hover:bg-(--velo-hover)`}>Restaurar</button>
						)}
					</>
				)}
				{estado === "descartada" && <span className="mr-auto text-[12px] font-semibold text-(--faint)">Descartado</span>}
				{estado === "restaurada" && <span className="mr-auto text-[12px] font-semibold text-(--faint)">Restaurado</span>}
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
	{ rotulo: "Borra los silencios", instruccion: "Borra los silencios del video." },
	{ rotulo: "Baja la música", instruccion: "Baja a la mitad el volumen de los audios." },
	{ rotulo: "Silencia los videos", instruccion: "Silencia el sonido original de los videos." },
	{ rotulo: "Alarga los textos", instruccion: "Haz que cada texto dure un segundo más, sin pisar a los demás." },
];

export function PanelChat({ volver = null }: { /** La «←» de la pantalla de Create: da vuelta la tarjeta a la lista de proyectos. */ volver?: ReactNode }) {
	const editor = useEditor();
	const proyectoId = useEditor((e) => e.project.getActiveOrNull()?.metadata.id ?? "");
	const tracksVivos = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const seleccion = useEditor((e) => e.selection.getSelectedElements());
	const nombreProyecto = useEditor((e) => e.project.getActiveOrNull()?.metadata.name ?? null);
	const hilo = useHilo(proyectoId);
	const [texto, setTexto] = useState("");
	// Sin la app de escritorio no se escribe (25/10/2026, Martín: «En ningun chat, no solo en Ops Center»): app/_chat/useAppDeEscritorio.tsx.
	const appEscritorio = useAppDeEscritorio();
	const [alcance, setAlcance] = useState<"video" | "seleccion">("video");
	// «Discutir | Editar», con la misma preferencia que los otros chats de MaKo (app/_chat/SelectorIntencion.tsx).
	const [intencion, elegirIntencion] = useIntencion();
	// EDITAR CON IA ES SÓLO DE MaKo PRO (14/11/2026, lib/editores-ia-pro.ts): el editor es de los dos planes. Un Esencial ve el
	// hilo, la pregunta de los subtítulos (corren en el navegador, sin IA) y la guía de una plantilla; en lugar de la caja y de
	// las píldoras, el candado con «Pasar a Pro».
	const soloPro = useSoloPro("ia-editores");
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

	/** `dejarCaja`: lo manda una nota de voz por detrás (lo que la persona esté escribiendo mientras tanto queda en la caja). */
	// Fotos y PDF con el pedido (28/10/2026, las cajas unificadas): sólo los de la caja (`op.archivos`).
	const adj = useAdjuntosDelChat({ puede: !hilo.corriendo && !!proyectoId, onError: (m) => { if (m) toast.error(m); } });
	const cita = useCitaDelChat(proyectoId);
	const enviar = (instruccion: string, alc: "video" | "seleccion" = alcanceReal, op: { interpretar?: boolean; dejarCaja?: boolean; archivos?: readonly File[] } = {}) => {
		if (hilo.corriendo || (!instruccion.trim() && !op.archivos?.length) || !proyectoId || appEscritorio.bloqueada) return;
		// Una nota de voz sale por detrás: la cita queda para lo que se está escribiendo.
		if (!op.dejarCaja) instruccion = cita.con(instruccion.slice(0, TOPES_CHAT.instruccion - cita.reserva), !!op.archivos?.length);
		// «sí, hazlo» debajo de una propuesta que espera = su «Aceptar» (./confirmar.ts): la IA del chat no ve la charla y
		// contestaba «"Si hazlo" es muy vago» (Leandro, 28/10/2026). Con una cita o un archivo ya no es un «sí» suelto.
		const queConfirma = !op.archivos?.length && esConfirmacion(instruccion) ? propuestaQueConfirma(leerHilo(proyectoId).mensajes) : null;
		if (queConfirma && queConfirma.de === "mako") {
			cambiarHilo(proyectoId, (h) => ({ ...h, mensajes: [...h.mensajes, conId({ de: "yo", texto: instruccion.trim(), alcance: null })] }));
			if (!op.dejarCaja) { setTexto(""); cita.soltar(); }
			void aceptar(queConfirma);
			return;
		}
		void pedirEdicion(editorRef.current, instruccion.slice(0, TOPES_CHAT.instruccion), alc, { ...op, intencion });
		if (!op.dejarCaja) { setTexto(""); cita.soltar(); }
	};

	// La nota de voz sale en el acto (28/10/2026): se dibuja ya, se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts) y sale
	// por `enviar`, como lo escrito.
	const nota = useNotaEnElActo({ clave: `video:${proyectoId ?? ""}`, puede: !hilo.corriendo && !!proyectoId && !appEscritorio.bloqueada, mandar: (t) => enviar(t, alcanceReal, { dejarCaja: true }) });

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
		empezarArmado(m.id);
		// Los cursores de los agentes que hacen este cambio, a la vista mientras se aplica (enjambre/cursores-sueltos.ts).
		// Sólo los agentes de ESTE pedido, sobre lo que toca: sus clips y sus segundos; cada pausa que encuentra «Borrar silencios»,
		// al cursor de corte-01 en el momento (Martín, 11/11/2026: «que no aparezcan cursores que no tengan sentido con lo pedido»).
		const soltarCursores = mostrarCursores(agentesDeOperaciones(m.propuesta.operaciones), tareasDeOperaciones(m.propuesta));
		const r = await aceptarPropuesta(editorRef.current, m.propuesta, { sinVersion, alProgreso: (p) => { anotarProgreso(m.id, p); if (p.tipo === "silencio") sumarTiempo("corte-01", p.desde); } }).finally(soltarCursores);
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
	const visibles = SUGERENCIAS.filter((s) => !s.necesitaSeleccion || seleccion.length > 0);

	// MAKO TOMA LA INICIATIVA (5/11/2026, docs/mako-iniciativa/plan.md T11): con voz y sin subtítulos, «¿Lo van a ver sin sonido?»
	// (lib/aperturas/video.ts). «Sí, en el feed» corre el mismo motor que el botón de Subtítulos (Whisper en el navegador: sin la
	// app de escritorio también). Mientras habla, las píldoras de siempre se esconden: un paso por pantalla.
	const conAudio = !!tracksVivos && (tracksVivos.main.elements.some((e) => e.type === "video") || tracksVivos.audio.some((t) => t.elements.length > 0));
	// UNA PLANTILLA GUIADA (9/11/2026, la tab Video): MaKo lleva sus pasos (../../guia/GuiaEnElChat.tsx) y, MIENTRAS PREGUNTA, lo de
	// siempre calla —la pregunta de los subtítulos y las píldoras—: un paso por pantalla. Cuando la guía no tiene nada que preguntar
	// (todo contestado o salteado), vuelve lo de siempre: con «el proyecto es guiado» a secas, el chat quedaba sin sugerencias para
	// siempre (la revisión del 9/11/2026).
	const [guiaHablando, setGuiaHablando] = useState(false);
	const estadoApertura = useApertura({
		superficie: SUPERFICIE_VIDEO,
		hechos: { proyecto: proyectoId || null, conAudio, subtitulos: subtitulosDe(tracksVivos).length, charlaVacia: hilo.mensajes.length === 0 },
		libre: !hilo.corriendo && !guiaHablando,
	});
	const subtitulando = useTrabajoSubtitulos((s) => s.fase !== "inactivo");
	// El resultado queda EN EL HILO, como si la persona hubiera contestado (11/11/2026, probado en producción): con un aviso
	// que se va a los segundos, el chat volvía a «Pídeme…» sin decir si salieron, ni por qué no. «Ocupado» y «cancelado» no
	// son una respuesta a la pregunta: siguen como aviso.
	const ponerSubtitulos = () => {
		const id = proyectoId;
		void generarSubtitulos(editorRef.current).then((r) => {
			if (!r.ok && (r.motivo === "ocupado" || r.motivo === "cancelado")) {
				toast(textoDeSubtitulos(r.motivo));
				return;
			}
			const texto = r.ok
				? `Listo: puse ${r.subtitulos} ${r.subtitulos === 1 ? "subtítulo" : "subtítulos"}.`
				: textoDeSubtitulos(r.motivo);
			// La respuesta, un milisegundo DESPUÉS: con la misma hora, la base desempata por el id (al azar) y al recargar
			// quedaba «Listo» arriba de «Sí, en el feed» (producción, 11/11/2026; lib/editor-video/chat-hilo.ts, `enOrden`).
			const yo = conId({ de: "yo", texto: "Sí, en el feed", alcance: null });
			const mako = { ...conId({ de: "mako", texto, error: !r.ok }), c: yo.c + 1, t: yo.t + 1 };
			cambiarHilo(id, (h) => ({ ...h, mensajes: [...h.mensajes, yo, mako] }));
		});
	};
	// Sin la app de escritorio el envío se corta adentro de `enviar` (useAppDeEscritorio): un atajo prendido no hacía NADA al
	// tocarlo y no decía por qué (probado en producción el 11/11/2026). Apagado, con la misma frase que la caja.
	const atajoApagado = hilo.corriendo || appEscritorio.bloqueada;
	const porQueApagado = appEscritorio.bloqueada ? appEscritorio.bloqueo?.frase : undefined;
	const pildora = "cursor-pointer rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 text-left text-[12px] text-(--ink) hover:bg-(--velo-hover) disabled:cursor-default disabled:opacity-50";
	const chip = "flex h-[26px] min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium";

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
				<div data-mensaje={m.id} className="mt-1 grid gap-2 rounded-[14px] transition-shadow" style={foco === m.id ? { boxShadow: "0 0 0 2px var(--primary)" } : undefined}>
					{/* Un pedido que no es de este proyecto (chat/pedidos.ts): a dónde lleva. El Link pega el ?ws=. */}
					{m.links && m.links.length > 0 && (
						<div className="flex flex-wrap gap-1.5 self-start">
							{m.links.map((l) => (
								<Link key={l.href} href={l.href} className="rounded-full bg-(--primary-bg) px-3 py-1.5 text-[12px] text-(--primary-strong) hover:bg-(--velo-hover)">
									{l.texto}
								</Link>
							))}
						</div>
					)}
					{m.propuesta && m.cambios && m.estado ? (
						<RevisionPropuesta
							mensajeId={m.id}
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
						<p className="m-0 self-start rounded-[6px] bg-(--surface-2) px-2.5 py-1.5 text-[11.5px] text-(--faint)">
							No se aplica: {m.descartes.slice(0, 3).join(" · ")}
						</p>
					) : null}
				</div>
			),
		};
	};

	return (
		// Un <section> y no un <aside>: con la barra de la agencia, `[data-barra-agencia] aside` (app/globals.css) le fuerza a todo <aside> el alto de la ventana, y la caja quedaba fuera de la vista (medido el 22/10/2026).
		// La tarjeta izquierda de la pantalla de Create (app/_crear/PantallaCrear.tsx): llena su alto y NO se cierra. La «←»
		// de su cabecera (`volver`) la da vuelta a la lista de proyectos.
		// `data-mako-chat`: el velo de la guía le deja el hueco (app/_ui/guia/VeloGuia.tsx): con una pregunta de MaKo marcada, todo
		// lo demás se opaca y esta tarjeta queda clara.
		<section role="complementary" className="cc-chat flex min-h-0 w-full flex-1 flex-col bg-(--surface)" aria-label="Editar con IA" data-mako-chat="">
			{/* La cabecera de toda tarjeta de Create (29/10/2026): «MaKo» con su estrella (la regla de las criaturas, 21/10) y la «←». */}
			<CabeceraDeChat clave={`video:${proyectoId}`} titulo="MaKo" criatura="MaKo" aspecto={ASPECTO_MAKO}
				animo={hilo.corriendo ? "trabajando" : "despierto"} antes={volver} />

			<div ref={hiloRef} className="co-hilo" style={{ padding: "12px" }} aria-live="polite">
				<div className="co-hilo__col">
					{/* «Sí, en el feed» corre los subtítulos (~2 min la primera vez, baja el reconocedor): mientras tanto, en vez de
					    la pregunta con sus botones quietos, lo que está haciendo (medido el 10/11/2026: dos minutos sin nada). */}
					{hilo.mensajes.length === 0 && estadoApertura.apertura && (subtitulando
						? <SubtitulandoEnElChat />
						: <AperturaMako estado={estadoApertura} quien={QUIEN} acciones={{ subtitulos: ponerSubtitulos }} />)}
					{hilo.mensajes.length === 0 && !estadoApertura.apertura && !guiaHablando && !soloPro && (
						<>
							{/* Sin el texto que explicaba el chat («Pídeme que edite…», 12/11/2026, Martín: «un texto que es innecesario»). */}
							<div className="flex flex-wrap gap-1.5">
								{visibles.map((s) => (
									<button key={s.rotulo} type="button" className={pildora} onClick={() => sugerir(s)} disabled={atajoApagado} title={porQueApagado}>{s.rotulo}</button>
								))}
							</div>
						</>
					)}
					<HiloMako items={nota.conNotas(items)} quien={QUIEN} ahora={Date.now()} escribiendo={hilo.corriendo ? { segs: 0 } : null}
						tarjeta={null} onTarjeta={nada} onReintentar={nota.reintentar(nada)} onDescartar={nota.descartar} onRecargar={nada} onCitar={cita.citar} enMensaje={enMensaje} />
					{hilo.corriendo && (
						<button type="button" onClick={detener} className="cursor-pointer self-start text-[12px] text-(--faint) hover:text-(--ink)">
							Detener generación
						</button>
					)}
					{proyectoId && <GuiaEnElChat proyectoId={proyectoId} ocupado={hilo.corriendo} quien={QUIEN} onHablando={setGuiaHablando} />}
					{hilo.mensajes.length > 0 && !hilo.corriendo && !guiaHablando && !soloPro && (
						<div className="flex flex-wrap gap-1.5">
							{visibles.slice(0, 4).map((s) => (
								<button key={s.rotulo} type="button" className={pildora} onClick={() => sugerir(s)} disabled={atajoApagado} title={porQueApagado}>{s.rotulo}</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* El audio grabado entra en este pie por la regla común de `.co-caja` (centro.css) y la barra contenida (VoiceRecorder.tsx). */}
			{/* Un Esencial: el candado de Pro en el lugar de la caja (app/_components/CandadoSoloPro.tsx). */}
			{soloPro ? (
				<footer className="shrink-0 px-3 pt-2 pb-3">
					<CandadoSoloPro funcion="ia-editores" />
				</footer>
			) : <footer className="grid shrink-0 gap-2 px-3 pt-2 pb-3">
				<div className="flex min-w-0 gap-1.5" role="group" aria-label="Alcance">
					<button
						type="button"
						aria-pressed={alcanceReal === "video"}
						onClick={() => setAlcance("video")}
						className={`${chip} border-(--border-strong) text-(--faint) aria-pressed:border-(--primary) aria-pressed:text-(--primary)`}
					>
						Todo el video
					</button>
					{seleccion.length > 0 && (
						<button
							type="button"
							aria-pressed={alcanceReal === "seleccion"}
							onClick={() => setAlcance("seleccion")}
							className={`${chip} border-(--border-strong) text-(--faint) aria-pressed:border-(--primary) aria-pressed:text-(--primary)`}
						>
							<span className="truncate">{rotuloSeleccion(seleccion.length)}</span>
						</button>
					)}
				</div>
				<SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={hilo.corriendo} />
				{/* La caja única (app/_chat/CajaChat.tsx), con los tokens de MaKo tal cual. */}
				<div className="co-caja">
					<CajaChat campo={inputRef} texto={texto} onTexto={setTexto} onMandar={() => { if (!adj.preparando) enviar(texto, alcanceReal, { archivos: adj.tomar() }); }} ocupado={hilo.corriendo || nota.pendientes}
						apagado={!proyectoId} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
						arriba={cita.arriba} adjuntos={adj.caja} topeTexto={TOPES_CHAT.instruccion - cita.reserva} />
				</div>
			</footer>}
		</section>
	);
}

/** Los subtítulos corriendo: la misma frase del panel (subtitles/resultado.ts), con su ruedita. */
function SubtitulandoEnElChat() {
	const t = useTrabajoSubtitulos();
	return (
		<div className="flex items-center gap-2 self-start rounded-[12px] bg-(--surface-2) px-3 py-2 text-[12.5px] leading-[1.5] text-(--ink)" aria-live="polite">
			<span className="size-4 shrink-0 animate-spin rounded-full border-2 border-(--faint) border-t-transparent" aria-hidden />
			{rotuloProgresoSubtitulos(t.fase, t.progreso)}
		</div>
	);
}

/**
 * Quien contesta en el hilo: MaKo, con su estrella, como la cabecera de la tarjeta. Hasta el 10/11/2026 era la criatura
 * «Video Editor» (un triángulo rosa debajo de la estrella de la cabecera); Martín, 21/10/2026 (AGENTS.md, «MaKo EN CADA
 * TAB»): «los iconos de las criaturas siempre debe ser el icono de MaKo». Como Web Generator (paneles/ChatAgente.tsx).
 */
const QUIEN = { nombre: "MaKo", aspecto: ASPECTO_MAKO };
const nada = () => {};
