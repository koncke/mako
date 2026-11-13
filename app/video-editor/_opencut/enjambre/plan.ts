// =============================================================================
// enjambre/plan — la «Edición automática»: qué hace cada agente, decidido por el CÓDIGO
// =============================================================================
// Pedido de Martín (9/11/2026), con un reel de referencia: «PARA LA EDICIÓN EN MAKO, ESTO QUIERO». El reel muestra
// un editor de reels donde un ENJAMBRE de agentes edita en vivo: cada uno con su nombre y su color («razor-02»,
// «caps-01», «broll-01», «mix-01»…), su cursor moviéndose por la pantalla y un registro de actividad con la hora del
// video donde actuó («02:18 razor-02 removed breath»). Acá se copia eso con lo que el editor YA sabe hacer: cada
// agente corre una operación real del chat «Editar con IA» o de un botón (borrar pausas, subtitular, sacar muletillas,
// resaltar palabras clave, B-roll, cambios de plano, limpiar la voz, normalizar el volumen) y una revisión final.
//
// Lo que decide este módulo, sin el editor y sin el WASM (lo prueba tests/video-editor-enjambre.test.ts):
//   · los agentes, su nombre y su color (los del reel, en castellano);
//   · el orden de los pasos y, para cada uno, si va o se saltea y por qué, mirando la línea de tiempo de ESE momento
//     (cada paso cambia lo que ve el siguiente: los subtítulos se generan DESPUÉS de cortar las pausas);
//   · la revisión final («QA ✓»), con chequeos que se pueden medir en la línea de tiempo;
//   · el registro de actividad: la hora del video de cada renglón y las operaciones por segundo.
//
// Nada se inventa: un renglón del registro es algo que pasó (AGENTS.md, «Lo que MaKo construye se ve
// CONSTRUYÉNDOSE»: lo que se muestra es lo que se armó, en el orden en que se armó).
// =============================================================================

import type { OperacionChat } from "@/lib/editor-video/chat-catalogo";
import type { EdicionDeReceta } from "@/lib/video-recetas";
import { NO_ENCONTRE } from "@/app/video-editor/_opencut/audio/silencios-aviso";
import { MOTIVO_SUBTITULOS } from "@/app/video-editor/_opencut/subtitles/resultado";
import { NO_HAY_MULETILLAS } from "@/app/video-editor/_opencut/transcripcion/modelo";

// ── Los agentes ──────────────────────────────────────────────────────────────

export type AgenteId = "corte-01" | "corte-02" | "subs-01" | "subs-02" | "subs-03" | "broll-01" | "gfx-01" | "mezcla-01" | "mezcla-02" | "qa-01";

export type Agente = {
	id: AgenteId;
	/** Lo que hace, en una o dos palabras (la barra del panel y el título del cursor). */
	rol: string;
	/** El color de su etiqueta y su cursor. Es su identidad, como el de un avatar: va en hex. */
	color: string;
};

/** Los colores salen del reel: ámbar para los cortes, rosa y violeta para los subtítulos, lima para el B-roll… */
export const AGENTES: readonly Agente[] = [
	{ id: "corte-01", rol: "Pausas", color: "#ffb02e" },
	{ id: "subs-01", rol: "Subtítulos", color: "#ff6ad5" },
	{ id: "subs-03", rol: "Estilo", color: "#5ec8ff" },
	{ id: "corte-02", rol: "Muletillas", color: "#ffd23f" },
	{ id: "subs-02", rol: "Palabras clave", color: "#8f7dff" },
	{ id: "broll-01", rol: "B-roll", color: "#c8f53c" },
	{ id: "gfx-01", rol: "Planos", color: "#ff7a3c" },
	{ id: "mezcla-01", rol: "Voz limpia", color: "#ff5470" },
	{ id: "mezcla-02", rol: "Volumen", color: "#2dd4bf" },
	{ id: "qa-01", rol: "Revisión", color: "#4ade80" },
];

export const agentePorId = (id: AgenteId): Agente => AGENTES.find((a) => a.id === id) ?? AGENTES[0];

/** El lima del reel: el color de las palabras clave que resalta subs-02 («appear» en el reel). */
export const LIMA = "#c8f53c";

/** «Volumen»: la intensidad del reel («INTEGRATED −14.1 LUFS»), el objetivo «youtube» del editor (−14). */
export const OBJETIVO_VOLUMEN = "youtube" as const;

// ── Los pasos ────────────────────────────────────────────────────────────────

export type PasoId = "pausas" | "subtitulos" | "estilo" | "muletillas" | "claves" | "broll" | "planos" | "ruido" | "volumen" | "revision";

export type Paso = { id: PasoId; agente: AgenteId; titulo: string };

/**
 * En ESTE orden, y por qué: primero se corta (las pausas), después se transcribe lo que quedó (los subtítulos nacen
 * con los tiempos del video ya cortado), después se corta por texto (las muletillas, que cortan video y subtítulo
 * juntos), después se marcan las palabras clave y el B-roll (que lee las frases de los subtítulos) y al final el
 * sonido y la revisión.
 */
export const PASOS: readonly Paso[] = [
	{ id: "pausas", agente: "corte-01", titulo: "Quitar las pausas" },
	{ id: "subtitulos", agente: "subs-01", titulo: "Subtitular" },
	{ id: "estilo", agente: "subs-03", titulo: "Probar estilos de subtítulo" },
	{ id: "muletillas", agente: "corte-02", titulo: "Sacar las muletillas" },
	{ id: "claves", agente: "subs-02", titulo: "Resaltar las palabras clave" },
	{ id: "broll", agente: "broll-01", titulo: "Proponer B-roll" },
	{ id: "planos", agente: "gfx-01", titulo: "Cambios de plano" },
	{ id: "ruido", agente: "mezcla-01", titulo: "Limpiar la voz" },
	{ id: "volumen", agente: "mezcla-02", titulo: "Normalizar el volumen" },
	{ id: "revision", agente: "qa-01", titulo: "Revisión final" },
];

export const pasoPorId = (id: PasoId): Paso => PASOS.find((p) => p.id === id) ?? PASOS[0];

/**
 * La pastilla de la barra de arriba (el «16 agents live» del reel). Trabajan de a UNO (dos comandos a la vez sobre la
 * misma línea de tiempo se pisan), así que dice cuál va y en qué paso: «en vivo · Subtítulos · paso 2 de 10». Hasta el
 * 10/11/2026 decía «10 agentes en vivo», que afirmaba diez trabajando a la vez (revisión del 9/11/2026).
 */
export function textoPastilla(paso: PasoId | null): string {
	const i = paso ? PASOS.findIndex((p) => p.id === paso) : -1;
	if (i < 0) return "en vivo";
	return `en vivo · ${agentePorId(PASOS[i].agente).rol} · paso ${i + 1} de ${PASOS.length}`;
}

// ── Lo que se mira de la línea de tiempo ─────────────────────────────────────

/** Lo que el plan lee de cada elemento: la forma de `RefElemento` de chat/linea.ts, sin lo que no usa. */
export type ElementoParaPlan = {
	ref: string;
	/** El id del elemento en el motor: no cambia entre una lectura y otra (la ref puede correrse). */
	elementId?: string;
	tipo: string;
	titulo: string;
	inicio: number;
	fin: number;
	bloqueada: boolean;
	principal: boolean;
	subtitulo?: boolean;
	texto?: string;
	claves?: string[];
	estado: { ruido?: boolean; normalizado?: string | null; sinAudio?: boolean };
};

export type ClipConVoz = { ref: string; id: string; titulo: string; inicio: number; fin: number; ruido: boolean; normalizado: string | null };

export type EstadoLinea = {
	/** Los clips de la pista principal con sonido (video o audio), sin bloquear: sobre ellos trabaja el sonido. */
	conVoz: ClipConVoz[];
	/** Los subtítulos, en orden. */
	subtitulos: Array<{ ref: string; texto: string; inicio: number; fin: number; claves: string[] }>;
	/** Los subtítulos tienen el tiempo de cada palabra (los de «Subtítulos automáticos»): sin eso no hay muletillas. */
	conPalabras: boolean;
	/** La pista principal, en orden: para los huecos de la revisión. */
	principal: Array<{ inicio: number; fin: number }>;
	/** Segundos. */
	duracion: number;
	/**
	 * El estilo de los subtítulos lo puede elegir el agente: los puso esta misma corrida con la plantilla por defecto.
	 * Si la persona eligió una plantilla o un preset de su marca, o ya tenía subtítulos, el estilo es suyo.
	 */
	estiloLibre: boolean;
	/** Dónde empieza cada propuesta de B-roll o de plano que la persona todavía no dejó ni sacó (broll/pistas.ts). */
	propuestas: number[];
};

/** Lo que el plan necesita saber de la línea de tiempo de ESTE momento. */
export function estadoDeLinea(
	elementos: Iterable<ElementoParaPlan>,
	{ conPalabras, estiloLibre = false, propuestas = [] }: { conPalabras: boolean; estiloLibre?: boolean; propuestas?: number[] },
): EstadoLinea {
	const todos = [...elementos];
	const conVoz = todos
		.filter((e) => e.principal && !e.bloqueada && (e.tipo === "video" || e.tipo === "audio") && !e.estado.sinAudio)
		.sort((a, b) => a.inicio - b.inicio)
		.map((e) => ({ ref: e.ref, id: e.elementId ?? e.ref, titulo: e.titulo, inicio: e.inicio, fin: e.fin, ruido: e.estado.ruido === true, normalizado: e.estado.normalizado ?? null }));
	const subtitulos = todos
		.filter((e) => e.subtitulo)
		.sort((a, b) => a.inicio - b.inicio)
		.map((e) => ({ ref: e.ref, texto: (e.texto ?? e.titulo).replace(/\s+/g, " ").trim(), inicio: e.inicio, fin: e.fin, claves: e.claves ?? [] }));
	const principal = todos
		.filter((e) => e.principal)
		.sort((a, b) => a.inicio - b.inicio)
		.map((e) => ({ inicio: e.inicio, fin: e.fin }));
	const duracion = todos.reduce((m, e) => Math.max(m, e.fin), 0);
	return { conVoz, subtitulos, conPalabras, principal, duracion, estiloLibre, propuestas: [...propuestas].sort((a, b) => a - b) };
}

/**
 * Qué hace un paso con la línea de tiempo de ahora: las operaciones del chat que corre (las aplica chat/aplicar.ts con
 * el mismo «Aceptar» del chat), «directo» para lo que corre su propia función (el B-roll), o por qué se saltea.
 */
export type Decision =
	| { hace: true; operaciones: OperacionChat[] }
	| { hace: true; directo: true }
	| { hace: false; porque: string };

const SIN_VOZ = "no hay un video con sonido en la pista principal";

/**
 * `receta` (12/11/2026): la de un proyecto replicado (lib/video-recetas.ts → `editor`). Probando la tab entera, la
 * Edición automática de «La palabra clave gigante» dejó las claves en lima y del mismo tamaño que el resto: ahora la
 * receta manda en la pausa que se borra, si hay subtítulos, su estilo (correr.ts) y el tamaño y color de las claves.
 */
export function decidirPaso(paso: PasoId, e: EstadoLinea, receta: EdicionDeReceta | null = null): Decision {
	const voz = e.conVoz.length > 0;
	switch (paso) {
		case "pausas":
			if (!voz) return { hace: false, porque: SIN_VOZ };
			// Los tiempos por palabra de los subtítulos no se mueven con un corte de la principal (chat/linea.ts): cortar las
			// pausas debajo de unos subtítulos que ya estaban los desfasa, y después las muletillas cortarían otra parte.
			if (e.subtitulos.length) return { hace: false, porque: "ya tiene subtítulos: cortar las pausas los desfasaría (usa «Borrar silencios» antes de subtitular)" };
			return { hace: true, operaciones: [{ op: "borrar_silencios", ...(receta?.pausaMinima ? { pausa_min: receta.pausaMinima } : {}) }] };
		case "subtitulos":
			if (!voz) return { hace: false, porque: SIN_VOZ };
			if (e.subtitulos.length) return { hace: false, porque: `ya tiene ${cuantos(e.subtitulos.length, "subtítulo", "subtítulos")}` };
			if (receta?.sinSubtitulos) return { hace: false, porque: "la receta de este proyecto va sin subtítulos" };
			return { hace: true, operaciones: [{ op: "generar_subtitulos" }] };
		case "estilo":
			if (!e.subtitulos.length) return { hace: false, porque: "no hay subtítulos a los que darles estilo" };
			if (!e.estiloLibre) return { hace: false, porque: "los subtítulos ya estaban o elegiste su estilo: no se cambia" };
			return { hace: true, directo: true };
		case "muletillas":
			if (!e.subtitulos.length) return { hace: false, porque: "sin subtítulos no se sabe qué se dice" };
			if (!e.conPalabras) return { hace: false, porque: "los subtítulos no tienen el tiempo de cada palabra" };
			return { hace: true, operaciones: [{ op: "eliminar_muletillas" }] };
		case "claves":
			if (!e.subtitulos.length) return { hace: false, porque: "no hay subtítulos para resaltar" };
			if (e.subtitulos.some((s) => s.claves.length)) return { hace: false, porque: "los subtítulos ya tienen sus palabras clave" };
			if (receta?.claves) return { hace: true, operaciones: [{ op: "palabras_clave", modo: "auto", color: receta.claves.color, tamano: receta.claves.tamano }] };
			return { hace: true, operaciones: [{ op: "palabras_clave", modo: "auto", color: LIMA }] };
		case "broll":
		case "planos":
			return voz ? { hace: true, directo: true } : { hace: false, porque: "no hay voz que leer para elegir dónde" };
		case "ruido": {
			if (!voz) return { hace: false, porque: SIN_VOZ };
			const sucios = e.conVoz.filter((c) => !c.ruido);
			if (!sucios.length) return { hace: false, porque: "la voz ya tiene «Reducir el ruido»" };
			return { hace: true, operaciones: sucios.map((c) => ({ op: "reducir_ruido", ref: c.ref, activo: true })) };
		}
		case "volumen": {
			if (!voz) return { hace: false, porque: SIN_VOZ };
			// Un clip que la persona normalizó a otro objetivo (TikTok) queda como lo dejó: sólo van los que no tienen ninguno.
			const sinNormalizar = e.conVoz.filter((c) => c.normalizado === null);
			if (!sinNormalizar.length) {
				const todos14 = e.conVoz.every((c) => c.normalizado === OBJETIVO_VOLUMEN);
				return { hace: false, porque: todos14 ? "ya está a −14 LUFS" : "ya está normalizado al objetivo que elegiste" };
			}
			return { hace: true, operaciones: sinNormalizar.map((c) => ({ op: "normalizar", ref: c.ref, activo: true, objetivo: OBJETIVO_VOLUMEN })) };
		}
		case "revision":
			return { hace: true, directo: true };
	}
}

// ── La prueba de estilos («A/B testing caption fonts…» del reel) ─────────────

/**
 * Las plantillas que prueba subs-03, en el orden del reel: la que gana allá primero (minúsculas, sin caja), después la
 * de la caja oscura y la de marcador. Son ids de PLANTILLAS_SUBTITULO (subtitles/estilos.ts).
 */
export const CANDIDATOS_ESTILO = ["lima", "recuadro-bebas", "marcador"] as const;

/** Un subtítulo de más de dos renglones tapa media pantalla en un video vertical: ese estilo no entra. */
export const MAX_RENGLONES = 2;

export type PruebaEstilo = { id: string; nombre: string; /** Cuántos renglones quedó cada subtítulo con ese estilo. */ renglones: number[] };

/** Lo que dice una prueba: si entra, y por qué no. Medido con los renglones que dejó el estilo aplicado. */
export function evaluarPrueba(renglones: readonly number[], max = MAX_RENGLONES): { ok: boolean; porque: string } {
	if (!renglones.length) return { ok: false, porque: "no hay subtítulos que medir" };
	const largos = renglones.filter((n) => n > max).length;
	if (largos) return { ok: false, porque: `${cuantos(largos, "subtítulo queda", "subtítulos quedan")} en más de ${max} renglones` };
	return { ok: true, porque: `todos entran en ${max} renglones o menos` };
}

/** La primera que entra, en el orden de las pruebas. Si ninguna entra, ninguna: los subtítulos quedan como estaban. */
export function elegirEstilo(pruebas: readonly PruebaEstilo[]): { elegido: string | null } {
	const ok = pruebas.find((p) => evaluarPrueba(p.renglones).ok);
	return { elegido: ok?.id ?? null };
}

// ── «No había nada que hacer» o «no pudo» ────────────────────────────────────

/**
 * Un error del «Aceptar» del chat que dice que no había nada que hacer, no que algo falló. `aceptarPropuesta` le pone
 * «No se aplica: » a CUALQUIER motivo, así que eso no distingue nada: se miran los motivos conocidos de «no había»; lo
 * demás (no bajó el reconocedor de voz, no se pudo leer el audio, estaba ocupado) es una falla y se dice como tal (con
 * su «Reportar a Soporte»).
 */
export function esNadaQueHacer(error: string): boolean {
	const t = error.replace(/^No se aplica: /, "");
	// «no se identificaron muletillas» (chat/linea.ts) es el caso NORMAL de un video grabado con guion: hasta el 10/11/2026
	// no estaba acá, y cualquier video sin muletillas terminaba con «1 no pudo» y «Reportar a Soporte».
	return (
		t.startsWith(NO_ENCONTRE) ||
		/^Ya no hay nada que cambiar/.test(t) ||
		t.startsWith(NO_HAY_MULETILLAS) ||
		/^no se cortó las muletillas/.test(t) ||
		t === MOTIVO_SUBTITULOS["sin-voz"]
	);
}

/** Cómo terminó un paso. «detenido»: la persona apretó «Detener» y el paso se cortó; no es una falla de nadie. */
export type ComoTermina = "hecho" | "salteado" | "fallo" | "detenido";

/**
 * Un pedido al editor que no salió: ¿no había nada que hacer, se detuvo, o falló? «Detener» corta la transcripción
 * (subtitles/generar.ts → «se cancelaron los subtítulos…») y hasta el 10/11/2026 eso se contaba como «1 no pudo»,
 * con su «Reportar a Soporte», sobre algo que la persona pidió.
 */
export function comoTerminaFalla({ nada, detener, cancelado }: { nada: boolean; detener: boolean; cancelado: boolean }): ComoTermina {
	if (nada) return "salteado";
	// Sólo lo que cortó «Detener» (la cancelación de los subtítulos): una falla real con «Detener» apretado sigue siendo
	// una falla (la IA del negocio caída mientras corrían las palabras clave), con su «no pudo» (revisión del 9/11).
	return detener && cancelado ? "detenido" : "fallo";
}

/**
 * Los pedazos que se normalizan juntos: los del MISMO video (después de «Borrar silencios» un video son muchos
 * pedazos). Cada grupo se mide como uno y a todos les toca la misma ganancia (audio/normalizar.ts →
 * normalizarJuntos); sin esto cada pedazo subía o bajaba por su cuenta y el volumen saltaba en cada corte. Un clip sin
 * video de origen conocido va solo. El orden de los grupos es el del primer pedazo de cada uno en la línea de tiempo.
 */
export function gruposPorFuente<T extends { inicio: number; fuente: string | null }>(clips: readonly T[]): T[][] {
	const grupos = new Map<string, T[]>();
	let solos = 0;
	for (const c of [...clips].sort((a, b) => a.inicio - b.inicio)) {
		const clave = c.fuente ? `f:${c.fuente}` : `solo:${solos++}`;
		const g = grupos.get(clave);
		if (g) g.push(c);
		else grupos.set(clave, [c]);
	}
	return [...grupos.values()];
}

// ── ¿La persona tocó el editor mientras trabajaban? ──────────────────────────

/** Las teclas que sólo miran o mueven el cabezal (reproducir, ir y venir): no cambian la línea de tiempo. */
const TECLAS_QUE_SOLO_MIRAN = new Set([" ", "k", "j", "l", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape", "Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"]);

/**
 * Si un toque o una tecla de la persona pudo cambiar la línea de tiempo mientras los agentes trabajaban (y entonces su
 * cambio queda mezclado en los pasos que cuenta la corrida, y «Deshacer todo» no se ofrece). Ante la duda, CUENTA: el
 * costo de contar de más es que «Deshacer todo» no se ofrece (queda Ctrl+Z); el de contar de menos es que «Deshacer
 * todo» le borre a la persona su cambio sin avisar (deshacerEnjambre deshace N pasos y, si el de ella cae adentro, el
 * resultado vuelve igual a la línea de antes). Revisión del 9/11/2026, dos vueltas:
 *   · Tecla: los atajos del editor corren con el foco en CUALQUIER lugar (también en la biblioteca, después de tocar un
 *     renglón del registro), así que cuenta toda tecla salvo las que sólo reproducen o mueven, y salvo escribir en un
 *     campo de texto que no es de las propiedades (el chat, un buscador).
 *   · Toque: en la biblioteca (donde está el panel de la edición) no cuenta; arrastrar de ahí a la línea se cuenta por
 *     el `drop`. En el reproductor cuenta todo menos lo marcado `data-ce-solo-mira` (Reproducir, Pantalla completa): las
 *     manijas de escalar y el menú «Relación» también son botones y SÍ cambian. Fuera de los paneles (un menú en un
 *     portal, «Aceptar» del chat) cuenta, salvo un campo de texto.
 */
export function cuentaComoToque(e: {
	tipo: "tecla" | "puntero" | "soltar";
	zona: string | null;
	tecla?: string;
	/** El foco o el toque está en un campo de texto. */
	enEditable?: boolean;
	/** El toque cayó en un control marcado `data-ce-solo-mira` (reproducir, pantalla completa). */
	soloMira?: boolean;
}): boolean {
	if (e.tipo === "soltar") return e.zona !== "biblioteca";
	if (e.tipo === "tecla") {
		if (e.tecla && TECLAS_QUE_SOLO_MIRAN.has(e.tecla)) return false;
		if (e.enEditable && e.zona !== "propiedades") return false;
		return true;
	}
	if (e.zona === "biblioteca") return false;
	if (e.soloMira) return false;
	if (e.zona === null && e.enEditable) return false;
	return true;
}

// ── La revisión final («QA ✓» del reel) ──────────────────────────────────────

export type Chequeo = { ok: boolean; texto: string; /** Dónde, en segundos de la línea de tiempo. */ en: number | null };

/** Un hueco o un pisado de menos de esto es redondeo, no un error que se vea. */
const TOLERANCIA_S = 0.1;

/**
 * Lo que se puede medir en la línea de tiempo terminada, cada cosa con su resultado. No hay un «todo bien» que no se
 * haya medido: si no hay voz, no se afirma nada del volumen ni de los subtítulos.
 */
export function revisionFinal(e: EstadoLinea): Chequeo[] {
	const chequeos: Chequeo[] = [];
	// Huecos negros en la pista principal: entre dos clips, o antes del primero.
	let previo = 0;
	const huecos: Array<{ en: number; s: number }> = [];
	for (const c of e.principal) {
		if (c.inicio - previo > TOLERANCIA_S) huecos.push({ en: previo, s: c.inicio - previo });
		previo = Math.max(previo, c.fin);
	}
	if (!e.principal.length) chequeos.push({ ok: false, texto: "la pista principal está vacía", en: null });
	else if (huecos.length) for (const h of huecos) chequeos.push({ ok: false, texto: `hueco negro de ${segundosTexto(h.s)}`, en: h.en });
	else chequeos.push({ ok: true, texto: "la pista principal no tiene huecos", en: null });

	if (e.conVoz.length) {
		// Subtítulos: que haya, y que dos no se pisen (se verían uno encima del otro).
		if (!e.subtitulos.length) chequeos.push({ ok: false, texto: "no tiene subtítulos", en: null });
		else {
			const pisados = e.subtitulos.filter((s, i) => i > 0 && s.inicio < e.subtitulos[i - 1].fin - TOLERANCIA_S);
			if (pisados.length) for (const s of pisados.slice(0, 5)) chequeos.push({ ok: false, texto: "dos subtítulos se pisan", en: s.inicio });
			else chequeos.push({ ok: true, texto: `${cuantos(e.subtitulos.length, "subtítulo", "subtítulos")}, ninguno se pisa`, en: null });
		}
		const sinNormalizar = e.conVoz.filter((c) => c.normalizado === null);
		chequeos.push(
			sinNormalizar.length
				? { ok: false, texto: `${cuantos(sinNormalizar.length, "clip", "clips")} sin normalizar a −14 LUFS`, en: sinNormalizar[0].inicio }
				: e.conVoz.every((c) => c.normalizado === OBJETIVO_VOLUMEN)
					? { ok: true, texto: "volumen a −14 LUFS", en: null }
					: { ok: true, texto: "volumen normalizado (con el objetivo que elegiste)", en: null },
		);
	}
	// Lo propuesto (B-roll, planos) se ve en el reproductor como si ya estuviera: hasta que se deja o se saca, no es el corte final.
	if (e.propuestas.length) {
		chequeos.push({ ok: false, texto: `${cuantos(e.propuestas.length, "propuesta", "propuestas")} de B-roll o planos sin decidir: déjalas o sácalas`, en: e.propuestas[0] });
	}
	chequeos.push({ ok: true, texto: `dura ${relojLinea(e.duracion)}`, en: null });
	return chequeos;
}

// ── El registro de actividad ─────────────────────────────────────────────────

/**
 * `empieza`: el agente toma su paso · `mira`: lo que está leyendo (escucha un clip, transcribe), no cambia nada ·
 * `hace`: un cambio o un hallazgo concreto · `listo`: cierra su paso con lo que dejó · `salta`: no tenía nada que
 * hacer, y por qué · `falla`: no pudo · `qa-ok` / `qa-mal`: un chequeo de la revisión final.
 */
export type TipoLinea = "empieza" | "mira" | "hace" | "listo" | "salta" | "falla" | "qa-ok" | "qa-mal";

export type LineaActividad = {
	id: number;
	agente: AgenteId;
	/** El segundo del video donde actuó (la primera columna del reel: «02:18»). Null: todo el video. */
	en: number | null;
	texto: string;
	tipo: TipoLinea;
	/** Cuándo pasó (ms del reloj), para las operaciones por segundo. */
	ms: number;
};

/** «02:18», como la columna del reel: minutos y segundos del video. */
export function relojLinea(s: number | null): string {
	if (s === null || !Number.isFinite(s)) return "--:--";
	const t = Math.max(0, Math.floor(s));
	return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Lo que cuenta como una operación hecha (el «52 ops/s» del reel): lo que cambió algo o se revisó. */
const ES_OPERACION = new Set<TipoLinea>(["hace", "listo", "qa-ok", "qa-mal"]);

/** Las operaciones del último segundo. Se mide sobre los renglones de verdad, nunca un número de adorno. */
export function opsPorSegundo(lineas: readonly LineaActividad[], ahoraMs: number): number {
	return lineas.filter((l) => ES_OPERACION.has(l.tipo) && ahoraMs - l.ms >= 0 && ahoraMs - l.ms < 1000).length;
}

/** Cuántas operaciones hizo cada agente (las barras del panel). */
export function opsPorAgente(lineas: readonly LineaActividad[]): Map<AgenteId, number> {
	const m = new Map<AgenteId, number>();
	for (const l of lineas) if (ES_OPERACION.has(l.tipo)) m.set(l.agente, (m.get(l.agente) ?? 0) + 1);
	return m;
}

/** Cuántos renglones de una lista larga se escriben uno por uno (los subtítulos puestos, las palabras resaltadas). */
export const TOPE_RENGLONES = 12;

/** Los primeros `TOPE_RENGLONES` de una lista y, si hay más, un renglón que dice cuántos quedaron sin escribir. */
export function conTope<T>(lista: readonly T[], tope = TOPE_RENGLONES): { primeros: T[]; resto: number } {
	return { primeros: lista.slice(0, tope), resto: Math.max(0, lista.length - tope) };
}

// ── Textos ───────────────────────────────────────────────────────────────────

export function cuantos(n: number, uno: string, varios: string): string {
	return `${n} ${n === 1 ? uno : varios}`;
}

export function segundosTexto(s: number): string {
	const r = Math.round(s * 10) / 10;
	return `${Number.isInteger(r) ? r : r.toFixed(1).replace(".", ",")} s`;
}

/** Un texto citado, corto: «screen recordings appear». */
export function cita(texto: string, max = 48): string {
	const t = texto.replace(/\s+/g, " ").trim();
	return `«${t.length > max ? `${t.slice(0, max - 1)}…` : t}»`;
}
