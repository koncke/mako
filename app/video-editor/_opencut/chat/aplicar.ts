// =============================================================================
// chat/aplicar — aceptar y restaurar una propuesta del chat
// =============================================================================
// El contrato es el del Landing (`aceptarPropuesta` en app/web-generator/editor/
// paneles/PanelAgente.tsx), en el mismo orden:
//
//   1. Lo pendiente, guardado (`editor.save.flush`). Si no se guardó, NO se aplica: la
//      revisión ofrece «Aplicar igual».
//   2. Recién ahí, la línea de tiempo: la de AHORA, con las mismas referencias con las que
//      se pidió (`refsPrevias`), y se vuelve a revisar. Lo que se borró o se bloqueó mientras
//      tanto se descarta con su motivo. Las fuentes que pide un estilo se cargan ANTES de
//      mirarla (como el selector de fuentes, que carga y después escribe): después de
//      mirarla no hay otro `await` hasta el lote.
//   3. Todo con los comandos del PROPIO motor (chat/comandos.ts), en un BatchCommand: UN
//      paso de deshacer. Así un corte, un borrado o un cambio de volumen del chat se portan
//      igual que los de la barra (imán, transiciones, fundidos, animaciones). Los cortes por
//      tiempo o por frase van al final del lote.
//   4. Lo que tarda (revertir, congelar, medir para normalizar, subtitular, usar una
//      plantilla, borrar los silencios) va DESPUÉS, cada uno con su paso: procesa el archivo,
//      transcribe, arma o escucha. Lo que va haciendo se cuenta (`alProgreso`, ./armado.ts) para
//      que se vea construyéndose.
//      «Restaurar» deshace todos los pasos. Lo que no cambió nada se dice («No se aplica: …»),
//      no se calla: también un reemplazo que al ejecutarse no entró.
//
// ⚠️ El editor de video no tiene historial de versiones como el Landing («Antes de un cambio
// de IA»): la vuelta atrás es «Restaurar» (el deshacer, si nadie tocó la línea de tiempo
// después) o Ctrl+Z. Está anotado en docs/hallazgos-video-editor.md.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { BatchCommand } from "@/app/video-editor/_opencut/commands/batch-command";
import type { SceneTracks, TimelineElement, TScene } from "@/app/video-editor/_opencut/timeline/types";
import type { TProjectSettings } from "@/app/video-editor/_opencut/project/types";
import { PLANTILLAS_TEXTO } from "@/app/video-editor/_opencut/text/estilos-predefinidos";
import { plantillaPorId } from "@/lib/editor-video/plantillas";
import { usarPlantilla, type ResultadoUsar } from "@/app/video-editor/_opencut/plantillas/instanciar";
import { leerAncla } from "@/app/video-editor/_opencut/plantillas/huecos";
import { buscarClip } from "@/app/video-editor/_opencut/reemplazo/puro";
import { TICKS_PER_SECOND, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import type { OperacionChat } from "@/lib/editor-video/chat-catalogo";
import { generarSubtitulos } from "@/app/video-editor/_opencut/subtitles/generar";
import { MOTIVO_SUBTITULOS } from "@/app/video-editor/_opencut/subtitles/resultado";
import { aplicarPreset, PREFIJO_PRESET, usePresetsSubtitulos } from "@/app/video-editor/_opencut/subtitles/presets";
import { aplicarEstiloASubtitulos } from "@/app/video-editor/_opencut/subtitles/insert";
import { usePreferenciasSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { PLANTILLAS_SUBTITULO, paramsDePlantilla } from "@/app/video-editor/_opencut/subtitles/estilos";
import { lienzoDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { ponerEmojisEnSubtitulos } from "@/app/video-editor/_opencut/subtitles/emojis-poner";
import { subtitulosDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { proponerBroll } from "@/app/video-editor/_opencut/broll/proponer";
import { cambiarBroll } from "@/app/video-editor/_opencut/broll/cambiar";
import { avisoFaltaPexels, textoDeBroll, textoDeCambioBroll } from "@/app/video-editor/_opencut/broll/resultado";
import { buscarClips } from "@/app/video-editor/_opencut/clips/buscar";
import { textoDeClips } from "@/app/video-editor/_opencut/clips/resultado";
import { SECCION_CLIPS } from "@/app/video-editor/_opencut/clips/secciones";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { revertirClip } from "@/app/video-editor/_opencut/commands/timeline/element/revertir";
import { congelarCuadro } from "@/app/video-editor/_opencut/commands/timeline/element/congelar";
import { alternarNormalizacion } from "@/app/video-editor/_opencut/audio/normalizar";
import { quitarSilencios, type ResultadoSilencios } from "@/app/video-editor/_opencut/audio/borrar-silencios";
import { NO_ENCONTRE, textoSinSilencios } from "@/app/video-editor/_opencut/audio/silencios-aviso";
import { NORMALIZAR_OBJETIVO } from "@/app/video-editor/_opencut/audio/claves";
import type { ClipConAudio } from "@/app/video-editor/_opencut/audio/decodificar";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { revisarOperaciones, VUELTAS_ENCADENADAS, vistaDeLinea, type OperacionResuelta } from "./linea";
import { armarLote, esLarga, type OperacionLarga } from "./comandos";
import { datosDeLinea, disponiblesChat } from "./contexto";
import type { ProgresoChat } from "./armado";
import { mismoFondo } from "./fondo-proyecto";

/** Lo que propuso la IA, con lo necesario para aplicarlo en la línea de tiempo correcta. */
export type PropuestaChat = {
	proyectoId: string;
	escenaId: string;
	/**
	 * La línea de tiempo al mandar (para avisar «Cambiaste la línea de tiempo mientras tanto»). No viene en una
	 * propuesta que se leyó guardada (chat/hilo.ts): esas pistas no se guardan, y la revisión al aceptar es la misma.
	 */
	tracksEnviados?: SceneTracks;
	/** id → ref de la vista que se mandó: de los elementos y de los medios de Multimedia. */
	refsPorId: Map<string, string>;
	elegidos: Array<{ trackId: string; elementId: string }>;
	alcance: "video" | "seleccion";
	operaciones: OperacionChat[];
};

/**
 * Lo necesario para deshacer un cambio aplicado: `pasos` son los del historial (el lote, y uno por cada operación larga).
 * `ajustes`: los del proyecto antes y después, si el cambio tocó alguno (el fondo del lienzo no cambia las pistas).
 */
export type AplicadaChat = {
	escenaId: string;
	antes: SceneTracks;
	despues: SceneTracks;
	pasos: number;
	ajustes?: { antes: TProjectSettings; despues: TProjectSettings };
};

export type ResultadoAceptar =
	| { ok: true; aplicada: AplicadaChat; descartes: string[] }
	| { ok: false; error: string; sinVersion?: boolean };

/** Por qué no se armó una plantilla (plantillas/instanciar.ts), para la persona. */
const NO_SE_ARMO: Record<Extract<ResultadoUsar, { ok: false }>["motivo"], string> = {
	"sin-proyecto": "no hay un proyecto abierto",
	"no-vacia": "la plantilla se usa con la línea de tiempo vacía",
	ocupado: "ya se está armando otra plantilla",
	error: "no se pudo cargar la plantilla",
};

/** Por qué no se borraron los silencios (audio/borrar-silencios.ts), para la persona. «Sin pausas» tiene su aviso
 *  propio, que dice dónde se buscó y qué pedir (audio/silencios-aviso.ts, ticket 31). */
const SIN_SILENCIOS: Record<Exclude<Extract<ResultadoSilencios, { ok: false }>["motivo"], "sin-silencios">, string> = {
	"sin-clip": "el clip para borrarle los silencios ya no está",
	ocupado: "ya se están borrando silencios",
	"sin-audio": "el clip no tiene audio",
	"todo-silencio": "el clip es todo silencio: no se borra entero",
	error: "no se pudo leer el audio",
};

/** El aviso de un pedido que no cambió nada. «No se aplica: …», salvo el que ya dice qué pasó y qué pedir (ticket 31). */
const noSeAplica = (descarte: string | undefined, sinNada: string) =>
	!descarte ? sinNada : descarte.startsWith(NO_ENCONTRE) ? descarte : `No se aplica: ${descarte}`;

/**
 * Una operación larga, contra el elemento de AHORA (el lote pudo moverlo). Devuelve lo que
 * hay que decir de ella (los huecos que quedaron con su muestra, por qué no se armó…).
 */
async function correrLarga(
	editor: EditorCore,
	r: Exclude<OperacionLarga, { op: "edicion_automatica" }>,
	alProgreso?: (p: ProgresoChat) => void,
): Promise<string[]> {
	if (r.op === "borrar_silencios") {
		// El MISMO trabajo que el botón de la barra, sobre los clips de la propuesta y nunca el del cabezal.
		const titulos = new Map(r.els.map((el) => [el.elementId, el.titulo] as const));
		const hecho = await quitarSilencios(editor, {
			seleccion: r.els.map((el) => ({ trackId: el.trackId, elementId: el.elementId })),
			cabezal: false,
			minimoS: r.minimoS,
			alPaso: (paso) =>
				alProgreso?.(paso.tipo === "cortando" ? paso : { ...paso, titulo: titulos.get(paso.elementId) ?? paso.nombre }),
		});
		alProgreso?.(hecho.ok ? { tipo: "listo", segundos: hecho.segundos } : { tipo: "fallo" });
		if (hecho.ok) return [];
		if (hecho.motivo !== "sin-silencios") return [SIN_SILENCIOS[hecho.motivo]];
		// Dónde se buscó y qué pedir: a Leila le dijo «no hay» de un clip de 0,9 s cuando pedía el video (ticket 31).
		const titulo = r.els.length === 1 ? r.els[0].titulo : hecho.titulo;
		return [textoSinSilencios({ clips: hecho.clips, ...(titulo ? { titulo } : {}), segundos: hecho.segundos, minimoS: hecho.minimoS, todoElVideo: r.todo })];
	}
	if (r.op === "generar_subtitulos") {
		// generarSubtitulos no lanza: sin leer lo que devuelve, el chat sólo ve que la línea no
		// cambió y dice «no se pudo generar los subtítulos» por cualquier causa (ticket 23, 28/10).
		const hecho = await generarSubtitulos(editor);
		return hecho.ok ? [] : [MOTIVO_SUBTITULOS[hecho.motivo]];
	}
	if (r.op === "usar_preset_subtitulos") {
		// El MISMO de la pestaña Plantillas: estilo, renglones y palabras clave en un paso de deshacer.
		await usePresetsSubtitulos.getState().cargar();
		const preset = usePresetsSubtitulos.getState().presets.find((p) => p.id === r.preset);
		if (!preset) return ["ese preset ya no está (lo borraron)"];
		const n = await aplicarPreset(editor, preset);
		if (n > 0) usePreferenciasSubtitulos.getState().fijar({ plantilla: `${PREFIJO_PRESET}${preset.id}` });
		return n > 0 ? [] : ["no hay subtítulos"];
	}
	if (r.op === "usar_plantilla_subtitulos") {
		// Lo MISMO que tocar su tarjeta en Subtítulos › Plantillas (subtitles/components/assets-view.tsx, `elegir`): queda
		// elegida para los que se generen después y se aplica a todos, con los renglones vueltos a partir.
		const plantilla = PLANTILLAS_SUBTITULO.find((p) => p.id === r.plantilla);
		if (!plantilla) return ["esa plantilla ya no está"];
		usePreferenciasSubtitulos.getState().fijar({ plantilla: plantilla.id });
		const n = await aplicarEstiloASubtitulos({ editor, estilo: paramsDePlantilla(plantilla, lienzoDe(editor)) });
		return n > 0 ? [] : ["no hay subtítulos"];
	}
	if (r.op === "estilo_subtitulos") {
		// El MISMO de «Aplicar en todos los subtítulos» (subtitles/insert.ts): el estilo y los renglones vueltos a partir con la
		// fuente nueva, en un paso de deshacer. Sólo los que nombró el pedido.
		const n = await aplicarEstiloASubtitulos({ editor, estilo: r.params, solo: new Set(r.els.map((e) => e.elementId)) });
		return n > 0 ? [] : ["esos subtítulos ya no están"];
	}
	if (r.op === "broll") {
		// El MISMO de la sección «B-roll de MaKo»: propone, y la persona deja o saca cada uno en la línea de tiempo.
		const hecho = await proponerBroll(editor, { ritmo: r.ritmo, planos: r.planos, medio: r.videos ? "videos" : "fotos" });
		if (!hecho.ok) return [textoDeBroll(hecho)];
		const avisos = [hecho.aviso, hecho.faltaPexels ? avisoFaltaPexels(r.videos ? "videos" : "fotos", hecho.propios ?? 0) : null].filter((x): x is string => !!x);
		return avisos;
	}
	if (r.op === "cambiar_broll") {
		// El MISMO de «Otra» en la sección «B-roll de MaKo»: la siguiente de la misma búsqueda, en un paso de deshacer.
		const hecho = await cambiarBroll(editor, { trackId: r.el.trackId, elementId: r.el.elementId });
		return hecho.ok ? [] : [textoDeCambioBroll(hecho)];
	}
	if (r.op === "emojis_subtitulos") {
		// El MISMO de la sección «Emojis» de la pestaña Subtítulos: un paso de deshacer.
		const n = ponerEmojisEnSubtitulos({ editor, activar: r.activar });
		if (!r.activar) return [];
		return n > 0 ? [] : [subtitulosDe(editor.scenes.getActiveSceneOrNull()?.tracks ?? null).length ? "ningún subtítulo dice algo con emoji" : "no hay subtítulos para ponerles emojis"];
	}
	if (r.op === "clips_magicos") {
		// El MISMO de «Clips mágicos»: los busca y abre la sección, donde se abre cada uno en un proyecto nuevo.
		const hecho = await buscarClips(editor, { cuantos: r.cuantos });
		if (!hecho.ok) return [textoDeClips(hecho)];
		useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_CLIPS });
		return hecho.aviso ? [hecho.aviso] : [];
	}
	if (r.op === "usar_plantilla") {
		const plantilla = plantillaPorId(r.plantilla);
		if (!plantilla) return [`no existe la plantilla «${r.plantilla}»`];
		// La MISMA entrada que la pestaña Plantillas: fuentes, muestras y un paso de deshacer.
		const usada = await usarPlantilla(editor, plantilla, { textos: r.textos, medios: r.medios, avisar: false });
		return usada.ok ? usada.descartes : [NO_SE_ARMO[usada.motivo]];
	}
	const objetivo = { trackId: r.el.trackId, elementId: r.el.elementId };
	const [par] = editor.timeline.getElementsWithTracks({ elements: [objetivo] });
	if (!par) return [];
	if (r.op === "revertir") {
		await revertirClip(editor, objetivo);
		return [];
	}
	if (r.op === "congelar") {
		const desde = Math.round(r.desde * TICKS_PER_SECOND);
		if (desde >= par.element.duration) return [];
		await congelarCuadro(editor, { ...objetivo, tiempo: roundMediaTime({ time: par.element.startTime + desde }) });
		return [];
	}
	if (par.element.type !== "video" && par.element.type !== "audio") return [];
	// «Normalizar la intensidad» con el objetivo pedido: mide y escribe en un paso (audio/normalizar.ts).
	const clip = { ...par.element, params: { ...par.element.params, [NORMALIZAR_OBJETIVO]: r.objetivo } } as ClipConAudio;
	await alternarNormalizacion({ editor, trackId: objetivo.trackId, element: clip, mediaAssets: editor.media.getAssets(), activar: true }).catch(() => null);
	return [];
}

const QUE_NO_SE_PUDO: Record<OperacionLarga["op"], string> = {
	revertir: "revertir",
	congelar: "congelar",
	normalizar: "normalizar",
	generar_subtitulos: "generar los subtítulos",
	usar_plantilla: "usar la plantilla",
	borrar_silencios: "borrar los silencios",
	usar_preset_subtitulos: "usar el preset",
	usar_plantilla_subtitulos: "usar la plantilla de subtítulos",
	estilo_subtitulos: "cambiar el estilo de los subtítulos",
	broll: "proponer el B-roll",
	cambiar_broll: "traer otra imagen o video del B-roll",
	clips_magicos: "buscar los clips",
	edicion_automatica: "hacer la edición automática",
	emojis_subtitulos: "poner los emojis",
};

/** Las fuentes de los textos de plantilla que se van a reescribir: se vuelven a partir midiendo con ELLAS. */
function fuentesDeHuecos(editor: EditorCore, p: PropuestaChat): string[] {
	const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
	if (!tracks) return [];
	const idPorRef = new Map([...p.refsPorId].map(([id, ref]) => [ref, id] as const));
	const textos = tracks.overlay.flatMap((t) => t.elements as TimelineElement[]).filter((e) => e.type === "text");
	return p.operaciones.flatMap((o) => {
		if (o.op !== "cambiar_texto") return [];
		const el = textos.find((e) => e.id === idPorRef.get(o.ref));
		const familia = el && leerAncla(el.params) ? String(el.params.fontFamily ?? "") : "";
		return familia ? [familia] : [];
	});
}

/** ACEPTAR. El orden es el contrato (ver la cabecera). */
export async function aceptarPropuesta(
	editor: EditorCore,
	p: PropuestaChat,
	op: { sinVersion?: boolean; alProgreso?: (p: ProgresoChat) => void } = {},
): Promise<ResultadoAceptar> {
	const enSuLugar = (): { error: string } | { escena: TScene } => {
		const proyecto = editor.project.getActiveOrNull();
		const escena = editor.scenes.getActiveSceneOrNull();
		if (!proyecto || proyecto.metadata.id !== p.proyectoId) return { error: "Es de otro proyecto" };
		if (!escena || escena.id !== p.escenaId) return { error: "Es de otra escena" };
		return { escena };
	};
	const alPedir = enSuLugar();
	if ("error" in alPedir) return { ok: false, error: alPedir.error };

	// 1. Lo pendiente, guardado.
	if (!op.sinVersion) {
		try {
			await editor.save.flush();
		} catch {
			return { ok: false, error: "No se guardó el proyecto", sinVersion: true };
		}
	}

	// 2. Lo del motor y las fuentes de los estilos, ANTES de mirar la línea de tiempo.
	const disponibles = await disponiblesChat(editor);
	const fuentes = [
		...p.operaciones.flatMap((o) =>
			o.op === "estilo_texto" && o.estilo.fuente ? [disponibles.fuentes.todas.get(o.estilo.fuente.toLowerCase()) ?? o.estilo.fuente] : [],
		),
		...fuentesDeHuecos(editor, p),
		// La fuente de una «Plantilla de texto», como su tarjeta antes de agregarla (text/components/biblioteca-estilos.tsx).
		...p.operaciones.flatMap((o) => {
			const familia = o.op === "agregar_texto" && o.plantilla ? PLANTILLAS_TEXTO.find((x) => x.id === o.plantilla)?.params.fontFamily : undefined;
			return typeof familia === "string" ? [familia] : [];
		}),
	];
	if (fuentes.length) await loadFonts({ families: [...new Set(fuentes)] }).catch(() => {});

	// La línea de tiempo de AHORA (pudo cambiar durante los `await`). De acá al lote, sin esperas.
	const lugar = enSuLugar();
	if ("error" in lugar) return { ok: false, error: lugar.error };
	const antes = lugar.escena.tracks;
	const datos = datosDeLinea(editor, antes);
	const vista = vistaDeLinea({
		tracks: antes,
		tps: TICKS_PER_SECOND,
		cabezal: 0,
		elegidos: p.elegidos,
		refsPrevias: p.refsPorId,
		disponibles,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
		medios: datos.medios,
		fondo: datos.fondo,
	});
	const { resueltas, descartes, encadenadas } = revisarOperaciones({ operaciones: p.operaciones, vista, alcance: p.alcance, transcripcion: datos.transcripcion });
	if (!resueltas.length) return { ok: false, error: noSeAplica(descartes[0], "Ya no hay nada que cambiar") };

	const actuales = () => editor.scenes.getActiveSceneOrNull()?.tracks;
	// El fondo del lienzo vive en los ajustes del proyecto, no en las pistas: cambiarlo también es un paso. Sólo el FONDO
	// (./fondo-proyecto.ts): los fps que sube un archivo nuevo no son del chat ni están en el historial.
	const ajustesDe = () => editor.project.getActiveOrNull()?.settings;
	const ajustesAntes = ajustesDe();
	let pasos = 0;

	// 3 y 4, en una vuelta: el lote y lo que tarda. Se repite con lo ENCADENADO (5).
	const aplicarVuelta = async (resueltas: OperacionResuelta[], idioma: string) => {
		// 3. Un paso de deshacer para lo que se arma en el momento.
		const lote = armarLote(resueltas, { idioma });
		const largas = resueltas.filter(esLarga);
		if (lote.comandos.length) {
			const comandos = lote.comandos;
			const previoLote = actuales();
			const ajustesPrevios = ajustesDe();
			editor.command.execute({ command: comandos.length === 1 ? comandos[0] : new BatchCommand(comandos) });
			if (actuales() !== previoLote || !mismoFondo(ajustesDe(), ajustesPrevios)) pasos++;
			for (const { que, comando } of lote.cortes) {
				const hecho = comando.resumen();
				if (!hecho) descartes.push(`no se cortó ${que}`);
				else if (hecho.sinClip) descartes.push(`${hecho.sinClip === 1 ? "un tramo" : `${hecho.sinClip} tramos`} de ${que} sin video debajo`);
			}
			// Un reemplazo que al ejecutarse no entró (el video no alcanzaba, el medio ya no estaba)
			// no cambia nada y no avisa: se mira si el clip quedó con el medio pedido (el último, si hubo varios).
			const reemplazos = new Map<string, Extract<OperacionResuelta, { op: "reemplazar_clip" }>>();
			for (const r of resueltas) if (r.op === "reemplazar_clip") reemplazos.set(r.el.elementId, r);
			const ahora = actuales();
			for (const r of reemplazos.values()) {
				const clip = ahora ? buscarClip(ahora, { trackId: r.el.trackId, elementId: r.el.elementId }) : null;
				if (clip?.element.mediaId !== r.mediaId) descartes.push(`no se pudo reemplazar ${r.el.titulo}`);
			}
		}

		// 4. Lo que tarda, después y aparte: cada uno con su paso.
		for (const r of largas) {
			const previo = actuales();
			if (r.op === "edicion_automatica") {
				// Los agentes (enjambre/correr.ts) dejan su propio registro a la vista y cuentan cuántos pasos del historial
				// dejaron: «Restaurar» los deshace todos. Se carga al usarse: la edición automática usa este mismo «Aceptar».
				try {
					const { correrEnjambre } = await import("@/app/video-editor/_opencut/enjambre/correr");
					const hecho = await correrEnjambre(editor, { desdeElChat: true });
					if (!hecho.ok) descartes.push(hecho.texto.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()));
					else {
						if (hecho.pasos) pasos += hecho.pasos;
						else descartes.push(hecho.detenido ? "se detuvo antes de cambiar algo" : "los agentes no encontraron nada que cambiar");
						// Lo que la persona hizo mientras trabajaban queda mezclado en esos pasos: «Restaurar» también lo desharía.
						if (hecho.pasos && hecho.tocado) descartes.push("tocaste el editor mientras trabajaban: «Restaurar» desharía también lo tuyo; mejor Ctrl+Z");
					}
				} catch (error) {
					console.error("[edición automática]", error);
					descartes.push("la edición automática se cortó por un error");
				}
				continue;
			}
			const avisos = await correrLarga(editor, r, op.alProgreso);
			descartes.push(...avisos);
			if (actuales() !== previo) pasos++;
			else if (!avisos.length) descartes.push(`no se pudo ${QUE_NO_SE_PUDO[r.op]}${"el" in r ? ` ${r.el.titulo}` : ""}`);
		}
	};
	await aplicarVuelta(resueltas, datos.transcripcion.idioma);

	// 5. Lo ENCADENADO (linea.ts → `Revision.encadenadas`): lo que dependía de lo que creó esta vuelta —el estilo y las
	// palabras clave de los subtítulos recién generados, los silencios de la toma recién puesta— se revisa contra la línea
	// de AHORA y se aplica, con sus pasos (así «Restaurar» lo deshace todo junto). Una receta replicada sale en UN pedido.
	let pendientes = encadenadas ?? [];
	for (let vuelta = 0; pendientes.length && vuelta < VUELTAS_ENCADENADAS; vuelta++) {
		const enLaLinea = enSuLugar();
		if ("error" in enLaLinea) {
			descartes.push("cambiaste de proyecto o de escena antes de terminar: lo que seguía no se aplicó");
			pendientes = [];
			break;
		}
		const datosAhora = datosDeLinea(editor, enLaLinea.escena.tracks);
		const otra = revisarOperaciones({
			operaciones: pendientes,
			vista: vistaDeLinea({
				tracks: enLaLinea.escena.tracks,
				tps: TICKS_PER_SECOND,
				cabezal: 0,
				elegidos: p.elegidos,
				refsPrevias: p.refsPorId,
				disponibles,
				lienzo: datosAhora.lienzo,
				mediosSinAudio: datosAhora.mediosSinAudio,
				conPalabras: datosAhora.conPalabras,
				medios: datosAhora.medios,
				fondo: datosAhora.fondo,
			}),
			alcance: p.alcance,
			transcripcion: datosAhora.transcripcion,
		});
		descartes.push(...otra.descartes);
		if (otra.resueltas.length) await aplicarVuelta(otra.resueltas, datosAhora.transcripcion.idioma);
		pendientes = otra.encadenadas ?? [];
	}
	if (pendientes.length) descartes.push("quedó algo para un pedido aparte: dependía de otro paso que no terminó");
	const despues = actuales();
	const ajustesDespues = ajustesDe();
	const cambiaronAjustes = !!ajustesAntes && !!ajustesDespues && !mismoFondo(ajustesAntes, ajustesDespues);
	// Si nada cambió (ni la línea de tiempo ni el fondo), no se aplicó: decir «Aplicado» sería mentir.
	if (!despues || (despues === antes && !cambiaronAjustes) || pasos === 0) return { ok: false, error: noSeAplica(descartes[0], "No se aplicó el cambio") };
	return {
		ok: true,
		aplicada: { escenaId: p.escenaId, antes, despues, pasos, ...(cambiaronAjustes ? { ajustes: { antes: ajustesAntes, despues: ajustesDespues } } : {}) },
		descartes,
	};
}

/**
 * «Restaurar» un cambio aplicado con el deshacer del editor, SÓLO si nadie tocó la línea de
 * tiempo después (es el mismo objeto que dejó el cambio). Si el deshacer no vuelve
 * exactamente a lo de antes, se rehace y devuelve false: ahí la vuelta es Ctrl+Z.
 */
export function deshacerPropuesta(editor: EditorCore, a: AplicadaChat): boolean {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena || escena.id !== a.escenaId || escena.tracks !== a.despues) return false;
	// Lo mismo con el fondo: si alguien lo cambió después, deshacer desharía lo suyo. Sólo el fondo: unos fps que subió
	// un archivo (fuera del historial) no apagan «Restaurar».
	const ajustes = () => editor.project.getActiveOrNull()?.settings;
	if (a.ajustes && !mismoFondo(ajustes(), a.ajustes.despues)) return false;
	for (let i = 0; i < a.pasos; i++) editor.command.undo();
	if (editor.scenes.getActiveSceneOrNull()?.tracks === a.antes && (!a.ajustes || mismoFondo(ajustes(), a.ajustes.antes))) return true;
	for (let i = 0; i < a.pasos; i++) editor.command.redo();
	return false;
}
