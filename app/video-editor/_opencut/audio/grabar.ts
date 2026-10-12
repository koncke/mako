// =============================================================================
// «Grabar» (voz superpuesta): el micrófono a una pista de audio en el cabezal
// =============================================================================
// El botón del micrófono a la derecha de la barra de la línea de tiempo
// (relevamiento-capcut-armazon §6.2). Como CapCut: «Entrada» (el micrófono),
// «Reducción del eco», «Silenciar el proyecto», cuenta regresiva de 3, y
// mientras graba el proyecto se reproduce desde el cabezal para hablar encima.
// Al detener, el audio entra a la biblioteca como un medio más y queda en una
// pista de audio en el instante donde empezó, con el nombre «Voz superpuesta»
// (`pc_new_voiceover`).
//
// El estado vive en un store (no en el componente): si la barra se re-dibuja o
// el menú se cierra, la grabación sigue.

import { create } from "zustand";
import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { importarArchivos } from "@/app/video-editor/_opencut/media/importar";
import { buildElementFromMedia } from "@/app/video-editor/_opencut/timeline/element-utils";
import { mediaTimeFromSeconds, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import { wavDeCanales } from "./wav";

export type FaseGrabacion = "inactiva" | "pidiendo" | "cuenta" | "grabando" | "guardando";

const CUENTA_S = 3;
const MINIMO_S = 0.5;
export const NOMBRE_GRABACION = "Voz superpuesta";

type Estado = {
	fase: FaseGrabacion;
	cuenta: number;
	/** Segundos grabados (se actualiza mientras graba). */
	transcurrido: number;
	/** Nivel de entrada 0–1, para el vúmetro. */
	nivel: number;
	dispositivos: Array<{ id: string; nombre: string }>;
	dispositivo: string;
	reducirEco: boolean;
	silenciarProyecto: boolean;
	fijar: (cambio: Partial<Pick<Estado, "dispositivo" | "reducirEco" | "silenciarProyecto">>) => void;
};

export const useGrabacion = create<Estado>()((set) => ({
	fase: "inactiva",
	cuenta: 0,
	transcurrido: 0,
	nivel: 0,
	dispositivos: [],
	dispositivo: "",
	reducirEco: true,
	silenciarProyecto: false,
	fijar: (cambio) => set(cambio),
}));

// ── Lo que no va al store (no se dibuja) ─────────────────────────────────────

type Sesion = {
	stream: MediaStream;
	medidor: AudioContext | null;
	cuadroNivel: number | null;
	grabador: MediaRecorder | null;
	trozos: Blob[];
	inicioMs: number;
	reloj: number | null;
	cuentaTimer: number | null;
	cabezal: MediaTime;
	estabaSilenciado: boolean;
};

let sesion: Sesion | null = null;

const fase = () => useGrabacion.getState().fase;
const fijar = (cambio: Partial<Estado>) => useGrabacion.setState(cambio);

/** Los micrófonos (con nombre sólo después del permiso, por privacidad del navegador). */
export async function cargarDispositivos(): Promise<void> {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
	try {
		const lista = await navigator.mediaDevices.enumerateDevices();
		const entradas = lista
			.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
			.map((d, i) => ({ id: d.deviceId, nombre: d.label || `Micrófono ${i + 1}` }));
		fijar({ dispositivos: entradas });
	} catch {
		// Sin lista no se puede elegir, pero se graba con el predeterminado.
	}
}

function mensajeDeError(error: unknown): string {
	const nombre = (error as { name?: string } | null)?.name;
	// Los textos de CapCut: `pc_Insufficient_microphone_access`,
	// `pc_no_microphone_detected`, `pc_microphone_occupied_another_application`.
	if (nombre === "NotAllowedError" || nombre === "SecurityError") return "No hay acceso al micrófono";
	if (nombre === "NotFoundError" || nombre === "OverconstrainedError") return "No se detectó el micrófono";
	if (nombre === "NotReadableError")
		return "El micrófono está ocupado por otra aplicación. Es necesario que primero salgas de la aplicación.";
	return "No se pudo grabar";
}

function tipoDeGrabacion(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	for (const tipo of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
		if (MediaRecorder.isTypeSupported(tipo)) return tipo;
	}
	return undefined;
}

function medirNivel(s: Sesion) {
	try {
		const ctx = new AudioContext();
		const analizador = ctx.createAnalyser();
		analizador.fftSize = 1024;
		ctx.createMediaStreamSource(s.stream).connect(analizador);
		s.medidor = ctx;
		const datos = new Float32Array(analizador.fftSize);
		const paso = () => {
			if (sesion !== s) return;
			analizador.getFloatTimeDomainData(datos);
			let pico = 0;
			for (const v of datos) pico = Math.max(pico, Math.abs(v));
			// En dB, de −60 a 0, como un vúmetro.
			const db = 20 * Math.log10(Math.max(pico, 1e-6));
			fijar({ nivel: Math.max(0, Math.min(1, (db + 60) / 60)) });
			s.cuadroNivel = requestAnimationFrame(paso);
		};
		paso();
	} catch {
		// Sin vúmetro se graba igual.
	}
}

function cerrarSesion() {
	const s = sesion;
	sesion = null;
	if (!s) return;
	if (s.cuadroNivel !== null) cancelAnimationFrame(s.cuadroNivel);
	if (s.reloj !== null) window.clearInterval(s.reloj);
	if (s.cuentaTimer !== null) window.clearTimeout(s.cuentaTimer);
	for (const pista of s.stream.getTracks()) pista.stop();
	void s.medidor?.close().catch(() => {});
	fijar({ nivel: 0, cuenta: 0 });
}

/** Clic en el botón rojo: pide el micrófono y arranca la cuenta regresiva. */
export async function empezarGrabacion(editor: EditorCore): Promise<void> {
	if (fase() !== "inactiva") return;
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !tipoDeGrabacion()) {
		toast.error("No se pudo grabar");
		return;
	}
	const { dispositivo, reducirEco } = useGrabacion.getState();
	fijar({ fase: "pidiendo", transcurrido: 0 });
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: dispositivo ? { exact: dispositivo } : undefined,
				echoCancellation: reducirEco,
				// La voz tal cual: «Reducir el ruido» se aplica después, si se pide.
				noiseSuppression: false,
				autoGainControl: false,
			},
		});
	} catch (error) {
		fijar({ fase: "inactiva" });
		toast.error(mensajeDeError(error));
		return;
	}
	if (fase() !== "pidiendo") {
		for (const pista of stream.getTracks()) pista.stop();
		return;
	}
	sesion = {
		stream,
		medidor: null,
		cuadroNivel: null,
		grabador: null,
		trozos: [],
		inicioMs: 0,
		reloj: null,
		cuentaTimer: null,
		cabezal: editor.playback.getCurrentTime(),
		estabaSilenciado: editor.playback.isMuted(),
	};
	void cargarDispositivos();
	medirNivel(sesion);

	const s = sesion;
	const contar = (n: number) => {
		if (sesion !== s) return;
		if (n === 0) {
			arrancar(editor, s);
			return;
		}
		fijar({ fase: "cuenta", cuenta: n });
		s.cuentaTimer = window.setTimeout(() => contar(n - 1), 1000);
	};
	contar(CUENTA_S);
}

function arrancar(editor: EditorCore, s: Sesion) {
	const tipo = tipoDeGrabacion();
	let grabador: MediaRecorder;
	try {
		grabador = new MediaRecorder(s.stream, tipo ? { mimeType: tipo } : undefined);
	} catch (error) {
		cerrarSesion();
		fijar({ fase: "inactiva" });
		toast.error(mensajeDeError(error));
		return;
	}
	s.grabador = grabador;
	grabador.ondataavailable = (e) => {
		if (e.data.size > 0) s.trozos.push(e.data);
	};
	// El cabezal del instante en que arranca de verdad (la cuenta pudo durar
	// mientras alguien lo movía).
	s.cabezal = editor.playback.getCurrentTime();
	if (useGrabacion.getState().silenciarProyecto && !s.estabaSilenciado) editor.playback.mute();
	grabador.start(250);
	s.inicioMs = performance.now();
	if (editor.timeline.getTotalDuration() > s.cabezal) editor.playback.play();
	fijar({ fase: "grabando", cuenta: 0, transcurrido: 0 });
	s.reloj = window.setInterval(() => {
		fijar({ transcurrido: (performance.now() - s.inicioMs) / 1000 });
	}, 100);
}

/** Cancela la cuenta regresiva (antes de grabar nada). */
export function cancelarGrabacion(): void {
	if (fase() !== "cuenta" && fase() !== "pidiendo") return;
	cerrarSesion();
	fijar({ fase: "inactiva" });
}

/** Clic en el botón mientras graba: detiene, guarda y pone el clip. */
export async function detenerGrabacion(editor: EditorCore): Promise<void> {
	const s = sesion;
	if (!s || fase() !== "grabando" || !s.grabador) return;
	const grabador = s.grabador;
	const terminado = new Promise<void>((r) => {
		grabador.onstop = () => r();
	});
	grabador.stop();
	editor.playback.pause();
	if (useGrabacion.getState().silenciarProyecto && !s.estabaSilenciado) editor.playback.unmute();
	fijar({ fase: "guardando" });
	await terminado;
	const segundos = (performance.now() - s.inicioMs) / 1000;
	const trozos = s.trozos;
	const tipo = grabador.mimeType || tipoDeGrabacion() || "audio/webm";
	const cabezal = s.cabezal;
	cerrarSesion();

	try {
		if (segundos < MINIMO_S) {
			toast.error(`La grabación debe durar al menos ${MINIMO_S} s`);
			return;
		}
		const comprimido = new Blob(trozos, { type: tipo });
		const ctx = new OfflineAudioContext(1, 1, 48000);
		const audio = await ctx.decodeAudioData(await comprimido.arrayBuffer());
		const canales = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, c) =>
			audio.getChannelData(c),
		);
		// Un micrófono «estéreo» suele traer el mismo canal dos veces: mono pesa la mitad.
		const iguales = canales.length === 2 && canales[0].every((v, i) => v === canales[1][i]);
		const wav = wavDeCanales(iguales ? [canales[0]] : canales, audio.sampleRate);
		const previas = editor.media
			.getAssets()
			.filter((a) => a.name.startsWith(NOMBRE_GRABACION)).length;
		const archivo = new File([wav], `${NOMBRE_GRABACION} ${previas + 1}.wav`, { type: "audio/wav" });
		const [asset] = await importarArchivos({ editor, files: [archivo] });
		if (!asset) throw new Error("no se importó la grabación");
		const elemento = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: "audio",
			name: NOMBRE_GRABACION,
			duration: mediaTimeFromSeconds({ seconds: asset.duration ?? audio.duration }),
			startTime: cabezal,
		});
		editor.timeline.insertElement({ element: elemento, placement: { mode: "auto", trackType: "audio" } });
	} catch (error) {
		console.error("[grabar]", error);
		toast.error("No se pudo grabar");
	} finally {
		fijar({ fase: "inactiva", transcurrido: 0 });
	}
}

/** Si el editor se cierra grabando, se suelta el micrófono. */
export function soltarMicrofono(): void {
	if (sesion?.grabador && sesion.grabador.state !== "inactive") sesion.grabador.stop();
	cerrarSesion();
	fijar({ fase: "inactiva", transcurrido: 0 });
}
