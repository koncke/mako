// =============================================================================
// «Cambiar por otra»: un B-roll ya puesto trae la siguiente foto (o video) de SU búsqueda
// =============================================================================
// Pedido del plan del Video Editor (pendientes-video-editor.md §4.1, 10/11/2026). Sobre un B-roll de MaKo, propuesto o
// ya dejado (lleva su búsqueda y el id de Pexels: ./pistas.ts → `brollDe`):
//
//   la misma búsqueda, en Pexels con la clave del negocio (./red.ts, la MISMA que «Proponer»)
//   → la primera que no se vio en ese lugar ni está en otro (`noRepetirEn`); un video, que dure lo que el lugar
//   → a Multimedia
//   → UN paso de deshacer: el archivo nuevo en el MISMO lugar y tiempo (`lineaConOtroBroll`), contra la línea de AHORA
//     (la persona pudo seguir editando mientras se bajaba).
//
// Lo usan el botón «Otra» de la sección «B-roll de MaKo» y el chat (`cambiar_broll`). No lanza: devuelve su resultado
// (./resultado.ts), y los dos dicen el MISMO texto.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { buildDefaultParamValues, getBuiltInElementParams } from "@/app/video-editor/_opencut/params/registry";
import { buscarClip, fuenteNecesaria, medioDeAsset } from "@/app/video-editor/_opencut/reemplazo/puro";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { orientacionDeLienzo, type FotoBroll, type VideoBroll } from "@/lib/editor-video/broll-pexels";
import { useTrabajoBroll } from "./estado";
import { brollDe, lineaConOtroBroll, noRepetirEn, puedeCambiarBroll, siguienteBroll } from "./pistas";
import { aMultimedia, bajarDePexels, pedirJson } from "./red";
import { motivoSiNoSePuede, resumenDeCambioBroll, textoDeCambioBroll, type ResultadoCambioBroll } from "./resultado";

/** Cuántas de la búsqueda se miran para encontrar la siguiente (el tope de la ruta). */
const CANDIDATAS = 15;
/** Cuántas se prueban a bajar si una falla. */
const INTENTOS = 3;

export async function cambiarBroll(editor: EditorCore, ref: ElementRef): Promise<ResultadoCambioBroll> {
	const trabajo = useTrabajoBroll.getState();
	// Una a la vez, y nunca mientras «Proponer» arma la suya (la propuesta nueva reemplaza lo pendiente).
	if (trabajo.cambiando || trabajo.fase !== "inactivo") return { ok: false, motivo: "ocupado" };
	const terminar = (r: ResultadoCambioBroll): ResultadoCambioBroll => {
		trabajo.fijar({
			cambiando: null,
			mensaje: r.ok ? resumenDeCambioBroll(r) : textoDeCambioBroll(r),
			error: !r.ok,
			faltaPexels: !r.ok && r.motivo === "falta-pexels",
		});
		return r;
	};
	const proyecto = editor.project.getActiveOrNull();
	const escena = editor.scenes.getActiveSceneOrNull();
	const clip = escena ? buscarClip(escena.tracks, ref) : null;
	const broll = clip ? brollDe(clip.element) : null;
	// Una pista bloqueada no la cambia ninguna herramienta (tampoco el chat, linea.ts): se corta antes de bajar nada.
	const antes = motivoSiNoSePuede(escena ? puedeCambiarBroll(escena.tracks, ref) : "falta", "antes");
	if (antes) return terminar({ ok: false, motivo: antes });
	if (!proyecto || !escena || !clip || !broll) return terminar({ ok: false, motivo: "sin-broll" });
	trabajo.fijar({ cambiando: clip.element.id, mensaje: null, error: false, faltaPexels: false });
	try {
		const lienzo = proyecto.settings.canvasSize;
		const orientacion = orientacionDeLienzo(lienzo.width, lienzo.height);
		const busqueda = await pedirJson<{ resultados: Array<{ consulta: string; fotos?: FotoBroll[]; videos?: VideoBroll[] }> }>(
			{ accion: "buscar", orientacion, medio: broll.medio, cuantas: CANDIDATAS, consultas: [broll.busqueda] },
			60_000,
		);
		if (!busqueda.ok) {
			if (busqueda.falla.faltaPexels) return terminar({ ok: false, motivo: "falta-pexels" });
			return terminar({ ok: false, motivo: busqueda.falla.status ? "pexels" : "red", ...(busqueda.falla.error ? { detalle: busqueda.falla.error } : {}) });
		}
		const res = busqueda.datos.resultados?.[0];
		const candidatas: Array<FotoBroll | VideoBroll> = (broll.medio === "videos" ? res?.videos : res?.fotos) ?? [];
		const necesitaS = fuenteNecesaria(clip.element) / TICKS_PER_SECOND;
		const sirve = (c: FotoBroll | VideoBroll) => !("duracion" in c) || c.duracion >= necesitaS;
		const fuera = noRepetirEn(escena.tracks, clip.element);
		if (!siguienteBroll(candidatas, fuera)) return terminar({ ok: false, motivo: "sin-otra" });
		if (!siguienteBroll(candidatas, fuera, sirve)) return terminar({ ok: false, motivo: "corto" });

		let ultimoError = "";
		for (let intento = 0; intento < INTENTOS; intento++) {
			const elegida = siguienteBroll(candidatas, fuera, sirve);
			if (!elegida) break;
			fuera.add(elegida.id);
			const bajada = await bajarDePexels(elegida.id, broll.medio, orientacion);
			if (!bajada.ok) { ultimoError = bajada.error; continue; }
			const asset = await aMultimedia(editor, proyecto.metadata.id, bajada.archivo);
			const medio = asset ? medioDeAsset(asset) : null;
			if (!medio) continue;
			// La persona pudo abrir otro proyecto, o borrar ese B-roll, mientras se bajaba: se mira la línea de AHORA.
			if (editor.project.getActiveOrNull()?.metadata.id !== proyecto.metadata.id) return terminar({ ok: false, motivo: "otro-proyecto" });
			const ahora = editor.scenes.getActiveSceneOrNull()?.tracks;
			if (!ahora) return terminar({ ok: false, motivo: "sacado" });
			// Y lo mismo al VOLVER: la persona pudo sacarlo (o reemplazarlo) o bloquear su pista mientras se bajaba.
			const despues = motivoSiNoSePuede(puedeCambiarBroll(ahora, { trackId: clip.track.id, elementId: clip.element.id }), "despues");
			if (despues) return terminar({ ok: false, motivo: despues });
			const assets = editor.media.getAssets();
			const r = lineaConOtroBroll({
				tracks: ahora,
				ref: { trackId: clip.track.id, elementId: clip.element.id },
				medio,
				foto: { id: elegida.id, autor: bajada.autor || elegida.autor },
				tps: TICKS_PER_SECOND,
				lienzo,
				tamanoDe: (id) => {
					const a = assets.find((x) => x.id === id);
					return a?.width && a.height ? { width: a.width, height: a.height } : null;
				},
				base: (tipo) => buildDefaultParamValues(getBuiltInElementParams({ type: tipo })),
			});
			if (!r.ok) {
				// Lo bajado era más corto de lo que decía Pexels: se prueba la siguiente.
				if (r.motivo === "corto") continue;
				return terminar({ ok: false, motivo: r.motivo === "bloqueada" ? "bloqueada" : "sin-broll" });
			}
			editor.command.execute({ command: new TracksSnapshotCommand({ before: ahora, after: r.tracks }) });
			return terminar({ ok: true, medio: broll.medio, autor: bajada.autor || elegida.autor });
		}
		return terminar({ ok: false, motivo: "pexels", ...(ultimoError ? { detalle: ultimoError } : {}) });
	} catch (error) {
		console.error("[broll] no se pudo cambiar", error);
		return terminar({ ok: false, motivo: "red" });
	}
}
