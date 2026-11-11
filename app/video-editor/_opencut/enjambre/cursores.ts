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
 * Cada cuánto se corre un cursor, y cuánto tarda en llegar. Martín (11/11/2026, mirando el GIF): «tiene que funcionar mucho más
 * rápido… que pasen los cursores todos juntos al mismo tiempo… se tiene que notar la automatización». Eran 900 y 520 ms.
 */
export const PASEO_MS = 380;
export const TRANSICION_CURSOR_MS = 300;

/**
 * Adónde va el cursor de un agente que TRABAJA: su punto (`puntoDeCursor`) y, desde la vuelta 1, un poco corrido, sin
 * salir de su caja. Martín (11/11/2026): los cursores son «súper importante que esté en todo momento». Medido en
 * producción ese día: de los 58 s de una edición automática, subs-01 transcribió 42 con el cursor clavado en el mismo
 * píxel, y un cursor quieto parece colgado. Con la hora del video se corre a lo largo de la línea de tiempo (como quien
 * la recorre); en su panel, alrededor de su lugar. Sin azar: la misma vuelta da el mismo lugar, y el ángulo de oro no
 * repite el lugar de la vuelta anterior. La vuelta 0 es el punto exacto (un renglón nuevo lleva el cursor ahí).
 */
export function puntoTrabajando(args: {
	agente: AgenteId;
	en: number | null;
	zonas: Partial<Record<Zona, Caja>>;
	linea: LineaMedida | null;
	vuelta: number;
}): Punto | null {
	const punto = puntoDeCursor(args);
	if (!punto || args.vuelta <= 0) return punto;
	const { agente, en, zonas, linea, vuelta } = args;
	const caja = en !== null && linea && linea.pps > 0 ? linea.caja : zonas[ZONA_DE[agente]];
	if (!caja) return punto;
	const i = Math.max(0, AGENTES.findIndex((a) => a.id === agente));
	const angulo = vuelta * 2.39996 + i * 1.7;
	// ±42 px se veía como un temblor (mirado a 1440 el 11/11/2026): hasta un cuarto del panel, como quien trabaja.
	const x = punto.x + Math.cos(angulo) * Math.min(110, caja.width * 0.22);
	const y = punto.y + Math.sin(angulo) * Math.min(48, caja.height * 0.12);
	return {
		x: Math.min(caja.left + caja.width - 12, Math.max(caja.left + 4, x)),
		y: Math.min(caja.top + caja.height - 12, Math.max(caja.top + 4, y)),
	};
}
