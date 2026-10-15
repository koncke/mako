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
// =============================================================================

import type { SceneTracks, TimelineElement, TimelineTrack, ElementType } from "@/app/video-editor/_opencut/timeline/types";
import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import {
	AJUSTES_COLOR,
	MEZCLAS,
	OBJETIVOS_NORMALIZAR,
	TOPES_CHAT,
	colorHex,
	type CategoriaAnimChat,
	type ClaveAjuste,
	type EstiloTextoChat,
	type OperacionChat,
	type TransformChat,
} from "@/lib/editor-video/chat-catalogo";
import { ANIM, categoriasPara } from "@/app/video-editor/_opencut/params/extra/animaciones";
import { DEFAULTS_TEXTO, TEXTO } from "@/app/video-editor/_opencut/params/extra/texto";
import {
	DEFAULTS_RESALTADO,
	PARAM_NO_DICHAS_OPACIDAD,
	PARAM_RESALTAR,
	PARAM_RESALTAR_COLOR,
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
} from "@/app/video-editor/_opencut/audio/claves";
import { buscarFrase, muletillasDe, palabrasEnOrden, type ParrafoTx } from "@/app/video-editor/_opencut/transcripcion/modelo";
import type { Disponibles } from "./disponibles";

export type TipoRef = "video" | "imagen" | "texto" | "audio" | "sticker" | "grafico" | "efecto";

/** El estilo de un texto como lo lee la IA (las claves de estilo_texto), con los colores de lo apagado aparte. */
export type EstiloLeido = Required<Omit<EstiloTextoChat, "sombra">> & {
	sombra: string | false;
	colores: { trazo: string; sombra: string; fondo: string; resplandor: string };
	/** El karaoke de un subtítulo (params/extra/subtitulos.ts), como lo pide `resaltar_palabras`. */
	resaltar: ResaltarLeido;
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
};

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
	/** Lo agrega esta misma propuesta (agregar_texto o capa_efecto con "ref"): sus ids se conocen al aplicar. */
	nuevo?: boolean;
	estado: EstadoElemento;
};

export type VistaLinea = {
	/** Lo que se le manda a la IA. */
	json: string;
	/** ref → elemento, para revisar y aplicar. */
	refs: Map<string, RefElemento>;
	/** Las refs de lo elegido en la línea de tiempo al mandar. */
	elegidos: string[];
	disponibles: Disponibles;
	lienzo: { ancho: number; alto: number } | null;
};

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
	video: "video", imagen: "image", texto: "text", audio: "audio", sticker: "sticker", grafico: "graphic", efecto: "effect",
};
const TIPO_PISTA: Record<TimelineTrack["type"], string> = {
	video: "video", text: "texto", audio: "audio", graphic: "grafico", effect: "efecto",
};
const ROTULO: Record<TipoRef, string> = {
	video: "Video", imagen: "Imagen", texto: "Texto", audio: "Audio", sticker: "Sticker", grafico: "Forma", efecto: "Efecto",
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
function leerEstado(el: TimelineElement, tipo: TipoRef, tps: number, mediosSinAudio: ReadonlySet<string>): EstadoElemento {
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
	}
	if (VISUALES.has(tipo)) {
		e.anim = {};
		for (const c of categoriasPara(el.type)) {
			if (p[ANIM[c].id] !== undefined) e.anim[ANIM[c].id] = p[ANIM[c].id];
			if (p[ANIM[c].duracion] !== undefined) e.anim[ANIM[c].duracion] = p[ANIM[c].duracion];
		}
		e.transform = leerTransform(p);
	}
	if (el.type === "text") e.estilo = leerEstilo(p);
	if (el.type === "effect") e.capa = el.effectType;
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
	if (e.fotogramas?.length) o.fotogramas = e.fotogramas;
	return o;
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
	};
}

/**
 * La escena para la IA. `refsPrevias` (elementId → ref) conserva las referencias de una
 * vista anterior: al ACEPTAR se vuelve a mirar la línea de tiempo de ese momento, y «t2»
 * tiene que seguir siendo el mismo texto aunque se haya agregado otro adelante.
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
}: {
	tracks: SceneTracks;
	tps: number;
	cabezal: number;
	elegidos: ReadonlyArray<{ trackId: string; elementId: string }>;
	refsPrevias?: ReadonlyMap<string, string>;
	disponibles?: Disponibles;
	/** El tamaño del lienzo en píxeles (para que la IA ubique con «transformar»). */
	lienzo?: { ancho: number; alto: number } | null;
	/** Los medios que no tienen sonido (no se separa ni se normaliza su audio). */
	mediosSinAudio?: ReadonlySet<string>;
	/** Hay subtítulos con tiempos por palabra (cortar_frase, eliminar_muletillas). */
	conPalabras?: boolean;
}): VistaLinea {
	const refs = new Map<string, RefElemento>();
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
				const tipo = TIPO[el.type];
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
					estado: leerEstado(el, tipo, tps, mediosSinAudio),
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
		elementos: lista.map(({ r, texto, sonoro }) => ({
			ref: r.ref,
			tipo: r.tipo,
			...(texto !== undefined ? { texto: corto(texto, TOPES_CHAT.texto) } : { nombre: corto(r.titulo, 60) }),
			inicio: r.inicio,
			fin: r.fin,
			...(sonoro ? { volumen_db: r.volumenDb, silenciado: r.silenciado } : {}),
			...(r.oculto ? { oculto: true } : {}),
			...(r.subtitulo ? { subtitulo: true } : {}),
			...estadoJson(r, disponibles, estiloSubtitulos),
		})),
	}));

	const porId = new Map([...refs.values()].map((r) => [r.elementId, r.ref] as const));
	const refsElegidas = elegidos.map((e) => porId.get(e.elementId)).filter((r): r is string => !!r);
	const json = JSON.stringify({
		duracion_total: fin,
		cabezal: seg(cabezal, tps),
		...(lienzo ? { lienzo } : {}),
		elegidos: refsElegidas,
		...(primerSubtitulo ? { transcripcion_por_palabra: conPalabras } : {}),
		...(estiloSubtitulos ? { estilo_subtitulos: JSON.parse(estiloSubtitulos) } : {}),
		pistas: pistasJson.filter((p) => p.elementos.length > 0 || p.tipo === "video"),
		...(disponiblesJson(disponibles) ? { disponibles: disponiblesJson(disponibles) } : {}),
	});
	return { json, refs, elegidos: refsElegidas, disponibles, lienzo };
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
	| { op: "agregar_texto"; texto: string; inicio: number; duracion: number; ref?: string }
	| { op: "cambiar_texto"; el: RefElemento; texto: string }
	| { op: "borrar"; els: RefElemento[] }
	| { op: "mover"; el: RefElemento; inicio: number }
	| { op: "duracion"; el: RefElemento; duracion: number }
	| { op: "dividir"; el: RefElemento; en: number }
	| { op: "recortar"; el: RefElemento; inicio?: number; fin?: number }
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
	| { op: "reemplazar_en_subtitulos"; buscar: string; reemplazo: string; cuantos: number }
	// Al final, en este orden: los cortes (dentro del lote) y lo que tarda (después).
	| { op: "cortar_tramo"; inicio: number; fin: number }
	| { op: "cortar_frase"; frase: string; vez?: number }
	| { op: "eliminar_muletillas" }
	| { op: "revertir"; el: RefElemento }
	/** `desde`: segundos desde el principio del clip, como lo vio la IA. */
	| { op: "congelar"; el: RefElemento; desde: number }
	| { op: "normalizar"; el: RefElemento; objetivo: string }
	| { op: "generar_subtitulos" };

export type Revision = { resueltas: OperacionResuelta[]; cambios: CambioChat[]; descartes: string[] };

/** La transcripción del momento (transcripcion/modelo.ts) y el idioma de las muletillas. */
export type TranscripcionChat = { parrafos: readonly ParrafoTx[]; idioma: string };

const CON_DURACION_LIBRE = new Set<TipoRef>(["texto", "imagen", "sticker", "grafico", "efecto"]);
const SONOROS = new Set<TipoRef>(["video", "audio"]);
const VISUALES = new Set<TipoRef>(["video", "imagen", "texto", "sticker", "grafico"]);
const CLIPS = new Set<TipoRef>(["video", "imagen"]);
/** Un corte a menos de esto de un borde deja un pedazo que no se ve. */
const MARGEN_CORTE = 0.05;
/** Lo mínimo que puede durar un clip después de un recorte o una velocidad (pc_clip_too_short). */
const LARGO_MINIMO = 0.1;
/** Un subtítulo se vuelve a partir si cambia esto (subtitles/repartir.ts): desde el chat no. */
const ESTILO_QUE_PARTE: ReadonlyArray<keyof EstiloTextoChat> = ["fuente", "tamano", "negrita", "cursiva", "espaciado"];

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
	operaciones,
	vista,
	alcance,
	transcripcion,
}: {
	operaciones: readonly OperacionChat[];
	vista: Pick<VistaLinea, "refs" | "elegidos"> & Partial<Pick<VistaLinea, "disponibles">>;
	alcance: "video" | "seleccion";
	/** Los subtítulos con tiempos por palabra (cortar_frase, eliminar_muletillas). */
	transcripcion?: TranscripcionChat;
}): Revision {
	const d = vista.disponibles ?? DISPONIBLES_VACIOS;
	const resueltas: OperacionResuelta[] = [];
	const cambios: CambioChat[] = [];
	const descartes: string[] = [];
	// La simulación: dónde queda cada elemento y cómo, a medida que se aplican las anteriores.
	type Sim = { inicio: number; fin: number; borrado: boolean; texto?: string; volumenDb?: number; silenciado?: boolean; oculto?: boolean; e: EstadoElemento };
	const refs = new Map(vista.refs);
	const estado = new Map<string, Sim>();
	const simular = (r: RefElemento) =>
		estado.set(r.ref, { inicio: r.inicio, fin: r.fin, borrado: false, texto: r.texto, volumenDb: r.volumenDb, silenciado: r.silenciado, oculto: r.oculto, e: JSON.parse(JSON.stringify(r.estado)) as EstadoElemento });
	for (const r of refs.values()) simular(r);
	const elegidos = new Set(vista.elegidos);

	const resolver = (ref: string): { el: RefElemento } | { motivo: string } => {
		const el = refs.get(ref);
		const st = estado.get(ref);
		if (!el || !st) return { motivo: `no encontré «${ref}» en la línea de tiempo` };
		if (st.borrado) return { motivo: `${el.titulo} ya se borra en este mismo cambio` };
		if (el.bloqueada) return { motivo: `${el.titulo} está en una pista bloqueada` };
		if (alcance === "seleccion" && !el.nuevo && !elegidos.has(ref)) return { motivo: `${el.titulo} no está elegido` };
		return { el };
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

	/** Una propiedad con ◇: cambiar su valor base no se vería. */
	const conFotograma = (el: RefElemento, st: Sim, grupo: string | null | undefined): boolean => {
		if (!grupo || !st.e.fotogramas?.includes(grupo)) return false;
		descartes.push(`${el.titulo} tiene fotogramas clave en «${grupo}»: cámbialo en el panel`);
		return true;
	};

	// Lo que se aplica AL FINAL (ver la cabecera): se revisa después del resto.
	const cortes: OperacionChat[] = [];
	const diferidas: OperacionChat[] = [];
	const enPrincipal = (ref: string) => refs.get(ref)?.principal === true;
	const mueveLaPrincipal = operaciones.some(
		(o) =>
			(o.op === "borrar" && o.refs.some(enPrincipal)) ||
			((o.op === "recortar" || o.op === "velocidad" || o.op === "duracion" || o.op === "mover" || o.op === "congelar") && enPrincipal(o.ref)) ||
			o.op === "cortar_frase" ||
			o.op === "eliminar_muletillas",
	);
	const hayCortes = operaciones.some((o) => o.op === "cortar_frase" || o.op === "cortar_tramo" || o.op === "eliminar_muletillas");
	const subtitulaAhora = operaciones.some((o) => o.op === "generar_subtitulos");

	for (const op of operaciones) {
		if (op.op === "cortar_frase" || op.op === "cortar_tramo" || op.op === "eliminar_muletillas") { cortes.push(op); continue; }
		if (op.op === "generar_subtitulos" || op.op === "revertir" || op.op === "congelar") { diferidas.push(op); continue; }
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
			if (!subs.length) {
				descartes.push(subtitulaAhora ? "los subtítulos que se generan en este pedido todavía no existen: pide el resaltado después" : "no hay subtítulos para resaltar");
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
		if (op.op === "agregar_texto") {
			const titulo = `«${corto(op.texto.replace(/\s+/g, " "), 40)}»`;
			const estadoNuevo: EstadoElemento = { anim: {}, transform: leerTransform({}), estilo: leerEstilo({}) };
			if (!registrarNuevo(op.ref, "texto", titulo, op.inicio, op.inicio + op.duracion, estadoNuevo, op.texto)) continue;
			resueltas.push({ op: "agregar_texto", texto: op.texto, inicio: op.inicio, duracion: op.duracion, ...(op.ref ? { ref: op.ref } : {}) });
			cambios.push({ tipo: "agrega", titulo: "Texto nuevo", antes: "", despues: `«${corto(op.texto, 80)}» · de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + op.duracion)}` });
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
				cambios.push({ tipo: "quita", titulo: el.titulo, antes: `de ${textoSegundos(st.inicio)} a ${textoSegundos(st.fin)}`, despues: "" });
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
				if (el.tipo !== "texto") { descartes.push(`${el.titulo} no es un texto`); break; }
				if (op.texto === st.texto) break;
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
				resueltas.push({ op: "dividir", el, en: op.en });
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
				if (el.tipo !== "texto" || !e.estilo) { descartes.push(`${el.titulo} no es un texto`); break; }
				const pedidos = Object.keys(op.estilo) as Array<keyof EstiloTextoChat>;
				if (el.subtitulo && pedidos.some((k) => ESTILO_QUE_PARTE.includes(k))) {
					descartes.push(`la fuente, el tamaño, la negrita, la cursiva y el espaciado de un subtítulo se cambian en el panel Texto (vuelve a partir los renglones)`);
					break;
				}
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
				const { nuevo, params } = aplicarEstilo(e.estilo, estilo);
				const fila = filaCampos(
					el.titulo,
					pedidos.map((k) => [ETIQUETA_ESTILO[k], e.estilo![k as keyof EstiloLeido], nuevo[k as keyof EstiloLeido]] as [string, unknown, unknown]),
				);
				e.estilo = nuevo;
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
	const parrafos = transcripcion?.parrafos ?? [];
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
		if (!conPalabras) { sinPalabras(); continue; }
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
		if (!ids.size) { descartes.push("no se identificaron muletillas"); continue; }
		const ejemplos = [...new Set([...ids].map((id) => palabraPorId.get(id)?.texto.toLowerCase()).filter(Boolean))].slice(0, 4);
		resueltas.push({ op: "eliminar_muletillas" });
		cambios.push({ tipo: "quita", titulo: ids.size === 1 ? "1 muletilla" : `${ids.size} muletillas`, antes: ejemplos.map((m) => `«${m}»`).join(", "), despues: "" });
	}

	// ── Lo que tarda: después del lote ─────────────────────────────────────────
	for (const op of diferidas) {
		if (op.op === "generar_subtitulos") {
			const conSonido = [...refs.values()].some((r) => (r.tipo === "video" || r.tipo === "audio") && !estado.get(r.ref)?.borrado);
			if (!conSonido) { descartes.push("no hay video ni audio para subtitular"); continue; }
			resueltas.push({ op: "generar_subtitulos" });
			cambios.push({ tipo: "agrega", titulo: "Subtítulos automáticos", antes: "", despues: "de todo el video, transcritos en tu navegador" });
			continue;
		}
		if (op.op !== "revertir" && op.op !== "congelar" && op.op !== "normalizar") continue;
		const r = resolver(op.ref);
		if ("motivo" in r) { descartes.push(r.motivo); continue; }
		const el = r.el;
		const st = estado.get(el.ref)!;
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
		if (hayCortes) { descartes.push(`congelar ${el.titulo} va en un pedido aparte: los cortes corren el video`); continue; }
		const desde = op.en - el.inicio;
		if (desde < 0 || desde > st.fin - st.inicio - MARGEN_CORTE) { descartes.push(`el segundo ${textoSegundos(op.en)} cae fuera de ${el.titulo}`); continue; }
		resueltas.push({ op: "congelar", el, desde });
		cambios.push({ tipo: "agrega", titulo: "Cuadro congelado", antes: "", despues: `3 s de ${el.titulo} en ${textoSegundos(op.en)} (lo que sigue se corre)` });
	}
	return { resueltas, cambios, descartes };
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
