// =============================================================================
// «9.1K | 00:00»: el tamaño y la duración de cada tarjeta del inicio
// =============================================================================
// La metadata del proyecto no guarda cuánto pesa: lo que pesa son sus archivos
// multimedia, y cada uno dejó su `size` en la base `video-editor-media-<id>`
// (services/storage/service.ts → saveMediaAsset). Se suman esos números sin
// abrir un solo archivo de OPFS. Se cachea por proyecto y fecha de
// modificación: el inicio se vuelve a dibujar seguido y la base no cambia sola.

import { useEffect, useState } from "react";
import { formatTimecode, mediaTimeToSeconds } from "@/app/video-editor/_opencut/wasm/opencut";
import { IndexedDBAdapter } from "@/app/video-editor/_opencut/services/storage/indexeddb-adapter";
import type { MediaAssetData } from "@/app/video-editor/_opencut/services/storage/types";
import type { TProjectMetadata } from "@/app/video-editor/_opencut/project/types";

const cache = new Map<string, number>();

async function bytesDelProyecto(id: string): Promise<number> {
	const base = new IndexedDBAdapter<MediaAssetData>({
		dbName: `video-editor-media-${id}`,
		storeName: "media-metadata",
		version: 1,
	});
	const archivos = await base.getAll();
	return archivos.reduce((s, a) => s + (typeof a.size === "number" ? a.size : 0), 0);
}

export function useTamanoProyecto(proyecto: TProjectMetadata): number | null {
	const clave = `${proyecto.id}:${new Date(proyecto.updatedAt).getTime()}`;
	const [leido, setLeido] = useState<{ clave: string; bytes: number } | null>(null);

	useEffect(() => {
		if (cache.has(clave)) return;
		let vigente = true;
		bytesDelProyecto(proyecto.id)
			.then((bytes) => {
				cache.set(clave, bytes);
				if (vigente) setLeido({ clave, bytes });
			})
			.catch(() => {
				if (vigente) setLeido({ clave, bytes: 0 });
			});
		return () => {
			vigente = false;
		};
	}, [clave, proyecto.id]);

	const enCache = cache.get(clave);
	if (enCache !== undefined) return enCache;
	return leido?.clave === clave ? leido.bytes : null;
}

/** «9.1K», «82.3M», «1.2G»: como las tarjetas de CapCut, sin la B. */
export function formatoPeso(bytes: number): string {
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}G`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}M`;
	return `${(bytes / 1024).toFixed(1)}K`;
}

/** «00:00», o «01:02:03» desde una hora. */
export function formatoDuracionTarjeta(duracion: number | undefined): string {
	if (!duracion || duracion <= 0) return "00:00";
	const formato = mediaTimeToSeconds({ time: duracion }) >= 3600 ? "HH:MM:SS" : "MM:SS";
	return formatTimecode({ time: duracion, format: formato }) ?? "00:00";
}
