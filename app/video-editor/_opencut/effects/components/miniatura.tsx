"use client";

// =============================================================================
// La miniatura de un efecto, un filtro o un ajuste: la imagen de muestra con el
// efecto aplicado de verdad (services/renderer/effect-preview.ts → los mismos
// pases que el render). Las de CapCut son videos de ByteDance; acá se generan.
// =============================================================================
// Muestra: el retrato de /ve/effects (el de OpenCut) para efectos y ajustes, y un
// paisaje dibujado acá para los filtros (el retrato es blanco, negro y piel: un
// filtro de color casi no se nota). Los efectos que se mueven se animan mientras
// el mouse está encima, como en CapCut.

import { useEffect, useRef } from "react";
import { effectsRegistry } from "@/app/video-editor/_opencut/effects";
import { buildDefaultParamValues } from "@/app/video-editor/_opencut/params/registry";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { effectPreviewService } from "@/app/video-editor/_opencut/services/renderer/effect-preview";
import { cn } from "@/app/video-editor/_opencut/utils/ui";

export type FuenteMiniatura = "retrato" | "paisaje";

let paisaje: OffscreenCanvas | null = null;

/** Un paisaje con cielo, sol, montañas, pasto y flores: todo el círculo cromático. */
function escenaPaisaje(): OffscreenCanvas | null {
	if (paisaje) return paisaje;
	if (typeof OffscreenCanvas === "undefined") return null;
	const lado = effectPreviewService.PREVIEW_SIZE;
	const c = new OffscreenCanvas(lado, lado);
	const ctx = c.getContext("2d");
	if (!ctx) return null;
	const cielo = ctx.createLinearGradient(0, 0, 0, lado * 0.62);
	cielo.addColorStop(0, "#2a5fbf");
	cielo.addColorStop(0.55, "#7fb3e8");
	cielo.addColorStop(1, "#f6c27a");
	ctx.fillStyle = cielo;
	ctx.fillRect(0, 0, lado, lado);
	const sol = ctx.createRadialGradient(lado * 0.7, lado * 0.42, 2, lado * 0.7, lado * 0.42, lado * 0.22);
	sol.addColorStop(0, "rgba(255,240,190,1)");
	sol.addColorStop(0.25, "rgba(255,214,120,0.9)");
	sol.addColorStop(1, "rgba(255,180,90,0)");
	ctx.fillStyle = sol;
	ctx.fillRect(0, 0, lado, lado);
	const montana = (color: string, base: number, picos: number[][]) => {
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(0, base);
		for (const [x, y] of picos) ctx.lineTo(x * lado, y * lado);
		ctx.lineTo(lado, base);
		ctx.lineTo(lado, lado);
		ctx.lineTo(0, lado);
		ctx.closePath();
		ctx.fill();
	};
	montana("#6c5a9c", lado * 0.6, [[0, 0.52], [0.18, 0.36], [0.33, 0.5], [0.52, 0.32], [0.7, 0.52], [0.86, 0.4], [1, 0.5]]);
	montana("#2f4f7a", lado * 0.66, [[0, 0.6], [0.22, 0.48], [0.45, 0.62], [0.65, 0.5], [1, 0.62]]);
	const pasto = ctx.createLinearGradient(0, lado * 0.66, 0, lado);
	pasto.addColorStop(0, "#5fb34a");
	pasto.addColorStop(1, "#2c6b2a");
	ctx.fillStyle = pasto;
	ctx.beginPath();
	ctx.moveTo(0, lado * 0.7);
	ctx.quadraticCurveTo(lado * 0.5, lado * 0.6, lado, lado * 0.72);
	ctx.lineTo(lado, lado);
	ctx.lineTo(0, lado);
	ctx.closePath();
	ctx.fill();
	const flores = ["#e5484d", "#f1d33f", "#d64fb4", "#ffffff", "#f08c2e"];
	for (let i = 0; i < 46; i++) {
		const x = ((i * 37) % 100) / 100;
		const y = 0.76 + (((i * 53) % 100) / 100) * 0.22;
		ctx.fillStyle = flores[i % flores.length];
		ctx.beginPath();
		ctx.arc(x * lado, y * lado, 1.6 + (i % 3) * 0.6, 0, Math.PI * 2);
		ctx.fill();
	}
	paisaje = c;
	return c;
}

export function MiniaturaEfecto({
	effectType,
	params,
	fuente = "retrato",
	className,
}: {
	effectType: string;
	/** Params a mostrar (los de un predefinido, una LUT). Sin esto, los por defecto. */
	params?: ParamValues;
	fuente?: FuenteMiniatura;
	className?: string;
}) {
	const lienzo = useRef<HTMLCanvasElement>(null);
	const animacion = useRef<number | null>(null);
	const definicion = effectsRegistry.has(effectType) ? effectsRegistry.get(effectType) : null;
	const clave = JSON.stringify(params ?? null);

	useEffect(() => {
		if (!definicion) return;
		const base = { ...buildDefaultParamValues(definicion.params), ...(params ?? {}) };
		const dibujar = (tiempo: number) => {
			const canvas = lienzo.current;
			if (!canvas) return;
			effectPreviewService.renderPreview({
				effectType,
				params: { ...base, __tiempo: tiempo },
				targetCanvas: canvas,
				fuente: fuente === "paisaje" ? escenaPaisaje() : null,
			});
		};
		// Un instante con algo que ver en los que se mueven (el destello en 0 es blanco).
		const quieto = () => dibujar(definicion.animado ? 0.42 : 0);
		quieto();
		const soltar = effectPreviewService.onPreviewImageReady({ callback: quieto });
		const canvas = lienzo.current;
		if (!definicion.animado || !canvas) return soltar;
		const entrar = () => {
			const inicio = performance.now();
			const paso = () => {
				dibujar((performance.now() - inicio) / 1000 + 0.42);
				animacion.current = requestAnimationFrame(paso);
			};
			animacion.current = requestAnimationFrame(paso);
		};
		const salir = () => {
			if (animacion.current !== null) cancelAnimationFrame(animacion.current);
			animacion.current = null;
			quieto();
		};
		const tarjeta = canvas.parentElement ?? canvas;
		tarjeta.addEventListener("pointerenter", entrar);
		tarjeta.addEventListener("pointerleave", salir);
		return () => {
			soltar();
			tarjeta.removeEventListener("pointerenter", entrar);
			tarjeta.removeEventListener("pointerleave", salir);
			if (animacion.current !== null) cancelAnimationFrame(animacion.current);
		};
		// `clave` resume `params` (un objeto nuevo en cada render del padre).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [effectType, clave, fuente, definicion]);

	return <canvas ref={lienzo} className={cn("size-full object-cover", className)} />;
}
