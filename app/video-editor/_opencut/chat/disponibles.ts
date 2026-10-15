// =============================================================================
// chat/disponibles — lo que el motor tiene CON NOMBRE, para el chat «Editar con IA»
// =============================================================================
// Las transiciones, animaciones, filtros, efectos, curvas de velocidad y fuentes viven
// en el motor, y el catálogo de operaciones (lib/editor-video/chat-catalogo.ts) no puede
// importarlo: lo importa la ruta del server. Así que el editor arma esta lista, la manda
// dentro de la vista de la línea de tiempo («disponibles», chat/linea.ts) y la revisión
// valida contra ella: «no existe la transición X» sale de acá, con lo que el editor tiene
// HOY, y un preset nuevo del motor entra solo al chat.
//
// Se lee directo de las definiciones (no de effectsRegistry): así no arrastra el WASM y
// se puede probar con node (tests/video-editor-chat.test.ts).
// =============================================================================

import { TRANSICIONES } from "@/app/video-editor/_opencut/transiciones/catalogo";
import { PRESETS, type CategoriaAnimacion } from "@/app/video-editor/_opencut/animaciones/catalogo";
import { PRESETS_FILTRO, PREFIJO_FILTRO } from "@/app/video-editor/_opencut/effects/definitions/filtros";
import { PREFIJO_EFECTO, efectoEffectDefinitions } from "@/app/video-editor/_opencut/effects/definitions/efectos";
import { blurEffectDefinition } from "@/app/video-editor/_opencut/effects/definitions/blur";
import { PRESETS_CURVA, mediaCurva } from "@/app/video-editor/_opencut/retime/curva";
import { SYSTEM_FONTS } from "@/app/video-editor/_opencut/fonts/system-fonts";
import type { FontAtlas } from "@/app/video-editor/_opencut/fonts/types";

export type OpcionChat = { id: string; nombre: string };

export type Disponibles = {
	transiciones: OpcionChat[];
	animaciones: Record<CategoriaAnimacion, Array<OpcionChat & { soloTexto?: boolean }>>;
	/** `tipo` es el `effectType` del motor («filtro.calido»). */
	filtros: Array<OpcionChat & { tipo: string }>;
	efectos: Array<OpcionChat & { tipo: string }>;
	/** `media`: la velocidad media de la curva (lo que se estira o encoge el clip). */
	curvas: Array<OpcionChat & { media: number }>;
	fuentes: {
		/** minúsculas → como se escribe («bebas neue» → «Bebas Neue»). */
		todas: ReadonlyMap<string, string>;
		/** false: no se pudo cargar la lista de Google Fonts (sólo las del sistema y las del proyecto). */
		completa: boolean;
		/** Las que se le muestran a la IA (las del proyecto primero). */
		sugeridas: string[];
	};
};

/** Las Google Fonts que se le sugieren a la IA si están en la lista (las más usadas en anuncios). */
const POPULARES = [
	"Montserrat", "Poppins", "Roboto", "Inter", "Open Sans", "Lato", "Oswald", "Bebas Neue", "Anton",
	"Archivo Black", "Raleway", "Playfair Display", "Lobster", "Pacifico", "Bangers", "Permanent Marker",
];

/** El id que ve la IA de un efecto del motor: «efecto.glitch» → «glitch»; el desenfoque de OpenCut, «desenfoque». */
export function idDeEfecto(tipo: string): string {
	if (tipo === blurEffectDefinition.type) return "desenfoque";
	return tipo.startsWith(PREFIJO_EFECTO) ? tipo.slice(PREFIJO_EFECTO.length) : tipo;
}

/**
 * Lo que el editor tiene. `atlas` es la lista de Google Fonts del selector de fuentes
 * (fonts/google-fonts.ts, `loadFontAtlas`), o null si no cargó; `fuentesProyecto`, las que
 * ya usan los textos de la escena.
 */
export function disponiblesDelMotor({
	atlas = null,
	fuentesProyecto = [],
}: { atlas?: FontAtlas | null; fuentesProyecto?: readonly string[] } = {}): Disponibles {
	const categorias = Object.keys(PRESETS) as CategoriaAnimacion[];
	const animaciones = Object.fromEntries(
		categorias.map((c) => [c, PRESETS[c].map((p) => ({ id: p.id, nombre: p.nombre, ...(p.soloTexto ? { soloTexto: true } : {}) }))]),
	) as Disponibles["animaciones"];

	const todas = new Map<string, string>();
	const sumar = (f: string) => {
		const limpia = f.trim();
		if (limpia && !todas.has(limpia.toLowerCase())) todas.set(limpia.toLowerCase(), limpia);
	};
	for (const f of SYSTEM_FONTS) sumar(f);
	for (const f of fuentesProyecto) sumar(f);
	if (atlas) for (const f of Object.keys(atlas.fonts)) sumar(f);
	const sugeridas = [...new Set([...fuentesProyecto, ...POPULARES.filter((f) => todas.has(f.toLowerCase()))])].slice(0, 20);

	return {
		transiciones: TRANSICIONES.map((t) => ({ id: t.id, nombre: t.nombre })),
		animaciones,
		filtros: PRESETS_FILTRO.map((f) => ({ id: f.id, nombre: f.nombre, tipo: `${PREFIJO_FILTRO}${f.id}` })),
		efectos: [...efectoEffectDefinitions, blurEffectDefinition].map((d) => ({ id: idDeEfecto(d.type), nombre: d.name, tipo: d.type })),
		// «Personalizado» es la curva plana que se edita a mano: pedirla no cambia nada.
		curvas: PRESETS_CURVA.filter((c) => c.id !== "personalizado").map((c) => ({
			id: c.id,
			nombre: c.etiqueta,
			media: Math.round(mediaCurva(c) * 1000) / 1000,
		})),
		fuentes: { todas, completa: atlas !== null, sugeridas },
	};
}
