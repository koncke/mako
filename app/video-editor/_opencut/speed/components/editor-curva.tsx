"use client";

// =============================================================================
// El editor de la curva de velocidad (Velocidad › Curva)
// =============================================================================
// El gráfico de CapCut: el eje vertical es la velocidad en escala logarítmica
// (10× arriba, 1× al medio, 0,1× abajo) y el horizontal, el clip de punta a
// punta. Los puntos se arrastran; los de las puntas sólo en vertical (la curva
// siempre cubre el clip entero). La línea blanca es el cabezal, si está sobre
// el clip. Se dibuja en SVG con el ancho medido del panel, así los puntos son
// redondos y no óvalos.
//
// Mientras se arrastra, `onArrastrar` recibe los puntos (para la vista previa);
// al soltar, `onSoltar` (para confirmar, un paso de deshacer).

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
	SEPARACION_MINIMA,
	VELOCIDAD_CURVA_MAX,
	VELOCIDAD_CURVA_MIN,
	velocidadEnCurva,
	type PuntoCurva,
} from "@/app/video-editor/_opencut/retime/curva";

const ALTO = 150;
const MARGEN_X = 30;
const MARGEN_Y = 10;
const RADIO = 5;

const LOG_MIN = Math.log10(VELOCIDAD_CURVA_MIN);
const LOG_MAX = Math.log10(VELOCIDAD_CURVA_MAX);

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function escalas(ancho: number) {
	const util = Math.max(1, ancho - MARGEN_X - 8);
	const alto = ALTO - MARGEN_Y * 2;
	return {
		aX: (x: number) => MARGEN_X + x * util,
		aY: (v: number) =>
			MARGEN_Y + (1 - (Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * alto,
		deX: (px: number) => acotar((px - MARGEN_X) / util, 0, 1),
		deY: (py: number) =>
			acotar(
				10 ** (LOG_MIN + (1 - (py - MARGEN_Y) / alto) * (LOG_MAX - LOG_MIN)),
				VELOCIDAD_CURVA_MIN,
				VELOCIDAD_CURVA_MAX,
			),
	};
}

function trazo(puntos: readonly PuntoCurva[], aX: (x: number) => number, aY: (v: number) => number) {
	const pasos = 96;
	let d = "";
	for (let i = 0; i <= pasos; i++) {
		const u = i / pasos;
		d += `${i === 0 ? "M" : "L"}${aX(u).toFixed(1)},${aY(velocidadEnCurva({ puntos }, u)).toFixed(1)}`;
	}
	return d;
}

export function EditorCurva({
	puntos,
	elegido,
	cabezal,
	onElegir,
	onArrastrar,
	onSoltar,
}: {
	puntos: readonly PuntoCurva[];
	elegido: number | null;
	/** Posición del cabezal en el clip (0–1), o null si está afuera. */
	cabezal: number | null;
	onElegir: (indice: number | null) => void;
	onArrastrar: (puntos: PuntoCurva[]) => void;
	onSoltar: (puntos: PuntoCurva[]) => void;
}) {
	const caja = useRef<HTMLDivElement>(null);
	const [ancho, setAncho] = useState(260);
	const arrastre = useRef<{ indice: number; puntos: PuntoCurva[]; movio: boolean } | null>(null);

	useEffect(() => {
		const el = caja.current;
		if (!el) return;
		const medir = () => setAncho(Math.max(120, el.clientWidth));
		medir();
		const ro = new ResizeObserver(medir);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const { aX, aY, deX, deY } = escalas(ancho);

	const posicion = (e: ReactPointerEvent) => {
		const r = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect() ??
			(e.currentTarget as SVGElement).getBoundingClientRect();
		return { px: e.clientX - r.left, py: e.clientY - r.top };
	};

	const empezar = (indice: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
		arrastre.current = { indice, puntos: puntos.map((p) => ({ ...p })), movio: false };
		onElegir(indice);
	};

	const mover = (e: ReactPointerEvent<SVGCircleElement>) => {
		const a = arrastre.current;
		if (!a) return;
		const { px, py } = posicion(e);
		const i = a.indice;
		const ultimo = a.puntos.length - 1;
		const x =
			i === 0
				? 0
				: i === ultimo
					? 1
					: acotar(
							deX(px),
							a.puntos[i - 1].x + SEPARACION_MINIMA,
							a.puntos[i + 1].x - SEPARACION_MINIMA,
						);
		// Un imán suave en 1×: es la referencia a la que más se vuelve.
		let y = deY(py);
		if (Math.abs(Math.log10(y)) < 0.03) y = 1;
		a.puntos[i] = { x, y: Math.round(y * 100) / 100 };
		a.movio = true;
		onArrastrar(a.puntos.map((p) => ({ ...p })));
	};

	const soltar = (e: ReactPointerEvent<SVGCircleElement>) => {
		const a = arrastre.current;
		arrastre.current = null;
		if ((e.currentTarget as SVGCircleElement).hasPointerCapture(e.pointerId)) {
			(e.currentTarget as SVGCircleElement).releasePointerCapture(e.pointerId);
		}
		if (a?.movio) onSoltar(a.puntos);
	};

	const marcas = [10, 1, 0.1];

	return (
		<div ref={caja} className="w-full select-none">
			<svg
				width={ancho}
				height={ALTO}
				className="block rounded-[5px] bg-(--cc-sunken)"
				onPointerDown={() => onElegir(null)}
				role="img"
				aria-label="Curva de velocidad"
			>
				{marcas.map((v) => (
					<g key={v}>
						<line
							x1={MARGEN_X}
							x2={ancho - 8}
							y1={aY(v)}
							y2={aY(v)}
							className="stroke-(--cc-line-2)"
							strokeDasharray={v === 1 ? undefined : "3 3"}
						/>
						<text
							x={MARGEN_X - 6}
							y={aY(v) + 3.5}
							textAnchor="end"
							className="fill-(--cc-text-3) text-[10px]"
						>
							{v}x
						</text>
					</g>
				))}
				{cabezal !== null && (
					<line
						x1={aX(cabezal)}
						x2={aX(cabezal)}
						y1={MARGEN_Y - 4}
						y2={ALTO - MARGEN_Y + 4}
						className="stroke-(--cc-playhead)"
						strokeWidth={1}
					/>
				)}
				<path d={trazo(puntos, aX, aY)} fill="none" className="stroke-primary" strokeWidth={1.5} />
				{puntos.map((p, i) => (
					<circle
						// Los puntos no tienen id: el índice ES su identidad mientras se arrastra.
						key={i}
						cx={aX(p.x)}
						cy={aY(p.y)}
						r={RADIO}
						className={
							i === elegido
								? "cursor-grab fill-primary stroke-white"
								: "cursor-grab fill-white stroke-(--cc-sunken)"
						}
						strokeWidth={1.5}
						onPointerDown={empezar(i)}
						onPointerMove={mover}
						onPointerUp={soltar}
						onPointerCancel={soltar}
					>
						<title>{`${p.y.toFixed(1)}x`}</title>
					</circle>
				))}
			</svg>
		</div>
	);
}

/** La curva chica de las tarjetas de ajustes predefinidos. */
export function MiniaturaCurva({ puntos }: { puntos: readonly PuntoCurva[] }) {
	const w = 44;
	const h = 30;
	const aX = (x: number) => 2 + x * (w - 4);
	const aY = (v: number) => 2 + (1 - (Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (h - 4);
	return (
		<svg width={w} height={h} aria-hidden className="overflow-visible">
			<line x1={2} x2={w - 2} y1={aY(1)} y2={aY(1)} className="stroke-(--cc-line-2)" strokeDasharray="2 2" />
			<path d={trazo(puntos, aX, aY)} fill="none" className="stroke-(--cc-text-2)" strokeWidth={1.25} />
		</svg>
	);
}
