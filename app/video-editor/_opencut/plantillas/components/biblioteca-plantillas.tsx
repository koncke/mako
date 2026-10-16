"use client";

// =============================================================================
// Biblioteca › Plantillas › Anuncios (panel izquierdo)
// =============================================================================
// La pestaña «Plantillas» de CapCut Desktop (`template_pc`), con las plantillas
// PROPIAS de anuncio vertical (lib/editor-video/plantillas.ts): tarjetas 9:16 con
// la duración arriba a la derecha y el nombre abajo, que corren en bucle con el
// mouse encima (./miniatura-plantilla.tsx). «Utilizar plantilla» (`use_template_pc`)
// aparece al pasar el mouse (o con el foco del teclado); el clic en la tarjeta no
// la usa: armar una plantilla es un paso grande para darlo sin querer.
//
// Dónde se arma, como CapCut (que abre un borrador nuevo):
//   · línea de tiempo vacía → acá mismo, en UN paso de deshacer (../instanciar.ts);
//   · con algo adentro → un proyecto NUEVO (`/video-editor/nuevo?plantilla=<id>`,
//     app/video-editor/plantilla/ArmarPlantilla.tsx). Antes de salir se guarda lo
//     pendiente y se cierra el proyecto, como «Volver a la página de inicio»
//     (components/editor/editor-header.tsx): si no, el guardado «al salir» del
//     editor (editor-page.tsx) correría sobre el proyecto nuevo.
//
// Ninguna fuente entera al abrir la pestaña: cada miniatura pide sus letras al
// entrar en pantalla (hallazgos → «lo que se cuelga no es el karaoke»).
//
// Primero las SUGERIDAS para este negocio, con «Sugerido» chico y gris debajo del
// nombre y el porqué en el `title` (Martín, 16/10/2026; docs/plantillas-sugeridas.md).
// Las señales llegan de la page por ../../../sugeridas.tsx.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";
import { useSenalesNegocio } from "@/app/video-editor/sugeridas";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	ContenidoBiblioteca,
	GrillaBiblioteca,
	formatearDuracion,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { plantillasEnOrden, type Plantilla } from "@/lib/editor-video/plantillas";
import { AVISO_FALLO_PLANTILLA, usarPlantilla } from "../instanciar";
import { lineaVacia } from "../uso";
import { MiniaturaPlantilla } from "./miniatura-plantilla";

/** La ruta del proyecto nuevo armado con una plantilla. */
export const rutaPlantillaNueva = (id: string) => `/video-editor/nuevo?plantilla=${encodeURIComponent(id)}`;

function TarjetaPlantilla({
	plantilla,
	porque,
	usando,
	ocupada,
	onUsar,
}: {
	plantilla: Plantilla;
	/** Por qué va sugerida para este negocio («Vendes con checkout»); null = su lugar de siempre. */
	porque: string | null;
	/** Esta tarjeta se está armando. */
	usando: boolean;
	/** Otra (o ésta) se está armando: no se pide otra. */
	ocupada: boolean;
	onUsar: () => void;
}) {
	const [encima, setEncima] = useState(false);
	return (
		<div
			className="group flex min-w-0 flex-col gap-1"
			onPointerEnter={() => setEncima(true)}
			onPointerLeave={() => setEncima(false)}
		>
			<div
				title={plantilla.descripcion}
				className={cn(
					"relative aspect-[9/16] w-full overflow-hidden rounded-[6px] bg-black ring-1 ring-transparent transition-shadow",
					"group-hover:ring-(--cc-text-3)/60 group-focus-within:ring-primary",
				)}
			>
				<MiniaturaPlantilla plantilla={plantilla} animar={encima} />
				<span className="pointer-events-none absolute top-1 right-1 rounded-[3px] bg-black/60 px-1 text-[10px] leading-4 text-white tabular-nums">
					{formatearDuracion(plantilla.duracion)}
				</span>
				<div
					className={cn(
						"absolute inset-x-1.5 bottom-1.5 opacity-0 transition-opacity",
						"group-hover:opacity-100 group-focus-within:opacity-100",
					)}
				>
					<button
						type="button"
						onClick={onUsar}
						disabled={ocupada}
						className="min-h-7 w-full cursor-pointer rounded-[4px] bg-primary px-1 py-1 text-[11px] leading-tight font-medium text-balance text-white hover:brightness-110 disabled:cursor-default disabled:opacity-60"
					>
						Utilizar plantilla
					</button>
				</div>
				{usando && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-[11px] text-white">
						<Loader2 className="size-4 animate-spin" />
						Cargando…
					</div>
				)}
			</div>
			<span className="w-full truncate text-[11px] leading-4 text-(--cc-text-2)" title={plantilla.nombre}>
				{plantilla.nombre}
			</span>
			{/* Abajo del nombre y no a su derecha: con 92 px de tarjeta, al lado lo cortaba a cinco letras. */}
			{porque && (
				<span className="-mt-1 w-full truncate text-[10px] leading-4 font-medium text-(--cc-text-3)" title={porque}>
					Sugerido
				</span>
			)}
		</div>
	);
}

export function BibliotecaPlantillas() {
	const editor = useEditor();
	const router = useRouter();
	const [usando, setUsando] = useState<string | null>(null);
	const senales = useSenalesNegocio();
	const plantillas = useMemo(() => plantillasEnOrden(senales), [senales]);

	const usar = async (plantilla: Plantilla) => {
		if (usando) return;
		setUsando(plantilla.id);
		try {
			const escena = editor.scenes.getActiveSceneOrNull();
			if (escena && lineaVacia(escena.tracks)) {
				const r = await usarPlantilla(editor, plantilla);
				if (!r.ok && r.motivo !== "ocupado") toast.error(AVISO_FALLO_PLANTILLA);
				return;
			}
			await editor.project.prepareExit().catch(() => {});
			await editor.save.flush().catch(() => {});
			editor.project.closeProject();
			router.push(rutaEditor(rutaPlantillaNueva(plantilla.id)));
		} finally {
			setUsando(null);
		}
	};

	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca minimo={92}>
				{plantillas.map(({ plantilla: p, porque }) => (
					<TarjetaPlantilla
						key={p.id}
						plantilla={p}
						porque={porque}
						usando={usando === p.id}
						ocupada={usando !== null}
						onUsar={() => void usar(p)}
					/>
				))}
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}
