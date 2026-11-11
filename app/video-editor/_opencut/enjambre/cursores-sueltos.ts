// =============================================================================
// enjambre/cursores-sueltos — los cursores de los agentes cuando MaKo edita FUERA de la «Edición automática»
// =============================================================================
// Martín (11/11/2026), mirando las capturas de producción: los cursores son «súper importante que esté en todo
// momento. Porque es lo que hace atractivo justamente a esta funcionalidad de edición». Hasta ese día sólo salían con
// la Edición automática: un cambio del chat, «Sí, en el feed», el botón de Subtítulos o el del B-roll editaban sin un
// cursor a la vista. Acá:
//   · lo que aplica el chat (`mostrarCursores`, desde ../chat/PanelChat.tsx): el agente de cada operación, a la vista
//     mientras se aplica y, como mínimo, `A_LA_VISTA_MS` (un cambio de un solo comando es instantáneo: sin el mínimo,
//     el cursor no llegaba ni a salir de su lugar);
//   · los trabajos largos con su propio estado (subtítulos, B-roll, clips mágicos): su agente, mientras su fase no es
//     «inactivo» (`agentesSueltos`, que lee ./components/cursores.tsx).
// Mientras corre la Edición automática se dibuja ésa (sus agentes ya dicen qué hacen): éstos no se suman.
// =============================================================================

import { create } from "zustand";
import type { OperacionChat } from "@/lib/editor-video/chat-catalogo";
import { AGENTES, type AgenteId } from "./plan";

/** Lo mínimo que se ve un cursor prendido por el chat: lo que tarda en llegar (520 ms) y que se lo vea trabajando. */
export const A_LA_VISTA_MS = 1600;

/**
 * El agente de cada cambio del chat, por su rol (./plan.ts, AGENTES). La edición automática no tiene: dibuja los
 * suyos, uno por paso.
 */
export const AGENTE_DE_OPERACION: Partial<Record<OperacionChat["op"], AgenteId>> = {
	borrar_silencios: "corte-01",
	cortar_tramo: "corte-01",
	dividir: "corte-01",
	recortar: "corte-01",
	borrar: "corte-01",
	duracion: "corte-01",
	mover: "corte-01",
	duplicar: "corte-01",
	congelar: "corte-01",
	revertir: "corte-01",
	eliminar_muletillas: "corte-02",
	cortar_frase: "corte-02",
	generar_subtitulos: "subs-01",
	reemplazar_en_subtitulos: "subs-01",
	agregar_texto: "subs-01",
	cambiar_texto: "subs-01",
	emojis_subtitulos: "subs-01",
	agregar_emoji: "subs-01",
	usar_preset_subtitulos: "subs-03",
	estilo_texto: "subs-03",
	efecto_texto: "subs-03",
	animar_palabras: "subs-03",
	usar_plantilla: "subs-03",
	resaltar_palabras: "subs-02",
	broll: "broll-01",
	cambiar_broll: "broll-01",
	clips_magicos: "broll-01",
	reemplazar_clip: "broll-01",
	transformar: "gfx-01",
	reflejar: "gfx-01",
	encuadre: "gfx-01",
	velocidad: "gfx-01",
	transicion: "gfx-01",
	animacion: "gfx-01",
	filtro: "gfx-01",
	efecto: "gfx-01",
	capa_efecto: "gfx-01",
	ajustar_color: "gfx-01",
	agregar_motion: "gfx-01",
	editar_motion: "gfx-01",
	fondo_lienzo: "gfx-01",
	ocultar: "gfx-01",
	reducir_ruido: "mezcla-01",
	separar_audio: "mezcla-01",
	volumen: "mezcla-02",
	silenciar: "mezcla-02",
	fundido: "mezcla-02",
	normalizar: "mezcla-02",
};

/** Los agentes de unos cambios, sin repetir y en el orden de AGENTES. */
export function agentesDeOperaciones(operaciones: readonly { op: OperacionChat["op"] }[]): AgenteId[] {
	const usados = new Set(operaciones.map((o) => AGENTE_DE_OPERACION[o.op]));
	return AGENTES.map((a) => a.id).filter((id) => usados.has(id));
}

/** Los cursores sueltos de ahora: los del chat y los de cada trabajo largo en marcha, en el orden de AGENTES. */
export function agentesSueltos(t: { delChat: readonly AgenteId[]; subtitulando: boolean; brolleando: boolean; recortando: boolean }): AgenteId[] {
	const usados = new Set<AgenteId>(t.delChat);
	if (t.subtitulando) usados.add("subs-01");
	if (t.brolleando) usados.add("broll-01");
	if (t.recortando) usados.add("corte-01");
	return AGENTES.map((a) => a.id).filter((id) => usados.has(id));
}

/** Los agentes que prendió el chat (cada uno, mientras alguno de sus cambios siga aplicándose o a la vista). */
export const useCursoresSueltos = create<{ delChat: AgenteId[] }>()(() => ({ delChat: [] }));

const prendidos = new Map<AgenteId, number>();
const publicar = () => useCursoresSueltos.setState({ delChat: [...prendidos.keys()] });

/**
 * Prende los cursores de `agentes`. Lo que devuelve los apaga, pero no antes de `A_LA_VISTA_MS` desde que se
 * prendieron (dos cambios a la vez con el mismo agente: queda prendido hasta que se apaguen los dos).
 */
export function mostrarCursores(agentes: readonly AgenteId[]): () => void {
	if (!agentes.length) return () => {};
	for (const a of agentes) prendidos.set(a, (prendidos.get(a) ?? 0) + 1);
	publicar();
	const desde = Date.now();
	let apagado = false;
	return () => {
		if (apagado) return;
		apagado = true;
		setTimeout(
			() => {
				for (const a of agentes) {
					const n = (prendidos.get(a) ?? 1) - 1;
					if (n > 0) prendidos.set(a, n);
					else prendidos.delete(a);
				}
				publicar();
			},
			Math.max(0, A_LA_VISTA_MS - (Date.now() - desde)),
		);
	};
}
