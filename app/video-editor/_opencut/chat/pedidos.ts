// =============================================================================
// chat/pedidos — los pedidos SUELTOS en el chat «Editar con IA»: lo que no es del proyecto abierto
// =============================================================================
// Martín, 16/10/2026 (textual en docs/diseno-mako-pedidos.md): que todo chat entienda «feedback sobre lo actual… y
// también créame otra…», «la otra», y un pedido de otra tab («que el chat le deje ahí el link»). El chat le pregunta a
// POST /api/mako/pedidos ANTES de mandarle el pedido a su IA (PanelChat.tsx → `pedirEdicion`): lo del proyecto abierto
// sigue por el camino de siempre y lo demás vuelve como una burbuja de MaKo, con su link. Acá, lo PURO de eso
// (tests/video-editor-pedidos-chat.test.ts).
//
//   · LOS PROYECTOS LOS MANDA EL NAVEGADOR (`objetos`): viven en IndexedDB y el servidor no los tiene (la ruta los
//     valida, `objetosDelNavegador`). Salen de `storageService.loadAllProjectsMetadata()`.
//   · LA RESPUESTA SE VALIDA CON LA REGLA DEL WEB GENERATOR (`interpretacionDe`, el primer chat que se enganchó): si
//     la ruta falla, tarda o vuelve con otra forma, el mensaje ENTERO va a la IA del chat, como antes.
//   · ⚠️ BORRAR UN PROYECTO NO SE HACE DESDE EL CHAT. En el editor un proyecto borrado no va a una papelera: se va con
//     su material. La burbuja dice dónde se borra (el inicio) y deja el link; el abierto, igual.
//   · Crear otro proyecto es un link a `/video-editor/nuevo` (el editor arma uno y cambia la URL); con algo del
//     abierto en el mismo mensaje, primero la pregunta «¿Terminamos esto y después…?», como en el Web Generator.
//
// Sólo TIPOS de lib/mako-pedidos.ts: ese módulo no es para el navegador (lo dice su cabecera).
// =============================================================================

import type { Interpretacion, ObjetoChat } from "@/lib/mako-pedidos";

export { interpretacionDe, textoActual } from "@/app/web-generator/editor/pedidos-chat";

/** Cuánto se espera a la ruta (la del Web Generator: lee la sesión y la vista; la IA tiene 7,5 s). */
export const PLAZO_PEDIDOS_MS = 12_000;

/** Los proyectos del navegador, como los pide la ruta (`objetos`), el último tocado arriba. */
export function objetosDeProyectos(metas: ReadonlyArray<{ id: string; name: string; updatedAt: Date | string }>): ObjetoChat[] {
	return [...metas]
		.map((p) => ({ id: p.id, nombre: p.name, tocadoAt: new Date(p.updatedAt).toISOString() }))
		.sort((a, b) => (a.tocadoAt < b.tocadoAt ? 1 : a.tocadoAt > b.tocadoAt ? -1 : 0))
		.slice(0, 200);
}

/** El cuerpo de POST /api/mako/pedidos para el chat del editor. */
export function cuerpoPedidos(texto: string, proyecto: { id: string; nombre: string }, objetos: readonly ObjetoChat[]) {
	return { texto: texto.trim(), tab: "video" as const, actualId: proyecto.id, actualNombre: proyecto.nombre.trim(), objetos };
}

export type LinkBurbuja = { texto: string; href: string };
/** Una burbuja de MaKo: lo que dice y a dónde lleva. */
export type BurbujaPedido = { texto: string; links: LinkBurbuja[] };

export const TEXTOS = {
	propuesta: "¿Terminamos esto y después creamos otro proyecto?",
	directa: "Eso va en un proyecto nuevo.",
	crear: "Crear un proyecto",
	cual: "¿Cuál? Dime su nombre.",
	abiertoBorrar: "Este proyecto está abierto: se borra desde el inicio del editor.",
	inicio: "Ir al inicio",
} as const;

export const RUTA_INICIO = "/video-editor";
export const RUTA_NUEVO = "/video-editor/nuevo";
const ID = /^[A-Za-z0-9_-]{1,100}$/;
/** El editor de un proyecto del navegador (el ?ws= lo pega el `Link` de app/_ui/Link al dibujarlo). */
export const rutaDeProyecto = (o: ObjetoChat): string | null => (ID.test(o.id) ? `/video-editor/${o.id}` : null);

const corto = (o: ObjetoChat, max = 60): string => {
	const n = (o.nombre ?? "").replace(/\s+/g, " ").trim() || "Sin título";
	return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
};
/** Un link de la ruta es de ADENTRO de la app: `/algo`, nunca `//otro.com` ni `javascript:`. */
const esInterno = (v: string): boolean => /^\/(?!\/)/.test(v) && !/[\s<>"]/.test(v);

/**
 * Una burbuja por cada pedido que NO es del proyecto abierto, en el orden del mensaje. Sin un proyecto claro ni dos
 * candidatos, se pregunta el nombre: nunca se elige el primero de una lista.
 */
export function burbujasDe(i: Interpretacion, actualId: string): BurbujaPedido[] {
	const hayActual = i.pedidos.some((p) => p.sobre === "actual");
	const primero = i.pedidos.find((p) => p.sobre !== "actual");
	return i.pedidos.flatMap((p): BurbujaPedido[] => {
		if (p.sobre === "actual") return [];
		if (p.sobre === "nuevo") {
			const texto = hayActual ? (p === primero && i.propuesta?.texto) || TEXTOS.propuesta : TEXTOS.directa;
			return [{ texto, links: [{ texto: TEXTOS.crear, href: RUTA_NUEVO }] }];
		}
		if (p.sobre === "otra-tab") return esInterno(p.link) ? [{ texto: `Eso se hace en ${p.titulo}.`, links: [{ texto: `Ir a ${p.titulo}`, href: p.link }] }] : [];
		if (p.verbo === "borrar" && p.objeto?.id === actualId) return [{ texto: TEXTOS.abiertoBorrar, links: [{ texto: TEXTOS.inicio, href: RUTA_INICIO }] }];
		const objetos = (p.objeto ? [p.objeto] : p.candidatos).filter((o) => o.id !== actualId && rutaDeProyecto(o));
		const claro = !!p.objeto && objetos.length === 1;
		const dos = !p.objeto && objetos.length === 2;
		if (!claro && !dos) return [{ texto: TEXTOS.cual, links: [] }];
		if (p.verbo === "borrar") {
			const nombres = objetos.map((o) => `«${corto(o)}»`).join(" o ");
			return [{ texto: `${nombres} se borra desde el inicio del editor.`, links: [{ texto: TEXTOS.inicio, href: RUTA_INICIO }] }];
		}
		const texto = objetos.length === 2 ? `¿Cuál: «${corto(objetos[0])}» o «${corto(objetos[1])}»?` : `Eso va en «${corto(objetos[0])}».`;
		return [{ texto, links: objetos.map((o) => ({ texto: `Abrir «${corto(o, 28)}»`, href: rutaDeProyecto(o)! })) }];
	});
}
