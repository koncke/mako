"use client";

// La tira continua de miniaturas de un clip de video o imagen, como en CapCut.
// Se dibuja en UN canvas del ancho de lo que se ve (un clip de 10 minutos con
// el zoom al máximo mide millones de px: ni un canvas ni mil divs aguantan
// eso), igual que la onda de audio (audio-waveform.tsx). Los cuadros salen de
// ./miniaturas.ts; mientras llegan, cada recuadro muestra la miniatura del
// archivo.

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { useResizeObserver } from "@/app/video-editor/_opencut/hooks/use-resize-observer";
import { findScrollParent } from "@/app/video-editor/_opencut/utils/browser";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import {
	cuadroCacheado,
	escucharMiniaturas,
	miniaturasFallaron,
	pedirCuadros,
} from "./miniaturas";

/** Alto de decodificación: el doble del recuadro para pantallas de alta densidad. */
const ALTO_DECODIFICADO = 96;

type Props = {
	mediaId: string;
	tipo: "video" | "image";
	file?: File;
	/** Miniatura del archivo (o la imagen misma): respaldo mientras decodifica. */
	urlRespaldo?: string;
	/** Ancho / alto del archivo. */
	aspecto: number;
	pixelsPerSecond: number;
	clipDurationSec: number;
	sourceStartSec: number;
	retime?: RetimeConfig;
};

/** Paso entre cuadros pedidos: potencia de 2 cercana a lo que cubre un recuadro. */
function pasoCuantizado(segundosPorRecuadro: number): number {
	const p = 2 ** Math.round(Math.log2(Math.max(segundosPorRecuadro, 1 / 32)));
	return Math.max(1 / 32, p);
}

export function TiraMiniaturas({
	mediaId,
	tipo,
	file,
	urlRespaldo,
	aspecto,
	pixelsPerSecond,
	clipDurationSec,
	sourceStartSec,
	retime,
}: Props) {
	const contenedorRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const padreScrollRef = useRef<HTMLElement | null>(null);
	const altoRef = useRef(0);
	const respaldoRef = useRef<HTMLImageElement | null>(null);
	const config = useCommittedRef({
		mediaId,
		tipo,
		file,
		aspecto,
		pixelsPerSecond,
		clipDurationSec,
		sourceStartSec,
		retime,
	});

	const dibujar = useCallback(() => {
		const contenedor = contenedorRef.current;
		const canvas = canvasRef.current;
		const alto = altoRef.current;
		if (!contenedor || !canvas || alto <= 0) return;

		const rect = contenedor.getBoundingClientRect();
		const ancho = rect.width;
		const padre = padreScrollRef.current;
		let izq: number;
		let der: number;
		if (padre) {
			const r = padre.getBoundingClientRect();
			izq = Math.max(0, r.left - rect.left);
			der = Math.min(ancho, r.right - rect.left);
		} else {
			izq = Math.max(0, -rect.left);
			der = Math.min(ancho, window.innerWidth - rect.left);
		}
		const visible = der - izq;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		if (visible <= 0) {
			canvas.width = 1;
			canvas.style.width = "0px";
			return;
		}

		const c = config.current;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.ceil(visible * dpr);
		canvas.height = Math.round(alto * dpr);
		canvas.style.width = `${visible}px`;
		canvas.style.height = `${alto}px`;
		canvas.style.left = `${izq}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, visible, alto);

		const anchoRecuadro = Math.max(8, alto * (c.aspecto || 16 / 9));
		const primero = Math.floor(izq / anchoRecuadro);
		const ultimo = Math.ceil(der / anchoRecuadro);
		const paso = pasoCuantizado(
			getSourceTimeAtClipTime({
				clipTime: anchoRecuadro / c.pixelsPerSecond,
				retime: c.retime,
			}),
		);

		const pedir: number[] = [];
		const respaldo = respaldoRef.current;
		const usarCuadros =
			c.tipo === "video" && !!c.file && !miniaturasFallaron(c.mediaId);

		for (let i = primero; i < ultimo; i++) {
			const x = i * anchoRecuadro;
			let imagen: CanvasImageSource | null = null;
			if (usarCuadros) {
				const enClip = Math.min(c.clipDurationSec, x / c.pixelsPerSecond);
				const crudo =
					c.sourceStartSec +
					getSourceTimeAtClipTime({ clipTime: enClip, retime: c.retime });
				const t = Math.max(0, Math.round(crudo / paso) * paso);
				imagen = cuadroCacheado({ mediaId: c.mediaId, alto: ALTO_DECODIFICADO, tiempo: t });
				if (!imagen) pedir.push(t);
			}
			const fuente = imagen ?? (respaldo?.complete ? respaldo : null);
			if (!fuente) continue;
			// Recortado al ancho visible: el recuadro de la punta queda cortado,
			// como en CapCut (no se estira).
			ctx.drawImage(fuente, x - izq, 0, anchoRecuadro, alto);
		}

		if (pedir.length > 0 && c.file) {
			pedirCuadros({
				mediaId: c.mediaId,
				file: c.file,
				alto: ALTO_DECODIFICADO,
				tiempos: pedir,
			});
		}
	}, [config]);

	useEffect(() => {
		if (!urlRespaldo) {
			respaldoRef.current = null;
			return;
		}
		const img = new Image();
		img.decoding = "async";
		img.onload = () => dibujar();
		img.src = urlRespaldo;
		respaldoRef.current = img;
	}, [urlRespaldo, dibujar]);

	useEffect(() => escucharMiniaturas(mediaId, dibujar), [mediaId, dibujar]);

	useLayoutEffect(() => {
		dibujar();
	}, [
		dibujar,
		pixelsPerSecond,
		clipDurationSec,
		sourceStartSec,
		retime,
		aspecto,
		file,
	]);

	useEffect(() => {
		const contenedor = contenedorRef.current;
		if (!contenedor) return;
		padreScrollRef.current = findScrollParent({ element: contenedor });
		const padre = padreScrollRef.current;
		if (!padre) return;
		padre.addEventListener("scroll", dibujar, { passive: true });
		return () => padre.removeEventListener("scroll", dibujar);
	}, [dibujar]);

	const alRedimensionar = useCallback(
		(entry: ResizeObserverEntry) => {
			altoRef.current = entry.contentRect.height;
			dibujar();
		},
		[dibujar],
	);
	useResizeObserver({ ref: contenedorRef, onResize: alRedimensionar });

	return (
		<div ref={contenedorRef} className="pointer-events-none relative size-full overflow-hidden">
			<canvas ref={canvasRef} className="absolute top-0" />
		</div>
	);
}
