// =============================================================================
// Los presets de subtítulos de la marca, en el editor
// =============================================================================
// Pedido de Leila (30/10/2026): «presets guardados por marca o por cliente». Se guardan
// en el NEGOCIO (/api/video-editor/presets, lib/editor-video/presets-subtitulos.ts), no
// en el navegador: los ve todo el equipo, en cualquier computadora. Acá:
//   · el store con la lista (se carga una vez al abrir Subtítulos y se refresca al guardar);
//   · un preset como PLANTILLA del editor (`plantillaDePreset`): sale en Subtítulos ›
//     Plantillas junto a las de fábrica, con el id «preset:<id>»;
//   · aplicar uno a TODOS los subtítulos: su estilo, el color de las palabras clave y,
//     si las elige solo, las claves con las palabras de la marca (un paso de deshacer).
//
// Un preset escribe SIEMPRE las palabras clave (en ninguna si no las usa), como una
// plantilla escribe siempre el trazo y el karaoke: si no, pasar de un preset con claves a
// uno sin ellas las dejaba.

import { create } from "zustand";
import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ParamValue } from "@/app/video-editor/_opencut/params";
import { PARAM_CLAVES_COLOR } from "@/app/video-editor/_opencut/params/extra/subtitulos";
import type { PresetSubtitulos } from "@/lib/editor-video/presets-subtitulos";
import { paramsDePlantilla, plantillaPorId, type Lienzo, type PlantillaSubtitulo } from "./estilos";
import { aplicarEstiloASubtitulos, clavesDeSubtitulos, lienzoDe, subtitulosDe, type ModoClaves } from "./insert";
import { PARAM_CLAVES } from "./claves";

export const PREFIJO_PRESET = "preset:";

type Estado = {
	presets: PresetSubtitulos[];
	estado: "sin-cargar" | "cargando" | "listo" | "error";
	cargar: (forzar?: boolean) => Promise<void>;
	guardar: (preset: Omit<PresetSubtitulos, "id" | "actualizado">, id?: string | null) => Promise<PresetSubtitulos | null>;
	borrar: (id: string) => Promise<boolean>;
};

async function pedir(url: string, init?: RequestInit): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
	try {
		const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
		const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
		if (!j) return { ok: false, error: "No se pudo leer la respuesta." };
		return { ...j, ok: r.ok && j.ok === true };
	} catch {
		return { ok: false, error: "Sin conexión con MaKo." };
	}
}

export const usePresetsSubtitulos = create<Estado>()((set, get) => ({
	presets: [],
	estado: "sin-cargar",
	cargar: async (forzar = false) => {
		const { estado } = get();
		if (estado === "cargando" || (estado === "listo" && !forzar)) return;
		set({ estado: "cargando" });
		const r = await pedir("/api/video-editor/presets", { cache: "no-store" });
		if (!r.ok) {
			set({ estado: "error" });
			return;
		}
		set({ estado: "listo", presets: (r.presets as PresetSubtitulos[]) ?? [] });
	},
	guardar: async (preset, id = null) => {
		const r = await pedir("/api/video-editor/presets", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ preset, id }),
		});
		if (!r.ok) {
			toast.error(r.error ?? "No se guardó el preset.");
			return null;
		}
		const nuevo = r.preset as PresetSubtitulos;
		set({ presets: [nuevo, ...get().presets.filter((p) => p.id !== nuevo.id)] });
		return nuevo;
	},
	borrar: async (id) => {
		const r = await pedir(`/api/video-editor/presets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
		if (!r.ok) {
			toast.error(r.error ?? "No se borró el preset.");
			return false;
		}
		set({ presets: get().presets.filter((p) => p.id !== id) });
		return true;
	},
}));

/** Un preset, como plantilla del editor (la miniatura y `paramsDePlantilla`). */
export function plantillaDePreset(p: PresetSubtitulos): PlantillaSubtitulo {
	return { id: `${PREFIJO_PRESET}${p.id}`, nombre: p.marca ? `${p.nombre} · ${p.marca}` : p.nombre, ...p.estilo };
}

/** El preset de un id de plantilla («preset:<id>»), si lo es y sigue estando. */
export function presetDeId(id: string | null | undefined, presets: readonly PresetSubtitulos[]): PresetSubtitulos | null {
	if (!id || !id.startsWith(PREFIJO_PRESET)) return null;
	const pid = id.slice(PREFIJO_PRESET.length);
	return presets.find((p) => p.id === pid) ?? null;
}

/** La plantilla elegida: una de fábrica o un preset de la marca (si se borró, la de por defecto). */
export function plantillaElegida(id: string | null | undefined, presets: readonly PresetSubtitulos[]): PlantillaSubtitulo {
	const p = presetDeId(id, presets);
	return p ? plantillaDePreset(p) : plantillaPorId(id);
}

/** Lo que escribe un preset en cada subtítulo, además de las claves. */
export function estiloDePreset(p: PresetSubtitulos, lienzo: Lienzo): Record<string, ParamValue> {
	return { ...paramsDePlantilla(plantillaDePreset(p), lienzo), [PARAM_CLAVES_COLOR]: p.claves.color };
}

/** Cómo elige las claves un preset: solas (con las de la marca), sólo las de la marca, o ninguna. */
export function modoClavesDePreset(p: PresetSubtitulos): ModoClaves {
	if (p.claves.auto) return { tipo: "auto", siempre: p.claves.siempre };
	return p.claves.siempre.length ? { tipo: "nombradas", palabras: p.claves.siempre } : { tipo: "ninguna" };
}

/** Aplica un preset a TODOS los subtítulos (estilo + palabras clave), en un solo paso de deshacer. Devuelve cuántos. */
export async function aplicarPreset(editor: EditorCore, p: PresetSubtitulos): Promise<number> {
	const lista = subtitulosDe(editor.scenes.getActiveSceneOrNull()?.tracks);
	const claves = clavesDeSubtitulos(lista, modoClavesDePreset(p));
	const porSubtitulo = new Map([...claves].map(([id, v]) => [id, { [PARAM_CLAVES]: v }]));
	return aplicarEstiloASubtitulos({ editor, estilo: estiloDePreset(p, lienzoDe(editor)), porSubtitulo });
}
