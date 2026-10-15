// gifenc 1.0.3 (MIT) no trae tipos. Sólo lo que usa export/gif.ts — y `first`, que usa el Image Editor
// (app/image-editor/_doory/editor/engine/export/video/gif.ts): las dos declaraciones del módulo se FUSIONAN y gana ésta.
declare module "gifenc" {
	export type Paleta = number[][];
	export type FormatoColor = "rgb565" | "rgb444" | "rgba4444";
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: { format?: FormatoColor; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
	): Paleta;
	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: Paleta,
		format?: FormatoColor,
	): Uint8Array;
	export type CodificadorGif = {
		writeFrame(
			index: Uint8Array,
			width: number,
			height: number,
			opts?: { palette?: Paleta; delay?: number; repeat?: number; transparent?: boolean; dispose?: number; first?: boolean },
		): void;
		finish(): void;
		bytes(): Uint8Array;
		bytesView(): Uint8Array;
	};
	export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): CodificadorGif;
}
