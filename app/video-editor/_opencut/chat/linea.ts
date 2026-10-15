// =============================================================================
// chat/linea — la línea de tiempo como la lee la IA, y la revisión de lo que propone
// =============================================================================
// Dos funciones PURAS (sin React, sin EditorCore, sin el wasm: los ticks por segundo
// llegan por parámetro), así tienen test (tests/video-editor-chat.test.ts):
//
//   vistaDeLinea         → la escena en un JSON chico para la IA, con una REFERENCIA corta
//                          por elemento (v1, a2, t3…). La IA nunca ve un id del motor: un id
//                          de 36 caracteres que pasa por un modelo deja de ser exacto
//                          (AGENTS.md, «Una regla en un prompt no es una regla»).
//   revisarOperaciones   → lo que propuso la IA contra esa vista: qué se puede aplicar, la
//                          fila de cada cambio para «Original | Modificado», y por qué se
//                          descartó lo demás. Simula en orden: lo que se borra deja de
//                          existir y lo que se corta queda con la parte izquierda.
//
// Lo que se descarta, se dice («No se aplica: …»): una propuesta que calla lo que tiró se
// lee como que la IA hizo todo lo pedido.
// =============================================================================

import type { SceneTracks, TimelineElement, TimelineTrack } from "@/app/video-editor/_opencut/timeline/types";
import { TOPES_CHAT, type OperacionChat } from "@/lib/editor-video/chat-catalogo";

export type TipoRef = "video" | "imagen" | "texto" | "audio" | "sticker" | "grafico" | "efecto";

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
};

export type VistaLinea = {
	/** Lo que se le manda a la IA. */
	json: string;
	/** ref → elemento, para revisar y aplicar. */
	refs: Map<string, RefElemento>;
	/** Las refs de lo elegido en la línea de tiempo al mandar. */
	elegidos: string[];
};

const PREFIJO: Record<TimelineElement["type"], string> = {
	video: "v", image: "i", text: "t", audio: "a", sticker: "s", graphic: "g", effect: "e",
};
const TIPO: Record<TimelineElement["type"], TipoRef> = {
	video: "video", image: "imagen", text: "texto", audio: "audio", sticker: "sticker", graphic: "grafico", effect: "efecto",
};
const TIPO_PISTA: Record<TimelineTrack["type"], string> = {
	video: "video", text: "texto", audio: "audio", graphic: "grafico", effect: "efecto",
};
const ROTULO: Record<TipoRef, string> = {
	video: "Video", imagen: "Imagen", texto: "Texto", audio: "Audio", sticker: "Sticker", grafico: "Forma", efecto: "Efecto",
};

/** Segundos a la centésima. */
const seg = (ticks: number, tps: number) => Math.round((ticks / tps) * 100) / 100;

const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** «2,5 s», «3 s». Lo que se ve en la revisión. */
export function textoSegundos(s: number): string {
	const r = Math.round(s * 10) / 10;
	return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")} s`;
}

/** «0 dB», «−6 dB». */
const textoDb = (db: number) => `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(Math.round(db * 10) / 10).toString().replace(".", ",")} dB`;

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
}: {
	tracks: SceneTracks;
	tps: number;
	cabezal: number;
	elegidos: ReadonlyArray<{ trackId: string; elementId: string }>;
	refsPrevias?: ReadonlyMap<string, string>;
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
	const pistasJson = pistas.map(({ track, principal }) => {
		const bloqueada = track.locked === true;
		const elementos = [...track.elements]
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
				};
				refs.set(ref, r);
				return {
					ref,
					tipo,
					...(texto !== undefined ? { texto: corto(texto, TOPES_CHAT.texto) } : { nombre: corto(el.name || ROTULO[tipo], 60) }),
					inicio,
					fin: finEl,
					...(sonoro ? { volumen_db: r.volumenDb, silenciado: r.silenciado } : {}),
					...(r.oculto ? { oculto: true } : {}),
					...("retime" in el && el.retime && el.retime.rate !== 1 ? { velocidad: Math.round(el.retime.rate * 100) / 100 } : {}),
				};
			});
		return {
			tipo: TIPO_PISTA[track.type],
			...(principal ? { principal: true } : {}),
			...(bloqueada ? { bloqueada: true } : {}),
			elementos,
		};
	});

	const porId = new Map([...refs.values()].map((r) => [r.elementId, r.ref] as const));
	const refsElegidas = elegidos.map((e) => porId.get(e.elementId)).filter((r): r is string => !!r);
	const json = JSON.stringify({
		duracion_total: fin,
		cabezal: seg(cabezal, tps),
		elegidos: refsElegidas,
		pistas: pistasJson.filter((p) => p.elementos.length > 0 || p.tipo === "video"),
	});
	return { json, refs, elegidos: refsElegidas };
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

/** Una operación que se puede aplicar, con sus elementos ya resueltos. */
export type OperacionResuelta =
	| { op: "agregar_texto"; texto: string; inicio: number; duracion: number }
	| { op: "cambiar_texto"; el: RefElemento; texto: string }
	| { op: "borrar"; els: RefElemento[] }
	| { op: "mover"; el: RefElemento; inicio: number }
	| { op: "duracion"; el: RefElemento; duracion: number }
	| { op: "dividir"; el: RefElemento; en: number }
	| { op: "volumen"; el: RefElemento; db: number }
	| { op: "silenciar"; el: RefElemento; silenciado: boolean }
	| { op: "ocultar"; el: RefElemento; oculto: boolean };

export type Revision = { resueltas: OperacionResuelta[]; cambios: CambioChat[]; descartes: string[] };

const CON_DURACION_LIBRE = new Set<TipoRef>(["texto", "imagen", "sticker", "grafico"]);
const SONOROS = new Set<TipoRef>(["video", "audio"]);
const VISUALES = new Set<TipoRef>(["video", "imagen", "texto", "sticker", "grafico"]);
/** Un corte a menos de esto de un borde deja un pedazo que no se ve. */
const MARGEN_CORTE = 0.05;

/**
 * Lo que propuso la IA, contra la vista con la que se pidió. `alcance: "seleccion"` deja
 * tocar sólo lo elegido (agregar textos nuevos, sí). Las filas que devuelve son las de
 * «Original | Modificado».
 */
export function revisarOperaciones({
	operaciones,
	vista,
	alcance,
}: {
	operaciones: readonly OperacionChat[];
	vista: Pick<VistaLinea, "refs" | "elegidos">;
	alcance: "video" | "seleccion";
}): Revision {
	const resueltas: OperacionResuelta[] = [];
	const cambios: CambioChat[] = [];
	const descartes: string[] = [];
	// La simulación: dónde queda cada elemento a medida que se aplican las anteriores.
	const estado = new Map<string, { inicio: number; fin: number; borrado: boolean; texto?: string; volumenDb?: number; silenciado?: boolean; oculto?: boolean }>();
	for (const r of vista.refs.values()) estado.set(r.ref, { inicio: r.inicio, fin: r.fin, borrado: false, texto: r.texto, volumenDb: r.volumenDb, silenciado: r.silenciado, oculto: r.oculto });
	const elegidos = new Set(vista.elegidos);

	const resolver = (ref: string): { el: RefElemento } | { motivo: string } => {
		const el = vista.refs.get(ref);
		const st = estado.get(ref);
		if (!el || !st) return { motivo: `no encontré «${ref}» en la línea de tiempo` };
		if (st.borrado) return { motivo: `${el.titulo} ya se borra en este mismo cambio` };
		if (el.bloqueada) return { motivo: `${el.titulo} está en una pista bloqueada` };
		if (alcance === "seleccion" && !elegidos.has(ref)) return { motivo: `${el.titulo} no está elegido` };
		return { el };
	};

	/** ¿El tramo [ini, fin) pisa a otro elemento vivo de la misma pista? */
	const pisa = (el: RefElemento, ini: number, fin: number): RefElemento | null => {
		for (const otro of vista.refs.values()) {
			if (otro.ref === el.ref || otro.trackId !== el.trackId) continue;
			const st = estado.get(otro.ref);
			if (!st || st.borrado) continue;
			if (ini < st.fin - 0.001 && st.inicio < fin - 0.001) return otro;
		}
		return null;
	};

	for (const op of operaciones) {
		if (op.op === "agregar_texto") {
			resueltas.push({ op: "agregar_texto", texto: op.texto, inicio: op.inicio, duracion: op.duracion });
			cambios.push({ tipo: "agrega", titulo: "Texto nuevo", antes: "", despues: `«${corto(op.texto, 80)}» · de ${textoSegundos(op.inicio)} a ${textoSegundos(op.inicio + op.duracion)}` });
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
				if (!CON_DURACION_LIBRE.has(el.tipo)) { descartes.push(`la duración de ${el.titulo} se cambia recortándolo, no desde el chat`); break; }
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
				// La ref sigue siendo la parte IZQUIERDA (SplitElementsCommand conserva su id).
				st.fin = op.en;
				resueltas.push({ op: "dividir", el, en: op.en });
				break;
			}
			case "volumen": {
				if (!SONOROS.has(el.tipo)) { descartes.push(`${el.titulo} no tiene sonido`); break; }
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
		}
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
