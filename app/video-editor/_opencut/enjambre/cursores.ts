// =============================================================================
// enjambre/cursores — adónde va el cursor de cada agente (puro)
// =============================================================================
// En el reel cada agente tiene su cursor con su nombre («broll-01», «caps-02») y se lo ve ir a donde trabaja: a un
// clip de la línea de tiempo, al subtítulo del reproductor, a los controles de la derecha. Acá:
//   · un renglón con hora del video («02:18 corte-01 marca una pausa») lleva el cursor a ESE segundo de la línea de
//     tiempo, a la altura de la franja de su agente;
//   · uno sin hora, al panel de su agente: los subtítulos, los planos y la revisión al reproductor; el B-roll a la
//     biblioteca; el sonido a las propiedades; los cortes a la línea de tiempo.
// El que espera queda quieto en su panel, apagado. Nada se mueve sin un renglón que lo diga.
//
// Sin el DOM: recibe las cajas medidas (./components/cursores.tsx las lee de `data-ce-zona` y `data-ce-linea`). Lo
// prueba tests/video-editor-enjambre.test.ts.
// =============================================================================

import { AGENTES, type AgenteId } from "./plan";

export type Zona = "biblioteca" | "reproductor" | "propiedades" | "linea";
export type Caja = { left: number; top: number; width: number; height: number };
export type Punto = { x: number; y: number };

/** El panel de cada agente (donde espera, y adonde va con un renglón sin hora). */
export const ZONA_DE: Record<AgenteId, Zona> = {
	"corte-01": "linea",
	"corte-02": "linea",
	"subs-01": "reproductor",
	"subs-02": "reproductor",
	"subs-03": "reproductor",
	"broll-01": "biblioteca",
	"gfx-01": "reproductor",
	"mezcla-01": "propiedades",
	"mezcla-02": "propiedades",
	"qa-01": "reproductor",
};

/** Cada agente, en su lugar dentro del panel: repartidos para que dos cursores no queden uno encima del otro. */
function lugarEn(caja: Caja, agente: AgenteId): Punto {
	const enLaZona = AGENTES.filter((a) => ZONA_DE[a.id] === ZONA_DE[agente]);
	const i = Math.max(0, enLaZona.findIndex((a) => a.id === agente));
	const n = Math.max(1, enLaZona.length);
	// En el reproductor, sobre el tercio de abajo (donde van los subtítulos); en los demás, al medio.
	const yRel = ZONA_DE[agente] === "reproductor" ? 0.55 + 0.3 * ((i + 0.5) / n) : 0.3 + 0.4 * ((i + 0.5) / n);
	const xRel = 0.25 + 0.5 * ((i + 0.5) / n);
	return { x: caja.left + caja.width * xRel, y: caja.top + caja.height * yRel };
}

/** La línea de tiempo medida: su caja visible, dónde arranca el segundo 0 y cuántos píxeles mide un segundo. */
export type LineaMedida = { caja: Caja; scrollLeft: number; pps: number };

/**
 * Adónde va el cursor de un agente con su último renglón. `en`: el segundo del video (null si no tiene). Sin la línea
 * medida, o con el segundo fuera de lo visible, va al borde de la línea de tiempo más cercano: el cursor nunca sale de
 * la ventana del editor.
 */
export function puntoDeCursor({
	agente,
	en,
	zonas,
	linea,
}: {
	agente: AgenteId;
	en: number | null;
	zonas: Partial<Record<Zona, Caja>>;
	linea: LineaMedida | null;
}): Punto | null {
	if (en !== null && linea && linea.pps > 0) {
		const { caja } = linea;
		const x = caja.left + en * linea.pps - linea.scrollLeft;
		const enLaLinea = AGENTES.findIndex((a) => a.id === agente);
		const y = caja.top + caja.height * (0.2 + 0.6 * ((enLaLinea + 0.5) / AGENTES.length));
		return { x: Math.min(caja.left + caja.width - 12, Math.max(caja.left + 4, x)), y };
	}
	const caja = zonas[ZONA_DE[agente]];
	return caja ? lugarEn(caja, agente) : null;
}

/**
 * Cada cuánto un agente pasa a la tarea siguiente, y cuánto tarda su cursor en llegar. Martín (11/11/2026, mirando el GIF):
 * «tiene que funcionar mucho más rápido… que pasen los cursores todos juntos al mismo tiempo… se tiene que notar la
 * automatización».
 */
export const PASEO_MS = 420;
export const TRANSICION_CURSOR_MS = 220;

// ── Las tareas: cada cursor va a algo REAL del editor y lo trabaja (11/11/2026) ─────────────────────────────────────────
// Martín, el mismo día: «los cursores se mueven random para todos lados… tienen que moverse de tal manera que estén
// trabajando, hagan cosas». En el reel de referencia (la rama `referencias/reels-0911`, `edicion-mako.mp4`, mirado cuadro por
// cuadro cada 0,25 s) cada cursor AGARRA algo: el recuadro del subtítulo en el video (con su caja de selección y el cursor en
// la esquina, ajustándolo), un clip de la línea de tiempo, un efecto de la biblioteca, una rueda de color. Y todos a la vez.
// Así: cada agente tiene SUS objetivos (los cortes, los clips; los subtítulos, los textos y el cuadro del subtítulo; el B-roll,
// los medios de la biblioteca…), va a uno, lo marca con una caja de su color y queda en su esquina; a la vuelta siguiente,
// al otro. Un renglón con hora («marca una pausa en 00:03») lo lleva a ESE segundo de la línea de tiempo.

/** Lo que hay para tocar, medido en el DOM (./components/cursores.tsx). */
export type Objetivos = {
  /** Los clips de video e imagen de la línea de tiempo. */
  clips: readonly Caja[];
  /** Los textos y subtítulos de la línea de tiempo. */
  textos: readonly Caja[];
  /** Los clips de audio. */
  audios: readonly Caja[];
  /** Los controles del panel de propiedades. */
  controles: readonly Caja[];
  /** Los medios de la biblioteca. */
  medios: readonly Caja[];
  /** El cuadro del video en el reproductor, y la franja donde van los subtítulos. */
  cuadro: Caja | null;
  subtitulo: Caja | null;
};

export const SIN_OBJETIVOS: Objetivos = { clips: [], textos: [], audios: [], controles: [], medios: [], cuadro: null, subtitulo: null };

type Fuente = keyof Objetivos;

/** Lo que toca cada agente, por su rol (./plan.ts). El primero que tenga algo es el que se usa más. */
export const OBJETIVOS_DE: Record<AgenteId, readonly Fuente[]> = {
  "corte-01": ["clips", "audios"],
  "corte-02": ["clips", "textos"],
  "subs-01": ["textos", "subtitulo"],
  "subs-02": ["subtitulo", "textos"],
  "subs-03": ["subtitulo", "controles"],
  "broll-01": ["medios", "clips"],
  "gfx-01": ["cuadro", "controles"],
  "mezcla-01": ["audios", "controles"],
  "mezcla-02": ["controles", "audios"],
  "qa-01": ["cuadro", "clips", "textos"],
};

/** Lo que hace un agente en una vuelta: la caja que trabaja (con su color) y dónde queda su cursor. */
export type Tarea = { caja: Caja; punto: Punto };

const cajasDe = (o: Objetivos, f: Fuente): readonly Caja[] => {
  const v = o[f];
  return v == null ? [] : Array.isArray(v) ? v : [v as Caja];
};

/** El cursor en la esquina de abajo a la derecha, adentro: como quien ajusta lo que seleccionó. */
export const esquina = (c: Caja): Punto => ({ x: c.left + Math.max(4, c.width - 10), y: c.top + Math.max(4, c.height - 8) });

/**
 * La tarea de un agente en esta vuelta. Con la hora del video (`en`), el corte en ESE segundo de la línea de tiempo, de la altura
 * del clip que cae ahí. Sin hora, uno de sus objetivos: los del mismo rol se reparten (cada uno empieza en otro) y avanzan uno por
 * vuelta, sin azar. Sin nada medido, su panel (`puntoDeCursor`), sin caja.
 */
export function tareaDeAgente(args: {
  agente: AgenteId;
  en: number | null;
  vuelta: number;
  zonas: Partial<Record<Zona, Caja>>;
  linea: LineaMedida | null;
  objetivos: Objetivos;
}): Tarea | { caja: null; punto: Punto } | null {
  const { agente, en, vuelta, linea, objetivos } = args;
  if (en !== null && linea && linea.pps > 0) {
    const x = Math.min(linea.caja.left + linea.caja.width - 20, Math.max(linea.caja.left + 4, linea.caja.left + en * linea.pps - linea.scrollLeft));
    const fila = [...objetivos.clips, ...objetivos.textos, ...objetivos.audios].find((c) => x >= c.left && x <= c.left + c.width);
    const caja: Caja = fila ? { left: x - 10, top: fila.top, width: 20, height: fila.height } : { left: x - 10, top: linea.caja.top + 8, width: 20, height: Math.max(20, linea.caja.height * 0.3) };
    return { caja, punto: esquina(caja) };
  }
  const todas = OBJETIVOS_DE[agente].flatMap((f) => cajasDe(objetivos, f));
  if (todas.length) {
    const i = Math.max(0, AGENTES.findIndex((a) => a.id === agente));
    const caja = todas[(vuelta + i * 3) % todas.length];
    return { caja, punto: esquina(caja) };
  }
  const p = puntoDeCursor({ agente, en: null, zonas: args.zonas, linea });
  return p ? { caja: null, punto: p } : null;
}

/** Las dos cajas del reproductor que se trabajan aunque sean un canvas: el cuadro entero y la franja del subtítulo. */
export function cajasDelCuadro(canvas: Caja | null): { cuadro: Caja | null; subtitulo: Caja | null } {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return { cuadro: null, subtitulo: null };
  return {
    cuadro: canvas,
    subtitulo: { left: canvas.left + canvas.width * 0.12, top: canvas.top + canvas.height * 0.6, width: canvas.width * 0.76, height: canvas.height * 0.14 },
  };
}

// ── Cada cursor DONDE aparece su cambio (12/11/2026) ──────────────────────────────────────────────────────────────────
// Martín, mirando la Edición automática: «no tiene sentido esos cursores que están haciendo cosas sobre algo que ya está
// creado». En el reel cada cursor está donde aparece lo que hace: el bloque del subtítulo nuevo, el punto del corte, el B-roll
// recién puesto. Ahora el agente que trabaja y sus compañeros de rol (`FAMILIA`) se reparten los cambios de su paso
// (./cambios.ts) y van a cada uno a la vez, de a uno por `PASEO_MS`; los demás esperan quietos en su panel. La revisión
// (qa-01) sí recorre lo que ya está: revisar es eso.

/** El agente que corre su paso y los de su rol que lo ayudan a la vez (en el reel, varios cursores colocan subtítulos juntos). */
export const FAMILIA: Record<AgenteId, readonly AgenteId[]> = {
	"corte-01": ["corte-01", "corte-02"],
	"corte-02": ["corte-02", "corte-01"],
	"subs-01": ["subs-01", "subs-02", "subs-03"],
	"subs-02": ["subs-02", "subs-01", "subs-03"],
	"subs-03": ["subs-03", "subs-01", "subs-02"],
	"broll-01": ["broll-01", "gfx-01"],
	"gfx-01": ["gfx-01", "broll-01"],
	"mezcla-01": ["mezcla-01", "mezcla-02"],
	"mezcla-02": ["mezcla-02", "mezcla-01"],
	"qa-01": ["qa-01"],
};

/** Un cambio para repartir: su elemento (para buscar su caja), su segundo y su tipo. */
export type CambioARepartir = { id: string; en: number; tipo: "aparece" | "corte" | "cambia"; elemento: string; t: number };

/**
 * Qué cambio muestra cada cursor de la familia del que trabaja. Se reparten los de su ÚLTIMA tanda (los que trajo el mismo
 * aviso de la línea de tiempo, en el orden del video): el i-ésimo de k se lleva el i, el i+k, el i+2k…, uno por `PASEO_MS`, así
 * todos colocan a la vez cosas DISTINTAS. Al terminar, el que trabaja queda en el último y los ayudantes vuelven a su lugar.
 * `ocupados`: los que corren su propio trabajo (no ayudan).
 */
export function repartoDeCambios({
	trabajando,
	cambios,
	ahora,
	ocupados = [],
	paseoMs = PASEO_MS,
}: {
	trabajando: AgenteId;
	cambios: readonly (CambioARepartir & { agente: AgenteId })[];
	ahora: number;
	ocupados?: readonly AgenteId[];
	paseoMs?: number;
}): Map<AgenteId, CambioARepartir> {
	const out = new Map<AgenteId, CambioARepartir>();
	const suyos = cambios.filter((c) => c.agente === trabajando);
	if (!suyos.length) return out;
	const desde = Math.max(...suyos.map((c) => c.t));
	const tanda = suyos.filter((c) => c.t === desde).sort((a, b) => a.en - b.en);
	const familia = FAMILIA[trabajando].filter((a, i) => i === 0 || !ocupados.includes(a));
	const k = familia.length;
	const paso = Math.max(0, Math.floor((ahora - desde) / Math.max(1, paseoMs)));
	familia.forEach((agente, j) => {
		const i = paso * k + j;
		if (i < tanda.length) out.set(agente, tanda[i]);
		else if (j === 0) out.set(agente, tanda[tanda.length - 1]);
	});
	return out;
}
