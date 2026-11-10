// =============================================================================
// El RANGO de la línea de tiempo (punto de entrada / salida de CapCut): las reglas
// =============================================================================
// CapCut Desktop (relevamiento-capcut-armazon §7.4 y §10, preset «CapCut»):
//   · I = «Punto de entrada» y O = «Punto de salida», en el cabezal;
//   · Shift+X = «Seleccionar por clip»: el rango pasa a ser el del clip;
//   · Alt+X = «Anular selección»: lo quita;
//   · y «solo se exporta ese rango» (https://www.capcut.com/help/export-clip-of-video).
//
// Este módulo es PURO a propósito (sin el motor ni `_opencut/wasm`, que no carga
// en node): los tiempos son ticks del motor como números y quien llama pasa los
// ticks por segundo. Lo usan las acciones de teclado (./acciones.ts), la regla
// de la línea de tiempo (./components/rango-regla.tsx) y Exportar
// (export/exportar.ts, services/renderer/scene-exporter.ts, export/gif.ts).
//
// Lo que NO dice el relevamiento y se decidió acá (como lo hacen los editores que
// tienen I/O; confirmar contra el CapCut de Martín):
//   · una sola marca también es un rango: sólo la entrada va hasta el final, sólo
//     la salida arranca en 0;
//   · una entrada en o después de la salida suelta la salida (y al revés): nunca
//     queda un rango al revés;
//   · las marcas se GUARDAN tal cual y el tramo que vale se CALCULA con la duración
//     de ahora (`tramoEfectivo`): si se borran clips y la línea se acorta, el rango
//     se recorta solo, y si queda vacío no hay rango (ni se dibuja ni recorta el
//     export). Con Deshacer vuelve, porque las marcas no se tocaron;
//   · Shift+X sin nada elegido toma el clip de la pista principal que está bajo el
//     cabezal, como Dividir (timeline/components/pistas-ce.ts → objetivosEnCabezal).

/** Las dos marcas, en ticks del motor. `null` = no está puesta. */
export type MarcasRango = { entrada: number | null; salida: number | null };

export const SIN_MARCAS: MarcasRango = { entrada: null, salida: null };

/** El tramo que vale, en ticks: `desde` < `hasta`. */
export type Tramo = { desde: number; hasta: number };

export function hayMarcas(m: MarcasRango | null | undefined): boolean {
	return !!m && (m.entrada !== null || m.salida !== null);
}

const aTick = (t: number) => Math.max(0, Math.round(t));

/** «Punto de entrada» (I) en `tiempo`. Si cae en o después de la salida, la salida se suelta. */
export function marcarEntrada(m: MarcasRango, tiempo: number): MarcasRango {
	const entrada = aTick(tiempo);
	if (m.salida !== null && entrada >= m.salida) return { entrada, salida: null };
	return { entrada, salida: m.salida };
}

/** «Punto de salida» (O) en `tiempo`. Si cae en o antes de la entrada, la entrada se suelta. */
export function marcarSalida(m: MarcasRango, tiempo: number): MarcasRango {
	const salida = aTick(tiempo);
	if (m.entrada !== null && salida <= m.entrada) return { entrada: null, salida };
	return { entrada: m.entrada, salida };
}

type Clip = { startTime: number; duration: number };

/**
 * «Seleccionar por clip» (Shift+X): de la primera a la última punta de los clips.
 * Con varios elegidos, el rango los cubre a todos. Sin clips, `null` (no cambia nada).
 */
export function marcasDeClips(clips: readonly Clip[]): MarcasRango | null {
	const validos = clips.filter((c) => c.duration > 0);
	if (validos.length === 0) return null;
	const entrada = Math.min(...validos.map((c) => c.startTime));
	const salida = Math.max(...validos.map((c) => c.startTime + c.duration));
	return { entrada: aTick(entrada), salida: aTick(salida) };
}

/**
 * El clip que el cabezal atraviesa (el primero). Un clip que EMPIEZA en el
 * cabezal cuenta (es el que se ve); uno que termina ahí, no.
 */
export function clipEnElTiempo<T extends Clip>(clips: readonly T[], tiempo: number): T | null {
	return clips.find((c) => c.duration > 0 && tiempo >= c.startTime && tiempo < c.startTime + c.duration) ?? null;
}

/**
 * El tramo que vale con la duración de AHORA, o `null` si no hay rango (sin
 * marcas, o un rango que quedó vacío porque la línea se acortó). `minimo` en
 * ticks: un tramo más corto no cuenta.
 */
export function tramoEfectivo(m: MarcasRango | null | undefined, duracion: number, minimo = 1): Tramo | null {
	if (!m || !hayMarcas(m) || !(duracion > 0)) return null;
	const recortar = (t: number) => Math.min(duracion, Math.max(0, t));
	const desde = recortar(m.entrada ?? 0);
	const hasta = recortar(m.salida ?? duracion);
	if (hasta - desde < Math.max(1, minimo)) return null;
	return { desde, hasta };
}

/**
 * ¿El clip (en ticks) suena en el tramo? Lo usa la mezcla del export (media/audio.ts): un clip fuera del rango no se
 * decodifica ni se le reduce el ruido; uno que se cruza va ENTERO (la reducción de ruido necesita su contexto). Sin
 * tramo, todos.
 */
export function seCruzaConElTramo(clip: { startTime: number; duration: number }, tramo: Tramo | null | undefined): boolean {
	if (!tramo) return true;
	return clip.startTime < tramo.hasta && clip.startTime + clip.duration > tramo.desde;
}

/** El tramo en segundos. */
export function tramoEnSegundos(t: Tramo, ticksPorSegundo: number): { desde: number; hasta: number } {
	return { desde: t.desde / ticksPorSegundo, hasta: t.hasta / ticksPorSegundo };
}

/** Los segundos que se exportan: los del tramo, o la duración entera sin tramo. */
export function segundosAExportar(tramo: Tramo | null, duracion: number, ticksPorSegundo: number): number {
	const ticks = tramo ? tramo.hasta - tramo.desde : duracion;
	return Math.max(0, ticks) / ticksPorSegundo;
}

/**
 * Los cuadros del video que se exportan: el tiempo del primero (en ticks) y
 * cuántos son. Sin tramo, de 0 a `duracion`. Siempre al menos uno.
 */
export function cuadrosDelTramo(
	tramo: Tramo | null,
	duracion: number,
	ticksPorCuadro: number,
): { primero: number; cantidad: number } {
	const desde = tramo?.desde ?? 0;
	const hasta = tramo?.hasta ?? duracion;
	return { primero: desde, cantidad: Math.max(1, Math.floor((hasta - desde) / ticksPorCuadro)) };
}

/**
 * Qué muestras de la mezcla de audio (que arranca en 0 y cubre la línea entera)
 * van al archivo: desde cuál y cuántas. Recortado al largo de la mezcla.
 */
export function muestrasDelTramo(
	tramo: Tramo,
	ticksPorSegundo: number,
	frecuencia: number,
	largo: number,
): { inicio: number; cantidad: number } {
	const aMuestra = (t: number) => Math.min(largo, Math.max(0, Math.round((t / ticksPorSegundo) * frecuencia)));
	const inicio = aMuestra(tramo.desde);
	const fin = aMuestra(tramo.hasta);
	return { inicio, cantidad: Math.max(0, fin - inicio) };
}

type Subtitulo = { inicio: number; fin: number; texto: string };

/**
 * Los subtítulos (en segundos) que caen en el tramo (en segundos), corridos para
 * que el archivo arranque en 0 como el video: el que empieza antes del tramo o
 * termina después se recorta al borde.
 */
export function subtitulosDelTramo<T extends Subtitulo>(subtitulos: readonly T[], tramo: { desde: number; hasta: number }): T[] {
	return subtitulos
		.filter((s) => s.fin > tramo.desde && s.inicio < tramo.hasta)
		.map((s) => ({
			...s,
			inicio: Math.max(s.inicio, tramo.desde) - tramo.desde,
			fin: Math.min(s.fin, tramo.hasta) - tramo.desde,
		}));
}

/**
 * «00:03», «01:12», «1:02:05» y, si no cae en un segundo justo, con la décima:
 * «00:03,5» (si no, un rango de 2,1 a 2,9 s diría «00:02 – 00:02»). El tiempo de
 * una punta del rango, para el pie de Exportar.
 */
export function tiempoDeRango(segundos: number): string {
	const decimas = Math.max(0, Math.floor(segundos * 10 + 1e-6));
	const total = Math.floor(decimas / 10);
	const decima = decimas % 10;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const dos = (n: number) => String(n).padStart(2, "0");
	const base = h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
	return decima > 0 ? `${base},${decima}` : base;
}
