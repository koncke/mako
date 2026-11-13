// =============================================================================
// chat/linea — la línea de tiempo como la lee la IA, y la revisión de lo que propone
// =============================================================================
// Dos funciones PURAS (sin React, sin EditorCore, sin el wasm: los ticks por segundo,
// lo disponible del motor y la transcripción llegan por parámetro), así tienen test
// (tests/video-editor-chat.test.ts):
//
//   vistaDeLinea         → la escena en un JSON chico para la IA, con una REFERENCIA corta
//                          por elemento (v1, a2, t3…) y el estado que la IA necesita para
//                          decidir (transición, animaciones, filtro, velocidad, estilo,
//                          posición…), sólo lo que no está en su valor por defecto. La IA
//                          nunca ve un id del motor: un id de 36 caracteres que pasa por un
//                          modelo deja de ser exacto (AGENTS.md, «Una regla en un prompt no
//                          es una regla»).
//   revisarOperaciones   → lo que propuso la IA contra esa vista: qué se puede aplicar, la
//                          fila de cada cambio para «Original | Modificado», y por qué se
//                          descartó lo demás. Simula en orden: lo que se borra deja de
//                          existir, lo que se corta queda con la parte izquierda, lo que se
//                          alarga corre lo que sigue.
//
// Lo que se descarta, se dice («No se aplica: …»): una propuesta que calla lo que tiró se
// lee como que la IA hizo todo lo pedido. Lo mismo un nombre que el motor no tiene («no
// existe la transición X»): se valida contra `disponibles` (chat/disponibles.ts), que es
// lo que el editor tiene HOY.
//
// Lo que tarda (revertir, congelar, medir para normalizar, subtitular) y los cortes por
// tiempo o por frase van AL FINAL, después de todo lo demás (chat/aplicar.ts): la revisión
// los procesa en una segunda pasada, en ese orden, para que las filas digan lo que pasa.
//
// Las plantillas de anuncio (plan-plantillas-anuncio.md §5): la vista marca cada elemento
// que salió de una plantilla con su "hueco" (y "muestra" si es la imagen para sustituir) y
// lista los medios de Multimedia con una ref corta (m1, m2…), que usan reemplazar_clip y
// usar_plantilla. usar_plantilla va SOLA y con la línea de tiempo vacía: se revisa antes que
// todo lo demás.
//
// Los motion graphics (lib/motion, traídos el 10/11/2026 de rescate/motion-imagen-2610): un
// `graphic` con `definitionId` «motion-…» (graphics/definitions/motion.ts) la IA lo ve como
// "tipo":"motion", con su "plantilla" y sus "valores" de AHORA (sólo los de la plantilla, con
// `valoresDeParams`: sus params tienen también la posición y la opacidad del elemento).
// agregar_motion lo inserta como la biblioteca y editar_motion escribe sus params con el
// `updateElements` del panel, validados contra SU plantilla (`valoresMotionValidos`).
// =============================================================================

import type { SceneTracks, TimelineElement, TimelineTrack, ElementType } from "@/app/video-editor/_opencut/timeline/types";
import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import {
	AJUSTES_COLOR,
	DESENFOQUES_FONDO,
	MEZCLAS,
	OBJETIVOS_NORMALIZAR,
	TOPES_CHAT,
	colorHex,
	textoValoresMotion,
	valoresAlAgregar,
	valoresMotionValidos,
	type CategoriaAnimChat,
	type ClaveAjuste,
	type DesenfoqueFondo,
	type EstiloTextoChat,
	type OperacionChat,
	type TransformChat,
} from "@/lib/editor-video/chat-catalogo";
import { huecosDe, largoTexto, plantillaPorId } from "@/lib/editor-video/plantillas";
import { leerMarcas, type MarcasPlantilla } from "@/app/video-editor/_opencut/plantillas/huecos";
import { aceptaDe, aceptaMedio, mediosParaReemplazo, type Acepta } from "@/app/video-editor/_opencut/reemplazo/puro";
import { ANIM, categoriasPara } from "@/app/video-editor/_opencut/params/extra/animaciones";
import { DEFAULTS_TEXTO, TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";
import {
	ANIMS_PALABRA,
	DEFAULTS_CLAVES,
	DEFAULTS_RESALTADO,
	PARAM_ANIM_PALABRA,
	PARAM_CLAVES_COLOR,
	PARAM_CLAVES_TAMANO,
	PARAM_NO_DICHAS_OPACIDAD,
	PARAM_RESALTAR,
	PARAM_RESALTAR_COLOR,
	type AnimPalabra,
} from "@/app/video-editor/_opencut/params/extra/subtitulos";
import { REFLEJO_HORIZONTAL, REFLEJO_VERTICAL } from "@/app/video-editor/_opencut/params/extra/reflejo";
import { ID_NINGUNO, presetAnimacion, type CategoriaAnimacion } from "@/app/video-editor/_opencut/animaciones/catalogo";
import { cambiosAlElegir, cambiosDeDuracion, duracionMaximaAnimacion } from "@/app/video-editor/_opencut/animaciones/elegir";
import {
	DURACION_MINIMA as TRANSICION_MINIMA,
	DURACION_POR_DEFECTO as TRANSICION_POR_DEFECTO,
	PARAM_TRANSICION_DURACION,
	PARAM_TRANSICION_ID,
} from "@/app/video-editor/_opencut/transiciones/claves";
import {
	FUNDIDO_ENTRADA,
	FUNDIDO_SALIDA,
	NORMALIZAR,
	NORMALIZAR_OBJETIVO,
	OBJETIVO_PREDETERMINADO,
	REDUCIR_RUIDO,
	EXTRAIDO_DE,
} from "@/app/video-editor/_opencut/audio/claves";
import { buscarFrase, muletillasDe, NO_HAY_MULETILLAS, palabrasEnOrden, type ParrafoTx } from "@/app/video-editor/_opencut/transcripcion/modelo";
import type { Disponibles } from "./disponibles";
import { PLANTILLAS_SUBTITULO, type PlantillaSubtitulo } from "@/app/video-editor/_opencut/subtitles/estilos";
import { clavesNombradas, codificarClaves, elegirClaves, leerClaves, PARAM_CLAVES, quitarClaves, sumarClaves } from "@/app/video-editor/_opencut/subtitles/claves";
import { PAUSA_MIN_S, segundosDeAviso } from "@/app/video-editor/_opencut/audio/silencios-aviso";
import { PARAM_EMOJI_DE } from "@/app/video-editor/_opencut/subtitles/emojis";
import { plantillaDeDefinicion, valoresDeParams } from "@/app/video-editor/_opencut/graphics/definitions/motion";
import { PLANTILLAS as DEF_MOTION, valoresPorDefecto } from "@/lib/motion/plantillas";
import type { IdPlantilla, ValoresMotion } from "@/lib/motion/tipos";
import type { TBackground } from "@/app/video-editor/_opencut/project/types";
import { brollDe } from "@/app/video-editor/_opencut/broll/pistas";
import { EFECTOS_TEXTO, PLANTILLAS_TEXTO, SIN_EFECTO, paramsParaLienzo } from "@/app/video-editor/_opencut/text/estilos-predefinidos";
import { curvaBloqueada } from "@/app/video-editor/_opencut/text/estilo";
import { EMOJIS_PROVIDER_ID, GRUPOS_EMOJI, TENDENCIAS_EMOJI, emojiAValor, separarEmojis } from "@/app/video-editor/_opencut/stickers/providers/emojis";
import { buildStickerId } from "@/app/video-editor/_opencut/stickers/sticker-id";
import {
	RECT_COMPLETO,
	esRectCompleto,
	normalizarRect,
	paramsDeRect,
	proporcionDeParams,
	rectConProporcion,
	rectDeParams,
	valorProporcion,
	type RectRecorte,
} from "@/app/video-editor/_opencut/recorte/geometria";

export type TipoRef = "video" | "imagen" | "texto" | "audio" | "sticker" | "grafico" | "efecto" | "motion";

/** Un motion graphic: su plantilla y los valores de sus campos (lib/motion). */
export type MotionLeido = { plantilla: IdPlantilla; valores: ValoresMotion };

/** El estilo de un texto como lo lee la IA (las claves de estilo_texto), con los colores de lo apagado aparte. */
export type EstiloLeido = Required<Omit<EstiloTextoChat, "sombra">> & {
	sombra: string | false;
	colores: { trazo: string; sombra: string; fondo: string; resplandor: string };
	/** El karaoke de un subtítulo (params/extra/subtitulos.ts), como lo pide `resaltar_palabras`. */
	resaltar: ResaltarLeido;
	/** «Animación de la palabra» (Submagic), como la pide `animar_palabras`. */
	animacion_palabra: AnimPalabra;
	/** El tamaño de las palabras clave en % (100 = igual), como lo pide `palabras_clave`. */
	tamano_claves: number;
};

export type ResaltarLeido = { modo: "ninguno" | "palabra" | "frase"; color: string; opacidad_no_dichas: number };

export type TransformLeido = Required<TransformChat> & {
	/** Escala Y / escala X: «escala» la conserva, como «Escala uniforme» del panel. */
	proporcion: number;
};

/** Lo que la revisión sabe de un elemento además de dónde está (sólo lo que aplica a su tipo). */
export type EstadoElemento = {
	/** Video y audio: la velocidad (media, si es una curva) y la curva. */
	velocidad?: number;
	curva?: string | null;
	cambiaTono?: boolean;
	/** Video y audio: segundos de la línea de tiempo de material escondido antes y después. */
	recorte?: [number, number];
	/** Video e imagen. */
	transicion?: { id: string; duracion: number } | null;
	filtro?: { tipo: string; intensidad: number } | null;
	/** Los `effectType` de los efectos de video del clip (sin el ajuste ni el filtro). */
	efectos?: string[];
	ajustes?: Partial<Record<ClaveAjuste, number>>;
	reflejo?: { horizontal: boolean; vertical: boolean };
	revertido?: boolean;
	audioSeparado?: boolean;
	sinAudio?: boolean;
	/** Visuales: las claves `anim.*` de sus params. */
	anim?: ParamValues;
	transform?: TransformLeido;
	estilo?: EstiloLeido;
	/** Video y audio. */
	fundidos?: { entrada: number; salida: number };
	ruido?: boolean;
	/** El objetivo («youtube»…) si está normalizado. */
	normalizado?: string | null;
	/** Una capa de efecto: su `effectType`. */
	capa?: string;
	/** Las propiedades con fotogramas clave (cambiar su valor base no se vería). */
	fotogramas?: string[];
	/** Un motion graphic: su plantilla y sus valores de ahora. */
	motion?: MotionLeido;
	/** Un texto curvado (text/estilo.ts): un efecto con fondo no se le aplica, como en el panel. */
	curvado?: boolean;
	/** Un texto: los params que escribe un «Efecto de texto» (CLAVES_APARIENCIA), como están. */
	apariencia?: ParamValues;
	/** Video e imagen: el encuadre de «Recortar» (recorte/geometria.ts) y el tamaño del archivo, si se sabe. */
	encuadre?: { rect: RectRecorte; proporcion: string };
	fuente?: { ancho: number; alto: number };
	/** Un B-roll de MaKo (broll/pistas.ts → `brollDe`): lo que se buscó en Pexels. «Otra» (cambiar_broll) trae la siguiente. */
	broll?: string;
};

/** Lo que escribe algún «Efecto de texto» (o «Ninguno»): para saber si elegir uno cambia algo. */
const CLAVES_APARIENCIA: readonly string[] = [...new Set([SIN_EFECTO, ...EFECTOS_TEXTO.map((x) => x.params)].flatMap((p) => Object.keys(p)))];

/** El fondo del lienzo como lo lee la revisión: un color, o el desenfoque (con su nombre, si es uno de los del panel). */
export type FondoLeido = { tipo: "color"; color: string } | { tipo: "desenfoque"; nivel: DesenfoqueFondo | null; intensidad: number };

export type RefElemento = {
	ref: string;
	trackId: string;
	elementId: string;
	tipo: TipoRef;
	/** Para la fila de la revisión: el texto de un texto, el nombre del archivo de lo demás. */
	titulo: string;
	inicio: number;
	fin: number;
	bloqueada: boolean;
	principal: boolean;
	texto?: string;
	volumenDb?: number;
	silenciado?: boolean;
	oculto?: boolean;
	/** Un texto que es un subtítulo (params.subtitulo). */
	subtitulo?: boolean;
	/** Un subtítulo: sus palabras clave (subtitles/claves.ts), normalizadas. */
	claves?: string[];
	/** Un sticker que es el emoji automático de un subtítulo (subtitles/emojis.ts). */
	emojiSubtitulo?: boolean;
	/** Lo agrega esta misma propuesta (agregar_texto o capa_efecto con "ref"): sus ids se conocen al aplicar. */
	nuevo?: boolean;
	/** Un audio que salió de «Extraer audio» de un video: los cortes lo parten como a su video. */
	extraido?: boolean;
	/** Video o imagen: el medio de Multimedia que muestra. */
	mediaId?: string;
	/** Video o imagen: qué medio acepta (su hueco del catálogo; un clip común, «ambos»). */
	acepta?: Acepta;
	/** Lo que salió de una plantilla (plantillas/huecos.ts): de cuál y qué hueco. */
	plantilla?: string;
	hueco?: string;
	/** Un clip que es la imagen de muestra de su hueco (sin sustituir). */
	muestra?: boolean;
	/** El hueco se puede dejar con su muestra (el fondo del cierre). */
	opcional?: boolean;
	/** Al sustituirlo por un video, entra sin sonido. */
	silenciar?: boolean;
	/** Un texto de hueco: el tope de caracteres del catálogo. */
	maxCaracteres?: number;
	estado: EstadoElemento;
};

/** Un medio de Multimedia que el chat puede usar (reemplazar_clip, usar_plantilla). `duracion` en segundos, sin redondear. */
export type RefMedio = { ref: string; mediaId: string; nombre: string; tipo: "video" | "imagen"; duracion?: number; sinAudio?: boolean };

/** Lo que la vista lee de un medio de Multimedia (MediaAsset). `width` y `height`: el encuadre por proporción. */
export type MedioVista = Pick<MediaAsset, "id" | "name" | "type" | "duration" | "ephemeral" | "hasAudio"> & Partial<Pick<MediaAsset, "width" | "height">>;

export type VistaLinea = {
	/** Lo que se le manda a la IA. */
	json: string;
	/** ref → elemento, para revisar y aplicar. */
	refs: Map<string, RefElemento>;
	/** ref («m1») → medio de Multimedia. */
	medios: Map<string, RefMedio>;
	/** Las refs de lo elegido en la línea de tiempo al mandar. */
	elegidos: string[];
	disponibles: Disponibles;
	lienzo: { ancho: number; alto: number } | null;
	/** El fondo del lienzo (Proyecto › Fondo), o null si no se sabe. */
	fondo: FondoLeido | null;
};

/** El fondo del proyecto como lo lee el chat: el desenfoque con su nombre si es uno de los del panel. */
export function leerFondo(b: TBackground | null | undefined): FondoLeido | null {
	if (!b) return null;
	if (b.type === "color") return { tipo: "color", color: colorHex(b.color) ?? b.color };
	const nivel = (Object.keys(DESENFOQUES_FONDO) as DesenfoqueFondo[]).find((k) => DESENFOQUES_FONDO[k] === b.blurIntensity) ?? null;
	return { tipo: "desenfoque", nivel, intensidad: b.blurIntensity };
}

/** «negro (#000000)», «desenfoque medio»: el fondo en palabras, para la revisión. */
function textoFondo(f: FondoLeido | null): string {
	if (!f) return "el de ahora";
	if (f.tipo === "color") return `color ${f.color}`;
	return f.nivel ? `desenfoque ${f.nivel}` : `desenfoque (${f.intensidad})`;
}

/** Los emojis de la biblioteca (Stickers › Emojis), para que el chat no agregue uno que la pestaña no tiene. */
let EMOJIS_BIBLIOTECA: Set<string> | null = null;
/** El emoji como está en la biblioteca (con o sin el selector de variante U+FE0F), o null si no está. */
export function emojiDeLaBiblioteca(emoji: string): string | null {
	EMOJIS_BIBLIOTECA ??= new Set([...GRUPOS_EMOJI.flatMap((g) => separarEmojis(g.emojis)), ...separarEmojis(TENDENCIAS_EMOJI)]);
	const sinVariante = emoji.replace(/\uFE0F/g, "");
	for (const e of [emoji, sinVariante, `${sinVariante}\uFE0F`]) if (EMOJIS_BIBLIOTECA.has(e)) return e;
	return null;
}

/** «sin recortar», «9:16 · se saca izquierda 21,9 % · derecha 21,9 %»: el encuadre en palabras. */
function textoEncuadre(x: { rect: RectRecorte; proporcion: string } | undefined): string {
	if (!x || esRectCompleto(x.rect)) return "sin recortar";
	const lados = encuadreJson(x.rect);
	const partes = Object.entries(lados).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${String(n).replace(".", ",")} %`);
	return `${x.proporcion !== "libre" ? `${x.proporcion} · ` : ""}se saca ${partes.join(" · ")}`;
}

/** Un encuadre en % de cada lado (lo que lee la IA y lo que pide `encuadre`). */
function encuadreJson(r: RectRecorte): { izquierda: number; arriba: number; derecha: number; abajo: number } {
	const p = (n: number) => r1(Math.max(0, n) * 100);
	return { izquierda: p(r.x), arriba: p(r.y), derecha: p(1 - r.x - r.ancho), abajo: p(1 - r.y - r.alto) };
}

/** Sin lo del motor: todo nombre se descarta («no existe…»). Los tests y un editor sin cargar. */
export const DISPONIBLES_VACIOS: Disponibles = {
	transiciones: [],
	animaciones: { entrada: [], salida: [], combo: [], bucle: [] },
	filtros: [],
	efectos: [],
	curvas: [],
	fuentes: { todas: new Map(), completa: false, sugeridas: [] },
};

const PREFIJO: Record<TimelineElement["type"], string> = {
	video: "v", image: "i", text: "t", audio: "a", sticker: "s", graphic: "g", effect: "e",
};
const TIPO: Record<TimelineElement["type"], TipoRef> = {
	video: "video", image: "imagen", text: "texto", audio: "audio", sticker: "sticker", graphic: "grafico", effect: "efecto",
};
const MOTOR: Record<TipoRef, ElementType> = {
	video: "video", imagen: "image", texto: "text", audio: "audio", sticker: "sticker", grafico: "graphic", efecto: "effect", motion: "graphic",
};
/** Un `graphic` de una plantilla de motion se ve como "motion"; el resto, por su tipo del motor. */
const tipoDe = (el: TimelineElement): TipoRef => (el.type === "graphic" && plantillaDeDefinicion(el.definitionId) ? "motion" : TIPO[el.type]);
const TIPO_PISTA: Record<TimelineTrack["type"], string> = {
	video: "video", text: "texto", audio: "audio", graphic: "grafico", effect: "efecto",
};
const ROTULO: Record<TipoRef, string> = {
	video: "Video", imagen: "Imagen", texto: "Texto", audio: "Audio", sticker: "Sticker", grafico: "Forma", efecto: "Efecto", motion: "Motion",
};
/** «combo» del motor es «combinado» para la IA (el rótulo de CapCut). */
const CATEGORIA_MOTOR: Record<CategoriaAnimChat, CategoriaAnimacion> = { entrada: "entrada", salida: "salida", combinado: "combo", bucle: "bucle" };
const CATEGORIA_CHAT: Record<CategoriaAnimacion, CategoriaAnimChat> = { entrada: "entrada", salida: "salida", combo: "combinado", bucle: "bucle" };

/** La marca de un clip revertido (commands/timeline/element/revertir.ts, CLAVE_ORIGEN; lo fija el test). */
export const CLAVE_REVERTIDO = "revertir.origen";
const PREFIJO_FILTRO = "filtro.";
const TIPO_AJUSTE = "ajuste";
const ALINEACION_CHAT: Record<string, EstiloLeido["alineacion"]> = { left: "izquierda", center: "centro", right: "derecha" };
const ALINEACION_MOTOR: Record<EstiloLeido["alineacion"], string> = { izquierda: "left", centro: "center", derecha: "right" };
const MEZCLA_CHAT = Object.fromEntries(Object.entries(MEZCLAS).map(([chat, motor]) => [motor, chat]));
const OBJETIVO_CHAT = Object.fromEntries(Object.entries(OBJETIVOS_NORMALIZAR).map(([chat, motor]) => [motor, chat]));

/** Segundos a la centésima. */
const seg = (ticks: number, tps: number) => Math.round((ticks / tps) * 100) / 100;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** El tamaño de un texto nuevo sin plantilla (el de `leerEstilo` y la pestaña Texto). */
export const TAMANO_TEXTO_DE_SIEMPRE = 15;
/** La letra mide `tamaño × alto del lienzo / esto` (FONT_SIZE_SCALE_REFERENCE de text/typography.ts: lo fija el test). */
export const REFERENCIA_TAMANO_LETRA = 90;
/**
 * El tamaño más grande con el que el renglón más largo de `texto` entra en el 90 % del ancho del lienzo, o null sin
 * lienzo. Un texto NO se parte solo (text/layout.ts mide cada renglón como es), así que el tamaño depende de cuántas
 * letras tiene. Ancho promedio de una letra, medido en Chrome con Arial (12/11/2026): ~0,63 de su alto en mayúsculas y
 * ~0,5 en minúsculas; se toma un poco más, para que sobre.
 */
export function tamanoQueEntra(texto: string, lienzo: { ancho: number; alto: number } | null, mayusculas: boolean): number | null {
	if (!lienzo || lienzo.ancho <= 0 || lienzo.alto <= 0) return null;
	const renglones = texto.split("\n").map((l) => l.trim()).filter(Boolean);
	if (!renglones.length) return null;
	const largo = Math.max(...renglones.map((l) => l.length));
	const enMayusculas = mayusculas || !/[a-záéíóúñü]/.test(renglones.join(""));
	const letra = enMayusculas ? 0.66 : 0.54;
	const maximo = (0.9 * lienzo.ancho * REFERENCIA_TAMANO_LETRA) / (largo * letra * lienzo.alto);
	return Math.max(1, Math.floor(maximo * 2) / 2);
}
const num = (p: ParamValues, clave: string, porDefecto: number) => {
	const v = p[clave];
	return typeof v === "number" && Number.isFinite(v) ? v : porDefecto;
};
const color = (v: ParamValue | undefined, porDefecto: string) => colorHex(v) ?? (typeof v === "string" && v ? v : porDefecto);

/** «2,5 s», «3 s». Lo que se ve en la revisión. */
export function textoSegundos(s: number): string {
	const r = Math.round(s * 10) / 10;
	return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")} s`;
}

/** «0 dB», «−6 dB». */
const textoDb = (db: number) => `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(Math.round(db * 10) / 10).toString().replace(".", ",")} dB`;
const textoNumero = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

// ─────────────────────────────────────────────────────────────────────────────
// El estado de un elemento
// ─────────────────────────────────────────────────────────────────────────────

/** ¿La ruta tiene fotogramas clave? (estructural: animation/channel-data.ts trae el WASM). */
function conFotogramas(dato: unknown): boolean {
	if (!dato || typeof dato !== "object") return false;
	const d = dato as { keys?: unknown };
	if (Array.isArray(d.keys)) return d.keys.length > 0;
	return Object.values(dato).some((c) => !!c && typeof c === "object" && Array.isArray((c as { keys?: unknown }).keys) && (c as { keys: unknown[] }).keys.length > 0);
}

/** Las propiedades animadas con ◇, con el nombre que entiende la IA. */
function fotogramasDe(el: TimelineElement): string[] {
	const animaciones = el.animations as Record<string, unknown> | undefined;
	if (!animaciones) return [];
	const grupos = new Set<string>();
	for (const [ruta, dato] of Object.entries(animaciones)) {
		if (!conFotogramas(dato)) continue;
		if (ruta.startsWith("transform.position")) grupos.add("posicion");
		else if (ruta.startsWith("transform.scale")) grupos.add("escala");
		else if (ruta === "transform.rotate") grupos.add("rotacion");
		else if (ruta === "opacity") grupos.add("opacidad");
		else if (ruta === "volume") grupos.add("volumen");
		else if (ruta === "color") grupos.add("color");
		else if (ruta === "fontSize") grupos.add("tamano");
		else if (ruta.startsWith("background.")) grupos.add("fondo");
		else if (ruta.startsWith("effects.")) grupos.add("efectos");
		else grupos.add(ruta);
	}
	return [...grupos];
}

function leerEstilo(p: ParamValues): EstiloLeido {
	const colores = {
		trazo: color(p[TEXTO.trazoColor], DEFAULTS_TEXTO.trazoColor),
		sombra: color(p[TEXTO.sombraColor], DEFAULTS_TEXTO.sombraColor),
		fondo: color(p["background.color"], "#000000"),
		resplandor: color(p[TEXTO.brilloColor], DEFAULTS_TEXTO.brilloColor),
	};
	const mayusculas = String(p[TEXTO.mayusculas] ?? "ninguno");
	return {
		fuente: String(p.fontFamily ?? "Arial"),
		tamano: num(p, "fontSize", 15),
		color: color(p.color, "#ffffff"),
		negrita: p.fontWeight === "bold",
		cursiva: p.fontStyle === "italic",
		subrayado: p.textDecoration === "underline",
		mayusculas: (["ninguno", "mayusculas", "minusculas", "titulo"].includes(mayusculas) ? mayusculas : "ninguno") as EstiloLeido["mayusculas"],
		alineacion: ALINEACION_CHAT[String(p.textAlign ?? "center")] ?? "centro",
		espaciado: num(p, "letterSpacing", 0),
		interlineado: num(p, "lineHeight", 1.2),
		trazo: p[TEXTO.trazoActivo] === true ? colores.trazo : false,
		grosor_trazo: num(p, TEXTO.trazoGrosor, DEFAULTS_TEXTO.trazoGrosor),
		sombra: p[TEXTO.sombraActiva] === true ? colores.sombra : false,
		fondo: p["background.enabled"] === true ? colores.fondo : false,
		opacidad_fondo: num(p, TEXTO.fondoOpacidad, DEFAULTS_TEXTO.fondoOpacidad),
		resplandor: p[TEXTO.brilloActivo] === true ? colores.resplandor : false,
		colores,
		resaltar: {
			modo: p[PARAM_RESALTAR] === "palabra" || p[PARAM_RESALTAR] === "frase" ? p[PARAM_RESALTAR] : "ninguno",
			color: color(p[PARAM_RESALTAR_COLOR], DEFAULTS_RESALTADO.color),
			opacidad_no_dichas: num(p, PARAM_NO_DICHAS_OPACIDAD, DEFAULTS_RESALTADO.noDichasOpacidad),
		},
		animacion_palabra: ANIMS_PALABRA.includes(p[PARAM_ANIM_PALABRA] as AnimPalabra) ? (p[PARAM_ANIM_PALABRA] as AnimPalabra) : "ninguna",
		tamano_claves: num(p, PARAM_CLAVES_TAMANO, DEFAULTS_CLAVES.tamano),
	};
}

/** «resalta la palabra que se dice (#ffe14d) · lo no dicho al 35 %»: la fila de la revisión. */
function textoResaltar(r: ResaltarLeido): string {
	if (r.modo === "ninguno") return "sin resaltar";
	const que = r.modo === "palabra" ? "resalta la palabra que se dice" : "resalta lo ya dicho";
	return `${que} (${r.color})${r.opacidad_no_dichas < 100 ? ` · lo no dicho al ${r.opacidad_no_dichas} %` : ""}`;
}

function leerTransform(p: ParamValues): TransformLeido {
	const sx = num(p, "transform.scaleX", 1);
	const sy = num(p, "transform.scaleY", 1);
	const modo = String(p.blendMode ?? "normal");
	return {
		x: Math.round(num(p, "transform.positionX", 0)),
		// El motor guarda Y hacia ABAJO; la IA la ve hacia arriba, como el panel de CapCut.
		y: Math.round(-num(p, "transform.positionY", 0)) || 0,
		escala: r1(Math.abs(sx) * 100),
		proporcion: sx !== 0 ? sy / sx : 1,
		rotacion: r1(num(p, "transform.rotate", 0)),
		opacidad: Math.round(num(p, "opacity", 1) * 100),
		mezcla: MEZCLA_CHAT[modo] ?? modo,
	};
}

/** Lo que la revisión y la IA necesitan saber de un elemento, según su tipo. */
function leerEstado(
	el: TimelineElement,
	tipo: TipoRef,
	tps: number,
	mediosSinAudio: ReadonlySet<string>,
	tamanos: ReadonlyMap<string, { ancho: number; alto: number }> = new Map(),
): EstadoElemento {
	const p = el.params ?? {};
	const e: EstadoElemento = {};
	const fotogramas = fotogramasDe(el);
	if (fotogramas.length) e.fotogramas = fotogramas;

	if (el.type === "video" || el.type === "audio") {
		const retime = el.retime;
		const velocidad = retime && Number.isFinite(retime.rate) && retime.rate > 0 ? retime.rate : 1;
		e.velocidad = r2(velocidad);
		e.curva = retime?.mode === "curve" && retime.curva ? retime.curva.preset : null;
		e.cambiaTono = !!retime && retime.maintainPitch !== true;
		e.recorte = [r2(el.trimStart / tps / velocidad), r2(el.trimEnd / tps / velocidad)];
		e.fundidos = { entrada: num(p, FUNDIDO_ENTRADA, 0), salida: num(p, FUNDIDO_SALIDA, 0) };
		e.ruido = p[REDUCIR_RUIDO] === true;
		e.normalizado = p[NORMALIZAR] === true ? (OBJETIVO_CHAT[String(p[NORMALIZAR_OBJETIVO] ?? OBJETIVO_PREDETERMINADO)] ?? "predeterminado") : null;
	}
	if (el.type === "video") {
		e.audioSeparado = el.isSourceAudioEnabled === false;
		e.sinAudio = mediosSinAudio.has(el.mediaId);
		e.revertido = typeof p[CLAVE_REVERTIDO] === "string" && p[CLAVE_REVERTIDO] !== "";
	}
	if (el.type === "video" || el.type === "image") {
		const id = typeof p[PARAM_TRANSICION_ID] === "string" ? String(p[PARAM_TRANSICION_ID]) : "";
		e.transicion = id ? { id, duracion: num(p, PARAM_TRANSICION_DURACION, TRANSICION_POR_DEFECTO) } : null;
		const efectos = el.effects ?? [];
		const filtro = efectos.find((x) => x.type.startsWith(PREFIJO_FILTRO));
		e.filtro = filtro ? { tipo: filtro.type, intensidad: num(filtro.params, "intensidad", 100) } : null;
		e.efectos = efectos.filter((x) => x !== filtro && x.type !== TIPO_AJUSTE).map((x) => x.type);
		const ajuste = efectos.find((x) => x.type === TIPO_AJUSTE);
		e.ajustes = {};
		for (const [clave, def] of Object.entries(AJUSTES_COLOR) as Array<[ClaveAjuste, (typeof AJUSTES_COLOR)[ClaveAjuste]]>) {
			const v = ajuste ? num(ajuste.params, def.clave, 0) : 0;
			if (v !== 0) e.ajustes[clave] = v;
		}
		e.reflejo = { horizontal: p[REFLEJO_HORIZONTAL] === true, vertical: p[REFLEJO_VERTICAL] === true };
		// Como lo abre el diálogo «Recortar» (recorte/dialogo-recorte.tsx): el rectángulo y la proporción guardados.
		e.encuadre = { rect: rectDeParams(p), proporcion: proporcionDeParams(p) };
		const tamano = tamanos.get(el.mediaId);
		if (tamano) e.fuente = tamano;
		const broll = brollDe(el);
		if (broll) e.broll = broll.busqueda;
	}
	if (VISUALES.has(tipo)) {
		e.anim = {};
		for (const c of categoriasPara(el.type)) {
			if (p[ANIM[c].id] !== undefined) e.anim[ANIM[c].id] = p[ANIM[c].id];
			if (p[ANIM[c].duracion] !== undefined) e.anim[ANIM[c].duracion] = p[ANIM[c].duracion];
		}
		e.transform = leerTransform(p);
	}
	if (el.type === "text") {
		e.estilo = leerEstilo(p);
		// La regla del panel «Efectos» (text/components/pestana-texto.tsx → aplicarEfecto).
		if (p[TEXTO.curvaActiva] === true && !curvaBloqueada(p)) e.curvado = true;
		e.apariencia = Object.fromEntries(CLAVES_APARIENCIA.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
	}
	if (el.type === "effect") e.capa = el.effectType;
	if (tipo === "motion" && el.type === "graphic") {
		const plantilla = plantillaDeDefinicion(el.definitionId);
		if (plantilla) e.motion = { plantilla, valores: valoresDeParams(plantilla, p) };
	}
	return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que ve la IA
// ─────────────────────────────────────────────────────────────────────────────

function nombreDe(lista: ReadonlyArray<{ id: string; nombre: string }>, id: string): string {
	return lista.find((o) => o.id === id)?.nombre ?? id;
}

/** El id de un efecto del motor como lo ve la IA (el de `disponibles`, o el tipo sin prefijo). */
function idEfecto(d: Disponibles, tipo: string): string {
	return d.efectos.find((x) => x.tipo === tipo)?.id ?? tipo.replace(/^efecto\./, "");
}

function animacionesJson(e: EstadoElemento, D: number) {
	if (!e.anim) return undefined;
	const salida: Record<string, { id: string; duracion: number }> = {};
	for (const c of Object.keys(ANIM) as CategoriaAnimacion[]) {
		const preset = presetAnimacion(c, e.anim[ANIM[c].id]);
		if (!preset) continue;
		const d = e.anim[ANIM[c].duracion];
		salida[CATEGORIA_CHAT[c]] = { id: preset.id, duracion: r1(Math.min(typeof d === "number" ? d : preset.duracion, c === "bucle" ? 99 : D)) };
	}
	return Object.keys(salida).length ? salida : undefined;
}

/** El estilo de un texto, sólo lo que no es lo de siempre (fuente, tamaño y color van siempre). */
function estiloJson(s: EstiloLeido): Record<string, unknown> {
	return {
		fuente: s.fuente,
		tamano: s.tamano,
		color: s.color,
		...(s.negrita ? { negrita: true } : {}),
		...(s.cursiva ? { cursiva: true } : {}),
		...(s.subrayado ? { subrayado: true } : {}),
		...(s.mayusculas !== "ninguno" ? { mayusculas: s.mayusculas } : {}),
		...(s.alineacion !== "centro" ? { alineacion: s.alineacion } : {}),
		...(s.espaciado !== 0 ? { espaciado: s.espaciado } : {}),
		...(s.interlineado !== 1.2 ? { interlineado: s.interlineado } : {}),
		...(s.trazo ? { trazo: s.trazo, grosor_trazo: s.grosor_trazo } : {}),
		...(s.sombra ? { sombra: s.sombra } : {}),
		...(s.fondo ? { fondo: s.fondo, opacidad_fondo: s.opacidad_fondo } : {}),
		...(s.resplandor ? { resplandor: s.resplandor } : {}),
		...(s.resaltar.modo !== "ninguno" ? { resaltar: s.resaltar } : {}),
		...(s.animacion_palabra !== "ninguna" ? { animacion_palabra: s.animacion_palabra } : {}),
		...(s.tamano_claves !== DEFAULTS_CLAVES.tamano ? { tamano_claves: s.tamano_claves } : {}),
	};
}

function transformJson(t: TransformLeido): Record<string, unknown> | undefined {
	const o = {
		...(t.x !== 0 || t.y !== 0 ? { posicion: [t.x, t.y] } : {}),
		...(t.escala !== 100 ? { escala: t.escala } : {}),
		...(t.rotacion !== 0 ? { rotacion: t.rotacion } : {}),
		...(t.opacidad !== 100 ? { opacidad: t.opacidad } : {}),
		...(t.mezcla !== "normal" ? { mezcla: t.mezcla } : {}),
	};
	return Object.keys(o).length ? o : undefined;
}

/** El estado de un elemento en el JSON de la IA: sólo lo que no está en su valor por defecto. */
function estadoJson(r: RefElemento, d: Disponibles, estiloSubtitulos: string | null): Record<string, unknown> {
	const e = r.estado;
	const o: Record<string, unknown> = {};
	if (e.velocidad !== undefined && e.velocidad !== 1) o.velocidad = e.velocidad;
	if (e.curva) o.curva_velocidad = e.curva;
	if (e.recorte && (e.recorte[0] > 0.05 || e.recorte[1] > 0.05)) o.recorte = e.recorte;
	if (e.transicion) o.transicion = e.transicion;
	const anim = animacionesJson(e, r.fin - r.inicio);
	if (anim) o.animaciones = anim;
	if (e.filtro) o.filtro = { id: e.filtro.tipo.slice(PREFIJO_FILTRO.length), intensidad: e.filtro.intensidad };
	if (e.efectos?.length) o.efectos = e.efectos.map((t) => idEfecto(d, t));
	if (e.ajustes && Object.keys(e.ajustes).length) o.ajustes = e.ajustes;
	const rf = e.reflejo;
	if (rf && (rf.horizontal || rf.vertical)) o.reflejo = { ...(rf.horizontal ? { horizontal: true } : {}), ...(rf.vertical ? { vertical: true } : {}) };
	if (e.revertido) o.revertido = true;
	if (e.audioSeparado) o.audio_separado = true;
	if (e.sinAudio) o.sin_audio = true;
	if (e.fundidos && (e.fundidos.entrada > 0 || e.fundidos.salida > 0)) o.fundido = e.fundidos;
	if (e.ruido) o.reducir_ruido = true;
	if (e.normalizado) o.normalizado = e.normalizado;
	const t = e.transform ? transformJson(e.transform) : undefined;
	if (t) Object.assign(o, t);
	if (e.estilo) {
		const estilo = estiloJson(e.estilo);
		// Los subtítulos suelen tener todos el mismo: va una vez arriba y acá sólo el que difiere.
		if (!(r.subtitulo && estiloSubtitulos !== null && JSON.stringify(estilo) === estiloSubtitulos)) o.estilo = estilo;
	}
	if (e.capa) {
		const filtro = e.capa.startsWith(PREFIJO_FILTRO);
		o.capa = { tipo: filtro ? "filtro" : "efecto", id: filtro ? e.capa.slice(PREFIJO_FILTRO.length) : idEfecto(d, e.capa) };
	}
	if (e.encuadre && !esRectCompleto(e.encuadre.rect)) {
		o.encuadre = { ...encuadreJson(e.encuadre.rect), ...(e.encuadre.proporcion !== "libre" ? { proporcion: e.encuadre.proporcion } : {}) };
	}
	if (e.curvado) o.curvado = true;
	if (e.broll) o.broll = e.broll;
	if (e.fotogramas?.length) o.fotogramas = e.fotogramas;
	return o;
}

/** Lo que se le muestra de un texto de motion (el tope más largo de una plantilla: los datos de las barras). */
const MOTION_TEXTO_VISTA = 240;

/**
 * Un motion graphic como lo lee la IA: su plantilla y sus valores de AHORA. De sus campos, los que no están vacíos; de
 * los comunes, el tono siempre (UN tono para todo el video) y los demás sólo si no están en su valor por defecto.
 */
function motionJson(m: MotionLeido): Record<string, unknown> {
	const porDefecto = valoresPorDefecto(m.plantilla);
	const propios = new Set(DEF_MOTION[m.plantilla].campos.map((c) => c.clave));
	const valores: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(m.valores)) {
		if (propios.has(k)) {
			if (v !== "") valores[k] = typeof v === "string" ? corto(v, MOTION_TEXTO_VISTA) : v;
		} else if (k === "tono" || v !== porDefecto[k]) valores[k] = v;
	}
	return { plantilla: m.plantilla, valores };
}

/** Lo disponible del motor como lo lee la IA: id → nombre en español. */
function disponiblesJson(d: Disponibles): Record<string, unknown> | undefined {
	if (!d.transiciones.length && !d.filtros.length && !d.efectos.length) return undefined;
	const mapa = (lista: ReadonlyArray<{ id: string; nombre: string; soloTexto?: boolean }>) =>
		Object.fromEntries(lista.map((o) => [o.id, o.soloTexto ? `${o.nombre} (sólo texto)` : o.nombre]));
	return {
		transiciones: mapa(d.transiciones),
		animaciones: Object.fromEntries((Object.keys(d.animaciones) as CategoriaAnimacion[]).map((c) => [CATEGORIA_CHAT[c], mapa(d.animaciones[c])])),
		filtros: mapa(d.filtros),
		efectos: mapa(d.efectos),
		curvas_velocidad: Object.fromEntries(d.curvas.map((c) => [c.id, `${c.nombre} (media ${textoNumero(c.media)}×)`])),
		fuentes_sugeridas: d.fuentes.sugeridas,
		...(d.efectosTexto?.length ? { efectos_texto: mapa(d.efectosTexto) } : {}),
		...(d.plantillasTexto?.length ? { plantillas_texto: mapa(d.plantillasTexto) } : {}),
		...(d.presets?.length
			? { presets_subtitulos: Object.fromEntries(d.presets.map((p) => [p.id, `${p.nombre}${p.marca ? ` (${p.marca})` : ""}: ${p.resumen}`])) }
			: {}),
		// La galería de Subtítulos › Plantillas, siempre (10/11/2026): «estilo Hormozi» por chat armaba otra cosa (karaoke y
		// salto) porque el chat no la veía. Se usan con `usar_preset_subtitulos`.
		plantillas_subtitulos: Object.fromEntries(PLANTILLAS_SUBTITULO.map((p) => [p.id, resumenPlantillaSubtitulo(p)])),
	};
}

/** Una plantilla de fábrica de subtítulos en palabras, como la lee la IA: «Hormozi: Anton, mayúsculas, contorno #ffe14d…». */
export function resumenPlantillaSubtitulo(p: PlantillaSubtitulo): string {
	const partes = [
		p.fuente,
		p.mayusculas ? "mayúsculas" : p.minusculas ? "minúsculas" : "",
		p.color !== "#ffffff" ? `letra ${p.color}` : "",
		p.trazo ? `contorno ${p.trazo.color}` : "",
		p.fondo ? "con fondo" : "",
		p.resaltado ? `karaoke ${p.resaltado.modo === "palabra" ? "por palabra" : "por frase"} ${p.resaltado.color}` : "",
		p.animPalabra === "pop" ? "la palabra salta" : p.animPalabra === "crecer" ? "la palabra crece" : "",
		p.clavesTamano && p.clavesTamano !== 100 ? `palabras clave al ${p.clavesTamano} %${p.clavesColor ? ` en ${p.clavesColor}` : ""}` : "",
	].filter(Boolean);
	return `${p.nombre}: ${partes.join(", ")}`;
}

/** La plantilla de fábrica que nombra el chat, por id o por nombre (sin tildes ni mayúsculas). */
export function plantillaSubtituloDelChat(cual: string): PlantillaSubtitulo | null {
	const llano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
	const buscado = llano(cual);
	return PLANTILLAS_SUBTITULO.find((p) => p.id === buscado || llano(p.nombre) === buscado) ?? null;
}

/** Lo que una plantilla dejó marcado en un elemento, como lo lee el chat (y el tope de su texto, del catálogo). */
function deHueco(el: TimelineElement, m: MarcasPlantilla | null): Partial<RefElemento> {
	if (!m?.hueco) return {};
	const clip = el.type === "video" || el.type === "image";
	const plantilla = el.type === "text" ? plantillaPorId(m.plantilla) : null;
	const tope = plantilla ? huecosDe(plantilla).find((h) => h.nombre === m.hueco && h.tipo === "texto")?.maxCaracteres : undefined;
	return {
		plantilla: m.plantilla,
		hueco: m.hueco,
		...(clip && m.muestra ? { muestra: true } : {}),
		...(m.opcional ? { opcional: true } : {}),
		...(m.silenciar ? { silenciar: true } : {}),
		...(tope ? { maxCaracteres: tope } : {}),
	};
}

/**
 * La escena para la IA. `refsPrevias` (id → ref, de los elementos y de los medios) conserva
 * las referencias de una vista anterior: al ACEPTAR se vuelve a mirar la línea de tiempo de
 * ese momento, y «t2» tiene que seguir siendo el mismo texto aunque se haya agregado otro
 * adelante (y «m2», el mismo medio aunque se haya importado otro).
 */
export function vistaDeLinea({
	tracks,
	tps,
	cabezal,
	elegidos,
	refsPrevias,
	disponibles = DISPONIBLES_VACIOS,
	lienzo = null,
	mediosSinAudio = new Set<string>(),
	conPalabras = false,
	medios = [],
	fondo = null,
}: {
	tracks: SceneTracks;
	tps: number;
	cabezal: number;
	elegidos: ReadonlyArray<{ trackId: string; elementId: string }>;
	refsPrevias?: ReadonlyMap<string, string>;
	/** Multimedia (editor.media.getAssets()): se listan los videos y las fotos, sin los ocultos. */
	medios?: ReadonlyArray<MedioVista>;
	disponibles?: Disponibles;
	/** El tamaño del lienzo en píxeles (para que la IA ubique con «transformar»). */
	lienzo?: { ancho: number; alto: number } | null;
	/** Los medios que no tienen sonido (no se separa ni se normaliza su audio). */
	mediosSinAudio?: ReadonlySet<string>;
	/** Hay subtítulos con tiempos por palabra (cortar_frase, eliminar_muletillas). */
	conPalabras?: boolean;
	/** El fondo del lienzo (proyecto.settings.background): fondo_lienzo. */
	fondo?: TBackground | null;
}): VistaLinea {
	const refs = new Map<string, RefElemento>();
	// El tamaño de cada archivo: el encuadre por proporción lo necesita (como el diálogo «Recortar»).
	const tamanos = new Map<string, { ancho: number; alto: number }>();
	for (const m of medios) if (m.width && m.height && m.width > 0 && m.height > 0) tamanos.set(m.id, { ancho: m.width, alto: m.height });
	const usadas = new Set(refsPrevias ? [...refsPrevias.values()] : []);
	const contador: Record<string, number> = {};
	const nueva = (prefijo: string) => {
		let n = contador[prefijo] ?? 0;
		let r: string;
		do { n += 1; r = `${prefijo}${n}`; } while (usadas.has(r));
		contador[prefijo] = n;
		usadas.add(r);
		return r;
	};

	// De arriba hacia abajo, como se ven: superposiciones (la 0 es la de más arriba), la
	// principal y los audios.
	const pistas: Array<{ track: TimelineTrack; principal: boolean }> = [
		...tracks.overlay.map((track) => ({ track: track as TimelineTrack, principal: false })),
		{ track: tracks.main as TimelineTrack, principal: true },
		...tracks.audio.map((track) => ({ track: track as TimelineTrack, principal: false })),
	];

	let fin = 0;
	const porPista = pistas.map(({ track, principal }) => {
		const bloqueada = track.locked === true;
		const lista = [...(track.elements as TimelineElement[])]
			.sort((a, b) => a.startTime - b.startTime)
			.map((el) => {
				const tipo = tipoDe(el);
				const ref = refsPrevias?.get(el.id) ?? nueva(PREFIJO[el.type]);
				const inicio = seg(el.startTime, tps);
				const finEl = seg(el.startTime + el.duration, tps);
				if (finEl > fin) fin = finEl;
				const texto = el.type === "text" ? String(el.params?.content ?? "") : undefined;
				const sonoro = el.type === "video" || el.type === "audio";
				const r: RefElemento = {
					ref,
					trackId: track.id,
					elementId: el.id,
					tipo,
					titulo: texto !== undefined ? `«${corto(texto.replace(/\s+/g, " ").trim() || "Texto", 40)}»` : corto(el.name || ROTULO[tipo], 40),
					inicio,
					fin: finEl,
					bloqueada,
					principal,
					...(texto !== undefined ? { texto } : {}),
					...(sonoro ? { volumenDb: Number(el.params?.volume ?? 0) || 0, silenciado: el.params?.muted === true } : {}),
					...("hidden" in el ? { oculto: el.hidden === true } : {}),
					...(el.type === "text" && el.params?.subtitulo === true ? { subtitulo: true } : {}),
					...(el.type === "text" && el.params?.subtitulo === true && leerClaves(el.params?.[PARAM_CLAVES]).length
						? { claves: leerClaves(el.params?.[PARAM_CLAVES]) }
						: {}),
					...(el.type === "sticker" && typeof el.params?.[PARAM_EMOJI_DE] === "string" && el.params[PARAM_EMOJI_DE] !== "" ? { emojiSubtitulo: true } : {}),
					...(el.type === "audio" && typeof el.params?.[EXTRAIDO_DE] === "string" ? { extraido: true } : {}),
					...(el.type === "video" || el.type === "image" ? { mediaId: el.mediaId, acepta: aceptaDe(el.params ?? {}) } : {}),
					...deHueco(el, leerMarcas(el.params)),
					estado: leerEstado(el, tipo, tps, mediosSinAudio, tamanos),
				};
				refs.set(ref, r);
				return { r, texto, sonoro };
			});
		return { track, principal, bloqueada, lista };
	});

	// El estilo de los subtítulos va una vez (el del primero); cada uno lleva el suyo sólo si difiere.
	const primerSubtitulo = [...refs.values()].filter((r) => r.subtitulo && r.estado.estilo).sort((a, b) => a.inicio - b.inicio)[0];
	const estiloSubtitulos = primerSubtitulo?.estado.estilo ? JSON.stringify(estiloJson(primerSubtitulo.estado.estilo)) : null;

	const pistasJson = porPista.map(({ track, principal, bloqueada, lista }) => ({
		tipo: TIPO_PISTA[track.type],
		...(principal ? { principal: true } : {}),
		...(bloqueada ? { bloqueada: true } : {}),
		// Un emoji automático va compacto (sin estado: animaciones, posición): son uno por subtítulo y, enteros,
		// duplicaban la vista de un video largo hasta pasar su tope (revisión del 10/11/2026).
		elementos: lista.map(({ r, texto, sonoro }) => r.emojiSubtitulo ? { ref: r.ref, tipo: r.tipo, nombre: corto(r.titulo, 20), inicio: r.inicio, fin: r.fin, emoji_de_subtitulo: true } : ({
			ref: r.ref,
			tipo: r.tipo,
			...(texto !== undefined ? { texto: corto(texto, TOPES_CHAT.texto) } : { nombre: corto(r.titulo, 60) }),
			inicio: r.inicio,
			fin: r.fin,
			...(sonoro ? { volumen_db: r.volumenDb, silenciado: r.silenciado } : {}),
			...(r.oculto ? { oculto: true } : {}),
			...(r.subtitulo ? { subtitulo: true } : {}),
			...(r.claves?.length ? { palabras_clave: r.claves } : {}),
			...(r.emojiSubtitulo ? { emoji_de_subtitulo: true } : {}),
			...(r.hueco ? { hueco: r.hueco } : {}),
			...(r.muestra ? { muestra: true, ...(r.opcional ? { opcional: true } : {}) } : {}),
			...(r.acepta && r.acepta !== "ambos" ? { acepta: r.acepta } : {}),
			...(r.maxCaracteres ? { max_caracteres: r.maxCaracteres } : {}),
			...(r.estado.motion ? motionJson(r.estado.motion) : {}),
			...estadoJson(r, disponibles, estiloSubtitulos),
		})),
	}));

	// Multimedia: los videos y las fotos que se pueden usar (sin los ocultos: muestras,
	// cuadros congelados, revertidos), con la misma regla que el diálogo «Reemplazar el clip».
	const usables = mediosParaReemplazo(medios, "ambos");
	const mediosRefs = new Map<string, RefMedio>();
	for (const a of usables.slice(0, TOPES_CHAT.medios)) {
		const ref = refsPrevias?.get(a.id) ?? nueva("m");
		const video = a.type === "video";
		mediosRefs.set(ref, {
			ref,
			mediaId: a.id,
			nombre: a.name,
			tipo: video ? "video" : "imagen",
			...(video ? { duracion: a.duration ?? 0 } : {}),
			...(video && a.hasAudio === false ? { sinAudio: true } : {}),
		});
	}
	const mediosJson = [...mediosRefs.values()].map((m) => ({
		ref: m.ref,
		nombre: corto(m.nombre, 60),
		tipo: m.tipo,
		...(m.duracion !== undefined ? { duracion: r2(m.duracion) } : {}),
		...(m.sinAudio ? { sin_audio: true } : {}),
	}));

	const porId = new Map([...refs.values()].map((r) => [r.elementId, r.ref] as const));
	const refsElegidas = elegidos.map((e) => porId.get(e.elementId)).filter((r): r is string => !!r);
	const fondoLeido = leerFondo(fondo);
	const json = JSON.stringify({
		duracion_total: fin,
		cabezal: seg(cabezal, tps),
		...(lienzo ? { lienzo } : {}),
		...(fondoLeido ? { fondo_lienzo: fondoLeido.tipo === "color" ? { color: fondoLeido.color } : { desenfoque: fondoLeido.nivel ?? fondoLeido.intensidad } } : {}),
		elegidos: refsElegidas,
		...(primerSubtitulo ? { transcripcion_por_palabra: conPalabras } : {}),
		...(estiloSubtitulos ? { estilo_subtitulos: JSON.parse(estiloSubtitulos) } : {}),
		pistas: pistasJson.filter((p) => p.elementos.length > 0 || p.tipo === "video"),
		medios: mediosJson,
		...(usables.length > TOPES_CHAT.medios ? { medios_sin_listar: usables.length - TOPES_CHAT.medios } : {}),
		...(disponiblesJson(disponibles) ? { disponibles: disponiblesJson(disponibles) } : {}),
	});
	return { json, refs, medios: mediosRefs, elegidos: refsElegidas, disponibles, lienzo, fondo: fondoLeido };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revisar lo que propuso la IA
// ─────────────────────────────────────────────────────────────────────────────

export type CambioChat = {
	tipo: "agrega" | "cambia" | "quita";
	titulo: string;
	antes: string;
	despues: string;
};

/** Una operación que se puede aplicar, con sus elementos ya resueltos (chat/comandos.ts la vuelve un comando). */
export type OperacionResuelta =
	/** `params`: los de una «Plantilla de texto», ya llevados al lienzo (paramsParaLienzo), como los agrega la biblioteca. */
	| { op: "agregar_texto"; texto: string; inicio: number; duracion: number; ref?: string; params?: ParamValues }
	/** `valores`: TODOS los params de la plantilla que se insertan (`valoresAlAgregar`); `duracion` ya resuelta. */
	| { op: "agregar_motion"; plantilla: IdPlantilla; valores: ValoresMotion; inicio: number; duracion: number; ref?: string }
	| { op: "cambiar_texto"; el: RefElemento; texto: string }
	| { op: "borrar"; els: RefElemento[] }
	| { op: "mover"; el: RefElemento; inicio: number }
	| { op: "duracion"; el: RefElemento; duracion: number }
	/**
	 * `base`: dónde empezaba el elemento en la simulación al pedirlo. Lo que se aplica
	 * antes en el mismo lote pudo correrlo (el imán junta la principal); los tiempos se
	 * aplican RELATIVOS a su lugar de ese momento (chat/comandos.ts). Absolutos, «recorta 2 s
	 * al inicio de cada clip» recortaba 2, 4 y 8 s.
	 */
	| { op: "dividir"; el: RefElemento; en: number; base: number }
	| { op: "recortar"; el: RefElemento; inicio?: number; fin?: number; base: number }
	| { op: "volumen"; el: RefElemento; db: number }
	| { op: "silenciar"; el: RefElemento; silenciado: boolean }
	| { op: "ocultar"; el: RefElemento; oculto: boolean }
	/** Escribir params del elemento (transición, animación, estilo, posición, reflejo, fundidos…): el `updateElements` del panel. */
	| { op: "params"; de: OperacionChat["op"]; el: RefElemento; params: ParamValues }
	| { op: "velocidad"; el: RefElemento; rate: number | null; curva: string | null; cambiarTono?: boolean }
	| { op: "filtro"; el: RefElemento; tipo: string | null; intensidad: number }
	| { op: "efecto"; el: RefElemento; tipo: string; quitar: boolean }
	| { op: "capa_efecto"; tipo: string; inicio: number; duracion: number; ref?: string }
	/** Claves del efecto `ajuste` del motor → valor. */
	| { op: "ajustar_color"; el: RefElemento; valores: Record<string, number> }
	| { op: "separar_audio"; el: RefElemento }
	/** «Reemplazar el clip» con el medio `mediaId` (si es una muestra, también las de su hueco). */
	| { op: "reemplazar_clip"; el: RefElemento; mediaId: string }
	| { op: "reemplazar_en_subtitulos"; buscar: string; reemplazo: string; cuantos: number }
	// Al final, en este orden: los cortes (dentro del lote) y lo que tarda (después).
	| { op: "cortar_tramo"; inicio: number; fin: number }
	| { op: "cortar_frase"; frase: string; vez?: number }
	| { op: "eliminar_muletillas" }
	| { op: "revertir"; el: RefElemento }
	/** `desde`: segundos desde el principio del clip, como lo vio la IA. */
	| { op: "congelar"; el: RefElemento; desde: number }
	| { op: "normalizar"; el: RefElemento; objetivo: string }
	| { op: "generar_subtitulos" }
	/** «Borrar silencios» de estos clips: escucha el audio al aceptar (audio/borrar-silencios.ts), por eso va último.
	 *  `todo`: se pidió para todo el video (sin "ref" ni selección), y el aviso lo dice; `minimoS`: la pausa más corta. */
	| { op: "borrar_silencios"; els: RefElemento[]; todo: boolean; minimoS: number }
	/** Sola, con la línea de tiempo vacía. `medios`: hueco → id del medio de Multimedia. */
	| { op: "usar_plantilla"; plantilla: string; textos: Record<string, string>; medios: Record<string, string> }
	/** Un preset de la marca a TODOS los subtítulos (subtitles/presets.ts → aplicarPreset): vuelve a partir los renglones, después del lote. */
	| { op: "usar_preset_subtitulos"; preset: string }
	/** Una plantilla de fábrica de subtítulos (subtitles/estilos.ts), a TODOS: lo mismo que tocar su tarjeta. */
	| { op: "usar_plantilla_subtitulos"; plantilla: string }
	/** Un estilo que cambia el ancho del renglón (fuente, tamaño…) a ESTOS subtítulos (subtitles/insert.ts →
	 *  aplicarEstiloASubtitulos, el de «Aplicar en todos»): vuelve a partir los renglones, después del lote. */
	| { op: "estilo_subtitulos"; els: RefElemento[]; params: ParamValues }
	/** «B-roll de MaKo» (broll/proponer.ts): propone fotos y cambios de plano, después del lote (lee los subtítulos de ESE momento). */
	| { op: "broll"; ritmo: "poco" | "normal" | "mucho"; planos: boolean; videos: boolean }
	/** «Otra» de «B-roll de MaKo» (broll/cambiar.ts): la siguiente de la misma búsqueda, después del lote (baja de Pexels). */
	| { op: "cambiar_broll"; el: RefElemento; busqueda: string }
	/** «Clips mágicos» (clips/buscar.ts): busca los momentos, después del lote; no cambia este proyecto. */
	| { op: "clips_magicos"; cuantos: number }
	/** «Emojis automáticos» (subtitles/emojis-poner.ts): ponerlos o sacarlos, al final de todo (lee los subtítulos de ESE momento). */
	| { op: "emojis_subtitulos"; activar: boolean }
	/** «Edición automática» (enjambre/correr.ts): los agentes, cada uno con su paso; SOLA, después del lote. */
	| { op: "edicion_automatica" }
	/** «Duplicar» (DuplicateElementsCommand, el del botón): `copia`, la ref nueva de la copia. */
	| { op: "duplicar"; el: RefElemento; copia?: string }
	/** El fondo del lienzo: UpdateProjectSettingsCommand, el del panel Proyecto › Fondo. */
	| { op: "fondo_lienzo"; fondo: TBackground }
	/** Un emoji de la biblioteca como sticker (`stickerId` «emojis:1f525»), como la tarjeta de Stickers › Emojis. */
	| { op: "agregar_emoji"; emoji: string; stickerId: string; inicio: number; duracion: number; ref?: string }
	/**
	 * Ticket 73: medios de Multimedia al FINAL de la pista principal, en este orden (el ⊕ de cada tarjeta de Multimedia).
	 * El final se mide AL EJECUTAR (chat/comandos.ts): lo de antes en el lote pudo correrlo. `ref`: la nueva, si vino.
	 */
	| { op: "agregar_medios"; medios: Array<{ mediaId: string; ref?: string }> };

/**
 * `encadenadas` (12/11/2026): lo que depende de algo que crea ESTE pedido y por eso todavía no se puede revisar —el estilo
 * o las palabras clave de los subtítulos que se generan ahora, los silencios de la toma que se pone ahora, las palabras
 * clave que pisaría una plantilla de subtítulos que se aplica al final—. Va a la revisión de la vuelta siguiente, contra
 * la línea de tiempo que dejó ésta (chat/aplicar.ts → `aceptarPropuesta`), y tiene su fila en `cambios`. Antes se descartaba
 * («todavía no existen: pide el preset después»): la receta de un reel replicado salía en dos pedidos (Martín, 12/11).
 */
export type Revision = { resueltas: OperacionResuelta[]; cambios: CambioChat[]; descartes: string[]; encadenadas?: OperacionChat[] };

/** Las vueltas que da «Aceptar» con lo encadenado (subtítulos → su estilo → las palabras clave que pisaría el estilo). */
export const VUELTAS_ENCADENADAS = 3;

/** La transcripción del momento (transcripcion/modelo.ts) y el idioma de las muletillas. */
export type TranscripcionChat = { parrafos: readonly ParrafoTx[]; idioma: string };

const CON_DURACION_LIBRE = new Set<TipoRef>(["texto", "imagen", "sticker", "grafico", "efecto", "motion"]);
const SONOROS = new Set<TipoRef>(["video", "audio"]);
const VISUALES = new Set<TipoRef>(["video", "imagen", "texto", "sticker", "grafico", "motion"]);
const CLIPS = new Set<TipoRef>(["video", "imagen"]);
/** Un corte a menos de esto de un borde deja un pedazo que no se ve. */
const MARGEN_CORTE = 0.05;
/** Lo mínimo que puede durar un clip después de un recorte o una velocidad (pc_clip_too_short). */
const LARGO_MINIMO = 0.1;
/** Un subtítulo se vuelve a partir si cambia esto (subtitles/repartir.ts): desde el chat, con `estilo_subtitulos`. */
const ESTILO_QUE_PARTE: ReadonlyArray<keyof EstiloTextoChat> = ["fuente", "tamano", "negrita", "cursiva", "espaciado", "mayusculas"];

const ETIQUETA_ESTILO: Record<keyof EstiloTextoChat, string> = {
	fuente: "fuente", tamano: "tamaño", color: "color", negrita: "negrita", cursiva: "cursiva", subrayado: "subrayado",
	mayusculas: "mayúsculas", alineacion: "alineación", espaciado: "espaciado", interlineado: "interlineado", trazo: "trazo",
	grosor_trazo: "grosor del trazo", sombra: "sombra", fondo: "fondo", opacidad_fondo: "opacidad del fondo", resplandor: "resplandor",
};
const ETIQUETA_TRANSFORM: Record<keyof TransformChat, string> = { x: "x", y: "y", escala: "escala", rotacion: "rotación", opacidad: "opacidad", mezcla: "mezcla" };
/** La propiedad con ◇ que bloquea cada campo (fotogramasDe). */
const FOTOGRAMA_TRANSFORM: Record<keyof TransformChat, string | null> = { x: "posicion", y: "posicion", escala: "escala", rotacion: "rotacion", opacidad: "opacidad", mezcla: null };
const FOTOGRAMA_ESTILO: Partial<Record<keyof EstiloTextoChat, string>> = { color: "color", tamano: "tamano", fondo: "fondo", opacidad_fondo: "fondo" };

const valorTexto = (v: unknown, sufijo = ""): string =>
	v === true ? "sí" : v === false ? "no" : typeof v === "number" ? `${textoNumero(v)}${sufijo}` : String(v);

/** Las filas «Original | Modificado» de un cambio de varios campos; null si nada cambia. */
function filaCampos(titulo: string, campos: ReadonlyArray<[string, unknown, unknown, string?]>): CambioChat | null {
	const cambian = campos.filter(([, a, d]) => a !== d);
	if (!cambian.length) return null;
	return {
		tipo: "cambia",
		titulo,
		antes: cambian.map(([e, a, , s]) => `${e} ${valorTexto(a, s)}`).join(" · "),
		despues: cambian.map(([e, , d, s]) => `${e} ${valorTexto(d, s)}`).join(" · "),
	};
}

/** El estilo nuevo y los params del motor que lo escriben (lo mismo que hace la pestaña Texto). */
function aplicarEstilo(actual: EstiloLeido, e: EstiloTextoChat): { nuevo: EstiloLeido; params: ParamValues } {
	const nuevo: EstiloLeido = { ...actual, colores: { ...actual.colores } };
	const params: ParamValues = {};
	if (e.fuente !== undefined) { nuevo.fuente = e.fuente; params.fontFamily = e.fuente; }
	if (e.tamano !== undefined) { nuevo.tamano = e.tamano; params.fontSize = e.tamano; }
	if (e.color !== undefined) { nuevo.color = e.color; params.color = e.color; }
	if (e.negrita !== undefined) { nuevo.negrita = e.negrita; params.fontWeight = e.negrita ? "bold" : "normal"; }
	if (e.cursiva !== undefined) { nuevo.cursiva = e.cursiva; params.fontStyle = e.cursiva ? "italic" : "normal"; }
	if (e.subrayado !== undefined) { nuevo.subrayado = e.subrayado; params.textDecoration = e.subrayado ? "underline" : "none"; }
	if (e.mayusculas !== undefined) { nuevo.mayusculas = e.mayusculas; params[TEXTO.mayusculas] = e.mayusculas; }
	if (e.alineacion !== undefined) { nuevo.alineacion = e.alineacion; params.textAlign = ALINEACION_MOTOR[e.alineacion]; }
	if (e.espaciado !== undefined) { nuevo.espaciado = e.espaciado; params.letterSpacing = e.espaciado; }
	if (e.interlineado !== undefined) { nuevo.interlineado = e.interlineado; params.lineHeight = e.interlineado; }
	// Un color prende la sección con ese color; un grosor u opacidad sueltos la prenden con el que tenía.
	const prender = (
		valor: string | boolean | undefined,
		activo: string,
		claveColor: string,
		campo: "trazo" | "sombra" | "fondo" | "resplandor",
	) => {
		if (valor === undefined) return;
		if (valor === false) { nuevo[campo] = false; params[activo] = false; return; }
		const c = valor === true ? nuevo.colores[campo] : valor;
		nuevo.colores[campo] = c;
		nuevo[campo] = c;
		params[activo] = true;
		params[claveColor] = c;
	};
	prender(e.trazo, TEXTO.trazoActivo, TEXTO.trazoColor, "trazo");
	prender(e.sombra, TEXTO.sombraActiva, TEXTO.sombraColor, "sombra");
	prender(e.fondo, "background.enabled", "background.color", "fondo");
	prender(e.resplandor, TEXTO.brilloActivo, TEXTO.brilloColor, "resplandor");
	if (e.grosor_trazo !== undefined) {
		nuevo.grosor_trazo = e.grosor_trazo;
		params[TEXTO.trazoGrosor] = e.grosor_trazo;
		if (e.trazo === undefined && nuevo.trazo === false) prender(true, TEXTO.trazoActivo, TEXTO.trazoColor, "trazo");
	}
	if (e.opacidad_fondo !== undefined) {
		nuevo.opacidad_fondo = e.opacidad_fondo;
		params[TEXTO.fondoOpacidad] = e.opacidad_fondo;
		if (e.fondo === undefined && nuevo.fondo === false) prender(true, "background.enabled", "background.color", "fondo");
	}
	return { nuevo, params };
}

/**
 * El estilo después de un «Efecto de texto»: sólo cambia lo que el efecto escribe (`applyElementUpdate` MEZCLA los
 * params), así que un color o un grosor que el efecto no trae quedan como estaban.
 */
function estiloConEfecto(actual: EstiloLeido, params: ParamValues): EstiloLeido {
	const leido = leerEstilo({ ...params });
	const trae = (k: string) => params[k] !== undefined;
	const colores = {
		trazo: trae(TEXTO.trazoColor) ? leido.colores.trazo : actual.colores.trazo,
		sombra: trae(TEXTO.sombraColor) ? leido.colores.sombra : actual.colores.sombra,
		fondo: trae("background.color") ? leido.colores.fondo : actual.colores.fondo,
		resplandor: trae(TEXTO.brilloColor) ? leido.colores.resplandor : actual.colores.resplandor,
	};
	const activo = (clave: string, antes: string | false, c: string): string | false =>
		trae(clave) ? (params[clave] === true ? c : false) : antes === false ? false : c;
	return {
		...actual,
		color: trae("color") ? leido.color : actual.color,
		colores,
		trazo: activo(TEXTO.trazoActivo, actual.trazo, colores.trazo),
		grosor_trazo: trae(TEXTO.trazoGrosor) ? leido.grosor_trazo : actual.grosor_trazo,
		sombra: activo(TEXTO.sombraActiva, actual.sombra, colores.sombra),
		fondo: activo("background.enabled", actual.fondo, colores.fondo),
		opacidad_fondo: trae(TEXTO.fondoOpacidad) ? leido.opacidad_fondo : actual.opacidad_fondo,
		resplandor: activo(TEXTO.brilloActivo, actual.resplandor, colores.resplandor),
	};
}

/** «color #ffffff · trazo #000000 · fondo #e5283a»: la apariencia de un texto (lo que cambia un efecto), en una frase. */
function textoApariencia(s: EstiloLeido): string {
	return [
		`color ${s.color}`,
		s.trazo ? `trazo ${s.trazo}` : "",
		s.sombra ? "sombra" : "",
		s.resplandor ? `brillo ${s.resplandor}` : "",
		s.fondo ? `fondo ${s.fondo}${s.opacidad_fondo < 100 ? ` al ${s.opacidad_fondo} %` : ""}` : "",
	].filter(Boolean).join(" · ");
}

/** Las animaciones activas de un elemento, en una frase («entrada Rebote 0,5 s · salida Caída 0,5 s»). */
function textoAnimaciones(anim: ParamValues | undefined, d: Disponibles): string {
	const partes: string[] = [];
	for (const c of Object.keys(ANIM) as CategoriaAnimacion[]) {
		const preset = presetAnimacion(c, anim?.[ANIM[c].id]);
		if (!preset) continue;
		const dur = anim?.[ANIM[c].duracion];
		partes.push(`${CATEGORIA_CHAT[c]} ${nombreDe(d.animaciones[c], preset.id)} ${textoSegundos(typeof dur === "number" ? dur : preset.duracion)}`);
	}
	return partes.join(" · ") || "sin animación";
}

/**
 * Lo que propuso la IA, contra la vista con la que se pidió. `alcance: "seleccion"` deja
 * tocar sólo lo elegido (agregar algo nuevo y los cambios de todo el video —subtítulos,
 * cortes—, sí). Las filas que devuelve son las de «Original | Modificado».
 */
export function revisarOperaciones({
	operaciones: pedidas,
	vista,
	alcance,
	transcripcion,
}: {
	operaciones: readonly OperacionChat[];
	vista: Pick<VistaLinea, "refs" | "elegidos"> & Partial<Pick<VistaLinea, "disponibles" | "medios" | "lienzo" | "fondo">>;
	alcance: "video" | "seleccion";
	/** Los subtítulos con tiempos por palabra (cortar_frase, eliminar_muletillas). */
	transcripcion?: TranscripcionChat;
}): Revision {
	const d = vista.disponibles ?? DISPONIBLES_VACIOS;
	const medios = vista.medios ?? new Map<string, RefMedio>();
	const lienzo = vista.lienzo ?? null;
	// El fondo del lienzo, simulado: un segundo fondo_lienzo en el mismo pedido parte del primero.
	let fondo = vista.fondo ?? null;
	const resueltas: OperacionResuelta[] = [];
	const cambios: CambioChat[] = [];
	const descartes: string[] = [];
	// La simulación: dónde queda cada elemento y cómo, a medida que se aplican las anteriores.
	type Sim = { inicio: number; fin: number; borrado: boolean; texto?: string; volumenDb?: number; silenciado?: boolean; oculto?: boolean; muestra?: boolean; e: EstadoElemento };
	const refs = new Map(vista.refs);
	const estado = new Map<string, Sim>();
	const simular = (r: RefElemento) =>
		estado.set(r.ref, { inicio: r.inicio, fin: r.fin, borrado: false, texto: r.texto, volumenDb: r.volumenDb, silenciado: r.silenciado, oculto: r.oculto, muestra: r.muestra, e: JSON.parse(JSON.stringify(r.estado)) as EstadoElemento });
	for (const r of refs.values()) simular(r);
	const elegidos = new Set(vista.elegidos);

	/** usar_plantilla, con sus medios resueltos (lo que no sirve queda con su muestra, y se dice). */
	const resolverPlantilla = (op: Extract<OperacionChat, { op: "usar_plantilla" }>) => {
		const p = plantillaPorId(op.id);
		if (!p) { descartes.push(`no existe la plantilla «${corto(op.id, 30)}»`); return; }
		const huecos = new Map(huecosDe(p).map((h) => [h.nombre, h]));
		const filas: CambioChat[] = [];
		const llenos: Record<string, string> = {};
		for (const [nombre, refMedio] of Object.entries(op.clips)) {
			const h = huecos.get(nombre);
			const m = medios.get(refMedio);
			if (!h || h.tipo !== "clip") { descartes.push(`la plantilla no tiene el hueco de clip «${corto(nombre, 30)}»`); continue; }
			if (!m) { descartes.push(`no encontré el medio «${corto(refMedio, 20)}» en Multimedia: «${nombre}» queda con la muestra`); continue; }
			if (!aceptaMedio(h.acepta ?? "ambos", m.tipo === "video" ? "video" : "image")) {
				descartes.push(`«${nombre}» pide ${h.acepta === "video" ? "un video" : "una foto"}: queda con la muestra`);
				continue;
			}
			// Como el armado (plantillas/armar.ts): un video más corto que su hueco no entra.
			if (m.tipo === "video" && (m.duracion ?? 0) + 0.0005 < h.segundos) {
				descartes.push(`«${corto(m.nombre, 40)}» dura ${textoSegundos(m.duracion ?? 0)} y «${nombre}» pide ${textoSegundos(h.segundos)}: queda con la muestra`);
				continue;
			}
			llenos[nombre] = m.mediaId;
			filas.push({ tipo: "agrega", titulo: `Clip «${nombre}»`, antes: "", despues: corto(m.nombre, 60) });
		}
		for (const [nombre, texto] of Object.entries(op.textos)) filas.push({ tipo: "agrega", titulo: `Texto «${nombre}»`, antes: "", despues: `«${corto(texto, 80)}»` });
		const quedan = [...huecos.values()].filter((h) => h.tipo === "clip" && !h.opcional && !(h.nombre in llenos)).length;
		resueltas.push({ op: "usar_plantilla", plantilla: p.id, textos: { ...op.textos }, medios: llenos });
		cambios.push(
			{
				tipo: "agrega",
				titulo: `Plantilla «${p.nombre}»`,
				antes: "",
				despues: `${textoSegundos(p.duracion)} en 9:16${quedan ? ` · ${quedan === 1 ? "1 clip de muestra" : `${quedan} clips de muestra`} para sustituir` : ""}`,
			},
			...filas,
		);
	};

	// ── usar_plantilla: SOLA y con la línea de tiempo VACÍA (plantillas/instanciar.ts) ──
	// Con algo en la línea de tiempo no se arma (la pestaña abre un proyecto nuevo, como
	// CapCut) y lo demás del pedido sigue su revisión. Vacía, la plantilla va y lo demás se
	// descarta: sus elementos todavía no existen (no tienen ref hasta el pedido siguiente).
	let operaciones = pedidas;
	const usos = pedidas.filter((o): o is Extract<OperacionChat, { op: "usar_plantilla" }> => o.op === "usar_plantilla");
	if (usos.length) {
		if (refs.size > 0) {
			descartes.push("una plantilla se usa con la línea de tiempo vacía: «Utilizar plantilla», en la pestaña Plantillas, la arma en un proyecto nuevo");
			operaciones = pedidas.filter((o) => o.op !== "usar_plantilla");
		} else {
			resolverPlantilla(usos[0]);
			if (pedidas.length > 1) descartes.push("lo demás va en otro pedido, con la plantilla ya armada: sus elementos todavía no existen");
			return { resueltas, cambios, descartes };
		}
	}

	// ── edicion_automatica: SOLA (enjambre/correr.ts). Cada agente mira la línea de tiempo de SU momento y
	// decide; otra operación en el mismo pedido se pisaría con lo que hacen (cortan, subtitulan, normalizan).
	if (operaciones.some((o) => o.op === "edicion_automatica")) {
		const conSonido = [...refs.values()].some((r) => (r.tipo === "video" || r.tipo === "audio") && !r.bloqueada);
		if (!refs.size) {
			descartes.push("la línea de tiempo está vacía: agrega tu video primero");
			return { resueltas, cambios, descartes };
		}
		resueltas.push({ op: "edicion_automatica" });
		cambios.push({
			tipo: "agrega",
			titulo: "Edición automática",
			antes: "",
			despues: conSonido
				? "los agentes quitan pausas, subtitulan, sacan muletillas, resaltan palabras clave, proponen B-roll y planos, limpian y normalizan la voz, y revisan; lo ves pasar al aceptar"
				: "no hay un video con sonido: casi todos los agentes se van a saltear",
		});
		if (operaciones.length > 1) descartes.push("lo demás va en otro pedido: la edición automática va sola");
		return { resueltas, cambios, descartes };
	}

	const resolver = (ref: string): { el: RefElemento } | { motivo: string } => {
		const el = refs.get(ref);
		const st = estado.get(ref);
		if (!el || !st) return { motivo: `no encontré «${ref}» en la línea de tiempo` };
		if (st.borrado) return { motivo: `${el.titulo} ya se borra en este mismo cambio` };
		if (el.bloqueada) return { motivo: `${el.titulo} está en una pista bloqueada` };
		if (alcance === "seleccion" && !el.nuevo && !elegidos.has(ref)) return { motivo: `${el.titulo} no está elegido` };
		return { el };
	};
	/**
	 * Para lo que corre DESPUÉS del lote (cambiar_broll, revertir, congelar, normalizar, borrar_silencios con ref): busca el
	 * clip por su id, y lo que agrega este mismo pedido (la copia de un duplicar, un texto nuevo) todavía no lo tiene. Sin
	 * esto, la revisión lo aceptaba y al aplicar fallaba con un motivo falso («no es un B-roll de MaKo», «no se pudo revertir»).
	 */
	const resolverExistente = (ref: string): { el: RefElemento } | { motivo: string } => {
		const r = resolver(ref);
		if ("motivo" in r || !r.el.nuevo) return r;
		return { motivo: `${r.el.titulo} todavía no existe (se crea al aceptar este pedido): pídelo en otro pedido` };
	};

	/** ¿El tramo [ini, fin) pisa a otro elemento vivo de la misma pista? */
	const pisa = (el: RefElemento, ini: number, fin: number): RefElemento | null => {
		if (el.nuevo) return null; // Lo nuevo va en una pista que el motor elige al ponerlo.
		for (const otro of refs.values()) {
			if (otro.ref === el.ref || otro.trackId !== el.trackId) continue;
			const st = estado.get(otro.ref);
			if (!st || st.borrado) continue;
			if (ini < st.fin - 0.001 && st.inicio < fin - 0.001) return otro;
		}
		return null;
	};

	/** Una ref nueva («n1») para lo que se agrega en este pedido. */
	const registrarNuevo = (ref: string | undefined, tipo: TipoRef, titulo: string, inicio: number, fin: number, e: EstadoElemento, texto?: string): boolean => {
		if (!ref) return true;
		if (refs.has(ref)) { descartes.push(`la ref «${ref}» ya existe`); return false; }
		const r: RefElemento = { ref, trackId: "", elementId: "", tipo, titulo, inicio, fin, bloqueada: false, principal: false, nuevo: true, estado: e, ...(texto !== undefined ? { texto, oculto: false } : {}) };
		refs.set(ref, r);
		simular(r);
		return true;
	};

	/** El clip que empieza justo donde termina `el` en su pista (el otro lado de su corte). */
	const pegadoDerecha = (el: RefElemento, st: Sim): RefElemento | null => {
		for (const otro of refs.values()) {
			if (otro.ref === el.ref || otro.trackId !== el.trackId || !CLIPS.has(otro.tipo)) continue;
			const so = estado.get(otro.ref);
			if (!so || so.borrado || so.oculto) continue;
			if (Math.abs(so.inicio - st.fin) <= 0.011) return otro;
		}
		return null;
	};

	/** Un elemento más largo corre lo que sigue en su pista (CambiarVelocidadCommand). */
	const correrSiPisa = (el: RefElemento, finViejo: number, finNuevo: number) => {
		if (finNuevo <= finViejo) return;
		const siguientes = [...refs.values()].filter((o) => {
			const so = estado.get(o.ref);
			return o.ref !== el.ref && o.trackId === el.trackId && so && !so.borrado && so.inicio >= finViejo - 0.001;
		});
		if (!siguientes.length) return;
		const primero = Math.min(...siguientes.map((o) => estado.get(o.ref)!.inicio));
		const pisada = finNuevo - primero;
		if (pisada <= 0) return;
		for (const o of siguientes) {
			const so = estado.get(o.ref)!;
			if (so.inicio >= primero - 0.001) { so.inicio += pisada; so.fin += pisada; }
		}
	};

	/** Los segundos de fuente que recorre un clip: su largo × su velocidad (una foto, su largo). */
	const recorreDeFuente = (o: RefElemento): number => {
		const so = estado.get(o.ref)!;
		return (so.fin - so.inicio) * (o.tipo === "video" ? (so.e.velocidad ?? 1) : 1);
	};

	/**
	 * Cómo queda un clip con otro medio (reemplazo/puro.ts → elementoReemplazado): el mismo
	 * lugar, otro archivo y quizá otro TIPO (una muestra que pasa a video se puede silenciar
	 * en el mismo pedido). Conserva la velocidad sólo de video a video.
	 */
	const simularReemplazo = (o: RefElemento, medio: RefMedio) => {
		const so = estado.get(o.ref)!;
		const tipo: TipoRef = medio.tipo === "video" ? "video" : "imagen";
		const velocidad = o.tipo === "video" ? (so.e.velocidad ?? 1) : 1;
		const recorre = recorreDeFuente(o);
		refs.set(o.ref, { ...o, tipo, titulo: corto(medio.nombre, 40), mediaId: medio.mediaId, muestra: false });
		so.muestra = false;
		if (tipo !== "video") return;
		so.e = {
			...so.e,
			velocidad,
			curva: o.tipo === "video" ? (so.e.curva ?? null) : null,
			recorte: [0, r2(Math.max(0, (medio.duracion ?? 0) - recorre) / velocidad)],
			fundidos: so.e.fundidos ?? { entrada: 0, salida: 0 },
			normalizado: null,
			revertido: false,
			audioSeparado: false,
			sinAudio: medio.sinAudio === true,
		};
		if (o.tipo !== "video") { so.volumenDb = 0; so.silenciado = false; }
		if (o.silenciar) so.silenciado = true;
	};

	/** Una propiedad con ◇: cambiar su valor base no se vería. */
	const conFotograma = (el: RefElemento, st: Sim, grupo: string | null | undefined): boolean => {
		if (!grupo || !st.e.fotogramas?.includes(grupo)) return false;
		descartes.push(`${el.titulo} tiene fotogramas clave en «${grupo}»: cámbialo en el panel`);
		return true;
	};

	// Lo que se aplica AL FINAL (ver la cabecera): se revisa después del resto.
	const cortes: OperacionChat[] = [];
	const diferidas: OperacionChat[] = [];
	// Lo que va en la vuelta siguiente (ver `Revision`), con su fila: «después de …».
	const encadenadas: OperacionChat[] = [];
	const encadenar = (op: OperacionChat, despuesDe: string, que: string) => {
		encadenadas.push(op);
		cambios.push({ tipo: "cambia", titulo: `Después de ${despuesDe}`, antes: "", despues: que });
	};
	const enPrincipal = (ref: string) => refs.get(ref)?.principal === true;
	const mueveLaPrincipal = operaciones.some(
		(o) =>
			(o.op === "borrar" && o.refs.some(enPrincipal)) ||
			((o.op === "recortar" || o.op === "velocidad" || o.op === "duracion" || o.op === "mover" || o.op === "congelar") && enPrincipal(o.ref)) ||
			o.op === "cortar_frase" ||
			o.op === "eliminar_muletillas",
	);
	const hayCortes = operaciones.some((o) => o.op === "cortar_frase" || o.op === "cortar_tramo" || o.op === "eliminar_muletillas");
	// «Borrar silencios» también parte los clips (y corre lo que sigue), pero al FINAL: lo que tarda y busca el clip por su id va aparte.
	const partenClips = hayCortes || operaciones.some((o) => o.op === "borrar_silencios");
	// Los cortes por texto salen de los tiempos por palabra de los subtítulos, que no se
	// mueven con un recorte o una velocidad de la principal: en el mismo pedido, cortarían
	// otra parte del video. (Congelar y revertir no cuentan: con un corte, son ELLOS los que
	// van aparte, más abajo.)
	const cambiaTiemposPrincipal = operaciones.some(
		(o) =>
			(o.op === "borrar" && o.refs.some(enPrincipal)) ||
			((o.op === "recortar" || o.op === "velocidad" || o.op === "duracion" || o.op === "mover") && enPrincipal(o.ref)),
	);
	const subtitulaAhora = operaciones.some((o) => o.op === "generar_subtitulos");
	// Una plantilla o un preset de subtítulos se aplica DESPUÉS del lote (es larga) y reescribe el resaltado, la animación
	// de la palabra y el tamaño de las claves (subtitles/estilos.ts → paramsDePlantilla): lo que los toca va después de ella.
	const estilaSubtitulosAhora = operaciones.some((o) => o.op === "usar_preset_subtitulos");
	/** ¿Esta operación de los subtítulos va en la vuelta siguiente? Sin subtítulos todavía y generándose, o con una plantilla. */
	const subtitulosDespues = (hay: boolean, conPlantilla: boolean): string | null =>
		!hay && subtitulaAhora ? "generar los subtítulos" : conPlantilla && estilaSubtitulosAhora ? "aplicar el estilo de los subtítulos" : null;
	// Los estilos de subtítulo que vuelven a partir los renglones: UNO por estilo (la IA manda uno por subtítulo), con
	// todos los que lo piden. Van al final (`estilo_subtitulos`).
	const estilosDeSubtitulos = new Map<string, { els: RefElemento[]; params: ParamValues; fila: CambioChat }>();
	// Hasta dónde llega lo que agregar_medios ya puso al final de la principal en este pedido (con o sin ref nueva).
	let finAgregadosPrincipal = 0;
	// Un video con sonido que pone ESTE pedido (con o sin ref nueva): subtitularlo o buscarle B-roll va después del lote, y
	// lo encuentra; borrarle los silencios, en la vuelta siguiente (necesita su id).
	let sonidoNuevoPrincipal = false;

	for (const op of operaciones) {
		if (op.op === "usar_plantilla") continue; // Ya se miró arriba: con la línea de tiempo con algo, no va.
		if (op.op === "edicion_automatica") continue; // Ya se resolvió arriba, sola.
		if (op.op === "cortar_frase" || op.op === "cortar_tramo" || op.op === "eliminar_muletillas") { cortes.push(op); continue; }
		if (op.op === "generar_subtitulos" || op.op === "revertir" || op.op === "congelar" || op.op === "borrar_silencios" || op.op === "broll" || op.op === "cambiar_broll" || op.op === "clips_magicos" || op.op === "emojis_subtitulos") { diferidas.push(op); continue; }
		if (op.op === "reemplazar_en_subtitulos") {
			// Sin distinguir mayúsculas, como «Buscar y reemplazar» (subtitles/palabras.ts → reemplazarEnTexto).
			const b = op.buscar.toLowerCase();
			const cuantos = [...refs.values()].filter((r) => {
				const st = estado.get(r.ref);
				return r.subtitulo && st && !st.borrado && (st.texto ?? "").replace(/\s+/g, " ").toLowerCase().includes(b);
			}).length;
			if (!cuantos) { descartes.push(`«${corto(op.buscar, 40)}» no aparece en ningún subtítulo`); continue; }
			resueltas.push({ op: "reemplazar_en_subtitulos", buscar: op.buscar, reemplazo: op.reemplazo, cuantos });
			cambios.push({
				tipo: "cambia",
				titulo: cuantos === 1 ? "1 subtítulo" : `${cuantos} subtítulos`,
				antes: `«${corto(op.buscar, 60)}»`,
				despues: `«${corto(op.reemplazo, 60)}»`,
			});
			continue;
		}
		if (op.op === "resaltar_palabras") {
			// Como el panel («Animaciones de subtítulos»): a TODOS los subtítulos, en el mismo paso.
			const subs = [...refs.values()].filter((r) => r.subtitulo && !estado.get(r.ref)?.borrado);
			const tras = subtitulosDespues(subs.length > 0, true);
			if (tras) { encadenar(op, tras, op.modo === "ninguno" ? "sin resaltar la palabra que se dice" : `resaltar ${op.modo === "frase" ? "lo que se va diciendo" : "la palabra que se dice"}`); continue; }
			if (!subs.length) {
				descartes.push("no hay subtítulos para resaltar");
				continue;
			}
			if (op.modo !== "ninguno" && !(transcripcion?.parrafos ?? []).some((p) => p.palabras.length > 0)) {
				descartes.push("los subtítulos no tienen el tiempo de cada palabra: genera primero los subtítulos");
				continue;
			}
			const libres = subs.filter((r) => !r.bloqueada);
			if (!libres.length) { descartes.push("los subtítulos están en una pista bloqueada"); continue; }
			const ninguno: ResaltarLeido = { modo: "ninguno", color: DEFAULTS_RESALTADO.color, opacidad_no_dichas: DEFAULTS_RESALTADO.noDichasOpacidad };
			const antes = estado.get(libres[0].ref)?.e.estilo?.resaltar ?? ninguno;
			const despues: ResaltarLeido = { modo: op.modo, color: op.color ?? antes.color, opacidad_no_dichas: op.opacidad_no_dichas ?? antes.opacidad_no_dichas };
			const params: ParamValues = { [PARAM_RESALTAR]: despues.modo, [PARAM_RESALTAR_COLOR]: despues.color, [PARAM_NO_DICHAS_OPACIDAD]: despues.opacidad_no_dichas };
			let cuantos = 0;
			for (const r of libres) {
				const st = estado.get(r.ref)!;
				const a = st.e.estilo?.resaltar ?? ninguno;
				if (a.modo === despues.modo && a.color === despues.color && a.opacidad_no_dichas === despues.opacidad_no_dichas) continue;
				if (st.e.estilo) st.e.estilo = { ...st.e.estilo, resaltar: despues };
				resueltas.push({ op: "params", de: "resaltar_palabras", el: r, params });
				cuantos++;
			}
			if (!cuantos) continue;
			cambios.push({ tipo: "cambia", titulo: cuantos === 1 ? "1 subtítulo" : `${cuantos} subtítulos`, antes: textoResaltar(antes), despues: textoResaltar(despues) });
			continue;
		}
		if (op.op === "animar_palabras") {
			// Como el panel («Animaciones de subtítulos» › «Palabra que se dice»): a TODOS los subtítulos, en el mismo paso.
			const subs = [...refs.values()].filter((r) => r.subtitulo && !estado.get(r.ref)?.borrado);
			const tras = subtitulosDespues(subs.length > 0, true);
			if (tras) { encadenar(op, tras, op.animacion === "ninguna" ? "sin animar la palabra" : op.animacion === "pop" ? "la palabra que se dice salta" : "la palabra que se dice crece"); continue; }
			if (!subs.length) {
				descartes.push("no hay subtítulos para animar");
				continue;
			}
			if (op.animacion !== "ninguna" && !(transcripcion?.parrafos ?? []).some((p) => p.palabras.length > 0)) {
				descartes.push("los subtítulos no tienen el tiempo de cada palabra: genera primero los subtítulos");
				continue;
			}
			const libres = subs.filter((r) => !r.bloqueada);
			if (!libres.length) { descartes.push("los subtítulos están en una pista bloqueada"); continue; }
			const antes = estado.get(libres[0].ref)?.e.estilo?.animacion_palabra ?? "ninguna";
			let cuantos = 0;
			for (const r of libres) {
				const st = estado.get(r.ref)!;
				if ((st.e.estilo?.animacion_palabra ?? "ninguna") === op.animacion) continue;
				if (st.e.estilo) st.e.estilo = { ...st.e.estilo, animacion_palabra: op.animacion };
				resueltas.push({ op: "params", de: "animar_palabras", el: r, params: { [PARAM_ANIM_PALABRA]: op.animacion } });
				cuantos++;
			}
			if (!cuantos) continue;
			const texto = (a: AnimPalabra) => (a === "pop" ? "la palabra que se dice salta" : a === "crecer" ? "la palabra que se dice crece" : "sin animar la palabra");
			cambios.push({ tipo: "cambia", titulo: cuantos === 1 ? "1 subtítulo" : `${cuantos} subtítulos`, antes: texto(antes), despues: texto(op.animacion) });
			continue;
		}
		if (op.op === "palabras_clave") {
			// Como el panel («Palabras clave»): a TODOS los subtítulos, en el mismo paso (o a uno, con «ref»). No necesita tiempos por palabra.
			const todos = [...refs.values()].filter((r) => r.subtitulo && !estado.get(r.ref)?.borrado).sort((a, b) => a.inicio - b.inicio);
			if (op.ref && !todos.some((r) => r.ref === op.ref)) { descartes.push(`${op.ref} no es un subtítulo`); continue; }
			const subs = op.ref ? todos.filter((r) => r.ref === op.ref) : todos;
			const tras = op.ref ? null : subtitulosDespues(subs.length > 0, true);
			if (tras) {
				encadenar(op, tras, op.modo === "ninguna" ? "sin palabras clave" : `palabras clave${op.color ? ` en ${op.color}` : ""}${op.tamano !== undefined ? ` al ${op.tamano} %` : ""}`);
				continue;
			}
			if (!subs.length) {
				descartes.push("no hay subtítulos");
				continue;
			}
			const libres = subs.filter((r) => !r.bloqueada);
			if (!libres.length) { descartes.push("los subtítulos están en una pista bloqueada"); continue; }
			const textos = libres.map((r) => estado.get(r.ref)?.texto ?? r.texto ?? "");
			const actuales = libres.map((r) => codificarClaves(r.claves ?? []));
			const elegidas =
				op.modo === "auto"
					? elegirClaves(textos, { siempre: d.palabrasDeMarca })
					: op.modo === "estas"
						? clavesNombradas(textos, op.palabras ?? [])
						: op.modo === "sumar"
							? textos.map((t, i) => sumarClaves(actuales[i], t, op.palabras ?? []))
							: op.modo === "quitar"
								? actuales.map((a) => quitarClaves(a, op.palabras ?? []))
								: textos.map(() => []);
			if ((op.modo === "estas" || op.modo === "sumar") && clavesNombradas(textos, op.palabras ?? []).every((e) => e.length === 0)) {
				descartes.push(`${(op.palabras ?? []).map((w) => `«${corto(w, 20)}»`).join(", ")} no aparece en ${op.ref ? "ese subtítulo" : "ningún subtítulo"}`);
				continue;
			}
			const conTamano = op.tamano !== undefined;
			let cuantos = 0;
			const ejemplos: string[] = [];
			libres.forEach((r, i) => {
				const nuevas = codificarClaves(elegidas[i] ?? []);
				const tamanoIgual = !conTamano || (estado.get(r.ref)?.e.estilo?.tamano_claves ?? DEFAULTS_CLAVES.tamano) === op.tamano;
				if (nuevas === actuales[i] && !op.color && tamanoIgual) return;
				const params: ParamValues = {
					[PARAM_CLAVES]: nuevas,
					...(op.color ? { [PARAM_CLAVES_COLOR]: op.color } : {}),
					...(conTamano ? { [PARAM_CLAVES_TAMANO]: op.tamano as number } : {}),
				};
				resueltas.push({ op: "params", de: "palabras_clave", el: r, params });
				cuantos++;
				for (const w of elegidas[i] ?? []) if (ejemplos.length < 4 && !ejemplos.includes(w)) ejemplos.push(w);
			});
			if (!cuantos) {
				// «Sumar» lo que ya está marcado o «quitar» lo que no lo estaba no cambia nada: se dice, no se calla.
				const nombradas = (op.palabras ?? []).map((w) => `«${corto(w, 20)}»`).join(", ");
				if (op.modo === "sumar") descartes.push(`${nombradas} ya ${(op.palabras ?? []).length === 1 ? "era palabra clave" : "eran palabras clave"}`);
				else if (op.modo === "quitar") descartes.push(`${nombradas} no ${(op.palabras ?? []).length === 1 ? "era palabra clave" : "eran palabras clave"}`);
				continue;
			}
			const conAlguna = elegidas.filter((e) => e.length > 0).length;
			cambios.push({
				tipo: "cambia",
				titulo: cuantos === 1 ? "1 subtítulo" : `${cuantos} subtítulos`,
				antes: subs.some((r) => r.claves?.length) ? "con palabras clave" : "sin palabras clave",
				despues:
					op.modo === "ninguna"
						? "sin palabras clave"
						: `palabras clave en ${conAlguna}${ejemplos.length ? ` (${ejemplos.map((w) => `«${w}»`).join(", ")}…)` : ""}${op.color ? ` en ${op.color}` : ""}${conTamano ? ` al ${op.tamano} %` : ""}`,
			});
			continue;
		}
		if (op.op === "usar_preset_subtitulos") {
			const subs = [...refs.values()].filter((r) => r.subtitulo && !estado.get(r.ref)?.borrado);
			if (!subs.length && subtitulaAhora) {
				const nombre = plantillaSubtituloDelChat(op.preset)?.nombre;
				encadenar(op, "generar los subtítulos", nombre ? `el estilo «${nombre}»` : `el preset «${corto(op.preset, 30)}»`);
				continue;
			}
			if (!subs.length) {
				descartes.push("no hay subtítulos");
				continue;
			}
			const p = presetDelChat(d.presets ?? [], op.preset);
			if ("motivo" in p) {
				// Una de la galería de fábrica (Subtítulos › Plantillas): lo MISMO que tocar su tarjeta. La de la marca, si se
				// llama igual, gana (va primero).
				const fabrica = plantillaSubtituloDelChat(op.preset);
				if (!fabrica) { descartes.push(p.motivo); continue; }
				resueltas.push({ op: "usar_plantilla_subtitulos", plantilla: fabrica.id });
				cambios.push({
					tipo: "cambia",
					titulo: subs.length === 1 ? "1 subtítulo" : `${subs.length} subtítulos`,
					antes: "su estilo de ahora",
					despues: `la plantilla «${fabrica.nombre}» (vuelve a partir los renglones)`,
				});
				continue;
			}
			resueltas.push({ op: "usar_preset_subtitulos", preset: p.preset.id });
			cambios.push({
				tipo: "cambia",
				titulo: subs.length === 1 ? "1 subtítulo" : `${subs.length} subtítulos`,
				antes: "su estilo de ahora",
				despues: `el preset «${p.preset.nombre}»${p.preset.marca ? ` de ${p.preset.marca}` : ""}`,
			});
			continue;
		}
		if (op.op === "agregar_texto") {
			const titulo = `«${corto(op.texto.replace(/\s+/g, " "), 40)}»`;
			// Una «Plantilla de texto» (Biblioteca › Texto): sus params, con el tamaño llevado al lienzo como al agregarla.
			let params: ParamValues | undefined;
			let nombrePlantilla = "";
			if (op.plantilla) {
				const opcion = (d.plantillasTexto ?? []).find((x) => x.id === op.plantilla);
				const plantilla = opcion ? PLANTILLAS_TEXTO.find((x) => x.id === opcion.id) : undefined;
				if (!plantilla) { descartes.push(`no existe la plantilla de texto «${corto(op.plantilla, 30)}»`); continue; }
				params = paramsParaLienzo(plantilla.params, lienzo ? { width: lienzo.ancho, height: lienzo.alto } : null);
				nombrePlantilla = plantilla.nombre;
			}
			// Que entre en el cuadro (12/11/2026): el texto no se parte solo, y el de siempre (15) ya se sale en un 9:16 con
			// una frase larga.
			const entra = tamanoQueEntra(op.texto, lienzo, params?.[TEXTO.mayusculas] === "mayusculas");
			const pedido = typeof params?.fontSize === "number" ? params.fontSize : TAMANO_TEXTO_DE_SIEMPRE;
			const achicado = entra !== null && pedido > entra;
			if (achicado) params = { ...(params ?? {}), fontSize: entra };
			const anim: ParamValues = {};
			for (const c of categoriasPara("text")) for (const k of [ANIM[c].id, ANIM[c].duracion]) if (params?.[k] !== undefined) anim[k] = params[k];
			const estadoNuevo: EstadoElemento = { anim, transform: leerTransform({}), estilo: leerEstilo(params ?? {}) };
			if (!registrarNuevo(op.ref, "texto", titulo, op.inicio, op.inicio + op.duracion, estadoNuevo, op.texto)) continue;
			resueltas.push({ op: "agregar_texto", texto: op.texto, inicio: op.inicio, duracion: op.duracion, ...(op.ref ? { ref: op.ref } : {}), ...(params ? { params } : {}) });
			cambios.push({
				tipo: "agrega",
				titulo: nombrePlantilla ? `Texto nuevo · plantilla «${nombrePlantilla}»` : "Texto nuevo",
				antes: "",
				despues: `«${corto(op.texto, 80)}» · de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + op.duracion)}${achicado ? ` · letra ${textoNumero(entra!)} para que entre en el cuadro` : ""}`,
			});
			continue;
		}
		if (op.op === "agregar_emoji") {
			// Como la tarjeta de Stickers › Emojis (stickers/components/assets-view.tsx): sólo lo que la biblioteca tiene.
			const emoji = emojiDeLaBiblioteca(op.emoji);
			if (!emoji) { descartes.push(`${corto(op.emoji, 8)} no está en la biblioteca de emojis`); continue; }
			const stickerId = buildStickerId({ providerId: EMOJIS_PROVIDER_ID, providerValue: emojiAValor(emoji) });
			if (!registrarNuevo(op.ref, "sticker", `Emoji ${emoji}`, op.inicio, op.inicio + op.duracion, { anim: {}, transform: leerTransform({}) })) continue;
			resueltas.push({ op: "agregar_emoji", emoji, stickerId, inicio: op.inicio, duracion: op.duracion, ...(op.ref ? { ref: op.ref } : {}) });
			cambios.push({ tipo: "agrega", titulo: `Emoji ${emoji}`, antes: "", despues: `de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + op.duracion)}, en el centro del cuadro` });
			continue;
		}
		if (op.op === "agregar_medios") {
			// Ticket 73 («Poné los dos videos en la línea de tiempo, primero prueba-con-pausa y después clip-4»): el ⊕ de
			// cada tarjeta de Multimedia (components/editor/panels/assets/views/assets.tsx), pero al FINAL de la pista
			// principal y en el orden pedido. El ⊕ suelta en el cabezal: dos seguidos en el mismo lugar quedaban en el orden
			// que el imán decidiera, no en el que dijo la persona.
			const principales = [...refs.values()].filter((r) => r.principal && !estado.get(r.ref)?.borrado);
			if (principales.some((r) => r.bloqueada)) { descartes.push("la pista principal está bloqueada: no se le pueden poner videos"); continue; }
			let cursor = Math.max(finAgregadosPrincipal, ...principales.map((r) => estado.get(r.ref)!.fin), 0);
			// La pista de los nuevos es la principal: una transición entre el último clip y el primero nuevo busca a su
			// vecino POR PISTA (pegadoDerecha). Con la principal vacía no hay id, y los nuevos comparten "".
			const pistaPrincipal = [...refs.values()].find((r) => r.principal && !r.nuevo)?.trackId ?? "";
			const puestos: Array<{ mediaId: string; ref?: string }> = [];
			for (const [i, refMedio] of op.medios.entries()) {
				const m = medios.get(refMedio);
				if (!m) { descartes.push(`no encontré el medio «${corto(refMedio, 20)}» en Multimedia`); continue; }
				const duracion = m.tipo === "video" ? (m.duracion ?? 0) : TOPES_CHAT.fotoSegundos;
				if (!(duracion > 0)) { descartes.push(`«${corto(m.nombre, 40)}» todavía no tiene duración: espera a que termine de cargar`); continue; }
				const inicio = cursor;
				const fin = cursor + duracion;
				const titulo = corto(m.nombre, 60);
				const nueva = op.refs?.[i];
				if (nueva) {
					if (refs.has(nueva)) { descartes.push(`la ref «${nueva}» ya existe`); continue; }
					// Lo mismo que leerEstado de un clip recién puesto: sin recorte, a 1×, sin transición ni efectos.
					const crudo = { type: m.tipo === "video" ? "video" : "image", params: {}, trimStart: 0, trimEnd: 0, mediaId: m.mediaId, effects: [], isSourceAudioEnabled: true } as unknown as TimelineElement;
					const tipo: TipoRef = m.tipo === "video" ? "video" : "imagen";
					const r: RefElemento = {
						ref: nueva, trackId: pistaPrincipal, elementId: "", tipo, titulo, inicio: r2(inicio), fin: r2(fin), bloqueada: false, principal: true, nuevo: true, mediaId: m.mediaId,
						acepta: "ambos",
						estado: leerEstado(crudo, tipo, 1, m.sinAudio ? new Set([m.mediaId]) : new Set()),
					};
					refs.set(nueva, r);
					simular(r);
				}
				cambios.push({
					tipo: "agrega",
					titulo: m.tipo === "video" ? `Video «${titulo}»` : `Foto «${titulo}»`,
					antes: "",
					despues: `de ${textoSegundos(inicio)} a ${textoSegundos(fin)}, al final de la pista principal${m.tipo === "video" && m.sinAudio ? " (sin sonido)" : ""}`,
				});
				puestos.push({ mediaId: m.mediaId, ...(nueva ? { ref: nueva } : {}) });
				if (m.tipo === "video" && !m.sinAudio) sonidoNuevoPrincipal = true;
				cursor = fin;
			}
			finAgregadosPrincipal = cursor;
			if (puestos.length) resueltas.push({ op: "agregar_medios", medios: puestos });
			continue;
		}
		if (op.op === "fondo_lienzo") {
			// Como Proyecto › Fondo (components/editor/panels/assets/views/settings/background.tsx): de todo el proyecto.
			const nuevo: TBackground = op.color !== undefined ? { type: "color", color: op.color } : { type: "blur", blurIntensity: DESENFOQUES_FONDO[op.desenfoque] };
			const leido = leerFondo(nuevo);
			if (textoFondo(leido) === textoFondo(fondo)) continue;
			cambios.push({ tipo: "cambia", titulo: "Fondo del lienzo", antes: textoFondo(fondo), despues: textoFondo(leido) });
			fondo = leido;
			resueltas.push({ op: "fondo_lienzo", fondo: nuevo });
			continue;
		}
		if (op.op === "agregar_motion") {
			// Como la tarjeta de la biblioteca (motion/components/biblioteca-motion.tsx), sin los textos de ejemplo.
			const def = DEF_MOTION[op.plantilla];
			const duracion = op.duracion ?? def.duracionMs / 1000;
			const valores = valoresAlAgregar(op.plantilla, op.valores);
			const estadoNuevo: EstadoElemento = { anim: {}, transform: leerTransform({}), motion: { plantilla: op.plantilla, valores } };
			if (!registrarNuevo(op.ref, "motion", `Motion · ${def.nombre}`, op.inicio, op.inicio + duracion, estadoNuevo)) continue;
			resueltas.push({ op: "agregar_motion", plantilla: op.plantilla, valores, inicio: op.inicio, duracion, ...(op.ref ? { ref: op.ref } : {}) });
			const campos = textoValoresMotion(op.valores, op.plantilla);
			cambios.push({ tipo: "agrega", titulo: `Motion «${def.nombre}»`, antes: "", despues: `${campos ? `${campos} · ` : ""}de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + duracion)}` });
			continue;
		}
		if (op.op === "capa_efecto") {
			const lista = op.tipo === "filtro" ? d.filtros : d.efectos;
			const opcion = lista.find((o) => o.id === op.id);
			if (!opcion) { descartes.push(`no existe el ${op.tipo} «${corto(op.id, 30)}»`); continue; }
			if (!registrarNuevo(op.ref, "efecto", opcion.nombre, op.inicio, op.inicio + op.duracion, { capa: opcion.tipo })) continue;
			resueltas.push({ op: "capa_efecto", tipo: opcion.tipo, inicio: op.inicio, duracion: op.duracion, ...(op.ref ? { ref: op.ref } : {}) });
			cambios.push({ tipo: "agrega", titulo: op.tipo === "filtro" ? "Capa de filtro" : "Capa de efecto", antes: "", despues: `${opcion.nombre} · de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + op.duracion)}` });
			continue;
		}
		if (op.op === "borrar") {
			const els: RefElemento[] = [];
			for (const ref of op.refs) {
				const r = resolver(ref);
				if ("motivo" in r) { descartes.push(r.motivo); continue; }
				els.push(r.el);
			}
			if (!els.length) continue;
			for (const el of els) {
				const st = estado.get(el.ref)!;
				st.borrado = true;
				// Como el botón: con «Vinculación», un clip de la principal se lleva lo que tiene encima.
				const conEncima = el.principal ? " · y lo que tiene encima, si la vinculación está prendida" : "";
				cambios.push({ tipo: "quita", titulo: el.titulo, antes: `de ${textoSegundos(st.inicio)} a ${textoSegundos(st.fin)}${conEncima}`, despues: "" });
			}
			resueltas.push({ op: "borrar", els });
			continue;
		}

		const r = resolver(op.ref);
		if ("motivo" in r) { descartes.push(r.motivo); continue; }
		const el = r.el;
		const st = estado.get(el.ref)!;
		const e = st.e;
		const solo = (tipos: ReadonlySet<TipoRef>, que: string) => {
			if (tipos.has(el.tipo)) return true;
			descartes.push(`${el.titulo} no ${que}`);
			return false;
		};
		const escribir = (params: ParamValues, fila: CambioChat | null) => {
			if (!fila || !Object.keys(params).length) return;
			cambios.push(fila);
			resueltas.push({ op: "params", de: op.op, el, params });
		};

		switch (op.op) {
			case "cambiar_texto": {
				if (el.tipo === "motion") { descartes.push(`${el.titulo} es un motion graphic: sus textos se cambian con editar_motion`); break; }
				if (el.tipo !== "texto") { descartes.push(`${el.titulo} no es un texto`); break; }
				if (op.texto === st.texto) break;
				// El tope del hueco es el mismo que al usar la plantilla (lib/editor-video/plantillas.ts → validarValores).
				const largo = largoTexto(op.texto.replace(/\s+/g, " "));
				if (el.maxCaracteres && largo > el.maxCaracteres) {
					descartes.push(`el texto de «${el.hueco}» admite hasta ${el.maxCaracteres} caracteres (tiene ${largo})`);
					break;
				}
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `«${corto(st.texto ?? "", 80)}»`, despues: `«${corto(op.texto, 80)}»` });
				st.texto = op.texto;
				resueltas.push({ op: "cambiar_texto", el, texto: op.texto });
				break;
			}
			case "mover": {
				const largo = st.fin - st.inicio;
				if (Math.abs(op.inicio - st.inicio) < 0.01) break;
				const otro = pisa(el, op.inicio, op.inicio + largo);
				if (otro) { descartes.push(`${el.titulo} se pisaría con ${otro.titulo}`); break; }
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `empieza en ${textoSegundos(st.inicio)}`, despues: `empieza en ${textoSegundos(op.inicio)}` });
				st.inicio = op.inicio;
				st.fin = op.inicio + largo;
				resueltas.push({ op: "mover", el, inicio: op.inicio });
				break;
			}
			case "duracion": {
				if (!CON_DURACION_LIBRE.has(el.tipo)) { descartes.push(`la duración de ${el.titulo} se cambia recortándolo`); break; }
				if (Math.abs(op.duracion - (st.fin - st.inicio)) < 0.01) break;
				const otro = pisa(el, st.inicio, st.inicio + op.duracion);
				if (otro) { descartes.push(`${el.titulo} se pisaría con ${otro.titulo}`); break; }
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `dura ${textoSegundos(st.fin - st.inicio)}`, despues: `dura ${textoSegundos(op.duracion)}` });
				st.fin = st.inicio + op.duracion;
				resueltas.push({ op: "duracion", el, duracion: op.duracion });
				break;
			}
			case "dividir": {
				if (op.en <= st.inicio + MARGEN_CORTE || op.en >= st.fin - MARGEN_CORTE) {
					descartes.push(`el corte en ${textoSegundos(op.en)} cae fuera de ${el.titulo}`);
					break;
				}
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `de ${textoSegundos(st.inicio)} a ${textoSegundos(st.fin)}`, despues: `se corta en ${textoSegundos(op.en)}` });
				// La ref sigue siendo la parte IZQUIERDA (SplitElementsCommand conserva su id), que
				// se queda con la entrada y sin la salida ni la transición (split-elements.ts).
				st.fin = op.en;
				if (e.anim) e.anim[ANIM.salida.id] = ID_NINGUNO;
				if (e.transicion) e.transicion = null;
				resueltas.push({ op: "dividir", el, en: op.en, base: st.inicio });
				break;
			}
			case "recortar": {
				const desde = op.inicio ?? st.inicio;
				const hasta = op.fin ?? st.fin;
				if (hasta - desde < LARGO_MINIMO) { descartes.push(`${el.titulo} quedaría sin largo`); break; }
				const material = SONOROS.has(el.tipo) && e.recorte ? e.recorte : null;
				if (material && desde < st.inicio - material[0] - 0.011) {
					descartes.push(`${el.titulo} no tiene más material antes: puede empezar desde ${textoSegundos(st.inicio - material[0])}`);
					break;
				}
				if (material && hasta > st.fin + material[1] + 0.011) {
					descartes.push(`${el.titulo} no tiene más material después: puede terminar hasta ${textoSegundos(st.fin + material[1])}`);
					break;
				}
				if (Math.abs(desde - st.inicio) < 0.01 && Math.abs(hasta - st.fin) < 0.01) break;
				const otro = pisa(el, desde, hasta);
				if (otro) { descartes.push(`${el.titulo} se pisaría con ${otro.titulo}`); break; }
				const imantado = el.principal && desde > st.inicio + 0.01 ? " · lo que sigue se corre si el imán está prendido" : "";
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `de ${textoSegundos(st.inicio)} a ${textoSegundos(st.fin)}`, despues: `de ${textoSegundos(desde)} a ${textoSegundos(hasta)}${imantado}` });
				if (material) e.recorte = [r2(material[0] + (desde - st.inicio)), r2(material[1] + (st.fin - hasta))];
				resueltas.push({
					op: "recortar",
					el,
					base: st.inicio,
					...(Math.abs(desde - st.inicio) >= 0.01 ? { inicio: desde } : {}),
					...(Math.abs(hasta - st.fin) >= 0.01 ? { fin: hasta } : {}),
				});
				st.inicio = desde;
				st.fin = hasta;
				break;
			}
			case "volumen": {
				if (!SONOROS.has(el.tipo)) { descartes.push(`${el.titulo} no tiene sonido`); break; }
				if (conFotograma(el, st, "volumen")) break;
				if (Math.abs(op.db - (st.volumenDb ?? 0)) < 0.05) break;
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: `volumen ${textoDb(st.volumenDb ?? 0)}`, despues: `volumen ${textoDb(op.db)}` });
				st.volumenDb = op.db;
				resueltas.push({ op: "volumen", el, db: op.db });
				break;
			}
			case "silenciar": {
				if (!SONOROS.has(el.tipo)) { descartes.push(`${el.titulo} no tiene sonido`); break; }
				if (op.silenciado === (st.silenciado ?? false)) break;
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: op.silenciado ? "con sonido" : "silenciado", despues: op.silenciado ? "silenciado" : "con sonido" });
				st.silenciado = op.silenciado;
				resueltas.push({ op: "silenciar", el, silenciado: op.silenciado });
				break;
			}
			case "ocultar": {
				if (!VISUALES.has(el.tipo)) { descartes.push(`${el.titulo} no se puede ocultar`); break; }
				if (op.oculto === (st.oculto ?? false)) break;
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: op.oculto ? "visible" : "oculto", despues: op.oculto ? "oculto" : "visible" });
				st.oculto = op.oculto;
				resueltas.push({ op: "ocultar", el, oculto: op.oculto });
				break;
			}
			case "fundido": {
				if (!solo(SONOROS, "tiene sonido")) break;
				const antes = e.fundidos ?? { entrada: 0, salida: 0 };
				const entrada = op.entrada ?? antes.entrada;
				const salida = op.salida ?? antes.salida;
				const largo = st.fin - st.inicio;
				if (entrada + salida > largo + 0.01) { descartes.push(`los fundidos de ${el.titulo} suman más que su largo (${textoSegundos(largo)})`); break; }
				e.fundidos = { entrada, salida };
				escribir(
					{ ...(entrada !== antes.entrada ? { [FUNDIDO_ENTRADA]: entrada } : {}), ...(salida !== antes.salida ? { [FUNDIDO_SALIDA]: salida } : {}) },
					filaCampos(el.titulo, [["aparición", antes.entrada, entrada, " s"], ["desaparición", antes.salida, salida, " s"]]),
				);
				break;
			}
			case "reducir_ruido": {
				if (!solo(SONOROS, "tiene sonido")) break;
				if (op.activo === (e.ruido ?? false)) break;
				e.ruido = op.activo;
				escribir({ [REDUCIR_RUIDO]: op.activo }, { tipo: "cambia", titulo: el.titulo, antes: op.activo ? "con ruido" : "ruido reducido", despues: op.activo ? "ruido reducido" : "con ruido" });
				break;
			}
			case "normalizar": {
				if (!solo(SONOROS, "tiene sonido")) break;
				if (e.sinAudio) { descartes.push(`${el.titulo} no tiene sonido`); break; }
				const objetivo = op.objetivo ?? (e.normalizado as keyof typeof OBJETIVOS_NORMALIZAR | null) ?? "predeterminado";
				if (!op.activo) {
					if (!e.normalizado) break;
					const previo = e.normalizado;
					e.normalizado = null;
					escribir({ [NORMALIZAR]: false }, { tipo: "cambia", titulo: el.titulo, antes: `normalizado (${previo})`, despues: "sin normalizar" });
					break;
				}
				if (e.normalizado === objetivo) break;
				if (e.normalizado) {
					// Ya está medido: cambiar el objetivo no vuelve a medir (audio/normalizar.ts).
					const previo = e.normalizado;
					e.normalizado = objetivo;
					escribir({ [NORMALIZAR_OBJETIVO]: OBJETIVOS_NORMALIZAR[objetivo] }, { tipo: "cambia", titulo: el.titulo, antes: `normalizado (${previo})`, despues: `normalizado (${objetivo})` });
					break;
				}
				diferidas.push(op);
				break;
			}
			case "separar_audio": {
				if (el.tipo !== "video") { descartes.push(`${el.titulo} no es un video`); break; }
				if (op.separado && e.sinAudio) { descartes.push(`${el.titulo} no tiene sonido`); break; }
				if (op.separado === (e.audioSeparado ?? false)) break;
				e.audioSeparado = op.separado;
				cambios.push(
					op.separado
						? { tipo: "agrega", titulo: `Audio de ${el.titulo}`, antes: "", despues: "en su propia pista de audio" }
						: { tipo: "quita", titulo: `Audio extraído de ${el.titulo}`, antes: "en su propia pista (vuelve al video)", despues: "" },
				);
				resueltas.push({ op: "separar_audio", el });
				break;
			}
			case "reemplazar_clip": {
				if (!solo(CLIPS, "es un clip de video o imagen")) break;
				const medio = medios.get(op.medio);
				if (!medio) { descartes.push(`no encontré el medio «${corto(op.medio, 20)}» en Multimedia`); break; }
				const acepta = el.acepta ?? "ambos";
				if (!aceptaMedio(acepta, medio.tipo === "video" ? "video" : "image")) {
					descartes.push(`${el.titulo} pide ${acepta === "video" ? "un video" : "una foto"}`);
					break;
				}
				// Una muestra llena también las otras muestras de su hueco, salvo las de una pista
				// bloqueada (reemplazo/puro.ts → objetivosDelReemplazo).
				const hermanas = st.muestra && el.hueco
					? [...refs.values()].filter((o) => {
							const so = estado.get(o.ref);
							return o.ref !== el.ref && CLIPS.has(o.tipo) && !o.bloqueada && o.plantilla === el.plantilla && o.hueco === el.hueco && !!so && !so.borrado && so.muestra === true;
						})
					: [];
				// Lo que recorre de fuente cada uno: su largo × su velocidad; el video tiene que alcanzar para el que más (CapCut rechaza el corto).
				const necesita = Math.max(...[el, ...hermanas].map(recorreDeFuente));
				if (medio.tipo === "video" && (medio.duracion ?? 0) < necesita - 0.01) {
					descartes.push(`«${corto(medio.nombre, 40)}» dura ${textoSegundos(medio.duracion ?? 0)} y ${el.titulo} pide ${textoSegundos(necesita)} de video`);
					break;
				}
				if (!st.muestra && el.mediaId === medio.mediaId) break;
				const otras = hermanas.length === 1 ? "otra muestra" : `${hermanas.length} muestras más`;
				cambios.push({
					tipo: "cambia",
					titulo: el.titulo,
					antes: st.muestra ? `muestra de «${el.hueco}»` : el.titulo,
					despues: `${corto(medio.nombre, 60)}${hermanas.length ? ` · y ${otras} de «${el.hueco}»` : ""}`,
				});
				for (const o of [el, ...hermanas]) simularReemplazo(o, medio);
				resueltas.push({ op: "reemplazar_clip", el, mediaId: medio.mediaId });
				break;
			}
			case "velocidad": {
				if (!solo(SONOROS, "es un video ni un audio")) break;
				const velocidadAntes = e.velocidad ?? 1;
				const curvaAntes = e.curva ?? null;
				let rate: number | null;
				let curva: string | null = null;
				if (op.curva !== undefined) {
					if (el.tipo !== "video") { descartes.push(`la curva de velocidad es sólo para videos`); break; }
					if (op.curva === null) {
						if (!curvaAntes) break;
						rate = null;
					} else {
						const c = d.curvas.find((x) => x.id === op.curva);
						if (!c) { descartes.push(`no existe la curva de velocidad «${corto(op.curva, 30)}»`); break; }
						if (c.id === curvaAntes) break;
						curva = c.id;
						rate = c.media;
					}
				} else {
					rate = op.x ?? 1;
					const tonoAntes = e.cambiaTono ?? false;
					if (!curvaAntes && Math.abs(rate - velocidadAntes) < 0.005 && (op.cambiar_tono === undefined || op.cambiar_tono === tonoAntes)) break;
				}
				const nueva = rate ?? 1;
				const fuente = (st.fin - st.inicio) * velocidadAntes;
				const largo = fuente / nueva;
				if (largo < LARGO_MINIMO) { descartes.push(`${el.titulo} quedaría de menos de ${textoSegundos(LARGO_MINIMO)}`); break; }
				const nombre = (v: number, c: string | null) => (c ? `curva ${nombreDe(d.curvas, c)}` : `${textoNumero(v)}×`);
				cambios.push({
					tipo: "cambia",
					titulo: el.titulo,
					antes: `${nombre(velocidadAntes, curvaAntes)} · dura ${textoSegundos(st.fin - st.inicio)}`,
					despues: `${nombre(nueva, curva)} · dura ${textoSegundos(largo)}${op.cambiar_tono ? " · cambia el tono" : ""}`,
				});
				const finViejo = st.fin;
				st.fin = st.inicio + largo;
				if (e.recorte) e.recorte = [r2((e.recorte[0] * velocidadAntes) / nueva), r2((e.recorte[1] * velocidadAntes) / nueva)];
				e.velocidad = r2(nueva);
				e.curva = curva;
				correrSiPisa(el, finViejo, st.fin);
				resueltas.push({ op: "velocidad", el, rate: op.curva !== undefined ? null : nueva, curva, ...(op.cambiar_tono !== undefined ? { cambiarTono: op.cambiar_tono } : {}) });
				break;
			}
			case "transicion": {
				if (!solo(CLIPS, "es un clip de video o imagen (las transiciones van entre clips)")) break;
				const antes = e.transicion ?? null;
				const nombreT = (t: { id: string; duracion: number } | null) => (t ? `${nombreDe(d.transiciones, t.id)} · ${textoSegundos(t.duracion)}` : "sin transición");
				if (op.id === null) {
					if (!antes) break;
					e.transicion = null;
					escribir({ [PARAM_TRANSICION_ID]: "", [PARAM_TRANSICION_DURACION]: TRANSICION_POR_DEFECTO }, { tipo: "cambia", titulo: el.titulo, antes: nombreT(antes), despues: "sin transición" });
					break;
				}
				if (!d.transiciones.some((t) => t.id === op.id)) { descartes.push(`no existe la transición «${corto(op.id, 30)}»`); break; }
				const otro = pegadoDerecha(el, st);
				if (!otro) { descartes.push(`${el.titulo} no tiene un clip pegado a su derecha para la transición`); break; }
				const so = estado.get(otro.ref)!;
				const maximo = Math.min(st.fin - st.inicio, so.fin - so.inicio) / 2;
				if (maximo < TRANSICION_MINIMA) { descartes.push(`el corte entre ${el.titulo} y ${otro.titulo} es demasiado corto para una transición`); break; }
				// Cambiar de transición conserva la duración elegida; una nueva arranca en 0,5 s (transiciones/acciones.ts).
				const duracion = op.duracion ?? (antes ? antes.duracion : TRANSICION_POR_DEFECTO);
				if (duracion > maximo + 0.001) { descartes.push(`la transición entre ${el.titulo} y ${otro.titulo} dura como mucho ${textoSegundos(Math.floor(maximo * 10) / 10)}`); break; }
				if (antes && antes.id === op.id && Math.abs(antes.duracion - duracion) < 0.01) break;
				e.transicion = { id: op.id, duracion };
				escribir(
					{ [PARAM_TRANSICION_ID]: op.id, [PARAM_TRANSICION_DURACION]: duracion },
					{ tipo: "cambia", titulo: `${el.titulo} → ${otro.titulo}`, antes: nombreT(antes), despues: nombreT(e.transicion) },
				);
				break;
			}
			case "animacion": {
				if (!solo(VISUALES, "se anima")) break;
				const categoria = CATEGORIA_MOTOR[op.tipo];
				const tipoMotor = MOTOR[el.tipo];
				if (!categoriasPara(tipoMotor).includes(categoria)) {
					descartes.push(`${el.titulo} no lleva animación de ${op.tipo}${op.tipo === "combinado" ? " (sólo video e imagen)" : op.tipo === "bucle" ? " (sólo texto, sticker y forma)" : ""}`);
					break;
				}
				const anim = e.anim ?? {};
				const D = Math.max(LARGO_MINIMO, st.fin - st.inicio);
				const clip = { valores: anim, tipo: tipoMotor, D };
				const actual = presetAnimacion(categoria, anim[ANIM[categoria].id]);
				let cambiosAnim: Record<string, ParamValue>;
				if (op.id === null) {
					if (!actual) break;
					cambiosAnim = cambiosAlElegir(clip, categoria, ID_NINGUNO);
				} else {
					const opcion = d.animaciones[categoria].find((a) => a.id === op.id);
					if (!opcion) { descartes.push(`no existe la animación de ${op.tipo} «${corto(op.id, 30)}»`); break; }
					if (opcion.soloTexto && el.tipo !== "texto") { descartes.push(`«${opcion.nombre}» es sólo para textos`); break; }
					const maximo = duracionMaximaAnimacion(clip, categoria);
					if (op.duracion !== undefined && op.duracion > maximo + 0.001) {
						descartes.push(`la animación de ${op.tipo} de ${el.titulo} dura como mucho ${textoSegundos(maximo)}`);
						break;
					}
					cambiosAnim = actual?.id === op.id ? {} : cambiosAlElegir(clip, categoria, op.id);
					if (op.duracion !== undefined) Object.assign(cambiosAnim, cambiosDeDuracion({ ...clip, valores: { ...anim, ...cambiosAnim } }, categoria, op.duracion));
				}
				const despues = { ...anim, ...cambiosAnim };
				const antesTxt = textoAnimaciones(anim, d);
				const despuesTxt = textoAnimaciones(despues, d);
				if (antesTxt === despuesTxt) break;
				e.anim = despues;
				escribir(cambiosAnim, { tipo: "cambia", titulo: el.titulo, antes: antesTxt, despues: despuesTxt });
				break;
			}
			case "filtro": {
				if (!solo(CLIPS, "es un clip de video o imagen (para todo el video, usa una capa de filtro)")) break;
				const antes = e.filtro ?? null;
				const texto = (f: { tipo: string; intensidad: number } | null) =>
					f ? `filtro ${d.filtros.find((x) => x.tipo === f.tipo)?.nombre ?? f.tipo.slice(PREFIJO_FILTRO.length)} ${f.intensidad} %` : "sin filtro";
				if (op.id === null) {
					if (!antes) break;
					e.filtro = null;
					cambios.push({ tipo: "cambia", titulo: el.titulo, antes: texto(antes), despues: "sin filtro" });
					resueltas.push({ op: "filtro", el, tipo: null, intensidad: 0 });
					break;
				}
				const opcion = d.filtros.find((f) => f.id === op.id);
				if (!opcion) { descartes.push(`no existe el filtro «${corto(op.id, 30)}»`); break; }
				const intensidad = op.intensidad ?? 100;
				if (antes && antes.tipo === opcion.tipo && antes.intensidad === intensidad) break;
				e.filtro = { tipo: opcion.tipo, intensidad };
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: texto(antes), despues: texto(e.filtro) });
				resueltas.push({ op: "filtro", el, tipo: opcion.tipo, intensidad });
				break;
			}
			case "efecto": {
				if (!solo(CLIPS, "es un clip de video o imagen (para un tramo o todo el video, usa una capa de efecto)")) break;
				const efectos = e.efectos ?? [];
				const lista = (l: string[]) => (l.length ? l.map((t) => d.efectos.find((x) => x.tipo === t)?.nombre ?? idEfecto(d, t)).join(", ") : "sin efectos");
				if (op.quitar) {
					const tipo = efectos.find((t) => idEfecto(d, t) === op.id);
					if (!tipo) { descartes.push(`${el.titulo} no tiene el efecto «${corto(op.id, 30)}»`); break; }
					const quedan = efectos.filter((t, i) => i !== efectos.indexOf(tipo));
					cambios.push({ tipo: "cambia", titulo: el.titulo, antes: lista(efectos), despues: lista(quedan) });
					e.efectos = quedan;
					resueltas.push({ op: "efecto", el, tipo, quitar: true });
					break;
				}
				const opcion = d.efectos.find((x) => x.id === op.id);
				if (!opcion) { descartes.push(`no existe el efecto «${corto(op.id, 30)}»`); break; }
				if (efectos.includes(opcion.tipo)) break;
				const quedan = [...efectos, opcion.tipo];
				cambios.push({ tipo: "cambia", titulo: el.titulo, antes: lista(efectos), despues: lista(quedan) });
				e.efectos = quedan;
				resueltas.push({ op: "efecto", el, tipo: opcion.tipo, quitar: false });
				break;
			}
			case "ajustar_color": {
				if (!solo(CLIPS, "es un clip de video o imagen")) break;
				if (conFotograma(el, st, "efectos")) break;
				const antes = e.ajustes ?? {};
				const claves = Object.keys(op.valores) as ClaveAjuste[];
				const fila = filaCampos(el.titulo, claves.map((k) => [k, antes[k] ?? 0, op.valores[k]] as [string, unknown, unknown]));
				if (!fila) break;
				e.ajustes = { ...antes, ...op.valores };
				cambios.push(fila);
				resueltas.push({ op: "ajustar_color", el, valores: Object.fromEntries(claves.map((k) => [AJUSTES_COLOR[k].clave, op.valores[k]!])) });
				break;
			}
			case "estilo_texto": {
				if (el.tipo === "motion") { descartes.push(`${el.titulo} es un motion graphic: su tono, colores y fuente se cambian con editar_motion`); break; }
				if (el.tipo !== "texto" || !e.estilo) { descartes.push(`${el.titulo} no es un texto`); break; }
				const pedidos = Object.keys(op.estilo) as Array<keyof EstiloTextoChat>;
				if (pedidos.some((k) => conFotograma(el, st, FOTOGRAMA_ESTILO[k]))) break;
				const estilo = { ...op.estilo };
				if (estilo.fuente !== undefined) {
					const canonica = d.fuentes.todas.get(estilo.fuente.toLowerCase());
					if (!canonica) {
						descartes.push(`no encontré la fuente «${corto(estilo.fuente, 30)}»${d.fuentes.completa ? "" : " (no se pudo cargar la lista de Google Fonts)"}`);
						break;
					}
					estilo.fuente = canonica;
				}
				// Que entre en el cuadro (12/11/2026, medido en producción: «tamaño 48» dejaba «OFERTA DE NOVIEMBRE» en
				// letras de 1.000 px y sólo se veía «EN»). Un subtítulo no: se vuelve a partir en renglones solo.
				if (estilo.tamano !== undefined && !el.subtitulo && typeof st.texto === "string") {
					const mayus = (estilo.mayusculas ?? e.estilo.mayusculas) === "mayusculas";
					const entra = tamanoQueEntra(st.texto, lienzo, mayus);
					if (entra !== null && estilo.tamano > entra) {
						descartes.push(`el tamaño ${textoNumero(estilo.tamano)} saca «${corto(st.texto, 30)}» del cuadro: queda en ${textoNumero(entra)} (para un texto más grande, pártelo en renglones)`);
						estilo.tamano = entra;
					}
				}
				const { nuevo, params } = aplicarEstilo(e.estilo, estilo);
				const fila = filaCampos(
					el.titulo,
					pedidos.map((k) => [ETIQUETA_ESTILO[k], e.estilo![k as keyof EstiloLeido], nuevo[k as keyof EstiloLeido]] as [string, unknown, unknown]),
				);
				e.estilo = nuevo;
				// Un SUBTÍTULO con algo que cambia el ancho del renglón se vuelve a partir, como «Aplicar en todos los
				// subtítulos» (`estilo_subtitulos`, después del lote). Hasta el 9/11/2026 se descartaba: «Los subtítulos en
				// Bebas Neue y amarillo» no cambiaba NADA, ni el color (medido en producción).
				if (el.subtitulo && pedidos.some((k) => ESTILO_QUE_PARTE.includes(k))) {
					if (!fila || !Object.keys(params).length) break;
					const clave = JSON.stringify(params);
					const grupo = estilosDeSubtitulos.get(clave);
					if (grupo) grupo.els.push(el);
					else estilosDeSubtitulos.set(clave, { els: [el], params, fila });
					break;
				}
				escribir(params, fila);
				break;
			}
			case "transformar": {
				if (!solo(VISUALES, "se ve en pantalla")) break;
				const t = e.transform ?? leerTransform({});
				const campos = Object.keys(op.cambios) as Array<keyof TransformChat>;
				if (campos.some((k) => conFotograma(el, st, FOTOGRAMA_TRANSFORM[k]))) break;
				const nuevo: TransformLeido = { ...t, ...op.cambios } as TransformLeido;
				const params: ParamValues = {};
				if (nuevo.x !== t.x) params["transform.positionX"] = nuevo.x;
				// La IA habla con Y hacia arriba; el motor guarda hacia abajo (properties/video/basico.tsx).
				if (nuevo.y !== t.y) params["transform.positionY"] = -nuevo.y;
				if (nuevo.escala !== t.escala) {
					// «Escala uniforme» del panel: conserva la proporción que tenga.
					params["transform.scaleX"] = nuevo.escala / 100;
					params["transform.scaleY"] = (nuevo.escala / 100) * t.proporcion;
				}
				if (nuevo.rotacion !== t.rotacion) params["transform.rotate"] = nuevo.rotacion;
				if (nuevo.opacidad !== t.opacidad) params.opacity = nuevo.opacidad / 100;
				if (nuevo.mezcla !== t.mezcla) params.blendMode = MEZCLAS[nuevo.mezcla];
				const sufijo: Partial<Record<keyof TransformChat, string>> = { escala: " %", rotacion: "°", opacidad: " %" };
				const fila = filaCampos(el.titulo, campos.map((k) => [ETIQUETA_TRANSFORM[k], t[k], nuevo[k], sufijo[k]] as [string, unknown, unknown, string?]));
				e.transform = nuevo;
				escribir(params, fila);
				break;
			}
			case "editar_motion": {
				const m = e.motion;
				if (el.tipo !== "motion" || !m) { descartes.push(`${el.titulo} no es un motion graphic`); break; }
				// Contra los campos y topes de SU plantilla (el catálogo sólo pudo mirar la forma).
				const v = valoresMotionValidos(m.plantilla, op.valores);
				if (!v.ok) { descartes.push(v.motivo); break; }
				const cambian = Object.keys(v.valores).filter((k) => v.valores[k] !== m.valores[k]);
				if (!cambian.length) break;
				const nuevos: ValoresMotion = Object.fromEntries(cambian.map((k) => [k, v.valores[k]]));
				const fila: CambioChat = {
					tipo: "cambia",
					titulo: el.titulo,
					antes: textoValoresMotion(Object.fromEntries(cambian.map((k) => [k, m.valores[k] ?? ""])), m.plantilla),
					despues: textoValoresMotion(nuevos, m.plantilla),
				};
				e.motion = { ...m, valores: { ...m.valores, ...nuevos } };
				// El `updateElements` del panel (graphic-tab.tsx): `applyElementUpdate` MEZCLA los params.
				escribir({ ...nuevos }, fila);
				break;
			}
			case "duplicar": {
				// Un subtítulo repetido se diría dos veces en la transcripción (cortar_frase, las muletillas): no se copia.
				if (el.subtitulo) { descartes.push(`${el.titulo} es un subtítulo: duplicarlo lo repetiría en la transcripción (un texto aparte es agregar_texto)`); break; }
				const titulo = `Copia de ${el.titulo}`;
				if (op.copia) {
					// La copia es el mismo elemento en otra pista (encima): lo que siga en el pedido parte de cómo está AHORA.
					if (refs.has(op.copia)) { descartes.push(`la ref «${op.copia}» ya existe`); break; }
					const copia: RefElemento = {
						...el,
						ref: op.copia,
						trackId: "",
						elementId: "",
						titulo: corto(titulo, 50),
						inicio: st.inicio,
						fin: st.fin,
						bloqueada: false,
						principal: false,
						nuevo: true,
						// Como está AHORA en el pedido (un «ocultar» o un «silenciar» de antes ya corrió), no al empezar:
						// `simular` arma el estado de la copia con estos campos.
						oculto: st.oculto,
						silenciado: st.silenciado,
						volumenDb: st.volumenDb,
						muestra: st.muestra,
						...(st.texto !== undefined ? { texto: st.texto } : {}),
						estado: JSON.parse(JSON.stringify(e)) as EstadoElemento,
					};
					refs.set(copia.ref, copia);
					simular(copia);
				}
				cambios.push({ tipo: "agrega", titulo, antes: "", despues: `de ${textoSegundos(st.inicio)} a ${textoSegundos(st.fin)}, encima, en una pista nueva` });
				resueltas.push({ op: "duplicar", el, ...(op.copia ? { copia: op.copia } : {}) });
				break;
			}
			case "efecto_texto": {
				if (el.tipo === "motion") { descartes.push(`${el.titulo} es un motion graphic: sus colores se cambian con editar_motion`); break; }
				if (el.tipo !== "texto" || !e.estilo) { descartes.push(`${el.titulo} no es un texto`); break; }
				const opcion = op.id === null ? null : (d.efectosTexto ?? []).find((x) => x.id === op.id);
				const efecto = opcion ? EFECTOS_TEXTO.find((x) => x.id === opcion.id) : undefined;
				if (op.id !== null && !efecto) { descartes.push(`no existe el efecto de texto «${corto(op.id, 30)}»`); break; }
				const params = efecto ? efecto.params : SIN_EFECTO;
				// Como el panel: un efecto con fondo no se le pone a un texto curvado (lo enderezaría sin que nadie lo pida).
				if (e.curvado && params["background.enabled"] === true) { descartes.push(`${el.titulo} está curvado: un efecto con fondo no se le aplica`); break; }
				if (conFotograma(el, st, "color") || conFotograma(el, st, "fondo")) break;
				// Lo que ya está así no cambia nada (elegir el efecto que ya tiene no es una fila).
				const apariencia = e.apariencia ?? {};
				if (Object.keys(params).every((k) => apariencia[k] === params[k] || (apariencia[k] === undefined && SIN_EFECTO[k] === params[k]))) break;
				const nuevo = estiloConEfecto(e.estilo, params);
				const antesTxt = textoApariencia(e.estilo);
				const despuesTxt = textoApariencia(nuevo);
				e.estilo = nuevo;
				e.apariencia = { ...apariencia, ...params };
				escribir({ ...params }, { tipo: "cambia", titulo: el.titulo, antes: antesTxt, despues: `${efecto ? `«${efecto.nombre}»` : "sin efecto"} · ${despuesTxt}` });
				break;
			}
			case "encuadre": {
				if (!solo(CLIPS, "es un clip de video o imagen (el encuadre se recorta en el cuadro de un clip)")) break;
				const actual = e.encuadre ?? { rect: RECT_COMPLETO, proporcion: "libre" };
				let rect: RectRecorte;
				let proporcion: string;
				if ("quitar" in op) {
					rect = RECT_COMPLETO;
					proporcion = "libre";
				} else if ("proporcion" in op) {
					// Como el desplegable del diálogo «Recortar»: el rectángulo más grande con esa forma, centrado en el de ahora.
					if (!e.fuente) { descartes.push(`no sé el tamaño del archivo de ${el.titulo}: elige la proporción en «Recortar», en la barra`); break; }
					const archivo = { width: e.fuente.ancho, height: e.fuente.alto };
					const valor = valorProporcion(op.proporcion, archivo);
					if (!valor) { descartes.push(`«${op.proporcion}» no es una proporción`); break; }
					rect = rectConProporcion(actual.rect, valor, archivo);
					proporcion = op.proporcion;
				} else {
					rect = normalizarRect({
						x: op.izquierda / 100,
						y: op.arriba / 100,
						ancho: 1 - (op.izquierda + op.derecha) / 100,
						alto: 1 - (op.arriba + op.abajo) / 100,
					});
					proporcion = "libre";
				}
				// Lo que guarda «Confirmar» del diálogo (recorte/dialogo-recorte.tsx): `paramsDeRect(normalizarRect(rect), proporcion)`.
				const params = paramsDeRect(normalizarRect(rect), proporcion);
				const antes = paramsDeRect(normalizarRect(actual.rect), actual.proporcion);
				if (Object.keys(params).every((k) => params[k] === antes[k])) break;
				const nuevo = { rect: rectDeParams(params), proporcion };
				const fila = { tipo: "cambia" as const, titulo: el.titulo, antes: textoEncuadre(actual), despues: textoEncuadre(nuevo) };
				e.encuadre = nuevo;
				escribir(params, fila);
				break;
			}
			case "reflejar": {
				if (!solo(CLIPS, "es un clip de video o imagen")) break;
				const antes = e.reflejo ?? { horizontal: false, vertical: false };
				const despues = { horizontal: op.horizontal ?? antes.horizontal, vertical: op.vertical ?? antes.vertical };
				const texto = (x: typeof antes) => (x.horizontal && x.vertical ? "reflejado y volteado" : x.horizontal ? "reflejado" : x.vertical ? "volteado" : "sin reflejo");
				e.reflejo = despues;
				escribir(
					{ ...(despues.horizontal !== antes.horizontal ? { [REFLEJO_HORIZONTAL]: despues.horizontal } : {}), ...(despues.vertical !== antes.vertical ? { [REFLEJO_VERTICAL]: despues.vertical } : {}) },
					texto(antes) === texto(despues) ? null : { tipo: "cambia", titulo: el.titulo, antes: texto(antes), despues: texto(despues) },
				);
				break;
			}
		}
	}

	// ── Los cortes: al final del lote ──────────────────────────────────────────
	// Los subtítulos de una pista bloqueada no se tocan (como en el panel «Transcripción»).
	const parrafos = (transcripcion?.parrafos ?? []).filter((p) => !p.bloqueado);
	const conPalabras = parrafos.some((p) => p.palabras.length > 0);
	const sinPalabras = () =>
		descartes.push(
			subtitulaAhora
				? "los subtítulos que se generan en este pedido todavía no existen: pide el corte después"
				: "no hay subtítulos con tiempos por palabra: genera primero los subtítulos",
		);
	const palabraPorId = new Map(palabrasEnOrden(parrafos).map((p) => [p.id, p] as const));
	// Los cortes por tiempo van primero: sus tiempos son los que vio la IA.
	for (const op of [...cortes.filter((o) => o.op === "cortar_tramo"), ...cortes.filter((o) => o.op !== "cortar_tramo")]) {
		if (op.op === "cortar_tramo") {
			const tramo = `de ${textoSegundos(op.inicio)} a ${textoSegundos(op.fin)}`;
			if (mueveLaPrincipal) { descartes.push(`el corte ${tramo} va en un pedido aparte: los otros cambios mueven la pista principal`); continue; }
			const principales = [...refs.values()].filter((r) => r.principal && !estado.get(r.ref)?.borrado);
			if (principales.some((r) => r.bloqueada)) { descartes.push("la pista principal está bloqueada"); continue; }
			const debajo = principales.some((r) => {
				const s = estado.get(r.ref)!;
				return s.inicio < op.fin - 0.001 && op.inicio < s.fin - 0.001;
			});
			if (!debajo) { descartes.push(`no hay video en la pista principal ${tramo}`); continue; }
			resueltas.push({ op: "cortar_tramo", inicio: op.inicio, fin: op.fin });
			cambios.push({ tipo: "quita", titulo: "Tramo de la línea de tiempo", antes: `${tramo} (lo de después se corre)`, despues: "" });
			continue;
		}
		if (!conPalabras && subtitulaAhora) {
			encadenar(op, "generar los subtítulos", op.op === "cortar_frase" ? `cortar «${corto(op.frase, 40)}»` : "sacar las muletillas");
			continue;
		}
		if (!conPalabras) { sinPalabras(); continue; }
		if (cambiaTiemposPrincipal) {
			const que = op.op === "cortar_frase" ? `el corte de «${corto(op.frase, 40)}»` : "sacar las muletillas";
			descartes.push(`${que} va en un pedido aparte: los otros cambios corren el video de la pista principal y los subtítulos quedan donde estaban`);
			continue;
		}
		if (op.op === "cortar_frase") {
			const apariciones = buscarFrase(parrafos, op.frase);
			const frase = `«${corto(op.frase, 40)}»`;
			if (!apariciones.length) { descartes.push(`no se dice ${frase}`); continue; }
			if (op.vez && op.vez > apariciones.length) {
				descartes.push(`${frase} se dice ${apariciones.length === 1 ? "1 vez" : `${apariciones.length} veces`}, no ${op.vez}`);
				continue;
			}
			const elegidas = op.vez ? [apariciones[op.vez - 1]] : apariciones;
			const cuando = elegidas.map((ids) => textoSegundos(palabraPorId.get(ids[0])?.inicio ?? 0));
			resueltas.push({ op: "cortar_frase", frase: op.frase, ...(op.vez ? { vez: op.vez } : {}) });
			cambios.push({
				tipo: "quita",
				titulo: frase,
				antes: elegidas.length === 1 ? `se dice en ${cuando[0]}` : `se dice ${elegidas.length} veces: en ${cuando.slice(0, 6).join(", ")}${cuando.length > 6 ? "…" : ""}`,
				despues: "",
			});
			continue;
		}
		const ids = muletillasDe(parrafos, transcripcion?.idioma ?? "es");
		if (!ids.size) { descartes.push(NO_HAY_MULETILLAS); continue; }
		const ejemplos = [...new Set([...ids].map((id) => palabraPorId.get(id)?.texto.toLowerCase()).filter(Boolean))].slice(0, 4);
		resueltas.push({ op: "eliminar_muletillas" });
		cambios.push({ tipo: "quita", titulo: ids.size === 1 ? "1 muletilla" : `${ids.size} muletillas`, antes: ejemplos.map((m) => `«${m}»`).join(", "), despues: "" });
	}

	// ── Lo que tarda: después del lote ─────────────────────────────────────────
	// «Borrar silencios» casi al final: corta según el audio, y lo de antes ya quedó donde va. Y los emojis, los últimos
	// de todos: van con el tiempo de cada subtítulo, así que después de generarlos y de que los silencios los corran.
	const ultimo = (op: (typeof diferidas)[number]) => (op.op === "emojis_subtitulos" ? 2 : op.op === "borrar_silencios" ? 1 : 0);
	diferidas.sort((a, b) => ultimo(a) - ultimo(b));
	for (const op of diferidas) {
		if (op.op === "borrar_silencios") {
			const queSilencios = `borrar los silencios (las pausas de ${segundosDeAviso(op.pausa_min ?? PAUSA_MIN_S)} o más)`;
			if (hayCortes) { encadenar(op, "los cortes", queSilencios); continue; }
			// La toma que pone ESTE pedido (agregar_medios) todavía no tiene id: sus silencios, cuando ya esté.
			if (op.ref === undefined && alcance !== "seleccion" && (sonidoNuevoPrincipal || [...refs.values()].some((r) => r.nuevo && r.principal && SONOROS.has(r.tipo) && !estado.get(r.ref)?.borrado))) {
				encadenar(op, "poner el video", queSilencios);
				continue;
			}
			// Sin ref: cada clip con sonido de la pista principal; con el alcance de la selección, los elegidos.
			const pedidos = op.ref !== undefined
				? [op.ref]
				: [...refs.values()].filter((r) => !r.nuevo && SONOROS.has(r.tipo) && (alcance === "seleccion" ? elegidos.has(r.ref) : r.principal)).map((r) => r.ref);
			const els: RefElemento[] = [];
			for (const ref of pedidos) {
				const r = resolverExistente(ref);
				if ("motivo" in r) { descartes.push(r.motivo); continue; }
				const el = r.el;
				const e = estado.get(el.ref)!.e;
				// Sin ref, un clip mudo de la principal no se nombra: no hay nada que escuchar.
				if (!SONOROS.has(el.tipo) || e.sinAudio) { if (op.ref !== undefined) descartes.push(`${el.titulo} no tiene sonido`); continue; }
				// Cortar sólo el video o sólo su audio extraído los desfasa: el botón tampoco lo hace bien.
				if (el.extraido || e.audioSeparado) { descartes.push(`${el.titulo} tiene el audio extraído: recupéralo antes de borrar los silencios`); continue; }
				els.push(el);
			}
			if (!els.length) {
				if (op.ref === undefined && !pedidos.length) descartes.push(alcance === "seleccion" ? "no elegiste un video ni un audio con sonido" : "no hay un video con sonido en la pista principal");
				continue;
			}
			const minimoS = op.pausa_min ?? PAUSA_MIN_S;
			resueltas.push({ op: "borrar_silencios", els, todo: op.ref === undefined && alcance !== "seleccion", minimoS });
			for (const el of els) cambios.push({ tipo: "quita", titulo: `Silencios de ${el.titulo}`, antes: `las pausas de ${segundosDeAviso(minimoS)} o más (se buscan al aceptar, escuchando el audio)`, despues: "" });
			continue;
		}
		if (op.op === "generar_subtitulos") {
			const conSonido = sonidoNuevoPrincipal || [...refs.values()].some((r) => (r.tipo === "video" || r.tipo === "audio") && !estado.get(r.ref)?.borrado);
			if (!conSonido) { descartes.push("no hay video ni audio para subtitular"); continue; }
			resueltas.push({ op: "generar_subtitulos" });
			cambios.push({ tipo: "agrega", titulo: "Subtítulos automáticos", antes: "", despues: "de todo el video, transcritos en tu navegador" });
			continue;
		}
		if (op.op === "broll") {
			const conSonido = sonidoNuevoPrincipal || [...refs.values()].some((r) => (r.tipo === "video" || r.tipo === "audio") && !estado.get(r.ref)?.borrado);
			if (!conSonido) { descartes.push("no hay video con voz para proponer B-roll"); continue; }
			const planos = op.planos !== false;
			const videos = op.videos === true;
			resueltas.push({ op: "broll", ritmo: op.ritmo ?? "normal", planos, videos });
			cambios.push({
				tipo: "agrega",
				titulo: "B-roll de MaKo",
				antes: "",
				despues: `${videos ? "videos cortos" : "fotos"} de Pexels${planos ? " y cambios de plano" : ""} según lo que se dice, propuestos al aceptar: dejas o sacas cada uno`,
			});
			continue;
		}
		if (op.op === "cambiar_broll") {
			const r = resolverExistente(op.ref);
			if ("motivo" in r) { descartes.push(r.motivo); continue; }
			const el = r.el;
			const busqueda = estado.get(el.ref)!.e.broll;
			if (!busqueda) { descartes.push(`${el.titulo} no es un B-roll de MaKo (para cambiar su archivo, reemplazar_clip)`); continue; }
			// Por la ref: cada elemento tiene la suya, y el id de lo que agrega el pedido es "" (dos copias serían «el mismo»).
			if (resueltas.some((x) => x.op === "cambiar_broll" && x.el.ref === el.ref)) { descartes.push(`${el.titulo} ya se cambia por otra en este mismo pedido`); continue; }
			resueltas.push({ op: "cambiar_broll", el, busqueda });
			cambios.push({
				tipo: "cambia",
				titulo: el.titulo,
				antes: el.tipo === "video" ? "el video de ahora" : "la foto de ahora",
				despues: `${el.tipo === "video" ? "el siguiente video" : "la siguiente foto"} de «${corto(busqueda, 40)}» en Pexels, en el mismo lugar (se trae al aceptar)`,
			});
			continue;
		}
		if (op.op === "emojis_subtitulos") {
			const subs = [...refs.values()].filter((r) => r.subtitulo && !estado.get(r.ref)?.borrado);
			const emojis = [...refs.values()].filter((r) => r.emojiSubtitulo && !estado.get(r.ref)?.borrado);
			if (!op.activar) {
				if (!emojis.length) { descartes.push("no hay emojis automáticos para sacar"); continue; }
				resueltas.push({ op: "emojis_subtitulos", activar: false });
				cambios.push({ tipo: "quita", titulo: emojis.length === 1 ? "1 emoji" : `${emojis.length} emojis`, antes: "encima de los subtítulos", despues: "" });
				continue;
			}
			// Con «generar_subtitulos» en el mismo pedido, los subtítulos existen al llegar acá (van antes en la cola).
			if (!subs.length && !subtitulaAhora) { descartes.push("no hay subtítulos para ponerles emojis"); continue; }
			resueltas.push({ op: "emojis_subtitulos", activar: true });
			cambios.push({
				tipo: emojis.length ? "cambia" : "agrega",
				titulo: "Emojis automáticos",
				antes: emojis.length ? `${emojis.length === 1 ? "el emoji" : `los ${emojis.length} emojis`} de ahora` : "",
				despues: "un emoji encima de cada subtítulo que dice algo que se puede dibujar (se eligen al aceptar)",
			});
			continue;
		}
		if (op.op === "clips_magicos") {
			const conSonido = [...refs.values()].some((r) => (r.tipo === "video" || r.tipo === "audio") && !estado.get(r.ref)?.borrado);
			if (!conSonido) { descartes.push("no hay video con voz para buscarle clips"); continue; }
			const cuantos = op.cuantos ?? 5;
			resueltas.push({ op: "clips_magicos", cuantos });
			cambios.push({
				tipo: "agrega",
				titulo: "Clips mágicos",
				antes: "",
				despues: `los ${cuantos} mejores momentos, para abrir cada uno en un proyecto nuevo (este no cambia)`,
			});
			continue;
		}
		if (op.op !== "revertir" && op.op !== "congelar" && op.op !== "normalizar") continue;
		const r = resolverExistente(op.ref);
		if ("motivo" in r) { descartes.push(r.motivo); continue; }
		const el = r.el;
		const st = estado.get(el.ref)!;
		// Normalizar y revertir corren después del lote y buscan el clip por su id: con un
		// corte en el mismo pedido, el clip ya está partido y sólo se procesaría el primer pedazo.
		if (partenClips && (op.op === "normalizar" || op.op === "revertir") && (el.principal || el.extraido)) {
			descartes.push(`${op.op === "normalizar" ? "normalizar" : "revertir"} ${el.titulo} va en un pedido aparte: los cortes parten el clip`);
			continue;
		}
		if (op.op === "normalizar") {
			const objetivo = op.objetivo ?? "predeterminado";
			st.e.normalizado = objetivo;
			resueltas.push({ op: "normalizar", el, objetivo: OBJETIVOS_NORMALIZAR[objetivo] });
			cambios.push({ tipo: "cambia", titulo: el.titulo, antes: "sin normalizar", despues: `normalizado (${objetivo}), después de medirlo` });
			continue;
		}
		if (el.tipo !== "video") { descartes.push(`${el.titulo} no es un video`); continue; }
		if (op.op === "revertir") {
			if (op.revertido === (st.e.revertido ?? false)) continue;
			st.e.revertido = op.revertido;
			resueltas.push({ op: "revertir", el });
			cambios.push({ tipo: "cambia", titulo: el.titulo, antes: op.revertido ? "hacia adelante" : "al revés", despues: op.revertido ? "al revés (se procesa al aplicar)" : "hacia adelante" });
			continue;
		}
		// Congelar: el segundo que vio la IA, contado desde el principio del clip.
		if (partenClips) { descartes.push(`congelar ${el.titulo} va en un pedido aparte: los cortes corren el video`); continue; }
		const desde = op.en - el.inicio;
		if (desde < 0 || desde > st.fin - st.inicio - MARGEN_CORTE) { descartes.push(`el segundo ${textoSegundos(op.en)} cae fuera de ${el.titulo}`); continue; }
		resueltas.push({ op: "congelar", el, desde });
		cambios.push({ tipo: "agrega", titulo: "Cuadro congelado", antes: "", despues: `3 s de ${el.titulo} en ${textoSegundos(op.en)} (lo que sigue se corre)` });
	}
	for (const g of estilosDeSubtitulos.values()) {
		resueltas.push({ op: "estilo_subtitulos", els: g.els, params: g.params });
		cambios.push({ ...g.fila, titulo: g.els.length === 1 ? g.els[0].titulo : `${g.els.length} subtítulos`, despues: `${g.fila.despues} (vuelve a partir los renglones)` });
	}
	return { resueltas, cambios, descartes, ...(encadenadas.length ? { encadenadas } : {}) };
}

/** Un preset de la marca por su id o por su nombre (sin tildes ni mayúsculas); dos con el mismo nombre no se eligen. */
export function presetDelChat(
	presets: NonNullable<Disponibles["presets"]>,
	cual: string,
): { preset: NonNullable<Disponibles["presets"]>[number] } | { motivo: string } {
	if (!presets.length) return { motivo: "este negocio todavía no tiene presets de subtítulos: se guardan desde el panel de un subtítulo" };
	const porId = presets.find((p) => p.id === cual);
	if (porId) return { preset: porId };
	const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
	const iguales = presets.filter((p) => norm(p.nombre) === norm(cual));
	if (iguales.length === 1) return { preset: iguales[0] };
	if (iguales.length > 1) return { motivo: `hay ${iguales.length} presets «${corto(cual, 30)}»: elige por marca` };
	return { motivo: `no hay un preset «${corto(cual, 30)}» (están: ${presets.map((p) => p.nombre).join(", ")})` };
}

/** «3 cambios», «1 texto nuevo y 2 cambios»: la cabecera de la revisión. */
export function resumenDeCambios(cambios: readonly CambioChat[]): string {
	const n = { agrega: 0, cambia: 0, quita: 0 };
	for (const c of cambios) n[c.tipo]++;
	const partes = [
		n.agrega ? `${n.agrega} ${n.agrega === 1 ? "nuevo" : "nuevos"}` : "",
		n.cambia ? `${n.cambia} ${n.cambia === 1 ? "cambia" : "cambian"}` : "",
		n.quita ? `${n.quita} ${n.quita === 1 ? "se quita" : "se quitan"}` : "",
	].filter(Boolean);
	return partes.join(" · ");
}

/** Para chat/comandos.ts: la categoría del motor de una animación del chat. */
export const categoriaMotor = (tipo: CategoriaAnimChat): CategoriaAnimacion => CATEGORIA_MOTOR[tipo];
