// =============================================================================
// enjambre/correr — la «Edición automática»: los agentes trabajan uno detrás de otro, a la vista
// =============================================================================
// Cada paso de ./plan.ts corre con la MISMA función que su botón o su operación del chat, así se porta igual:
//   · lo del chat (pausas, subtítulos, muletillas, palabras clave, voz limpia) va por `aceptarPropuesta`
//     (../chat/aplicar.ts): la misma revisión contra la línea de tiempo de AHORA, los mismos comandos del motor;
//   · el volumen, por `normalizarJuntos` (../audio/normalizar.ts): los pedazos del MISMO video se miden juntos (un
//     paso de deshacer por video), así no salta el volumen en cada corte (revisión del 9/11/2026);
//   · el B-roll y los cambios de plano, por `proponerBroll` (../broll/proponer.ts): quedan PROPUESTOS, con su borde
//     punteado, para dejar o sacar cada uno como siempre;
//   · el estilo de los subtítulos, con `aplicarEstiloASubtitulos` (el de Subtítulos › Plantillas).
// Antes de cada paso se vuelve a mirar la línea de tiempo (`decidirPaso`): lo que hizo el anterior cambia lo que ve
// éste. Lo que va pasando se anota en el registro (./estado.ts), que dibujan el panel, la barra de arriba y los cursores.
//
// Deshacer: cada paso deja su paso en el historial (algunos, más). La corrida cuenta cuántos dejó
// (`editor.command.profundidad()`) y «Deshacer todo» deshace ésos, SÓLO si nadie tocó la línea de tiempo después
// (como «Restaurar» del chat, ../chat/aplicar.ts → deshacerPropuesta). Si la persona tocó el editor MIENTRAS
// trabajaban, sus cambios están mezclados en esa cuenta: ahí no hay «Deshacer todo» (la vuelta es Ctrl+Z, de a uno), y
// se dice. Si la corrió el chat, la vuelta es «Restaurar» de su mensaje: no hay dos deshacer para lo mismo.
//
// La cadencia (AGENTS.md, «con un pequeño delay»): entre paso y paso, una pausa corta para que se vea el cambio en la
// línea de tiempo; ninguna con «reducir movimiento» del sistema. El trabajo de cada paso no se frena.
// =============================================================================

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { cancelarGeneracion } from "@/app/video-editor/_opencut/subtitles/generar";
import { MOTIVO_SUBTITULOS } from "@/app/video-editor/_opencut/subtitles/resultado";
import { usePreferenciasSubtitulos, useTrabajoSubtitulos, type FaseGenerar } from "@/app/video-editor/_opencut/subtitles/estado";
import { aplicarEstiloASubtitulos, lienzoDe, subtitulosDe } from "@/app/video-editor/_opencut/subtitles/insert";
import { paramsDePlantilla, PLANTILLA_POR_DEFECTO, plantillaPorId } from "@/app/video-editor/_opencut/subtitles/estilos";
import { proponerBroll } from "@/app/video-editor/_opencut/broll/proponer";
import { normalizarJuntos } from "@/app/video-editor/_opencut/audio/normalizar";
import type { ClipConAudio } from "@/app/video-editor/_opencut/audio/decodificar";
import { OBJETIVOS_NORMALIZAR } from "@/lib/editor-video/chat-catalogo";
import type { Frase } from "@/lib/editor-video/broll";
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
	comoTerminaFalla,
	cuentaComoToque,
	conTope,
	cuantos,
	decidirPaso,
	elegirEstilo,
	esNadaQueHacer,
	estadoDeLinea,
	evaluarPrueba,
	gruposPorFuente,
	OBJETIVO_VOLUMEN,
	PASOS,
	revisionFinal,
	segundosTexto,
	type AgenteId,
	type ComoTermina,
	type EstadoLinea,
	type Paso,
	type PasoId,
	type PruebaEstilo,
} from "./plan";
import { anotar, empezarCorrida, fijarAgente, SECCION_ENJAMBRE, useEnjambre } from "./estado";

export type ResultadoEnjambre =
	| { ok: true; pasos: number; hechos: number; saltados: number; fallas: number; detenido: boolean; tocado: boolean; resumen: string }
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
		fondo: datos.fondo,
	});
	const propuestas = pendientesDe(escena.tracks).map((p) => p.element.startTime / TICKS_PER_SECOND);
	return { vista, estado: estadoDeLinea(vista.refs.values(), { conPalabras: datos.conPalabras, estiloLibre, propuestas }) };
}

/** Lo que dice cada fase de «Subtítulos automáticos» mientras subs-01 transcribe. */
const MIRA_SUBTITULOS: Partial<Record<FaseGenerar, string>> = {
	audio: "junta el audio del video",
	modelo: "carga el modelo de voz",
	transcribiendo: "transcribe en tu navegador",
	armando: "arma los subtítulos",
};

type Contexto = {
	editor: EditorCore;
	paso: Paso;
	agente: AgenteId;
	quietos: boolean;
	proyectoId: string;
	escenaId: string;
	/**
	 * Lo que se dice en el video, leído UNA vez para el B-roll y los planos (dos agentes). Null mientras nadie lo pidió.
	 * Sin esto, sin subtítulos, cada uno transcribía el video entero con Whisper (revisión del 9/11/2026).
	 */
	frases: { lista: Frase[] | null; fallo: boolean };
	/**
	 * Los subtítulos de esta corrida se intentaron y no salieron (fallaron, o no se reconoció la voz): transcribir otra
	 * vez para el B-roll va a dar lo mismo.
	 */
	subtitulosNoSalieron: boolean;
};

/** ¿Sigue abierto el proyecto y la escena de la corrida? Entre dos esperas la persona pudo abrir otro. */
const enSuLugar = ({ editor, proyectoId, escenaId }: Contexto) =>
	editor.project.getActiveOrNull()?.metadata.id === proyectoId && editor.scenes.getActiveSceneOrNull()?.id === escenaId;

/** Corre operaciones del chat con su «Aceptar». Devuelve si cambió algo, o el porqué. */
async function conElChat(
	ctx: Contexto,
	vista: VistaLinea,
	operaciones: PropuestaChat["operaciones"],
	alProgreso?: (p: ProgresoChat) => void,
): Promise<{ ok: true; avisos: string[] } | { ok: false; nada: boolean; texto: string }> {
	if (!enSuLugar(ctx)) return { ok: false, nada: false, texto: "se cerró el proyecto o cambió la escena" };
	const propuesta: PropuestaChat = {
		proyectoId: ctx.proyectoId,
		escenaId: ctx.escenaId,
		refsPorId: new Map([
			...[...vista.refs.values()].map((x) => [x.elementId, x.ref] as const),
			...[...vista.medios.values()].map((m) => [m.mediaId, m.ref] as const),
		]),
		elegidos: [],
		alcance: "video",
		operaciones,
	};
	let r = await aceptarPropuesta(ctx.editor, propuesta, { alProgreso });
	// Sin poder guardar antes, el chat ofrece «Aplicar igual»: acá ya se pidió editar todo, así que se aplica y se dice.
	if (!r.ok && r.sinVersion) {
		anotar(ctx.agente, "mira", "no se pudo guardar antes de este paso: sigue igual");
		r = await aceptarPropuesta(ctx.editor, propuesta, { alProgreso, sinVersion: true });
	}
	if (!r.ok) return { ok: false, nada: esNadaQueHacer(r.error), texto: r.error.replace(/^No se aplica: /, "") };
	return { ok: true, avisos: r.descartes };
}

/** El primer carácter en minúscula: los motivos del editor van en una oración y acá van en un renglón. */
const renglon = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * Un paso. Devuelve cómo terminó. Cada renglón que anota es algo que pasó: lo que leyó, lo que cambió o por qué no
 * hizo nada.
 */
async function correrPaso(ctx: Contexto, antes: { vista: VistaLinea; estado: EstadoLinea }): Promise<ComoTermina> {
	const { editor, paso, agente } = ctx;
	const decision = decidirPaso(paso.id, antes.estado);
	if (!decision.hace) {
		anotar(agente, "salta", decision.porque);
		return "salteado";
	}
	const despues = () => leer(editor)?.estado ?? antes.estado;
	const salio = (r: Awaited<ReturnType<typeof conElChat>>): ComoTermina | null => {
		if (r.ok) {
			for (const a of r.avisos) anotar(agente, "mira", renglon(a));
			return null;
		}
		const como = comoTerminaFalla({ nada: r.nada, detener: useEnjambre.getState().detener, cancelado: r.texto === MOTIVO_SUBTITULOS.cancelado });
		if (como === "detenido") anotar(agente, "salta", "se detuvo antes de terminar");
		else anotar(agente, como === "salteado" ? "salta" : "falla", renglon(r.texto));
		return como;
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
				const fin = salio(await conElChat(ctx, antes.vista, decision.operaciones));
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
			let probadasTodas = true;
			for (const id of CANDIDATOS_ESTILO) {
				if (useEnjambre.getState().detener) {
					probadasTodas = false;
					break;
				}
				if (!enSuLugar(ctx)) {
					anotar(agente, "falla", "se cerró el proyecto o cambió la escena: no sigue probando");
					return "fallo";
				}
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
				if (editor.command.profundidad() === profundidad + 1 && editor.scenes.getActiveSceneOrNull()?.tracks === prueba) {
					editor.command.undo();
					// La prueba no queda tampoco para «Rehacer»: Ctrl+Y no tiene que volver a poner un estilo descartado.
					editor.command.olvidarRehacer();
				}
			}
			const { elegido } = elegirEstilo(pruebas);
			if (!elegido) {
				anotar(
					agente,
					"salta",
					probadasTodas ? "ningún estilo entra en dos renglones: los subtítulos quedan como estaban" : "se detuvo antes de probar todos: los subtítulos quedan como estaban",
				);
				return "salteado";
			}
			if (!enSuLugar(ctx)) {
				anotar(agente, "falla", "se cerró el proyecto o cambió la escena: no aplica el estilo");
				return "fallo";
			}
			const plantilla = plantillaPorId(elegido);
			await aplicarEstiloASubtitulos({ editor, estilo: paramsDePlantilla(plantilla, lienzo) });
			// No se guarda como la plantilla de la persona: es de este proyecto, no de todos los que abra después.
			anotar(agente, "listo", `se queda con ${cita(plantilla.nombre)}: la primera, en el orden del reel, que entra en dos renglones`);
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
			// Si los subtítulos de esta misma corrida no salieron, transcribir otra vez para elegir dónde va a dar lo mismo.
			if (ctx.subtitulosNoSalieron && !antes.estado.subtitulos.length) {
				anotar(agente, "salta", "los subtítulos no salieron: sin saber qué se dice no elige dónde");
				return "salteado";
			}
			// El agente de antes ya intentó leer lo que se dice y no pudo: no se vuelve a transcribir para fallar igual.
			if (ctx.frases.fallo) {
				anotar(agente, "salta", "no se pudo leer lo que se dice en el video");
				return "salteado";
			}
			anotar(agente, "mira", esBroll ? "lee lo que se dice y busca qué mostrar" : "lee las frases para elegir dónde acercar");
			// Lo que se dice se lee UNA vez para los dos agentes, ADENTRO de proponerBroll (su candado: el botón de B-roll y
			// «Subtítulos automáticos» no usan Whisper a la vez, y se ve «escuchando»): el primero lo lee y el segundo lo reusa.
			const r = await proponerBroll(editor, {
				broll: esBroll,
				planos: !esBroll,
				...(esBroll ? { ritmo: usePreferenciasBroll.getState().ritmo } : {}),
				...(ctx.frases.lista ? { frases: ctx.frases.lista } : {}),
				alLeerFrases: (f) => {
					ctx.frases.lista = f;
				},
			});
			// Se cayó leyendo (no llegó a leer): el próximo agente no lo vuelve a intentar.
			if (!r.ok && r.motivo === "red" && !ctx.frases.lista) ctx.frases.fallo = true;
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
		case "volumen": {
			if (!("operaciones" in decision)) return "salteado";
			const pedidos = new Set(decision.operaciones.flatMap((op) => ("ref" in op && op.ref ? [op.ref] : [])));
			if (!enSuLugar(ctx)) {
				anotar(agente, "falla", "se cerró el proyecto o cambió la escena");
				return "fallo";
			}
			// Los pedazos del MISMO video se miden juntos y quedan con la misma ganancia (plan.ts → gruposPorFuente).
			const clips = antes.estado.conVoz
				.filter((c) => pedidos.has(c.ref))
				.flatMap((c) => {
					const ref = antes.vista.refs.get(c.ref);
					const [par] = ref ? editor.timeline.getElementsWithTracks({ elements: [{ trackId: ref.trackId, elementId: ref.elementId }] }) : [];
					if (!par || (par.element.type !== "video" && par.element.type !== "audio")) return [];
					const el = par.element as ClipConAudio;
					const fuente = "mediaId" in el && typeof el.mediaId === "string" ? el.mediaId : null;
					return [{ ...c, trackId: par.track.id, element: el, fuente }];
				});
			const grupos = gruposPorFuente(clips);
			const objetivo = OBJETIVOS_NORMALIZAR[OBJETIVO_VOLUMEN];
			let quedaron = 0;
			for (const g of grupos) {
				if (useEnjambre.getState().detener) {
					anotar(agente, "salta", "se detuvo antes de terminar");
					return quedaron ? "hecho" : "detenido";
				}
				anotar(
					agente,
					"mira",
					g.length > 1 ? `mide ${cita(g[0].titulo, 32)} entero (${cuantos(g.length, "pedazo", "pedazos")})` : `mide ${cita(g[0].titulo, 32)}`,
					g[0].inicio,
				);
				quedaron += await normalizarJuntos({
					editor,
					clips: g.map(({ trackId, element }) => ({ trackId, element })),
					mediaAssets: editor.media.getAssets(),
					objetivo,
				}).catch((error) => {
					console.error("[enjambre] volumen", error);
					return 0;
				});
			}
			anotar(
				agente,
				quedaron ? "listo" : "falla",
				`llevó ${cuantos(quedaron, "clip", "clips")} de ${clips.length} a −14 LUFS${grupos.length < clips.length ? ", cada video con una sola ganancia" : ""}`,
			);
			return quedaron ? "hecho" : "fallo";
		}
		case "ruido": {
			if (!("operaciones" in decision)) return "salteado";
			const clips = new Map(antes.estado.conVoz.map((c) => [c.ref, c] as const));
			const pedidos = decision.operaciones.flatMap((op) => {
				const c = "ref" in op && op.ref ? clips.get(op.ref) : undefined;
				return c ? [c] : [];
			});
			// «Reducir el ruido» prende un ajuste del clip (el volumen va aparte, arriba: se mide por video).
			for (const c of pedidos) anotar(agente, "mira", `prende «Reducir el ruido» en ${cita(c.titulo, 32)}`, c.inicio);
			const fin = salio(await conElChat(ctx, antes.vista, decision.operaciones));
			if (fin) return fin;
			// Lo que quedó de verdad, no lo que se pidió (una normalización puede no entrar).
			const ids = new Set(pedidos.map((c) => c.id));
			const quedaron = despues().conVoz.filter((c) => ids.has(c.id) && c.ruido).length;
			anotar(agente, quedaron ? "listo" : "falla", `redujo el ruido de ${cuantos(quedaron, "clip", "clips")} de ${pedidos.length}`);
			return quedaron ? "hecho" : "fallo";
		}
		case "revision": {
			const chequeos = revisionFinal(antes.estado);
			for (const c of chequeos) anotar(agente, c.ok ? "qa-ok" : "qa-mal", `${c.ok ? "QA ✓" : "QA ✗"} ${c.texto}`, c.en);
			const mal = chequeos.filter((c) => !c.ok).length;
			anotar(agente, "listo", mal ? `${cuantos(mal, "cosa", "cosas")} para mirar antes de exportar` : "todo en orden: reproduce el corte final");
			// Lo que encontró la revisión se lee en sus renglones (QA ✗) y en el resumen: no es una falla de la edición.
			return "hecho";
		}
	}
}

/**
 * ¿La persona tocó el editor mientras trabajaban? Qué cuenta lo decide `cuentaComoToque` (plan.ts): un cambio suyo
 * queda mezclado en los pasos que cuenta la corrida. Se mira por las dudas: un toque para mover el cabezal también
 * cuenta, y el costo es sólo que «Deshacer todo» no se ofrece (queda Ctrl+Z). Reproducir no cuenta.
 */
function vigilarToques(): { tocado: () => boolean; soltar: () => void } {
	let tocado = false;
	const mirar = (e: Event) => {
		const el = e.target instanceof Element ? e.target : null;
		const zona = el?.closest("[data-ce-zona]")?.getAttribute("data-ce-zona") ?? null;
		const enEditable = !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable));
		const tipo = e instanceof KeyboardEvent ? "tecla" : e.type === "drop" ? "soltar" : "puntero";
		const tecla = e instanceof KeyboardEvent ? e.key : undefined;
		if (cuentaComoToque({ tipo, zona, tecla, enEditable, soloMira: !!el?.closest("[data-ce-solo-mira]") })) tocado = true;
	};
	try {
		document.addEventListener("pointerdown", mirar, true);
		document.addEventListener("keydown", mirar, true);
		document.addEventListener("drop", mirar, true);
	} catch {
		/* sin documento (no pasa en el editor) */
	}
	return {
		tocado: () => tocado,
		soltar: () => {
			try {
				document.removeEventListener("pointerdown", mirar, true);
				document.removeEventListener("keydown", mirar, true);
				document.removeEventListener("drop", mirar, true);
			} catch {
				/* idem */
			}
		},
	};
}

/**
 * La «Edición automática» entera. Abre su panel (Biblioteca › Multimedia › «Edición automática») para que se vea el
 * registro, corre los pasos en orden y, al final, deja listo «Deshacer todo» (o, si la corrió el chat, «Restaurar»).
 */
export async function correrEnjambre(
	editor: EditorCore,
	opciones: { pasos?: readonly PasoId[]; desdeElChat?: boolean } = {},
): Promise<ResultadoEnjambre> {
	if (useEnjambre.getState().fase === "corriendo") return { ok: false, motivo: "ocupado", texto: NO_ARRANCA.ocupado };
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	if (!proyecto || !escena) return { ok: false, motivo: "sin-proyecto", texto: NO_ARRANCA["sin-proyecto"] };
	if (editor.timeline.getTotalDuration() <= 0) return { ok: false, motivo: "vacio", texto: NO_ARRANCA.vacio };

	const desdeElChat = opciones.desdeElChat === true;
	empezarCorrida({ desdeElChat });
	useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_ENJAMBRE });
	const lugar = { proyectoId: proyecto.metadata.id, escenaId: escena.id };
	const tracksIniciales = escena.tracks;
	const profundidadInicial = editor.command.profundidad();
	const pasos = opciones.pasos ? PASOS.filter((p) => opciones.pasos?.includes(p.id)) : PASOS;
	const quietos = sinMovimiento();
	const toques = vigilarToques();
	let hechos = 0;
	let saltados = 0;
	let fallas = 0;
	let qaMal = 0;
	// El estilo es del agente sólo si los subtítulos los puso esta corrida con la plantilla por defecto (./plan.ts).
	let subtitulosNuevos = false;
	// La línea de tiempo como la dejó el último paso: si al empezar el siguiente es otra, alguien la tocó en el medio.
	let esperada = tracksIniciales;
	let tocadaEntrePasos = false;
	let tocado = false;
	const frases: Contexto["frases"] = { lista: null, fallo: false };
	let subtitulosNoSalieron = false;

	try {
		for (const paso of pasos) {
			if (useEnjambre.getState().detener) break;
			useEnjambre.setState({ paso: paso.id });
			fijarAgente(paso.agente, "trabajando");
			anotar(paso.agente, "empieza", renglon(paso.titulo));
			const ctx: Contexto = { editor, paso, agente: paso.agente, quietos, ...lugar, frases, subtitulosNoSalieron };
			let como: ComoTermina;
			try {
				if (!enSuLugar(ctx)) {
					anotar(paso.agente, "falla", "se cerró el proyecto o cambió la escena: aquí paran los agentes");
					fijarAgente(paso.agente, "fallo");
					fallas++;
					break;
				}
				if (editor.scenes.getActiveSceneOrNull()?.tracks !== esperada) tocadaEntrePasos = true;
				const estiloLibre = subtitulosNuevos && usePreferenciasSubtitulos.getState().plantilla === PLANTILLA_POR_DEFECTO.id;
				const antes = leer(editor, estiloLibre);
				if (!antes) throw new Error("sin escena");
				const lineasAntes = useEnjambre.getState().lineas.length;
				como = await correrPaso(ctx, antes);
				if (paso.id === "revision") qaMal = useEnjambre.getState().lineas.slice(lineasAntes).filter((l) => l.tipo === "qa-mal").length;
			} catch (error) {
				console.error(`[enjambre] ${paso.id}`, error);
				anotar(paso.agente, "falla", "algo se rompió en este paso");
				como = "fallo";
			}
			esperada = editor.scenes.getActiveSceneOrNull()?.tracks ?? esperada;
			fijarAgente(paso.agente, como === "hecho" ? "listo" : como === "fallo" ? "fallo" : "salteado");
			if (paso.id === "subtitulos" && como === "hecho") subtitulosNuevos = true;
			if (paso.id === "subtitulos" && como !== "hecho") subtitulosNoSalieron = true;
			// Lo que cambia la línea de tiempo deja viejo lo que se leyó: después de las muletillas, otra vez.
			if (como === "hecho" && (paso.id === "pausas" || paso.id === "subtitulos" || paso.id === "muletillas")) {
				frases.lista = null;
				frases.fallo = false;
			}
			if (como === "hecho") hechos++;
			else if (como === "salteado") saltados++;
			else if (como === "fallo") fallas++;
			if (!quietos) await esperar(PAUSA_ENTRE_PASOS_MS);
		}
	} finally {
		toques.soltar();
		const detenido = useEnjambre.getState().detener;
		const pasosHistorial = editor.command.profundidad() - profundidadInicial;
		const ahora = editor.scenes.getActiveSceneOrNull();
		tocado = toques.tocado() || tocadaEntrePasos || (ahora?.tracks ?? null) !== esperada;
		const puedeDeshacer = !desdeElChat && !tocado && pasosHistorial > 0 && !!ahora && ahora.id === lugar.escenaId;
		const resumen = [
			detenido ? "Detenido." : "Listo.",
			hechos ? `${cuantos(hechos, "agente trabajó", "agentes trabajaron")}` : "Ningún agente cambió nada",
			saltados ? `${cuantos(saltados, "no tenía", "no tenían")} nada que hacer` : null,
			fallas ? `${cuantos(fallas, "no pudo", "no pudieron")}` : null,
			qaMal ? `la revisión marcó ${cuantos(qaMal, "cosa", "cosas")} para mirar` : null,
			pasosHistorial > 0 && desdeElChat ? "se deshace con «Restaurar» en el chat" : null,
			pasosHistorial > 0 && !desdeElChat && tocado ? "tocaste el editor mientras trabajaban: para volver atrás, Ctrl+Z" : null,
		]
			.filter(Boolean)
			.join(" · ");
		useEnjambre.setState({
			fase: "terminado",
			paso: null,
			resumen,
			error: fallas > 0,
			deshacer: puedeDeshacer && ahora ? { escenaId: lugar.escenaId, antes: tracksIniciales, despues: ahora.tracks, pasos: pasosHistorial } : null,
		});
	}
	const s = useEnjambre.getState();
	return {
		ok: true,
		pasos: Math.max(0, editor.command.profundidad() - profundidadInicial),
		hechos,
		saltados,
		fallas,
		detenido: s.detener,
		tocado,
		resumen: s.resumen ?? "",
	};
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
	// Vuelve al principio: sin «Reproducir el corte final» de algo que ya no está.
	useEnjambre.setState({ deshacer: null, fase: "inactivo", error: false, resumen: "Se deshizo la edición automática." });
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
