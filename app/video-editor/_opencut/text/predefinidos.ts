// =============================================================================
// «Guardar como parámetro predefinido»: los estilos de texto que guarda el cliente
// =============================================================================
// CapCut los guarda en su cuenta («Mis elementos predefinidos», hasta 200). Acá
// viven en el navegador (localStorage), con el prefijo del workspace: el super
// admin abre varios clientes en el mismo navegador y uno no puede ver los
// estilos del otro (app/video-editor/espacio.ts). Que se pierdan al borrar los
// datos del sitio es lo mismo que pasa con los proyectos (diseño §1.5).
//
// Lo leen la pestaña Texto › Efectos y Biblioteca › Texto › Efectos de texto
// con `useEstilosGuardados`; la lista es la misma, y guardar en una la muestra
// en la otra sin recargar.

import { useSyncExternalStore } from "react";
import { conEspacio } from "@/app/video-editor/espacio";
import type { ParamValue } from "@/app/video-editor/_opencut/params";
import type { ParamsTexto } from "./estilos-predefinidos";

export type EstiloGuardado = {
	id: string;
	nombre: string;
	params: ParamsTexto;
	creado: number;
};

/** `pc_brand_text_preset_twohundred`: «Puedes agregar hasta 200 textos predefinidos». */
export const MAXIMO_ESTILOS = 200;

const NOMBRE = "ve-textos-predefinidos";
const VACIO: EstiloGuardado[] = [];

let cache: { clave: string; lista: EstiloGuardado[] } | null = null;
const oyentes = new Set<() => void>();

function esValor(v: unknown): v is ParamValue {
	return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function leer(clave: string): EstiloGuardado[] {
	try {
		const crudo = localStorage.getItem(clave);
		if (!crudo) return VACIO;
		const datos: unknown = JSON.parse(crudo);
		if (!Array.isArray(datos)) return VACIO;
		// Lo guardado puede venir de otra versión: sólo lo que tiene la forma.
		return datos.flatMap((d): EstiloGuardado[] => {
			if (!d || typeof d !== "object") return [];
			const { id, nombre, params, creado } = d as Record<string, unknown>;
			if (typeof id !== "string" || !params || typeof params !== "object") return [];
			const limpios = Object.fromEntries(
				Object.entries(params as Record<string, unknown>).filter(([, v]) => esValor(v)),
			) as ParamsTexto;
			return [
				{
					id,
					nombre: typeof nombre === "string" ? nombre : "",
					params: limpios,
					creado: typeof creado === "number" ? creado : 0,
				},
			];
		});
	} catch {
		return VACIO;
	}
}

function instantanea(): EstiloGuardado[] {
	const clave = conEspacio(NOMBRE);
	if (!cache || cache.clave !== clave) cache = { clave, lista: leer(clave) };
	return cache.lista;
}

function escribir(lista: EstiloGuardado[]): boolean {
	const clave = conEspacio(NOMBRE);
	try {
		localStorage.setItem(clave, JSON.stringify(lista));
	} catch {
		return false;
	}
	cache = { clave, lista };
	for (const o of oyentes) o();
	return true;
}

function suscribir(oyente: () => void): () => void {
	oyentes.add(oyente);
	// Otra pestaña del mismo cliente guardó uno: se relee.
	const deOtraPestana = (e: StorageEvent) => {
		if (e.key === conEspacio(NOMBRE)) {
			cache = null;
			oyente();
		}
	};
	window.addEventListener("storage", deOtraPestana);
	return () => {
		oyentes.delete(oyente);
		window.removeEventListener("storage", deOtraPestana);
	};
}

export function useEstilosGuardados(): EstiloGuardado[] {
	return useSyncExternalStore(suscribir, instantanea, () => VACIO);
}

export type ResultadoGuardar = "guardado" | "lleno" | "error";

/** El más nuevo va primero, como en CapCut. */
export function guardarEstilo({ nombre, params }: { nombre: string; params: ParamsTexto }): ResultadoGuardar {
	const actual = instantanea();
	if (actual.length >= MAXIMO_ESTILOS) return "lleno";
	const nuevo: EstiloGuardado = {
		id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
		nombre,
		params,
		creado: Date.now(),
	};
	return escribir([nuevo, ...actual]) ? "guardado" : "error";
}

export function borrarEstilo(id: string): void {
	escribir(instantanea().filter((e) => e.id !== id));
}
