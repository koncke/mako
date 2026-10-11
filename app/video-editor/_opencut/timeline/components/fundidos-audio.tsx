"use client";

// Los fundidos de un clip de audio, como en CapCut: un círculo blanco en cada
// esquina de arriba que se arrastra hacia adentro; la rampa queda sombreada.
// Escribe `audio.fundidoEntrada` / `audio.fundidoSalida` (SEGUNDOS) en los
// params del clip: el contrato con el paquete de audio (J), que los declara en
// params/extra y los aplica al mezclar. Si J todavía no está, el valor igual se
// guarda y se dibuja; sólo no suena.
//
// ⚠️ `timeline.previewElements` REEMPLAZA `params` entero (hace `{...element,
// ...cambio}`), no lo mezcla: el cambio lleva TODOS los params, o el arrastre
// borra el volumen y lo demás hasta que se suelta.

import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { AudioElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { cn } from "@/app/video-editor/_opencut/utils/ui";

export const PARAM_FUNDIDO_ENTRADA = "audio.fundidoEntrada";
export const PARAM_FUNDIDO_SALIDA = "audio.fundidoSalida";

function leer(element: AudioElement, clave: string): number {
	const v = element.params[clave];
	return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function FundidosAudio({
	element,
	trackId,
	pixelsPerSecond,
	visible,
}: {
	element: AudioElement;
	trackId: string;
	pixelsPerSecond: number;
	/** Los círculos se ven con el clip elegido o con el mouse encima. */
	visible: boolean;
}) {
	const editor = useEditor();
	const duracion = element.duration / TICKS_PER_SECOND;
	const entrada = Math.min(leer(element, PARAM_FUNDIDO_ENTRADA), duracion);
	const salida = Math.min(leer(element, PARAM_FUNDIDO_SALIDA), duracion);
	const [arrastrando, setArrastrando] = useState<"entrada" | "salida" | null>(null);
	const cambio = useRef(false);

	const empezar = useCallback(
		(lado: "entrada" | "salida", event: React.PointerEvent) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();
			const x0 = event.clientX;
			const inicial = lado === "entrada" ? entrada : salida;
			const otro = lado === "entrada" ? salida : entrada;
			const clave = lado === "entrada" ? PARAM_FUNDIDO_ENTRADA : PARAM_FUNDIDO_SALIDA;
			cambio.current = false;
			setArrastrando(lado);

			const mover = (e: PointerEvent) => {
				const dx = (e.clientX - x0) / pixelsPerSecond;
				const segundos = lado === "entrada" ? inicial + dx : inicial - dx;
				const valor =
					Math.round(Math.max(0, Math.min(duracion - otro, segundos)) * 100) / 100;
				cambio.current = valor !== inicial;
				editor.timeline.previewElements({
					updates: [
						{
							trackId,
							elementId: element.id,
							updates: { params: { ...element.params, [clave]: valor } },
						},
					],
				});
			};
			const soltar = () => {
				window.removeEventListener("pointermove", mover);
				window.removeEventListener("pointerup", soltar);
				window.removeEventListener("pointercancel", soltar);
				setArrastrando(null);
				if (cambio.current) editor.timeline.commitPreview();
				else editor.timeline.discardPreview();
			};
			window.addEventListener("pointermove", mover);
			window.addEventListener("pointerup", soltar);
			window.addEventListener("pointercancel", soltar);
		},
		[editor, element, trackId, pixelsPerSecond, duracion, entrada, salida],
	);

	const anchoEntrada = entrada * pixelsPerSecond;
	const anchoSalida = salida * pixelsPerSecond;
	const mostrar = visible || arrastrando !== null;

	return (
		<div className="pointer-events-none absolute inset-0">
			{/* La rampa: lo que queda por encima de la diagonal se oscurece. */}
			{anchoEntrada > 0 && (
				<div
					className="absolute top-0 left-0 h-full bg-black/35"
					style={{ width: anchoEntrada, clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
				/>
			)}
			{anchoSalida > 0 && (
				<div
					className="absolute top-0 right-0 h-full bg-black/35"
					style={{ width: anchoSalida, clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
				/>
			)}
			{mostrar && (
				<>
					<Circulo
						x={anchoEntrada}
						valor={entrada}
						lado="entrada"
						activo={arrastrando === "entrada"}
						etiqueta={`${entrada.toFixed(1)}s`}
						onPointerDown={(e) => empezar("entrada", e)}
					/>
					<Circulo
						x={anchoSalida}
						valor={salida}
						lado="salida"
						activo={arrastrando === "salida"}
						etiqueta={`${salida.toFixed(1)}s`}
						onPointerDown={(e) => empezar("salida", e)}
					/>
				</>
			)}
		</div>
	);
}

function Circulo({
	x,
	valor,
	lado,
	activo,
	etiqueta,
	onPointerDown,
}: {
	x: number;
	valor: number;
	lado: "entrada" | "salida";
	activo: boolean;
	etiqueta: string;
	onPointerDown: (e: React.PointerEvent) => void;
}) {
	// Un <span> y no un <button>: el clip entero ya es un botón, y un botón
	// adentro de otro es HTML inválido.
	return (
		<span
			role="slider"
			tabIndex={-1}
			aria-label={lado === "entrada" ? "Aparición progresiva" : "Desaparición progresiva"}
			aria-valuetext={etiqueta}
			aria-valuenow={valor}
			aria-valuemin={0}
			className={cn(
				"pointer-events-auto absolute top-[3px] z-10 size-2 cursor-ew-resize rounded-full bg-white shadow-sm",
				lado === "entrada" ? "-translate-x-1/2" : "translate-x-1/2",
			)}
			style={lado === "entrada" ? { left: Math.max(4, x) } : { right: Math.max(4, x) }}
			onPointerDown={onPointerDown}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
		>
			{activo && (
				<span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-[3px] bg-black/80 px-1 text-[10px] leading-4 text-white">
					{etiqueta}
				</span>
			)}
		</span>
	);
}
