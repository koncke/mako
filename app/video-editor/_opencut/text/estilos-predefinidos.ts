// =============================================================================
// «Efectos de texto» y «Plantilla de texto»: los estilos que trae el editor
// =============================================================================
// En CapCut los dos catálogos vienen del servidor (miniaturas y nombres que no
// están en el es-LA.po) y son de ByteDance: no se copian (diseño §1.2). Estos
// son NUESTROS, armados con lo que el motor dibuja: color, trazo, sombra,
// brillo, fondo y, en las plantillas, fuente, tamaño y animación.
//
//   · Un EFECTO es sólo apariencia (color, trazo, sombra, brillo, fondo).
//     Aplicado a un texto existente no le cambia la fuente, el tamaño, lo que
//     dice ni la curva; arranca de `SIN_EFECTO`, así elegir «Neón» después de
//     «Recuadro negro» saca el fondo. Todo interruptor nuevo de apariencia va
//     apagado en `SIN_EFECTO` (lo vigila el test de animaciones), o «Ninguno»
//     lo deja prendido.
//   · Una PLANTILLA es un texto entero: lo que dice, la fuente, el tamaño, el
//     efecto y la animación. Se agrega como texto nuevo.
//
// Los colores son CONTENIDO (lo que se dibuja en el video): van en hex.

import type { ParamValue } from "@/app/video-editor/_opencut/params";
import { TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";
import { ANIM } from "@/app/video-editor/_opencut/params/extra/animaciones";

export type ParamsTexto = Record<string, ParamValue>;

export type EfectoTexto = {
	id: string;
	/** Para el lector de pantalla y el tooltip: CapCut muestra sólo la miniatura. */
	nombre: string;
	params: ParamsTexto;
};

export type PlantillaTexto = {
	id: string;
	nombre: string;
	contenido: string;
	params: ParamsTexto;
};

/** Las claves que pisa un efecto (todo lo de apariencia, nada de fuente ni tamaño). */
export const SIN_EFECTO: ParamsTexto = {
	color: "#ffffff",
	[TEXTO.trazoActivo]: false,
	[TEXTO.sombraActiva]: false,
	[TEXTO.brilloActivo]: false,
	"background.enabled": false,
	[TEXTO.fondoOpacidad]: 100,
};

const trazo = (color: string, grosor: number, posicion: "dentro" | "centro" | "fuera" = "fuera") => ({
	[TEXTO.trazoActivo]: true,
	[TEXTO.trazoColor]: color,
	[TEXTO.trazoGrosor]: grosor,
	[TEXTO.trazoPosicion]: posicion,
});
const sombra = (color: string, opacidad: number, desenfoque: number, distancia: number, angulo = -45) => ({
	[TEXTO.sombraActiva]: true,
	[TEXTO.sombraColor]: color,
	[TEXTO.sombraOpacidad]: opacidad,
	[TEXTO.sombraDesenfoque]: desenfoque,
	[TEXTO.sombraDistancia]: distancia,
	[TEXTO.sombraAngulo]: angulo,
});
const brillo = (color: string, intensidad: number, intervalo: number) => ({
	[TEXTO.brilloActivo]: true,
	[TEXTO.brilloColor]: color,
	[TEXTO.brilloIntensidad]: intensidad,
	[TEXTO.brilloIntervalo]: intervalo,
});
const fondo = (color: string, radio: number, opacidad = 100) => ({
	"background.enabled": true,
	"background.color": color,
	"background.cornerRadius": radio,
	[TEXTO.fondoOpacidad]: opacidad,
});

const efecto = (id: string, nombre: string, params: ParamsTexto): EfectoTexto => ({
	id,
	nombre,
	params: { ...SIN_EFECTO, ...params },
});

export const EFECTOS_TEXTO: EfectoTexto[] = [
	efecto("blanco-trazo-negro", "Blanco con trazo negro", { color: "#ffffff", ...trazo("#000000", 25) }),
	efecto("amarillo-trazo-negro", "Amarillo con trazo negro", { color: "#ffe14d", ...trazo("#000000", 25) }),
	efecto("negro-trazo-blanco", "Negro con trazo blanco", { color: "#111111", ...trazo("#ffffff", 25) }),
	efecto("rojo-trazo-blanco", "Rojo con trazo blanco", { color: "#e5283a", ...trazo("#ffffff", 25) }),
	efecto("sombra-suave", "Sombra suave", { color: "#ffffff", ...sombra("#000000", 70, 40, 6) }),
	efecto("sombra-dura", "Sombra dura", { color: "#ffffff", ...sombra("#000000", 100, 0, 8) }),
	efecto("comic", "Cómic", {
		color: "#ffffff",
		...trazo("#000000", 35),
		...sombra("#000000", 100, 0, 10),
	}),
	efecto("retro", "Retro", {
		color: "#ffcc00",
		...trazo("#d62828", 20),
		...sombra("#000000", 100, 0, 10),
	}),
	efecto("neon-cian", "Neón cian", {
		color: "#e8feff",
		...trazo("#00c1cd", 8, "centro"),
		...brillo("#00e5ff", 80, 40),
	}),
	efecto("neon-rosa", "Neón rosa", {
		color: "#fff0f8",
		...trazo("#ff2d95", 8, "centro"),
		...brillo("#ff2d95", 80, 40),
	}),
	efecto("neon-verde", "Neón verde", {
		color: "#f0fff0",
		...trazo("#39ff14", 8, "centro"),
		...brillo("#39ff14", 80, 40),
	}),
	efecto("contorno", "Contorno", { color: "#ffffff00", ...trazo("#ffffff", 20, "centro") }),
	efecto("resplandor", "Resplandor", { color: "#ffffff", ...brillo("#ffffff", 60, 30) }),
	efecto("fuego", "Fuego", {
		color: "#fff4d6",
		...trazo("#ff7a00", 10, "centro"),
		...brillo("#ff3d00", 90, 45),
	}),
	efecto("dorado", "Dorado", {
		color: "#f5c542",
		...trazo("#7a4b00", 15),
		...sombra("#000000", 60, 20, 4),
	}),
	efecto("recuadro-negro", "Recuadro negro", { color: "#ffffff", ...fondo("#000000", 10) }),
	efecto("recuadro-blanco", "Recuadro blanco", { color: "#111111", ...fondo("#ffffff", 10) }),
	efecto("recuadro-amarillo", "Recuadro amarillo", { color: "#111111", ...fondo("#ffe14d", 25) }),
	efecto("etiqueta-roja", "Etiqueta roja", { color: "#ffffff", ...fondo("#e5283a", 40) }),
	efecto("etiqueta-cian", "Etiqueta cian", { color: "#ffffff", ...fondo("#00c1cd", 40) }),
	efecto("translucido", "Translúcido", { color: "#ffffff", ...fondo("#000000", 25, 55) }),
];

// ── Plantillas ───────────────────────────────────────────────────────────────

const anim = (categoria: keyof typeof ANIM, id: string, duracion: number): ParamsTexto => ({
	[ANIM[categoria].id]: id,
	[ANIM[categoria].duracion]: duracion,
});

const plantilla = (
	id: string,
	nombre: string,
	contenido: string,
	params: ParamsTexto,
): PlantillaTexto => ({
	id,
	nombre,
	contenido,
	params: {
		...SIN_EFECTO,
		fontWeight: "normal",
		fontStyle: "normal",
		textDecoration: "none",
		textAlign: "center",
		letterSpacing: 0,
		lineHeight: 1.2,
		...params,
	},
});

export const PLANTILLAS_TEXTO: PlantillaTexto[] = [
	plantilla("titulo", "Título", "TÍTULO", {
		fontFamily: "Anton",
		fontSize: 18,
		letterSpacing: 2,
		...sombra("#000000", 60, 30, 5),
		...anim("entrada", "acercar", 0.6),
	}),
	plantilla("suscribete", "Suscríbete", "¡SUSCRÍBETE!", {
		fontFamily: "Bebas Neue",
		fontSize: 14,
		letterSpacing: 2,
		...fondo("#e5283a", 30),
		...anim("entrada", "rebote", 0.6),
		...anim("bucle", "pulso", 1),
	}),
	plantilla("oferta", "Oferta", "OFERTA 50 %", {
		fontFamily: "Anton",
		fontSize: 16,
		color: "#ffe14d",
		...trazo("#000000", 25),
		...anim("entrada", "girar", 0.6),
		...anim("bucle", "latido", 1.2),
	}),
	plantilla("nuevo", "Nuevo", "NUEVO", {
		fontFamily: "Poppins",
		fontWeight: "bold",
		fontSize: 10,
		letterSpacing: 3,
		...fondo("#00c1cd", 40),
		...anim("entrada", "deslizar-izquierda", 0.5),
	}),
	plantilla("maquina", "Máquina de escribir", "Escribe aquí", {
		fontFamily: "Courier Prime",
		fontWeight: "bold",
		fontSize: 7,
		...fondo("#000000", 0, 70),
		...anim("entrada", "maquina-escribir", 1.5),
	}),
	plantilla("palabras", "Palabra por palabra", "Cada palabra\naparece sola", {
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontSize: 7,
		...trazo("#000000", 25),
		...anim("entrada", "palabra-por-palabra", 1.5),
	}),
	plantilla("elegante", "Elegante", "Un subtítulo elegante", {
		fontFamily: "Playfair Display",
		fontStyle: "italic",
		fontSize: 7,
		...sombra("#000000", 70, 40, 4),
		...anim("entrada", "aparecer-gradualmente", 0.8),
		...anim("salida", "desaparecer-gradualmente", 0.8),
	}),
	plantilla("comic", "Cómic", "¡BOOM!", {
		fontFamily: "Bangers",
		fontSize: 22,
		letterSpacing: 2,
		color: "#ffe14d",
		...trazo("#000000", 35),
		...sombra("#000000", 100, 0, 10),
		...anim("entrada", "rebote", 0.5),
		...anim("bucle", "temblor", 1),
	}),
	plantilla("neon", "Neón", "NEÓN", {
		fontFamily: "Monoton",
		fontSize: 14,
		color: "#fff0f8",
		...trazo("#ff2d95", 8, "centro"),
		...brillo("#ff2d95", 80, 40),
		...anim("bucle", "parpadeo", 1.5),
	}),
	plantilla("cita", "Cita", "«Tu frase favorita»", {
		fontFamily: "Playfair Display",
		fontStyle: "italic",
		fontSize: 7,
		color: "#111111",
		...fondo("#ffffff", 20, 90),
		...anim("entrada", "subir", 0.6),
	}),
	plantilla("accion", "Llamada a la acción", "Compra ahora", {
		fontFamily: "Montserrat",
		fontWeight: "bold",
		fontSize: 9,
		color: "#111111",
		...fondo("#ffffff", 50),
		...anim("entrada", "deslizar-arriba", 0.5),
		...anim("bucle", "respirar", 1.2),
	}),
	plantilla("manuscrito", "Manuscrito", "Hecho a mano", {
		fontFamily: "Pacifico",
		fontSize: 10,
		...sombra("#000000", 60, 30, 4),
		...anim("entrada", "aparecer-gradualmente", 0.6),
	}),
];

/**
 * El tamaño de una plantilla está pensado para un lienzo horizontal; el motor lo
 * mide contra el ALTO (text/typography.ts), así que en un 9:16 el mismo número
 * daría letras casi el doble de grandes y una frase no entraría. Se lleva al
 * lado corto, como los subtítulos (subtitles/estilos.ts → `tamanoBase`).
 */
export function paramsParaLienzo(
	params: ParamsTexto,
	lienzo: { width: number; height: number } | null | undefined,
): ParamsTexto {
	const tamano = params.fontSize;
	if (typeof tamano !== "number" || !lienzo || lienzo.height <= 0) return params;
	const factor = Math.min(lienzo.width, lienzo.height) / lienzo.height;
	return { ...params, fontSize: Math.max(1, Math.round(tamano * factor * 10) / 10) };
}

/** Las fuentes que usan las plantillas (para cargarlas antes de dibujar o agregar). */
export const FUENTES_PLANTILLAS = [
	...new Set(PLANTILLAS_TEXTO.map((p) => String(p.params.fontFamily ?? "")).filter(Boolean)),
];

// ── Lo que viaja en «Guardar como parámetro predefinido» ─────────────────────
// Todo lo de estilo; ni el contenido, ni la posición, ni la marca de subtítulo.

const CLAVES_ESTILO_FIJAS = [
	"fontFamily",
	"fontSize",
	"fontWeight",
	"fontStyle",
	"textDecoration",
	"color",
	"letterSpacing",
	"lineHeight",
	"textAlign",
	"background.enabled",
	"background.color",
	"background.cornerRadius",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
];

export const CLAVES_ESTILO: readonly string[] = [...CLAVES_ESTILO_FIJAS, ...Object.values(TEXTO)];

export function estiloDeParams(params: Record<string, ParamValue>): ParamsTexto {
	const estilo: ParamsTexto = {};
	for (const clave of CLAVES_ESTILO) {
		if (params[clave] !== undefined) estilo[clave] = params[clave];
	}
	return estilo;
}
