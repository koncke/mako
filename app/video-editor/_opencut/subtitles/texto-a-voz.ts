// =============================================================================
// «Texto a voz»: el lado del navegador (voces, generar, poner en la línea)
// =============================================================================
// Vive en subtitles/ porque es del paquete de subtítulos y voz (K); la pestaña
// está en ./components/texto-a-voz.tsx y la ruta en app/api/video-editor/tts.
//
// ⚠️ UN click, UN pedido. Esto gasta caracteres de la cuenta de ElevenLabs DEL
// CLIENTE: no hay reintento automático en ningún punto (ni acá, ni en la ruta).
// Si la respuesta no vuelve, el pedido pudo haber salido y cobrado; lo decide la
// persona apretando de nuevo (AGENTS.md, «En lo que gasta plata ajena, el
// default es NO reintentar»).

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { importarArchivos } from "@/app/video-editor/_opencut/media/importar";
import { buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import { mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm";

export type VozTts = {
	id: string;
	nombre: string;
	categoria: string;
	genero: string | null;
	acento: string | null;
	muestra: string | null;
};

export type EstadoVoces =
	| { estado: "ok"; voces: VozTts[]; tope: number }
	| { estado: "sin-key" }
	| { estado: "error"; error: string };

const RUTA = "/api/video-editor/tts";

/** La marca del audio de «Texto a voz» (la lee la vinculación, ripple/iman.ts). */
export const PARAM_TTS = "tts";

let cache: Promise<EstadoVoces> | null = null;

async function pedirVoces(): Promise<EstadoVoces> {
	try {
		const r = await fetch(RUTA, { cache: "no-store" });
		const j = (await r.json().catch(() => null)) as
			| { ok: true; hayKey: boolean; voces: VozTts[]; tope: number }
			| { ok: false; error?: string }
			| null;
		if (!j) return { estado: "error", error: "Error al cargar" };
		if (!j.ok) return { estado: "error", error: j.error || "Error al cargar" };
		if (!j.hayKey) return { estado: "sin-key" };
		return { estado: "ok", voces: j.voces, tope: j.tope };
	} catch {
		return { estado: "error", error: "Error al cargar" };
	}
}

/**
 * Las voces de la cuenta del cliente. Leer no gasta: se pide una vez por
 * pestaña y se recuerda; un error no queda recordado (se vuelve a pedir).
 */
export function vocesTts({ otraVez = false }: { otraVez?: boolean } = {}): Promise<EstadoVoces> {
	if (otraVez || !cache) {
		cache = pedirVoces().then((r) => {
			if (r.estado === "error") cache = null;
			return r;
		});
	}
	return cache;
}

/** El texto que se manda: el contenido sin los saltos de línea del subtítulo. */
export function textoParaVoz(element: TextElement): string {
	return String(element.params.content ?? "").replace(/\s*\n\s*/g, " ").trim();
}

// Los textos con un pedido en vuelo. Vive fuera de la pestaña: si el cliente
// elige otro clip y vuelve, el botón tiene que seguir apagado (un segundo click
// sería un segundo cobro por el mismo audio).
const enCurso = new Map<string, Promise<string | null>>();

/** El pedido en vuelo para este texto, si hay uno. */
export function generandoVozPara(elementId: string): Promise<string | null> | null {
	return enCurso.get(elementId) ?? null;
}

/**
 * Pide el mp3 y lo pone en la línea de tiempo al inicio del texto. Devuelve un
 * error para la pantalla, o null si salió bien.
 */
export async function generarVoz({
	editor,
	element,
	voz,
}: {
	editor: EditorCore;
	element: TextElement;
	voz: VozTts;
}): Promise<string | null> {
	const texto = textoParaVoz(element);
	if (!texto) return "El texto está vacío";
	const ya = enCurso.get(element.id);
	if (ya) return ya;
	const pedido = pedirYPoner({ editor, element, voz, texto }).finally(() => {
		enCurso.delete(element.id);
	});
	enCurso.set(element.id, pedido);
	return pedido;
}

async function pedirYPoner({
	editor,
	element,
	voz,
	texto,
}: {
	editor: EditorCore;
	element: TextElement;
	voz: VozTts;
	texto: string;
}): Promise<string | null> {
	let respuesta: Response;
	try {
		respuesta = await fetch(RUTA, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ texto, voz: voz.id }),
		});
	} catch {
		// Sin respuesta: el pedido pudo haber llegado. No se reintenta.
		return "No se pudo generar la voz";
	}
	if (!(respuesta.headers.get("content-type") ?? "").includes("audio/")) {
		const j = (await respuesta.json().catch(() => null)) as { error?: string } | null;
		return j?.error || "No se pudo generar la voz";
	}

	const mp3 = await respuesta.blob();
	const nombre = `${voz.nombre} - ${texto.slice(0, 32)}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
	const archivo = new File([mp3], `${nombre}.mp3`, { type: "audio/mpeg" });
	const [asset] = await importarArchivos({ editor, files: [archivo] });
	if (!asset) return "No se pudo importar";

	const base = buildElementFromMedia({
		mediaId: asset.id,
		mediaType: "audio",
		name: "Texto a voz",
		duration: mediaTimeFromSeconds({ seconds: asset.duration ?? 1 }),
		startTime: element.startTime,
	});
	editor.timeline.insertElement({
		element: { ...base, params: { ...base.params, [PARAM_TTS]: true } },
		placement: { mode: "auto", trackType: "audio" },
	});
	return null;
}
