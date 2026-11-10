// =============================================================================
// B-roll: lo que se le pide a /api/video-editor/broll y cómo entra un archivo de Pexels a Multimedia
// =============================================================================
// Lo usan «Proponer» (./proponer.ts) y «Cambiar por otra» (./cambiar.ts): la MISMA búsqueda y la MISMA bajada, así una
// foto o un video entran igual por los dos caminos. La ruta lee la clave de Pexels del negocio y nunca escribe nada; el
// navegador manda el ID de la foto o del video, nunca una URL.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import type { OrientacionBroll } from "@/lib/editor-video/broll-pexels";
import type { MedioBroll } from "./pistas";

export const RUTA_BROLL = "/api/video-editor/broll";

/** Lo que dice la ruta cuando no sale: el texto, y si es porque falta conectar Pexels. */
export type FallaRuta = { error: string; faltaPexels: boolean; status: number };

export async function pedirJson<T>(cuerpo: object, plazoMs: number): Promise<{ ok: true; datos: T } | { ok: false; falla: FallaRuta }> {
	try {
		const r = await fetch(RUTA_BROLL, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(cuerpo),
			signal: AbortSignal.timeout(plazoMs),
		});
		const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string; falta?: { servicio?: string } } & T) | null;
		if (!r.ok || !j || j.ok === false) {
			return { ok: false, falla: { error: j?.error ?? `El servidor contestó ${r.status}.`, faltaPexels: j?.falta?.servicio === "pexels", status: r.status } };
		}
		return { ok: true, datos: j };
	} catch {
		return { ok: false, falla: { error: "", faltaPexels: false, status: 0 } };
	}
}

/** Un archivo bajado de Pexels, listo para Multimedia, con el crédito de quien lo sacó o lo filmó. */
export type Bajada = { ok: true; archivo: File; autor: string } | { ok: false; error: string };

/**
 * Baja la foto o el video `id` por la ruta (que lo pide a Pexels con la clave del negocio). Un video pesa hasta 4 MB:
 * se le da más tiempo que a una foto.
 */
export async function bajarDePexels(id: number, medio: MedioBroll, orientacion: OrientacionBroll): Promise<Bajada> {
	const video = medio === "videos";
	try {
		const url = video ? `${RUTA_BROLL}?video=${id}` : `${RUTA_BROLL}?foto=${id}&orientacion=${orientacion}`;
		const r = await fetch(url, { signal: AbortSignal.timeout(video ? 110_000 : 30_000) });
		if (!r.ok) {
			const j = (await r.json().catch(() => null)) as { error?: string } | null;
			return { ok: false, error: j?.error ?? "" };
		}
		const blob = await r.blob();
		if (video ? blob.type !== "video/mp4" : !blob.type.startsWith("image/")) return { ok: false, error: "" };
		const ext = video ? "mp4" : blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
		let autor = "";
		try { autor = decodeURIComponent(r.headers.get("x-foto-autor") ?? ""); } catch { /* sin crédito */ }
		return { ok: true, archivo: new File([blob], `pexels-${id}.${ext}`, { type: blob.type }), autor };
	} catch {
		return { ok: false, error: "" };
	}
}

/** El archivo bajado, en Multimedia del proyecto (queda ahí aunque después se saque de la línea de tiempo). */
export async function aMultimedia(editor: EditorCore, projectId: string, archivo: File): Promise<MediaAsset | null> {
	const [procesado] = await processMediaAssets({ files: [archivo] });
	if (!procesado) return null;
	return editor.media.addMediaAsset({ projectId, asset: procesado });
}
