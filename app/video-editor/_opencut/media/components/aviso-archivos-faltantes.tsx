"use client";

// =============================================================================
// El aviso de los archivos que faltan en ESTE navegador, en la computadora, encima del reproductor
// =============================================================================
// Lo mismo que el teléfono (app/m/video-editor/EditorVideoM.tsx, 12/11/2026): si el navegador perdió el archivo de un
// clip (el OPFS se vació y el proyecto en IndexedDB quedó), el reproductor queda negro y mudo. La computadora lo decía sólo
// al generar subtítulos y en Exportar, y NO dejaba volver a enlazarlo: importarlo de nuevo le da otro id y el clip sigue sin
// archivo. Acá se nombra cada archivo con «Elegir», que lo vuelve a enlazar con el MISMO medio (../reenlazar.ts →
// MediaManager.reenlazarMedio): el clip conserva todo y el aviso se va. Qué falta: ../archivos-faltantes.ts.

import { useMemo, useRef, useState } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { aceptaDelFaltante, archivosFaltantes, textoDelAviso, type ArchivoFaltante } from "../archivos-faltantes";
import { reenlazarArchivo } from "../reenlazar";

/** Los archivos que la línea usa y no están en este navegador, uno por archivo (vacío mientras carga la biblioteca). */
export function useArchivosFaltantes(): ArchivoFaltante[] {
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const medios = useEditor((e) => e.media.getAssets());
	// Mientras carga la biblioteca está vacía: todo «faltaría» un instante.
	const cargando = useEditor((e) => e.media.isLoadingMedia());
	return useMemo(
		() => (cargando || !tracks ? [] : archivosFaltantes(tracks, new Set(medios.map((m) => m.id)))),
		[tracks, medios, cargando],
	);
}

export function AvisoArchivosFaltantes() {
	const editor = useEditor();
	const faltan = useArchivosFaltantes();
	const entrada = useRef<HTMLInputElement>(null);
	const pedido = useRef<ArchivoFaltante | null>(null);
	const [enlazando, setEnlazando] = useState<string | null>(null);
	if (!faltan.length) return null;

	// El selector se abre en el mismo clic (si no, el navegador no lo abre), con el tipo del clip.
	const elegir = (f: ArchivoFaltante) => {
		const input = entrada.current;
		if (!input || enlazando) return;
		pedido.current = f;
		input.accept = aceptaDelFaltante(f.tipo);
		input.click();
	};
	const enlazar = async (file: File | undefined) => {
		const f = pedido.current;
		pedido.current = null;
		if (!file || !f) return;
		setEnlazando(f.mediaId);
		try {
			await reenlazarArchivo({ editor, mediaId: f.mediaId, tipo: f.tipo, file });
		} finally {
			setEnlazando(null);
		}
	};

	return (
		<div
			data-aviso-archivos-faltantes=""
			role="status"
			className="absolute inset-x-3 bottom-12 z-20 flex flex-col gap-2 rounded-[7px] border border-(--cc-line-2) bg-(--cc-raised) p-3 shadow-lg"
		>
			<p className="text-[13px] text-(--cc-text)">{textoDelAviso(faltan, "navegador")}</p>
			<ul className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
				{faltan.map((f) => (
					<li key={f.mediaId} className="flex min-w-0 items-center justify-between gap-2">
						<span className="min-w-0 truncate text-[13px] text-(--cc-text-2)" title={f.nombre}>
							{f.nombre}
						</span>
						<button
							type="button"
							disabled={enlazando !== null}
							aria-label={`Elegir ${f.nombre}`}
							onClick={() => elegir(f)}
							className="shrink-0 cursor-pointer rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:opacity-90 disabled:cursor-default disabled:opacity-60"
						>
							{enlazando === f.mediaId ? "Enlazando…" : "Elegir el archivo"}
						</button>
					</li>
				))}
			</ul>
			<input
				ref={entrada}
				type="file"
				hidden
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					void enlazar(file);
				}}
			/>
		</div>
	);
}
