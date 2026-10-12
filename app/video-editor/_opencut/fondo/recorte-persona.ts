// =============================================================================
// «Eliminación automática»: el gancho de FUENTE que recorta a la persona
// =============================================================================
// Con `fondo.automatico` prendido (params/extra/fondo.ts), cada cuadro de un
// video o una imagen sale con el fondo transparente: se achica el cuadro, se
// segmenta (./segmentador.ts), la confianza pasa a alfa (./mascara.ts) y la
// máscara se estira al tamaño del cuadro y se aplica con `destination-in`.
//
// Orden 20: DESPUÉS del recorte (10, recorte/ganchos.ts), así se segmenta lo
// que queda del cuadro recortado, y ANTES de los pases `ce-*` (croma, filtros,
// ajustes), que se aplican después de todos los ganchos (frame-descriptor.ts).
//
// El reproductor y el export pasan por el mismo gancho, así que el MP4 sale como
// se ve. `preparar` hace que el render ESPERE al modelo la primera vez (bajarlo
// lleva unos segundos): sin eso, los primeros cuadros de un export saldrían sin
// recortar.
//
// Lienzos de salida: DOS por clip, alternados, como el recorte. El compositor
// no vuelve a subir una textura si llega el MISMO objeto con la misma versión
// (diseño §4.1): con un solo lienzo reusado, un cambio sin cambiar de cuadro (o
// un video en pausa) mostraría lo viejo. Una IMAGEN sí devuelve el mismo lienzo
// mientras su fuente sea el mismo objeto: no se vuelve a segmentar por nada.

import { registrarGanchoFuente, type ContextoFuente } from "@/app/video-editor/_opencut/services/renderer/ganchos-ce";
import { FONDO_AUTOMATICO } from "@/app/video-editor/_opencut/params/extra/fondo";
import { cargarSegmentador, estadoSegmentador, segmentarPersona } from "./segmentador";
import { mascaraPersona, tamanoSegmentacion } from "./mascara";

type Lienzo = OffscreenCanvas | HTMLCanvasElement;
type Contexto2d = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function crearLienzo(w: number, h: number): Lienzo {
	if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

function medida(lienzo: Lienzo, w: number, h: number): void {
	if (lienzo.width !== w || lienzo.height !== h) {
		lienzo.width = w;
		lienzo.height = h;
	}
}

function ctx2d(lienzo: Lienzo): Contexto2d | null {
	return lienzo.getContext("2d") as Contexto2d | null;
}

export function quiereRecorte(ctx: ContextoFuente): boolean {
	return (ctx.tipo === "video" || ctx.tipo === "image") && ctx.params[FONDO_AUTOMATICO] === true;
}

// ── Lo compartido por todos los clips ────────────────────────────────────────
// La segmentación es sincrónica: entre que se dibuja el cuadro chico y se lee
// la máscara no corre nadie más, así que alcanza con un juego.

let chico: Lienzo | null = null;
let mascara: Lienzo | null = null;
let datosMascara: ImageData | null = null;
let tmp = new Float32Array(0);

// ── Lo de cada clip ──────────────────────────────────────────────────────────

type Entrada = { lienzos: Lienzo[]; turno: number; fuente: unknown; clave: string };
const porClip = new Map<string, Entrada>();

/**
 * Tope de clips con lienzos guardados. Cada uno son dos lienzos del tamaño del
 * cuadro (a 1080p, 16 MB), y un clip borrado o que ya pasó no avisa: sin tope se
 * acumulaban. En pantalla a la vez hay pocos (una transición son dos), y sacar
 * uno sólo cuesta volver a crear sus lienzos la próxima vez que se dibuje.
 */
const TOPE_CLIPS = 6;

function entradaDe(id: string): Entrada {
	let entrada = porClip.get(id);
	if (entrada) {
		// Al final del Map = el usado más recién: el tope saca el más viejo.
		porClip.delete(id);
		porClip.set(id, entrada);
		return entrada;
	}
	entrada = { lienzos: [], turno: 0, fuente: null, clave: "" };
	porClip.set(id, entrada);
	while (porClip.size > TOPE_CLIPS) {
		const masViejo = porClip.keys().next().value;
		if (masViejo === undefined) break;
		porClip.delete(masViejo);
	}
	return entrada;
}

function siguienteLienzo(entrada: Entrada, w: number, h: number): Lienzo {
	entrada.turno = (entrada.turno + 1) % 2;
	let lienzo = entrada.lienzos[entrada.turno];
	if (!lienzo) {
		lienzo = crearLienzo(w, h);
		entrada.lienzos[entrada.turno] = lienzo;
	}
	medida(lienzo, w, h);
	return lienzo;
}

registrarGanchoFuente({
	id: "ce-fondo-automatico",
	orden: 20,
	preparar: (ctx) => {
		if (!quiereRecorte(ctx)) return;
		const estado = estadoSegmentador();
		if (estado === "listo" || estado === "fallo") return;
		return cargarSegmentador().then(() => undefined);
	},
	aplicar: (fuente, ctx) => {
		const idClip = ctx.elementoId ?? "sin-id";
		if (!quiereRecorte(ctx)) {
			// Apagado: se olvida lo guardado. Si se vuelve a prender, la fuente puede
			// ser el mismo objeto con OTRO contenido (el recorte alterna dos lienzos).
			porClip.delete(idClip);
			return null;
		}
		const w = Math.round(fuente.width);
		const h = Math.round(fuente.height);
		if (w <= 0 || h <= 0) return null;

		const entrada = entradaDe(idClip);
		const clave = `${w}x${h}`;
		if (ctx.tipo === "image" && entrada.fuente === fuente.source && entrada.clave === clave) {
			const actual = entrada.lienzos[entrada.turno];
			if (actual) return { source: actual as CanvasImageSource, width: w, height: h };
		}

		// 1. El cuadro, chico.
		const t = tamanoSegmentacion(w, h);
		chico ??= crearLienzo(t.ancho, t.alto);
		medida(chico, t.ancho, t.alto);
		const cChico = ctx2d(chico);
		if (!cChico) return null;
		cChico.clearRect(0, 0, t.ancho, t.alto);
		cChico.drawImage(fuente.source, 0, 0, t.ancho, t.alto);

		// 2. La máscara, al alfa de un ImageData del mismo tamaño.
		if (!datosMascara || datosMascara.width !== t.ancho || datosMascara.height !== t.alto) {
			datosMascara = new ImageData(t.ancho, t.alto);
		}
		if (tmp.length !== t.ancho * t.alto) tmp = new Float32Array(t.ancho * t.alto);
		const destino = datosMascara;
		let valida = false;
		const ok = segmentarPersona(chico, ({ confianza, esDeFondo }) => {
			if (confianza.length !== t.ancho * t.alto) {
				console.warn(`[fondo] la máscara mide ${confianza.length}, esperaba ${t.ancho}×${t.alto}`);
				return;
			}
			mascaraPersona({ confianza, esDeFondo, ancho: t.ancho, alto: t.alto, rgba: destino.data, tmp });
			valida = true;
		});
		if (!ok || !valida) return null;
		mascara ??= crearLienzo(t.ancho, t.alto);
		medida(mascara, t.ancho, t.alto);
		const cMascara = ctx2d(mascara);
		if (!cMascara) return null;
		cMascara.putImageData(destino, 0, 0);

		// 3. El cuadro entero con la máscara estirada (bilineal: el borde sale suave).
		const salida = siguienteLienzo(entrada, w, h);
		const c = ctx2d(salida);
		if (!c) return null;
		c.globalCompositeOperation = "source-over";
		c.clearRect(0, 0, w, h);
		c.drawImage(fuente.source, 0, 0, w, h);
		c.globalCompositeOperation = "destination-in";
		c.imageSmoothingEnabled = true;
		c.imageSmoothingQuality = "high";
		c.drawImage(mascara, 0, 0, w, h);
		c.globalCompositeOperation = "source-over";

		entrada.fuente = fuente.source;
		entrada.clave = clave;
		return { source: salida as CanvasImageSource, width: w, height: h };
	},
});
