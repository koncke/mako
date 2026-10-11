// =============================================================================
// «Mis elementos predefinidos» de Ajuste: los ajustes guardados, por workspace
// =============================================================================
// En CapCut, Ajustar › «Guardar como parámetro predefinido» guarda los valores
// del ajuste y aparecen en la biblioteca, Ajuste › Mis elementos predefinidos,
// listos para agregar como capa. Son de la persona, no del proyecto: van a
// IndexedDB con el prefijo del workspace, como las LUT.

import { useSyncExternalStore } from "react";
import { conEspacio } from "@/app/video-editor/espacio";
import { IndexedDBAdapter } from "@/app/video-editor/_opencut/services/storage/indexeddb-adapter";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";

export type AjustePredefinido = { id: string; nombre: string; params: ParamValues; creado: number };

const almacen = new IndexedDBAdapter<Omit<AjustePredefinido, "id">>({
	dbName: "video-editor-ajustes",
	storeName: "predefinidos",
});

let lista: AjustePredefinido[] = [];
let espacioCargado: string | null = null;
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function emitir(siguiente: AjustePredefinido[]) {
	lista = siguiente;
	for (const fn of oyentes) fn();
}

export function asegurarPredefinidos(): Promise<void> {
	if (typeof indexedDB === "undefined") return Promise.resolve();
	const espacio = conEspacio("");
	if (espacioCargado === espacio && cargando) return cargando;
	espacioCargado = espacio;
	cargando = (async () => {
		try {
			const ids = await almacen.list();
			const todos: AjustePredefinido[] = [];
			for (const id of ids) {
				const p = await almacen.get(id);
				if (p) todos.push({ id, nombre: p.nombre, params: p.params, creado: p.creado });
			}
			emitir(todos.sort((a, b) => b.creado - a.creado));
		} catch (error) {
			console.error("[ajustes] no se pudieron leer los elementos predefinidos", error);
		}
	})();
	return cargando;
}

/** Guarda los params de un ajuste. El nombre sigue la cuenta («Ajuste 3»). */
export async function guardarPredefinido(params: ParamValues): Promise<AjustePredefinido> {
	await asegurarPredefinidos();
	const usados = new Set(lista.map((p) => p.nombre));
	let n = lista.length + 1;
	while (usados.has(`Ajuste ${n}`)) n++;
	const nuevo: AjustePredefinido = { id: generateUUID(), nombre: `Ajuste ${n}`, params, creado: Date.now() };
	await almacen.set({ key: nuevo.id, value: { nombre: nuevo.nombre, params, creado: nuevo.creado } });
	emitir([nuevo, ...lista]);
	return nuevo;
}

export async function eliminarPredefinido(id: string): Promise<void> {
	await almacen.remove(id);
	emitir(lista.filter((p) => p.id !== id));
}

function suscribir(fn: () => void) {
	oyentes.add(fn);
	return () => oyentes.delete(fn);
}

export function usePredefinidos(): AjustePredefinido[] {
	return useSyncExternalStore(suscribir, () => lista, () => lista);
}
