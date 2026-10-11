// Todas las definiciones de efectos: las de OpenCut (desenfoque) y las de la
// copia de CapCut (Ajustar, Chroma key, Filtros, Efectos de video). Importar
// este módulo registra también sus shaders `ce-*` (cada archivo llama a
// registrarPase al cargarse).
import { effectsRegistry } from "../registry";
import type { EffectDefinition } from "../types";
import { blurEffectDefinition } from "./blur";
import { ajusteEffectDefinition } from "./ajuste";
import { cromaEffectDefinition } from "./croma";
import { filtroEffectDefinitions } from "./filtros";
import { efectoEffectDefinitions } from "./efectos";

const defaultEffects: EffectDefinition[] = [
	blurEffectDefinition,
	ajusteEffectDefinition,
	cromaEffectDefinition,
	...filtroEffectDefinitions,
	...efectoEffectDefinitions,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
