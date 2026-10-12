import type { FrameRate } from "@/app/video-editor/_opencut/wasm/opencut";
import type { TScene } from "@/app/video-editor/_opencut/timeline/types";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

export type TBackground =
	| {
			type: "color";
			color: string;
	  }
	| {
			type: "blur";
			blurIntensity: number;
	  };

export interface TCanvasSize {
	width: number;
	height: number;
}

export interface TProjectMetadata {
	id: string;
	name: string;
	thumbnail?: string;
	duration: MediaTime;
	createdAt: Date;
	updatedAt: Date;
}

export interface TProjectSettings {
	fps: FrameRate;
	canvasSize: TCanvasSize;
	canvasSizeMode?: "preset" | "custom";
	lastCustomCanvasSize?: TCanvasSize | null;
	originalCanvasSize?: TCanvasSize | null;
	/** «Relación» del reproductor de CapCut (ver canvas/sizes.ts). Sin valor o
	 *  "original": el primer clip fija el lienzo; con otra, el lienzo queda fijo. */
	relacion?: string;
	background: TBackground;
	/** «Portada» de CapCut (botón a la izquierda de la pista principal). Ver
	 *  timeline/components/portada.ts: `leerPortada()` la expone para Exportar. */
	portada?: TPortada;
}

/** Un cuadro del video (`tiempo`, en ticks) o una imagen propia (`imagen`, data URL). */
export type TPortada =
	| { tipo: "cuadro"; tiempo: MediaTime }
	| { tipo: "imagen"; imagen: string };

export interface TTimelineViewState {
	zoomLevel: number;
	scrollLeft: number;
	playheadTime: MediaTime;
}

export interface TProject {
	metadata: TProjectMetadata;
	scenes: TScene[];
	currentSceneId: string;
	settings: TProjectSettings;
	version: number;
	timelineViewState?: TTimelineViewState;
}

export type TProjectSortKey = "createdAt" | "updatedAt" | "name" | "duration";
export type TSortOrder = "asc" | "desc";
export type TProjectSortOption = `${TProjectSortKey}-${TSortOrder}`;
