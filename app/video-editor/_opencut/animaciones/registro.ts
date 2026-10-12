// =============================================================================
// Lo que registra «Animación» en las ranuras del editor
// =============================================================================
// Panel derecho › «Animación» (orden 40: después de Video/Audio/Velocidad,
// antes de Ajustar; en el texto, después de «Texto» y antes de «Texto a voz»),
// con las sub-pestañas de CapCut:
//   video, imagen          Entrada · Salida · Combinado
//   texto, sticker, forma  Entrada · Salida · Bucle
// Y el gancho visual que las dibuja (./gancho.ts), que se registra al importar.
//
// Lo importa ce/extensiones.ts.

import { pestanasInspector, subpestanasInspector } from "@/app/video-editor/ce/ranuras";
import { categoriasPara, ROTULO_CATEGORIA } from "@/app/video-editor/_opencut/params/extra/animaciones";
import type { CategoriaAnimacion } from "./catalogo";
import {
	AnimacionBucle,
	AnimacionCombinado,
	AnimacionEntrada,
	AnimacionSalida,
} from "./components/pestana-animacion";
import "./gancho";

pestanasInspector.registrar({
	id: "animacion",
	etiqueta: "Animación",
	orden: 40,
	aplica: ({ element }) => categoriasPara(element.type).length > 0,
});

const CONTENIDO: Record<CategoriaAnimacion, typeof AnimacionEntrada> = {
	entrada: AnimacionEntrada,
	salida: AnimacionSalida,
	combo: AnimacionCombinado,
	bucle: AnimacionBucle,
};

// Ids únicos en TODA la ranura (hallazgos → «Las ranuras y los ids por string»).
(["entrada", "salida", "combo", "bucle"] as const).forEach((categoria, i) => {
	subpestanasInspector.registrar({
		pestana: "animacion",
		id: `animacion-${categoria}`,
		etiqueta: ROTULO_CATEGORIA[categoria],
		// Combinado y Bucle van en el mismo lugar (nunca están los dos).
		orden: 10 + Math.min(i, 2) * 10,
		aplica: ({ element }) => categoriasPara(element.type).includes(categoria),
		Contenido: CONTENIDO[categoria],
	});
});
