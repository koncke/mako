"use client";

// =============================================================================
// «Editar guía»: la posición exacta, en píxeles o en porcentaje del lienzo
// =============================================================================
// Los textos son los de CapCut (pc_reference_edit_*): «Editar guía»,
// «Posición», «Unidades», «Píxeles», «Porcentaje», «Cancelar», «OK».

import { useEffect, useState } from "react";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { Input } from "@/app/video-editor/_opencut/components/ui/input";
import { Label } from "@/app/video-editor/_opencut/components/ui/label";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/app/video-editor/_opencut/components/ui/select";
import type { GuiaUsuario } from "@/app/video-editor/_opencut/preview/preview-store";
import type { TCanvasSize } from "@/app/video-editor/_opencut/project/types";
import { aUnidad, desdeUnidad, type UnidadGuia } from "./guias-usuario";

export function EditarGuiaDialogo({
	guia,
	lienzo,
	onCerrar,
	onGuardar,
}: {
	guia: GuiaUsuario | null;
	lienzo: TCanvasSize;
	onCerrar: () => void;
	onGuardar: (fraccion: number) => void;
}) {
	const [unidad, setUnidad] = useState<UnidadGuia>("pixeles");
	const [texto, setTexto] = useState("");

	// Al abrir (o cambiar de unidad) se muestra la posición actual en esa unidad.
	useEffect(() => {
		if (!guia) return;
		setTexto(String(aUnidad({ fraccion: guia.fraccion, eje: guia.eje, lienzo, unidad })));
	}, [guia, lienzo, unidad]);

	const valor = Number(texto.replace(",", "."));
	const valido = texto.trim() !== "" && Number.isFinite(valor);

	const guardar = () => {
		if (!guia || !valido) return;
		onGuardar(desdeUnidad({ valor, eje: guia.eje, lienzo, unidad }));
	};

	return (
		<Dialog open={guia !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Editar guía</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<form
						className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							guardar();
						}}
					>
						<Label htmlFor="ce-guia-posicion">Posición</Label>
						<Input
							id="ce-guia-posicion"
							inputMode="decimal"
							size="sm"
							value={texto}
							aria-invalid={!valido}
							onChange={(event) => setTexto(event.target.value)}
						/>
						<Label>Unidades</Label>
						<Select value={unidad} onValueChange={(v) => setUnidad(v as UnidadGuia)}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="pixeles">Píxeles</SelectItem>
								<SelectItem value="porcentaje">Porcentaje</SelectItem>
							</SelectContent>
						</Select>
					</form>
				</DialogBody>
				<DialogFooter>
					<Button variant="secondary" size="sm" onClick={onCerrar}>
						Cancelar
					</Button>
					<Button
						size="sm"
						className="bg-primary text-primary-foreground hover:bg-primary/90"
						onClick={guardar}
						disabled={!valido}
					>
						OK
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
