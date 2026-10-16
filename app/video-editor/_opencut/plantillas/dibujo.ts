// =============================================================================
// Plantillas: el dibujo de la muestra de un clip y de la miniatura de la pestaña
// =============================================================================
// Dos dibujos en un canvas 2D que llega por parámetro (así se prueban en node con
// un canvas de mentira):
//   · `dibujarMuestraClip`: la imagen que ocupa un hueco de clip sin sustituir
//     (plan §1.4.2): fondo #2b2b2b, borde punteado y el rótulo al centro; el cierre
//     («final», rótulo vacío) es #111111 liso. La guarda ./muestras.ts como PNG de
//     1080x1920, y la miniatura la dibuja igual en su celda: lo que se ve en la
//     tarjeta es lo que queda en la línea de tiempo.
//   · `dibujarMiniatura`: la plantilla en el segundo `t`, con lo que dice
//     ./escena.ts (qué piezas, en qué orden y con qué pose del editor) y la
//     «Máquina de escribir» cortando las letras (`revelado`, text/revelado.ts).
//
// El texto se parte y se mide con la letra de VERDAD de la miniatura (su muestra,
// fonts/muestras.ts), no con la caja estimada de `cajaDeTexto`: con la tarjeta de
// fondo, una caja estimada más angosta que la letra se nota a simple vista. Las
// cuentas de trazo, sombra y radio son las del render (text/estilo.ts,
// text/dibujar.ts) en chico; el brillo y la curva no van (ninguna plantilla los usa).
// Puro, con test (tests/video-editor-plantillas-uso.test.ts).

import { lineasReveladas } from "@/app/video-editor/_opencut/text/revelado";
import { EFECTOS_TEXTO } from "@/app/video-editor/_opencut/text/estilos-predefinidos";
import { TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { LIENZO_REF, MARGEN_TEXTO, type Celda, type PiezaTexto, type Plantilla } from "@/lib/editor-video/plantillas";
import { escenaEn, type PiezaEnEscena } from "./escena";
import { pesoDe, textoVisible } from "./uso";

/** Lo que se usa del canvas 2D (el de la página o un OffscreenCanvas). */
export type Contexto2D = Pick<
	CanvasRenderingContext2D,
	| "save"
	| "restore"
	| "translate"
	| "rotate"
	| "scale"
	| "beginPath"
	| "rect"
	| "clip"
	| "fill"
	| "stroke"
	| "fillRect"
	| "fillText"
	| "strokeText"
	| "measureText"
	| "moveTo"
	| "arcTo"
	| "closePath"
	| "setLineDash"
	| "fillStyle"
	| "strokeStyle"
	| "lineWidth"
	| "lineJoin"
	| "font"
	| "textAlign"
	| "textBaseline"
	| "globalAlpha"
	| "shadowColor"
	| "shadowBlur"
	| "shadowOffsetX"
	| "shadowOffsetY"
>;

export const COLOR_MUESTRA = "#2b2b2b";
export const COLOR_CIERRE = "#111111";
/** La letra del rótulo de una muestra: la del sistema (no hay que cargar nada para dibujarla). */
const LETRA_ROTULO = "system-ui, -apple-system, 'Segoe UI', sans-serif";
/** El interlineado por defecto del motor (timeline/defaults.ts, `lineHeight`). */
const INTERLINEADO = 1.2;

/** La muestra de un hueco de clip en `r` (px del canvas). */
export function dibujarMuestraClip(ctx: Contexto2D, rotulo: string, r: Celda): void {
	ctx.save();
	ctx.fillStyle = rotulo ? COLOR_MUESTRA : COLOR_CIERRE;
	ctx.fillRect(r.x, r.y, r.ancho, r.alto);
	if (rotulo) {
		const lado = Math.min(r.ancho, r.alto);
		const margen = lado * 0.06;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
		ctx.lineWidth = Math.max(1, lado * 0.008);
		ctx.setLineDash([lado * 0.035, lado * 0.025]);
		ctx.beginPath();
		ctx.rect(r.x + margen, r.y + margen, r.ancho - 2 * margen, r.alto - 2 * margen);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
		ctx.font = `600 ${Math.round(lado * 0.085 * 10) / 10}px ${LETRA_ROTULO}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(rotulo, r.x + r.ancho / 2, r.y + r.alto / 2);
	}
	ctx.restore();
}

function rectRedondeado(ctx: Contexto2D, x: number, y: number, w: number, h: number, radio: number): void {
	const r = Math.max(0, Math.min(radio, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/** #rrggbb + una opacidad 0–1 → rgba. Un color que no es hex queda como está. */
function conAlfa(color: string, alfa: number): string {
	const m = /^#([0-9a-f]{6})$/i.exec(color);
	if (!m || alfa >= 1) return color;
	const n = parseInt(m[1], 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, alfa)})`;
}

/** Parte por palabras como partirEnLineas: una palabra que no entra baja entera. */
function partir(texto: string, ancho: (s: string) => number, disponible: number): string[] {
	const lineas: string[] = [];
	for (const palabra of texto.trim().split(/\s+/).filter(Boolean)) {
		const ultima = lineas[lineas.length - 1];
		if (ultima !== undefined && ancho(`${ultima} ${palabra}`) <= disponible) lineas[lineas.length - 1] = `${ultima} ${palabra}`;
		else lineas.push(palabra);
	}
	return lineas.length ? lineas : [""];
}

const num = (v: unknown, otro: number) => (typeof v === "number" && Number.isFinite(v) ? v : otro);

function dibujarTexto(
	ctx: Contexto2D,
	e: PiezaEnEscena & { pieza: PiezaTexto },
	k: number,
	ancho: number,
	familia: (fuente: string, peso: number) => string,
): void {
	const { pieza, pose, revelado } = e;
	const { estilo, ancla } = pieza;
	const efecto: ParamValues = EFECTOS_TEXTO.find((x) => x.id === estilo.efecto)?.params ?? {};
	const px = estilo.px * k;
	const peso = pesoDe(pieza);
	ctx.font = `${estilo.cursiva ? "italic " : ""}${peso} ${Math.round(px * 100) / 100}px ${familia(estilo.fuente, peso)}`;
	const medir = (s: string) => ctx.measureText(s).width;
	const lineas = partir(textoVisible(pieza), medir, ancho * (1 - 2 * MARGEN_TEXTO));
	const [rx, ry] = estilo.relleno ?? [0, 0];
	const w = Math.max(...lineas.map(medir)) + 2 * rx * px;
	const h = lineas.length * px * INTERLINEADO + 2 * ry * px;
	// La caja entera (con la tarjeta) va donde dice el ancla, como partirYUbicar.
	const x = estilo.alineacion === "izquierda" ? ancho * MARGEN_TEXTO : (ancho - w) / 2;
	const yAncla = ancla.y * k;
	const y = ancla.borde === "arriba" ? yAncla : ancla.borde === "centro" ? yAncla - h / 2 : yAncla - h;

	const alfa = Math.max(0, Math.min(1, pose.opacidad * (estilo.opacidad ?? 1)));
	if (alfa <= 0) return;
	ctx.save();
	ctx.globalAlpha = alfa;
	// La pose gira y escala alrededor del centro de la caja (como el motor).
	ctx.translate(x + w / 2 + pose.dx * ancho, y + h / 2 + pose.dy * (ancho * (LIENZO_REF.alto / LIENZO_REF.ancho)));
	if (pose.giro) ctx.rotate((pose.giro * Math.PI) / 180);
	ctx.scale(pose.escala * pose.escalaX, pose.escala * pose.escalaY);
	ctx.translate(-w / 2, -h / 2);

	if (efecto["background.enabled"] === true) {
		ctx.fillStyle = conAlfa(String(efecto["background.color"] ?? "#000000"), num(efecto[TEXTO.fondoOpacidad], 100) / 100);
		rectRedondeado(ctx, 0, 0, w, h, (Math.min(w, h) / 2) * (num(efecto["background.cornerRadius"], 0) / 100));
		ctx.fill();
	}
	if (efecto[TEXTO.sombraActiva] === true) {
		const d = (num(efecto[TEXTO.sombraDistancia], 5) / 100) * px;
		const rad = (num(efecto[TEXTO.sombraAngulo], -45) * Math.PI) / 180;
		ctx.shadowColor = conAlfa(String(efecto[TEXTO.sombraColor] ?? "#000000"), num(efecto[TEXTO.sombraOpacidad], 90) / 100);
		ctx.shadowBlur = (num(efecto[TEXTO.sombraDesenfoque], 45) / 100) * 0.3 * px;
		ctx.shadowOffsetX = Math.cos(rad) * d;
		ctx.shadowOffsetY = -Math.sin(rad) * d;
	}
	const visibles = lineasReveladas(lineas, revelado);
	ctx.textBaseline = "middle";
	ctx.textAlign = estilo.alineacion === "izquierda" ? "left" : "center";
	ctx.lineJoin = "round";
	const xLetra = estilo.alineacion === "izquierda" ? rx * px : w / 2;
	const trazo = efecto[TEXTO.trazoActivo] === true;
	visibles.forEach((linea, i) => {
		if (!linea) return;
		const yLinea = ry * px + (i + 0.5) * px * INTERLINEADO;
		if (trazo) {
			// «Fuera» del render: el doble de ancho, detrás del relleno.
			ctx.strokeStyle = String(efecto[TEXTO.trazoColor] ?? "#000000");
			ctx.lineWidth = (num(efecto[TEXTO.trazoGrosor], 20) / 100) * 0.2 * px * 2;
			ctx.strokeText(linea, xLetra, yLinea);
		}
		ctx.fillStyle = String(efecto.color ?? "#ffffff");
		ctx.fillText(linea, xLetra, yLinea);
	});
	ctx.restore();
}

/**
 * La plantilla en el segundo `t`, en un canvas de `ancho` px (el alto es 16/9 del
 * ancho). `familia` da el `font-family` del CSS de cada fuente: la muestra si ya
 * llegó, si no la de respaldo.
 */
export function dibujarMiniatura(
	ctx: Contexto2D,
	{
		plantilla,
		t,
		ancho,
		familia,
	}: { plantilla: Plantilla; t: number; ancho: number; familia: (fuente: string, peso: number) => string },
): void {
	const k = ancho / LIENZO_REF.ancho;
	const alto = LIENZO_REF.alto * k;
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, ancho, alto);
	for (const e of escenaEn(plantilla, t)) {
		if (e.pieza.tipo === "texto") {
			dibujarTexto(ctx, e as PiezaEnEscena & { pieza: PiezaTexto }, k, ancho, familia);
			continue;
		}
		const { pose } = e;
		const alfa = Math.max(0, Math.min(1, pose.opacidad));
		if (alfa <= 0) continue;
		const r: Celda = { x: e.rect.x * k, y: e.rect.y * k, ancho: e.rect.ancho * k, alto: e.rect.alto * k };
		ctx.save();
		ctx.globalAlpha = alfa;
		ctx.translate(r.x + r.ancho / 2 + pose.dx * ancho, r.y + r.alto / 2 + pose.dy * alto);
		if (pose.giro) ctx.rotate((pose.giro * Math.PI) / 180);
		ctx.scale(pose.escala * pose.escalaX, pose.escala * pose.escalaY);
		const local: Celda = { x: -r.ancho / 2, y: -r.alto / 2, ancho: r.ancho, alto: r.alto };
		if (e.pieza.tipo === "clip") {
			// La celda recorta (cubrir), como el recorte del clip en el motor.
			ctx.beginPath();
			ctx.rect(local.x, local.y, local.ancho, local.alto);
			ctx.clip();
			dibujarMuestraClip(ctx, e.pieza.hueco.rotulo, local);
		} else {
			ctx.fillStyle = e.pieza.relleno;
			ctx.fillRect(local.x, local.y, local.ancho, local.alto);
		}
		ctx.restore();
	}
	ctx.restore();
}
