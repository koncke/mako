// =============================================================================
// Clips mágicos: mirar los cuadros del clip y escribirle el encuadre que sigue a la persona (con el motor)
// =============================================================================
// Lo que se decide está en ./seguir.ts (puro, con test); acá se consigue lo que necesita y se aplica:
//
//   · los cuadros: un Input propio por clip, como «Congelar» (../recorte/cuadro.ts), para no mover el decodificador
//     del reproductor; chicos (lado largo de 512, lo que mide la máscara) y en orden, con `canvasesAtTimestamps`;
//   · la máscara: el segmentador de «Eliminación automática» (../fondo/segmentador.ts), el mismo de la pestaña: si ya
//     cargó, no se baja nada; si no, baja su wasm (13 MB del CDN) y su modelo (244 KB) una vez. Con `avisar: false`:
//     si no carga, el clip queda al centro y no sale el aviso de quitar el fondo, que acá nadie pidió. Y con su propio
//     tope (no los 2 min del recorte): abrir un clip no espera tanto por un encuadre;
//   · los fotogramas clave de `transform.positionX`, con `upsertPathKeyframe` (como «Girar» en reflejar-girar.ts),
//     en el tiempo del CLIP (lo que se mira se pasa al tiempo de la fuente con su velocidad).
//
// Nada de esto lanza: un clip que no se pudo mirar queda sin encuadre (el centro de siempre).

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { SceneTracks, TimelineElement, VideoElement } from "@/app/video-editor/_opencut/timeline";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import { upsertPathKeyframe } from "@/app/video-editor/_opencut/animation";
import { coerceParamValue, getParamChannelLayout } from "@/app/video-editor/_opencut/params";
import { getElementParam } from "@/app/video-editor/_opencut/params/registry";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { TICKS_PER_SECOND, roundMediaTime } from "@/app/video-editor/_opencut/wasm";
import { cargarSegmentador, segmentarPersona } from "@/app/video-editor/_opencut/fondo/segmentador";
import { tamanoSegmentacion } from "@/app/video-editor/_opencut/fondo/mascara";
import { sinAnimacionDelEncuadre } from "./cubrir";
import {
	dibujoDelClip,
	encuadresDeLosClips,
	momentosAMuestrear,
	perfilDePersona,
	type EncuadreSeguido,
	type Mirada,
	type MuestraPersona,
	type Tamano,
} from "./seguir";

/** Lo que se espera a que cargue el segmentador antes de dejar el clip al centro (su carga sigue para la próxima). */
const TOPE_SEGMENTADOR_MS = 25_000;

const esperar = (ms: number) => new Promise<false>((r) => setTimeout(() => r(false), ms));

/**
 * Qué se ve de la persona en cada momento (segundos del clip). Un archivo que no se decodifica no es un segmentador
 * caído: ese clip queda al centro y el próximo se mira igual (`Mirada`, ./seguir.ts).
 */
async function muestrasDePersona({
	file,
	momentos,
	enLaFuente,
	alCuadro,
}: {
	file: File;
	momentos: number[];
	enLaFuente: (t: number) => number;
	alCuadro: () => void;
}): Promise<Mirada> {
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	try {
		const pista = await input.getPrimaryVideoTrack();
		if (!pista || !(await pista.canDecode())) return { tipo: "no-se-lee" };
		const { ancho, alto } = tamanoSegmentacion(pista.displayWidth, pista.displayHeight);
		const sink = new CanvasSink(pista, { width: ancho, height: alto, fit: "fill", poolSize: 1 });
		const primero = await pista.getFirstTimestamp().catch(() => 0);
		const muestras: MuestraPersona[] = [];
		let i = 0;
		for await (const cuadro of sink.canvasesAtTimestamps(momentos.map((t) => Math.max(primero, enLaFuente(t))))) {
			const t = momentos[i++];
			const visto: { centro: number | null } = { centro: null };
			if (cuadro) {
				const ok = segmentarPersona(
					cuadro.canvas,
					({ confianza, esDeFondo }) => {
						visto.centro = perfilDePersona({ confianza, esDeFondo, ancho, alto }).centro;
					},
					{ avisar: false },
				);
				if (!ok) return { tipo: "sin-segmentador" };
			}
			muestras.push({ t, centro: visto.centro });
			alCuadro();
		}
		return { tipo: "visto", muestras };
	} finally {
		input.dispose();
	}
}

/**
 * El encuadre de cada clip de video de la pista principal donde se encontró a alguien, por id. Vacío si el
 * segmentador no carga a tiempo. `alAvanzar`: de 0 a 1, por cuadro mirado.
 */
export async function encuadresQueSiguen({
	editor,
	tracks,
	lienzo,
	alAvanzar,
}: {
	editor: EditorCore;
	tracks: SceneTracks;
	lienzo: Tamano;
	alAvanzar?: (hecho: number) => void;
}): Promise<Map<string, EncuadreSeguido>> {
	const encuadres = new Map<string, EncuadreSeguido>();
	const assets = editor.media.getAssets();
	const clips = (tracks.main.elements as TimelineElement[])
		.filter((el): el is VideoElement => el.type === "video")
		.flatMap((el) => {
			const asset = assets.find((a) => a.id === el.mediaId);
			const fuente = asset?.width && asset.height ? { width: asset.width, height: asset.height } : null;
			// Reflejado se sigue al revés; girado no se sigue, así que ni se mira (./seguir.ts → `dibujoDelClip`).
			const dibujo = dibujoDelClip(el);
			// Sólo lo que es más ancho que el vertical tiene costados que elegir.
			return asset?.file && fuente && !dibujo.girado && fuente.width / fuente.height > lienzo.width / lienzo.height
				? [{ id: el.id, el, file: asset.file, fuente, dibujo }]
				: [];
		});
	if (clips.length === 0) return encuadres;
	const listo = await Promise.race([cargarSegmentador({ avisar: false }), esperar(TOPE_SEGMENTADOR_MS)]);
	if (!listo) return encuadres;

	const porClip = new Map(clips.map(({ el }) => [el.id, momentosAMuestrear(el.duration / TICKS_PER_SECOND)] as const));
	const total = [...porClip.values()].reduce((s, m) => s + m.length, 0) || 1;
	let hechos = 0;
	// Uno por uno (./seguir.ts → `encuadresDeLosClips`): uno que no se lee queda al centro y se sigue con el próximo;
	// sin segmentador, el resto también queda al centro.
	return encuadresDeLosClips({
		clips,
		lienzo,
		alFallar: (error) => console.warn("[clips] no se pudo seguir a la persona en un clip; queda al centro", error),
		mirar: ({ el, file }) => {
			const duracion = el.duration / TICKS_PER_SECOND;
			const desde = el.trimStart / TICKS_PER_SECOND;
			return muestrasDePersona({
				file,
				momentos: porClip.get(el.id) ?? [],
				enLaFuente: (t) => desde + getSourceTimeAtClipTime({ clipTime: t, retime: el.retime, clipDuration: duracion }),
				alCuadro: () => alAvanzar?.(Math.min(1, ++hechos / total)),
			});
		},
	});
}

/**
 * Si el encuadre se mueve, un fotograma clave de `transform.positionX` por punto. Lo que el clip traía animado de su
 * posición o su escala ya lo sacó ./cubrir.ts (`sinAnimacionDelEncuadre`, en los dos caminos); se vuelve a sacar acá
 * por si alguien llama a esta función suelta: mandaría sobre el encuadre.
 */
export function animarEncuadre(elemento: TimelineElement, encuadre: EncuadreSeguido): TimelineElement {
	let animations = (sinAnimacionDelEncuadre(elemento).animations as ElementAnimations | undefined) ?? undefined;
	const param = encuadre.claves ? getElementParam({ element: elemento, key: "transform.positionX" }) : null;
	if (encuadre.claves && param) {
		for (const clave of encuadre.claves) {
			animations = upsertPathKeyframe({
				animations,
				propertyPath: "transform.positionX",
				time: roundMediaTime({ time: clave.t * TICKS_PER_SECOND }),
				value: clave.x,
				channelLayout: getParamChannelLayout({ param }),
				coerceValue: ({ value }) => coerceParamValue({ param, value }),
			});
		}
	}
	return { ...elemento, animations } as TimelineElement;
}
