"use client";

// =============================================================================
// La animación, marcada sobre el clip de la línea de tiempo
// =============================================================================
// Como CapCut: un clip con animación muestra el tramo que ocupa con un velo
// claro, al comienzo (Entrada, con »), al final (Salida, con «) o a lo largo
// (Combinado y Bucle, con ⟳). Sin esto, la única forma de saber que un clip
// está animado era elegirlo y abrir la pestaña.
//
// Lee los MISMOS tramos que el render (`tramosAnimacion`, ../calcular.ts): si
// Entrada + Salida no entran en el clip, la marca muestra lo que se va a ver.
// Recibe el elemento de la vista previa (el que se está recortando o
// estirando), así el velo acompaña al borde mientras se arrastra.
//
// La forma (velo + línea abajo + flecha) es de memoria, sin captura de CapCut
// al lado: queda para confirmar a ojo.
//
// Lo dibuja timeline/components/timeline-element.tsx (paquete de la línea de
// tiempo), encima del contenido del clip y sin tomar el mouse.

import { ChevronsLeft, ChevronsRight, Repeat2 } from "lucide-react";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { tramosAnimacion } from "../calcular";

/** Por debajo de este ancho la flecha no entra: queda sólo el velo. */
const ANCHO_CON_ICONO = 16;

function Velo({
	izquierda,
	ancho,
	lado,
	Icono,
}: {
	izquierda: number;
	ancho: number;
	lado: "izquierda" | "derecha";
	Icono: typeof ChevronsRight;
}) {
	if (ancho < 1) return null;
	return (
		<div
			className="absolute inset-y-0 border-b-2 border-white/60 bg-white/15"
			style={{ left: izquierda, width: ancho }}
		>
			{ancho >= ANCHO_CON_ICONO && (
				<Icono
					className={cn(
						"absolute bottom-0.5 size-2.5 text-white/85",
						lado === "izquierda" ? "left-0.5" : "right-0.5",
					)}
					strokeWidth={2.5}
				/>
			)}
		</div>
	);
}

export function FranjasAnimacion({
	element,
	pixelsPerSecond,
	alto,
}: {
	element: TimelineElement;
	pixelsPerSecond: number;
	/** Alto de la fila del clip (sin las filas de fotogramas desplegadas). */
	alto: number;
}) {
	const D = element.duration / TICKS_PER_SECOND;
	if (!(D > 0) || !element.params) return null;
	const { entrada, salida, combo, bucle } = tramosAnimacion(element.params, D);
	if (!entrada && !salida && !combo && !bucle) return null;

	const px = (segundos: number) => Math.max(0, segundos * pixelsPerSecond);
	const anchoClip = px(D);
	const finEntrada = entrada?.duracion ?? 0;
	const inicioSalida = D - (salida?.duracion ?? 0);

	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden rounded-[4px]"
			style={{ height: alto }}
		>
			{combo && (
				<Velo izquierda={0} ancho={Math.min(anchoClip, px(combo.duracion))} lado="izquierda" Icono={Repeat2} />
			)}
			{bucle && inicioSalida > finEntrada && (
				<Velo
					izquierda={px(finEntrada)}
					ancho={px(inicioSalida - finEntrada)}
					lado="izquierda"
					Icono={Repeat2}
				/>
			)}
			{entrada && <Velo izquierda={0} ancho={px(entrada.duracion)} lado="izquierda" Icono={ChevronsRight} />}
			{salida && (
				<Velo
					izquierda={anchoClip - px(salida.duracion)}
					ancho={px(salida.duracion)}
					lado="derecha"
					Icono={ChevronsLeft}
				/>
			)}
		</div>
	);
}
