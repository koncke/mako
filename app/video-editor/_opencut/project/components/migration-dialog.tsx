"use client";

// Mientras el motor actualiza el formato de un proyecto guardado con una versión
// anterior. Es del motor de OpenCut (CapCut no lo tiene), así que va mudo: el
// texto de `pc_version_update_in_progress_toast` y el nombre, sin números de versión.

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { Loader2 } from "lucide-react";

export function MigrationDialog() {
	const editor = useEditor();
	const migrationState = editor.project.getMigrationState();

	if (!migrationState.isMigrating) return null;

	return (
		<Dialog open={true}>
			<DialogContent
				className="w-[320px] gap-0 rounded-[8px] border-none bg-(--cc-panel) p-5 [&>button:last-child]:hidden"
				onPointerDownOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => event.preventDefault()}
			>
				<div className="flex items-center gap-3">
					<Loader2 className="size-5 shrink-0 animate-spin text-primary" />
					<div className="min-w-0">
						<DialogTitle className="text-[14px] font-medium">Actualizando…</DialogTitle>
						<DialogDescription className="mt-1 truncate text-[12px] text-(--cc-text-3)">
							{migrationState.projectName ?? "Proyectos"}
						</DialogDescription>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
