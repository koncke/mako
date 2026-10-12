// =============================================================================
// Animación (Entrada · Salida · Combinado · Bucle): el catálogo
// =============================================================================
// En CapCut una animación es un preset con nombre y una duración; el clip la
// lleva en `material_animations` y el motor la evalúa cuadro a cuadro. Acá cada
// preset es una función PURA del progreso (0–1) que devuelve una «pose»:
// desplazamiento, escala, giro y opacidad RELATIVOS a lo que el clip ya tiene
// (sus keyframes incluidos). El gancho visual (./gancho.ts) compone las poses de
// las cuatro ranuras y las aplica sobre la transformación del cuadro.
//
// Las cuatro ranuras, como CapCut:
//   · Entrada   progreso 0 → 1 en los primeros `duracion` segundos; en 1 la pose
//               es la identidad (el clip queda donde lo dejaste).
//   · Salida    progreso 0 → 1 en los últimos `duracion` segundos; en 0, identidad.
//   · Combinado (video e imagen) una sola vez a lo largo de `duracion` (por
//               defecto el clip entero); empieza y termina en la identidad.
//               Excluye Entrada y Salida (elegir una saca la otra).
//   · Bucle     (texto, stickers y formas) se repite con período `duracion`
//               entre el final de la Entrada y el comienzo de la Salida.
//
// Los NOMBRES de las animaciones los manda el servidor de CapCut (no están en
// el es-LA.po): son los que se ven en la app en español, y los que no se pudieron
// ver son traducción nuestra con el mismo criterio. Sólo «Ninguno» (`None`) y
// «Palabra por palabra» (`pc_subtitle_template_word_by_word`) salen del .po.
//
// ⚠️ Sin desenfoque ni 3D: el gancho visual sólo mueve transformación y
// opacidad. Las animaciones de CapCut que desenfocan («Desenfoque», «Zoom
// borroso») o giran en 3D quedaron afuera; «Voltear» es el giro 3D aplastado
// en X, que en 2D se ve igual de frente.

export type CategoriaAnimacion = "entrada" | "salida" | "combo" | "bucle";

/** Lo que una animación le suma al cuadro. Desplazamientos en fracción del lienzo. */
export type Pose = {
	dx: number;
	dy: number;
	/** Multiplica la escala (las dos). */
	escala: number;
	/** Multiplican la escala de cada eje (Voltear, Gelatina…). */
	escalaX: number;
	escalaY: number;
	/** Grados que se suman al giro. */
	giro: number;
	/** Multiplica la opacidad. */
	opacidad: number;
};

export const POSE_IDENTIDAD: Pose = {
	dx: 0,
	dy: 0,
	escala: 1,
	escalaX: 1,
	escalaY: 1,
	giro: 0,
	opacidad: 1,
};

/** Cómo se mueve un preset según lo que anima: un texto se desliza menos que un clip. */
export type OpcionesPose = { texto: boolean };

export type PresetAnimacion = {
	id: string;
	nombre: string;
	categoria: CategoriaAnimacion;
	/** Segundos al elegirlo (CapCut: 0,5 s la mayoría de las de entrada y salida). */
	duracion: number;
	/** Sólo para texto («Máquina de escribir», «Palabra por palabra»). */
	soloTexto?: boolean;
	/** Las de texto que revelan de a poco en vez de mover. */
	revela?: "caracter" | "palabra";
	/** `p` es el progreso LINEAL (0–1); cada preset elige su curva adentro. */
	pose: (p: number, opciones: OpcionesPose) => Partial<Pose>;
};

export const ID_NINGUNO = "ninguno";

// ── Curvas ───────────────────────────────────────────────────────────────────
// Las de easings.net, con nombre en castellano. Las de entrada frenan al llegar
// (salidaX); las de salida arrancan despacio (entradaX), que es el espejo.

const acotar01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const salidaCubica = (t: number) => 1 - (1 - t) ** 3;
const entradaCubica = (t: number) => t ** 3;
const enSalidaSeno = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
function salidaAtras(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
function salidaRebote(t: number): number {
	const n1 = 7.5625;
	const d1 = 2.75;
	if (t < 1 / d1) return n1 * t * t;
	if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
	if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
	return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
/** Sube de 0 a 1 en el primer `fraccion` del tramo (un fundido corto al entrar). */
const aparece = (p: number, fraccion: number) => acotar01(p / fraccion);
const TAU = Math.PI * 2;

// Cuánto se desliza: un clip entra desde afuera del lienzo; un texto, desde un
// poco al costado (en CapCut el texto «se desliza» con fundido, no cruza la pantalla).
const distanciaX = ({ texto }: OpcionesPose) => (texto ? 0.15 : 1);
const distanciaY = ({ texto }: OpcionesPose) => (texto ? 0.15 : 1);

// ── Entrada ──────────────────────────────────────────────────────────────────
// En p = 0 el clip está en su pose de partida; en p = 1, en la identidad.

type PoseFn = PresetAnimacion["pose"];

const ENTRADA: Record<string, PoseFn> = {
	"aparecer-gradualmente": (p) => ({ opacidad: enSalidaSeno(p) }),
	acercar: (p) => ({ escala: 0.5 + 0.5 * salidaCubica(p), opacidad: aparece(p, 0.4) }),
	alejar: (p) => ({ escala: 1.6 - 0.6 * salidaCubica(p), opacidad: aparece(p, 0.4) }),
	"deslizar-izquierda": (p, o) => ({
		dx: (1 - salidaCubica(p)) * distanciaX(o),
		opacidad: o.texto ? aparece(p, 0.6) : 1,
	}),
	"deslizar-derecha": (p, o) => ({
		dx: -(1 - salidaCubica(p)) * distanciaX(o),
		opacidad: o.texto ? aparece(p, 0.6) : 1,
	}),
	"deslizar-arriba": (p, o) => ({
		dy: (1 - salidaCubica(p)) * distanciaY(o),
		opacidad: o.texto ? aparece(p, 0.6) : 1,
	}),
	"deslizar-abajo": (p, o) => ({
		dy: -(1 - salidaCubica(p)) * distanciaY(o),
		opacidad: o.texto ? aparece(p, 0.6) : 1,
	}),
	girar: (p) => ({
		giro: -180 * (1 - salidaCubica(p)),
		escala: 0.2 + 0.8 * salidaCubica(p),
		opacidad: aparece(p, 0.5),
	}),
	rebote: (p) => ({ escala: 0.3 + 0.7 * salidaAtras(p), opacidad: aparece(p, 0.3) }),
	balanceo: (p) => ({ giro: 18 * (1 - p) ** 1.5 * Math.sin(TAU * 2 * p), opacidad: aparece(p, 0.3) }),
	caida: (p, o) => ({
		dy: -(1 - salidaRebote(p)) * (o.texto ? 0.3 : 0.6),
		opacidad: aparece(p, 0.25),
	}),
	columpio: (p) => ({
		giro: 30 * (1 - p) ** 1.5 * Math.cos(Math.PI * 3 * p),
		opacidad: aparece(p, 0.3),
	}),
	subir: (p) => ({ dy: 0.08 * (1 - salidaCubica(p)), opacidad: salidaCubica(p) }),
	voltear: (p) => ({ escalaX: Math.max(0.01, salidaCubica(p)), opacidad: aparece(p, 0.3) }),
	estirar: (p) => ({
		escalaY: Math.max(0.01, salidaAtras(p)),
		escalaX: 1 + 0.3 * (1 - salidaCubica(p)),
		opacidad: aparece(p, 0.3),
	}),
	temblor: (p) => ({
		dx: 0.03 * (1 - p) * Math.sin(TAU * 7 * p),
		dy: 0.02 * (1 - p) * Math.sin(TAU * 5 * p + 1),
		opacidad: aparece(p, 0.3),
	}),
	// Las de texto no mueven: revelan (ver `revela`).
	"maquina-escribir": () => ({}),
	"palabra-por-palabra": () => ({}),
};

/** El espejo de una entrada: lo que entra por un lado sale por el mismo. */
const espejo =
	(entrada: PoseFn): PoseFn =>
	(p, o) =>
		entrada(1 - p, o);

const SALIDA: Record<string, PoseFn> = {
	"desaparecer-gradualmente": espejo(ENTRADA["aparecer-gradualmente"]),
	// Sale ACERCÁNDOSE (crece y se va): es el espejo de entrar alejándose.
	acercar: espejo(ENTRADA.alejar),
	alejar: espejo(ENTRADA.acercar),
	"deslizar-izquierda": espejo(ENTRADA["deslizar-derecha"]),
	"deslizar-derecha": espejo(ENTRADA["deslizar-izquierda"]),
	"deslizar-arriba": espejo(ENTRADA["deslizar-abajo"]),
	"deslizar-abajo": espejo(ENTRADA["deslizar-arriba"]),
	girar: (p) => ({
		giro: 180 * entradaCubica(p),
		escala: 1 - 0.8 * entradaCubica(p),
		opacidad: 1 - aparece(p - 0.5, 0.5),
	}),
	rebote: espejo(ENTRADA.rebote),
	balanceo: espejo(ENTRADA.balanceo),
	// Cae hacia abajo con gravedad (no es el espejo: el espejo subiría).
	caida: (p, o) => ({ dy: p * p * (o.texto ? 0.3 : 0.8), opacidad: 1 - aparece(p - 0.6, 0.4) }),
	columpio: espejo(ENTRADA.columpio),
	bajar: espejo(ENTRADA.subir),
	voltear: espejo(ENTRADA.voltear),
	estirar: espejo(ENTRADA.estirar),
	temblor: espejo(ENTRADA.temblor),
	"maquina-escribir": () => ({}),
	"palabra-por-palabra": () => ({}),
};

/**
 * «pum-pum… pum-pum»: dos golpes por ciclo. Las campanas no llegan a 0 en las
 * puntas (exp(−11) ≈ 1,5e−5): la ventana sin(π·fase) las lleva a 0 justo, o el
 * Combinado terminaba con la escala en 1,0000015 (lo vio el test).
 */
function latido(fase: number): number {
	const golpe = (centro: number) => Math.exp(-(((fase - centro) / 0.06) ** 2));
	return 1 + (0.1 * golpe(0.2) + 0.07 * golpe(0.42)) * Math.sin(Math.PI * fase);
}

// ── Combinado (una vez, a lo largo de su duración) ───────────────────────────
// Todas valen la identidad en p = 0 y en p = 1: cortar o alargar el clip no deja
// un salto al final.

const COMBO: Record<string, PoseFn> = {
	balanceo: (p) => ({ giro: 8 * Math.sin(TAU * 3 * p) }),
	pulso: (p) => ({ escala: 1 + 0.08 * (1 - Math.cos(TAU * 4 * p)) / 2 }),
	temblor: (p) => ({
		dx: 0.015 * Math.sin(TAU * 13 * p) * Math.sin(Math.PI * p),
		dy: 0.012 * Math.sin(TAU * 17 * p + 1) * Math.sin(Math.PI * p),
	}),
	rotacion: (p) => ({ giro: 360 * enSalidaSeno(p) }),
	respirar: (p) => ({ escala: 1 + 0.05 * (1 - Math.cos(TAU * 2 * p)) / 2 }),
	rebote: (p) => ({ dy: -0.06 * Math.abs(Math.sin(Math.PI * 3 * p)) }),
	columpio: (p) => ({ giro: 15 * Math.sin(TAU * 2 * p) }),
	"acercar-y-alejar": (p) => ({ escala: 1 + 0.25 * Math.sin(Math.PI * p) }),
	"alejar-y-acercar": (p) => ({ escala: 1 - 0.2 * Math.sin(Math.PI * p) }),
	"girar-y-acercar": (p) => ({
		giro: 360 * enSalidaSeno(p),
		escala: 1 + 0.3 * Math.sin(Math.PI * p),
	}),
	vaiven: (p) => ({ dx: 0.05 * Math.sin(TAU * 2 * p) }),
	latido: (p) => {
		// Dos golpes por ciclo, tres ciclos: «pum-pum… pum-pum».
		const fase = (p * 3) % 1;
		return { escala: latido(fase) };
	},
	parpadeo: (p) => ({ opacidad: 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(TAU * 5 * p)) }),
	flotar: (p) => ({ dy: -0.03 * Math.sin(TAU * 2 * p) }),
	gelatina: (p) => {
		const onda = 0.1 * Math.sin(TAU * 3 * p) * (1 - p);
		return { escalaX: 1 + onda, escalaY: 1 - onda };
	},
};

// ── Bucle (texto, stickers, formas): UN ciclo, fase 0–1 ──────────────────────

const BUCLE: Record<string, PoseFn> = {
	balanceo: (f) => ({ giro: 8 * Math.sin(TAU * f) }),
	pulso: (f) => ({ escala: 1 + 0.08 * (1 - Math.cos(TAU * f)) / 2 }),
	temblor: (f) => ({ dx: 0.01 * Math.sin(TAU * 3 * f), dy: 0.008 * Math.sin(TAU * 5 * f) }),
	rotacion: (f) => ({ giro: 360 * f }),
	respirar: (f) => ({ escala: 1 + 0.05 * (1 - Math.cos(TAU * f)) / 2 }),
	rebote: (f) => ({ dy: -0.05 * Math.abs(Math.sin(Math.PI * f)) }),
	columpio: (f) => ({ giro: 15 * Math.sin(TAU * f) }),
	"acercar-y-alejar": (f) => ({ escala: 1 + 0.15 * (1 - Math.cos(TAU * f)) / 2 }),
	latido: (f) => ({ escala: latido(f) }),
	parpadeo: (f) => ({ opacidad: 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(TAU * f)) }),
	flotar: (f) => ({ dy: -0.02 * Math.sin(TAU * f) }),
	gelatina: (f) => {
		const onda = 0.08 * Math.sin(TAU * f);
		return { escalaX: 1 + onda, escalaY: 1 - onda };
	},
	vaiven: (f) => ({ dx: 0.03 * Math.sin(TAU * f) }),
};

// ── Los presets con nombre y orden de pantalla ───────────────────────────────

const NOMBRES: Record<string, string> = {
	"aparecer-gradualmente": "Aparecer gradualmente",
	"desaparecer-gradualmente": "Desaparecer gradualmente",
	acercar: "Acercar",
	alejar: "Alejar",
	"deslizar-izquierda": "Deslizar a la izquierda",
	"deslizar-derecha": "Deslizar a la derecha",
	"deslizar-arriba": "Deslizar hacia arriba",
	"deslizar-abajo": "Deslizar hacia abajo",
	girar: "Girar",
	rebote: "Rebote",
	balanceo: "Balanceo",
	caida: "Caída",
	columpio: "Columpio",
	subir: "Subir",
	bajar: "Bajar",
	voltear: "Voltear",
	estirar: "Estirar",
	temblor: "Temblor",
	"maquina-escribir": "Máquina de escribir",
	"palabra-por-palabra": "Palabra por palabra",
	pulso: "Pulso",
	rotacion: "Rotación",
	respirar: "Respirar",
	"acercar-y-alejar": "Acercar y alejar",
	"alejar-y-acercar": "Alejar y acercar",
	"girar-y-acercar": "Girar y acercar",
	vaiven: "Vaivén",
	latido: "Latido",
	parpadeo: "Parpadeo",
	flotar: "Flotar",
	gelatina: "Gelatina",
};

const REVELA: Record<string, PresetAnimacion["revela"]> = {
	"maquina-escribir": "caracter",
	"palabra-por-palabra": "palabra",
};

function armar(
	categoria: CategoriaAnimacion,
	tabla: Record<string, PoseFn>,
	duracion: (id: string) => number,
): PresetAnimacion[] {
	return Object.entries(tabla).map(([id, pose]) => ({
		id,
		nombre: NOMBRES[id] ?? id,
		categoria,
		duracion: duracion(id),
		soloTexto: id in REVELA ? true : undefined,
		revela: REVELA[id],
		pose,
	}));
}

// Entrada y salida: 0,5 s (la más común del catálogo de CapCut); las que
// revelan texto, 1 s, porque a 0,5 s una frase entera no se llega a leer.
const duracionEntradaSalida = (id: string) => (id in REVELA ? 1 : 0.5);

export const PRESETS: Record<CategoriaAnimacion, PresetAnimacion[]> = {
	entrada: armar("entrada", ENTRADA, duracionEntradaSalida),
	salida: armar("salida", SALIDA, duracionEntradaSalida),
	// El combinado ocupa el clip entero al elegirlo: su duración real la fija el
	// panel con la del clip (este número es el piso si el clip no se conoce).
	combo: armar("combo", COMBO, () => 2),
	// El bucle: un ciclo por segundo; la rotación, más lenta.
	bucle: armar("bucle", BUCLE, (id) => (id === "rotacion" ? 2 : 1)),
};

const porId: Record<CategoriaAnimacion, Map<string, PresetAnimacion>> = {
	entrada: new Map(PRESETS.entrada.map((p) => [p.id, p])),
	salida: new Map(PRESETS.salida.map((p) => [p.id, p])),
	combo: new Map(PRESETS.combo.map((p) => [p.id, p])),
	bucle: new Map(PRESETS.bucle.map((p) => [p.id, p])),
};

export function presetAnimacion(
	categoria: CategoriaAnimacion,
	id: unknown,
): PresetAnimacion | null {
	if (typeof id !== "string" || id === ID_NINGUNO) return null;
	return porId[categoria].get(id) ?? null;
}

/** Los presets que se ofrecen para un tipo de elemento (los de texto, sólo al texto). */
export function presetsPara(categoria: CategoriaAnimacion, esTexto: boolean): PresetAnimacion[] {
	return PRESETS[categoria].filter((p) => esTexto || !p.soloTexto);
}

/** Compone dos poses: suma lo que se suma y multiplica lo que se multiplica. */
export function componerPoses(a: Pose, b: Partial<Pose>): Pose {
	return {
		dx: a.dx + (b.dx ?? 0),
		dy: a.dy + (b.dy ?? 0),
		escala: a.escala * (b.escala ?? 1),
		escalaX: a.escalaX * (b.escalaX ?? 1),
		escalaY: a.escalaY * (b.escalaY ?? 1),
		giro: a.giro + (b.giro ?? 0),
		opacidad: a.opacidad * (b.opacidad ?? 1),
	};
}
