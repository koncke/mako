"use client";

// =============================================================================
// Las reglas del reproductor («Mostrar/ocultar reglas», Ctrl+Alt+R)
// =============================================================================
// Una regla arriba y otra a la izquierda del área del reproductor, en PÍXELES
// DEL LIENZO (0 = el borde de arriba/izquierda del video), que siguen el zoom y
// el desplazamiento del reproductor. El tramo que ocupa el lienzo va un escalón
// más claro. De cada regla se arrastran las guías (use-arrastre-guia.ts).
//
// Se dibujan en un <canvas> y no con un div por marca: con zoom alto serían
// cientos de nodos re-montándose en cada cuadro de un pellizco. Ojo: un
// <canvas> es un elemento «reemplazado» y `left` + `right` NO lo estiran
// (queda en sus 300 px de fábrica): el largo va explícito con calc().

import { useEffect, useRef } from "react";
import { usePreviewViewport } from "@/app/video-editor/_opencut/preview/components/preview-viewport";
import type { GuiaUsuario } from "@/app/video-editor/_opencut/preview/preview-store";

/** El grosor de cada regla, en px de pantalla. */
export const GROSOR_REGLA = 16;

const PASOS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
/** Distancia mínima en pantalla entre dos números de la regla. */
const SEPARACION_MINIMA = 56;

function leerColor(el: Element, variable: string, respaldo: string): string {
	return getComputedStyle(el).getPropertyValue(variable).trim() || respaldo;
}

function dibujarRegla({
	canvas,
	orientacion,
	origen,
	escala,
	largoLienzo,
}: {
	canvas: HTMLCanvasElement;
	orientacion: "arriba" | "izquierda";
	/** Dónde cae el 0 del lienzo, en px de pantalla desde el comienzo de la regla. */
	origen: number;
	/** Px de pantalla por px del lienzo. */
	escala: number;
	largoLienzo: number;
}) {
	const dpr = window.devicePixelRatio || 1;
	const ancho = canvas.clientWidth;
	const alto = canvas.clientHeight;
	if (ancho === 0 || alto === 0) return;
	if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
	if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const fondo = leerColor(canvas, "--cc-sunken", "#1c1c1c");
	const tramo = leerColor(canvas, "--cc-panel", "#262626");
	const linea = leerColor(canvas, "--cc-line-2", "#353535");
	const marca = leerColor(canvas, "--cc-ruler", "#555555");
	const texto = leerColor(canvas, "--cc-text-3", "#929292");

	// Se dibuja siempre «a lo largo» del eje x; la regla de la izquierda rota.
	const largo = orientacion === "arriba" ? ancho : alto;
	const grosor = orientacion === "arriba" ? alto : ancho;
	ctx.save();
	if (orientacion === "izquierda") {
		// x de dibujo = y de pantalla; el grosor crece hacia la izquierda.
		ctx.translate(grosor, 0);
		ctx.rotate(Math.PI / 2);
	}

	ctx.fillStyle = fondo;
	ctx.fillRect(0, 0, largo, grosor);
	ctx.fillStyle = tramo;
	ctx.fillRect(origen, 0, largoLienzo * escala, grosor);
	ctx.fillStyle = linea;
	ctx.fillRect(0, orientacion === "arriba" ? grosor - 1 : 0, largo, 1);

	if (escala > 0) {
		const paso = PASOS.find((p) => p * escala >= SEPARACION_MINIMA) ?? PASOS[PASOS.length - 1];
		const divisiones = paso * escala >= 100 ? 10 : 5;
		const sub = paso / divisiones;
		const desde = Math.floor(-origen / escala / sub) * sub;
		const hasta = (largo - origen) / escala;
		ctx.fillStyle = marca;
		ctx.font = "9px Geist, system-ui, sans-serif";
		ctx.textBaseline = "top";
		// Las marcas crecen desde el borde que toca el reproductor.
		const base = orientacion === "arriba" ? grosor : 0;
		const signo = orientacion === "arriba" ? -1 : 1;
		for (let v = desde, i = 0; v <= hasta && i < 4000; v += sub, i++) {
			const x = Math.round(origen + v * escala) + 0.5;
			const esMayor = Math.abs(v / paso - Math.round(v / paso)) < 1e-6;
			const largoMarca = esMayor ? grosor * 0.6 : grosor * 0.25;
			ctx.fillRect(x, signo < 0 ? base - largoMarca : base, 1, largoMarca);
			if (esMayor) {
				ctx.fillStyle = texto;
				const etiqueta = String(Math.round(v));
				ctx.fillText(etiqueta, x + 3, orientacion === "arriba" ? 1 : grosor - 10);
				ctx.fillStyle = marca;
			}
		}
	}
	ctx.restore();
}

export function Reglas({
	onSacarGuia,
}: {
	/** Pointerdown sobre una regla: la de arriba saca guías horizontales. */
	onSacarGuia: (eje: GuiaUsuario["eje"], event: React.PointerEvent) => void;
}) {
	const viewport = usePreviewViewport();
	const arribaRef = useRef<HTMLCanvasElement>(null);
	const izquierdaRef = useRef<HTMLCanvasElement>(null);
	const origen = viewport.canvasToOverlay({ canvasX: 0, canvasY: 0 });
	const escala = viewport.getDisplayScale().x;
	const lienzoAncho = viewport.sceneWidth / (escala || 1);
	const lienzoAlto = viewport.sceneHeight / (escala || 1);

	useEffect(() => {
		const redibujar = () => {
			if (arribaRef.current) {
				dibujarRegla({
					canvas: arribaRef.current,
					orientacion: "arriba",
					origen: origen.x,
					escala,
					largoLienzo: lienzoAncho,
				});
			}
			if (izquierdaRef.current) {
				dibujarRegla({
					canvas: izquierdaRef.current,
					orientacion: "izquierda",
					origen: origen.y,
					escala,
					largoLienzo: lienzoAlto,
				});
			}
		};
		redibujar();
		// El tamaño del canvas cambia con el panel sin que cambie la geometría.
		const observador = new ResizeObserver(redibujar);
		if (arribaRef.current) observador.observe(arribaRef.current);
		if (izquierdaRef.current) observador.observe(izquierdaRef.current);
		return () => observador.disconnect();
	}, [origen.x, origen.y, escala, lienzoAncho, lienzoAlto]);

	return (
		<>
			<div
				className="absolute top-0 left-0 bg-[var(--cc-sunken)]"
				style={{ width: GROSOR_REGLA, height: GROSOR_REGLA }}
				aria-hidden
			/>
			<canvas
				ref={arribaRef}
				aria-hidden
				className="absolute top-0 cursor-ns-resize"
				style={{ left: GROSOR_REGLA, height: GROSOR_REGLA, width: `calc(100% - ${GROSOR_REGLA}px)` }}
				onPointerDown={(event) => onSacarGuia("horizontal", event)}
			/>
			<canvas
				ref={izquierdaRef}
				aria-hidden
				className="absolute left-0 cursor-ew-resize"
				style={{ top: GROSOR_REGLA, width: GROSOR_REGLA, height: `calc(100% - ${GROSOR_REGLA}px)` }}
				onPointerDown={(event) => onSacarGuia("vertical", event)}
			/>
		</>
	);
}
