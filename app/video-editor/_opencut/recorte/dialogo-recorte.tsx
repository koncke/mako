"use client";

// =============================================================================
// El diálogo «Recortar» (barra de la línea de tiempo › Recortar)
// =============================================================================
// Como el de CapCut: el cuadro del clip en el cabezal, un rectángulo con la
// cuadrícula de tercios que se mueve y se estira de las esquinas y los bordes, y
// abajo la proporción («Libre», «Original», «16:9», «9:16», «1:1», «4:3»…),
// «Restablecer», «Cancelar» y «Confirmar». Al confirmar guarda `recorte.*` (un
// paso de deshacer); lo dibuja el gancho de fuente de ./ganchos.ts.
//
// Con una proporción fija, estirar mantiene la proporción EN PÍXELES de la
// fuente (en unidades normalizadas, alto = ancho × W / (H × proporción)).

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ImageElement, VideoElement } from "@/app/video-editor/_opencut/timeline";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { SelectCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { PROPORCIONES_RECORTE } from "@/app/video-editor/_opencut/params/extra/recorte";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { cuadroDeImagen, cuadroDeVideo, type Cuadro } from "./cuadro";
import {
	LADO_MINIMO,
	RECT_COMPLETO,
	normalizarRect,
	paramsDeRect,
	proporcionDeParams,
	rectConProporcion,
	rectDeParams,
	valorProporcion,
	type RectRecorte,
} from "./geometria";

const CAJA_ANCHO = 680;
const CAJA_ALTO = 380;

type Agarre = "mover" | "n" | "s" | "e" | "o" | "ne" | "no" | "se" | "so";

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** El rectángulo después de arrastrar `agarre` (dx, dy normalizados). */
function arrastrar(
	agarre: Agarre,
	r0: RectRecorte,
	dx: number,
	dy: number,
	k: number | null,
): RectRecorte {
	const { x: x0, y: y0, ancho: w0, alto: h0 } = r0;
	if (agarre === "mover") {
		return {
			...r0,
			x: acotar(x0 + dx, 0, 1 - w0),
			y: acotar(y0 + dy, 0, 1 - h0),
		};
	}
	const izq = agarre.includes("o");
	const der = agarre.includes("e");
	const arr = agarre.includes("n");
	const aba = agarre.includes("s");

	if (k === null) {
		// Libre: cada borde por su lado.
		let { x, y, ancho, alto } = r0;
		if (izq) {
			x = acotar(x0 + dx, 0, x0 + w0 - LADO_MINIMO);
			ancho = x0 + w0 - x;
		}
		if (der) ancho = acotar(w0 + dx, LADO_MINIMO, 1 - x0);
		if (arr) {
			y = acotar(y0 + dy, 0, y0 + h0 - LADO_MINIMO);
			alto = y0 + h0 - y;
		}
		if (aba) alto = acotar(h0 + dy, LADO_MINIMO, 1 - y0);
		return { x, y, ancho, alto };
	}

	// Proporción fija (alto = ancho × k). Esquinas: la opuesta queda quieta.
	// Bordes: el eje del borde manda y el otro se centra.
	const cx = x0 + w0 / 2;
	const cy = y0 + h0 / 2;
	let ancho: number;
	if (izq || der) {
		ancho = izq ? w0 - dx : w0 + dx;
	} else {
		ancho = (arr ? h0 - dy : h0 + dy) / k;
	}
	// Topes: lo que entra hacia el lado que se estira (o centrado).
	const maxAncho = izq ? x0 + w0 : der ? 1 - x0 : 2 * Math.min(cx, 1 - cx);
	const maxAlto = arr ? y0 + h0 : aba ? 1 - y0 : 2 * Math.min(cy, 1 - cy);
	ancho = acotar(ancho, Math.max(LADO_MINIMO, LADO_MINIMO / k), Math.min(maxAncho, maxAlto / k));
	const alto = ancho * k;
	const x = izq ? x0 + w0 - ancho : der ? x0 : cx - ancho / 2;
	const y = arr ? y0 + h0 - alto : aba ? y0 : cy - alto / 2;
	return { x, y, ancho, alto };
}

export function DialogoRecorte({
	editor,
	trackId,
	element,
	onCerrar,
}: {
	editor: EditorCore;
	trackId: string;
	element: VideoElement | ImageElement;
	onCerrar: () => void;
}) {
	const [cuadro, setCuadro] = useState<Cuadro | null>(null);
	const [error, setError] = useState(false);
	const [rect, setRect] = useState<RectRecorte>(() => rectDeParams(element.params));
	const [proporcion, setProporcion] = useState(() => proporcionDeParams(element.params));
	const lienzo = useRef<HTMLCanvasElement>(null);
	const arrastre = useRef<{ agarre: Agarre; px: number; py: number; r0: RectRecorte } | null>(null);

	// El cuadro del cabezal (o el primero, si el cabezal no está sobre el clip).
	useEffect(() => {
		let vivo = true;
		const cargar = async (): Promise<Cuadro> => {
			const asset = editor.media.getAssets().find((a) => a.id === element.mediaId);
			if (!asset) throw new Error("El medio del clip no está en el proyecto");
			if (element.type === "image") return cuadroDeImagen(asset);
			const cabezal = editor.playback.getCurrentTime();
			const enClip = Math.min(
				Math.max(0, cabezal - element.startTime),
				Math.max(0, element.duration - 1),
			);
			const fuente =
				element.trimStart +
				getSourceTimeAtClipTime({
					clipTime: enClip,
					retime: element.retime,
					clipDuration: element.duration,
				});
			return cuadroDeVideo({
				file: asset.file,
				segundos: fuente / TICKS_PER_SECOND,
				ladoMaximo: 1280,
			});
		};
		cargar()
			.then((c) => vivo && setCuadro(c))
			.catch((e) => {
				console.error("[recortar] no se pudo leer el cuadro", e);
				if (vivo) setError(true);
			});
		return () => {
			vivo = false;
		};
	}, [editor, element]);

	// Tamaño en pantalla: el cuadro entero adentro de la caja.
	const escala = cuadro ? Math.min(CAJA_ANCHO / cuadro.width, CAJA_ALTO / cuadro.height) : 1;
	const anchoVista = cuadro ? Math.round(cuadro.width * escala) : CAJA_ANCHO;
	const altoVista = cuadro ? Math.round(cuadro.height * escala) : CAJA_ALTO;

	useEffect(() => {
		const c = lienzo.current;
		if (!c || !cuadro) return;
		const dpr = window.devicePixelRatio || 1;
		c.width = Math.round(anchoVista * dpr);
		c.height = Math.round(altoVista * dpr);
		const c2d = c.getContext("2d");
		if (!c2d) return;
		c2d.drawImage(cuadro.source, 0, 0, c.width, c.height);
	}, [cuadro, anchoVista, altoVista]);

	const k = (() => {
		if (!cuadro) return null;
		const p = valorProporcion(proporcion, cuadro);
		return p === null ? null : cuadro.width / (cuadro.height * p);
	})();

	const elegirProporcion = (id: string) => {
		setProporcion(id);
		if (!cuadro) return;
		const p = valorProporcion(id, cuadro);
		if (p !== null) setRect(rectConProporcion(rect, p, cuadro));
	};

	const empezar = (agarre: Agarre) => (e: ReactPointerEvent<HTMLElement>) => {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		arrastre.current = { agarre, px: e.clientX, py: e.clientY, r0: rect };
	};
	const mover = (e: ReactPointerEvent<HTMLElement>) => {
		const a = arrastre.current;
		if (!a) return;
		const dx = (e.clientX - a.px) / anchoVista;
		const dy = (e.clientY - a.py) / altoVista;
		setRect(arrastrar(a.agarre, a.r0, dx, dy, k));
	};
	const soltar = (e: ReactPointerEvent<HTMLElement>) => {
		arrastre.current = null;
		const el = e.currentTarget as HTMLElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	};
	const eventos = (agarre: Agarre) => ({
		onPointerDown: empezar(agarre),
		onPointerMove: mover,
		onPointerUp: soltar,
		onPointerCancel: soltar,
	});

	const confirmar = () => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					patch: { params: paramsDeRect(normalizarRect(rect), proporcion) },
				},
			],
		});
		toast.success("Recortado", { duration: 1500 });
		onCerrar();
	};

	const esquina = "absolute size-3.5 border-white";
	const borde = "absolute bg-white";

	return (
		<Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
			<DialogContent
				className="max-w-[760px] gap-0 bg-(--cc-panel)"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<DialogHeader className="py-4">
					<DialogTitle className="text-[15px] font-medium">Recortar</DialogTitle>
				</DialogHeader>
				<div
					className="flex items-center justify-center bg-(--cc-app) px-10 py-6"
					style={{ minHeight: CAJA_ALTO + 48 }}
				>
					{error ? (
						<p className="text-[13px] text-(--cc-text-3)">No se pudo leer el cuadro</p>
					) : !cuadro ? (
						<Spinner className="size-5 text-(--cc-text-3)" />
					) : (
						<div className="relative overflow-hidden" style={{ width: anchoVista, height: altoVista }}>
							<canvas
								ref={lienzo}
								className="block"
								style={{ width: anchoVista, height: altoVista }}
							/>
							<div
								className="absolute cursor-move touch-none"
								style={{
									left: rect.x * anchoVista,
									top: rect.y * altoVista,
									width: rect.ancho * anchoVista,
									height: rect.alto * altoVista,
									// Lo de afuera, oscurecido.
									boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.6)",
									outline: "1px solid rgb(255 255 255 / 0.9)",
								}}
								{...eventos("mover")}
							>
								{/* Tercios */}
								<span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/35" />
								<span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/35" />
								<span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/35" />
								<span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/35" />
								{/* Esquinas en L */}
								<span className={cn(esquina, "-top-[3px] -left-[3px] cursor-nwse-resize border-t-[3px] border-l-[3px]")} {...eventos("no")} />
								<span className={cn(esquina, "-top-[3px] -right-[3px] cursor-nesw-resize border-t-[3px] border-r-[3px]")} {...eventos("ne")} />
								<span className={cn(esquina, "-bottom-[3px] -left-[3px] cursor-nesw-resize border-b-[3px] border-l-[3px]")} {...eventos("so")} />
								<span className={cn(esquina, "-right-[3px] -bottom-[3px] cursor-nwse-resize border-r-[3px] border-b-[3px]")} {...eventos("se")} />
								{/* Bordes */}
								<span className={cn(borde, "-top-[2px] left-1/2 h-[3px] w-5 -translate-x-1/2 cursor-ns-resize")} {...eventos("n")} />
								<span className={cn(borde, "-bottom-[2px] left-1/2 h-[3px] w-5 -translate-x-1/2 cursor-ns-resize")} {...eventos("s")} />
								<span className={cn(borde, "top-1/2 -left-[2px] h-5 w-[3px] -translate-y-1/2 cursor-ew-resize")} {...eventos("o")} />
								<span className={cn(borde, "top-1/2 -right-[2px] h-5 w-[3px] -translate-y-1/2 cursor-ew-resize")} {...eventos("e")} />
							</div>
						</div>
					)}
				</div>
				<DialogFooter className="items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<span className="text-[12px] text-(--cc-text-2)">Relación de aspecto</span>
						<SelectCe
							className="w-[120px]"
							valor={proporcion}
							opciones={PROPORCIONES_RECORTE.map((p) => ({ id: p.id, etiqueta: p.etiqueta }))}
							onCambio={elegirProporcion}
							ariaLabel="Relación de aspecto"
						/>
						<Button
							variant="text"
							className="text-[12px]"
							onClick={() => {
								setRect(RECT_COMPLETO);
								setProporcion("libre");
							}}
						>
							Restablecer
						</Button>
					</div>
					<div className="flex gap-3">
						<Button variant="secondary" onClick={onCerrar}>
							Cancelar
						</Button>
						<Button onClick={confirmar} disabled={!cuadro}>
							Confirmar
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
