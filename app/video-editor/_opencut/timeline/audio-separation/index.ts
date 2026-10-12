import { cloneAnimations } from "@/app/video-editor/_opencut/animation";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { DEFAULTS } from "@/app/video-editor/_opencut/timeline/defaults";
import { EXTRAIDO_DE } from "@/app/video-editor/_opencut/audio/claves";
import type {
	CreateUploadAudioElement,
	SceneTracks,
	TimelineElement,
	AudioElement,
	VideoElement,
} from "../types";

type MediaAudioState = Pick<MediaAsset, "hasAudio">;

export function isSourceAudioEnabled({
	element,
}: {
	element: VideoElement;
}): boolean {
	return element.isSourceAudioEnabled !== false;
}

export function isSourceAudioSeparated({
	element,
}: {
	element: VideoElement;
}): boolean {
	return !isSourceAudioEnabled({ element });
}

export function canExtractSourceAudio(
	element: TimelineElement,
	mediaAsset: MediaAudioState | null | undefined,
): element is VideoElement {
	return (
		element.type === "video" &&
		isSourceAudioEnabled({ element }) &&
		!!mediaAsset &&
		mediaAsset.hasAudio !== false
	);
}

export function canRecoverSourceAudio(
	element: TimelineElement,
): element is VideoElement {
	return element.type === "video" && isSourceAudioSeparated({ element });
}

export function canToggleSourceAudio(
	element: TimelineElement,
	mediaAsset: MediaAudioState | null | undefined,
): element is VideoElement {
	return (
		canRecoverSourceAudio(element) || canExtractSourceAudio(element, mediaAsset)
	);
}

export function doesElementHaveEnabledAudio({
	element,
	mediaAsset,
}: {
	element: AudioElement | VideoElement;
	mediaAsset?: MediaAudioState | null;
}): boolean {
	if (element.type === "audio") {
		return true;
	}

	return (
		!!mediaAsset &&
		mediaAsset.hasAudio !== false &&
		isSourceAudioEnabled({ element })
	);
}

export function buildSeparatedAudioElement({
	sourceElement,
}: {
	sourceElement: VideoElement;
}): CreateUploadAudioElement {
	return {
		type: "audio",
		sourceType: "upload",
		mediaId: sourceElement.mediaId,
		name: sourceElement.name,
		duration: sourceElement.duration,
		startTime: sourceElement.startTime,
		trimStart: sourceElement.trimStart,
		trimEnd: sourceElement.trimEnd,
		sourceDuration: sourceElement.sourceDuration,
		params: {
			// «Extraer audio» se lleva TODO lo de audio del clip (fundidos,
			// normalizar, ruido, modificador de voz: las claves `audio.*`), como
			// CapCut: el audio separado tiene que sonar igual que antes de separarlo.
			...Object.fromEntries(
				Object.entries(sourceElement.params).filter(([clave]) => clave.startsWith("audio.")),
			),
			// De qué clip salió: «Recuperar audio» lo borra (`sinAudioExtraido`).
			[EXTRAIDO_DE]: sourceElement.id,
			volume:
				typeof sourceElement.params.volume === "number"
					? sourceElement.params.volume
					: DEFAULTS.element.volume,
			muted: sourceElement.params.muted === true,
		},
		// El retime entero: con la curva de velocidad, el audio separado sigue
		// la misma rampa que el video.
		retime: sourceElement.retime ? { ...sourceElement.retime } : undefined,
		animations: cloneVolumeAnimations({
			animations: sourceElement.animations,
		}),
	};
}

/**
 * «Recuperar audio» devuelve el sonido al video Y saca el audio que se había
 * extraído (las partes, si se dividió): OpenCut sólo volvía a prender el del
 * video, y los dos sonaban a la vez, corridos si el extraído se había movido.
 * Se reconoce por la marca `audio.extraidoDe`; uno que la perdió (extraído antes
 * de existir la marca, o el video se dividió y es la mitad nueva) queda donde
 * está.
 */
export function sinAudioExtraido({
	tracks,
	videoId,
}: {
	tracks: SceneTracks;
	videoId: string;
}): SceneTracks {
	const delVideo = (element: TimelineElement) =>
		element.type === "audio" && element.params[EXTRAIDO_DE] === videoId;
	if (!tracks.audio.some((track) => track.elements.some(delVideo))) return tracks;
	return {
		...tracks,
		audio: tracks.audio.map((track) =>
			track.elements.some(delVideo)
				? { ...track, elements: track.elements.filter((element) => !delVideo(element)) }
				: track,
		),
	};
}

/** El rótulo de CapCut (`pc_audio_extraction` / `restore_audio`). */
export function getSourceAudioActionLabel({
	element,
}: {
	element: VideoElement;
}): "Extraer audio" | "Recuperar audio" {
	return isSourceAudioSeparated({ element })
		? "Recuperar audio"
		: "Extraer audio";
}

function cloneVolumeAnimations({
	animations,
}: {
	animations: ElementAnimations | undefined;
}): ElementAnimations | undefined {
	const volumeData = animations?.volume;
	if (!volumeData) {
		return undefined;
	}

	return cloneAnimations({
		animations: { volume: volumeData },
		shouldRegenerateKeyframeIds: true,
	});
}
