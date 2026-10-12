// =============================================================================
// Los ganchos del render de «Recortar» y «Reflejar»
// =============================================================================
// · Recortar (gancho de FUENTE): antes de subir el cuadro, se queda con el
//   rectángulo de `recorte.*`. La fuente recortada sale con su propio tamaño, y
//   el compositor la vuelve a encajar en el lienzo como a cualquier fuente: igual
//   que en CapCut, lo recortado se agranda hasta llenar lo que llenaba el clip.
// · Reflejar (gancho VISUAL): escala negativa en X (o Y). El compositor la lee
//   como volteo (frame-descriptor: `flipX: scaledWidth < 0`). Corre después de
//   las animaciones (orden 1000): una que acote la escala a un mínimo positivo
//   (MIN_TRANSFORM_SCALE) se comería el signo si corriera después. Detrás sólo
//   van las transiciones (1100), que leen ese signo y no lo tocan.
//
// Lo importa commands/timeline/element/operaciones-clip.tsx (y ese, ce/extensiones.ts).

import {
	registrarGanchoFuente,
	registrarGanchoVisual,
} from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import {
	REFLEJO_HORIZONTAL,
	REFLEJO_VERTICAL,
} from "@/app/video-editor/_opencut/params/extra/reflejo";
import { esRectCompleto, rectDeParams } from "./geometria";

// ── Recortar ─────────────────────────────────────────────────────────────────

type Lienzo = OffscreenCanvas | HTMLCanvasElement;

function crearLienzo(w: number, h: number): Lienzo {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

// DOS lienzos por clip, alternados. El compositor (wasm-compositor.ts,
// syncExternalTexture) NO vuelve a subir una textura si la fuente es el MISMO
// objeto que en el cuadro anterior: con un solo lienzo reusado, el video
// recortado se quedaría congelado en el primer cuadro. Alternando, cuadros
// seguidos traen objetos distintos. Para una IMAGEN sí conviene lo contrario:
// si nada cambió se devuelve el mismo lienzo y el compositor se ahorra la subida.
type Entrada = { lienzos: Lienzo[]; turno: number; fuente: unknown; clave: string };
const porClip = new Map<string, Entrada>();

function lienzoPara(entrada: Entrada, w: number, h: number): Lienzo {
	entrada.turno = (entrada.turno + 1) % 2;
	let lienzo = entrada.lienzos[entrada.turno];
	if (!lienzo) {
		lienzo = crearLienzo(w, h);
		entrada.lienzos[entrada.turno] = lienzo;
	}
	if (lienzo.width !== w || lienzo.height !== h) {
		lienzo.width = w;
		lienzo.height = h;
	}
	return lienzo;
}

registrarGanchoFuente({
	id: "ce-recorte",
	orden: 10,
	aplicar: (fuente, ctx) => {
		if (ctx.tipo !== "video" && ctx.tipo !== "image") return null;
		const rect = rectDeParams(ctx.params);
		if (esRectCompleto(rect)) return null;

		const sx = Math.round(rect.x * fuente.width);
		const sy = Math.round(rect.y * fuente.height);
		const sw = Math.max(1, Math.min(fuente.width - sx, Math.round(rect.ancho * fuente.width)));
		const sh = Math.max(1, Math.min(fuente.height - sy, Math.round(rect.alto * fuente.height)));
		const idClip = ctx.elementoId ?? "sin-id";
		const clave = `${sx}:${sy}:${sw}:${sh}`;

		let entrada = porClip.get(idClip);
		if (
			entrada &&
			ctx.tipo === "image" &&
			entrada.fuente === fuente.source &&
			entrada.clave === clave
		) {
			const actual = entrada.lienzos[entrada.turno];
			if (actual) return { source: actual as CanvasImageSource, width: sw, height: sh };
		}
		if (!entrada) {
			entrada = { lienzos: [], turno: 0, fuente: null, clave: "" };
			porClip.set(idClip, entrada);
			// Tope: los clips borrados no deberían dejar lienzos colgados para siempre.
			if (porClip.size > 48) {
				const primero = porClip.keys().next().value;
				if (primero !== undefined && primero !== idClip) porClip.delete(primero);
			}
		}
		const lienzo = lienzoPara(entrada, sw, sh);
		const c2d = lienzo.getContext("2d") as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D
			| null;
		if (!c2d) return null;
		c2d.clearRect(0, 0, sw, sh);
		c2d.drawImage(fuente.source, sx, sy, sw, sh, 0, 0, sw, sh);
		entrada.fuente = fuente.source;
		entrada.clave = clave;
		return { source: lienzo as CanvasImageSource, width: sw, height: sh };
	},
});

// ── Reflejar ─────────────────────────────────────────────────────────────────

registrarGanchoVisual({
	id: "ce-reflejo",
	orden: 1000,
	aplicar: (estado, ctx) => {
		const horizontal = ctx.params[REFLEJO_HORIZONTAL] === true;
		const vertical = ctx.params[REFLEJO_VERTICAL] === true;
		if (!horizontal && !vertical) return estado;
		return {
			...estado,
			transform: {
				...estado.transform,
				scaleX: horizontal ? -estado.transform.scaleX : estado.transform.scaleX,
				scaleY: vertical ? -estado.transform.scaleY : estado.transform.scaleY,
			},
		};
	},
});
