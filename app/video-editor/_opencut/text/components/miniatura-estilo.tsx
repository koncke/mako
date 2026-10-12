"use client";

// =============================================================================
// La miniatura de un estilo de texto (efecto, plantilla o predefinido guardado)
// =============================================================================
// Se dibuja con CSS y no con el render del motor: una grilla de 20 tarjetas no
// puede pedir 20 texturas al compositor (que es UNO y comparte el canvas del
// reproductor, hallazgos → «El compositor es UNO…»). El CSS aproxima lo mismo
// con las mismas proporciones que text/estilo.ts:
//   Trazo   `-webkit-text-stroke` (+ `paint-order: stroke fill` para «Fuera»)
//   Sombra  `text-shadow` con el ángulo de CapCut (Y hacia arriba)
//   Brillo  `text-shadow` sin desplazamiento, apilado
//   Curva   no se dibuja: ningún efecto ni plantilla la usa, y un predefinido
//           guardado con curva se ve recto en la tarjeta (en el video, curvo).
//   Fondo   el color con su opacidad y las esquinas en proporción.

import type { CSSProperties } from "react";
import type { ParamValue } from "@/app/video-editor/_opencut/params";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import {
	aplicarMayusculas,
	colorConAlfa,
	leerEstiloTexto,
	leerMayusculas,
	pasadasBrillo,
	pxDesenfoqueSombra,
	pxDistanciaSombra,
	pxIntervaloBrillo,
	pxTrazo,
} from "../estilo";

export function estiloCss(params: Record<string, ParamValue>, tamanoPx: number): CSSProperties {
	const estilo = leerEstiloTexto(params);
	const css: CSSProperties = {
		fontSize: tamanoPx,
		lineHeight: 1.15,
		color: typeof params.color === "string" ? params.color : "#ffffff",
		fontFamily:
			typeof params.fontFamily === "string" && params.fontFamily
				? `"${params.fontFamily.replace(/"/g, "")}", sans-serif`
				: undefined,
		fontWeight: params.fontWeight === "bold" ? 700 : 400,
		fontStyle: params.fontStyle === "italic" ? "italic" : "normal",
		textDecoration: params.textDecoration === "underline" ? "underline" : undefined,
		whiteSpace: "pre",
	};
	if (estilo.trazo) {
		const w = Math.max(0.5, pxTrazo(estilo.trazo.grosor, tamanoPx));
		css.WebkitTextStroke = `${estilo.trazo.posicion === "fuera" ? w * 2 : w}px ${estilo.trazo.color}`;
		if (estilo.trazo.posicion === "fuera") css.paintOrder = "stroke fill";
	}
	const sombras: string[] = [];
	if (estilo.brillo) {
		// El halo, apilado como en el render (text/dibujar.ts → `pasadasBrillo`).
		const { pasadas, alfa } = pasadasBrillo(estilo.brillo.intensidad);
		const halo = `0 0 ${pxIntervaloBrillo(estilo.brillo.intervalo, tamanoPx).toFixed(1)}px ${colorConAlfa(
			estilo.brillo.color,
			alfa,
		)}`;
		for (let i = 0; i < pasadas; i++) sombras.push(halo);
	}
	if (estilo.sombra) {
		const d = pxDistanciaSombra(estilo.sombra.distancia, tamanoPx);
		const rad = (estilo.sombra.angulo * Math.PI) / 180;
		sombras.push(
			`${(Math.cos(rad) * d).toFixed(1)}px ${(-Math.sin(rad) * d).toFixed(1)}px ${pxDesenfoqueSombra(
				estilo.sombra.desenfoque,
				tamanoPx,
			).toFixed(1)}px ${colorConAlfa(estilo.sombra.color, estilo.sombra.opacidad)}`,
		);
	}
	// En CSS la primera sombra de la lista va ARRIBA: la de abajo (el halo) va al final.
	if (sombras.length > 0) css.textShadow = sombras.reverse().join(", ");
	if (params["background.enabled"] === true && typeof params["background.color"] === "string") {
		const radio = typeof params["background.cornerRadius"] === "number" ? params["background.cornerRadius"] : 0;
		css.backgroundColor = colorConAlfa(params["background.color"], estilo.fondoOpacidad);
		css.borderRadius = `${(radio / 100) * 0.6 * tamanoPx}px`;
		css.padding = `${0.12 * tamanoPx}px ${0.35 * tamanoPx}px`;
	}
	return css;
}

export function MiniaturaEstilo({
	params,
	texto = "Aa",
	tamanoPx = 22,
	className,
}: {
	params: Record<string, ParamValue>;
	texto?: string;
	tamanoPx?: number;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex size-full items-center justify-center overflow-hidden bg-(--cc-sunken) p-1.5 select-none",
				className,
			)}
		>
			<span className="max-w-full text-center" style={estiloCss(params, tamanoPx)}>
				{aplicarMayusculas(texto, leerMayusculas(params))}
			</span>
		</div>
	);
}
