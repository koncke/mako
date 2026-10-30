"use client";

// El ancho de un elemento, medido ANTES de pintar y cada vez que cambia: para las barras que eligen su forma por el lugar
// que les deja su panel (la del reproductor, preview/barra-niveles.ts; la de la línea de tiempo, timeline/barra-ancho.ts),
// no por la ventana. 0 = todavía sin medir.

import { useLayoutEffect, useState, type RefObject } from "react";

export function useAncho(ref: RefObject<HTMLElement | null>): number {
	const [ancho, setAncho] = useState(0);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		setAncho(el.getBoundingClientRect().width);
		const observador = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
		observador.observe(el);
		return () => observador.disconnect();
	}, [ref]);
	return ancho;
}
