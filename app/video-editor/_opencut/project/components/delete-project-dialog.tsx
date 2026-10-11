"use client";

// =============================================================================
// Confirmación de «Eliminar» (uno o varios proyectos)
// =============================================================================
// Los textos son los del inicio de CapCut (`confirm_delete_n`,
// `pc_launcher_delete_draft_desc`). Se borra el proyecto Y sus archivos
// multimedia del almacenamiento local: no hay papelera, así que el botón rojo
// lleva el tacho de la casa (tests/borrar-tacho-casa.test.ts). Sin el «escribe
// DELETE» de OpenCut: CapCut confirma con un clic y nada más.

import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";

export function DeleteProjectDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	projectNames,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	projectNames: string[];
}) {
	const uno = projectNames.length === 1 ? projectNames[0] : null;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent
				className="w-[360px] gap-0 rounded-[8px] border-none bg-(--cc-panel) p-5 [&>button:last-child]:hidden"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<DialogTitle className="pr-2 text-[14px] leading-snug font-medium">
					{uno ? (
						<>
							{"¿Eliminar «"}
							<span className="inline-block max-w-[220px] truncate align-bottom">{uno}</span>
							{"»?"}
						</>
					) : (
						"¿Eliminar los proyectos seleccionados?"
					)}
				</DialogTitle>
				<DialogDescription className="mt-2 text-[12px] text-(--cc-text-3)">
					{uno
						? "Se eliminará de forma permanente."
						: "Los proyectos seleccionados se eliminarán de forma permanente."}
				</DialogDescription>
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="h-8 min-w-[76px] cursor-pointer rounded-[4px] bg-(--cc-btn-2) px-3 text-[13px] text-(--cc-text) hover:brightness-110"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="flex h-8 min-w-[76px] cursor-pointer items-center justify-center gap-1.5 rounded-[4px] bg-(--cc-raised) px-3 text-[13px] font-medium text-destructive hover:brightness-110"
					>
						<IconoBorrar size={15} />
						Eliminar
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
