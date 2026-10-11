"use client";

// «Renombrar» (`pc_rename`) desde el menú de una tarjeta del inicio. En el
// editor el nombre se edita en la barra superior, con un clic.

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";

export function RenameProjectDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	projectName,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (newName: string) => void;
	projectName: string;
}) {
	const [name, setName] = useState(projectName);
	const limpio = name.trim();

	const handleOpenChange = (open: boolean) => {
		if (open) setName(projectName);
		onOpenChange(open);
	};

	const confirmar = () => {
		if (limpio) onConfirm(limpio);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[360px] gap-0 rounded-[8px] border-none bg-(--cc-panel) p-5 [&>button:last-child]:hidden"
				aria-describedby={undefined}
				onOpenAutoFocus={(e) => {
					// El nombre entero seleccionado, como el renombrar de cualquier explorador.
					e.preventDefault();
					const input = (e.currentTarget as HTMLElement | null)?.querySelector("input");
					input?.focus();
					input?.select();
				}}
			>
				<DialogTitle className="text-[14px] font-medium">Renombrar</DialogTitle>
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							confirmar();
						}
					}}
					maxLength={100}
					className="mt-4 h-8 w-full rounded-[4px] bg-(--cc-input) px-2.5 text-[13px] text-(--cc-text) outline-none focus:ring-1 focus:ring-primary"
				/>
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
						onClick={confirmar}
						disabled={!limpio}
						className="h-8 min-w-[76px] cursor-pointer rounded-[4px] bg-primary px-3 text-[13px] font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Aceptar
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
