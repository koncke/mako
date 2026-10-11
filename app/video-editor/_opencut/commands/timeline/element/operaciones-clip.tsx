"use client";

// =============================================================================
// Las operaciones de clip de la barra de la línea de tiempo (paquete I)
// =============================================================================
// Registra en la ranura `herramientasLinea` (ce/ranuras.ts), en la centena de
// Dividir/Borrar/Marcador, como CapCut 9.3 con un video elegido:
//
//   «Recortar» suelto (260): abre el diálogo de recorte/dialogo-recorte.tsx.
//   El grupo ◢ (270–273): «Reflejar», «Girar», «Congelar», «Revertir».
//
// Reflejar, Girar y Recortar valen para video e imagen; Congelar y Revertir,
// sólo para video (una imagen ya está quieta y no tiene sentido al revés).
// Congelar además pide el cabezal sobre el clip, como CapCut. Ninguna se pinta
// «activa» (cian) aunque el clip esté reflejado, recortado o revertido: CapCut
// no lo hace, y en el grupo ◢ la activa pasaría a ser la que se muestra.
//
// También importa lo demás del paquete que tiene que estar registrado antes
// del primer dibujo: los ganchos del render (recorte y reflejo) y la pestaña
// «Velocidad» del panel derecho. Este archivo lo importa ce/extensiones.ts.

import { useState } from "react";
import { Crop, FlipHorizontal2, Rewind, RotateCw, Snowflake } from "lucide-react";
import {
	herramientasLinea,
	type ContextoHerramienta,
	type HerramientaLinea,
} from "@/app/video-editor/ce/ranuras";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { BotonBarra } from "@/app/video-editor/_opencut/timeline/components/timeline-toolbar";
import { DialogoRecorte } from "@/app/video-editor/_opencut/recorte/dialogo-recorte";
import {
	clipVisualElegido,
	clipsVisualesElegidos,
	videoElegido,
	type ClipConPista,
	type ClipVisual,
} from "./clip-elegido";
import { reflejarSeleccion, girarSeleccion } from "./reflejar-girar";
import { congelarCuadro, puedeCongelar } from "./congelar";
import { revertirClip } from "./revertir";
// Registros que van con este paquete (se importan por su efecto).
import "@/app/video-editor/_opencut/recorte/ganchos";
import "@/app/video-editor/_opencut/speed/registro";

const GRUPO = "operaciones-clip";

/** «Recortar»: el botón y su diálogo (un `Control`, porque el diálogo vive acá). */
function ControlRecortar({ editor, herramienta }: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const habilitada = useEditor((e) => clipVisualElegido(e) !== null);
	const [abierto, setAbierto] = useState<ClipConPista<ClipVisual> | null>(null);
	return (
		<>
			<BotonBarra
				etiqueta={herramienta.etiqueta}
				habilitada={habilitada}
				onClick={() => {
					const clip = clipVisualElegido(editor);
					if (clip) setAbierto(clip);
				}}
			>
				<Crop className="size-4" />
			</BotonBarra>
			{abierto && (
				<DialogoRecorte
					editor={editor}
					trackId={abierto.track.id}
					element={abierto.element}
					onCerrar={() => setAbierto(null)}
				/>
			)}
		</>
	);
}

const hayVisual = ({ editor, seleccion }: ContextoHerramienta) =>
	clipsVisualesElegidos(editor, seleccion).length > 0;

const HERRAMIENTAS: HerramientaLinea[] = [
	{
		id: "clip-recortar",
		etiqueta: "Recortar",
		orden: 260,
		lado: "izquierda",
		Icono: Crop,
		habilitada: ({ editor, seleccion }) => clipVisualElegido(editor, seleccion) !== null,
		ejecutar: () => {},
		Control: ControlRecortar,
	},
	{
		id: "clip-reflejar",
		etiqueta: "Reflejar",
		orden: 270,
		lado: "izquierda",
		grupo: GRUPO,
		Icono: FlipHorizontal2,
		habilitada: hayVisual,
		ejecutar: ({ editor }) => reflejarSeleccion(editor),
	},
	{
		id: "clip-girar",
		etiqueta: "Girar",
		orden: 271,
		lado: "izquierda",
		grupo: GRUPO,
		Icono: RotateCw,
		habilitada: hayVisual,
		ejecutar: ({ editor }) => girarSeleccion(editor),
	},
	{
		id: "clip-congelar",
		etiqueta: "Congelar",
		orden: 272,
		lado: "izquierda",
		grupo: GRUPO,
		Icono: Snowflake,
		habilitada: ({ editor, seleccion }) => puedeCongelar(editor, seleccion),
		ejecutar: ({ editor }) => void congelarCuadro(editor),
	},
	{
		id: "clip-revertir",
		etiqueta: "Revertir",
		orden: 273,
		lado: "izquierda",
		grupo: GRUPO,
		Icono: Rewind,
		habilitada: ({ editor, seleccion }) => videoElegido(editor, seleccion) !== null,
		ejecutar: ({ editor }) => void revertirClip(editor),
	},
];

for (const herramienta of HERRAMIENTAS) {
	herramientasLinea.registrar(herramienta);
}
