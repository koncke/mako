// =============================================================================
// PCM de 16 bits en un .wav (para las grabaciones del micrófono)
// =============================================================================
// MediaRecorder entrega un .webm (Opus) en Chrome o un .mp4 (AAC) en Safari, y
// el .webm suele venir SIN duración en la cabecera (el `<audio>` dice
// `Infinity`, docs/hallazgos-video-editor.md → «Lo que el navegador y
// mediabunny contestan mal») y sin índice para buscar. La grabación se guarda
// como WAV: duración exacta, se busca en cualquier punto y la lee todo. Una
// voz de un minuto en mono a 48 kHz son ~5,8 MB.

export function wavDeCanales(canales: readonly Float32Array[], sampleRate: number): Blob {
	const n = Math.max(1, Math.min(2, canales.length));
	const muestras = canales[0]?.length ?? 0;
	const bytes = muestras * n * 2;
	const vista = new DataView(new ArrayBuffer(44 + bytes));
	const texto = (off: number, s: string) => {
		for (let i = 0; i < s.length; i++) vista.setUint8(off + i, s.charCodeAt(i));
	};
	texto(0, "RIFF");
	vista.setUint32(4, 36 + bytes, true);
	texto(8, "WAVE");
	texto(12, "fmt ");
	vista.setUint32(16, 16, true);
	vista.setUint16(20, 1, true); // PCM
	vista.setUint16(22, n, true);
	vista.setUint32(24, sampleRate, true);
	vista.setUint32(28, sampleRate * n * 2, true);
	vista.setUint16(32, n * 2, true);
	vista.setUint16(34, 16, true);
	texto(36, "data");
	vista.setUint32(40, bytes, true);
	let off = 44;
	for (let i = 0; i < muestras; i++) {
		for (let c = 0; c < n; c++) {
			const v = Math.max(-1, Math.min(1, canales[c][i] ?? 0));
			vista.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
			off += 2;
		}
	}
	return new Blob([vista.buffer], { type: "audio/wav" });
}
