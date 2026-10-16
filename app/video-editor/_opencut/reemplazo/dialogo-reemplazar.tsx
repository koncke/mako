"use client";

// =============================================================================
// El diálogo «Reemplazar el clip» (`pc_replace_fragment`)
// =============================================================================
// Lo abren el menú del clip y el botón «Sustituir» de una muestra de plantilla
// (timeline/components/timeline-element.tsx); va montado UNA vez en editor-page.tsx
// y se dibuja en el portal de `.ce` (DialogContent ya lo pone ahí).
//
// La grilla es la de Multimedia sin los medios ocultos (muestras, cuadros
// congelados, revertidos), sin el audio y filtrada por lo que acepta el hueco. Un
// video más corto que lo que pide el clip va apagado con «Muy corto» (CapCut lo
// rechaza: `pc_the_current_video_is_shorter_than_the_original_clip`). Elegir un
// medio lo sustituye y cierra; «Importar» trae archivos y, si es uno que sirve, lo
// sustituye de una. Todo pasa por reemplazarClip (./reemplazar.ts): los avisos y
// las reglas son los mismos que al soltar un medio sobre la muestra.

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddCircleIcon, Image02Icon, Video01Icon } from "@hugeicons/core-free-icons";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import {
	GrillaBiblioteca,
	ZonaImportar,
	formatearDuracion,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useImportarArchivos } from "@/app/video-editor/_opencut/media/importar";
import { useFileUpload } from "@/app/video-editor/_opencut/media/use-file-upload";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { aceptaMedio, alcanza, mediosParaReemplazo, requisitosDelReemplazo, type Acepta } from "./puro";
import { reemplazarClip } from "./reemplazar";
import { useReemplazo } from "./estado";

/** `pc_Image_replaces_video_resulting_audio_loss`, sin los paréntesis: va en el `title` de la foto. */
const AVISO_AUDIO = "Sustituir el video con la foto causará una pérdida de audio";

const ACEPTA_ARCHIVOS: Record<Acepta, string> = { ambos: "image/*,video/*", video: "video/*", imagen: "image/*" };
const TEXTO_ZONA: Record<Acepta, string> = {
	ambos: "Arrastra y suelta los videos y las fotos aquí",
	video: "Arrastra y suelta los videos aquí",
	imagen: "Arrastra y suelta las fotos aquí",
};

export function DialogoReemplazar() {
	const objetivo = useReemplazo((s) => s.objetivo);
	const cerrar = useReemplazo((s) => s.cerrar);
	if (!objetivo) return null;
	return (
		<Dialog open onOpenChange={(abierto) => !abierto && cerrar()}>
			<DialogContent
				className="max-w-[600px] gap-0 bg-(--cc-panel)"
				onOpenAutoFocus={(e) => e.preventDefault()}
				aria-describedby={undefined}
			>
				<DialogHeader className="py-4">
					<DialogTitle className="text-[15px] font-medium">Reemplazar el clip</DialogTitle>
				</DialogHeader>
				{/* El estado del diálogo vive en un hijo: se monta sólo abierto (AGENTS, el lint). */}
				<Contenido objetivo={objetivo} onCerrar={cerrar} />
			</DialogContent>
		</Dialog>
	);
}

function Contenido({ objetivo, onCerrar }: { objetivo: ElementRef; onCerrar: () => void }) {
	const editor = useEditor();
	const medios = useEditor((e) => e.media.getAssets());
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const requisitos = useMemo(() => (tracks ? requisitosDelReemplazo(tracks, objetivo) : null), [tracks, objetivo]);

	// El clip dejó de existir (se deshizo, se borró): no hay qué reemplazar.
	useEffect(() => {
		if (!requisitos) onCerrar();
	}, [requisitos, onCerrar]);

	const acepta = requisitos?.acepta ?? "ambos";
	const lista = useMemo(() => mediosParaReemplazo(medios, acepta), [medios, acepta]);

	const elegir = (mediaId: string) => {
		if (reemplazarClip(editor, objetivo, mediaId)) onCerrar();
	};

	const { importar, procesando, progreso } = useImportarArchivos();
	const { isDragOver, dragProps, openFilePicker, fileInputProps } = useFileUpload({
		accept: ACEPTA_ARCHIVOS[acepta],
		multiple: true,
		onFilesSelected: (files) => {
			void importar({ files }).then((creados) => {
				// Un archivo que sirve: se sustituye de una, como si se lo hubiera elegido.
				const [unico] = creados;
				if (creados.length === 1 && unico && (unico.type === "video" || unico.type === "image") && aceptaMedio(acepta, unico.type)) {
					elegir(unico.id);
				}
			});
		},
	});

	if (!requisitos) return null;

	return (
		<div className="relative flex min-h-0 flex-col gap-3 p-4" {...dragProps}>
			<input {...fileInputProps} />
			{lista.length === 0 ? (
				<ZonaImportar
					texto={TEXTO_ZONA[acepta]}
					onClick={openFilePicker}
					procesando={procesando}
					progreso={progreso}
					resaltada={isDragOver}
				/>
			) : (
				<>
					<div className="flex items-center">
						<Button variant="secondary" size="sm" onClick={openFilePicker} disabled={procesando}>
							<HugeiconsIcon icon={AddCircleIcon} className="size-4" />
							{procesando ? `Importando… ${progreso} %` : "Importar"}
						</Button>
					</div>
					<div className="scrollbar-thin max-h-[360px] min-h-0 overflow-y-auto pr-1">
						<GrillaBiblioteca>
							{lista.map((item) => (
								<Tarjeta
									key={item.id}
									item={item}
									corto={!alcanza({ type: item.type, duracion: item.duration }, requisitos.necesita, TICKS_PER_SECOND)}
									pierdeAudio={requisitos.esVideo && item.type === "image"}
									onElegir={() => elegir(item.id)}
								/>
							))}
						</GrillaBiblioteca>
					</div>
					{isDragOver && (
						<div className="pointer-events-none absolute inset-2 z-20">
							<ZonaImportar texto={TEXTO_ZONA[acepta]} onClick={openFilePicker} resaltada className="h-full bg-[var(--cc-panel)]/95" />
						</div>
					)}
				</>
			)}
		</div>
	);
}

function Tarjeta({
	item,
	corto,
	pierdeAudio,
	onElegir,
}: {
	item: MediaAsset;
	corto: boolean;
	pierdeAudio: boolean;
	onElegir: () => void;
}) {
	const imagen = item.type === "image" ? (item.thumbnailUrl ?? item.url) : item.thumbnailUrl;
	return (
		<button
			type="button"
			disabled={corto}
			onClick={onElegir}
			title={pierdeAudio ? AVISO_AUDIO : item.name}
			className="group flex min-w-0 cursor-pointer flex-col gap-1 text-left disabled:cursor-not-allowed"
		>
			<span
				className={cn(
					"relative block aspect-square w-full overflow-hidden rounded-[4px] bg-[var(--cc-sunken)] ring-1 ring-transparent transition-shadow",
					!corto && "group-hover:ring-[var(--cc-text-3)]/60 group-focus-visible:ring-primary",
				)}
			>
				{imagen ? (
					<Image src={imagen} alt="" fill sizes="128px" className="object-cover" draggable={false} unoptimized />
				) : (
					<span className="flex size-full items-center justify-center text-[var(--cc-text-2)]">
						<HugeiconsIcon icon={item.type === "video" ? Video01Icon : Image02Icon} className="size-6" />
					</span>
				)}
				{item.type === "video" && item.duration ? (
					<span className="pointer-events-none absolute top-1 right-1 rounded-[3px] bg-black/60 px-1 text-[10px] leading-4 text-white tabular-nums">
						{formatearDuracion(item.duration)}
					</span>
				) : null}
				{corto && (
					<span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] text-white">
						Muy corto
					</span>
				)}
			</span>
			<span className={cn("w-full truncate text-[11px] leading-4 text-[var(--cc-text-2)]", corto && "opacity-60")}>
				{item.name}
			</span>
		</button>
	);
}
