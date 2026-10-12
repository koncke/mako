// =============================================================================
// Las claves de AUDIO en `element.params`, y cómo se leen
// =============================================================================
// El audio de CapCut (relevamiento-capcut-funciones §3) se guarda en los params
// del clip de audio o de video, con el prefijo `audio.` (el respaldo del panel y
// «Extraer audio» reconocen el audio por ese prefijo). Este módulo no importa
// nada del motor: lo leen el render del audio (core/managers/audio-manager.ts,
// media/audio.ts), la ganancia del clip (timeline/audio-state.ts), el imán y los
// tests, sin arrastrar el WASM.
//
// Declarados en params/extra/audio.ts (son un AJUSTE: entran en los defaults de
// un clip nuevo y viajan con «Pegar atributos», que pega sólo lo declarado):
//   audio.fundidoEntrada / audio.fundidoSalida   segundos (contrato con D, que
//        dibuja los círculos sobre el clip)
//   audio.normalizarObjetivo ("-23" | "-12" | "-14")
//   audio.reducirRuido (sí/no)
//   audio.voz (id del filtro) + audio.voz.<parámetro> (0–100)
//
// SIN declarar (son del ARCHIVO del clip: pegados en otro clip mentirían):
//   audio.normalizar      la casilla. Va con su medida: pegada sola quedaría
//                         marcada sin sonar distinto (sin medida no suma nada)
//   audio.intensidad      la sonoridad medida del tramo, en LUFS (el
//                         `avg_loudness` del borrador de CapCut)
//   audio.ritmos          los ritmos automáticos, en segundos de la FUENTE
//                         («1.25,1.75,…»): recortar el clip no los corre
//   audio.ritmosManuales  los de «Agregar ritmo», igual
//   audio.ritmosModo      "1" | "2" (Ritmo 1 / Ritmo 2), el último pedido
//   audio.extraidoDe      en el audio que sale de «Extraer audio»: el id del
//                         clip de video. «Recuperar audio» lo borra por esta marca

import type { ParamValues } from "@/app/video-editor/_opencut/params";

export const FUNDIDO_ENTRADA = "audio.fundidoEntrada";
export const FUNDIDO_SALIDA = "audio.fundidoSalida";
export const NORMALIZAR = "audio.normalizar";
export const NORMALIZAR_OBJETIVO = "audio.normalizarObjetivo";
export const INTENSIDAD_MEDIDA = "audio.intensidad";
export const REDUCIR_RUIDO = "audio.reducirRuido";
export const VOZ = "audio.voz";
export const RITMOS = "audio.ritmos";
export const RITMOS_MANUALES = "audio.ritmosManuales";
export const RITMOS_MODO = "audio.ritmosModo";
export const EXTRAIDO_DE = "audio.extraidoDe";

/** Las perillas del Modificador de voz (rótulos del es-LA.po, `change_voice_param_*`). */
export const PERILLAS_VOZ = [
	{ id: "tono", etiqueta: "Tono" },
	{ id: "timbre", etiqueta: "Timbre" },
	{ id: "fuerza", etiqueta: "Fuerza" },
	{ id: "habitacion", etiqueta: "Tamaño de la habitación" },
	{ id: "profundidad", etiqueta: "Profundidad" },
	{ id: "frecuencia", etiqueta: "Frecuencia" },
	{ id: "ruido", etiqueta: "Ruido" },
	{ id: "cantidad", etiqueta: "Cantidad" },
] as const;
export type PerillaVoz = (typeof PERILLAS_VOZ)[number]["id"];
export const clavePerilla = (perilla: PerillaVoz) => `${VOZ}.${perilla}`;

/** «Intensidad objetivo» (`pc_loudness_*`), en el orden de CapCut. */
export const OBJETIVOS_INTENSIDAD = [
	{ id: "-23", etiqueta: "Predeterminado (-23 LUFS)" },
	{ id: "-12", etiqueta: "TikTok (-12 LUFS)" },
	{ id: "-14", etiqueta: "YouTube (-14 LUFS)" },
] as const;
export const OBJETIVO_PREDETERMINADO = "-23";

const numero = (params: ParamValues, clave: string): number => {
	const v = params[clave];
	return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

// ── Fundidos ─────────────────────────────────────────────────────────────────

export type Fundidos = { entrada: number; salida: number };

/** Los fundidos del clip en segundos, acotados a su duración (sin superponerse). */
export function leerFundidos(params: ParamValues, duracion: number): Fundidos {
	const entrada = Math.min(Math.max(0, numero(params, FUNDIDO_ENTRADA)), Math.max(0, duracion));
	const salida = Math.min(Math.max(0, numero(params, FUNDIDO_SALIDA)), Math.max(0, duracion - entrada));
	return { entrada, salida };
}

export const tieneFundidos = (f: Fundidos) => f.entrada > 0 || f.salida > 0;

/**
 * Al DIVIDIR: la mitad izquierda se queda con la aparición y la derecha con la
 * desaparición, como las animaciones de entrada/salida (animaciones/reglas.ts).
 * Si las dos conservaran los dos fundidos, el corte del medio bajaría y volvería
 * a subir el volumen sin que nadie lo pida. Lo usa
 * commands/timeline/element/split-elements.ts.
 */
export function sinFundidoSalida(params: ParamValues): ParamValues {
	return numero(params, FUNDIDO_SALIDA) > 0 ? { ...params, [FUNDIDO_SALIDA]: 0 } : params;
}

export function sinFundidoEntrada(params: ParamValues): ParamValues {
	return numero(params, FUNDIDO_ENTRADA) > 0 ? { ...params, [FUNDIDO_ENTRADA]: 0 } : params;
}

/**
 * El factor de los fundidos en el instante `t` del clip (segundos). Lineal en
 * amplitud: lo mismo calcula la mezcla del export muestra a muestra y lo mismo
 * programa la reproducción con rampas lineales (audio-manager), así que suenan
 * igual.
 */
export function factorFundido(t: number, duracion: number, f: Fundidos): number {
	if (t <= 0 && f.entrada > 0) return 0;
	let factor = 1;
	if (f.entrada > 0 && t < f.entrada) factor = Math.min(factor, t / f.entrada);
	const restante = duracion - t;
	if (f.salida > 0 && restante < f.salida) factor = Math.min(factor, Math.max(0, restante) / f.salida);
	return Math.max(0, Math.min(1, factor));
}

/**
 * Los puntos donde cambia la pendiente del fundido, desde `desde` hasta el final
 * del clip: entre dos puntos seguidos el factor es lineal, así que una rampa
 * lineal de WebAudio entre ellos lo reproduce EXACTO.
 */
export function puntosFundido(
	desde: number,
	duracion: number,
	f: Fundidos,
): Array<{ t: number; factor: number }> {
	const cortes = new Set<number>([desde, duracion]);
	if (f.entrada > 0) cortes.add(f.entrada);
	if (f.salida > 0) cortes.add(duracion - f.salida);
	return [...cortes]
		.filter((t) => t >= desde && t <= duracion)
		.sort((a, b) => a - b)
		.map((t) => ({ t, factor: factorFundido(t, duracion, f) }));
}

// ── Normalizar la intensidad ────────────────────────────────────────────────

/** Tope de lo que puede subir la normalización (un clip casi mudo no se lleva a −14). */
const NORMALIZAR_MAX_DB = 20;
const NORMALIZAR_MIN_DB = -40;

/** Los dB que suma «Normalizar la intensidad», o 0 si está apagada o sin medir. */
export function dbNormalizacion(params: ParamValues): number {
	if (params[NORMALIZAR] !== true) return 0;
	const medida = params[INTENSIDAD_MEDIDA];
	if (typeof medida !== "number" || !Number.isFinite(medida)) return 0;
	const objetivo = Number(params[NORMALIZAR_OBJETIVO] ?? OBJETIVO_PREDETERMINADO);
	const db = (Number.isFinite(objetivo) ? objetivo : -23) - medida;
	return Math.max(NORMALIZAR_MIN_DB, Math.min(NORMALIZAR_MAX_DB, db));
}

/** La ganancia lineal de la normalización (1 si no hay). */
export function gananciaNormalizacion(params: ParamValues): number {
	const db = dbNormalizacion(params);
	return db === 0 ? 1 : 10 ** (db / 20);
}

// ── Lo que pide procesar el clip entero ──────────────────────────────────────

export type AjustesVoz = { id: string; perillas: Partial<Record<PerillaVoz, number>> };

export function leerVoz(params: ParamValues): AjustesVoz | null {
	const id = params[VOZ];
	if (typeof id !== "string" || id === "" || id === "original") return null;
	const perillas: Partial<Record<PerillaVoz, number>> = {};
	for (const { id: p } of PERILLAS_VOZ) {
		const v = params[clavePerilla(p)];
		if (typeof v === "number" && Number.isFinite(v)) perillas[p] = v;
	}
	return { id, perillas };
}

/**
 * Lo que obliga a procesar el clip ENTERO antes de sonar (reducir el ruido, el
 * modificador de voz). La reproducción lo manda por el búfer preparado y la
 * mezcla del export lo procesa igual, con la misma función (audio/cadena.ts).
 * `null` = nada que procesar.
 */
export function claveProcesado(params: ParamValues): string | null {
	const ruido = params[REDUCIR_RUIDO] === true;
	const voz = leerVoz(params);
	if (!ruido && !voz) return null;
	return JSON.stringify({ ruido, voz });
}

// ── Ritmos ───────────────────────────────────────────────────────────────────

export function leerLista(params: ParamValues, clave: string): number[] {
	const v = params[clave];
	if (typeof v !== "string" || v === "") return [];
	return v
		.split(",")
		.map(Number)
		.filter((n) => Number.isFinite(n) && n >= 0);
}

export function escribirLista(tiempos: readonly number[]): string {
	return [...new Set(tiempos.map((t) => Math.round(t * 1000) / 1000))]
		.sort((a, b) => a - b)
		.join(",");
}

/** Todos los ritmos del clip (automáticos + manuales), en segundos de la fuente. */
export function ritmosDeFuente(params: ParamValues): number[] {
	return [...leerLista(params, RITMOS), ...leerLista(params, RITMOS_MANUALES)].sort((a, b) => a - b);
}
