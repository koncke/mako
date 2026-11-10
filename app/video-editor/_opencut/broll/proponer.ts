// =============================================================================
// «Proponer B-roll y planos»: de lo que se dice en el video a una propuesta en la línea de tiempo
// =============================================================================
// Pedido de Leila (clienta, llamada del 30/10/2026), «al estilo de Submagic» (Martín la nombró):
//
//   lo que se dice (los subtítulos; si no hay, se transcribe acá mismo, local y gratis, sin ponerlos: ./frases-del-video.ts)
//   → DÓNDE: los huecos, con reglas (lib/editor-video/broll.ts), fuera de lo que la persona ya editó
//   → QUÉ: la IA del negocio elige entre esos huecos y escribe qué buscar (/api/video-editor/broll, `elegir`);
//     sin IA, las palabras de cada frase
//   → las fotos (o los videos cortos, con `medio: "videos"`) de Pexels con la clave del negocio, a Multimedia (./red.ts)
//   → UN paso de deshacer: las fotos en la pista «B-roll» y los acercamientos en «Planos» (./pistas.ts), con la marca
//     de propuesta. La persona deja o saca cada una desde el panel (./components/broll-view.tsx) o el chat.
//
// No lanza: cada salida es un resultado (./resultado.ts) que leen el botón y el chat.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { buildEffectElement, buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import type { EffectElement, ImageElement, VideoElement } from "@/app/video-editor/_opencut/timeline";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { mediaTimeFromSeconds, TICKS_PER_SECOND, type MediaTime } from "@/app/video-editor/_opencut/wasm";
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
import { fotosElegidas, orientacionDeLienzo, type FotoBroll, type VideoBroll } from "@/lib/editor-video/broll-pexels";
import {
	conPropuestas,
	idsEnUso,
	type MedioBroll,
	PARAM_AUTOR,
	PARAM_BUSQUEDA,
	PARAM_FOTO,
	PARAM_MOTIVO,
	PARAM_PROPUESTA,
	sinPendientes,
	tramosOcupados,
} from "./pistas";
import { frasesDelVideo } from "./frases-del-video";
import { useTrabajoBroll, type FaseBroll } from "./estado";
import { resumenDeBroll, textoDeBroll, type ResultadoBroll } from "./resultado";
import { aMultimedia, bajarDePexels, pedirJson } from "./red";

let enCurso = false;

/** Un video tiene que durar lo que el hueco y un poco más (el redondeo a ticks no lo deja corto). */
const MARGEN_VIDEO_S = 0.1;

type OpcionesBroll = {
	ritmo?: Ritmo;
	broll?: boolean;
	planos?: boolean;
	/** Qué traer de Pexels: fotos (sin esto) o videos cortos. */
	medio?: MedioBroll;
	/**
	 * Lo que se dice, ya leído (la «Edición automática», enjambre/correr.ts): el B-roll y los planos son dos agentes, y sin
	 * esto cada uno volvía a transcribir el video entero con Whisper cuando no había subtítulos (revisión del 9/11/2026).
	 */
	frases?: Frase[];
	/** Lo que se leyó (o transcribió), para que otro agente de la misma corrida lo reuse sin volver a transcribir. */
	alLeerFrases?: (frases: Frase[]) => void;
};

export async function proponerBroll(editor: EditorCore, opciones: OpcionesBroll = {}): Promise<ResultadoBroll> {
	const trabajo = useTrabajoBroll.getState();
	const conBroll = opciones.broll !== false;
	const conPlanos = opciones.planos !== false;
	const ritmo = opciones.ritmo ?? "normal";
	const medio: MedioBroll = opciones.medio === "videos" ? "videos" : "fotos";
	const conVideos = medio === "videos";
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
	// «Cambiar por otra» (./cambiar.ts) trabaja sobre un B-roll que esta propuesta puede reemplazar: una cosa a la vez.
	if (enCurso || trabajo.cambiando || useTrabajoSubtitulos.getState().fase !== "inactivo") return { ok: false, motivo: "ocupado" };
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
		const frases = opciones.frases ?? (await frasesDelVideo(editor, (p) => fase("escuchando", p)));
		opciones.alLeerFrases?.(frases);
		if (!frases.length) return terminar({ ok: false, motivo: "sin-voz" });

		const avisos: string[] = [];
		let faltaPexels = false;
		// Lo pendiente de un tipo se reemplaza sólo si ese tipo se volvió a calcular entero: si Pexels falló, lo que ya
		// estaba propuesto se queda.
		let brollRehecho = conBroll;
		const imagenes: Array<ImageElement | VideoElement> = [];
		if (conBroll) {
			const { huecos, objetivo } = huecosParaBroll({ frases, duracion, ocupados: tramosOcupados(base, tps, "broll"), ritmo });
			// Sin Pexels no hay fotos: se pregunta ANTES de pedirle a la IA del negocio que elija (antes se gastaba esa
			// llamada y recién `buscar` decía que faltaba la conexión). Si la pregunta falla, se sigue como antes.
			const pexels = huecos.length && objetivo ? await pedirJson<{ conectado: boolean }>({ accion: "pexels" }, 15_000) : null;
			if (pexels?.ok && pexels.datos.conectado === false) {
				faltaPexels = true;
				brollRehecho = false;
			} else if (huecos.length && objetivo) {
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
					const busqueda = await pedirJson<{ resultados: Array<{ consulta: string; fotos?: FotoBroll[]; videos?: VideoBroll[] }> }>(
						{ accion: "buscar", orientacion, medio, consultas: elegidos.map((e) => e.busqueda) },
						120_000,
					);
					if (!busqueda.ok && busqueda.falla.faltaPexels) {
						faltaPexels = true;
						brollRehecho = false;
					} else if (!busqueda.ok) {
						return terminar({ ok: false, motivo: busqueda.falla.status ? "pexels" : "red", ...(busqueda.falla.error ? { detalle: busqueda.falla.error } : {}) });
					} else {
						const porHueco = new Map<number, HuecoBroll>(huecos.map((h) => [h.i, h]));
						const resultados = (busqueda.datos.resultados ?? []).map((r) => ({
							consulta: r.consulta,
							fotos: (conVideos ? r.videos : r.fotos) ?? [],
						}));
						// Lo que la persona ya DEJÓ no se repite en otro lugar; un video tiene que durar lo que su hueco.
						const pares = fotosElegidas<FotoBroll | VideoBroll>(elegidos, resultados, {
							yaUsadas: idsEnUso(base, medio),
							sirve: (item, e) => {
								if (!("duracion" in item)) return true;
								const h = porHueco.get(e.hueco);
								return !!h && item.duracion >= h.fin - h.inicio + MARGEN_VIDEO_S;
							},
						});
						if (pares.length < elegidos.length) {
							avisos.push(conVideos ? "Alguna búsqueda no trajo un video que sirva y quedó afuera." : "Alguna búsqueda no trajo fotos y quedó afuera.");
						}
						let n = 0;
						let pesados = 0;
						for (const { elegido, foto } of pares) {
							fase("bajando", Math.round((n++ / pares.length) * 100));
							const hueco = porHueco.get(elegido.hueco);
							if (!hueco) continue;
							const bajada = await bajarDePexels(foto.id, medio, orientacion);
							if (!bajada.ok) {
								if (/pesa demasiado/.test(bajada.error)) pesados++;
								continue;
							}
							const asset = await aMultimedia(editor, proyecto.metadata.id, bajada.archivo);
							if (!asset) continue;
							const largo = hueco.fin - hueco.inicio;
							if (conVideos && !((asset.duration ?? 0) >= largo)) continue;
							const fuente = { width: asset.width ?? lienzo.width, height: asset.height ?? lienzo.height };
							const enLinea = mediaTimeFromSeconds({ seconds: largo });
							const creado = buildElementFromMedia({
								mediaId: asset.id,
								mediaType: conVideos ? "video" : "image",
								name: `B-roll: ${elegido.busqueda}`,
								duration: enLinea,
								startTime: mediaTimeFromSeconds({ seconds: hueco.inicio }),
							});
							// Un video entra con su fuente entera (se usa el principio, como «Reemplazar») y sin sonido: el
							// B-roll va encima de quien habla, y lo que se oye es su voz.
							const fuenteVideo = conVideos ? mediaTimeFromSeconds({ seconds: asset.duration ?? largo }) : null;
							imagenes.push({
								...creado,
								id: generateUUID(),
								...(fuenteVideo != null
									? { sourceDuration: fuenteVideo, trimEnd: Math.max(0, fuenteVideo - enLinea) as MediaTime }
									: {}),
								params: {
									...creado.params,
									...paramsDeCubrir(cubrirCelda({ fuente, celda: { x: 0, y: 0, ancho: lienzo.width, alto: lienzo.height }, lienzo })),
									...(conVideos ? { muted: true } : {}),
									[PARAM_PROPUESTA]: "broll",
									[PARAM_BUSQUEDA]: elegido.busqueda,
									[PARAM_AUTOR]: bajada.autor || foto.autor,
									[PARAM_FOTO]: String(foto.id),
									[PARAM_MOTIVO]: elegido.motivo,
								},
							} as ImageElement | VideoElement);
						}
						if (pesados) avisos.push(pesados === 1 ? "Un video pesaba demasiado para traerlo y quedó afuera." : `${pesados} videos pesaban demasiado para traerlos y quedaron afuera.`);
						if (pares.length && !imagenes.length) {
							avisos.push(conVideos ? "No se pudieron bajar los videos de Pexels." : "No se pudieron bajar las fotos de Pexels.");
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
