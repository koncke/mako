// =============================================================================
// El modelo de Whisper que corre en el navegador (transformers.js)
// =============================================================================
// Los subtítulos de CapCut salen con tiempos POR PALABRA, y eso exige un modelo
// exportado con las atenciones cruzadas: los `onnx-community/whisper-*` comunes
// no las traen y `return_timestamps: 'word'` revienta con «Model outputs must
// contain cross attentions» (transformers.js 3.8, models.js
// `_extract_token_timestamps`). Los `*_timestamped` sí, y traen `alignment_heads`
// en su generation_config (medido el 11/10/2026 contra la API de Hugging Face).
//
// Qué se baja la primera vez (queda en la Cache Storage del navegador):
//   whisper-small_timestamped  webgpu q4  ≈ 300 MB  (encoder 66 + decoder 233)
//                              wasm   q8  ≈ 250 MB  (encoder 92 + decoder 157)
//   whisper-base_timestamped   wasm   q8  ≈  77 MB
// ⚠️ El q4 del decoder pesa MÁS que el q8 (233 contra 157 MB): no es «q4 = chico».
// Va q4 en WebGPU porque el q8 dinámico (MatMulInteger) no lo corre el proveedor
// de WebGPU y cae a la CPU nodo por nodo; en WASM va q8, que es el camino de
// siempre de transformers.js.
//
// Small y no base: en español base equivoca más o menos el doble de palabras, y
// cada una es un subtítulo que el cliente tiene que corregir a mano.

import type { TranscriptionModel, TranscriptionModelId } from "./types";

export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
	{
		id: "whisper-tiny",
		name: "Tiny",
		huggingFaceId: "onnx-community/whisper-tiny_timestamped",
		description: "≈ 41 MB",
	},
	{
		id: "whisper-base",
		name: "Base",
		huggingFaceId: "onnx-community/whisper-base_timestamped",
		description: "≈ 77 MB",
	},
	{
		id: "whisper-small",
		name: "Small",
		huggingFaceId: "onnx-community/whisper-small_timestamped",
		description: "≈ 250 MB",
	},
	{
		id: "whisper-medium",
		name: "Medium",
		huggingFaceId: "onnx-community/whisper-medium_timestamped",
		description: "≈ 800 MB",
	},
];

export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModelId = "whisper-small";

export type DispositivoWhisper = "webgpu" | "wasm";

/** El `dtype` de transformers.js por dispositivo (ver la cabecera). */
export function dtypeDe(dispositivo: DispositivoWhisper): "q4" | "q8" {
	return dispositivo === "webgpu" ? "q4" : "q8";
}
