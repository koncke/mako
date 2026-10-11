// =============================================================================
// Las opciones del diálogo «Exportar» de CapCut, como datos
// =============================================================================
// El diálogo de CapCut 9.3 (relevamiento-capcut-armazon.md §9) tiene Resolución,
// Tasa de bits, Codec, Formato y Cuadros por segundo para el video, y casillas
// aparte para Audio, Subtítulos y GIF. Acá viven las listas, los valores por
// defecto, la cuenta de la tasa de bits y la estimación del pie («Duración: 11s
// | Tamaño: alrededor de 82 MB»), separados de la pantalla para que el motor de
// exportación (./exportar.ts) y el diálogo lean lo mismo.
//
// Lo que el navegador no puede hacer se DIBUJA igual pero apagado (8K, ProRes):
// el diálogo tiene que ser idéntico, y una opción que falta se busca; una
// apagada se entiende (decisión 7 del relevamiento §13).

import { canEncodeAudio, canEncodeVideo, Quality } from "mediabunny";

// ── Resolución ──────────────────────────────────────────────────────────────

/** «1080P» es el lado CORTO: un vertical 9:16 a 1080P sale 1080×1920, como en CapCut. */
export const RESOLUCIONES = [
	{ id: "480", etiqueta: "480P", lado: 480 },
	{ id: "720", etiqueta: "720P", lado: 720 },
	{ id: "1080", etiqueta: "1080P", lado: 1080 },
	{ id: "2k", etiqueta: "2K", lado: 1440 },
	{ id: "4k", etiqueta: "4K", lado: 2160 },
	// 8K: el codificador del navegador no llega (4320 de lado corto supera lo que
	// WebCodecs acepta en H.264 y casi siempre en HEVC). Se dibuja apagada.
	{ id: "8k", etiqueta: "8K", lado: 4320, imposible: true },
] as const;

export type ResolucionId = (typeof RESOLUCIONES)[number]["id"];

/** El tamaño del archivo para un lienzo y una resolución: misma proporción, lados pares (H.264 los exige). */
export function tamanoSalida({
	lienzo,
	resolucion,
}: {
	lienzo: { width: number; height: number };
	resolucion: ResolucionId;
}): { width: number; height: number } {
	const lado = RESOLUCIONES.find((r) => r.id === resolucion)?.lado ?? 1080;
	const corto = Math.max(1, Math.min(lienzo.width, lienzo.height));
	const escala = lado / corto;
	const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);
	return { width: par(lienzo.width * escala), height: par(lienzo.height * escala) };
}

/** La resolución por defecto: la del lienzo si coincide con una de la lista; si no, 1080P (la de CapCut). */
export function resolucionPorDefecto(lienzo: { width: number; height: number }): ResolucionId {
	const corto = Math.min(lienzo.width, lienzo.height);
	const exacta = RESOLUCIONES.find((r) => !("imposible" in r) && r.lado === corto);
	return exacta?.id ?? "1080";
}

// ── Cuadros por segundo ─────────────────────────────────────────────────────

/** Los siete de CapCut (`pc_export_24`…`pc_export_60`); el rótulo va con coma decimal, como el es-LA.po. */
export const CUADROS = [
	{ id: "24", etiqueta: "24 fps", valor: 24 },
	{ id: "25", etiqueta: "25 fps", valor: 25 },
	{ id: "29.97", etiqueta: "29,97 fps", valor: 30000 / 1001 },
	{ id: "30", etiqueta: "30 fps", valor: 30 },
	{ id: "50", etiqueta: "50 fps", valor: 50 },
	{ id: "59.94", etiqueta: "59,94 fps", valor: 60000 / 1001 },
	{ id: "60", etiqueta: "60 fps", valor: 60 },
] as const;

export type CuadrosId = (typeof CUADROS)[number]["id"];

export function cuadrosPorDefecto(fpsProyecto: number): CuadrosId {
	const exacto = CUADROS.find((c) => Math.abs(c.valor - fpsProyecto) < 0.01);
	return exacto?.id ?? "30";
}

export function valorCuadros(id: CuadrosId): number {
	return CUADROS.find((c) => c.id === id)?.valor ?? 30;
}

// ── Formato y codec ─────────────────────────────────────────────────────────

/** CapCut ofrece mp4 y mov; webm se suma porque es lo único que exporta VP9 (Firefox no codifica H.264). */
export const FORMATOS = [
	{ id: "mp4", etiqueta: "mp4" },
	{ id: "mov", etiqueta: "mov" },
	{ id: "webm", etiqueta: "webm" },
] as const;

export type FormatoId = (typeof FORMATOS)[number]["id"];

export type CodecId = "avc" | "hevc" | "av1" | "vp9" | "prores";

export const CODECS: { id: CodecId; etiqueta: string; formatos: FormatoId[]; imposible?: true }[] = [
	{ id: "avc", etiqueta: "H.264", formatos: ["mp4", "mov"] },
	{ id: "hevc", etiqueta: "HEVC", formatos: ["mp4", "mov"] },
	{ id: "av1", etiqueta: "AV1", formatos: ["mp4", "mov", "webm"] },
	{ id: "vp9", etiqueta: "VP9", formatos: ["webm"] },
	// Ningún navegador trae un codificador ProRes: se dibuja apagado, como 8K.
	{ id: "prores", etiqueta: "Apple ProRes", formatos: ["mov"], imposible: true },
];

/** Los codecs que se muestran para un formato (VP9 sólo con webm: CapCut no lo lista). */
export function codecsDelFormato(formato: FormatoId) {
	return CODECS.filter((c) => c.formatos.includes(formato));
}

// ── Tasa de bits ────────────────────────────────────────────────────────────

export type TasaId = "baja" | "recomendada" | "alta" | "personalizada";

/** `pc_lower` / `pc_cover_recommend` / `pc_higher` / `custome_rate`. */
export const TASAS: { id: TasaId; etiqueta: string }[] = [
	{ id: "baja", etiqueta: "Más bajo" },
	{ id: "recomendada", etiqueta: "Recomendado" },
	{ id: "alta", etiqueta: "Más alto" },
	{ id: "personalizada", etiqueta: "Personalizado" },
];

export type ModoTasa = "variable" | "constant";

/**
 * Los Mbps «Recomendado» de H.264 hasta 30 fps, por lado corto. CapCut no publica
 * los suyos: son los de la guía de YouTube para subir SDR, que es para lo que
 * se exporta un anuncio. Más de 30 fps pide ×1,5; HEVC/AV1/VP9 comprimen mejor
 * y con ×0,65 dan la misma calidad.
 */
const MBPS_RECOMENDADO: Record<number, number> = { 480: 2.5, 720: 5, 1080: 10, 1440: 16, 2160: 40, 4320: 120 };
const FACTOR_TASA: Record<Exclude<TasaId, "personalizada">, number> = { baja: 0.5, recomendada: 1, alta: 1.6 };

export function tasaDeBits({
	resolucion,
	fps,
	codec,
	tasa,
	personalizadaMbps,
}: {
	resolucion: ResolucionId;
	fps: number;
	codec: CodecId;
	tasa: TasaId;
	personalizadaMbps: number;
}): number {
	if (tasa === "personalizada") return Math.round(Math.max(0.5, personalizadaMbps) * 1_000_000);
	const lado = RESOLUCIONES.find((r) => r.id === resolucion)?.lado ?? 1080;
	const base = MBPS_RECOMENDADO[lado] ?? 10;
	const porFps = fps > 31 ? 1.5 : 1;
	const porCodec = codec === "avc" ? 1 : 0.65;
	return Math.round(base * porFps * porCodec * FACTOR_TASA[tasa] * 1_000_000);
}

// ── Audio, subtítulos y GIF ─────────────────────────────────────────────────

export const FORMATOS_AUDIO = [
	{ id: "aac", etiqueta: "AAC" },
	{ id: "mp3", etiqueta: "MP3" },
	{ id: "wav", etiqueta: "WAV" },
] as const;
export type FormatoAudioId = (typeof FORMATOS_AUDIO)[number]["id"];

export const FORMATOS_SUBTITULO = [
	{ id: "srt", etiqueta: "SRT" },
	{ id: "txt", etiqueta: "TXT" },
] as const;
export type FormatoSubtituloId = (typeof FORMATOS_SUBTITULO)[number]["id"];

/** `pc_gif_high_definition` / `pc_gif_super_definition`. Lado corto, como la resolución del video. */
export const RESOLUCIONES_GIF = [
	{ id: "320", etiqueta: "320P", lado: 320 },
	{ id: "640", etiqueta: "640P", lado: 640 },
] as const;
export type ResolucionGifId = (typeof RESOLUCIONES_GIF)[number]["id"];

/** CapCut corta el GIF: más largo que esto da «No se puede exportar. El video es demasiado largo.» */
export const GIF_MAX_SEGUNDOS = 60;
/** 10 cuadros por segundo: el retardo del GIF va en centésimas y 10 es el que cae exacto. */
export const GIF_FPS = 10;

export const AUDIO_BITRATE = 192_000;

// ── Lo que el diálogo eligió ────────────────────────────────────────────────

export type OpcionesExportar = {
	nombre: string;
	video: {
		activo: boolean;
		resolucion: ResolucionId;
		tasa: TasaId;
		personalizadaMbps: number;
		modoTasa: ModoTasa;
		codec: CodecId;
		formato: FormatoId;
		cuadros: CuadrosId;
	};
	audio: { activo: boolean; formato: FormatoAudioId };
	subtitulos: { activo: boolean; formato: FormatoSubtituloId };
	gif: { activo: boolean; resolucion: ResolucionGifId };
};

// ── El pie: duración y tamaño estimado ──────────────────────────────────────

/** «11s», «1m 20s», «1h 2m 5s»: como el pie de CapCut. */
export function formatoDuracion(segundos: number): string {
	const total = Math.max(0, Math.round(segundos));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function formatoTamano(bytes: number): string {
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	if (bytes >= 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Bytes estimados de todo lo marcado. El video es exacto en la tasa (VBR la
 * respeta en promedio); el GIF es una cuenta gruesa (≈0,3 bytes por píxel y
 * cuadro con LZW sobre 256 colores), suficiente para el «alrededor de».
 */
export function estimarBytes({
	opciones,
	segundos,
	lienzo,
	hayAudio,
}: {
	opciones: OpcionesExportar;
	segundos: number;
	lienzo: { width: number; height: number };
	hayAudio: boolean;
}): number {
	let bits = 0;
	const v = opciones.video;
	if (v.activo) {
		bits += tasaDeBits({
			resolucion: v.resolucion,
			fps: valorCuadros(v.cuadros),
			codec: v.codec,
			tasa: v.tasa,
			personalizadaMbps: v.personalizadaMbps,
		}) * segundos;
		if (hayAudio) bits += AUDIO_BITRATE * segundos;
	}
	if (opciones.audio.activo && hayAudio) {
		const kbps = opciones.audio.formato === "wav" ? 1411_200 : AUDIO_BITRATE;
		bits += kbps * segundos;
	}
	let bytes = bits / 8;
	if (opciones.gif.activo && segundos <= GIF_MAX_SEGUNDOS) {
		const lado = RESOLUCIONES_GIF.find((r) => r.id === opciones.gif.resolucion)?.lado ?? 320;
		const corto = Math.max(1, Math.min(lienzo.width, lienzo.height));
		const pixeles = (lienzo.width * lado / corto) * (lienzo.height * lado / corto);
		bytes += pixeles * 0.3 * GIF_FPS * segundos;
	}
	return bytes;
}

// ── Qué puede codificar ESTE navegador ──────────────────────────────────────

/**
 * La cadena de codec de H.264 con el NIVEL que pide el tamaño Y los cuadros por
 * segundo. mediabunny elige el nivel sólo por tamaño y tasa (`buildVideoCodecString`
 * no mira los fps): 1080p60 le sale nivel 4.0, que tope en 245.760 macrobloques
 * por segundo y 1080p60 son 489.600. Un codificador estricto lo rechaza.
 */
export function cadenaAvc({
	width,
	height,
	fps,
	bitrate,
}: {
	width: number;
	height: number;
	fps: number;
	bitrate: number;
}): string {
	const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
	const mbps = mbs * fps;
	// Tabla A-1 de H.264 (MaxFS, MaxMBPS, MaxBR); el perfil High admite ×1,25 de tasa.
	const niveles = [
		{ nivel: 0x1e, fs: 1620, mbps: 40_500, br: 10_000_000 },
		{ nivel: 0x1f, fs: 3600, mbps: 108_000, br: 14_000_000 },
		{ nivel: 0x20, fs: 5120, mbps: 216_000, br: 20_000_000 },
		{ nivel: 0x28, fs: 8192, mbps: 245_760, br: 20_000_000 },
		{ nivel: 0x29, fs: 8192, mbps: 245_760, br: 50_000_000 },
		{ nivel: 0x2a, fs: 8704, mbps: 522_240, br: 50_000_000 },
		{ nivel: 0x32, fs: 22_080, mbps: 589_824, br: 135_000_000 },
		{ nivel: 0x33, fs: 36_864, mbps: 983_040, br: 240_000_000 },
		{ nivel: 0x34, fs: 36_864, mbps: 2_073_600, br: 240_000_000 },
		{ nivel: 0x3c, fs: 139_264, mbps: 4_177_920, br: 240_000_000 },
		{ nivel: 0x3d, fs: 139_264, mbps: 8_355_840, br: 480_000_000 },
		{ nivel: 0x3e, fs: 139_264, mbps: 16_711_680, br: 800_000_000 },
	];
	const elegido =
		niveles.find((n) => mbs <= n.fs && mbps <= n.mbps && bitrate <= n.br * 1.25) ??
		niveles[niveles.length - 1];
	return `avc1.6400${elegido.nivel.toString(16).padStart(2, "0")}`;
}

export type SoporteCodec = { soportado: boolean; cadena?: string };

/**
 * Pregunta a WebCodecs (`VideoEncoder.isConfigSupported`, por dentro de
 * `canEncodeVideo`) si puede codificar cada codec con ESTE tamaño, tasa y fps.
 * HEVC y AV1 dependen de la placa de video: sin esto, la exportación falla a
 * mitad de camino en vez de no ofrecerse.
 */
export async function soporteCodecs({
	width,
	height,
	fps,
	bitrate,
}: {
	width: number;
	height: number;
	fps: number;
	bitrate: number;
}): Promise<Record<CodecId, SoporteCodec>> {
	const quality = new Quality({ bitrate });
	const probar = async (codec: "avc" | "hevc" | "av1" | "vp9", fullCodecString?: string) => {
		try {
			return await canEncodeVideo(codec, { width, height, frameRate: fps, quality, fullCodecString });
		} catch {
			return false;
		}
	};
	const avcPropia = cadenaAvc({ width, height, fps, bitrate });
	const [avcConNivel, avc, hevc, av1, vp9] = await Promise.all([
		probar("avc", avcPropia),
		probar("avc"),
		probar("hevc"),
		probar("av1"),
		probar("vp9"),
	]);
	return {
		// Con el nivel correcto si el codificador lo acepta; si no, el de mediabunny.
		avc: avcConNivel ? { soportado: true, cadena: avcPropia } : { soportado: avc },
		hevc: { soportado: hevc },
		av1: { soportado: av1 },
		vp9: { soportado: vp9 },
		prores: { soportado: false },
	};
}

export async function soporteAudio(): Promise<{ aac: boolean; opus: boolean }> {
	const probar = async (codec: "aac" | "opus") => {
		try {
			// 44,1 kHz estéreo: es lo que arma createTimelineAudioBuffer (EXPORT_SAMPLE_RATE).
			return await canEncodeAudio(codec, {
				numberOfChannels: 2,
				sampleRate: 44_100,
				quality: new Quality({ bitrate: AUDIO_BITRATE }),
			});
		} catch {
			return false;
		}
	};
	const [aac, opus] = await Promise.all([probar("aac"), probar("opus")]);
	return { aac, opus };
}
