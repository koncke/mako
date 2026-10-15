// =============================================================================
// El dibujo de un texto con el estilo de CapCut: fondo, trazo, sombra, brillo,
// curva y revelado
// =============================================================================
// Reemplaza a `drawMeasuredTextLayout` (./primitives.ts) en el render del texto
// (services/renderer/nodes/text-node.ts); aquél queda para la máscara de texto,
// que sólo necesita la forma de las letras.
//
// Orden de las capas, como CapCut:
//   1. el Fondo (con su «Opacidad»);
//   2. el Brillo: el halo SOLO, sin las letras (ver abajo);
//   3. la Sombra, que es la de las letras CON su trazo (no la del fondo);
//   4. el Trazo «Fuera» (debajo del relleno: lo que asoma es sólo lo de afuera);
//   5. el relleno y el subrayado;
//   6. el Trazo «Centro» (encima, mitad adentro y mitad afuera);
//   7. el Trazo «Dentro» (encima, recortado a la letra con `source-atop`).
//
// Los pasos 2, 3 y 7 necesitan las letras SOLAS en un lienzo aparte: la sombra
// se saca de ese lienzo con un único `drawImage` (si se le pusiera sombra al
// trazo y al relleno por separado, se oscurecería dos veces donde se pisan), y
// el `source-atop` del trazo de adentro recortaría también el fondo si se
// hiciera en el lienzo de la textura. Sin sombra, brillo ni trazo de adentro (lo
// común) se dibuja directo, sin lienzo extra.
//
// El Brillo es una sombra sin desplazamiento, pero NO se puede dibujar como la
// sombra (letras + halo de una vez): con Brillo Y Sombra las letras saldrían dos
// veces y la sombra caería encima del primer juego. Se dibuja sólo el halo con
// el truco de siempre de canvas: la imagen va FUERA del lienzo y la sombra,
// corrida exactamente un lienzo, cae en su lugar.
//
// La «Curva» pone cada letra girada en su lugar del arco (posiciones que ya
// calculó la medida, ./curva.ts); el resto de las capas no cambia.
//
// Las «Animaciones de subtítulos» (karaoke, ./resaltado.ts) pintan cada palabra
// con su color: recta, cada palabra va sola donde caería en el renglón entero (el
// ancho del prefijo); curvada, cada letra sabe de qué palabra es. Lo que todavía
// no se dijo, con «Opacidad» < 100, se dibuja ENTERO (trazo y relleno) en otro
// lienzo aparte y se pega con esa opacidad: con la opacidad en cada pasada, el
// trazo de afuera se vería a través del relleno. Sin resaltado, el camino es el de
// siempre (`recorrer` por renglón), sin piezas ni medidas de más.
//
// ⚠️ `shadowOffset*` y `shadowBlur` de canvas NO siguen la transformación del
// contexto (van en píxeles del lienzo de destino): el desplazamiento se pasa a
// mano por la matriz, así la sombra gira y escala con el texto.

import type { TextCanvasContext } from "./layout";
import { drawTextDecoration, getTextBackgroundRect, setCanvasLetterSpacing } from "./layout";
import { CORNER_RADIUS_MAX, CORNER_RADIUS_MIN } from "./background";
import type { MeasuredTextElement } from "./measure-element";
import type { TextAlign } from "./primitives";
import {
	colorConAlfa,
	pasadasBrillo,
	pxDesenfoqueSombra,
	pxDistanciaSombra,
	pxIntervaloBrillo,
	pxTrazo,
} from "./estilo";
import { letrasVisibles } from "./curva";
import { lineasReveladas } from "./revelado";
import {
	palabraDeCadaLetra,
	palabrasDeRenglon,
	primerasPalabras,
	vaResaltada,
	type ResaltadoTexto,
} from "./resaltado";

// ── Los lienzos aparte ───────────────────────────────────────────────────────

type Lienzo2D = OffscreenCanvas | HTMLCanvasElement;
/** Las letras solas, para la sombra, el brillo y el trazo de adentro. */
let capa: Lienzo2D | null = null;
/** Lo que todavía no se dijo, para pegarlo con su opacidad (resaltado). */
let grupo: Lienzo2D | null = null;

function nuevoLienzo(ancho: number, alto: number): Lienzo2D | null {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(ancho, alto);
	if (typeof document !== "undefined") return document.createElement("canvas");
	return null;
}

function limpio(lienzo: Lienzo2D, ancho: number, alto: number): TextCanvasContext | null {
	if (lienzo.width !== ancho) lienzo.width = ancho;
	if (lienzo.height !== alto) lienzo.height = alto;
	const c = lienzo.getContext("2d") as TextCanvasContext | null;
	if (!c) return null;
	c.setTransform(1, 0, 0, 1, 0, 0);
	c.clearRect(0, 0, ancho, alto);
	c.globalCompositeOperation = "source-over";
	return c;
}

function capaDe(ancho: number, alto: number): TextCanvasContext | null {
	capa ??= nuevoLienzo(ancho, alto);
	return capa ? limpio(capa, ancho, alto) : null;
}

function grupoDe(ancho: number, alto: number): TextCanvasContext | null {
	grupo ??= nuevoLienzo(ancho, alto);
	return grupo ? limpio(grupo, ancho, alto) : null;
}

// ── Las letras ───────────────────────────────────────────────────────────────

/** Dónde empieza una línea de `ancho` px con la alineación dada (x = 0 es el ancla). */
function inicioDeLinea(alineacion: TextAlign, ancho: number): number {
	if (alineacion === "center") return -ancho / 2;
	if (alineacion === "right") return -ancho;
	return 0;
}

type Linea = { indice: number; texto: string; completa: boolean; y: number; metrica: TextMetrics };

/**
 * Pone `texto` donde iría si la línea estuviera entera: una línea a medio
 * escribir con alineación centrada NO se re-centra (las letras no bailan).
 */
function conLinea(
	c: TextCanvasContext,
	medido: MeasuredTextElement,
	linea: Linea,
	dibujar: (x: number) => void,
) {
	if (linea.completa) {
		c.textAlign = medido.textAlign;
		dibujar(0);
		return;
	}
	c.textAlign = "left";
	dibujar(inicioDeLinea(medido.textAlign, linea.metrica.width));
}

/**
 * Pasa cada renglón visible por `pintar(texto, x, y)` (un `fillText` o un
 * `strokeText`): recto con su alineación, o letra por letra sobre el arco.
 */
function recorrer(
	c: TextCanvasContext,
	medido: MeasuredTextElement,
	lineas: Linea[],
	pintar: (texto: string, x: number, y: number) => void,
) {
	const { arco } = medido;
	if (!arco) {
		for (const l of lineas) conLinea(c, medido, l, (x) => pintar(l.texto, x, l.y));
		return;
	}
	c.textAlign = "center";
	for (const l of lineas) {
		const renglon = arco[l.indice];
		if (!renglon) continue;
		const letras = l.completa ? renglon : letrasVisibles(renglon, Array.from(l.texto).length);
		for (const letra of letras) {
			c.save();
			c.translate(letra.x, letra.y);
			c.rotate(letra.giro);
			pintar(letra.letra, 0, 0);
			c.restore();
		}
	}
}

// ── Las palabras sueltas (resaltado) ─────────────────────────────────────────

/** Lo que se pinta solo con el resaltado: una palabra (recto) o una letra (curvado). */
type Pieza = { texto: string; x: number; y: number; giro: number | null; palabra: number };

/**
 * Las piezas de los renglones visibles. Recto, cada palabra va donde caería en el
 * renglón entero: el inicio del renglón (el mismo de `conLinea`, así una línea a
 * medio escribir tampoco se re-centra) más el ancho de lo que la precede, medido
 * como «hasta el fin de la palabra − la palabra» (así da igual si el navegador
 * cuenta el espaciado de la última letra, y el interletrado con el espacio queda).
 */
function armarPiezas(c: TextCanvasContext, medido: MeasuredTextElement, lineas: Linea[]): Pieza[] {
	const primeras = primerasPalabras(medido.lines);
	const piezas: Pieza[] = [];
	if (medido.arco) {
		for (const l of lineas) {
			const renglon = medido.arco[l.indice];
			if (!renglon) continue;
			const letras = l.completa ? renglon : letrasVisibles(renglon, Array.from(l.texto).length);
			const palabras = palabraDeCadaLetra(letras.map((x) => x.letra), primeras[l.indice] ?? 0);
			letras.forEach((letra, k) => {
				if (palabras[k] >= 0) piezas.push({ texto: letra.letra, x: letra.x, y: letra.y, giro: letra.giro, palabra: palabras[k] });
			});
		}
		return piezas;
	}
	c.save();
	c.font = medido.fontString;
	setCanvasLetterSpacing({ ctx: c, letterSpacingPx: medido.letterSpacing });
	for (const l of lineas) {
		const x0 = inicioDeLinea(medido.textAlign, l.metrica.width);
		for (const p of palabrasDeRenglon(l.texto, primeras[l.indice] ?? 0)) {
			const antes =
				p.desde === 0 ? 0 : c.measureText(l.texto.slice(0, p.desde + p.texto.length)).width - c.measureText(p.texto).width;
			piezas.push({ texto: p.texto, x: x0 + antes, y: l.y, giro: null, palabra: p.palabra });
		}
	}
	c.restore();
	return piezas;
}

/** Como `recorrer`, pero pieza por pieza (con el número de palabra de cada una). */
function recorrerPiezas(
	c: TextCanvasContext,
	piezas: readonly Pieza[],
	pintar: (texto: string, x: number, y: number, palabra: number) => void,
) {
	for (const p of piezas) {
		if (p.giro === null) {
			c.textAlign = "left";
			pintar(p.texto, p.x, p.y, p.palabra);
			continue;
		}
		c.textAlign = "center";
		c.save();
		c.translate(p.x, p.y);
		c.rotate(p.giro);
		pintar(p.texto, 0, 0, p.palabra);
		c.restore();
	}
}

type ConResaltado = {
	piezas: readonly Pieza[];
	colorDe: (palabra: number) => string;
	/** El subrayado va una sola vez (con lo dicho), no en cada grupo. */
	subrayar: boolean;
};

function dibujarLetras(
	c: TextCanvasContext,
	medido: MeasuredTextElement,
	lineas: Linea[],
	textColor: string,
	textBaseline: CanvasTextBaseline,
	enCapa: boolean,
	resaltado?: ConResaltado,
) {
	const { trazo } = medido.estilo;
	const w = trazo ? pxTrazo(trazo.grosor, medido.scaledFontSize) : 0;
	c.font = medido.fontString;
	c.textBaseline = textBaseline;
	c.lineJoin = "round";
	c.lineCap = "round";
	c.miterLimit = 2;
	// Curvado, el espaciado ya está en las posiciones de las letras (./curva.ts).
	setCanvasLetterSpacing({ ctx: c, letterSpacingPx: medido.arco ? 0 : medido.letterSpacing });

	const trazar = (lineWidth: number) => {
		if (!trazo) return;
		c.strokeStyle = trazo.color;
		c.lineWidth = lineWidth;
		if (resaltado) recorrerPiezas(c, resaltado.piezas, (t, x, y) => c.strokeText(t, x, y));
		else recorrer(c, medido, lineas, (t, x, y) => c.strokeText(t, x, y));
	};

	// 4. Trazo «Fuera»: el doble de ancho, debajo del relleno.
	if (trazo?.posicion === "fuera") trazar(w * 2);

	// 5. Relleno y subrayado (un texto curvado no tiene subrayado: ver estilo.ts).
	c.fillStyle = textColor;
	if (resaltado) {
		const { colorDe } = resaltado;
		recorrerPiezas(c, resaltado.piezas, (t, x, y, palabra) => {
			c.fillStyle = colorDe(palabra);
			c.fillText(t, x, y);
		});
		c.fillStyle = textColor;
	} else {
		recorrer(c, medido, lineas, (t, x, y) => c.fillText(t, x, y));
	}
	if (medido.textDecoration !== "none" && !medido.arco && (!resaltado || resaltado.subrayar)) {
		for (const l of lineas) {
			const ancho = l.completa ? l.metrica.width : c.measureText(l.texto).width;
			c.save();
			c.translate(l.completa ? 0 : inicioDeLinea(medido.textAlign, l.metrica.width), 0);
			drawTextDecoration({
				ctx: c,
				textDecoration: medido.textDecoration,
				lineWidth: ancho,
				lineY: l.y,
				metrics: l.metrica,
				scaledFontSize: medido.scaledFontSize,
				textAlign: l.completa ? medido.textAlign : "left",
			});
			c.restore();
		}
	}

	// 6. Trazo «Centro»: encima, mitad sobre la letra.
	if (trazo?.posicion === "centro") trazar(w);

	// 7. Trazo «Dentro»: el doble de ancho, recortado a lo ya pintado (sólo en
	// la capa aparte, donde lo pintado son las letras y nada más).
	if (trazo?.posicion === "dentro") {
		if (enCapa) {
			c.globalCompositeOperation = "source-atop";
			trazar(w * 2);
			c.globalCompositeOperation = "source-over";
		} else {
			trazar(w);
		}
	}
}

/**
 * Las letras con el resaltado, sobre `d` (el lienzo de la textura o la capa de las
 * letras). Con «Opacidad» de lo no dicho en 100 (lo común) es UNA pasada con el color
 * de cada palabra. Si no, lo no dicho va primero, entero en el lienzo `grupo` y pegado
 * con su opacidad, y lo dicho encima: la palabra que se dice queda nítida.
 */
function dibujarResaltado(
	d: TextCanvasContext,
	medido: MeasuredTextElement,
	lineas: Linea[],
	textColor: string,
	textBaseline: CanvasTextBaseline,
	enCapa: boolean,
	res: ResaltadoTexto,
) {
	const piezas = armarPiezas(d, medido, lineas);
	const colorDe = (palabra: number) => (vaResaltada(res, palabra) ? res.color : textColor);
	if (res.noDichas >= 1) {
		dibujarLetras(d, medido, lineas, textColor, textBaseline, enCapa, { piezas, colorDe, subrayar: true });
		return;
	}
	const dichas = piezas.filter((p) => p.palabra < res.dichas);
	const noDichas = piezas.filter((p) => p.palabra >= res.dichas);
	if (noDichas.length > 0 && res.noDichas > 0) {
		const g = grupoDe(d.canvas.width, d.canvas.height);
		if (g && grupo) {
			g.setTransform(d.getTransform());
			// En su lienzo, lo pintado son sólo estas letras: el trazo de adentro recorta bien.
			dibujarLetras(g, medido, lineas, textColor, textBaseline, true, { piezas: noDichas, colorDe, subrayar: false });
			d.save();
			d.setTransform(1, 0, 0, 1, 0, 0);
			d.globalAlpha *= res.noDichas;
			d.drawImage(grupo as CanvasImageSource, 0, 0);
			d.restore();
		} else {
			// Sin lienzo aparte, la opacidad en cada pasada (el trazo asoma por el relleno).
			d.save();
			d.globalAlpha *= res.noDichas;
			dibujarLetras(d, medido, lineas, textColor, textBaseline, enCapa, { piezas: noDichas, colorDe, subrayar: false });
			d.restore();
		}
	}
	dibujarLetras(d, medido, lineas, textColor, textBaseline, enCapa, { piezas: dichas, colorDe, subrayar: true });
}

// ── La entrada ───────────────────────────────────────────────────────────────

export function dibujarTextoCe({
	ctx,
	medido,
	textColor,
	backgroundColor,
	textBaseline = "middle",
}: {
	ctx: TextCanvasContext;
	medido: MeasuredTextElement;
	textColor: string;
	backgroundColor: string;
	textBaseline?: CanvasTextBaseline;
}): void {
	const { estilo } = medido;
	const fondo = medido.resolvedBackground;
	if (medido.lines.length === 0) return;

	// 1. Fondo. CapCut lo dibuja entero aunque el texto se esté escribiendo.
	if (fondo.enabled && backgroundColor && backgroundColor !== "transparent" && estilo.fondoOpacidad > 0) {
		const rect = getTextBackgroundRect({
			textAlign: medido.textAlign,
			block: medido.block,
			background: { ...fondo, color: backgroundColor },
			fontSizeRatio: medido.fontSizeRatio,
		});
		if (rect) {
			const p = Math.min(CORNER_RADIUS_MAX, Math.max(CORNER_RADIUS_MIN, fondo.cornerRadius)) / 100;
			ctx.fillStyle = colorConAlfa(backgroundColor, estilo.fondoOpacidad);
			ctx.beginPath();
			ctx.roundRect(rect.left, rect.top, rect.width, rect.height, (Math.min(rect.width, rect.height) / 2) * p);
			ctx.fill();
		}
	}

	const visibles = lineasReveladas(medido.lines, medido.revelado);
	const lineas: Linea[] = [];
	visibles.forEach((texto, i) => {
		if (!texto) return;
		lineas.push({
			indice: i,
			texto,
			completa: texto === medido.lines[i],
			y: i * medido.lineHeightPx - medido.block.visualCenterOffset,
			metrica: medido.lineMetrics[i],
		});
	});
	if (lineas.length === 0) return;

	const { sombra, brillo } = estilo;
	const res = medido.resaltado;
	const necesitaCapa = sombra !== null || brillo !== null || estilo.trazo?.posicion === "dentro";
	const c = necesitaCapa ? capaDe(ctx.canvas.width, ctx.canvas.height) : null;
	if (!c || !capa) {
		if (res) dibujarResaltado(ctx, medido, lineas, textColor, textBaseline, false, res);
		else dibujarLetras(ctx, medido, lineas, textColor, textBaseline, false);
		return;
	}

	const m = ctx.getTransform();
	c.setTransform(m);
	if (res) dibujarResaltado(c, medido, lineas, textColor, textBaseline, true, res);
	else dibujarLetras(c, medido, lineas, textColor, textBaseline, true);

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const escala = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
	if (brillo) {
		// 2. Brillo: sólo el halo (la imagen, un lienzo a la izquierda; su sombra, en su lugar).
		const ancho = ctx.canvas.width;
		const { pasadas, alfa } = pasadasBrillo(brillo.intensidad);
		ctx.shadowColor = colorConAlfa(brillo.color, alfa);
		ctx.shadowBlur = pxIntervaloBrillo(brillo.intervalo, medido.scaledFontSize) * escala;
		ctx.shadowOffsetX = ancho;
		ctx.shadowOffsetY = 0;
		for (let i = 0; i < pasadas; i++) ctx.drawImage(capa as CanvasImageSource, -ancho, 0);
	}
	if (sombra) {
		// 3. Sombra: el ángulo de CapCut va con Y hacia arriba (−45° = abajo a la derecha).
		const d = pxDistanciaSombra(sombra.distancia, medido.scaledFontSize);
		const rad = (sombra.angulo * Math.PI) / 180;
		const lx = Math.cos(rad) * d;
		const ly = -Math.sin(rad) * d;
		ctx.shadowColor = colorConAlfa(sombra.color, sombra.opacidad);
		ctx.shadowBlur = pxDesenfoqueSombra(sombra.desenfoque, medido.scaledFontSize) * escala;
		ctx.shadowOffsetX = m.a * lx + m.c * ly;
		ctx.shadowOffsetY = m.b * lx + m.d * ly;
	} else {
		ctx.shadowColor = "transparent";
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
	}
	ctx.drawImage(capa as CanvasImageSource, 0, 0);
	ctx.restore();
}
