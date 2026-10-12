// =============================================================================
// Las dos escenas de muestra de las miniaturas de transiciones
// =============================================================================
// Las miniaturas de CapCut son videos de ByteDance (no se copian). Acá cada
// tarjeta corre LA MISMA transición que el render (catálogo + pases `ce-tr-*`)
// entre dos escenas dibujadas: A, un atardecer cálido; B, una noche fría. Tienen
// que distinguirse de un vistazo, también en gris (luz contra oscuridad).
// Los colores son contenido de la imagen, no del tema: por eso viven acá y no en
// un componente (la regla de los `--cc-*` es para la interfaz).

import { aplicarPasesCe } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import type { EstadoVisual } from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import { aplicarTransiciones } from "./gancho";
import { TR_ENTRA_DURACION, TR_ENTRA_ID, TR_SALE_DURACION, TR_SALE_ID } from "./claves";

export const LADO_MUESTRA = 160;

let escenas: { a: OffscreenCanvas; b: OffscreenCanvas } | null = null;

function lienzo(): { c: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } | null {
	const c = new OffscreenCanvas(LADO_MUESTRA, LADO_MUESTRA);
	const ctx = c.getContext("2d");
	return ctx ? { c, ctx } : null;
}

function atardecer(): OffscreenCanvas | null {
	const l = lienzo();
	if (!l) return null;
	const { c, ctx } = l;
	const s = LADO_MUESTRA;
	const cielo = ctx.createLinearGradient(0, 0, 0, s);
	cielo.addColorStop(0, "#f7b267");
	cielo.addColorStop(0.55, "#f4845f");
	cielo.addColorStop(1, "#c4456c");
	ctx.fillStyle = cielo;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = "#fff1c1";
	ctx.beginPath();
	ctx.arc(s * 0.62, s * 0.5, s * 0.16, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#5b2a4e";
	ctx.beginPath();
	ctx.moveTo(0, s * 0.72);
	ctx.lineTo(s * 0.28, s * 0.52);
	ctx.lineTo(s * 0.5, s * 0.7);
	ctx.lineTo(s * 0.74, s * 0.56);
	ctx.lineTo(s, s * 0.74);
	ctx.lineTo(s, s);
	ctx.lineTo(0, s);
	ctx.closePath();
	ctx.fill();
	return c;
}

function noche(): OffscreenCanvas | null {
	const l = lienzo();
	if (!l) return null;
	const { c, ctx } = l;
	const s = LADO_MUESTRA;
	const cielo = ctx.createLinearGradient(0, 0, 0, s);
	cielo.addColorStop(0, "#0b1d3a");
	cielo.addColorStop(1, "#1f6f8b");
	ctx.fillStyle = cielo;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = "#e8f6ff";
	for (let i = 0; i < 28; i++) {
		const x = ((i * 47) % 100) / 100;
		const y = ((i * 29) % 55) / 100;
		ctx.fillRect(x * s, y * s, 1.6, 1.6);
	}
	ctx.beginPath();
	ctx.arc(s * 0.28, s * 0.26, s * 0.1, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#081426";
	const edificios = [0.18, 0.34, 0.24, 0.46, 0.3, 0.4, 0.22];
	const ancho = s / edificios.length;
	edificios.forEach((alto, i) => ctx.fillRect(i * ancho, s * (1 - alto), ancho - 2, s * alto));
	ctx.fillStyle = "#ffd36b";
	edificios.forEach((alto, i) => {
		for (let y = s * (1 - alto) + 6; y < s - 6; y += 10) ctx.fillRect(i * ancho + 5, y, 3, 3);
	});
	return c;
}

/** Las dos escenas (se dibujan una vez). `null` sin OffscreenCanvas (server, node). */
export function escenasMuestra(): { a: OffscreenCanvas; b: OffscreenCanvas } | null {
	if (escenas) return escenas;
	if (typeof OffscreenCanvas === "undefined") return null;
	const a = atardecer();
	const b = noche();
	if (!a || !b) return null;
	escenas = { a, b };
	return escenas;
}

const IDENTIDAD: EstadoVisual = {
	transform: { scaleX: 1, scaleY: 1, position: { x: 0, y: 0 }, rotate: 0 },
	opacity: 1,
};

/**
 * Dibuja el progreso `p` de la transición `id`. Con una duración de 1 s y el
 * corte en el segundo 1: A es el clip [0, 1) y B el [1, 2), así `p` se vuelve un
 * instante de cada clip y pasa por el MISMO camino que el render.
 */
export function dibujarMuestra(ctx: CanvasRenderingContext2D, id: string, p: number) {
	const escenas = escenasMuestra();
	const s = LADO_MUESTRA;
	ctx.clearRect(0, 0, s, s);
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, s, s);
	if (!escenas) return;
	const lienzo = { width: s, height: s };
	const instante = p - 0.5; // segundos desde el corte
	const capas: Array<{ fuente: OffscreenCanvas; estado: EstadoVisual }> = [
		{
			fuente: escenas.a,
			estado: aplicarTransiciones(IDENTIDAD, {
				params: { [TR_SALE_ID]: id, [TR_SALE_DURACION]: 1 },
				tiempo: 1 + instante,
				duracion: 1,
				lienzo,
			}),
		},
		{
			fuente: escenas.b,
			estado: aplicarTransiciones(IDENTIDAD, {
				params: { [TR_ENTRA_ID]: id, [TR_ENTRA_DURACION]: 1 },
				tiempo: instante,
				duracion: 1,
				lienzo,
			}),
		},
	];
	for (const { fuente, estado } of capas) {
		if (estado.opacity <= 0) continue;
		const imagen =
			estado.pases && estado.pases.length > 0
				? aplicarPasesCe({ source: fuente, width: s, height: s, passes: estado.pases })
				: fuente;
		const t = estado.transform;
		ctx.save();
		ctx.globalAlpha = Math.min(1, estado.opacity);
		ctx.translate(s / 2 + t.position.x, s / 2 + t.position.y);
		ctx.rotate((t.rotate * Math.PI) / 180);
		ctx.scale(t.scaleX, t.scaleY);
		ctx.drawImage(imagen, -s / 2, -s / 2, s, s);
		ctx.restore();
	}
}
