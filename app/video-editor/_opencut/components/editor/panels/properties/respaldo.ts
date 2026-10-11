// =============================================================================
// Las pestañas de RESPALDO del panel derecho
// =============================================================================
// Las pestañas del panel las registran varios paquetes, por tandas (ver
// docs/diseno-editor-video.md §4.1): «Texto» la registra el de animaciones y
// texto, «Básico» del audio el de audio, la del efecto el de color… Mientras una
// no exista, el elemento quedaría sin nada que tocar. Para eso este paquete
// registra, con orden alto, una pestaña de respaldo por tipo con los parámetros
// del motor, que se oculta SOLA cuando aparece la de verdad.
//
// «La de verdad» se reconoce por el rótulo de CapCut, no por cualquier pestaña
// que aplique: si se ocultara ante cualquiera, la «Velocidad» del paquete de
// clips (que aplica al audio) borraría el volumen del audio antes de que llegue
// su «Básico». Cada respaldo dice qué rótulos lo reemplazan; `null` = cualquier
// otra pestaña (el efecto, que lo dibuja un solo paquete entero).

import type { PestanaInspector } from "@/app/video-editor/ce/ranuras";

type Respaldo = {
	/** Rótulos de las pestañas que lo reemplazan; `null` = cualquier otra. */
	reemplazadaPor: readonly string[] | null;
};

const respaldos = new Map<string, Respaldo>();

export function marcarRespaldo(id: string, respaldo: Respaldo): void {
	respaldos.set(id, respaldo);
}

export function esRespaldo(id: string): boolean {
	return respaldos.has(id);
}

/** Saca de las pestañas que aplican los respaldos que ya tienen reemplazo. */
export function sinRespaldosCubiertos(pestanas: PestanaInspector[]): PestanaInspector[] {
	const reales = pestanas.filter((p) => !respaldos.has(p.id));
	return pestanas.filter((p) => {
		const r = respaldos.get(p.id);
		if (!r) return true;
		if (r.reemplazadaPor === null) return reales.length === 0;
		const rotulos = r.reemplazadaPor;
		return !reales.some((otra) => rotulos.includes(otra.etiqueta));
	});
}
