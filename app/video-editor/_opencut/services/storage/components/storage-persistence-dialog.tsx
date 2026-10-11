"use client";

import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { useStoragePersistence } from "@/app/video-editor/_opencut/services/storage/use-storage-persistence";

export function StoragePersistenceDialog() {
	const { showDialog, onConfirm, onDismiss } = useStoragePersistence();

	return (
		<Dialog open={showDialog} onOpenChange={(open) => !open && onDismiss()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>No pierdas tus proyectos</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{/* Los proyectos viven en el navegador (IndexedDB + OPFS): sin el
					    permiso de almacenamiento persistente, el navegador los puede
					    borrar solo cuando le falta espacio. */}
					<p className="text-sm text-muted-foreground">
						El navegador puede borrarlos cuando le falta espacio. ¿Permitir que se guarden siempre?
					</p>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={onDismiss}>
						Ahora no
					</Button>
					<Button onClick={onConfirm}>Permitir</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
