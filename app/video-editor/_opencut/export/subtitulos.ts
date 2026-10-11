// =============================================================================
// «Subtítulos» del diálogo Exportar: los textos marcados como subtítulo, en SRT
// =============================================================================
// Un texto ES subtítulo si lleva el param `subtitulo` = true (contrato del
// paquete K, docs/diseno-editor-video.md §4.1): lo pone «Subtítulos
// automáticos» y lo respeta la pista «Subtítulos». El resto de los textos
// (títulos, rótulos) NO van al archivo, como en CapCut.
//
// Sin ningún subtítulo la casilla se dibuja apagada: exportar un .srt vacío es
// un archivo que no sirve y que igual hay que borrar.

import type { SceneTracks, TextElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import type { FormatoSubtituloId } from "./opciones";

export type Subtitulo = { inicio: number; fin: number; texto: string };

export function subtitulosDe(tracks: SceneTracks): Subtitulo[] {
	const lista: Subtitulo[] = [];
	for (const pista of tracks.overlay) {
		if (pista.type !== "text") continue;
		for (const el of pista.elements as TextElement[]) {
			if (el.params?.subtitulo !== true || el.hidden) continue;
			const texto = String(el.params.content ?? "").trim();
			if (!texto) continue;
			const inicio = el.startTime / TICKS_PER_SECOND;
			lista.push({ inicio, fin: inicio + el.duration / TICKS_PER_SECOND, texto });
		}
	}
	return lista.sort((a, b) => a.inicio - b.inicio);
}

/** `00:01:02,345`: la coma decimal es del formato SRT, no una elección. */
function tiempoSrt(segundos: number): string {
	const ms = Math.max(0, Math.round(segundos * 1000));
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	const s = Math.floor((ms % 60_000) / 1000);
	const resto = ms % 1000;
	const dos = (n: number) => String(n).padStart(2, "0");
	return `${dos(h)}:${dos(m)}:${dos(s)},${String(resto).padStart(3, "0")}`;
}

export function archivoSubtitulos({
	subtitulos,
	formato,
}: {
	subtitulos: Subtitulo[];
	formato: FormatoSubtituloId;
}): Blob {
	const contenido =
		formato === "txt"
			? subtitulos.map((s) => s.texto).join("\n")
			: subtitulos
					.map((s, i) => `${i + 1}\n${tiempoSrt(s.inicio)} --> ${tiempoSrt(s.fin)}\n${s.texto}\n`)
					.join("\n");
	// BOM de UTF-8: sin él, el Bloc de notas y varios reproductores de Windows
	// leen los acentos como «Ã©».
	return new Blob(["﻿", contenido], { type: formato === "txt" ? "text/plain" : "application/x-subrip" });
}
