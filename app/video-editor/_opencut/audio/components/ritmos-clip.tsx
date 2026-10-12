"use client";

// Los ritmos marcados de un clip de audio: puntos amarillos abajo del clip, como
// CapCut. Lo dibuja el clip de audio de la línea de tiempo
// (timeline/components/timeline-element.tsx); la herramienta que los marca está
// en ./ritmos.tsx. Archivo aparte para que el clip no arrastre la barra.

import type { AudioElement } from "@/app/video-editor/_opencut/timeline";
import { ritmosEnClip } from "../ritmos";

/** Los puntos amarillos de los ritmos, abajo del clip de audio. */
export function RitmosClip({ element, pixelsPerSecond }: { element: AudioElement; pixelsPerSecond: number }) {
	const puntos = ritmosEnClip(element);
	if (puntos.length === 0) return null;
	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-[2px] h-[5px]" aria-hidden>
			{puntos.map((t) => (
				<span
					key={t}
					className="absolute top-0 size-[5px] -translate-x-1/2 rounded-full bg-(--cc-beat)"
					style={{ left: t * pixelsPerSecond }}
				/>
			))}
		</div>
	);
}
