"use client";

// =============================================================================
// La miniatura de una transición: la transición de verdad entre dos muestras
// =============================================================================
// Corre el mismo cálculo que el render (aplicarTransiciones del gancho, con los
// pases `ce-tr-*` por pases-ce.ts) sobre las escenas de ../muestras.ts, y las
// compone con el canvas 2D como lo haría el compositor: A abajo, B arriba, cada
// una con su transformación y su opacidad. Quieta muestra la mitad de la
// transición; con el mouse encima se anima en bucle, como en CapCut (salvo con
// «reducir movimiento» del sistema).

import { useEffect, useRef } from "react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { dibujarMuestra, LADO_MUESTRA } from "../muestras";

/** Un ciclo: A quieta, la transición, B quieta. */
const QUIETA_MS = 350;
const TRANSICION_MS = 1000;
const CICLO_MS = QUIETA_MS * 2 + TRANSICION_MS;

function progresoDelCiclo(ms: number): number {
	const t = ms % CICLO_MS;
	if (t < QUIETA_MS) return 0;
	if (t > QUIETA_MS + TRANSICION_MS) return 1;
	return (t - QUIETA_MS) / TRANSICION_MS;
}

export function MiniaturaTransicion({
	id,
	animar,
	className,
}: {
	id: string;
	/** El mouse está encima: se anima en bucle. */
	animar: boolean;
	className?: string;
}) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const reducido =
			typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		if (!animar || reducido) {
			dibujarMuestra(ctx, id, 0.45);
			return;
		}
		let cuadro = 0;
		const inicio = performance.now();
		const paso = (ahora: number) => {
			dibujarMuestra(ctx, id, progresoDelCiclo(ahora - inicio));
			cuadro = requestAnimationFrame(paso);
		};
		cuadro = requestAnimationFrame(paso);
		return () => {
			cancelAnimationFrame(cuadro);
			dibujarMuestra(ctx, id, 0.45);
		};
	}, [id, animar]);

	return (
		<canvas
			ref={ref}
			width={LADO_MUESTRA}
			height={LADO_MUESTRA}
			aria-hidden
			className={cn("block size-full", className)}
		/>
	);
}
