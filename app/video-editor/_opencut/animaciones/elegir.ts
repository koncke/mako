// =============================================================================
// Animación: qué se escribe al ELEGIR una o al cambiarle la duración
// =============================================================================
// Las reglas de CapCut al elegir, que van en UN paso de deshacer junto con la
// elección (antes vivían adentro de la pestaña; salieron acá para que el chat
// «Editar con IA» las cumpla igual que el panel — chat/comandos.ts):
//   · Combinado excluye Entrada y Salida (y al revés).
//   · Entrada + Salida no pasan el largo del clip: la que se toca manda y la
//     otra se acorta.
//   · Elegir otro preset vuelve la duración a la del preset (0,5 s casi todas;
//     el Combinado, el clip entero).
//   · El Bucle no tiene «Duración» sino el largo de cada vuelta («Velocidad»,
//     hasta 5 s): puede durar más que el clip.
//
// Puro (sin React ni editor): lo usan animaciones/components/pestana-animacion.tsx,
// app/video-editor/_opencut/chat/{linea,comandos}.ts y tiene test
// (tests/video-editor-chat.test.ts).

import type { ParamValue, ParamValues } from "@/app/video-editor/_opencut/params";
import type { ElementType } from "@/app/video-editor/_opencut/timeline";
import { ANIM, categoriasPara } from "@/app/video-editor/_opencut/params/extra/animaciones";
import { ID_NINGUNO, presetAnimacion, type CategoriaAnimacion } from "./catalogo";

/** Lo mínimo que deja el deslizador de «Duración». */
export const DURACION_MINIMA_ANIMACION = 0.1;
/** El tope de «Velocidad» del Bucle (segundos por vuelta). */
export const VUELTA_MAXIMA_BUCLE = 5;

const redondear = (s: number) => Math.round(s * 10) / 10;

/** El clip como lo ve la regla: sus params (o los valores del panel), su tipo y su largo en segundos. */
export type ClipAnimado = { valores: ParamValues; tipo: ElementType; D: number };

function lector({ valores, tipo }: ClipAnimado) {
	const declaradas = categoriasPara(tipo);
	const declarada = (c: CategoriaAnimacion) => declaradas.includes(c);
	const idDe = (c: CategoriaAnimacion) => String(valores[ANIM[c].id] ?? ID_NINGUNO);
	const activa = (c: CategoriaAnimacion) => declarada(c) && presetAnimacion(c, idDe(c)) !== null;
	const duracionDe = (c: CategoriaAnimacion) => {
		const v = valores[ANIM[c].duracion];
		return typeof v === "number" ? v : (presetAnimacion(c, idDe(c))?.duracion ?? 0.5);
	};
	return { declarada, activa, duracionDe };
}

/** Lo que hay que escribir para que Entrada + Salida entren en el clip. */
function ajustarLaOtra(clip: ClipAnimado, categoria: CategoriaAnimacion, cambios: Record<string, ParamValue>, duracion: number) {
	const { activa, duracionDe } = lector(clip);
	const otra: CategoriaAnimacion | null =
		categoria === "entrada" ? "salida" : categoria === "salida" ? "entrada" : null;
	if (otra && activa(otra) && duracion + duracionDe(otra) > clip.D) {
		cambios[ANIM[otra].duracion] = redondear(Math.max(DURACION_MINIMA_ANIMACION, clip.D - duracion));
	}
}

/** Elegir el preset `id` (o «Ninguno») en `categoria`. */
export function cambiosAlElegir(clip: ClipAnimado, categoria: CategoriaAnimacion, id: string): Record<string, ParamValue> {
	const { declarada, activa } = lector(clip);
	const cambios: Record<string, ParamValue> = { [ANIM[categoria].id]: id };
	const preset = presetAnimacion(categoria, id);
	if (preset) {
		const duracion = redondear(
			Math.max(DURACION_MINIMA_ANIMACION, Math.min(clip.D, categoria === "combo" ? clip.D : preset.duracion)),
		);
		cambios[ANIM[categoria].duracion] = duracion;
		if (categoria === "combo") {
			if (declarada("entrada")) cambios[ANIM.entrada.id] = ID_NINGUNO;
			if (declarada("salida")) cambios[ANIM.salida.id] = ID_NINGUNO;
		} else if ((categoria === "entrada" || categoria === "salida") && activa("combo")) {
			cambios[ANIM.combo.id] = ID_NINGUNO;
		}
		ajustarLaOtra(clip, categoria, cambios, duracion);
	}
	return cambios;
}

/** El tope de la duración de `categoria` en este clip (el Bucle, por vuelta). */
export function duracionMaximaAnimacion(clip: Pick<ClipAnimado, "D">, categoria: CategoriaAnimacion): number {
	return categoria === "bucle" ? VUELTA_MAXIMA_BUCLE : clip.D;
}

/** Cambiar la duración de la animación de `categoria` (acotada como el deslizador). */
export function cambiosDeDuracion(clip: ClipAnimado, categoria: CategoriaAnimacion, segundos: number): Record<string, ParamValue> {
	const maximo = duracionMaximaAnimacion(clip, categoria);
	const duracion = redondear(Math.max(DURACION_MINIMA_ANIMACION, Math.min(maximo, segundos)));
	const cambios: Record<string, ParamValue> = { [ANIM[categoria].duracion]: duracion };
	ajustarLaOtra(clip, categoria, cambios, duracion);
	return cambios;
}
