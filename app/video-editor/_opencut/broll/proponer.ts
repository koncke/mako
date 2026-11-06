// =============================================================================
// «Proponer B-roll y planos»: de lo que se dice en el video a una propuesta en la línea de tiempo
// =============================================================================
// Pedido de Leila (clienta, llamada del 30/10/2026), «al estilo de Submagic» (Martín la nombró):
//
//   lo que se dice (los subtítulos; si no hay, se transcribe acá mismo, local y gratis, sin ponerlos)
//   → DÓNDE: los huecos, con reglas (lib/editor-video/broll.ts), fuera de lo que la persona ya editó
//   → QUÉ: la IA del negocio elige entre esos huecos y escribe qué buscar (/api/video-editor/broll, `elegir`);
//     sin IA, las palabras de cada frase
//   → las fotos de Pexels con la clave del negocio (`buscar` y la foto), a Multimedia
//   → UN paso de deshacer: las fotos en la pista «B-roll» y los acercamientos en «Planos» (./pistas.ts), con la marca
//     de propuesta. La persona deja o saca cada una desde el panel (./components/broll-view.tsx) o el chat.
//
// No lanza: cada salida es un resultado (./resultado.ts) que leen el botón y el chat.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { extractTimelineAudio } from "@/app/video-editor/_opencut/media/mediabunny";
import { processMediaAssets } from "@/app/video-editor/_opencut/media/processing";
import { decodificarMono16k } from "@/app/video-editor/_opencut/transcription/audio";
import { armarSubtitulos, quitarNoVoz } from "@/app/video-editor/_opencut/transcription/caption";
import { maxCaracteresPara } from "@/app/video-editor/_opencut/transcription/caption-defaults";
import { transcriptionService } from "@/app/video-editor/_opencut/services/transcription/service";
import { useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { buildEffectElement, buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import type { EffectElement, ImageElement } from "@/app/video-editor/_opencut/timeline";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { cubrirCelda, paramsDeCubrir } from "@/app/video-editor/_opencut/plantillas/geometria";
import {
	huecosParaBroll,
	INTENSIDAD_ZOOM,
	planosDeLaLinea,
	type BrollElegido,
	type Frase,
	type HuecoBroll,
	type Ritmo,
} from "@/lib/editor-video/broll";
import { fotosElegidas, orientacionDeLienzo, type FotoBroll, type OrientacionBroll } from "@/lib/editor-video/broll-pexels";
import {
	conPropuestas,
	frasesDeSubtitulos,
	PARAM_AUTOR,
	PARAM_BUSQUEDA,
	PARAM_FOTO,
	PARAM_MOTIVO,
	PARAM_PROPUESTA,
	sinPendientes,
	tramosOcupados,
} from "./pistas";
import { useTrabajoBroll, type FaseBroll } from "./estado";
import { resumenDeBroll, textoDeBroll, type ResultadoBroll } from "./resultado";

const RUTA = "/api/video-editor/broll";

let enCurso = false;

type OpcionesBroll = { ritmo?: Ritmo; broll?: boolean; planos?: boolean };

/** Lo que dice la ruta cuando no sale: el texto, y si es porque falta conectar Pexels. */
type FallaRuta = { error: string; faltaPexels: boolean; status: number };

async function pedirJson<T>(cuerpo: object, plazoMs: number): Promise<{ ok: true; datos: T } | { ok: false; falla: FallaRuta }> {
	try {
		const r = await fetch(RUTA, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(cuerpo),
			signal: AbortSignal.timeout(plazoMs),
		});
		const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string; falta?: { servicio?: string } } & T) | null;
		if (!r.ok || !j || j.ok === false) {
			return { ok: false, falla: { error: j?.error ?? `El servidor contestó ${r.status}.`, faltaPexels: j?.falta?.servicio === "pexels", status: r.status } };
		}
		return { ok: true, datos: j };
	} catch {
		return { ok: false, falla: { error: "", faltaPexels: false, status: 0 } };
	}
}

/** Lo que se dice, sin poner subtítulos: el audio de la línea de tiempo por Whisper en el navegador. */
async function frasesTranscriptas(editor: EditorCore, fase: (f: FaseBroll, p: number) => void): Promise<Frase[]> {
	const blob = await extractTimelineAudio({
		tracks: editor.scenes.getActiveScene().tracks,
		mediaAssets: editor.media.getAssets(),
		totalDuration: editor.timeline.getTotalDuration(),
		onProgress: (p) => fase("escuchando", Math.round(p / 3)),
	});
	const muestras = await decodificarMono16k(blob);
	const resultado = await transcriptionService.transcribe({
		audioData: muestras,
		language: "es",
		onProgress: (p) => fase("escuchando", 33 + Math.round(p.progress * 0.67)),
	});
	const lienzo = editor.project.getActive().settings.canvasSize;
	return armarSubtitulos({ palabras: quitarNoVoz(resultado.palabras), maxCaracteres: maxCaracteresPara(lienzo) }).map((c) => ({
		texto: c.text,
		inicio: c.startTime,
		fin: c.startTime + c.duration,
	}));
}

async function bajarFoto(id: number, orientacion: OrientacionBroll): Promise<{ archivo: File; autor: string } | null> {
	try {
		const r = await fetch(`${RUTA}?foto=${id}&orientacion=${orientacion}`, { signal: AbortSignal.timeout(30_000) });
		if (!r.ok) return null;
		const blob = await r.blob();
		if (!blob.type.startsWith("image/")) return null;
		const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
		let autor = "";
		try { autor = decodeURIComponent(r.headers.get("x-foto-autor") ?? ""); } catch { /* sin crédito */ }
		return { archivo: new File([blob], `pexels-${id}.${ext}`, { type: blob.type }), autor };
	} catch {
		return null;
	}
}

export async function proponerBroll(editor: EditorCore, opciones: OpcionesBroll = {}): Promise<ResultadoBroll> {
	const trabajo = useTrabajoBroll.getState();
	const conBroll = opciones.broll !== false;
	const conPlanos = opciones.planos !== false;
	const ritmo = opciones.ritmo ?? "normal";
	const terminar = (r: ResultadoBroll): ResultadoBroll => {
		trabajo.fijar({
			fase: "inactivo",
			progreso: 0,
			mensaje: r.ok ? [resumenDeBroll(r), r.aviso].filter(Boolean).join(" ") : textoDeBroll(r),
			error: !r.ok,
			faltaPexels: r.ok ? r.faltaPexels : false,
		});
		return r;
	};
	if (enCurso || useTrabajoSubtitulos.getState().fase !== "inactivo") return { ok: false, motivo: "ocupado" };
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto || !editor.scenes.getActiveSceneOrNull() || editor.timeline.getTotalDuration() <= 0) {
		return terminar({ ok: false, motivo: "sin-proyecto" });
	}
	enCurso = true;
	const fase = (f: FaseBroll, progreso = 0) => trabajo.fijar({ fase: f, progreso, mensaje: null, error: false, faltaPexels: false });
	try {
		const tps = TICKS_PER_SECOND;
		const lienzo = proyecto.settings.canvasSize;
		const orientacion = orientacionDeLienzo(lienzo.width, lienzo.height);
		const duracion = editor.timeline.getTotalDuration() / tps;
		// Lo pendiente de una propuesta anterior se reemplaza: lo que la persona DEJÓ cuenta como ocupado.
		const base = sinPendientes(editor.scenes.getActiveScene().tracks);

		fase("escuchando");
		let frases = frasesDeSubtitulos(base, tps);
		if (!frases.length) frases = await frasesTranscriptas(editor, fase);
		if (!frases.length) return terminar({ ok: false, motivo: "sin-voz" });

		const avisos: string[] = [];
		let faltaPexels = false;
		// Lo pendiente de un tipo se reemplaza sólo si ese tipo se volvió a calcular entero: si Pexels falló, lo que ya
		// estaba propuesto se queda.
		let brollRehecho = conBroll;
		const imagenes: ImageElement[] = [];
		if (conBroll) {
			const { huecos, objetivo } = huecosParaBroll({ frases, duracion, ocupados: tramosOcupados(base, tps, "broll"), ritmo });
			if (huecos.length && objetivo) {
				fase("eligiendo");
				const eleccion = await pedirJson<{ elegidos: BrollElegido[]; aviso: string | null }>(
					{ accion: "elegir", objetivo, huecos: huecos.map(({ i, inicio, fin, frase, palabras, puntaje }) => ({ i, inicio, fin, frase, palabras, puntaje })) },
					120_000,
				);
				if (!eleccion.ok) return terminar({ ok: false, motivo: "red", ...(eleccion.falla.error ? { detalle: eleccion.falla.error } : {}) });
				if (eleccion.datos.aviso) avisos.push(eleccion.datos.aviso);
				const elegidos = eleccion.datos.elegidos ?? [];
				if (elegidos.length) {
					fase("buscando");
					const busqueda = await pedirJson<{ resultados: Array<{ consulta: string; fotos: FotoBroll[] }> }>(
						{ accion: "buscar", orientacion, consultas: elegidos.map((e) => e.busqueda) },
						120_000,
					);
					if (!busqueda.ok && busqueda.falla.faltaPexels) {
						faltaPexels = true;
						brollRehecho = false;
					} else if (!busqueda.ok) {
						return terminar({ ok: false, motivo: busqueda.falla.status ? "pexels" : "red", ...(busqueda.falla.error ? { detalle: busqueda.falla.error } : {}) });
					} else {
						const pares = fotosElegidas(elegidos, busqueda.datos.resultados ?? []);
						if (pares.length < elegidos.length) avisos.push("Alguna búsqueda no trajo fotos y quedó afuera.");
						const porHueco = new Map<number, HuecoBroll>(huecos.map((h) => [h.i, h]));
						let n = 0;
						for (const { elegido, foto } of pares) {
							fase("bajando", Math.round((n++ / pares.length) * 100));
							const hueco = porHueco.get(elegido.hueco);
							const bajada = hueco ? await bajarFoto(foto.id, orientacion) : null;
							if (!hueco || !bajada) continue;
							const [procesado] = await processMediaAssets({ files: [bajada.archivo] });
							if (!procesado) continue;
							const medio = await editor.media.addMediaAsset({ projectId: proyecto.metadata.id, asset: procesado });
							if (!medio) continue;
							const fuente = { width: medio.width ?? lienzo.width, height: medio.height ?? lienzo.height };
							const creado = buildElementFromMedia({
								mediaId: medio.id,
								mediaType: "image",
								name: `B-roll: ${elegido.busqueda}`,
								duration: mediaTimeFromSeconds({ seconds: hueco.fin - hueco.inicio }),
								startTime: mediaTimeFromSeconds({ seconds: hueco.inicio }),
							});
							imagenes.push({
								...creado,
								id: generateUUID(),
								params: {
									...creado.params,
									...paramsDeCubrir(cubrirCelda({ fuente, celda: { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height }, lienzo })),
									[PARAM_PROPUESTA]: "broll",
									[PARAM_BUSQUEDA]: elegido.busqueda,
									[PARAM_AUTOR]: bajada.autor || foto.autor,
									[PARAM_FOTO]: String(foto.id),
									[PARAM_MOTIVO]: elegido.motivo,
								},
							} as ImageElement);
						}
						if (pares.length && !imagenes.length) {
							avisos.push("No se pudieron bajar las fotos de Pexels.");
							brollRehecho = false;
						}
					}
				}
			}
		}

		const capas: EffectElement[] = [];
		if (conPlanos) {
			for (const p of planosDeLaLinea({ frases, duracion, ocupados: tramosOcupados(base, tps, "plano") })) {
				const capa = buildEffectElement({
					effectType: "efecto.acercar",
					startTime: mediaTimeFromSeconds({ seconds: p.inicio }),
					duration: mediaTimeFromSeconds({ seconds: p.fin - p.inicio }),
				});
				capas.push({
					...capa,
					id: generateUUID(),
					name: p.zoom === "fuerte" ? "Plano cerrado" : "Plano medio",
					params: { ...capa.params, intensidad: INTENSIDAD_ZOOM[p.zoom], [PARAM_PROPUESTA]: "plano" },
				} as EffectElement);
			}
		}

		if (!imagenes.length && !capas.length) {
			if (faltaPexels) return terminar({ ok: true, broll: 0, planos: 0, aviso: null, faltaPexels: true });
			return terminar({ ok: false, motivo: "sin-huecos" });
		}
		// La persona pudo abrir otro proyecto mientras tanto: no se escribe en él.
		if (editor.project.getActiveOrNull()?.metadata.id !== proyecto.metadata.id) return terminar({ ok: false, motivo: "otro-proyecto" });
		fase("armando", 100);
		const before = editor.scenes.getActiveScene().tracks;
		let limpias = before;
		if (brollRehecho) limpias = sinPendientes(limpias, "broll");
		if (conPlanos) limpias = sinPendientes(limpias, "plano");
		const after = conPropuestas({ tracks: limpias, imagenes, capas, nuevoId: generateUUID });
		editor.command.execute({ command: new TracksSnapshotCommand({ before, after }) });
		return terminar({ ok: true, broll: imagenes.length, planos: capas.length, aviso: avisos.join(" ") || null, faltaPexels });
	} catch (error) {
		console.error("[broll] no se pudo proponer", error);
		return terminar({ ok: false, motivo: "red" });
	} finally {
		enCurso = false;
	}
}
