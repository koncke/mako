"use client";

// El menú del botón derecho sobre el reproductor. «Exportar fotograma fijo» es
// el «Export still frame» de CapCut, que su es-LA.po traduce «Exportar el marco
// fijo»: «marco» por «fotograma» es un error evidente de traducción y se corrige
// (docs/diseno-editor-video.md §3.1).

import {
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import { usePreviewViewport } from "@/app/video-editor/_opencut/preview/components/preview-viewport";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { PreviewOverlayControl } from "@/app/video-editor/_opencut/preview/overlays";
import type { PantallaCompleta } from "@/app/video-editor/_opencut/preview/hooks/use-pantalla-completa";
import { ATAJOS_REPRODUCTOR } from "@/app/video-editor/_opencut/preview/atajos-reproductor";
import { toast } from "sonner";

export function PreviewContextMenu({
	pantalla,
	overlayControls,
	onOverlayVisibilityChange,
}: {
	pantalla: PantallaCompleta;
	overlayControls: PreviewOverlayControl[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const editor = useEditor();
	const viewport = usePreviewViewport();

	// El motor devuelve el motivo en inglés («Project is empty»…): no se muestra.
	const handleCopySnapshot = async () => {
		const result = await editor.renderer.copySnapshot();
		if (!result.success) toast.error("No se pudo copiar el fotograma");
	};

	const handleSaveSnapshot = async () => {
		const result = await editor.renderer.saveSnapshot();
		if (!result.success) toast.error("No se pudo exportar el fotograma");
	};

	return (
		<ContextMenuContent className="w-72">
			<ContextMenuItem onClick={viewport.fitToScreen}>
				Hacer zoom para ajustar el reproductor
				<ContextMenuShortcut>{ATAJOS_REPRODUCTOR.ajustar}</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onClick={pantalla.alternar}>
				{pantalla.activa ? "Salir de pantalla completa" : "Pantalla completa"}
				<ContextMenuShortcut>
					{pantalla.activa ? "Esc" : ATAJOS_REPRODUCTOR.pantallaCompleta}
				</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onClick={handleSaveSnapshot}>Exportar fotograma fijo</ContextMenuItem>
			<ContextMenuItem onClick={handleCopySnapshot}>Copiar fotograma</ContextMenuItem>
			{overlayControls.length > 0 ? <ContextMenuSeparator /> : null}
			{overlayControls.map((overlayControl) => (
				<ContextMenuCheckboxItem
					key={overlayControl.id}
					checked={overlayControl.isVisible}
					onCheckedChange={(checked) =>
						onOverlayVisibilityChange({
							overlayId: overlayControl.id,
							isVisible: !!checked,
						})
					}
				>
					{overlayControl.label}
				</ContextMenuCheckboxItem>
			))}
		</ContextMenuContent>
	);
}
