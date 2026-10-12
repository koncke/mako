"use client";

// =============================================================================
// Lo que registra «Eliminar fondo» (paquete M) en las ranuras del editor
// =============================================================================
//   · Panel derecho: la sub-pestaña «Eliminar fondo» de «Video» (orden 20, entre
//     Básico 10 y Máscara 30), para video e imagen como CapCut.
//   · Barra de la línea de tiempo: «Eliminar fondo» (centena 300, la de la IA,
//     después de «Generar subtítulos»), que abre esa sub-pestaña con el clip
//     elegido.
//   · El gancho de fuente del recorte automático (./recorte-persona.ts).
//
// Lo importa ce/extensiones.ts.

import { HugeiconsIcon } from "@hugeicons/react";
import { UserAiIcon } from "@hugeicons/core-free-icons";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline";
import { herramientasLinea, subpestanasInspector } from "@/app/video-editor/ce/ranuras";
import { usePropertiesStore } from "@/app/video-editor/_opencut/components/editor/panels/properties/stores/properties-store";
import { clipVisualElegido } from "@/app/video-editor/_opencut/commands/timeline/element/clip-elegido";
import { EliminarFondo } from "./panel-eliminar-fondo";
import "./recorte-persona";

/** El id de la sub-pestaña: lo abren la barra y el ✦ del clip (timeline-element.tsx). */
export const SUBPESTANA_ELIMINAR_FONDO = "video-eliminar-fondo";

subpestanasInspector.registrar({
	pestana: "video",
	id: SUBPESTANA_ELIMINAR_FONDO,
	etiqueta: "Eliminar fondo",
	orden: 20,
	aplica: ({ element }) => element.type === "video" || element.type === "image",
	Contenido: EliminarFondo,
});

/** Abre Video › Eliminar fondo para el clip elegido (que ya es el del panel). */
export function abrirEliminarFondo(editor: EditorCore, seleccion?: ElementRef[]): void {
	const clip = clipVisualElegido(editor, seleccion);
	if (!clip) return;
	const store = usePropertiesStore.getState();
	store.setActiveTab({ elementType: clip.element.type, tabId: SUBPESTANA_ELIMINAR_FONDO });
	store.recordarSubpestana({
		elementType: clip.element.type,
		pestana: "video",
		subpestana: SUBPESTANA_ELIMINAR_FONDO,
	});
}

function IconoEliminarFondo({ className }: { className?: string }) {
	return <HugeiconsIcon icon={UserAiIcon} className={className} />;
}

herramientasLinea.registrar({
	id: "linea-eliminar-fondo",
	etiqueta: "Eliminar fondo",
	orden: 320,
	lado: "izquierda",
	Icono: IconoEliminarFondo,
	habilitada: ({ editor, seleccion }) => clipVisualElegido(editor, seleccion) !== null,
	ejecutar: ({ editor, seleccion }) => abrirEliminarFondo(editor, seleccion),
});
