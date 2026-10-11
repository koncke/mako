// =============================================================================
// Las LUT importadas: la biblioteca de Ajuste › LUT, por workspace
// =============================================================================
// En CapCut una LUT importada queda en la biblioteca (no en el proyecto) y se
// usa desde Ajuste › LUT (como capa) o desde Ajustar › LUT (en un clip). Acá
// igual: los datos van a IndexedDB con el prefijo del workspace (espacio.ts,
// vía IndexedDBAdapter) y el efecto `ajuste` guarda sólo el id en `params.lut`.
// Así un proyecto no carga 140 KB de LUT por cada clip que la usa, ni los copia
// en cada paso de deshacer.
//
// Al cargarse, cada LUT se registra en pases-ce.ts (`registrarLut`); hasta que
// carga, el pase usa la identidad, y al terminar se pide un redibujo. Si el id
// de un proyecto no está (se borró de la biblioteca), el panel lo dice con el
// texto de CapCut («Pérdida de LUT») y el cuadro sale sin LUT.

import { useSyncExternalStore } from "react";
import { conEspacio } from "@/app/video-editor/espacio";
import { IndexedDBAdapter } from "@/app/video-editor/_opencut/services/storage/indexeddb-adapter";
import { registrarLut } from "@/app/video-editor/_opencut/services/renderer/pases-ce";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import { leerArchivoLut, LUT_NO_COMPATIBLE } from "./leer-lut";

export type LutDeBiblioteca = { id: string; nombre: string; tamano: number; creada: number };

type LutGuardada = Omit<LutDeBiblioteca, "id"> & { rgba: ArrayBuffer };

const almacen = new IndexedDBAdapter<LutGuardada>({ dbName: "video-editor-luts", storeName: "luts" });

type Estado = { luts: LutDeBiblioteca[]; cargada: boolean };

let estado: Estado = { luts: [], cargada: false };
let espacioCargado: string | null = null;
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function emitir(siguiente: Estado) {
	estado = siguiente;
	for (const fn of oyentes) fn();
}

function suscribir(fn: () => void) {
	oyentes.add(fn);
	return () => oyentes.delete(fn);
}

/** Pide un redibujo del reproductor (la LUT recién cargada cambia el cuadro). */
async function redibujar() {
	try {
		const { EditorCore } = await import("@/app/video-editor/_opencut/core");
		const editor = EditorCore.getInstance();
		editor.renderer.setRenderTree({ renderTree: editor.renderer.getRenderTree() });
	} catch {
		// Sin editor (la miniatura de la biblioteca): no hay nada que redibujar.
	}
}

/** Carga la biblioteca del workspace actual (una vez; de nuevo si cambió el workspace). */
export function asegurarLuts(): Promise<void> {
	if (typeof indexedDB === "undefined") return Promise.resolve();
	const espacio = conEspacio("");
	if (espacioCargado === espacio && cargando) return cargando;
	espacioCargado = espacio;
	cargando = (async () => {
		try {
			const ids = await almacen.list();
			const luts: LutDeBiblioteca[] = [];
			for (const id of ids) {
				const guardada = await almacen.get(id);
				if (!guardada) continue;
				registrarLut({ clave: id, tamano: guardada.tamano, rgba: new Uint8Array(guardada.rgba) });
				luts.push({ id, nombre: guardada.nombre, tamano: guardada.tamano, creada: guardada.creada });
			}
			luts.sort((a, b) => b.creada - a.creada);
			emitir({ luts, cargada: true });
			void redibujar();
		} catch (error) {
			console.error("[luts] no se pudo leer la biblioteca de LUT", error);
			emitir({ luts: [], cargada: true });
		}
	})();
	return cargando;
}

/**
 * Importa archivos .cube/.3dl. Devuelve los que entraron y los nombres de los
 * que no (para el aviso «Se detectaron archivos LUT no compatibles»).
 */
export async function importarLuts(archivos: File[]): Promise<{ nuevas: LutDeBiblioteca[]; fallidos: string[] }> {
	await asegurarLuts();
	const nuevas: LutDeBiblioteca[] = [];
	const fallidos: string[] = [];
	for (const archivo of archivos) {
		try {
			const { tamano, rgba } = await leerArchivoLut(archivo);
			const id = generateUUID();
			const nombre = archivo.name.replace(/\.(cube|3dl)$/i, "");
			const creada = Date.now();
			await almacen.set({
				key: id,
				value: { nombre, tamano, creada, rgba: rgba.buffer.slice(0) as ArrayBuffer },
			});
			registrarLut({ clave: id, tamano, rgba });
			nuevas.push({ id, nombre, tamano, creada });
		} catch (error) {
			if (!(error instanceof Error && error.message === LUT_NO_COMPATIBLE)) {
				console.error("[luts] no se pudo importar", archivo.name, error);
			}
			fallidos.push(archivo.name);
		}
	}
	if (nuevas.length > 0) emitir({ ...estado, luts: [...nuevas, ...estado.luts] });
	return { nuevas, fallidos };
}

export async function eliminarLut(id: string): Promise<void> {
	await almacen.remove(id);
	emitir({ ...estado, luts: estado.luts.filter((l) => l.id !== id) });
}

export function lutDeBiblioteca(id: string): LutDeBiblioteca | undefined {
	return estado.luts.find((l) => l.id === id);
}

export function useBibliotecaLuts(): Estado {
	return useSyncExternalStore(suscribir, () => estado, () => estado);
}
