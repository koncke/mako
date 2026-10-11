"use client";

// =============================================================================
// La cabecera del reproductor: «Reproductor» a la izquierda y el menú ≡
// =============================================================================
// En CapCut 9.3 la franja de arriba de los tres paneles mide lo mismo (62 px en
// la captura al 125 % ≈ 50 px) y es un escalón más clara que el cuerpo
// (`--cc-panel-head`). El menú ≡ junta lo que no tiene botón propio abajo:
//
//   · «Guías y reglas» ▸ las líneas de referencia del usuario (como las de un
//     programa de diseño) y las reglas alrededor del lienzo;
//   · «Calidad de la vista previa» ▸ «Dar prioridad a la calidad / al
//     rendimiento». CapCut lo traduce «Vista previa de la calidad»
//     (pc_preview_quality), un error evidente de traducción: se corrige
//     (docs/diseno-editor-video.md §3.1). Con «rendimiento», MIENTRAS SE
//     REPRODUCE el cuadro se dibuja a la mitad de la resolución elegida abajo; en
//     pausa vuelve a la elegida.

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { portalCe } from "@/app/video-editor/portal";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import {
	guiasDe,
	usePreviewStore,
	type PrioridadReproduccion,
} from "@/app/video-editor/_opencut/preview/preview-store";
import { ATAJOS_REPRODUCTOR } from "@/app/video-editor/_opencut/preview/atajos-reproductor";

export function CabeceraReproductor() {
	return (
		<div className="flex h-[50px] shrink-0 items-center justify-between rounded-t-sm bg-[var(--cc-panel-head)] px-3">
			<span className="text-[14px] font-medium text-[var(--cc-text)]">Reproductor</span>
			<MenuReproductor />
		</div>
	);
}

/** Agrega una guía al centro del lienzo; avisa si se llegó al tope. */
export function agregarGuiaAlCentro({
	proyecto,
	eje,
}: {
	proyecto: string;
	eje: "horizontal" | "vertical";
}) {
	const id = usePreviewStore.getState().agregarGuia({ proyecto, eje, fraccion: 0.5 });
	if (id === null) toast("Número máximo de guías alcanzado");
}

function MenuReproductor() {
	const proyecto = useEditor((e) => e.project.getActive().metadata.id);
	const mostrarGuias = usePreviewStore((s) => s.mostrarGuias);
	const mostrarReglas = usePreviewStore((s) => s.mostrarReglas);
	const bloqueadas = usePreviewStore((s) => s.guiasBloqueadas);
	const hayGuias = usePreviewStore((s) => guiasDe(s, proyecto).length > 0);
	const prioridad = usePreviewStore((s) => s.prioridad);
	const acciones = usePreviewStore.getState();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Menú"
				className="flex size-7 cursor-pointer items-center justify-center rounded text-[var(--cc-text-2)] outline-none hover:bg-[var(--cc-raised)] hover:text-[var(--cc-text)] focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-[var(--cc-raised)]"
			>
				<HugeiconsIcon icon={Menu01Icon} className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>Guías y reglas</DropdownMenuSubTrigger>
					{/* El sub-menú va en el portal: adentro del menú padre lo recortaría
					    su `overflow-hidden` (el contenido de radix va con transform). */}
					<DropdownMenuPortal container={portalCe()}>
						<DropdownMenuSubContent className="w-64">
							<DropdownMenuItem onSelect={acciones.alternarReglas}>
								{mostrarReglas ? "Ocultar reglas" : "Mostrar reglas"}
								<DropdownMenuShortcut>{ATAJOS_REPRODUCTOR.reglas}</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={acciones.alternarGuias}>
								{mostrarGuias ? "Ocultar guías" : "Mostrar guías"}
								<DropdownMenuShortcut>{ATAJOS_REPRODUCTOR.guias}</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => agregarGuiaAlCentro({ proyecto, eje: "horizontal" })}
							>
								Agregar guía horizontal
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => agregarGuiaAlCentro({ proyecto, eje: "vertical" })}
							>
								Agregar guía vertical
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!hayGuias}
								onSelect={() => {
									acciones.alternarBloqueoGuias();
									if (!bloqueadas) toast("Guías bloqueadas");
								}}
							>
								{bloqueadas ? "Desbloquear guías" : "Bloquear guías"}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!hayGuias}
								onSelect={() => acciones.eliminarGuias({ proyecto })}
							>
								Eliminar guías
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>Calidad de la vista previa</DropdownMenuSubTrigger>
					<DropdownMenuPortal container={portalCe()}>
						<DropdownMenuSubContent className="w-60">
							<DropdownMenuRadioGroup
								value={prioridad}
								onValueChange={(v) =>
									acciones.setPrioridad(v as PrioridadReproduccion)
								}
							>
								<DropdownMenuRadioItem value="calidad">
									Dar prioridad a la calidad
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="rendimiento">
									Dar prioridad al rendimiento
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
