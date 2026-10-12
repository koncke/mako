"use client";

// =============================================================================
// La tarjeta de un preset de animación, con su vista previa al pasar el mouse
// =============================================================================
// CapCut muestra una miniatura quieta y, con el mouse encima, la anima. Acá la
// miniatura es un dibujo neutro (un cuadro de imagen para los clips, «Texto»
// para los textos: los íconos de CapCut no se copian) y al pasar el mouse se le
// aplica la MISMA función de pose que usa el render (catalogo.ts), así lo que se
// ve en la tarjeta es lo que va a hacer el clip.
//
// El cuadro se mueve con estilos en línea dentro de un requestAnimationFrame,
// sin estado de React: re-dibujar el panel a 60 cuadros por segundo para mover
// un ícono no tiene sentido.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, Image as IconoImagen } from "lucide-react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import {
	POSE_IDENTIDAD,
	componerPoses,
	type CategoriaAnimacion,
	type PresetAnimacion,
} from "../catalogo";
import { lineasReveladas } from "@/app/video-editor/_opencut/text/revelado";

const TEXTO_MUESTRA = "Texto";
const PAUSA = 0.5;

function poseDeMuestra(
	preset: PresetAnimacion,
	categoria: CategoriaAnimacion,
	t: number,
	esTexto: boolean,
) {
	const o = { texto: esTexto };
	const dur = Math.max(0.2, preset.duracion);
	if (categoria === "entrada") {
		// Entra, se queda quieto un momento y vuelve a empezar.
		return { pose: componerPoses(POSE_IDENTIDAD, preset.pose(Math.min(1, t / dur), o)), p: Math.min(1, t / dur), ciclo: dur + PAUSA };
	}
	if (categoria === "salida") {
		const p = Math.min(1, Math.max(0, (t - PAUSA / 2) / dur));
		return { pose: componerPoses(POSE_IDENTIDAD, preset.pose(p, o)), p, ciclo: dur + PAUSA };
	}
	if (categoria === "combo") {
		const ciclo = 2.4;
		return { pose: componerPoses(POSE_IDENTIDAD, preset.pose(t / ciclo, o)), p: t / ciclo, ciclo };
	}
	const periodo = Math.max(0.3, preset.duracion);
	return { pose: componerPoses(POSE_IDENTIDAD, preset.pose((t % periodo) / periodo, o)), p: 1, ciclo: periodo * 2 };
}

export function TarjetaAnimacion({
	preset,
	categoria,
	esTexto,
	activa,
	onElegir,
}: {
	/** `null` = «Ninguno». */
	preset: PresetAnimacion | null;
	categoria: CategoriaAnimacion;
	esTexto: boolean;
	activa: boolean;
	onElegir: () => void;
}) {
	const [encima, setEncima] = useState(false);
	const figura = useRef<HTMLDivElement>(null);
	const rotulo = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const nodo = figura.current;
		if (!encima || !preset || !nodo) return;
		const inicio = performance.now();
		let cuadro = 0;
		const paso = (ahora: number) => {
			const total = (ahora - inicio) / 1000;
			const { ciclo } = poseDeMuestra(preset, categoria, 0, esTexto);
			const t = total % ciclo;
			const { pose, p } = poseDeMuestra(preset, categoria, t, esTexto);
			const ancho = nodo.parentElement?.clientWidth ?? 60;
			const alto = nodo.parentElement?.clientHeight ?? 60;
			nodo.style.transform =
				`translate(${pose.dx * ancho}px, ${pose.dy * alto}px) ` +
				`rotate(${pose.giro}deg) ` +
				`scale(${pose.escala * pose.escalaX}, ${pose.escala * pose.escalaY})`;
			nodo.style.opacity = String(Math.max(0, Math.min(1, pose.opacidad)));
			if (preset.revela && rotulo.current) {
				const fraccion = categoria === "salida" ? 1 - p : p;
				rotulo.current.textContent =
					lineasReveladas([TEXTO_MUESTRA], { fraccion, modo: preset.revela })[0] || " ";
			}
			cuadro = requestAnimationFrame(paso);
		};
		cuadro = requestAnimationFrame(paso);
		const rotuloActual = rotulo.current;
		return () => {
			cancelAnimationFrame(cuadro);
			nodo.style.transform = "";
			nodo.style.opacity = "";
			if (rotuloActual) rotuloActual.textContent = TEXTO_MUESTRA;
		};
	}, [encima, preset, categoria, esTexto]);

	let dibujo: ReactNode;
	if (!preset) {
		dibujo = <Ban className="size-5 text-(--cc-text-3)" strokeWidth={1.5} />;
	} else if (esTexto) {
		dibujo = (
			<span ref={rotulo} className="text-[13px] font-semibold whitespace-pre text-foreground select-none">
				{TEXTO_MUESTRA}
			</span>
		);
	} else {
		dibujo = (
			<span className="flex size-9 items-center justify-center rounded-[4px] bg-(--cc-raised) text-(--cc-icon)">
				<IconoImagen className="size-5" strokeWidth={1.5} />
			</span>
		);
	}

	const nombre = preset?.nombre ?? "Ninguno";
	return (
		<button
			type="button"
			aria-pressed={activa}
			onClick={onElegir}
			onMouseEnter={() => setEncima(true)}
			onMouseLeave={() => setEncima(false)}
			onFocus={() => setEncima(true)}
			onBlur={() => setEncima(false)}
			className="group flex min-w-0 cursor-pointer flex-col items-center gap-1"
		>
			<span
				className={cn(
					"relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[5px] border bg-(--cc-sunken) transition-colors",
					activa ? "border-primary" : "border-transparent group-hover:border-(--cc-line-2)",
				)}
			>
				<div ref={figura} className="flex items-center justify-center will-change-transform">
					{dibujo}
				</div>
			</span>
			<span
				className={cn("w-full truncate text-center text-[11px]", activa ? "text-primary" : "text-(--cc-text-2)")}
				title={nombre}
			>
				{nombre}
			</span>
		</button>
	);
}
