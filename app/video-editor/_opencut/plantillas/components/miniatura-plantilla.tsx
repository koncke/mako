"use client";

// =============================================================================
// La miniatura de una plantilla: la plantilla misma, dibujada en un canvas 2D
// =============================================================================
// Sin video de muestra (no hay material con licencia, plan §8): se dibuja la
// plantilla con ../dibujo.ts, que sigue a ../escena.ts (las piezas, su orden y la
// pose de animación del editor, con la «Máquina de escribir» cortando letras).
// Quieta en `plantilla.portada`; con el mouse encima corre en bucle a velocidad
// real, como la vista previa de CapCut; con «reducir movimiento» del sistema,
// quieta siempre (molde: transiciones/components/miniatura.tsx).
//
// Las fuentes: SÓLO las letras que la tarjeta dibuja, y recién cuando entra en
// pantalla (fonts/muestras.ts → cargarMuestra, `&text=`). Cargar las familias
// enteras de todas las tarjetas al abrir la pestaña es lo que colgaba Subtítulos ›
// Plantillas (hallazgos → «lo que se cuelga no es el karaoke»). La fuente entera
// llega al usar la plantilla (../instanciar.ts), antes de medir.

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { cargarMuestra, cssFamilia } from "@/app/video-editor/_opencut/fonts/muestras";
import type { Plantilla } from "@/lib/editor-video/plantillas";
import { dibujarMiniatura, type Contexto2D } from "../dibujo";
import { muestrasDeFuente } from "../uso";

/** Px del canvas: 1/5 de 1080x1920, nítido en una tarjeta de ~100 px a 2×. */
const ANCHO = 216;
const ALTO = 384;

const clave = (familia: string, peso: number) => `${familia}|${peso}`;

/** Las muestras de fuente de la tarjeta en `ref` (familia|peso → nombre), pedidas al entrar en pantalla. */
function useMuestrasDeFuente(ref: RefObject<Element | null>, plantilla: Plantilla): Record<string, string> {
	const [nombres, setNombres] = useState<Record<string, string>>({});
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let vivo = true;
		const pedir = () => {
			for (const pedido of muestrasDeFuente(plantilla)) {
				void cargarMuestra(pedido).then((nombre) => {
					if (vivo && nombre) setNombres((antes) => ({ ...antes, [clave(pedido.familia, pedido.peso)]: nombre }));
				});
			}
		};
		if (typeof IntersectionObserver === "undefined") {
			pedir();
			return () => {
				vivo = false;
			};
		}
		const obs = new IntersectionObserver(
			(entradas) => {
				if (!entradas.some((e) => e.isIntersecting)) return;
				obs.disconnect();
				pedir();
			},
			{ rootMargin: "100px" },
		);
		obs.observe(el);
		return () => {
			vivo = false;
			obs.disconnect();
		};
	}, [ref, plantilla]);
	return nombres;
}

export function MiniaturaPlantilla({
	plantilla,
	animar,
	className,
}: {
	plantilla: Plantilla;
	/** El mouse está encima: corre en bucle. */
	animar: boolean;
	className?: string;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	const nombres = useMuestrasDeFuente(ref, plantilla);
	const familia = useMemo(
		() => (fuente: string, peso: number) => cssFamilia(nombres[clave(fuente, peso)] ?? null),
		[nombres],
	);
	// Cuándo arrancó el bucle: si llega una fuente a mitad, el bucle sigue donde iba.
	const inicio = useRef<number | null>(null);

	useEffect(() => {
		if (!animar) inicio.current = null;
	}, [animar]);

	useEffect(() => {
		const canvas = ref.current;
		const ctx = canvas?.getContext("2d") as Contexto2D | null | undefined;
		if (!canvas || !ctx) return;
		const dibujar = (t: number) => dibujarMiniatura(ctx, { plantilla, t, ancho: ANCHO, familia });
		const reducido =
			typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		if (!animar || reducido) {
			dibujar(plantilla.portada);
			return;
		}
		if (inicio.current === null) inicio.current = performance.now();
		const desde = inicio.current;
		let cuadro = 0;
		const paso = (ahora: number) => {
			dibujar(((ahora - desde) / 1000) % plantilla.duracion);
			cuadro = requestAnimationFrame(paso);
		};
		cuadro = requestAnimationFrame(paso);
		return () => {
			cancelAnimationFrame(cuadro);
			dibujar(plantilla.portada);
		};
	}, [plantilla, animar, familia]);

	return <canvas ref={ref} width={ANCHO} height={ALTO} aria-hidden className={cn("block size-full", className)} />;
}
