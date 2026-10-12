// =============================================================================
// «Plantillas de subtítulos»: el estilo de TODOS los subtítulos juntos
// =============================================================================
// En CapCut un subtítulo no se estiliza solo: la plantilla elegida (o el estilo
// de uno, con «Aplicar en todos los subtítulos») se aplica a todos. Una plantilla
// es un juego de parámetros de texto (fuente, color, fondo…) que se escribe en
// cada subtítulo; elegirla sin subtítulos la deja como la de los próximos que se
// generen («Aplicar plantillas y generar subtítulos»).
//
// El tamaño y el relleno van en proporción al LIENZO y no en números fijos: el
// `fontSize` del motor es relativo al alto del lienzo (texto/typography.ts) y el
// relleno del fondo, relativo al `fontSize`; con números fijos un subtítulo
// vertical (1080×1920) salía casi el doble de grande que uno horizontal.
//
// El contorno es el «Trazo» del paquete de texto (params/extra/texto.ts). Una
// plantilla escribe SIEMPRE el trazo, la sombra y el brillo (apagados si no los
// usa): si no, elegir «Clásico» sobre un subtítulo al que le pusieron «Neón»
// desde Texto › Efectos le dejaba el halo.
//
// Los colores de las plantillas son CONTENIDO (lo que se escribe en el
// subtítulo), no estilo de la pantalla: por eso van en hex.

import type { ParamValue } from "@/app/video-editor/_opencut/params";
import { FONT_SIZE_SCALE_REFERENCE } from "@/app/video-editor/_opencut/text/typography";
import { TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";

export type Lienzo = { width: number; height: number };

export type PlantillaSubtitulo = {
	id: string;
	/** Para el lector de pantalla y el tooltip: CapCut muestra sólo la miniatura. */
	nombre: string;
	fuente: string;
	negrita: boolean;
	color: string;
	/** Multiplica el tamaño base del lienzo. */
	escala?: number;
	espaciado?: number;
	fondo?: {
		color: string;
		/** 0–100 (el «Redondeo» del fondo del motor). */
		radio: number;
		/** Relleno en «em» (veces el tamaño de la letra). */
		x: number;
		y: number;
	};
	/** El «Trazo» (por fuera de la letra), con el grosor en la escala 0–100 de la pantalla. */
	trazo?: { color: string; grosor: number };
};

export const PLANTILLAS_SUBTITULO: PlantillaSubtitulo[] = [
	{
		id: "predeterminado",
		nombre: "Predeterminado",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffffff",
		fondo: { color: "rgba(0, 0, 0, 0.6)", radio: 25, x: 0.35, y: 0.12 },
	},
	{
		id: "clasico",
		nombre: "Clásico",
		fuente: "Roboto",
		negrita: true,
		color: "#ffffff",
		fondo: { color: "#000000", radio: 0, x: 0.3, y: 0.08 },
	},
	{
		id: "amarillo",
		nombre: "Amarillo",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffe14d",
		fondo: { color: "rgba(0, 0, 0, 0.7)", radio: 25, x: 0.35, y: 0.12 },
	},
	{
		id: "recuadro-blanco",
		nombre: "Recuadro blanco",
		fuente: "Poppins",
		negrita: true,
		color: "#111111",
		fondo: { color: "#ffffff", radio: 30, x: 0.4, y: 0.14 },
	},
	{
		id: "cian",
		nombre: "Cian",
		fuente: "Poppins",
		negrita: true,
		color: "#ffffff",
		fondo: { color: "#00c1cd", radio: 30, x: 0.4, y: 0.14 },
	},
	{
		id: "rojo",
		nombre: "Rojo",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffffff",
		fondo: { color: "#e5283a", radio: 15, x: 0.35, y: 0.12 },
	},
	{
		id: "violeta",
		nombre: "Violeta",
		fuente: "Lilita One",
		negrita: false,
		color: "#ffffff",
		escala: 1.1,
		fondo: { color: "rgba(124, 58, 237, 0.9)", radio: 40, x: 0.4, y: 0.12 },
	},
	{
		id: "impacto",
		nombre: "Impacto",
		fuente: "Anton",
		negrita: false,
		color: "#ffffff",
		escala: 1.25,
		espaciado: 1,
		fondo: { color: "rgba(0, 0, 0, 0.45)", radio: 10, x: 0.3, y: 0.08 },
	},
	{
		id: "titular",
		nombre: "Titular",
		fuente: "Bebas Neue",
		negrita: false,
		color: "#ffe14d",
		escala: 1.4,
		espaciado: 2,
		fondo: { color: "rgba(0, 0, 0, 0.55)", radio: 10, x: 0.3, y: 0.06 },
	},
	{
		id: "contorno",
		nombre: "Contorno",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffffff",
		trazo: { color: "#000000", grosor: 30 },
	},
	{
		id: "amarillo-contorno",
		nombre: "Amarillo con contorno",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffe14d",
		trazo: { color: "#000000", grosor: 30 },
	},
	{
		id: "solo-texto",
		nombre: "Solo texto",
		fuente: "Montserrat",
		negrita: true,
		color: "#ffffff",
	},
];

export const PLANTILLA_POR_DEFECTO = PLANTILLAS_SUBTITULO[0];

export function plantillaPorId(id: string | null | undefined): PlantillaSubtitulo {
	return PLANTILLAS_SUBTITULO.find((p) => p.id === id) ?? PLANTILLA_POR_DEFECTO;
}

/**
 * El tamaño de letra de un subtítulo en el lienzo: ~5,5 % del lado corto (60 px
 * en 1920×1080 y en 1080×1920), en las unidades del motor (relativas al alto).
 */
export function tamanoBase(lienzo: Lienzo): number {
	const px = 0.055 * Math.min(lienzo.width, lienzo.height);
	return Math.max(1, Math.round(((px * FONT_SIZE_SCALE_REFERENCE) / lienzo.height) * 10) / 10);
}

/** Los parámetros de texto que escribe una plantilla en cada subtítulo. */
export function paramsDePlantilla(
	plantilla: PlantillaSubtitulo,
	lienzo: Lienzo,
): Record<string, ParamValue> {
	const fontSize = Math.round(tamanoBase(lienzo) * (plantilla.escala ?? 1) * 10) / 10;
	const pxLetra = (fontSize * lienzo.height) / FONT_SIZE_SCALE_REFERENCE;
	// El motor multiplica el relleno por fontSize/15 (text/primitives.ts).
	const aParam = (em: number) => Math.round((em * pxLetra) / (fontSize / 15));
	const params: Record<string, ParamValue> = {
		fontFamily: plantilla.fuente,
		fontWeight: plantilla.negrita ? "bold" : "normal",
		fontStyle: "normal",
		textDecoration: "none",
		textAlign: "center",
		color: plantilla.color,
		fontSize,
		letterSpacing: plantilla.espaciado ?? 0,
		lineHeight: 1.2,
		"background.enabled": Boolean(plantilla.fondo),
		[TEXTO.trazoActivo]: Boolean(plantilla.trazo),
		[TEXTO.sombraActiva]: false,
		[TEXTO.brilloActivo]: false,
	};
	if (plantilla.trazo) {
		params[TEXTO.trazoColor] = plantilla.trazo.color;
		params[TEXTO.trazoGrosor] = plantilla.trazo.grosor;
		params[TEXTO.trazoPosicion] = "fuera";
	}
	if (plantilla.fondo) {
		params["background.color"] = plantilla.fondo.color;
		params["background.cornerRadius"] = plantilla.fondo.radio;
		params["background.paddingX"] = aParam(plantilla.fondo.x);
		params["background.paddingY"] = aParam(plantilla.fondo.y);
		params["background.offsetX"] = 0;
		params["background.offsetY"] = 0;
	}
	return params;
}

/**
 * Dónde va el borde de abajo del subtítulo, en px desde el borde de abajo del
 * lienzo. En vertical va más arriba: el último 20 % de un Reel o un TikTok lo
 * tapan el texto y los botones de la app.
 */
export function margenInferior(lienzo: Lienzo): number {
	return lienzo.height * (lienzo.height > lienzo.width * 1.1 ? 0.22 : 0.07);
}

/** Ancho máximo de una línea de subtítulo, en px del lienzo. */
export function anchoMaximo(lienzo: Lienzo): number {
	return lienzo.width * 0.82;
}
