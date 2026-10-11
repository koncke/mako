"use client";

// =============================================================================
// «Exportar»: el botón cian de la barra superior y su atajo (Ctrl+E)
// =============================================================================
// El botón de CapCut mide 100×34 en la captura (≈80×27 al 100 %), radio ~4 px,
// ícono de subir + texto blanco sobre `--cc-accent`. Abre el diálogo de
// ../../export/dialogo-exportar.tsx.
//
// Ctrl+E es el atajo de Exportar en la tabla por defecto de CapCut (relevamiento
// §10, «Básico»). Se escucha acá y no en el registro de acciones de OpenCut
// porque el diálogo vive acá; respeta lo mismo que ese registro: no dispara con
// otro diálogo abierto (`overlayDepth`) ni escribiendo en un campo.

import { useEffect, useState } from "react";
import { Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useKeybindingsStore } from "@/app/video-editor/_opencut/actions/keybindings-store";
import { isTypableDOMElement } from "@/app/video-editor/_opencut/utils/browser";
import { DialogoExportar } from "@/app/video-editor/_opencut/export/dialogo-exportar";

export function ExportButton() {
	const [abierto, setAbierto] = useState(false);
	const hayProyecto = useEditor((e) => !!e.project.getActiveOrNull());

	useEffect(() => {
		const alTeclear = (ev: KeyboardEvent) => {
			if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.altKey || ev.code !== "KeyE") return;
			if (useKeybindingsStore.getState().overlayDepth > 0) return;
			const activo = document.activeElement;
			if (activo instanceof HTMLElement && isTypableDOMElement({ element: activo })) return;
			// Ctrl+E en Chrome manda el foco a la barra de búsqueda: se frena.
			ev.preventDefault();
			setAbierto(true);
		};
		document.addEventListener("keydown", alTeclear, { capture: true });
		return () => document.removeEventListener("keydown", alTeclear, { capture: true });
	}, []);

	return (
		<>
			<button
				type="button"
				disabled={!hayProyecto}
				onClick={() => setAbierto(true)}
				className={cn(
					"flex h-[27px] min-w-[80px] items-center justify-center gap-1.5 rounded-[4px] bg-primary px-3 text-[13px] font-medium text-white",
					hayProyecto ? "cursor-pointer hover:brightness-110" : "cursor-not-allowed opacity-50",
				)}
			>
				<HugeiconsIcon icon={Upload04Icon} className="size-3.5" />
				Exportar
			</button>
			{hayProyecto ? <DialogoExportar abierto={abierto} onAbiertoChange={setAbierto} /> : null}
		</>
	);
}
