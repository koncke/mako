"use client";

// =============================================================================
// Las guías del usuario sobre el reproductor («Guías y reglas» de CapCut)
// =============================================================================
// Una línea fina por guía, de punta a punta del reproductor, que se agarra para
// moverla (con «Bloquear guías» no se agarra: los clics pasan al video) y con el
// botón derecho ofrece «Editar guía» y «Borrar guía». Vive ADENTRO del viewport,
// en sus coordenadas (canvasToOverlay), encima de la capa de interacción para
// que se pueda agarrar aunque haya un clip debajo.

import { useState } from "react";
import { usePreviewViewport } from "@/app/video-editor/_opencut/preview/components/preview-viewport";
import {
	guiasDe,
	usePreviewStore,
	type GuiaUsuario,
} from "@/app/video-editor/_opencut/preview/preview-store";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import type { TCanvasSize } from "@/app/video-editor/_opencut/project/types";
import { largoDelEje } from "./guias-usuario";
import type { ArrastreGuia } from "./use-arrastre-guia";
import { EditarGuiaDialogo } from "./editar-guia-dialogo";

/** Ancho de la franja que se agarra (la línea dibujada es de 1 px). */
const AGARRE = 7;

export function LineasGuia({
	proyecto,
	lienzo,
	arrastre,
	onAgarrar,
}: {
	proyecto: string;
	lienzo: TCanvasSize;
	arrastre: ArrastreGuia | null;
	onAgarrar: (guia: GuiaUsuario, event: React.PointerEvent) => void;
}) {
	const viewport = usePreviewViewport();
	const mostrar = usePreviewStore((s) => s.mostrarGuias);
	const bloqueadas = usePreviewStore((s) => s.guiasBloqueadas);
	const guias = usePreviewStore((s) => guiasDe(s, proyecto));
	const [editando, setEditando] = useState<GuiaUsuario | null>(null);

	// Una guía nueva que se está sacando de la regla todavía no está en el store.
	const nueva: GuiaUsuario | null =
		arrastre && arrastre.id === null
			? { id: "nueva", eje: arrastre.eje, fraccion: arrastre.fraccion }
			: null;
	if (!mostrar && !nueva) return null;

	const posicion = (guia: GuiaUsuario) => {
		const largo = largoDelEje(guia.eje, lienzo);
		const p = viewport.canvasToOverlay({
			canvasX: guia.eje === "vertical" ? guia.fraccion * largo : 0,
			canvasY: guia.eje === "horizontal" ? guia.fraccion * largo : 0,
		});
		return guia.eje === "horizontal" ? p.y : p.x;
	};

	const enArrastre = (guia: GuiaUsuario) => arrastre?.id === guia.id;

	const linea = (guia: GuiaUsuario, interactiva: boolean) => {
		const pos = posicion(guia);
		const horizontal = guia.eje === "horizontal";
		const arrastrada = enArrastre(guia) || guia.id === "nueva";
		const fuera = arrastrada && arrastre?.fuera;
		const trazo = (
			<div
				className="absolute bg-[var(--cc-accent)]"
				style={
					horizontal
						? { left: 0, right: 0, top: AGARRE / 2, height: 1 }
						: { top: 0, bottom: 0, left: AGARRE / 2, width: 1 }
				}
			/>
		);
		const franja = (
			<div
				className="absolute"
				style={{
					...(horizontal
						? { left: 0, right: 0, top: pos - AGARRE / 2, height: AGARRE + 1 }
						: { top: 0, bottom: 0, left: pos - AGARRE / 2, width: AGARRE + 1 }),
					pointerEvents: interactiva ? "auto" : "none",
					cursor: interactiva ? (horizontal ? "ns-resize" : "ew-resize") : undefined,
					opacity: fuera ? 0.35 : 1,
				}}
				onPointerDown={
					interactiva
						? (event) => {
								// Los menús y diálogos van en un portal, pero en React sus
								// eventos burbujean por ESTE árbol: un clic en «Editar guía»
								// llegaría acá y arrastraría la guía hasta el menú.
								if (!event.currentTarget.contains(event.target as Node)) return;
								onAgarrar(guia, event);
							}
						: undefined
				}
			>
				{trazo}
				{arrastrada ? (
					<span
						className="absolute rounded-sm bg-[var(--cc-accent)] px-1 text-[10px] leading-4 text-black tabular-nums"
						style={horizontal ? { left: 4, top: -14 } : { top: 4, left: 6 }}
					>
						{Math.round(guia.fraccion * largoDelEje(guia.eje, lienzo))}
					</span>
				) : null}
			</div>
		);
		if (!interactiva) return <div key={guia.id}>{franja}</div>;
		return (
			<ContextMenu key={guia.id}>
				<ContextMenuTrigger asChild>{franja}</ContextMenuTrigger>
				<ContextMenuContent className="w-40">
					<ContextMenuItem onSelect={() => setEditando(guia)}>Editar guía</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => usePreviewStore.getState().borrarGuia({ proyecto, id: guia.id })}
					>
						Borrar guía
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		);
	};

	return (
		<>
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				{mostrar ? guias.map((g) => linea(g, !bloqueadas)) : null}
				{nueva ? linea(nueva, false) : null}
			</div>
			{/* Mismo motivo: sin este corte, el botón derecho adentro del diálogo
			    abriría el menú del reproductor, que envuelve a esta capa. */}
			<div
				className="contents"
				onContextMenu={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<EditarGuiaDialogo
					guia={editando}
					lienzo={lienzo}
					onCerrar={() => setEditando(null)}
					onGuardar={(fraccion) => {
						if (editando) {
							usePreviewStore.getState().moverGuia({ proyecto, id: editando.id, fraccion });
						}
						setEditando(null);
					}}
				/>
			</div>
		</>
	);
}
