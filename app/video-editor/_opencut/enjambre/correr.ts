// =============================================================================
// enjambre/correr — la «Edición automática»: los agentes trabajan uno detrás de otro, a la vista
// =============================================================================
// Cada paso de ./plan.ts corre con la MISMA función que su botón o su operación del chat, así se porta igual:
//   · lo del chat (pausas, subtítulos, muletillas, palabras clave, voz limpia, volumen) va por `aceptarPropuesta`
//     (../chat/aplicar.ts): la misma revisión contra la línea de tiempo de AHORA, los mismos comandos del motor;
//   · el B-roll y los cambios de plano, por `proponerBroll` (../broll/proponer.ts): quedan PROPUESTOS, con su borde
//     punteado, para dejar o sacar cada uno como siempre.
// Antes de cada paso se vuelve a mirar la línea de tiempo (`decidirPaso`): lo que hizo el anterior cambia lo que ve
// éste. Lo que va pasando se anota en el registro (./estado.ts), que dibujan el panel y la barra de arriba.
//
// Deshacer: cada paso deja su paso en el historial (algunos, más). La corrida cuenta cuántos dejó
// (`editor.command.profundidad()`) y «Deshacer todo» deshace ésos, SÓLO si nadie tocó la línea de tiempo después
// (como «Restaurar» del chat, ../chat/aplicar.ts → deshacerPropuesta). Si no, la vuelta es Ctrl+Z.
//
// La cadencia (AGENTS.md, «con un pequeño delay»): entre paso y paso, una pausa corta para que se vea el cambio en la
// línea de tiempo; ninguna con «reducir movimiento» del sistema. El trabajo de cada paso no se frena.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { cancelarGeneracion } from "@/app/video-editor/_opencut/subtitles/generar";
import { usePreferenciasSubtitulos, useTrabajoSubtitulos, type FaseGenerar } from "@/app/video-editor/_opencut/subtitles/estado";
import { aplicarEstiloASubtitulos, lienzoDe, subtitulosDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { paramsDePlantilla, PLANTILLA_POR_DEFECTO, plantillaPorId } from "@/app/video-editor/_opencut/subtitles/estilos";
import { proponerBroll } from "@/app/video-editor/_opencut/broll/proponer";
import { textoDeBroll } from "@/app/video-editor/_opencut/broll/resultado";
import { usePreferenciasBroll } from "@/app/video-editor/_opencut/broll/estado";
import { pendientesDe, PARAM_BUSQUEDA } from "@/app/video-editor/_opencut/broll/pistas";
import { aceptarPropuesta, type PropuestaChat } from "@/app/video-editor/_opencut/chat/aplicar";
import type { ProgresoChat } from "@/app/video-editor/_opencut/chat/armado";
import { datosDeLinea } from "@/app/video-editor/_opencut/chat/contexto";
import { DISPONIBLES_VACIOS, vistaDeLinea, type VistaLinea } from "@/app/video-editor/_opencut/chat/linea";
import {
	agentePorId,
	CANDIDATOS_ESTILO,
	cita,
	elegirEstilo,
	evaluarPrueba,
	conTope,
	cuantos,
	decidirPaso,
	estadoDeLinea,
	PASOS,
	revisionFinal,
	segundosTexto,
	type AgenteId,
	type EstadoLinea,
	type Paso,
	type PasoId,
	type PruebaEstilo,
} from "./plan";
import { anotar, empezarCorrida, fijarAgente, SECCION_ENJAMBRE, useEnjambre } from "./estado";

export type ResultadoEnjambre =
	| { ok: true; pasos: number; hechos: number; saltados: number; fallas: number; resumen: string }
	| { ok: false; motivo: "ocupado" | "sin-proyecto" | "vacio"; texto: string };

const NO_ARRANCA: Record<Extract<ResultadoEnjambre, { ok: false }>["motivo"], string> = {
	ocupado: "Ya hay una edición automática en curso.",
	"sin-proyecto": "No hay un proyecto abierto.",
	vacio: "La línea de tiempo está vacía: agrega tu video primero.",
};

/** La pausa entre un paso y el siguiente, para que el cambio se vea en la línea de tiempo. */
const PAUSA_ENTRE_PASOS_MS = 450;
/** Cuánto se ve cada estilo que prueba subs-03 antes de volver atrás (el «A/B testing caption fonts…» del reel). */
const PAUSA_PRUEBA_MS = 700;

const sinMovimiento = (): boolean => {
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
};
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** La línea de tiempo de ahora, como la ve el chat (las mismas refs con las que se arma cada propuesta). */
function leer(editor: EditorCore, estiloLibre = false): { vista: VistaLinea; estado: EstadoLinea } | null {
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!escena) return null;
	const datos = datosDeLinea(editor, escena.tracks);
	const vista = vistaDeLinea({
		tracks: escena.tracks,
		tps: TICKS_PER_SECOND,
		cabezal: 0,
		elegidos: [],
		disponibles: DISPONIBLES_VACIOS,
		lienzo: datos.lienzo,
		mediosSinAudio: datos.mediosSinAudio,
		conPalabras: datos.conPalabras,
		medios: datos.medios,
	});
	return { vista, estado: estadoDeLinea(vista.refs.values(), { conPalabras: datos.conPalabras, estiloLibre }) };
}

/** Lo que dice cada fase de «Subtítulos automáticos» mientras subs-01 transcribe. */
const MIRA_SUBTITULOS: Partial<Record<FaseGenerar, string>> = {
	audio: "junta el audio del video",
	modelo: "carga el modelo de voz",
	transcribiendo: "transcribe en tu navegador",
	armando: "arma los subtítulos",
};

/** Un error de «Aceptar» que dice que no había nada que hacer (no es una falla del agente). */
const NADA_QUE_HACER = /^No se aplica: |^No encontré|^Ya no hay nada|no se cortó/i;

type Contexto = { editor: EditorCore; paso: Paso; agente: AgenteId; quietos: boolean };

/** Corre operaciones del chat con su «Aceptar». Devuelve si cambió algo, o el porqué. */
async function conElChat(
	{ editor, agente }: Contexto,
	vista: VistaLinea,
	operaciones: PropuestaChat["operaciones"],
	alProgreso?: (p: ProgresoChat) => void,
): Promise<{ ok: true; avisos: string[] } | { ok: false; nada: boolean; texto: string }> {
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!proyecto || !escena) return { ok: false, nada: false, texto: "se cerró el proyecto" };
	const propuesta: PropuestaChat = {
		proyectoId: proyecto.metadata.id,
		escenaId: escena.id,
		refsPorId: new Map([
			...[...vista.refs.values()].map((x) => [x.elementId, x.ref] as const),
			...[...vista.medios.values()].map((m) => [m.mediaId, m.ref] as const),
		]),
		elegidos: [],
		alcance: "video",
		operaciones,
	};
	let r = await aceptarPropuesta(editor, propuesta, { alProgreso });
	// Sin poder guardar antes, el chat ofrece «Aplicar igual»: acá ya se pidió editar todo, así que se aplica y se dice.
	if (!r.ok && r.sinVersion) {
		anotar(agente, "mira", "no se pudo guardar antes de este paso: sigue igual");
		r = await aceptarPropuesta(editor, propuesta, { alProgreso, sinVersion: true });
	}
	if (!r.ok) {
		const nada = NADA_QUE_HACER.test(r.error);
		return { ok: false, nada, texto: r.error.replace(/^No se aplica: /, "") };
	}
	return { ok: true, avisos: r.descartes };
}

/** El primer carácter en minúscula: los motivos del editor van en una oración y acá van en un renglón. */
const renglon = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * Un paso. Devuelve cómo terminó. Cada renglón que anota es algo que pasó: lo que leyó, lo que cambió o por qué no
 * hizo nada.
 */
async function correrPaso(ctx: Contexto, antes: { vista: VistaLinea; estado: EstadoLinea }): Promise<"hecho" | "salteado" | "fallo"> {
	const { editor, paso, agente } = ctx;
	const decision = decidirPaso(paso.id, antes.estado);
	if (!decision.hace) {
		anotar(agente, "salta", decision.porque);
		return "salteado";
	}
	const despues = () => leer(editor)?.estado ?? antes.estado;
	const salio = (r: Awaited<ReturnType<typeof conElChat>>): "hecho" | "salteado" | "fallo" | null => {
		if (r.ok) {
			for (const a of r.avisos) anotar(agente, "mira", renglon(a));
			return null;
		}
		anotar(agente, r.nada ? "salta" : "falla", renglon(r.texto));
		return r.nada ? "salteado" : "fallo";
	};

	switch (paso.id) {
		case "pausas": {
			if (!("operaciones" in decision)) return "salteado";
			let marcadas = 0;
			const r = await conElChat(ctx, antes.vista, decision.operaciones, (p) => {
				if (p.tipo === "escuchando") anotar(agente, "mira", `escucha ${cita(p.titulo, 32)}`);
				else if (p.tipo === "silencio") {
					marcadas++;
					anotar(agente, "hace", `marca una pausa de ${segundosTexto(p.hasta - p.desde)}`, p.desde);
				} else if (p.tipo === "cortando") anotar(agente, "mira", `corta ${cuantos(marcadas, "pausa", "pausas")}`);
				else if (p.tipo === "listo") anotar(agente, "listo", `quitó ${segundosTexto(p.segundos)} de pausas`);
			});
			return salio(r) ?? "hecho";
		}
		case "subtitulos": {
			if (!("operaciones" in decision)) return "salteado";
			let fase = useTrabajoSubtitulos.getState().fase;
			const soltar = useTrabajoSubtitulos.subscribe((s) => {
				if (s.fase === fase) return;
				fase = s.fase;
				const texto = MIRA_SUBTITULOS[s.fase];
				if (texto) anotar(agente, "mira", texto);
			});
			try {
				const r = await conElChat(ctx, antes.vista, decision.operaciones);
				const fin = salio(r);
				if (fin) return fin;
			} finally {
				soltar();
			}
			const subs = despues().subtitulos;
			const { primeros, resto } = conTope(subs);
			for (const s of primeros) anotar(agente, "hace", `subtítulo ${cita(s.texto)}`, s.inicio);
			if (resto) anotar(agente, "hace", `y ${cuantos(resto, "subtítulo", "subtítulos")} más`);
			anotar(agente, "listo", `puso ${cuantos(subs.length, "subtítulo", "subtítulos")}`);
			return "hecho";
		}
		case "estilo": {
			// Cada estilo se aplica DE VERDAD a todos los subtítulos, se mide cuántos renglones quedó cada uno, se ve un
			// momento y se vuelve atrás (no queda en el historial). Al final se aplica el que entra.
			const lienzo = lienzoDe(editor);
			const pruebas: PruebaEstilo[] = [];
			for (const id of CANDIDATOS_ESTILO) {
				if (useEnjambre.getState().detener) break;
				const plantilla = plantillaPorId(id);
				anotar(agente, "mira", `prueba ${cita(plantilla.nombre)}`);
				const profundidad = editor.command.profundidad();
				await aplicarEstiloASubtitulos({ editor, estilo: paramsDePlantilla(plantilla, lienzo) });
				const prueba = editor.scenes.getActiveSceneOrNull()?.tracks;
				const renglones = subtitulosDe(prueba).map(({ element }) => String(element.params.content ?? "").split("\n").length);
				const r = evaluarPrueba(renglones);
				pruebas.push({ id, nombre: plantilla.nombre, renglones });
				const primero = subtitulosDe(prueba)[0]?.element;
				anotar(agente, "hace", `${plantilla.nombre}: ${r.porque} ${r.ok ? "✓" : "✗"}`, primero ? primero.startTime / TICKS_PER_SECOND : null);
				if (!ctx.quietos) await esperar(PAUSA_PRUEBA_MS);
				if (editor.command.profundidad() === profundidad + 1 && editor.scenes.getActiveSceneOrNull()?.tracks === prueba) editor.command.undo();
			}
			const { elegido } = elegirEstilo(pruebas);
			if (!elegido) {
				anotar(agente, "salta", "ningún estilo entra en dos renglones: los subtítulos quedan como estaban");
				return "salteado";
			}
			const plantilla = plantillaPorId(elegido);
			await aplicarEstiloASubtitulos({ editor, estilo: paramsDePlantilla(plantilla, lienzo) });
			// Como elegirla en Subtítulos › Plantillas: queda para los próximos subtítulos.
			usePreferenciasSubtitulos.getState().fijar({ plantilla: elegido });
			anotar(agente, "listo", `se queda con ${cita(plantilla.nombre)}`);
			return "hecho";
		}
		case "muletillas": {
			if (!("operaciones" in decision)) return "salteado";
			const r = await conElChat(ctx, antes.vista, decision.operaciones);
			if (!r.ok && r.nada) {
				anotar(agente, "salta", "no encontró muletillas");
				return "salteado";
			}
			const fin = salio(r);
			if (fin) return fin;
			const quitado = antes.estado.duracion - despues().duracion;
			anotar(agente, "listo", quitado > 0.05 ? `sacó las muletillas: ${segundosTexto(quitado)} menos` : "sacó las muletillas");
			return "hecho";
		}
		case "claves": {
			if (!("operaciones" in decision)) return "salteado";
			const fin = salio(await conElChat(ctx, antes.vista, decision.operaciones));
			if (fin) return fin;
			const conClaves = despues().subtitulos.filter((s) => s.claves.length);
			const { primeros, resto } = conTope(conClaves);
			for (const s of primeros) anotar(agente, "hace", `resalta ${cita(s.claves.join(", "), 32)}`, s.inicio);
			if (resto) anotar(agente, "hace", `y ${cuantos(resto, "subtítulo", "subtítulos")} más`);
			anotar(agente, "listo", conClaves.length ? `resaltó palabras en ${cuantos(conClaves.length, "subtítulo", "subtítulos")}, en lima` : "no había palabras que pesaran");
			return "hecho";
		}
		case "broll":
		case "planos": {
			const esBroll = paso.id === "broll";
			anotar(agente, "mira", esBroll ? "lee lo que se dice y busca qué mostrar" : "lee las frases para elegir dónde acercar");
			const r = await proponerBroll(editor, esBroll ? { broll: true, planos: false, ritmo: usePreferenciasBroll.getState().ritmo } : { broll: false, planos: true });
			if (!r.ok) {
				const nada = r.motivo === "sin-huecos" || r.motivo === "sin-voz";
				anotar(agente, nada ? "salta" : "falla", renglon(textoDeBroll(r)));
				return nada ? "salteado" : "fallo";
			}
			if (esBroll && r.faltaPexels) {
				anotar(agente, "salta", "sin Pexels conectado: conéctalo en «B-roll de MaKo» para las fotos");
				return "salteado";
			}
			const tracks = editor.scenes.getActiveSceneOrNull()?.tracks;
			const propias = pendientesDe(tracks).filter((p) => p.tipo === (esBroll ? "broll" : "plano"));
			const { primeros, resto } = conTope(propias);
			for (const p of primeros) {
				const en = p.element.startTime / TICKS_PER_SECOND;
				if (esBroll) anotar(agente, "hace", `propone una foto: ${cita(String(p.element.params[PARAM_BUSQUEDA] ?? "imagen"), 32)}`, en);
				else anotar(agente, "hace", `acerca: ${renglon(p.element.name || "cambio de plano")}`, en);
			}
			if (resto) anotar(agente, "hace", `y ${resto} más`);
			if (r.aviso) anotar(agente, "mira", renglon(r.aviso));
			anotar(
				agente,
				"listo",
				esBroll
					? `${cuantos(r.broll, "foto propuesta", "fotos propuestas")}: deja o saca cada una`
					: `${cuantos(r.planos, "cambio de plano propuesto", "cambios de plano propuestos")}`,
			);
			return "hecho";
		}
		case "ruido":
		case "volumen": {
			if (!("operaciones" in decision)) return "salteado";
			const clips = new Map(antes.estado.conVoz.map((c) => [c.ref, c] as const));
			for (const op of decision.operaciones) {
				const ref = "ref" in op ? op.ref : undefined;
				const c = ref ? clips.get(ref) : undefined;
				if (c) anotar(agente, "mira", `${paso.id === "ruido" ? "escucha" : "mide"} ${cita(c.titulo, 32)}`, c.inicio);
			}
			const fin = salio(await conElChat(ctx, antes.vista, decision.operaciones));
			if (fin) return fin;
			const n = decision.operaciones.length;
			anotar(
				agente,
				"listo",
				paso.id === "ruido" ? `redujo el ruido de ${cuantos(n, "clip", "clips")}` : `llevó ${cuantos(n, "clip", "clips")} a −14 LUFS`,
			);
			return "hecho";
		}
		case "revision": {
			const chequeos = revisionFinal(antes.estado);
			for (const c of chequeos) anotar(agente, c.ok ? "qa-ok" : "qa-mal", `${c.ok ? "QA ✓" : "QA ✗"} ${c.texto}`, c.en);
			const mal = chequeos.filter((c) => !c.ok).length;
			anotar(agente, "listo", mal ? `${cuantos(mal, "cosa", "cosas")} para mirar` : "todo en orden: reproduce el corte final");
			// Lo que encontró la revisión se lee en sus renglones (QA ✗): no es una falla de la edición.
			return "hecho";
		}
	}
}

/**
 * La «Edición automática» entera. Abre su panel (Biblioteca › Multimedia › «Edición automática») para que se vea el
 * registro, corre los pasos en orden y, al final, deja listo «Deshacer todo».
 */
export async function correrEnjambre(editor: EditorCore, opciones: { pasos?: readonly PasoId[] } = {}): Promise<ResultadoEnjambre> {
	if (useEnjambre.getState().fase === "corriendo") return { ok: false, motivo: "ocupado", texto: NO_ARRANCA.ocupado };
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!editor.project.getActiveOrNull() || !escena) return { ok: false, motivo: "sin-proyecto", texto: NO_ARRANCA["sin-proyecto"] };
	if (editor.timeline.getTotalDuration() <= 0) return { ok: false, motivo: "vacio", texto: NO_ARRANCA.vacio };

	empezarCorrida();
	useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_ENJAMBRE });
	const escenaId = escena.id;
	const tracksIniciales = escena.tracks;
	const profundidadInicial = editor.command.profundidad();
	const pasos = opciones.pasos ? PASOS.filter((p) => opciones.pasos?.includes(p.id)) : PASOS;
	const quietos = sinMovimiento();
	let hechos = 0;
	let saltados = 0;
	let fallas = 0;
	// El estilo es del agente sólo si los subtítulos los puso esta corrida con la plantilla por defecto (./plan.ts).
	let subtitulosNuevos = false;

	try {
		for (const paso of pasos) {
			if (useEnjambre.getState().detener) break;
			const estiloLibre = subtitulosNuevos && usePreferenciasSubtitulos.getState().plantilla === PLANTILLA_POR_DEFECTO.id;
			const antes = leer(editor, estiloLibre);
			if (!antes || editor.scenes.getActiveSceneOrNull()?.id !== escenaId) {
				anotar(paso.agente, "falla", "se cerró el proyecto o cambió la escena: aquí paran los agentes");
				fallas++;
				break;
			}
			useEnjambre.setState({ paso: paso.id });
			fijarAgente(paso.agente, "trabajando");
			anotar(paso.agente, "empieza", renglon(paso.titulo));
			let como: "hecho" | "salteado" | "fallo";
			try {
				como = await correrPaso({ editor, paso, agente: paso.agente, quietos }, antes);
			} catch (error) {
				console.error(`[enjambre] ${paso.id}`, error);
				anotar(paso.agente, "falla", "algo se rompió en este paso");
				como = "fallo";
			}
			fijarAgente(paso.agente, como === "hecho" ? "listo" : como === "salteado" ? "salteado" : "fallo");
			if (paso.id === "subtitulos" && como === "hecho") subtitulosNuevos = true;
			if (como === "hecho") hechos++;
			else if (como === "salteado") saltados++;
			else fallas++;
			if (!quietos) await esperar(PAUSA_ENTRE_PASOS_MS);
		}
	} finally {
		const detenido = useEnjambre.getState().detener;
		const pasosHistorial = editor.command.profundidad() - profundidadInicial;
		const ahora = editor.scenes.getActiveSceneOrNull();
		const resumen = [
			detenido ? "Detenido." : "Listo.",
			hechos ? `${cuantos(hechos, "agente trabajó", "agentes trabajaron")}` : "Ningún agente cambió nada",
			saltados ? `${cuantos(saltados, "no tenía", "no tenían")} nada que hacer` : null,
			fallas ? `${cuantos(fallas, "avisa", "avisan")} algo` : null,
		]
			.filter(Boolean)
			.join(" · ");
		useEnjambre.setState({
			fase: "terminado",
			paso: null,
			resumen,
			error: fallas > 0,
			deshacer: pasosHistorial > 0 && ahora && ahora.id === escenaId ? { escenaId, antes: tracksIniciales, despues: ahora.tracks, pasos: pasosHistorial } : null,
		});
	}
	const s = useEnjambre.getState();
	return { ok: true, pasos: s.deshacer?.pasos ?? 0, hechos, saltados, fallas, resumen: s.resumen ?? "" };
}

/** «Detener»: corta la transcripción si es lo que corre; lo demás termina su paso. */
export function detenerEnjambre(): void {
	const s = useEnjambre.getState();
	if (s.fase !== "corriendo") return;
	useEnjambre.setState({ detener: true });
	if (s.paso === "subtitulos") cancelarGeneracion();
}

/**
 * «Deshacer todo»: los pasos que dejó la corrida, SÓLO si la línea de tiempo sigue como la dejó (el mismo objeto). Si
 * el deshacer no vuelve exactamente a la de antes de la corrida, se rehace y devuelve false: ahí la vuelta es Ctrl+Z.
 */
export function deshacerEnjambre(editor: EditorCore): boolean {
	const d = useEnjambre.getState().deshacer;
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!d || !escena || escena.id !== d.escenaId || escena.tracks !== d.despues) return false;
	if (editor.command.profundidad() < d.pasos) return false;
	for (let i = 0; i < d.pasos; i++) editor.command.undo();
	if (editor.scenes.getActiveSceneOrNull()?.tracks !== d.antes) {
		for (let i = 0; i < d.pasos; i++) editor.command.redo();
		return false;
	}
	useEnjambre.setState({ deshacer: null, resumen: "Se deshizo la edición automática." });
	return true;
}

/** «Reproducir el corte final» (el «playing final cut» del reel): desde el principio. */
export function reproducirCorteFinal(editor: EditorCore): void {
	editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: 0 }) });
	editor.playback.play();
}

/** Para el panel: el agente de un paso y su rol. */
export const rotuloDePaso = (id: PasoId) => {
	const p = PASOS.find((x) => x.id === id);
	return p ? `${agentePorId(p.agente).id} · ${p.titulo}` : id;
};
